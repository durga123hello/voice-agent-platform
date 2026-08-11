"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getApiUrl } from "@/utils/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"request" | "otp">("request");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch(`${getApiUrl()}/api/auth/request-login-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to request OTP code.");
      }

      setMessage(data.message || "OTP code sent to email.");
      setStep("otp");

      // Auto-populate for test validation convenience if debugCode exists
      if (data.debugCode) {
        console.log("Local debug OTP code detected:", data.debugCode);
        setOtp(data.debugCode);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${getApiUrl()}/api/auth/verify-login-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: otp }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "OTP verification failed");
      }

      // Store JWT token in local storage
      localStorage.setItem("sessionToken", data.token);
      localStorage.setItem("orgName", data.tenant.name);
      localStorage.setItem("tenantId", data.tenant.id);

      setMessage("Code verified! Logging you in...");
      setTimeout(() => {
        router.push("/");
      }, 1200);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh", padding: "20px" }}>
      <div className="card" style={{ width: "100%", maxWidth: "400px", boxShadow: "0 10px 30px rgba(0, 0, 0, 0.4)", border: "1px solid var(--border-color)" }}>
        
        {step === "request" ? (
          <>
            <h2 style={{ textAlign: "center", marginBottom: "8px", fontWeight: "800", background: "linear-gradient(90deg, #58a6ff, #56d364)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Organization Login
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: "14px", textAlign: "center", marginBottom: "24px" }}>
              Enter your contact email to receive a secure login OTP code.
            </p>

            {error && (
              <div style={{ backgroundColor: "rgba(248, 81, 73, 0.15)", border: "1px solid rgba(248, 81, 73, 0.4)", color: "#ff7b72", padding: "10px 14px", borderRadius: "6px", fontSize: "13px", marginBottom: "16px" }}>
                ⚠️ {error}
              </div>
            )}

            <form onSubmit={handleRequestOtp} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Contact Email</label>
                <input
                  type="email"
                  required
                  placeholder="admin@acme.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                {loading ? "Sending..." : "Send Verification Code"}
              </button>
            </form>

            <div style={{ textAlign: "center", marginTop: "20px", fontSize: "13px", color: "var(--text-muted)" }}>
              Need a developer account?{" "}
              <Link href="/signup" style={{ color: "#58a6ff", textDecoration: "none", fontWeight: "600" }}>
                Sign up here
              </Link>
            </div>
          </>
        ) : (
          <>
            <h2 style={{ textAlign: "center", marginBottom: "8px", fontWeight: "800", color: "#58a6ff" }}>
              Verify OTP Code
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: "14px", textAlign: "center", marginBottom: "24px" }}>
              Enter the 6-digit login verification code sent to <strong>{email}</strong>.
            </p>

            {message && (
              <div style={{ backgroundColor: "rgba(56, 139, 253, 0.15)", border: "1px solid rgba(56, 139, 253, 0.4)", color: "#58a6ff", padding: "10px 14px", borderRadius: "6px", fontSize: "13px", marginBottom: "16px" }}>
                ℹ️ {message}
              </div>
            )}

            {error && (
              <div style={{ backgroundColor: "rgba(248, 81, 73, 0.15)", border: "1px solid rgba(248, 81, 73, 0.4)", color: "#ff7b72", padding: "10px 14px", borderRadius: "6px", fontSize: "13px", marginBottom: "16px" }}>
                ⚠️ {error}
              </div>
            )}

            <form onSubmit={handleVerifyOtp} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>6-Digit Code</label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  placeholder="e.g. 123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  style={{ textAlign: "center", letterSpacing: "8px", fontSize: "20px", fontWeight: "bold" }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn"
                style={{
                  backgroundColor: "#238636",
                  color: "#ffffff",
                  marginTop: "8px",
                  padding: "12px",
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? "Verifying..." : "Verify & Log In"}
              </button>
            </form>

            <div style={{ textAlign: "center", marginTop: "20px", fontSize: "13px" }}>
              <button
                onClick={() => setStep("request")}
                style={{ background: "none", border: "none", color: "#58a6ff", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}
              >
                &larr; Back to Email Entry
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
