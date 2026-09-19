"use client";

import React, { useState } from "react";
import { Plus, Shield, Lock, Trash2, Search, AlertCircle, ShieldAlert } from "lucide-react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";
import { Role } from "../../types/rbac";
import { deleteRole } from "../../lib/api-rbac";
import { useAuth } from "../../context/auth-context";
import { usePermissions } from "../../context/permissions-context";

interface RoleListPanelProps {
  roles: Role[];
  selectedRoleId: string | null;
  onSelectRole: (roleId: string) => void;
  onOpenAddModal: () => void;
  onRoleDeleted: (roleId: string) => void;
}

export function RoleListPanel({
  roles,
  selectedRoleId,
  onSelectRole,
  onOpenAddModal,
  onRoleDeleted,
}: RoleListPanelProps) {
  const { can } = usePermissions();
  const { token } = useAuth();
  const [search, setSearch] = useState("");
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const filteredRoles = roles.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      (r.description && r.description.toLowerCase().includes(search.toLowerCase()))
  );

  const handleDeleteConfirm = async () => {
    if (!roleToDelete) return;

    try {
      setDeleting(true);
      setDeleteError(null);

      await deleteRole(roleToDelete.id, token);
      onRoleDeleted(roleToDelete.id);
      setRoleToDelete(null);
    } catch (err: any) {
      setDeleteError(err.message || "Failed to delete role");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-card rounded-xl border border-border/60 shadow-2xs overflow-hidden">
      {/* Top Header */}
      <div className="p-4 border-b border-border/60 space-y-3 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Shield className="h-4.5 w-4.5 text-teal-700 dark:text-teal-400" />
            <h2 className="text-sm font-bold text-foreground tracking-tight">Roles</h2>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted font-mono font-medium text-muted-foreground">
              {roles.length}
            </span>
          </div>

          {can('roles', 'create') && (
            <Button
              onClick={onOpenAddModal}
              size="sm"
              className="h-8 px-3 text-xs gap-1.5 bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white font-medium shadow-2xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Role</span>
            </Button>
          )}
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search roles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs bg-background"
          />
        </div>
      </div>

      {/* Role Items Scrollable List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {filteredRoles.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            No roles found.
          </div>
        ) : (
          filteredRoles.map((role) => {
            const isSelected = role.id === selectedRoleId;

            return (
              <div
                key={role.id}
                onClick={() => onSelectRole(role.id)}
                className={`group relative flex items-start justify-between gap-2 p-3 rounded-lg border transition-all cursor-pointer ${
                  isSelected
                    ? "bg-teal-700/10 dark:bg-teal-500/15 border-teal-500/40 border-l-4 border-l-teal-700 dark:border-l-teal-400 shadow-2xs"
                    : "bg-background border-border/40 hover:bg-muted/40 text-muted-foreground"
                }`}
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-bold tracking-tight ${
                        isSelected ? "text-teal-950 dark:text-teal-200" : "text-foreground"
                      }`}
                    >
                      {role.name}
                    </span>

                    {role.is_system_role ? (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-slate-500/10 text-slate-600 dark:text-slate-300 font-semibold text-[9px] uppercase tracking-wider shrink-0">
                        <Lock className="h-2.5 w-2.5" />
                        System
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 font-semibold text-[9px] uppercase tracking-wider shrink-0">
                        Custom
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                    {role.description || "No description provided."}
                  </p>
                </div>

                {!role.is_system_role && can('roles', 'delete') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRoleToDelete(role);
                      setDeleteError(null);
                    }}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    title="Delete custom role"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Delete Role Confirmation Dialog */}
      <Dialog
        open={roleToDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRoleToDelete(null);
            setDeleteError(null);
          }
        }}
      >
        <DialogContent className="max-w-md p-6">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 border border-rose-500/20 shrink-0">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  Delete Custom Role
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Are you sure you want to delete role &ldquo;{roleToDelete?.name}&rdquo;?
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {deleteError ? (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs text-rose-600 dark:text-rose-400 flex items-start gap-2 my-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{deleteError}</span>
            </div>
          ) : (
            <p className="py-2 text-xs text-muted-foreground">
              Deleting this role will permanently remove it from your organization. Users assigned to this role will lose permissions.
            </p>
          )}

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setRoleToDelete(null);
                setDeleteError(null);
              }}
              className="text-xs"
              disabled={deleting}
            >
              {deleteError ? "Close" : "Cancel"}
            </Button>
            {!deleteError && (
              <Button
                size="sm"
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="text-xs bg-rose-600 hover:bg-rose-700 text-white font-medium shadow-sm"
              >
                {deleting ? "Deleting..." : "Confirm Delete"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
