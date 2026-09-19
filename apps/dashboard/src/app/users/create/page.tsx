import React, { Suspense } from "react";
import { UserForm } from "../../../components/users/UserForm";
import { RouteGuard } from "../../../components/shell/RouteGuard";

export const metadata = {
  title: "User Profile — vopx",
  description: "Provision or update a user account with personal details and system roles.",
};

export default function CreateUserPage() {
  return (
    <RouteGuard module="users" action="create">
      <Suspense fallback={<div className="p-8 text-xs text-muted-foreground animate-pulse">Loading employee profile...</div>}>
        <UserForm />
      </Suspense>
    </RouteGuard>
  );
}
