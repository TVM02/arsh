"use client";

import Layout from "@/components/Layout";
import UnpublishedResultsContent from "@/components/exam/UnpublishedResultsContent";

export default function UnpublishedResultsPage() {
  return (
    <Layout>
      <div className="p-4 sm:p-6">
        <UnpublishedResultsContent />
      </div>
    </Layout>
  );
}
