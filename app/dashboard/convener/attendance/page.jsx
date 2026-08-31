"use client";

import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import AttendanceReport from "@/components/AttendanceReport";

export default function ConvenerAttendanceReport() {
  return (
    <ProtectedRoute requiredRole="pariksha_board_convener">
      <Layout>
        <AttendanceReport userRole="pariksha_board_convener" requiredRoleTitle="Exam Board Attendance Report" />
      </Layout>
    </ProtectedRoute>
  );
}
