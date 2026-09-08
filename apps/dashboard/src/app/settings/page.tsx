import React from "react";
import { Settings } from "lucide-react";

export const metadata = {
  title: "Settings — vopx",
  description: "Configure system preferences, security, and credentials.",
};

export default function SettingsPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 pb-3 border-b border-border/60">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700/10 text-teal-800 dark:bg-teal-500/15 dark:text-teal-300 border border-teal-500/20 shadow-2xs">
          <Settings className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Platform Settings
          </h1>
          <p className="text-xs text-muted-foreground">
            General preferences, telemetry thresholds, and API authentication configurations.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-dashed border-border bg-card/40 p-12 text-center">
        <Settings className="mx-auto h-10 w-10 text-muted-foreground/60 mb-2" />
        <h3 className="text-sm font-semibold text-foreground">System Preferences</h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
          Security controls, audit logs, and credential vaults can be configured here.
        </p>
      </div>
    </div>
  );
}
