"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export interface User {
  id?: string;
  tenantId?: string;
  token?: string;
  email: string;
  name: string;
  initials: string;
  orgName?: string;
  role?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  tenantId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  sendOtp: (email: string) => Promise<boolean>;
  verifyOtp: (code: string) => Promise<boolean>;
  signupUser: (fullName: string, email: string, orgName: string, password?: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = "vopx_auth_session";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    try {
      const savedSession = localStorage.getItem(AUTH_STORAGE_KEY);
      if (savedSession) {
        const parsedUser = JSON.parse(savedSession);
        if (parsedUser && parsedUser.email) {
          setUser(parsedUser);
          if (parsedUser.token) setToken(parsedUser.token);
          if (parsedUser.tenantId) setTenantId(parsedUser.tenantId);
        }
      }
    } catch (e) {
      console.error("Failed to restore auth session:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const sendOtp = async (email: string): Promise<boolean> => {
    setPendingEmail(email);
    // Simulate OTP trigger delay
    await new Promise((resolve) => setTimeout(resolve, 600));
    return true;
  };

  const verifyOtp = async (code: string): Promise<boolean> => {
    const targetEmail = (pendingEmail || "user@vopx.ai").trim().toLowerCase();

    try {
      // Connect to backend auth to create/find org & user in Postgres and issue JWT
      const res = await fetch(`${API_BASE}/api/auth/dashboard-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail }),
      });

      if (res.ok) {
        const data = await res.json();
        const serverUser = data.user || {};
        const serverTenant = data.tenant || {};
        const jwtToken = data.token || "";

        const namePart = (serverUser.firstName ? `${serverUser.firstName} ${serverUser.lastName || ""}` : targetEmail.split("@")[0]).trim();
        const formattedName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
        const initials = formattedName.slice(0, 2).toUpperCase();

        const userSession: User = {
          id: serverUser.id,
          tenantId: serverTenant.id || serverUser.tenantId,
          token: jwtToken,
          email: targetEmail,
          name: formattedName,
          initials: initials || "VX",
          orgName: serverTenant.name,
          role: serverUser.role || "owner",
        };

        setUser(userSession);
        setToken(jwtToken);
        setTenantId(userSession.tenantId || null);

        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userSession));
        return true;
      }
    } catch (err) {
      console.warn("Backend auth offline, falling back to local session:", err);
    }

    // Fallback if backend server unreachable
    if (code.length === 6 && /^\d+$/.test(code)) {
      const namePart = targetEmail.split("@")[0] || "User";
      const formattedName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
      const initials = namePart.slice(0, 2).toUpperCase();

      const userSession: User = {
        email: targetEmail,
        name: formattedName,
        initials: initials || "VX",
      };

      setUser(userSession);
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userSession));
      return true;
    }
    return false;
  };

  const signupUser = async (fullName: string, email: string, orgName: string): Promise<boolean> => {
    const targetEmail = email.trim().toLowerCase();

    try {
      const res = await fetch(`${API_BASE}/api/auth/dashboard-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: targetEmail,
          fullName: fullName.trim(),
          orgName: orgName.trim(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const serverUser = data.user || {};
        const serverTenant = data.tenant || {};
        const jwtToken = data.token || "";

        const initials = fullName
          .trim()
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2);

        const userSession: User = {
          id: serverUser.id,
          tenantId: serverTenant.id || serverUser.tenantId,
          token: jwtToken,
          email: targetEmail,
          name: fullName.trim(),
          initials: initials || "VX",
          orgName: orgName.trim(),
          role: serverUser.role || "owner",
        };

        setUser(userSession);
        setToken(jwtToken);
        setTenantId(userSession.tenantId || null);

        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userSession));
        return true;
      }
    } catch (err) {
      console.warn("Backend auth offline, falling back to local session:", err);
    }

    const nameParts = fullName.trim().split(" ");
    const initials = nameParts.length > 1 
      ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
      : fullName.slice(0, 2).toUpperCase();

    const userSession: User = {
      email: targetEmail,
      name: fullName,
      initials: initials || "VX",
      orgName: orgName,
    };

    setUser(userSession);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userSession));
    return true;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setTenantId(null);
    setPendingEmail("");
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch (e) {
      console.error("Failed to clear auth session:", e);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        tenantId,
        isAuthenticated: !!user,
        isLoading,
        sendOtp,
        verifyOtp,
        signupUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
