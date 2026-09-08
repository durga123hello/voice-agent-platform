import React, { Suspense } from "react";
import { UserForm } from "../../../components/users/UserForm";

export const metadata = {
  title: "User Profile — vopx",
  description: "Provision or update a user account with personal details and system roles.",
};

export default function CreateUserPage() {
  return (
    <Suspense fallback={<div className="p-8 text-xs text-muted-foreground animate-pulse">Loading employee profile...</div>}>
      <UserForm />
    </Suspense>
  );
}
