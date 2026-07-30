"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      // Store JWT token in local storage
      localStorage.setItem("sessionToken", data.token);
      localStorage.setItem("orgName", data.tenant.name);
      localStorage.setItem("tenantId", data.tenant.id);

      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh", padding: "20px" }}>
      <div className="card" style={{ width: "100%", maxWidth: "400px", boxShadow: "0 10px 30px rgba(0, 0, 0, 0.4)", border: "1px solid var(--border-color)" }}>
        
        <h2 style={{ textAlign: "center", marginBottom: "8px", fontWeight: "800", background: "linear-gradient(90deg, #58a6ff, #56d364)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          Organization Login
        </h2>
        <p style={{ color: "var(--text-muted)", fontSize: "14px", textAlign: "center", marginBottom: "24px" }}>
          Access your organization developer console.
        </p>

        {error && (
          <div style={{ backgroundColor: "rgba(248, 81, 73, 0.15)", border: "1px solid rgba(248, 81, 73, 0.4)", color: "#ff7b72", padding: "10px 14px", borderRadius: "6px", fontSize: "13px", marginBottom: "16px" }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Contact Email</label>
            <input
              type="text"
              required
              placeholder="admin@acme.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label>Password</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn"
            style={{
              backgroundColor: "var(--primary-color)",
              color: "#ffffff",
              marginTop: "8px",
              padding: "12px",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: "20px", fontSize: "13px", color: "var(--text-muted)" }}>
          Need a developer account?{" "}
          <Link href="/signup" style={{ color: "#58a6ff", textDecoration: "none", fontWeight: "600" }}>
            Sign up here
          </Link>
        </div>

      </div>
    </div>
  );
}
