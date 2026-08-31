"use client";

import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import AttendanceReport from "@/components/AttendanceReport";

export default function MadarsaAttendanceReport() {
  return (
    <ProtectedRoute requiredRole="madarsa_admin">
      <Layout>
        <AttendanceReport userRole="madarsa_admin" requiredRoleTitle="Madarsa Attendance Report" />
      </Layout>
    </ProtectedRoute>
  );
}
