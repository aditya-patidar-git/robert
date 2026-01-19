// PCM16 to μ-law conversion
const LINEAR_TO_MULAW = new Uint8Array(65536);
for (let i = 0; i < 65536; i++) {
    let sample = i - 32768; // Convert unsigned to signed
    let sign = sample < 0 ? 0x80 : 0x00;
    if (sign) sample = -sample;
    
    sample += 33; // Add bias
    let exponent = 7;
    
    // Find exponent
    for (let e = 0; e < 8; e++) {
        if (sample <= (33 << (e + 1))) {
            exponent = e;
            break;
        }
    }
    
    let mantissa = (sample >> (exponent + 1)) & 0x0F;
    let mulaw = ~(sign | (exponent << 4) | mantissa);
    LINEAR_TO_MULAW[i] = mulaw & 0xFF;
}

export function convertPcm16ToMulaw(pcm16Base64) {
    const pcm16Buffer = Buffer.from(pcm16Base64, 'base64');
    const mulaw = Buffer.alloc(pcm16Buffer.length / 2);
    
    for (let i = 0; i < mulaw.length; i++) {
        const sample = pcm16Buffer.readInt16LE(i * 2);
        const unsigned = sample + 32768; // Convert to unsigned
        mulaw[i] = LINEAR_TO_MULAW[unsigned];
    }
    
    return mulaw.toString('base64');
}

