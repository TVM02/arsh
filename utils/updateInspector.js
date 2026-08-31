// Temporary utility to update inspector with missing allowedTime field
// Run this in browser console on the admin page to fix existing inspector

import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export const updateInspectorWithAllowedTime = async (inspectorUid, allowedTimeMinutes = 60) => {
  try {
    await updateDoc(doc(db, 'users', inspectorUid), {
      allowedTime: allowedTimeMinutes
    });
    return true;
  } catch (error) {
    console.error('Error updating inspector:', error);
    return false;
  }
};

