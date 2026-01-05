/**
 * Preference Validator
 * Validates required preferences before tool execution
 * Returns missing preferences and valid options for each course type
 */

// Valid options for each preference type by course
const VALID_OPTIONS = {
  bikeType: {
    ITM: ['125cc automatic', '50cc automatic', '125cc manual'],
    CBT: ['125cc automatic', '50cc automatic', '125cc manual'],
    'CBT Executive': ['125cc automatic', '50cc automatic', '125cc manual'],
    'Private Lesson': ['125cc automatic', '50cc automatic', '125cc manual'],
    'Gear Conversion': ['125cc automatic', '50cc automatic', '125cc manual'],
    'TfL 1-2-1': ['125cc automatic', '50cc automatic', '125cc manual'],
    'TfL Beyond CBT': ['125cc automatic', '50cc automatic', '125cc manual'],
    'Full Licence Assessment': ['125cc automatic', '50cc automatic', '125cc manual']
  },
  cbtType: {
    CBT: ['standard', 'renewal'],
    'CBT Executive': ['standard', 'renewal']
  },
  duration: {
    'Gear Conversion': ['2', '3', '4']
  }
};

// Required preferences by course type and step
const REQUIRED_PREFERENCES = {
  selectBookingOptions: {
    ITM: ['bikeType'],
    'Introduction to Motorcycling': ['bikeType'],
    CBT: ['cbtType', 'bikeType'],
    'Compulsory Basic Training': ['cbtType', 'bikeType'],
    'CBT Executive': ['cbtType', 'bikeType'],
    'CBT Executive 1-2-1': ['cbtType', 'bikeType'],
    'Private Lesson': ['bikeType'],
    'Gear Conversion': ['duration', 'bikeType'],
    'TfL 1-2-1': ['bikeType'],
    'TfL 1-2-1 Motorcycle Skills': ['bikeType'],
    'TfL Beyond CBT': ['bikeType'],
    'TfL - Beyond CBT - Skills for Delivery Riders': ['bikeType'],
    'Full Licence Assessment': ['bikeType'],
    'Full Motorcycle Licence Assessment': ['bikeType']
  }
};

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

/**
 * Validate preferences for a given step
 * @param {string} stepName - Step name (e.g., 'selectBookingOptions')
 * @param {string} courseType - Course type
 * @param {Object} providedPreferences - Preferences provided by user
 * @returns {Object} Validation result
 */
export function validatePreferences(stepName, courseType, providedPreferences = {}) {
  const normalizedCourseType = normalizeCourseType(courseType);
  
  // Get required preferences for this step and course
  const stepRequirements = REQUIRED_PREFERENCES[stepName];
  if (!stepRequirements) {
    // No preferences required for this step
    return {
      valid: true,
      missingPreferences: [],
      invalidPreferences: [],
      validOptions: {}
    };
  }

  const requiredPrefs = stepRequirements[normalizedCourseType] || stepRequirements[courseType] || [];
  
  if (requiredPrefs.length === 0) {
    // No preferences required
    return {
      valid: true,
      missingPreferences: [],
      invalidPreferences: [],
      validOptions: {}
    };
  }

  // Check for missing preferences
  const missingPreferences = requiredPrefs.filter(pref => {
    const value = providedPreferences[pref];
    return !value || (typeof value === 'string' && value.trim() === '');
  });

  // Check for invalid preferences
  const invalidPreferences = [];
  const validOptions = {};

  for (const pref of requiredPrefs) {
    const value = providedPreferences[pref];
    if (value) {
      // Get valid options for this preference and course
      const options = VALID_OPTIONS[pref]?.[normalizedCourseType] || VALID_OPTIONS[pref]?.[courseType] || [];
      
      if (options.length > 0) {
        validOptions[pref] = options;
        
        // Normalize value for comparison (case-insensitive, trim)
        const normalizedValue = value.trim().toLowerCase();
        const normalizedOptions = options.map(opt => opt.toLowerCase());
        
        if (!normalizedOptions.includes(normalizedValue)) {
          invalidPreferences.push({
            preference: pref,
            providedValue: value,
            validOptions: options
          });
        }
      }
    } else {
      // Get valid options even if preference is missing (for error message)
      const options = VALID_OPTIONS[pref]?.[normalizedCourseType] || VALID_OPTIONS[pref]?.[courseType] || [];
      if (options.length > 0) {
        validOptions[pref] = options;
      }
    }
  }

  const valid = missingPreferences.length === 0 && invalidPreferences.length === 0;

  return {
    valid,
    missingPreferences,
    invalidPreferences,
    validOptions
  };
}

/**
 * Get valid options for a preference type and course
 * @param {string} preferenceType - Preference type (bikeType, cbtType, etc.)
 * @param {string} courseType - Course type
 * @returns {Array} Array of valid options
 */
export function getValidOptions(preferenceType, courseType) {
  const normalizedCourseType = normalizeCourseType(courseType);
  return VALID_OPTIONS[preferenceType]?.[normalizedCourseType] || 
         VALID_OPTIONS[preferenceType]?.[courseType] || 
         [];
}

/**
 * Generate user-friendly error message for missing/invalid preferences
 * @param {Object} validationResult - Result from validatePreferences
 * @param {string} courseType - Course type
 * @returns {string} Error message
 */
export function generatePreferenceErrorMessage(validationResult, courseType) {
  const { missingPreferences, invalidPreferences, validOptions } = validationResult;

  if (missingPreferences.length === 0 && invalidPreferences.length === 0) {
    return null;
  }

  const messages = [];

  // Handle missing preferences
  if (missingPreferences.length > 0) {
    const missingMessages = missingPreferences.map(pref => {
      const options = validOptions[pref] || [];
      if (pref === 'bikeType') {
        return `I need to know which bike type you prefer: "${options.join('", "')}".`;
      } else if (pref === 'cbtType') {
        return `Is this a CBT Standard or CBT Renewal?`;
      } else if (pref === 'duration') {
        return `Which duration would you prefer: 2 hours, 3 hours, or 4 hours?`;
      }
      return `I need your ${pref} preference.`;
    });
    messages.push(...missingMessages);
  }

  // Handle invalid preferences
  if (invalidPreferences.length > 0) {
    const invalidMessages = invalidPreferences.map(invalid => {
      const { preference, providedValue, validOptions: options } = invalid;
      if (preference === 'bikeType') {
        return `"${providedValue}" is not a valid bike type. Please choose one of: "${options.join('", "')}".`;
      } else if (preference === 'cbtType') {
        return `"${providedValue}" is not a valid CBT type. Please choose one of: "${options.join('", "')}".`;
      } else if (preference === 'duration') {
        return `"${providedValue}" is not a valid duration. Please choose one of: "${options.join('", "')}".`;
      }
      return `"${providedValue}" is not a valid ${preference}. Valid options: "${options.join('", "')}".`;
    });
    messages.push(...invalidMessages);
  }

  return messages.join(' ');
}

