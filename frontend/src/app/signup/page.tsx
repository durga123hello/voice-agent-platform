"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getApiUrl } from "@/utils/api";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"signup" | "otp">("signup");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [debugOtp, setDebugOtp] = useState<string | null>(null);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${getApiUrl()}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Signup failed");
      }

      setMessage(data.message || "OTP code sent to email.");
      setStep("otp");
      
      // Store debugCode in state instead of auto-populating
      if (data.debugCode) {
        console.log("Local debug OTP code detected:", data.debugCode);
        setDebugOtp(data.debugCode);
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
      const res = await fetch(`${getApiUrl()}/api/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: otp }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "OTP verification failed");
      }

      // Store JWT token directly in local storage since OTP verify logged us in
      localStorage.setItem("sessionToken", data.token);
      localStorage.setItem("orgName", data.tenant.name);
      localStorage.setItem("tenantId", data.tenant.id);

      setMessage("Email verified successfully! Logging you in...");
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
      <div className="card" style={{ width: "100%", maxWidth: "440px", boxShadow: "0 10px 30px rgba(0, 0, 0, 0.4)", border: "1px solid var(--border-color)" }}>
        
        {step === "signup" ? (
          <>
            <h2 style={{ textAlign: "center", marginBottom: "8px", fontWeight: "800", background: "linear-gradient(90deg, #58a6ff, #56d364)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Create Organization
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: "14px", textAlign: "center", marginBottom: "24px" }}>
              Get started by registering your organization profile.
            </p>

            {error && (
              <div style={{ backgroundColor: "rgba(248, 81, 73, 0.15)", border: "1px solid rgba(248, 81, 73, 0.4)", color: "#ff7b72", padding: "10px 14px", borderRadius: "6px", fontSize: "13px", marginBottom: "16px" }}>
                ⚠️ {error}
              </div>
            )}

            <form onSubmit={handleSignup} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Organization Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Corp"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Contact Email</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. admin@acme.com"
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
                {loading ? "Registering..." : "Sign Up"}
              </button>
            </form>

            <div style={{ textAlign: "center", marginTop: "20px", fontSize: "13px", color: "var(--text-muted)" }}>
              Already registered?{" "}
              <Link href="/login" style={{ color: "#58a6ff", textDecoration: "none", fontWeight: "600" }}>
                Login here
              </Link>
            </div>
          </>
        ) : (
          <>
            <h2 style={{ textAlign: "center", marginBottom: "8px", fontWeight: "800", color: "#58a6ff" }}>
              Verify OTP
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: "14px", textAlign: "center", marginBottom: "24px" }}>
              Enter the 6-digit verification code sent to <strong>{email}</strong>.
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
                onClick={() => setStep("signup")}
                style={{ background: "none", border: "none", color: "#58a6ff", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}
              >
                &larr; Back to Registration
              </button>
            </div>
          </>
        )}

      </div>

      {debugOtp && (
        <div style={{
          position: "fixed",
          top: "20px",
          left: "50%",
          transform: "translateX(-50%)",
          backgroundColor: "#161b22",
          border: "1.5px solid #58a6ff",
          borderRadius: "8px",
          padding: "14px 24px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          zIndex: 1000,
          display: "flex",
          alignItems: "center",
          gap: "16px",
          fontFamily: "var(--font-sans, sans-serif)",
          animation: "fadeInDown 0.3s ease-out"
        }}>
          <span style={{ fontSize: "18px" }}>🔑</span>
          <div style={{ fontSize: "14px", color: "#ffffff", fontWeight: "500" }}>
            [Dev Mode] Verification OTP: <strong style={{ color: "#58a6ff", fontSize: "18px", letterSpacing: "2px", marginLeft: "4px" }}>{debugOtp}</strong>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(debugOtp);
              alert("OTP copied to clipboard!");
            }}
            style={{
              backgroundColor: "#21262d",
              border: "1px solid var(--border-color)",
              color: "#58a6ff",
              borderRadius: "6px",
              padding: "6px 12px",
              fontSize: "12px",
              fontWeight: "600",
              cursor: "pointer",
              transition: "all 0.2s"
            }}
          >
            Copy
          </button>
        </div>
      )}
    </div>
  );
}
