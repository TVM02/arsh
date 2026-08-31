'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bell, Calendar, User, AlertCircle } from 'lucide-react';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/lib/authStore';

export default function NoticesWidget({ maxNotices = 5 }) {
  const { userRole } = useAuthStore();
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchNotices = useCallback(async () => {
    try {
      setLoading(true);
      
      // Query notices based on user role
      const noticesQuery = query(
        collection(db, 'notices'),
        where('targetAudience', 'in', ['all', userRole]),
        where('showOnDashboard', '==', true),
        orderBy('createdAt', 'desc'),
        limit(maxNotices)
      );
      
      const snapshot = await getDocs(noticesQuery);
      const noticesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).filter(notice => {
        // Filter out expired notices
        if (!notice.expiryDate) return true;
        const expiryDate = notice.expiryDate.seconds ? 
          new Date(notice.expiryDate.seconds * 1000) : 
          new Date(notice.expiryDate);
        return expiryDate > new Date();
      });
      
      setNotices(noticesData);
    } catch (error) {
      console.error('Error fetching notices:', error);
    } finally {
      setLoading(false);
    }
  }, [userRole, maxNotices]);

  useEffect(() => {
    if (userRole) {
      fetchNotices();
    }
  }, [userRole, fetchNotices]);

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPriorityIcon = (priority) => {
    if (priority === 'high') {
      return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
    return <Bell className="w-4 h-4 text-blue-500" />;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Bell className="w-5 h-5" />
            <span>Notices</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-teal-600 border-t-transparent mx-auto"></div>
            <p className="text-gray-600 mt-2 text-sm">Loading notices...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Bell className="w-5 h-5" />
            <span>Notices</span>
          </div>
          {notices.length > 0 && (
            <Badge variant="secondary">{notices.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {notices.length === 0 ? (
          <div className="text-center py-6">
            <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600 text-sm">No notices available</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notices.map((notice) => (
              <div key={notice.id} className="border rounded-lg p-3 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    {getPriorityIcon(notice.priority)}
                    <h4 className="font-medium text-sm">{notice.title}</h4>
                  </div>
                  <Badge className={getPriorityColor(notice.priority)} variant="outline">
                    {notice.priority}
                  </Badge>
                </div>
                
                <p className="text-gray-600 text-xs mb-3 line-clamp-2">
                  {notice.content}
                </p>
                
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center space-x-1">
                    <User className="w-3 h-3" />
                    <span>{notice.createdByName}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Calendar className="w-3 h-3" />
                    <span>
                      {notice.createdAt?.toDate ? 
                        notice.createdAt.toDate().toLocaleDateString() : 
                        new Date(notice.createdAt).toLocaleDateString()
                      }
                    </span>
                  </div>
                </div>
                
                {notice.expiryDate && (
                  <div className="mt-2 text-xs text-orange-600">
                    Expires: {notice.expiryDate.seconds ? 
                      new Date(notice.expiryDate.seconds * 1000).toLocaleDateString() :
                      new Date(notice.expiryDate).toLocaleDateString()
                    }
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
