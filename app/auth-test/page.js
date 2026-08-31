'use client';

import { useEffect } from 'react';
import useAuthStore from '@/lib/authStore';
import { auth } from '@/lib/firebase';

export default function AuthTestPage() {
  const { user, userData, loading, initialized, debugAuthState, forceReinitializeAuth } = useAuthStore();

  useEffect(() => {
    // console.log('🧪 AuthTestPage mounted');
    debugAuthState();
  }, [debugAuthState]);

  const handleForceReinit = () => {
    // console.log('🔄 User clicked force re-init');
    forceReinitializeAuth();
  };

  const handleManualCheck = () => {
    // console.log('🔍 Manual auth check');
    debugAuthState();
    // console.log('🔥 Firebase current user:', auth.currentUser);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Auth Test Page</h1>
      
      <div className="space-y-4">
        <div className="bg-gray-100 p-4 rounded">
          <h2 className="font-semibold mb-2">Auth Store State:</h2>
          <p><strong>User:</strong> {user ? user.email : 'null'}</p>
          <p><strong>UserData:</strong> {userData ? userData.fullName : 'null'}</p>
          <p><strong>Loading:</strong> {loading ? 'true' : 'false'}</p>
          <p><strong>Initialized:</strong> {initialized ? 'true' : 'false'}</p>
        </div>

        <div className="bg-blue-100 p-4 rounded">
          <h2 className="font-semibold mb-2">Firebase Direct Check:</h2>
          <p><strong>Current User:</strong> {auth.currentUser ? auth.currentUser.email : 'null'}</p>
          <p><strong>UID:</strong> {auth.currentUser ? auth.currentUser.uid : 'null'}</p>
        </div>

        <div className="space-x-4">
          <button 
            onClick={handleManualCheck}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Manual Check
          </button>
          <button 
            onClick={handleForceReinit}
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            Force Re-initialize
          </button>
        </div>

        {/* Show mismatch warning */}
        {auth.currentUser && !user && !loading && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            <strong>⚠️ Mismatch Detected!</strong>
            <p>Firebase has user but store does not. Click &quot;Force Re-initialize&quot; to fix.</p>
          </div>
        )}

        {/* Show success state */}
        {auth.currentUser && user && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
            <strong>✅ Auth State Synchronized!</strong>
            <p>Firebase and store are in sync.</p>
          </div>
        )}
      </div>
    </div>
  );
}
