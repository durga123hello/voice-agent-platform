"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

export default function DashboardWrapper({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  
  const [token, setToken] = useState<string | null>(null);
  const [orgName, setOrgName] = useState("");
  const [loading, setLoading] = useState(true);

  const isAuthPage = pathname === "/login" || pathname === "/signup";

  useEffect(() => {
    if (isAuthPage) {
      setLoading(false);
      return;
    }

    const savedToken = localStorage.getItem("sessionToken");
    const savedOrgName = localStorage.getItem("orgName") || "Organization";

    if (!savedToken) {
      router.push("/login");
    } else {
      setToken(savedToken);
      setOrgName(savedOrgName);
      setLoading(false);
    }
  }, [pathname]);

  const handleLogout = () => {
    localStorage.removeItem("sessionToken");
    localStorage.removeItem("orgName");
    localStorage.removeItem("tenantId");
    router.push("/login");
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", backgroundColor: "#0d0f12", color: "#ffffff" }}>
        <div style={{ textAlign: "center" }}>
          <h2 style={{ fontWeight: "800", marginBottom: "8px", background: "linear-gradient(90deg, #58a6ff, #56d364)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Voice AI Platform
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>Loading secure session console...</p>
        </div>
      </div>
    );
  }

  if (isAuthPage) {
    return <>{children}</>;
  }

  // Active navigation styling helper
  const linkStyle = (path: string) => {
    const isActive = pathname === path || (path !== "/" && pathname.startsWith(path));
    return {
      textDecoration: "none",
      color: isActive ? "#58a6ff" : "var(--text-color)",
      fontWeight: isActive ? "700" : "600",
      fontSize: "14px",
      padding: "8px 12px",
      borderRadius: "6px",
      backgroundColor: isActive ? "rgba(88, 166, 255, 0.1)" : "transparent",
      transition: "all 0.2s ease"
    };
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", backgroundColor: "#0d0f12" }}>
      
      {/* Top Navbar */}
      <nav style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 24px",
        backgroundColor: "#161a22",
        borderBottom: "1px solid var(--border-color)",
        position: "sticky",
        top: 0,
        zIndex: 1000,
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)"
      }}>
        
        {/* Left Side: Org Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            background: "linear-gradient(135deg, #2f81f7, #56d364)",
            width: "32px",
            height: "32px",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: "bold",
            color: "#ffffff"
          }}>
            V
          </div>
          <div>
            <span style={{ fontSize: "14px", fontWeight: "bold", color: "#ffffff", display: "block" }}>
              {orgName}
            </span>
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Developer Console</span>
          </div>
        </div>

        {/* Center: Navigation Links */}
        <div style={{ display: "flex", gap: "4px" }}>
          <Link href="/" style={linkStyle("/")}>Setup Portal</Link>
          <Link href="/test-voice" style={linkStyle("/test-voice")}>WebRTC Test</Link>
          <Link href="/test-telephony" style={linkStyle("/test-telephony")}>Telephony Test</Link>
          <Link href="/sessions" style={linkStyle("/sessions")}>Sessions</Link>
          <Link href="/analytics" style={linkStyle("/analytics")}>Analytics</Link>
          <Link href="/api-keys" style={linkStyle("/api-keys")}>API Keys</Link>
        </div>

        {/* Right Side: Logout Button */}
        <div>
          <button
            onClick={handleLogout}
            className="btn"
            style={{
              padding: "6px 12px",
              fontSize: "13px",
              backgroundColor: "rgba(248, 81, 73, 0.15)",
              color: "#ff7b72",
              border: "1px solid rgba(248, 81, 73, 0.3)",
              borderRadius: "6px"
            }}
          >
            Logout
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <div style={{ flex: 1, padding: "20px" }}>
        {children}
      </div>

    </div>
  );
}
