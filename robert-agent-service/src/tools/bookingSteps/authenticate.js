/**
 * Booking Step: Authenticate
 * Step 2: Login to CRM (or reuse existing session)
 */

import { BaseStepTool } from './baseStepTool.js';
import { STEP_NAMES } from '../../services/browser/stepConfiguration.js';

export class AuthenticateStep extends BaseStepTool {
  getStepName() {
    return STEP_NAMES.AUTHENTICATE;
  }

  getRequiredPreferences() {
    return []; // No preferences required for authentication
  }
}

export default new AuthenticateStep();

