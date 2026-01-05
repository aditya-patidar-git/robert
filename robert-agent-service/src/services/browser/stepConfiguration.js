/**
 * Step Configuration
 * Maps course types and workflow types to step numbers and step names
 * Step numbers are course/workflow-specific, not hardcoded in tool names
 */

// Step name constants (action-based, course-agnostic)
export const STEP_NAMES = {
  CHECK_AVAILABILITY: 'checkAvailability',
  AUTHENTICATE: 'authenticate',
  NAVIGATE_CONTACTS: 'navigateContacts',      // Existing workflow only
  SEARCH_CLIENT: 'searchClient',              // Existing workflow only
  SELECT_SESSION: 'selectSession',
  SELECT_BOOKING_OPTIONS: 'selectBookingOptions',
  CREATE_NEW_CONTACT: 'createNewContact',      // New workflow only
  FILL_CONTACT_DETAILS: 'fillContactDetails',
  PROCESS_PAYMENT: 'processPayment',
  SEND_CONFIRMATION: 'sendConfirmation',
  SEND_TERMS: 'sendTerms',
  SEND_SMS: 'sendSMS'                          // Existing workflow only
};

/**
 * Step configuration for each course type
 * Maps step names to step numbers based on workflow type
 */
const STEP_CONFIGURATIONS = {
  'ITM': {
    'Introduction to Motorcycling': {
      existing: {
        [STEP_NAMES.CHECK_AVAILABILITY]: 1,
        [STEP_NAMES.AUTHENTICATE]: 2,
        [STEP_NAMES.NAVIGATE_CONTACTS]: 4,
        [STEP_NAMES.SEARCH_CLIENT]: 5,
        [STEP_NAMES.SELECT_SESSION]: 6,
        [STEP_NAMES.SELECT_BOOKING_OPTIONS]: 7,
        [STEP_NAMES.FILL_CONTACT_DETAILS]: 8,
        [STEP_NAMES.PROCESS_PAYMENT]: 9,
        [STEP_NAMES.SEND_CONFIRMATION]: 10,
        [STEP_NAMES.SEND_TERMS]: 11,
        [STEP_NAMES.SEND_SMS]: 12
      },
      new: {
        [STEP_NAMES.CHECK_AVAILABILITY]: 1,
        [STEP_NAMES.AUTHENTICATE]: 2,
        [STEP_NAMES.SELECT_SESSION]: 4,
        [STEP_NAMES.SELECT_BOOKING_OPTIONS]: 5,
        [STEP_NAMES.CREATE_NEW_CONTACT]: 6,
        [STEP_NAMES.FILL_CONTACT_DETAILS]: 7,
        [STEP_NAMES.PROCESS_PAYMENT]: 8,
        [STEP_NAMES.SEND_CONFIRMATION]: 9,
        [STEP_NAMES.SEND_TERMS]: 10,
        [STEP_NAMES.SEND_SMS]: 11
      }
    }
  },
  'CBT': {
    'Compulsory Basic Training': {
      existing: {
        [STEP_NAMES.CHECK_AVAILABILITY]: 1,
        [STEP_NAMES.AUTHENTICATE]: 2,
        [STEP_NAMES.NAVIGATE_CONTACTS]: 4,
        [STEP_NAMES.SEARCH_CLIENT]: 5,
        [STEP_NAMES.SELECT_SESSION]: 6,
        [STEP_NAMES.SELECT_BOOKING_OPTIONS]: 7,
        [STEP_NAMES.FILL_CONTACT_DETAILS]: 8,
        [STEP_NAMES.PROCESS_PAYMENT]: 9,
        [STEP_NAMES.SEND_CONFIRMATION]: 10,
        [STEP_NAMES.SEND_TERMS]: 11,
        [STEP_NAMES.SEND_SMS]: 12
      },
      new: {
        [STEP_NAMES.CHECK_AVAILABILITY]: 1,
        [STEP_NAMES.AUTHENTICATE]: 2,
        [STEP_NAMES.SELECT_SESSION]: 4,
        [STEP_NAMES.SELECT_BOOKING_OPTIONS]: 5,
        [STEP_NAMES.CREATE_NEW_CONTACT]: 6,
        [STEP_NAMES.FILL_CONTACT_DETAILS]: 7,
        [STEP_NAMES.PROCESS_PAYMENT]: 8,
        [STEP_NAMES.SEND_CONFIRMATION]: 9,
        [STEP_NAMES.SEND_TERMS]: 10,
        [STEP_NAMES.SEND_SMS]: 11
      }
    }
  },
  'CBT Executive': {
    'CBT Executive 1-2-1': {
      existing: {
        [STEP_NAMES.CHECK_AVAILABILITY]: 1,
        [STEP_NAMES.AUTHENTICATE]: 2,
        [STEP_NAMES.NAVIGATE_CONTACTS]: 4,
        [STEP_NAMES.SEARCH_CLIENT]: 5,
        [STEP_NAMES.SELECT_SESSION]: 6,
        [STEP_NAMES.SELECT_BOOKING_OPTIONS]: 7,
        [STEP_NAMES.FILL_CONTACT_DETAILS]: 8,
        [STEP_NAMES.PROCESS_PAYMENT]: 9,
        [STEP_NAMES.SEND_CONFIRMATION]: 10,
        [STEP_NAMES.SEND_TERMS]: 11,
        [STEP_NAMES.SEND_SMS]: 12
      },
      new: {
        [STEP_NAMES.CHECK_AVAILABILITY]: 1,
        [STEP_NAMES.AUTHENTICATE]: 2,
        [STEP_NAMES.SELECT_SESSION]: 4,
        [STEP_NAMES.SELECT_BOOKING_OPTIONS]: 5,
        [STEP_NAMES.CREATE_NEW_CONTACT]: 6,
        [STEP_NAMES.FILL_CONTACT_DETAILS]: 7,
        [STEP_NAMES.PROCESS_PAYMENT]: 8,
        [STEP_NAMES.SEND_CONFIRMATION]: 9,
        [STEP_NAMES.SEND_TERMS]: 10,
        [STEP_NAMES.SEND_SMS]: 11
      }
    }
  },
  'Private Lesson': {
    'Private Lesson': {
      existing: {
        [STEP_NAMES.CHECK_AVAILABILITY]: 1,
        [STEP_NAMES.AUTHENTICATE]: 2,
        [STEP_NAMES.NAVIGATE_CONTACTS]: 4,
        [STEP_NAMES.SEARCH_CLIENT]: 5,
        [STEP_NAMES.SELECT_SESSION]: 6,
        [STEP_NAMES.SELECT_BOOKING_OPTIONS]: 7,
        [STEP_NAMES.FILL_CONTACT_DETAILS]: 8,
        [STEP_NAMES.PROCESS_PAYMENT]: 9,
        [STEP_NAMES.SEND_CONFIRMATION]: 10,
        [STEP_NAMES.SEND_TERMS]: 11,
        [STEP_NAMES.SEND_SMS]: 12
      },
      new: {
        [STEP_NAMES.CHECK_AVAILABILITY]: 1,
        [STEP_NAMES.AUTHENTICATE]: 2,
        [STEP_NAMES.SELECT_SESSION]: 4,
        [STEP_NAMES.SELECT_BOOKING_OPTIONS]: 5,
        [STEP_NAMES.CREATE_NEW_CONTACT]: 6,
        [STEP_NAMES.FILL_CONTACT_DETAILS]: 7,
        [STEP_NAMES.PROCESS_PAYMENT]: 8,
        [STEP_NAMES.SEND_CONFIRMATION]: 9,
        [STEP_NAMES.SEND_TERMS]: 10,
        [STEP_NAMES.SEND_SMS]: 11
      }
    }
  },
  'Gear Conversion': {
    'Gear Conversion': {
      existing: {
        [STEP_NAMES.CHECK_AVAILABILITY]: 1,
        [STEP_NAMES.AUTHENTICATE]: 2,
        [STEP_NAMES.NAVIGATE_CONTACTS]: 4,
        [STEP_NAMES.SEARCH_CLIENT]: 5,
        [STEP_NAMES.SELECT_SESSION]: 6,
        [STEP_NAMES.SELECT_BOOKING_OPTIONS]: 7,
        [STEP_NAMES.FILL_CONTACT_DETAILS]: 8,
        [STEP_NAMES.PROCESS_PAYMENT]: 9,
        [STEP_NAMES.SEND_CONFIRMATION]: 10,
        [STEP_NAMES.SEND_TERMS]: 11,
        [STEP_NAMES.SEND_SMS]: 12
      },
      new: {
        [STEP_NAMES.CHECK_AVAILABILITY]: 1,
        [STEP_NAMES.AUTHENTICATE]: 2,
        [STEP_NAMES.SELECT_SESSION]: 4,
        [STEP_NAMES.SELECT_BOOKING_OPTIONS]: 5,
        [STEP_NAMES.CREATE_NEW_CONTACT]: 6,
        [STEP_NAMES.FILL_CONTACT_DETAILS]: 7,
        [STEP_NAMES.PROCESS_PAYMENT]: 8,
        [STEP_NAMES.SEND_CONFIRMATION]: 9,
        [STEP_NAMES.SEND_TERMS]: 10,
        [STEP_NAMES.SEND_SMS]: 11
      }
    }
  },
  'TfL 1-2-1': {
    'TfL 1-2-1 Motorcycle Skills': {
      existing: {
        [STEP_NAMES.CHECK_AVAILABILITY]: 1,
        [STEP_NAMES.AUTHENTICATE]: 2,
        [STEP_NAMES.NAVIGATE_CONTACTS]: 4,
        [STEP_NAMES.SEARCH_CLIENT]: 5,
        [STEP_NAMES.SELECT_SESSION]: 6,
        [STEP_NAMES.SELECT_BOOKING_OPTIONS]: 7,
        [STEP_NAMES.FILL_CONTACT_DETAILS]: 8,
        [STEP_NAMES.PROCESS_PAYMENT]: 9,
        [STEP_NAMES.SEND_CONFIRMATION]: 10,
        [STEP_NAMES.SEND_TERMS]: 11,
        [STEP_NAMES.SEND_SMS]: 12
      },
      new: {
        [STEP_NAMES.CHECK_AVAILABILITY]: 1,
        [STEP_NAMES.AUTHENTICATE]: 2,
        [STEP_NAMES.SELECT_SESSION]: 4,
        [STEP_NAMES.SELECT_BOOKING_OPTIONS]: 5,
        [STEP_NAMES.CREATE_NEW_CONTACT]: 6,
        [STEP_NAMES.FILL_CONTACT_DETAILS]: 7,
        [STEP_NAMES.PROCESS_PAYMENT]: 8,
        [STEP_NAMES.SEND_CONFIRMATION]: 9,
        [STEP_NAMES.SEND_TERMS]: 10,
        [STEP_NAMES.SEND_SMS]: 11
      }
    }
  },
  'TfL Beyond CBT': {
    'TfL - Beyond CBT - Skills for Delivery Riders': {
      existing: {
        [STEP_NAMES.CHECK_AVAILABILITY]: 1,
        [STEP_NAMES.AUTHENTICATE]: 2,
        [STEP_NAMES.NAVIGATE_CONTACTS]: 4,
        [STEP_NAMES.SEARCH_CLIENT]: 5,
        [STEP_NAMES.SELECT_SESSION]: 6,
        [STEP_NAMES.SELECT_BOOKING_OPTIONS]: 7,
        [STEP_NAMES.FILL_CONTACT_DETAILS]: 8,
        [STEP_NAMES.PROCESS_PAYMENT]: 9,
        [STEP_NAMES.SEND_CONFIRMATION]: 10,
        [STEP_NAMES.SEND_TERMS]: 11,
        [STEP_NAMES.SEND_SMS]: 12
      },
      new: {
        [STEP_NAMES.CHECK_AVAILABILITY]: 1,
        [STEP_NAMES.AUTHENTICATE]: 2,
        [STEP_NAMES.SELECT_SESSION]: 4,
        [STEP_NAMES.SELECT_BOOKING_OPTIONS]: 5,
        [STEP_NAMES.CREATE_NEW_CONTACT]: 6,
        [STEP_NAMES.FILL_CONTACT_DETAILS]: 7,
        [STEP_NAMES.PROCESS_PAYMENT]: 8,
        [STEP_NAMES.SEND_CONFIRMATION]: 9,
        [STEP_NAMES.SEND_TERMS]: 10,
        [STEP_NAMES.SEND_SMS]: 11
      }
    }
  },
  'Full Licence Assessment': {
    'Full Motorcycle Licence Assessment': {
      existing: {
        [STEP_NAMES.CHECK_AVAILABILITY]: 1,
        [STEP_NAMES.AUTHENTICATE]: 2,
        [STEP_NAMES.NAVIGATE_CONTACTS]: 4,
        [STEP_NAMES.SEARCH_CLIENT]: 5,
        [STEP_NAMES.SELECT_SESSION]: 6,
        [STEP_NAMES.SELECT_BOOKING_OPTIONS]: 7,
        [STEP_NAMES.FILL_CONTACT_DETAILS]: 8,
        [STEP_NAMES.PROCESS_PAYMENT]: 9,
        [STEP_NAMES.SEND_CONFIRMATION]: 10,
        [STEP_NAMES.SEND_TERMS]: 11,
        [STEP_NAMES.SEND_SMS]: 12
      },
      new: {
        [STEP_NAMES.CHECK_AVAILABILITY]: 1,
        [STEP_NAMES.AUTHENTICATE]: 2,
        [STEP_NAMES.SELECT_SESSION]: 4,
        [STEP_NAMES.SELECT_BOOKING_OPTIONS]: 5,
        [STEP_NAMES.CREATE_NEW_CONTACT]: 6,
        [STEP_NAMES.FILL_CONTACT_DETAILS]: 7,
        [STEP_NAMES.PROCESS_PAYMENT]: 8,
        [STEP_NAMES.SEND_CONFIRMATION]: 9,
        [STEP_NAMES.SEND_TERMS]: 10,
        [STEP_NAMES.SEND_SMS]: 11
      }
    }
  }
};

/**
 * Get step number for a given course type, workflow type, and step name
 * @param {string} courseType - Course type (ITM, CBT, etc.)
 * @param {string} workflowType - 'existing' or 'new'
 * @param {string} stepName - Step name (from STEP_NAMES)
 * @returns {number|null} Step number or null if not found
 */
export function getStepNumber(courseType, workflowType, stepName) {
  if (!courseType || !workflowType || !stepName) {
    return null;
  }

  // Normalize course type (handle aliases)
  const normalizedCourseType = normalizeCourseType(courseType);
  
  // Find configuration for this course type
  const courseConfig = STEP_CONFIGURATIONS[normalizedCourseType];
  if (!courseConfig) {
    console.warn(`⚠️ [STEP_CONFIG] No configuration found for course type: ${courseType}`);
    return null;
  }

  // Get the first matching configuration (course types may have multiple entries)
  const workflowConfig = Object.values(courseConfig)[0];
  if (!workflowConfig) {
    return null;
  }

  const stepConfig = workflowConfig[workflowType];
  if (!stepConfig) {
    console.warn(`⚠️ [STEP_CONFIG] No configuration found for workflow type: ${workflowType}`);
    return null;
  }

  return stepConfig[stepName] || null;
}

/**
 * Get all step numbers for a course/workflow combination
 * @param {string} courseType - Course type
 * @param {string} workflowType - 'existing' or 'new'
 * @returns {Object} Map of step names to step numbers
 */
export function getStepConfiguration(courseType, workflowType) {
  const normalizedCourseType = normalizeCourseType(courseType);
  const courseConfig = STEP_CONFIGURATIONS[normalizedCourseType];
  if (!courseConfig) {
    return {};
  }

  const workflowConfig = Object.values(courseConfig)[0];
  if (!workflowConfig) {
    return {};
  }

  return workflowConfig[workflowType] || {};
}

/**
 * Get step name for a given step number
 * @param {string} courseType - Course type
 * @param {string} workflowType - 'existing' or 'new'
 * @param {number} stepNumber - Step number
 * @returns {string|null} Step name or null if not found
 */
export function getStepName(courseType, workflowType, stepNumber) {
  const config = getStepConfiguration(courseType, workflowType);
  for (const [stepName, num] of Object.entries(config)) {
    if (num === stepNumber) {
      return stepName;
    }
  }
  return null;
}

/**
 * Check if a step is valid for a given course/workflow
 * @param {string} courseType - Course type
 * @param {string} workflowType - 'existing' or 'new'
 * @param {string} stepName - Step name
 * @returns {boolean} True if step is valid
 */
export function isValidStep(courseType, workflowType, stepName) {
  return getStepNumber(courseType, workflowType, stepName) !== null;
}

/**
 * Get next step name after a given step
 * @param {string} courseType - Course type
 * @param {string} workflowType - 'existing' or 'new'
 * @param {number} currentStep - Current step number
 * @returns {string|null} Next step name or null if no next step
 */
export function getNextStepName(courseType, workflowType, currentStep) {
  const config = getStepConfiguration(courseType, workflowType);
  const steps = Object.entries(config)
    .map(([name, num]) => ({ name, num }))
    .sort((a, b) => a.num - b.num);

  const currentIndex = steps.findIndex(s => s.num === currentStep);
  if (currentIndex === -1 || currentIndex === steps.length - 1) {
    return null;
  }

  return steps[currentIndex + 1].name;
}

/**
 * Normalize course type to handle aliases
 * @param {string} courseType - Course type
 * @returns {string} Normalized course type
 */
function normalizeCourseType(courseType) {
  const aliases = {
    'Introduction to Motorcycling': 'ITM',
    'Compulsory Basic Training': 'CBT',
    'CBT Executive 1-2-1': 'CBT Executive',
    'TfL 1-2-1 Motorcycle Skills': 'TfL 1-2-1',
    'TfL - Beyond CBT - Skills for Delivery Riders': 'TfL Beyond CBT',
    'Full Motorcycle Licence Assessment': 'Full Licence Assessment'
  };

  return aliases[courseType] || courseType;
}

