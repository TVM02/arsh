"use client";

import Layout from "@/components/Layout";
import UnpublishedResultsContent from "@/components/exam/UnpublishedResultsContent";

export default function ConvenerUnpublishedResultsPage() {
  return (
    <Layout>
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <UnpublishedResultsContent />
      </div>
    </Layout>
  );
}
