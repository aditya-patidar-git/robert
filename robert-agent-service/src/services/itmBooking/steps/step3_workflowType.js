/**
 * Step 3: Validate workflowType is set
 * The voice agent should ask: "Have you done training with us before?"
 */
export function step3WorkflowType(bookingArgs, sessionDetails, screenshots) {
  const workflowType = bookingArgs.workflowType;
  
  if (!workflowType) {
    console.warn('⚠️ Step 3: workflowType not set in bookingArgs');
    return {
      success: false,
      requiresWorkflowType: true,
      message: 'I need to know if you have done training with us before. Have you done training with Universal Motorcycle Training before?',
      sessionDetails: sessionDetails,
      screenshots: screenshots
    };
  }
  
  if (workflowType !== 'existing' && workflowType !== 'new') {
    console.warn(`⚠️ Step 3: Invalid workflowType: ${workflowType}`);
    return {
      success: false,
      requiresWorkflowType: true,
      message: 'I need to know if you have done training with us before. Please answer "yes" if you have trained with us before, or "no" if you are a new client.',
      sessionDetails: sessionDetails,
      screenshots: screenshots
    };
  }
  
  console.log(`✅ Step 3: Workflow type determined: ${workflowType} client`);
  return { success: true, workflowType };
}

