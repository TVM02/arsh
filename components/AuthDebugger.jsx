'use client';

import { useEffect } from 'react';
import useAuthStore from '@/lib/authStore';
import { auth } from '@/lib/firebase';

export default function AuthDebugger() {
  const { user, userData, loading, initialized, debugAuthState } = useAuthStore();

  useEffect(() => {
    // Log initial state
    // console.log('🔧 AuthDebugger mounted');
    debugAuthState();

    // Check Firebase directly
    // console.log('🔥 Direct Firebase check:', {
    //   currentUser: auth.currentUser,
    //   authInstance: !!auth
    // });

    // Set up interval to check auth state periodically
    const interval = setInterval(() => {
      if (auth.currentUser && !user) {
        // console.log('⚠️ Mismatch detected: Firebase has user but store does not');
        debugAuthState();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [debugAuthState, user]);

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div 
      style={{
        position: 'fixed',
        top: 10,
        right: 10,
        background: 'rgba(0,0,0,0.8)',
        color: 'white',
        padding: '10px',
        borderRadius: '5px',
        fontSize: '12px',
        zIndex: 9999,
        maxWidth: '300px'
      }}
    >
      <div><strong>Auth Debug</strong></div>
      <div>User: {user ? user.email : 'null'}</div>
      <div>Loading: {loading ? 'true' : 'false'}</div>
      <div>Initialized: {initialized ? 'true' : 'false'}</div>
      <div>Role: {userData?.role || 'none'}</div>
      <div>Firebase User: {auth.currentUser ? auth.currentUser.email : 'null'}</div>
      <button 
        onClick={debugAuthState}
        style={{
          marginTop: '5px',
          padding: '2px 5px',
          fontSize: '10px',
          background: '#007acc',
          border: 'none',
          color: 'white',
          borderRadius: '3px',
          cursor: 'pointer'
        }}
      >
        Debug State
      </button>
    </div>
  );
}
