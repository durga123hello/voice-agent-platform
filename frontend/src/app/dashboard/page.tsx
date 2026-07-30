"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface ApiKeyData {
  id: string;
  tenantId: string;
  keyPrefix: string;
  name: string | null;
  isActive: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

export default function DashboardPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");
  const [tenantId, setTenantId] = useState("");
  
  const [keys, setKeys] = useState<ApiKeyData[]>([]);
  const [keyLabel, setKeyLabel] = useState("");
  const [newRawKey, setNewRawKey] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const savedToken = localStorage.getItem("sessionToken");
    if (!savedToken) {
      router.push("/login");
      return;
    }
    setToken(savedToken);
    loadData(savedToken);
  }, []);

  const loadData = async (jwtToken: string) => {
    setLoading(true);
    setError("");
    try {
      // 1. Fetch profile info
      const meRes = await fetch("http://localhost:3000/api/auth/me", {
        headers: { Authorization: `Bearer ${jwtToken}` }
      });
      if (!meRes.ok) {
        if (meRes.status === 401) {
          handleLogout();
          return;
        }
        throw new Error("Failed to fetch organization profile");
      }
      const meData = await meRes.json();
      setOrgName(meData.tenant.name);
      setEmail(meData.tenant.contactEmail || "");
      setTenantId(meData.tenant.id);

      // 2. Fetch API keys
      const keysRes = await fetch("http://localhost:3000/api/api-keys", {
        headers: { Authorization: `Bearer ${jwtToken}` }
      });
      if (!keysRes.ok) {
        throw new Error("Failed to fetch API keys");
      }
      const keysData = await keysRes.json();
      setKeys(keysData.keys || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setError("");
    setSubmitting(true);
    setNewRawKey(null);

    try {
      const res = await fetch("http://localhost:3000/api/api-keys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: keyLabel })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create API key");
      }

      setNewRawKey(data.rawKey);
      setKeyLabel("");
      
      // Refresh keys list
      loadData(token);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    if (!token) return;
    if (!confirm("Are you sure you want to revoke this API key? This cannot be undone.")) return;
    setError("");

    try {
      const res = await fetch("http://localhost:3000/api/api-keys/revoke", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ keyId })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to revoke API key");
      }

      // Refresh keys list
      loadData(token);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("sessionToken");
    localStorage.removeItem("orgName");
    localStorage.removeItem("tenantId");
    router.push("/login");
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <h3>Loading console dashboard...</h3>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: "960px", padding: "0 20px" }}>
      
      {/* Header bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 0", borderBottom: "1px solid var(--border-color)", marginBottom: "30px" }}>
        <div>
          <h1 style={{ border: "none", padding: 0, margin: 0, fontSize: "24px", fontWeight: "800" }}>
            Developer Portal
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "14px", margin: "4px 0 0 0" }}>
            Manage programmatic API credentials for your voice platform integrations.
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="btn"
          style={{ backgroundColor: "rgba(248, 81, 73, 0.15)", color: "#ff7b72", border: "1px solid rgba(248, 81, 73, 0.4)", fontSize: "13px" }}
        >
          Logout
        </button>
      </div>

      {error && (
        <div style={{ backgroundColor: "rgba(248, 81, 73, 0.15)", border: "1px solid rgba(248, 81, 73, 0.4)", color: "#ff7b72", padding: "12px 16px", borderRadius: "6px", fontSize: "14px", marginBottom: "24px" }}>
          ⚠️ {error}
        </div>
      )}

      {/* Organization info panel */}
      <div className="card">
        <h3 style={{ margin: "0 0 16px 0", color: "#58a6ff" }}>Organization Information</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", fontSize: "14px" }}>
          <div>
            <span style={{ color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Organization Name</span>
            <strong>{orgName}</strong>
          </div>
          <div>
            <span style={{ color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Contact Email</span>
            <strong>{email}</strong>
          </div>
          <div>
            <span style={{ color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Tenant ID</span>
            <code style={{ fontSize: "12px", color: "#56d364" }}>{tenantId}</code>
          </div>
        </div>
      </div>

      {/* API Key generation block */}
      <div className="card">
        <h3 style={{ margin: "0 0 8px 0", color: "#58a6ff" }}>Generate API Key</h3>
        <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "20px" }}>
          API keys are used by external applications to create configurations and stream agent sessions programmatically.
        </p>

        {newRawKey && (
          <div style={{ backgroundColor: "rgba(35, 134, 54, 0.15)", border: "1px solid rgba(35, 134, 54, 0.4)", color: "#56d364", padding: "16px", borderRadius: "6px", marginBottom: "24px" }}>
            <strong style={{ display: "block", marginBottom: "8px" }}>🔑 API Key Generated Successfully!</strong>
            <p style={{ fontSize: "13px", color: "var(--text-color)", margin: "0 0 12px 0" }}>
              Copy this secret key now. For security purposes, it will <strong>never be shown again</strong>.
            </p>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="text"
                readOnly
                value={newRawKey}
                style={{ fontFamily: "monospace", fontSize: "14px", backgroundColor: "#0d0f12", border: "1px solid var(--border-color)", padding: "8px 12px", flex: 1 }}
                onClick={(e) => (e.target as any).select()}
              />
              <button
                className="btn"
                style={{ backgroundColor: "var(--success-color)", color: "#ffffff", padding: "0 16px" }}
                onClick={() => {
                  navigator.clipboard.writeText(newRawKey);
                  alert("Copied to clipboard!");
                }}
              >
                Copy
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleCreateKey} style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}>
          <div className="form-group" style={{ flex: 1, margin: 0 }}>
            <label>Key Name / Label</label>
            <input
              type="text"
              placeholder="e.g. Production server key"
              value={keyLabel}
              onChange={(e) => setKeyLabel(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="btn"
            style={{ backgroundColor: "var(--primary-color)", color: "#ffffff", height: "40px", padding: "0 20px" }}
          >
            {submitting ? "Generating..." : "Create API Key"}
          </button>
        </form>
      </div>

      {/* Existing Keys list */}
      <div className="card">
        <h3 style={{ margin: "0 0 16px 0", color: "#58a6ff" }}>Existing Keys</h3>
        {keys.length === 0 ? (
          <div style={{ color: "var(--text-muted)", fontStyle: "italic", fontSize: "14px" }}>
            No active API keys found. Use the section above to generate your first key.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border-color)", textAlign: "left" }}>
                  <th style={{ padding: "10px 8px", color: "var(--text-muted)" }}>Label</th>
                  <th style={{ padding: "10px 8px", color: "var(--text-muted)" }}>Prefix</th>
                  <th style={{ padding: "10px 8px", color: "var(--text-muted)" }}>Created At</th>
                  <th style={{ padding: "10px 8px", color: "var(--text-muted)" }}>Status</th>
                  <th style={{ padding: "10px 8px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                    <td style={{ padding: "12px 8px", fontWeight: "600" }}>{k.name || "Unnamed key"}</td>
                    <td style={{ padding: "12px 8px", fontFamily: "monospace", color: "#58a6ff" }}>{k.keyPrefix}</td>
                    <td style={{ padding: "12px 8px", color: "var(--text-muted)" }}>
                      {new Date(k.createdAt).toLocaleDateString()} {new Date(k.createdAt).toLocaleTimeString()}
                    </td>
                    <td style={{ padding: "12px 8px" }}>
                      <span style={{
                        display: "inline-block",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        fontSize: "12px",
                        fontWeight: "bold",
                        backgroundColor: k.isActive ? "rgba(35, 134, 54, 0.2)" : "rgba(248, 81, 73, 0.2)",
                        color: k.isActive ? "#56d364" : "#ff7b72"
                      }}>
                        {k.isActive ? "Active" : "Revoked"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 8px", textAlign: "right" }}>
                      {k.isActive && (
                        <button
                          onClick={() => handleRevokeKey(k.id)}
                          className="btn"
                          style={{
                            padding: "4px 10px",
                            fontSize: "12px",
                            backgroundColor: "rgba(248, 81, 73, 0.15)",
                            color: "#ff7b72",
                            border: "1px solid rgba(248, 81, 73, 0.3)"
                          }}
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
