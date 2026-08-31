"use client";

import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import AttendanceReport from "@/components/AttendanceReport";

export default function MekhalaAttendanceReport() {
  return (
    <ProtectedRoute requiredRole="mekhala_admin">
      <Layout>
        <AttendanceReport userRole="mekhala_admin" requiredRoleTitle="Mekhala Attendance Report" />
      </Layout>
    </ProtectedRoute>
  );
}
