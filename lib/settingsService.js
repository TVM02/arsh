import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

// Cache for settings to avoid repeated database calls
let settingsCache = null;
let cacheExpiry = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get system settings from Firebase
 * @returns {Promise<Object>} Settings object
 */
export const getSystemSettings = async () => {
  // Check if cache is still valid
  if (settingsCache && cacheExpiry && Date.now() < cacheExpiry) {
    return settingsCache;
  }

  try {
    const settingsDoc = await getDoc(doc(db, 'settings', 'general'));
    
    if (settingsDoc.exists()) {
      settingsCache = settingsDoc.data();
    } else {
      // Default settings if document doesn't exist
      settingsCache = {
        studentEdit: false,
        revaluationEnabled: false,
      };
    }
    
    cacheExpiry = Date.now() + CACHE_DURATION;
    return settingsCache;
  } catch (error) {
    console.error('Error fetching system settings:', error);
    // Return default settings on error
    return {
      studentEdit: false,
      revaluationEnabled: false,
    };
  }
};

/**
 * Check if student edit access is enabled
 * @returns {Promise<boolean>} True if students can edit their profiles
 */
export const isStudentEditEnabled = async () => {
  try {
    const settings = await getSystemSettings();
    return settings.studentEdit || false;
  } catch (error) {
    console.error('Error checking student edit setting:', error);
    return false; // Default to disabled on error
  }
};

/**
 * Clear settings cache (useful after settings are updated)
 */
export const clearSettingsCache = () => {
  settingsCache = null;
  cacheExpiry = null;
};

/**
 * Get a specific setting value
 * @param {string} settingKey - The key of the setting to retrieve
 * @param {any} defaultValue - Default value if setting doesn't exist
 * @returns {Promise<any>} The setting value
 */
export const getSetting = async (settingKey, defaultValue = null) => {
  try {
    const settings = await getSystemSettings();
    return settings[settingKey] !== undefined ? settings[settingKey] : defaultValue;
  } catch (error) {
    console.error(`Error getting setting ${settingKey}:`, error);
    return defaultValue;
  }
};
