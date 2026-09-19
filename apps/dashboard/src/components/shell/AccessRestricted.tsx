"use client";

import React from "react";
import Link from "next/link";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { Button } from "../ui/button";
import { usePermissions } from "../../context/permissions-context";

export function AccessRestricted({ moduleName }: { moduleName?: string }) {
  const { can } = usePermissions();

  const moduleRoutes = [
    { module: "users", href: "/users" },
    { module: "roles", href: "/roles" },
    { module: "organization", href: "/organization" },
    { module: "projects", href: "/projects" },
    { module: "integrations", href: "/integrations/stt" },
    { module: "settings", href: "/settings" },
  ];

  const firstAllowedRoute = moduleRoutes.find((r) => can(r.module, "view"))?.href || "/";

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in-95">
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 shadow-xl backdrop-blur">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
          <ShieldAlert className="h-7 w-7 text-amber-500" />
        </div>

        <h2 className="text-xl font-bold tracking-tight text-foreground">
          Access Restricted
        </h2>

        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          You don't have permission to view {moduleName ? `the ${moduleName} module` : "this page"}. Contact your organization admin if you believe this is a mistake.
        </p>

        <div className="mt-6 flex justify-center">
          <Button asChild size="sm" className="gap-2 text-xs bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white font-medium">
            <Link href={firstAllowedRoute}>
              <ArrowLeft className="h-3.5 w-3.5" />
              Return to Authorized Page
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
