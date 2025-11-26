import CallRecord from "../database/models/CallRecord.js";
import { conversations } from "../shared/state.js";

// Call status with live updates (no Socket.IO in agent service)
export const callStatus = async (req, res) => {
    const { CallSid, CallStatus, From, To } = req.body;
    console.log(`Call Status for ${CallSid}: ${CallStatus}`);

    if (!conversations[CallSid]) {
        conversations[CallSid] = { transcript: [] };
    }
    conversations[CallSid].from = From;
    conversations[CallSid].to = To;

    // Update CallRecord
    try {
        await CallRecord.findOneAndUpdate(
            { callSid: CallSid },
            {
                callSid: CallSid,
                callStatus: CallStatus,
                from: From,
                to: To
            },
            { upsert: true, new: true }
        );
    } catch (err) {
        console.error('Error updating CallRecord:', err);
    }

    // Cleanup memory for terminal states
    if (["failed", "busy", "no-answer", "completed"].includes(CallStatus)) {
        if (conversations[CallSid]) {
            delete conversations[CallSid];
        }
    }

    res.sendStatus(200);
};

