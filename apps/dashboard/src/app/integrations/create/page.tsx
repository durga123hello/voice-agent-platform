import React, { Suspense } from "react";
import { IntegrationForm } from "../../../components/integrations/IntegrationForm";

export const metadata = {
  title: "Add Integration — vopx",
  description: "Configure STT agents, TTS agents, and LLM generation provider credentials.",
};

export default function CreateIntegrationPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-muted-foreground">Loading form...</div>}>
      <IntegrationForm />
    </Suspense>
  );
}
