/**
 * Cancellation Step: Fill Cancellation Form
 * Step 10: Fill cancellation form fields and submit
 */

import { BaseStepTool } from '../bookingSteps/baseStepTool.js';
import { STEP_NAMES } from '../../services/browser/stepConfiguration.js';

export class FillCancellationFormStep extends BaseStepTool {
  getStepName() {
    return STEP_NAMES.FILL_CANCELLATION_FORM;
  }

  getRequiredPreferences() {
    return ['courseType', 'cancellationFee']; // Need course type and fee amount
  }

  getTimeout() {
    return 45000; // 45 seconds for filling form and submitting
  }
}

export default new FillCancellationFormStep();
