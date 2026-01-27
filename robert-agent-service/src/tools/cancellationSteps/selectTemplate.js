/**
 * Cancellation Step: Select Template
 * Step 12: Select "Cancellation confirmation of course/session" template
 */

import { BaseStepTool } from '../bookingSteps/baseStepTool.js';
import { STEP_NAMES } from '../../services/browser/stepConfiguration.js';

export class SelectTemplateStep extends BaseStepTool {
  getStepName() {
    return STEP_NAMES.SELECT_TEMPLATE;
  }

  getRequiredPreferences() {
    return []; // No preferences required
  }

  getTimeout() {
    return 30000; // 30 seconds for selecting template and preview
  }
}

export default new SelectTemplateStep();
