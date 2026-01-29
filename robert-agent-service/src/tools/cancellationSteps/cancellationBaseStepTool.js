/**
 * Base class for cancellation step tools; overrides isCancellationWorkflow so
 * step validation returns cancellation_step_* tool names for shared steps (e.g. authenticate, navigateContacts).
 */

import { BaseStepTool } from '../bookingSteps/baseStepTool.js';

export class CancellationBaseStepTool extends BaseStepTool {
  get isCancellationWorkflow() {
    return true;
  }
}
