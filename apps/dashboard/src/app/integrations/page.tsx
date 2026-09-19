"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function IntegrationsOverviewPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/integrations/stt");
  }, [router]);

  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-700"></div>
    </div>
  );
}
