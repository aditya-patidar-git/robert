/**
 * Cancellation Step: Select Template
 * Step 12: Select "Cancellation confirmation of course/session" template
 */

import { CancellationBaseStepTool } from './cancellationBaseStepTool.js';
import { STEP_NAMES } from '../../services/browser/stepConfiguration.js';

export class SelectTemplateStep extends CancellationBaseStepTool {
  getStepName() {
    return STEP_NAMES.SELECT_TEMPLATE;
  }

  getRequiredPreferences() {
    return []; // No preferences required
  }

  getTimeout() {
    return 60000; // 60 seconds for selecting template and preview
  }
}

export default new SelectTemplateStep();
