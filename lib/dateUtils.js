/**
 * Utility functions for consistent date formatting across the application
 * All dates are formatted as DD/MM/YYYY (Day/Month/Year) format
 */

/**
 * Format any date value to DD/MM/YYYY format
 * @param {*} dateValue - Can be Firestore Timestamp, Date object, string, or number
 * @param {string} fallback - Fallback string if date is invalid
 * @returns {string} Formatted date string in DD/MM/YYYY format
 */
export const formatDate = (dateValue, fallback = "Not available") => {
  if (!dateValue) return fallback;

  try {
    let date;

    // Handle Firestore Timestamp with toDate method
    if (
      typeof dateValue === "object" &&
      typeof dateValue.toDate === "function"
    ) {
      date = dateValue.toDate();
    }
    // Handle Firestore Timestamp with seconds property
    else if (
      typeof dateValue === "object" &&
      typeof dateValue.seconds === "number"
    ) {
      date = new Date(dateValue.seconds * 1000);
    }
    // Handle string or number dates
    else if (typeof dateValue === "string" || typeof dateValue === "number") {
      date = new Date(dateValue);
    }
    // Handle Date objects
    else if (dateValue instanceof Date) {
      date = dateValue;
    } else {
      return fallback;
    }

    // Check if date is valid
    if (isNaN(date.getTime())) {
      return fallback;
    }

    // Format as DD-MM-YYYY
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();

    return `${day}-${month}-${year}`;
  } catch (error) {
    console.error("Error formatting date:", error);
    return fallback;
  }
};

/**
 * Format date with time to DD-MM-YYYY HH:MM format
 * @param {*} dateValue - Can be Firestore Timestamp, Date object, string, or number
 * @param {string} fallback - Fallback string if date is invalid
 * @returns {string} Formatted date string in DD-MM-YYYY HH:MM format
 */
export const formatDateTime = (dateValue, fallback = "Not available") => {
  if (!dateValue) return fallback;

  try {
    let date;

    // Handle Firestore Timestamp with toDate method
    if (
      typeof dateValue === "object" &&
      typeof dateValue.toDate === "function"
    ) {
      date = dateValue.toDate();
    }
    // Handle Firestore Timestamp with seconds property
    else if (
      typeof dateValue === "object" &&
      typeof dateValue.seconds === "number"
    ) {
      date = new Date(dateValue.seconds * 1000);
    }
    // Handle string or number dates
    else if (typeof dateValue === "string" || typeof dateValue === "number") {
      date = new Date(dateValue);
    }
    // Handle Date objects
    else if (dateValue instanceof Date) {
      date = dateValue;
    } else {
      return fallback;
    }

    // Check if date is valid
    if (isNaN(date.getTime())) {
      return fallback;
    }

    // Format as DD-MM-YYYY HH:MM
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");

    return `${day}-${month}-${year} ${hours}:${minutes}`;
  } catch (error) {
    console.error("Error formatting date time:", error);
    return fallback;
  }
};

/**
 * Format date for input field (YYYY-MM-DD)
 * @param {*} dateValue - Can be Firestore Timestamp, Date object, string, or number
 * @returns {string} Formatted date string in YYYY-MM-DD format for input fields
 */
export const formatDateForInput = (dateValue) => {
  if (!dateValue) return "";

  try {
    let date;

    // Handle Firestore Timestamp with toDate method
    if (
      typeof dateValue === "object" &&
      typeof dateValue.toDate === "function"
    ) {
      date = dateValue.toDate();
    }
    // Handle Firestore Timestamp with seconds property
    else if (
      typeof dateValue === "object" &&
      typeof dateValue.seconds === "number"
    ) {
      date = new Date(dateValue.seconds * 1000);
    }
    // Handle string or number dates
    else if (typeof dateValue === "string" || typeof dateValue === "number") {
      date = new Date(dateValue);
    }
    // Handle Date objects
    else if (dateValue instanceof Date) {
      date = dateValue;
    } else {
      return "";
    }

    // Check if date is valid
    if (isNaN(date.getTime())) {
      return "";
    }

    // Format as YYYY-MM-DD for input fields
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error("Error formatting date for input:", error);
    return "";
  }
};

/**
 * Get day name from date
 * @param {*} dateValue - Can be Firestore Timestamp, Date object, string, or number
 * @returns {string} Day name (e.g., "Monday")
 */
export const getDayName = (dateValue) => {
  if (!dateValue) return "";

  try {
    let date;

    if (
      typeof dateValue === "object" &&
      typeof dateValue.toDate === "function"
    ) {
      date = dateValue.toDate();
    } else if (
      typeof dateValue === "object" &&
      typeof dateValue.seconds === "number"
    ) {
      date = new Date(dateValue.seconds * 1000);
    } else {
      date = new Date(dateValue);
    }

    if (isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleDateString("en-US", { weekday: "long" });
  } catch (error) {
    console.error("Error getting day name:", error);
    return "";
  }
};
