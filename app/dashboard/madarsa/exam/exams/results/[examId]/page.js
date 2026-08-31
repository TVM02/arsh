"use client";

import { use } from "react";
import ResultViewPageContent from "@/components/exam/ResultViewPageContent";
import Layout from "@/components/Layout";
import useAuthStore from "@/lib/authStore";

export default function MadarsaExamResultPage({ params }) {
  const { examId } = use(params);
  const { user, role } = useAuthStore();

  return (
    <Layout user={user} role={role}>
      <ResultViewPageContent examId={examId} readOnly={true} />
    </Layout>
  );
}
