"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./auth-context";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export interface UserPermission {
  id?: string;
  module: string;
  action: string;
  key: string;
  label?: string;
}

interface PermissionsContextType {
  role: string | null;
  isAdmin: boolean;
  permissions: UserPermission[];
  permissionKeys: string[];
  isLoading: boolean;
  can: (module: string, action: string) => boolean;
  refetchPermissions: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuth();

  const [role, setRole] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [permissions, setPermissions] = useState<UserPermission[]>([]);
  const [permissionKeys, setPermissionKeys] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchUserPermissions = useCallback(async () => {
    if (!token) {
      setIsLoading(false);
      setPermissions([]);
      setPermissionKeys([]);
      setIsAdmin(false);
      return;
    }

    try {
      setIsLoading(true);
      const res = await fetch(`${API_BASE}/api/auth/me/permissions`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setRole(data.role || user?.role || null);
        setIsAdmin(Boolean(data.isAdmin));
        setPermissions(data.permissions || []);
        setPermissionKeys(data.permissionKeys || []);
      } else {
        // Fallback for admin role
        const userRole = (user?.role || "owner").toLowerCase();
        if (
          userRole === "admin" ||
          userRole === "owner" ||
          userRole === "administrator" ||
          userRole === "developer"
        ) {
          setIsAdmin(true);
        }
      }
    } catch (err) {
      console.error("Failed fetching user permissions:", err);
    } finally {
      setIsLoading(false);
    }
  }, [token, user]);

  useEffect(() => {
    fetchUserPermissions();
  }, [fetchUserPermissions]);

  const can = useCallback(
    (module: string, action: string): boolean => {
      // Default Admin / Owner bypass
      const userRole = (role || user?.role || "").toLowerCase();
      if (
        isAdmin ||
        userRole === "admin" ||
        userRole === "owner" ||
        userRole === "administrator" ||
        userRole === "developer"
      ) {
        return true;
      }

      const cleanMod = module.toLowerCase().trim();
      const cleanAct = action.toLowerCase().trim();
      const key = `${cleanMod}:${cleanAct}`;

      // Match exact key or module/action pair
      if (permissionKeys.includes(key)) return true;

      return permissions.some(
        (p) =>
          p.module.toLowerCase() === cleanMod &&
          p.action.toLowerCase() === cleanAct
      );
    },
    [isAdmin, role, user, permissionKeys, permissions]
  );

  return (
    <PermissionsContext.Provider
      value={{
        role,
        isAdmin,
        permissions,
        permissionKeys,
        isLoading,
        can,
        refetchPermissions: fetchUserPermissions,
      }}
    >
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (!context) {
    throw new Error("usePermissions must be used within a PermissionsProvider");
  }
  return context;
}
