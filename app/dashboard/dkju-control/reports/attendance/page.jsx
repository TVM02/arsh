"use client";

import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import AttendanceReport from "@/components/AttendanceReport";

export default function CentralAdminAttendanceReport() {
  return (
    <ProtectedRoute requiredRole="central_admin">
      <Layout>
        <AttendanceReport userRole="central_admin" requiredRoleTitle="All Madarsas Attendance Report" />
      </Layout>
    </ProtectedRoute>
  );
}
