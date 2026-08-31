"use client";

import { useEffect } from "react";

export default function DateFormatOverride() {
  useEffect(() => {
    // Save the original method to avoid infinite recursion if needed,
    // though we won't call it for the empty arguments case.
    const originalToLocaleDateString = Date.prototype.toLocaleDateString;

    // Override toLocaleDateString
    Date.prototype.toLocaleDateString = function (locales, options) {
      // If arguments are provided, respect them (standard behavior)
      if (locales || options) {
        return originalToLocaleDateString.apply(this, [locales, options]);
      }

      // Default behavior (no args): Return dd-mm-yyyy
      try {
        const day = String(this.getDate()).padStart(2, "0");
        const month = String(this.getMonth() + 1).padStart(2, "0");
        const year = this.getFullYear();
        return `${day}-${month}-${year}`;
      } catch (e) {
        // Fallback to original if something goes wrong
        return originalToLocaleDateString.apply(this, []);
      }
    };

    console.log("Date format globally overridden to dd-mm-yyyy");
  }, []);

  return null;
}
