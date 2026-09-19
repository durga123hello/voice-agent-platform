"use client";

import React from "react";
import { usePermissions } from "../../context/permissions-context";
import { AccessRestricted } from "./AccessRestricted";

interface RouteGuardProps {
  module: string;
  action?: string;
  children: React.ReactNode;
}

export function RouteGuard({ module, action = "view", children }: RouteGuardProps) {
  const { can, isLoading } = usePermissions();

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-xs text-muted-foreground animate-pulse">
        Checking permissions...
      </div>
    );
  }

  if (!can(module, action)) {
    return <AccessRestricted moduleName={module} />;
  }

  return <>{children}</>;
}
