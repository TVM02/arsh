"use client";

import { useState } from 'react';
import useAuthStore from '@/lib/authStore';

const UserDataDebugger = () => {
  const { userData, refreshUserData, loading } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const newUserData = await refreshUserData();
      console.log('Refreshed userData:', newUserData);
    } catch (error) {
      console.error('Error refreshing user data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return <div className="p-4 bg-yellow-100 rounded-lg">Loading user data...</div>;
  }

  return (
    <div className="p-4 bg-gray-100 rounded-lg space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">User Data Debugger</h3>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {refreshing ? 'Refreshing...' : 'Refresh User Data'}
        </button>
      </div>
      
      <div className="space-y-2">
        <div className="text-sm font-medium">Current userData:</div>
        <pre className="text-xs bg-white p-3 rounded border overflow-auto max-h-96">
          {JSON.stringify(userData, null, 2)}
        </pre>
      </div>
      
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <strong>Role:</strong> {userData?.role || 'N/A'}
        </div>
        <div>
          <strong>Allowed Time:</strong> {userData?.allowedTime || 'N/A'} seconds
        </div>
        <div>
          <strong>Assigned Madarsas:</strong> {userData?.assignedMadarsas?.length || 0}
        </div>
        <div>
          <strong>Status:</strong> {userData?.status || 'N/A'}
        </div>
      </div>
    </div>
  );
};

export default UserDataDebugger;