// Admin utility to update existing inspectors with allowedTime field
// This can be used by admins to fix existing inspector accounts

import { collection, getDocs, doc, updateDoc, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

export const updateAllInspectorsWithAllowedTime = async (defaultAllowedTime = 60) => {
  try {
    console.log('🔍 Searching for inspectors without allowedTime field...');
    
    // Get all users with role 'inspector'
    const inspectorsQuery = query(
      collection(db, 'users'),
      where('role', '==', 'inspector')
    );
    
    const inspectorsSnapshot = await getDocs(inspectorsQuery);
    const inspectors = inspectorsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    
    // Filter inspectors that don't have allowedTime field
    const inspectorsWithoutAllowedTime = inspectors.filter(inspector => 
      inspector.allowedTime === undefined || inspector.allowedTime === null
    );
    
    console.log(`⚠️  Found ${inspectorsWithoutAllowedTime.length} inspector(s) without allowedTime field`);
    
    if (inspectorsWithoutAllowedTime.length === 0) {
      console.log('✅ All inspectors already have allowedTime field set');
      return {
        success: true,
        message: 'All inspectors already have allowedTime field set',
        updated: 0,
        total: inspectors.length
      };
    }
    
    // Update each inspector without allowedTime
    const updatePromises = inspectorsWithoutAllowedTime.map(async (inspector) => {
      try {
        await updateDoc(doc(db, 'users', inspector.id), {
          allowedTime: defaultAllowedTime,
          updatedAt: new Date().toISOString()
        });
        return { success: true, email: inspector.email };
      } catch (error) {
        console.error(`❌ Failed to update inspector ${inspector.email}:`, error);
        return { success: false, email: inspector.email, error: error.message };
      }
    });
    
    const results = await Promise.all(updatePromises);
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    if (failed.length > 0) {
      console.log(`❌ Failed to update ${failed.length} inspector(s):`, failed);
    }
    
    return {
      success: true,
      message: `Updated ${successful.length} of ${inspectorsWithoutAllowedTime.length} inspectors`,
      updated: successful.length,
      failed: failed.length,
      total: inspectors.length,
      defaultAllowedTime
    };
    
  } catch (error) {
    console.error('❌ Error updating inspectors:', error);
    return {
      success: false,
      message: error.message,
      updated: 0,
      failed: 0,
      total: 0
    };
  }
};

// Usage example:
// updateAllInspectorsWithAllowedTime(60).then(result => console.log(result));