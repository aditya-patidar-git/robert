import express from 'express';
import { createServer } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import twilio from 'twilio';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const {
  TWILIO_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_NUMBER,
  DOMAIN,
  OPENAI_API_KEY,
  PORT = 3001
} = process.env;

if (!TWILIO_SID || !TWILIO_AUTH_TOKEN || !TWILIO_NUMBER || !DOMAIN || !OPENAI_API_KEY) {
  console.error('Missing env vars!');
  process.exit(1);
}

const client = twilio(TWILIO_SID, TWILIO_AUTH_TOKEN);
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/', (_, res) => res.send('AI Voice Agent LIVE - Local VS Code'));

// WebSocket upgrade
server.on('upgrade', (req, socket, head) => {
  if (req.url === '/media-stream') {
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws));
  } else socket.destroy();
});

wss.on('connection', twilioWs => {
  console.log('Twilio connected');

  const openaiWs = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview', {
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'OpenAI-Beta': 'realtime=v1'
    }
  });

  let streamSid = null;
  let isResponding = false;
  let waitingForUser = true;
  let lastUserTranscript = null; // Track last user input to prevent duplicate responses

  openaiWs.on('open', () => {
    console.log('OpenAI connected');
    openaiWs.send(JSON.stringify({
      type: 'session.update',
      session: {
        turn_detection: { 
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500
        },
        input_audio_format: 'g711_ulaw',
        output_audio_format: 'g711_ulaw',
        voice: 'alloy',
        instructions: `You are a super friendly AI assistant. IMPORTANT: You MUST ONLY speak in English. Never switch to any other language including Hindi, Urdu, or any other language. Always respond in English only, regardless of what language the user speaks. Greet warmly and be natural. Wait for the user to speak before responding. Only respond when the user actually speaks - do not assume or continue the conversation on your own.`,
        temperature: 0.8
      }
    }));
  });

  openaiWs.on('message', data => {
    if (openaiWs.readyState !== openaiWs.OPEN) return;
    const event = JSON.parse(data);
    
    // Log all events for debugging
    if (event.type && !event.type.includes('audio.delta')) {
      console.log('📨 OpenAI event:', event.type);
    }
    
    // Handle audio output
    if (event.type === 'response.audio.delta' && event.delta) {
      isResponding = true;
      twilioWs.send(JSON.stringify({
        event: 'media',
        streamSid,
        media: { payload: event.delta }
      }));
    }
    
    // Handle when response is done
    if (event.type === 'response.done') {
      console.log('✅ AI finished speaking');
      isResponding = false;
      waitingForUser = true;
    }
    
    // Handle when user speech is detected and transcribed
    if (event.type === 'conversation.item.input_audio_transcription.completed') {
      const transcript = event.transcript || '';
      console.log('👤 User said:', transcript);
      
      // Only create response if this is new user input (not duplicate)
      if (transcript && transcript !== lastUserTranscript && !isResponding) {
        lastUserTranscript = transcript;
        waitingForUser = false;
        console.log('🎯 Creating response to user input:', transcript);
        openaiWs.send(JSON.stringify({
          type: 'response.create',
          response: {
            modalities: ['audio']
          }
        }));
      } else {
        console.log('⚠️ Skipping response - duplicate or already responding');
      }
    }
    
    // Handle when user input audio buffer is committed
    if (event.type === 'conversation.item.input_audio_buffer.committed') {
      console.log('👤 User finished speaking, waiting for transcription...');
    }
    
    // Handle interruptions
    if (event.type === 'response.audio_transcript.done') {
      console.log('🤖 AI said:', event.transcript);
    }
    
    // Handle when input audio transcription starts
    if (event.type === 'conversation.item.input_audio_transcription.started') {
      console.log('👤 Transcribing user speech...');
    }
    
    // Handle automatic response creation attempts - block them
    if (event.type === 'response.created' && !waitingForUser && isResponding) {
      console.log('⚠️ Blocked automatic response creation');
    }
  });

  twilioWs.on('message', msg => {
    const data = JSON.parse(msg);
    if (data.event === 'start') {
      streamSid = data.start.streamSid;
      console.log('Call LIVE:', streamSid);
      waitingForUser = true;
      lastUserTranscript = null;
    }
    if (data.event === 'media') {
      if (openaiWs.readyState === openaiWs.OPEN) {
        // CRITICAL: Always append audio so OpenAI can hear the user
        // Remove the conditional - we need to always send user audio
        openaiWs.send(JSON.stringify({
          type: 'input_audio_buffer.append',
          audio: data.media.payload
        }));
      }
    }
  });

  twilioWs.on('close', () => openaiWs.close());
  openaiWs.on('close', () => twilioWs.close());
});

// API endpoint for making calls from frontend
app.post('/api/outbound/make-call', async (req, res) => {
  const { toNumbers } = req.body;
  
  if (!Array.isArray(toNumbers) || toNumbers.length === 0) {
    return res.status(400).json({ error: 'Provide toNumbers array' });
  }

  try {
    const results = [];
    for (const to of toNumbers) {
      console.log(`📞 Initiating call: to=${to}, from=${TWILIO_NUMBER}`);
      
      const call = await client.calls.create({
        from: TWILIO_NUMBER,
        to: to,
        twiml: `<Response>
          <Connect>
            <Stream url="wss://${DOMAIN}/media-stream"/>
          </Connect>
          <Pause length="3600"/>
        </Response>`
      });

      console.log(`✅ Call created: SID=${call.sid}, Status=${call.status}, To=${call.to}`);
      results.push({ callSid: call.sid, to });
    }

    return res.json({ success: true, calls: results });
  } catch (err) {
    console.error('❌ make-call error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Manual call trigger (for testing)
app.get('/call', async (req, res) => {
  const to = req.query.to;
  if (!to) return res.status(400).send('Add ?to=+918120523400');

  try {
    const call = await client.calls.create({
      from: TWILIO_NUMBER,
      to: to,
      twiml: `<Response>
        <Connect>
          <Stream url="wss://${DOMAIN}/media-stream"/>
        </Connect>
        <Pause length="3600"/>
      </Response>`
    });
    res.send(`Calling ${to}... SID: ${call.sid}`);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

server.listen(PORT, () => {
  console.log(`\nLOCAL SERVER READY → http://localhost:${PORT}`);
  console.log(`TUNNEL URL → https://${DOMAIN}`);
  console.log(`CALL NOW → http://localhost:${PORT}/call?to=+918120523400\n`);
});