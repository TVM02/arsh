"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function StateDashboard() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/state/competition");
  }, [router]);

  return null;
}
