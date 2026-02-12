import { conversations } from '../shared/state.js';

const WORKFLOW_TO_PHASE = {
  cancellation: 'cancellation',
  booking: 'booking_start',
  complaint: 'complaint'
};

const ALLOWED_WORKFLOWS = Object.keys(WORKFLOW_TO_PHASE);

class StartWorkflowTool {
  async execute(parameters, callContext = {}) {
    const { workflow } = parameters || {};
    const { callSid } = callContext;

    if (!callSid) {
      return { success: false, error: 'Call SID required.', phase: null };
    }

    const normalized = typeof workflow === 'string' ? workflow.trim().toLowerCase() : '';
    if (!ALLOWED_WORKFLOWS.includes(normalized)) {
      return {
        success: false,
        error: `Invalid workflow. Allowed: ${ALLOWED_WORKFLOWS.join(', ')}.`,
        phase: null
      };
    }

    const phase = WORKFLOW_TO_PHASE[normalized];
    if (!conversations[callSid]) {
      conversations[callSid] = {};
    }
    const contextValue = normalized === 'booking' ? 'booking' : normalized;
    conversations[callSid].workflowContext = contextValue;

    const messages = {
      cancellation: "I'll help you cancel your booking. Do you have a current booking with us?",
      booking: "I'll help you with a booking. Do you have any preference for date, time or location?",
      complaint: "I'll help you file a complaint. Can you tell me what happened?"
    };

    console.log(`🎯 [${callSid}] start_workflow: ${normalized} → phase ${phase}`);
    return {
      success: true,
      phase,
      workflow: normalized,
      message: messages[normalized] || `Starting ${normalized} workflow.`
    };
  }
}

export default new StartWorkflowTool();
