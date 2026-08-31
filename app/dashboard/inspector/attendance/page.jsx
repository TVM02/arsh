"use client";

import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import AttendanceReport from "@/components/AttendanceReport";

export default function InspectorAttendanceReport() {
  return (
    <ProtectedRoute requiredRole="inspector">
      <Layout>
        <AttendanceReport userRole="inspector" requiredRoleTitle="Inspector Attendance Report" />
      </Layout>
    </ProtectedRoute>
  );
}
