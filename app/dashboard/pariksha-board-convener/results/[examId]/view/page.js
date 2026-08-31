"use client";

import { useParams, useRouter } from "next/navigation";
import Layout from "@/components/Layout";
import { ArrowLeft } from "lucide-react";
import ResultViewPageContent from "@/components/exam/ResultViewPageContent";

export default function ViewResultsPage() {
  const params = useParams();
  const router = useRouter();
  const examId = params.examId;

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto space-y-6 pb-24">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <button
            onClick={() =>
              router.push("/dashboard/pariksha-board-convener/results")
            }
            className="hover:text-teal-600 transition-colors flex items-center gap-1"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to Results
          </button>
          <span className="text-gray-300">|</span>
          <span className="font-semibold text-gray-900 border-b-2 border-teal-600 pb-0.5">
            View & Manage Results
          </span>
        </div>

        <ResultViewPageContent
          examId={examId}
          uploadPath={`/dashboard/pariksha-board-convener/results/${examId}`}
        />
      </div>
    </Layout>
  );
}
