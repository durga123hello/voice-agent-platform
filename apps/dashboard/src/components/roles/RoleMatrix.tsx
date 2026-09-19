"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Save, Lock, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Role, Permission } from "../../types/rbac";
import { setRolePermissions } from "../../lib/api-rbac";
import { useAuth } from "../../context/auth-context";
import { usePermissions } from "../../context/permissions-context";

interface RoleMatrixProps {
  role: Role | null;
  permissions: Permission[];
  onRolePermissionsPersisted: (updatedRole: Role) => void;
  onPendingChangesChange?: (hasPendingChanges: boolean) => void;
}

const MODULE_DISPLAY_CONFIG: Record<string, { title: string; description: string }> = {
  users: {
    title: "Users Management",
    description: "Manage organization user accounts and profiles",
  },
  organization: {
    title: "Organization & Billing",
    description: "Organization profile, subscription plans, and billing data",
  },
  projects: {
    title: "Projects & Workspaces",
    description: "Voice agent projects, versioning, and environment configs",
  },
  sessions: {
    title: "Call Sessions & Transcripts",
    description: "WebRTC audio calls, transcripts, recordings, and event logs",
  },
  analytics: {
    title: "Voice Analytics & Metrics",
    description: "Call performance metrics, latency benchmarks, and export data",
  },
  teams: {
    title: "Teams & Member Directory",
    description: "Manage team directory, member roles, and project assignments",
  },
  testing: {
    title: "Testing Workspace",
    description: "Embedded test arena and real-time simulator iframe",
  },
  integrations: {
    title: "Voice & AI Integrations",
    description: "STT agents, TTS providers, LLM models, and telephony routes",
  },
  roles: {
    title: "Roles & Permissions",
    description: "Define dynamic roles and fine-grained permission matrices",
  },
  settings: {
    title: "System Settings",
    description: "Global system configuration, API keys, and workspace preferences",
  },
};

const ACTIONS_LIST = ["view", "create", "edit", "delete"] as const;

export function RoleMatrix({
  role,
  permissions,
  onRolePermissionsPersisted,
  onPendingChangesChange,
}: RoleMatrixProps) {
  const { token } = useAuth();

  // Local state for checked permission IDs
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [initialIds, setInitialIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Sync state whenever selected role changes
  useEffect(() => {
    if (role && role.permissions) {
      const activeIds = new Set(role.permissions.map((p) => p.id));
      setCheckedIds(activeIds);
      setInitialIds(activeIds);
      setSaveSuccess(null);
      setSaveError(null);
    } else {
      setCheckedIds(new Set());
      setInitialIds(new Set());
      setSaveSuccess(null);
      setSaveError(null);
    }
  }, [role?.id]);

  const { can } = usePermissions();
  const isReadOnly = role ? (role.is_system_role && role.name.toLowerCase() === 'admin') || !can('roles', 'edit') : true;

  // Determine if there are pending unsaved changes
  const hasChanges = useMemo(() => {
    if (!role || isReadOnly) return false;
    if (checkedIds.size !== initialIds.size) return true;
    for (const id of Array.from(checkedIds)) {
      if (!initialIds.has(id)) return true;
    }
    return false;
  }, [checkedIds, initialIds, role, isReadOnly]);

  useEffect(() => {
    if (onPendingChangesChange) {
      onPendingChangesChange(hasChanges);
    }
  }, [hasChanges, onPendingChangesChange]);

  // Map permissions by (module, action) key
  const permMatrixMap = useMemo(() => {
    const map: Record<string, Permission> = {};
    for (const p of permissions) {
      const key = `${p.module.toLowerCase()}:${p.action.toLowerCase()}`;
      map[key] = p;
    }
    return map;
  }, [permissions]);

  // Unique ordered list of modules
  const moduleList = useMemo(() => {
    const standardModules = [
      "users",
      "organization",
      "projects",
      "sessions",
      "analytics",
      "teams",
      "testing",
      "integrations",
      "roles",
      "settings",
    ];

    const extraModules = Array.from(
      new Set(permissions.map((p) => p.module.toLowerCase()))
    ).filter((m) => !standardModules.includes(m));

    return [...standardModules, ...extraModules];
  }, [permissions]);

  const handleToggleCell = (permId: string) => {
    if (!role || isReadOnly) return;

    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(permId)) {
        next.delete(permId);
      } else {
        next.add(permId);
      }
      return next;
    });
    setSaveSuccess(null);
    setSaveError(null);
  };

  const handlePersistChanges = async () => {
    if (!role || isReadOnly || !hasChanges) return;

    try {
      setSaving(true);
      setSaveError(null);
      setSaveSuccess(null);

      const targetPermissionIds = Array.from(checkedIds);
      const updatedRole = await setRolePermissions(role.id, targetPermissionIds, token);

      const newSet = new Set(updatedRole.permissions.map((p) => p.id));
      setCheckedIds(newSet);
      setInitialIds(newSet);
      setSaveSuccess(`Permissions for role "${role.name}" updated successfully!`);

      onRolePermissionsPersisted(updatedRole);
    } catch (err: any) {
      setSaveError(err.message || "Failed to persist role permissions");
    } finally {
      setSaving(false);
    }
  };

  if (!role) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-card rounded-xl border border-border/60 shadow-2xs text-muted-foreground text-xs">
        <Lock className="h-8 w-8 text-muted-foreground/50 mb-2" />
        <p>Select a role from the left panel to configure its permission matrix.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-card rounded-xl border border-border/60 shadow-2xs overflow-hidden">
      {/* Matrix Panel Header */}
      <div className="p-5 border-b border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 bg-muted/20">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-foreground tracking-tight">
              {role.name}
            </h2>
            {role.is_system_role && role.name.toLowerCase() === 'admin' ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-500/10 text-slate-600 dark:text-slate-300 font-semibold text-[10px] uppercase tracking-wider">
                <Lock className="h-3 w-3" />
                System Admin (Protected)
              </span>
            ) : role.is_system_role ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-teal-500/15 text-teal-800 dark:text-teal-300 font-semibold text-[10px] uppercase tracking-wider">
                System Role (Editable)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 font-semibold text-[10px] uppercase tracking-wider">
                Custom Role (Editable)
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Define what <strong>{role.name}</strong> can view, create, edit, and delete across each module.
          </p>
        </div>

        {/* Persist Changes Button */}
        {!isReadOnly && (
          <Button
            onClick={handlePersistChanges}
            disabled={!hasChanges || saving}
            className="h-9 px-4 text-xs font-semibold gap-2 bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white shadow-sm shrink-0 disabled:opacity-50"
          >
            {saving ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            <span>{saving ? "Saving..." : "Persist Changes"}</span>
          </Button>
        )}
      </div>

      {/* Notifications */}
      {saveSuccess && (
        <div className="mx-4 mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2 shrink-0">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {saveError && (
        <div className="mx-4 mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2 shrink-0">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{saveError}</span>
        </div>
      )}

      {/* Matrix Table View */}
      <div className="flex-1 overflow-auto p-4">
        <div className="border border-border/60 rounded-xl overflow-hidden shadow-2xs bg-background">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border/60 bg-muted/40 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4 w-2/5">Module Resource</th>
                {ACTIONS_LIST.map((action) => (
                  <th key={action} className="py-3.5 px-4 text-center capitalize w-1/5">
                    {action}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 text-xs">
              {moduleList.map((moduleKey) => {
                const config = MODULE_DISPLAY_CONFIG[moduleKey] || {
                  title: moduleKey.charAt(0).toUpperCase() + moduleKey.slice(1),
                  description: `Custom ${moduleKey} module permissions`,
                };

                return (
                  <tr key={moduleKey} className="hover:bg-muted/20 transition-colors">
                    {/* Module Title & Description */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-0.5">
                        <div className="font-bold text-foreground text-xs">{config.title}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {config.description}
                        </div>
                      </div>
                    </td>

                    {/* Matrix Cells (View, Create, Edit, Delete) */}
                    {ACTIONS_LIST.map((action) => {
                      const cellKey = `${moduleKey}:${action}`;
                      const perm = permMatrixMap[cellKey];

                      return (
                        <td key={action} className="py-3.5 px-4 text-center align-middle">
                          {perm ? (
                            <div className="flex items-center justify-center">
                              <Checkbox
                                checked={checkedIds.has(perm.id)}
                                onCheckedChange={() => handleToggleCell(perm.id)}
                                disabled={isReadOnly}
                                className="h-4.5 w-4.5"
                                title={
                                  isReadOnly
                                    ? "System roles permissions are read-only"
                                    : `${perm.label} (${perm.key})`
                                }
                              />
                            </div>
                          ) : (
                            <span className="text-muted-foreground/40 font-mono font-bold text-sm">
                              —
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
