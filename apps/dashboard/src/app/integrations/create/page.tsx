import React, { Suspense } from "react";
import { IntegrationForm } from "../../../components/integrations/IntegrationForm";
import { RouteGuard } from "../../../components/shell/RouteGuard";

export const metadata = {
  title: "Add Integration — vopx",
  description: "Configure STT agents, TTS agents, and LLM generation provider credentials.",
};

export default function CreateIntegrationPage() {
  return (
    <RouteGuard module="integrations" action="create">
      <Suspense fallback={<div className="p-8 text-center text-xs text-muted-foreground">Loading form...</div>}>
        <IntegrationForm />
      </Suspense>
    </RouteGuard>
  );
}
