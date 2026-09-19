"use client";

import React, { useState, useEffect } from "react";
import { Shield, RefreshCw, AlertCircle, ShieldAlert } from "lucide-react";
import { useAuth } from "../../context/auth-context";
import { fetchPermissions, fetchRoles } from "../../lib/api-rbac";
import { Role, Permission } from "../../types/rbac";
import { RoleListPanel } from "../../components/roles/RoleListPanel";
import { RoleMatrix } from "../../components/roles/RoleMatrix";
import { AddRoleModal } from "../../components/roles/AddRoleModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { RouteGuard } from "../../components/shell/RouteGuard";

export default function RolesPage() {
  const { token } = useAuth();

  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Unsaved changes protection state
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [targetRoleIdToSwitch, setTargetRoleIdToSwitch] = useState<string | null>(null);

  // Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const loadRbacData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [permsData, rolesData] = await Promise.all([
        fetchPermissions(token),
        fetchRoles(token),
      ]);

      setPermissions(permsData);
      setRoles(rolesData);

      // Default select first role if none selected
      if (rolesData.length > 0 && !selectedRoleId) {
        setSelectedRoleId(rolesData[0].id);
      }
    } catch (err: any) {
      console.error("Failed loading RBAC data:", err);
      setError(err.message || "Failed to load roles and permissions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRbacData();
  }, [token]);

  const selectedRole = roles.find((r) => r.id === selectedRoleId) || null;

  const handleSelectRoleRequest = (roleId: string) => {
    if (roleId === selectedRoleId) return;

    if (hasPendingChanges) {
      setTargetRoleIdToSwitch(roleId);
    } else {
      setSelectedRoleId(roleId);
    }
  };

  const handleConfirmDiscardChanges = () => {
    if (targetRoleIdToSwitch) {
      setSelectedRoleId(targetRoleIdToSwitch);
      setTargetRoleIdToSwitch(null);
      setHasPendingChanges(false);
    }
  };

  const handleRoleCreated = (newRole: Role) => {
    setRoles((prev) => [newRole, ...prev]);
    setSelectedRoleId(newRole.id);
  };

  const handleRoleDeleted = (roleId: string) => {
    setRoles((prev) => {
      const updated = prev.filter((r) => r.id !== roleId);
      if (selectedRoleId === roleId) {
        setSelectedRoleId(updated.length > 0 ? updated[0].id : null);
      }
      return updated;
    });
  };

  const handleRolePermissionsPersisted = (updatedRole: Role) => {
    setRoles((prev) =>
      prev.map((r) => (r.id === updatedRole.id ? updatedRole : r))
    );
    setHasPendingChanges(false);
  };

  return (
    <RouteGuard module="roles">
      <div className="flex flex-col h-[calc(100vh-5rem)] space-y-4 pb-4 overflow-hidden">
        {/* Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700/10 text-teal-800 dark:bg-teal-500/15 dark:text-teal-300 border border-teal-500/20 shadow-2xs">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                Roles & Permissions
              </h1>
              <p className="text-xs text-muted-foreground">
                Define dynamic roles and fine-grained permission matrices across all system modules.
              </p>
            </div>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-600 dark:text-rose-400 flex items-start gap-2.5 shrink-0">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold">Error:</span> {error}
            </div>
          </div>
        )}

        {/* Two-Panel Layout Container */}
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16 text-xs text-muted-foreground space-y-2">
            <RefreshCw className="h-6 w-6 animate-spin text-teal-600" />
            <p>Loading role permission matrix...</p>
          </div>
        ) : (
          <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 min-h-0 overflow-hidden">
            {/* Left Panel: Role List (4 cols) */}
            <div className="md:col-span-4 h-full min-h-0">
              <RoleListPanel
                roles={roles}
                selectedRoleId={selectedRoleId}
                onSelectRole={handleSelectRoleRequest}
                onOpenAddModal={() => setIsAddModalOpen(true)}
                onRoleDeleted={handleRoleDeleted}
              />
            </div>

            {/* Right Panel: Permission Matrix (8 cols) */}
            <div className="md:col-span-8 h-full min-h-0">
              <RoleMatrix
                role={selectedRole}
                permissions={permissions}
                onRolePermissionsPersisted={handleRolePermissionsPersisted}
                onPendingChangesChange={setHasPendingChanges}
              />
            </div>
          </div>
        )}

        {/* Modal to Create New Custom Role */}
        <AddRoleModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onRoleCreated={handleRoleCreated}
        />

        {/* Unsaved Changes Confirmation Dialog */}
        <Dialog
          open={targetRoleIdToSwitch !== null}
          onOpenChange={(open) => !open && setTargetRoleIdToSwitch(null)}
        >
          <DialogContent className="max-w-md p-6">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-500/20 shrink-0">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-foreground">
                    Unsaved Changes
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    You have unsaved changes in the permission matrix for &ldquo;{selectedRole?.name}&rdquo;.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <p className="py-2 text-xs text-muted-foreground">
              Switching to another role will discard your current unsaved modifications. Are you sure you want to discard changes?
            </p>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTargetRoleIdToSwitch(null)}
                className="text-xs"
              >
                Keep Editing
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmDiscardChanges}
                className="text-xs bg-amber-600 hover:bg-amber-700 text-white font-medium shadow-sm"
              >
                Discard & Switch
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </RouteGuard>
  );
}
