import React, { Suspense } from "react";
import { ProjectForm } from "../../../components/projects/ProjectForm";

export const metadata = {
  title: "Create Project — vopx",
  description: "Provision a new voice project workspace with STT, TTS, and conversational agents.",
};

export default function CreateProjectPage() {
  return (
    <Suspense fallback={<div className="p-8 text-xs text-muted-foreground animate-pulse">Loading project configuration form...</div>}>
      <ProjectForm />
    </Suspense>
  );
}
