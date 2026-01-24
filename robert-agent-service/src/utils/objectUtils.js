/**
 * Object Utility Functions
 * Reusable functions for object manipulation and traversal.
 * 
 * These utilities are extracted for reuse across services:
 * - templateEngine.js
 * - distributedStateService.js
 * - Other services that need object path access
 * 
 * @module utils/objectUtils
 */

/**
 * Get a nested value from an object using dot notation or array syntax.
 * 
 * @param {Object} obj - Source object
 * @param {string} path - Path like "user.name" or "items[0].name"
 * @returns {*} Value at path, or undefined if not found
 * 
 * @example
 * const obj = { user: { name: 'John', addresses: [{ city: 'London' }] } };
 * getNestedValue(obj, 'user.name'); // 'John'
 * getNestedValue(obj, 'user.addresses[0].city'); // 'London'
 * getNestedValue(obj, 'user.missing'); // undefined
 */
export function getNestedValue(obj, path) {
  if (!obj || !path) {
    return undefined;
  }
  
  // Split path by dots and array brackets
  const parts = path.split(/\.|\[|\]/).filter(Boolean);
  
  return parts.reduce((current, part) => {
    if (current === null || current === undefined) {
      return undefined;
    }
    return current[part];
  }, obj);
}

/**
 * Set a nested value in an object using dot notation.
 * Creates intermediate objects as needed.
 * 
 * @param {Object} obj - Target object
 * @param {string} path - Path like "user.name"
 * @param {*} value - Value to set
 * @returns {Object} Modified object
 * 
 * @example
 * const obj = {};
 * setNestedValue(obj, 'user.name', 'John');
 * // obj is now { user: { name: 'John' } }
 */
export function setNestedValue(obj, path, value) {
  if (!obj || !path) {
    return obj;
  }
  
  const parts = path.split('.');
  let current = obj;
  
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current[part] === undefined || current[part] === null) {
      current[part] = {};
    }
    current = current[part];
  }
  
  current[parts[parts.length - 1]] = value;
  return obj;
}

/**
 * Delete a nested value from an object using dot notation.
 * 
 * @param {Object} obj - Target object
 * @param {string} path - Path like "user.name"
 * @returns {boolean} True if deleted, false if path not found
 */
export function deleteNestedValue(obj, path) {
  if (!obj || !path) {
    return false;
  }
  
  const parts = path.split('.');
  let current = obj;
  
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current[part] === undefined || current[part] === null) {
      return false;
    }
    current = current[part];
  }
  
  const lastPart = parts[parts.length - 1];
  if (lastPart in current) {
    delete current[lastPart];
    return true;
  }
  
  return false;
}

/**
 * Check if an object has a nested path.
 * 
 * @param {Object} obj - Source object
 * @param {string} path - Path to check
 * @returns {boolean} True if path exists
 */
export function hasNestedValue(obj, path) {
  return getNestedValue(obj, path) !== undefined;
}

/**
 * Deep clone an object.
 * Handles nested objects, arrays, dates, and primitives.
 * Does NOT handle circular references, functions, or special objects.
 * 
 * @param {*} obj - Object to clone
 * @returns {*} Cloned object
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item));
  }
  
  const cloned = {};
  for (const key of Object.keys(obj)) {
    cloned[key] = deepClone(obj[key]);
  }
  
  return cloned;
}

/**
 * Deep merge two objects.
 * Source properties override target properties.
 * 
 * @param {Object} target - Target object
 * @param {Object} source - Source object
 * @returns {Object} Merged object
 */
export function deepMerge(target, source) {
  if (!source || typeof source !== 'object') {
    return target;
  }
  
  if (!target || typeof target !== 'object') {
    return deepClone(source);
  }
  
  const result = deepClone(target);
  
  for (const key of Object.keys(source)) {
    const sourceValue = source[key];
    const targetValue = result[key];
    
    if (sourceValue && typeof sourceValue === 'object' && !Array.isArray(sourceValue)) {
      result[key] = deepMerge(targetValue, sourceValue);
    } else {
      result[key] = deepClone(sourceValue);
    }
  }
  
  return result;
}

/**
 * Pick specific keys from an object.
 * 
 * @param {Object} obj - Source object
 * @param {string[]} keys - Keys to pick
 * @returns {Object} New object with only specified keys
 */
export function pick(obj, keys) {
  if (!obj || !keys || !Array.isArray(keys)) {
    return {};
  }
  
  const result = {};
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  
  return result;
}

/**
 * Omit specific keys from an object.
 * 
 * @param {Object} obj - Source object
 * @param {string[]} keys - Keys to omit
 * @returns {Object} New object without specified keys
 */
export function omit(obj, keys) {
  if (!obj) {
    return {};
  }
  
  if (!keys || !Array.isArray(keys)) {
    return { ...obj };
  }
  
  const keySet = new Set(keys);
  const result = {};
  
  for (const key of Object.keys(obj)) {
    if (!keySet.has(key)) {
      result[key] = obj[key];
    }
  }
  
  return result;
}

/**
 * Check if an object is empty (no own enumerable properties).
 * 
 * @param {Object} obj - Object to check
 * @returns {boolean} True if empty
 */
export function isEmpty(obj) {
  if (!obj || typeof obj !== 'object') {
    return true;
  }
  return Object.keys(obj).length === 0;
}

/**
 * Flatten a nested object into a single-level object with dot-notation keys.
 * 
 * @param {Object} obj - Object to flatten
 * @param {string} [prefix=''] - Prefix for keys
 * @returns {Object} Flattened object
 * 
 * @example
 * flattenObject({ user: { name: 'John', age: 30 } });
 * // { 'user.name': 'John', 'user.age': 30 }
 */
export function flattenObject(obj, prefix = '') {
  const result = {};
  
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    
    if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      Object.assign(result, flattenObject(value, fullKey));
    } else {
      result[fullKey] = value;
    }
  }
  
  return result;
}

/**
 * Unflatten a dot-notation object into a nested object.
 * 
 * @param {Object} obj - Flattened object
 * @returns {Object} Nested object
 * 
 * @example
 * unflattenObject({ 'user.name': 'John', 'user.age': 30 });
 * // { user: { name: 'John', age: 30 } }
 */
export function unflattenObject(obj) {
  const result = {};
  
  for (const key of Object.keys(obj)) {
    setNestedValue(result, key, obj[key]);
  }
  
  return result;
}
