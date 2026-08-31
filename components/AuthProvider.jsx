'use client';

import { useEffect, useState } from 'react';
import useAuthStore from '@/lib/authStore';
import { auth } from '@/lib/firebase';

export default function AuthProvider({ children }) {
  const { initializeAuth, initialized, user, loading, debugAuthState, forceReinitializeAuth } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (
      process.env.NODE_ENV === 'development' &&
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator
    ) {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) =>
          Promise.all(registrations.map((registration) => registration.unregister())),
        )
        .catch(() => {});
      if (window.caches) {
        caches
          .keys()
          .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
          .catch(() => {});
      }
    }
    // console.log('🎯 AuthProvider mounted');
  }, []);

  useEffect(() => {
    if (mounted && !initialized) {
      // console.log('🔄 AuthProvider: Initializing auth...');
      const unsubscribe = initializeAuth();
      
      return () => {
        if (unsubscribe && typeof unsubscribe === 'function') {
          // console.log('🧹 AuthProvider: Cleaning up auth listener...');
          unsubscribe();
        }
      };
    }
  }, [initializeAuth, initialized, mounted]);

  // Check for mismatches and handle them
  useEffect(() => {
    if (!mounted) return;
    
    const checkMismatch = () => {
      const firebaseUser = auth.currentUser;
      const hasMismatch = firebaseUser && !user && !loading;
      
      if (hasMismatch) {
        // console.log('🚨 AuthProvider detected mismatch, forcing re-initialization...');
        forceReinitializeAuth();
      }
    };

    // Check immediately
    const timeoutId = setTimeout(checkMismatch, 100);
    
    return () => clearTimeout(timeoutId);
  }, [mounted, user, loading, forceReinitializeAuth]);

  // Log state changes for debugging
  // useEffect(() => {
  //   // console.log('📊 AuthProvider state change:', {
  //   //   user: user ? user.email : 'null',
  //   //   loading,
  //   //   initialized,
  //   //   mounted
  //   // });
  // }, [user, loading, initialized, mounted]);

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return null;
  }

  return <>{children}</>;
}
