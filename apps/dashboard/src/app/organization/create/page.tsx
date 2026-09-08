import React, { Suspense } from "react";
import { OrganizationForm } from "../../../components/organization/OrganizationForm";

export const metadata = {
  title: "Create Organization — vopx",
  description: "Register a new tenant organization and corporate workspace.",
};

export default function CreateOrganizationPage() {
  return (
    <Suspense fallback={<div className="p-8 text-xs text-muted-foreground animate-pulse">Loading organization sign-up form...</div>}>
      <OrganizationForm />
    </Suspense>
  );
}
