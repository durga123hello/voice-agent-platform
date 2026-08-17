"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { getApiUrl } from "@/utils/api";

const BACKEND_URL = getApiUrl();

interface AgentConfig {
  id: string;
  name: string | null;
  systemPrompt: string;
  llmModel: string;
  voicePreference: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system_event";
  content: string;
  createdAt: string;
}

export default function TestTelephonyPage() {
  const [configs, setConfigs] = useState<AgentConfig[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [localNumber, setLocalNumber] = useState("");
  const [status, setStatus] = useState<"disconnected" | "dialing" | "connected" | "ended">("disconnected");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load configs on mount
  useEffect(() => {
    const fetchConfigs = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/agent-configs`);
        if (!res.ok) throw new Error("Failed to load agent configurations");
        const data = await res.json();
        setConfigs(data);
        if (data.length > 0) {
          setSelectedConfigId(data[0].id);
        }
      } catch (err: any) {
        addLog(`Error: ${err.message || "Failed to load agent configurations."}`);
      }
    };
    fetchConfigs();
  }, []);

  // Scroll transcripts to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    };
  }, []);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, `[${timestamp}] ${message}`]);
  };

  const handleStartCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConfigId) {
      setErrorMsg("Please select an Agent Configuration first.");
      return;
    }
    if (!localNumber.trim()) {
      setErrorMsg("Please enter a destination phone number.");
      return;
    }

    // Format and sanitize E.164 phone number
    let cleanCode = countryCode.trim();
    if (!cleanCode.startsWith("+")) {
      cleanCode = "+" + cleanCode;
    }
    // Remove all non-digit characters from local number
    const cleanNumber = localNumber.replace(/[^0-9]/g, "");
    const fullPhoneNumber = `${cleanCode}${cleanNumber}`;

    setStatus("dialing");
    setSessionId(null);
    setMessages([]);
    setLogs([]);
    setErrorMsg(null);
    addLog(`Initiating call request to: ${fullPhoneNumber}...`);

    try {
      const res = await fetch(`${BACKEND_URL}/api/sessions/outbound`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          agentConfigId: selectedConfigId,
          phoneNumber: fullPhoneNumber
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData?.error || "Failed to initiate outbound call");
      }

      const session = await res.json();
      setSessionId(session.id);
      setStatus("connected");
      addLog(`Outbound call request successfully sent to Plivo. Session ID: ${session.id}`);
      addLog(`Call in progress. Pick up your phone to start speaking.`);

      // Start polling transcript
      startPollingTranscript(session.id);
    } catch (err: any) {
      setStatus("disconnected");
      setErrorMsg(err.message || "Failed to start outbound call");
      addLog(`Trigger Call Failed: ${err.message || "Unknown error occurred"}`);
    }
  };

  const handleHangUp = async () => {
    if (!sessionId) return;
    addLog("Disconnect requested. Ending telephony session...");

    try {
      const res = await fetch(`${BACKEND_URL}/api/sessions/${sessionId}/end`, {
        method: "POST"
      });

      if (res.ok) {
        addLog("Telephony session ended successfully on server.");
      } else {
        addLog("Call ended. Server socket connection closed.");
      }
    } catch (err: any) {
      addLog(`Error ending session: ${err.message}`);
    } finally {
      stopSession();
    }
  };

  const stopSession = () => {
    setStatus("ended");
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
    addLog("Call ended.");
  };

  const startPollingTranscript = (sessionUuid: string) => {
    if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);

    pollingTimerRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/sessions/${sessionUuid}/transcript`);
        if (!res.ok) return;

        const transcript = await res.json();
        setMessages(transcript);

        // Check if the session was completed or aborted behind the scenes
        const sessionRes = await fetch(`${BACKEND_URL}/api/sessions`);
        if (sessionRes.ok) {
          const sessions = await sessionRes.json();
          const target = sessions.find((s: any) => s.id === sessionUuid);
          if (target && target.status !== "active") {
            addLog(`Session terminated on server side (Status: ${target.status}).`);
            stopSession();
          }
        }
      } catch (err) {
        // Suppress errors during periodic polling
      }
    }, 1500);
  };

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h1 style={{ margin: 0, fontWeight: "800", color: "#ffffff", background: "linear-gradient(90deg, #58a6ff, #56d364)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          Plivo Telephony Interactive Testing
        </h1>
        <Link href="/" style={{ color: "#58a6ff", textDecoration: "none", fontSize: "14px" }}>
          &larr; Back to Setup Portal
        </Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "24px" }}>
        
        {/* Left Side: Call Form and Logs */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          
          {/* Dialing Console Card */}
          <div style={{ backgroundColor: "#161a22", border: "1px solid var(--border-color)", borderRadius: "8px", padding: "20px" }}>
            <h2 style={{ fontSize: "18px", color: "#ffffff", marginTop: 0, marginBottom: "16px" }}>Dialer Console</h2>
            
            {errorMsg && (
              <div className="alert alert-error" style={{ padding: "10px", borderRadius: "6px", marginBottom: "15px", fontSize: "14px" }}>
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleStartCall}>
              <div className="form-group" style={{ marginBottom: "15px" }}>
                <label htmlFor="config-select" style={{ fontWeight: "bold", color: "#c9d1d9", display: "block", marginBottom: "6px" }}>Select Voice Agent Config</label>
                <select
                  id="config-select"
                  value={selectedConfigId}
                  onChange={(e) => setSelectedConfigId(e.target.value)}
                  disabled={status === "dialing" || status === "connected"}
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "6px",
                    backgroundColor: "#0d0f12",
                    color: "#ffffff",
                    border: "1px solid var(--border-color)",
                    fontSize: "14px"
                  }}
                >
                  {configs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name || "Unnamed Agent"} (v{ (c as any).version || 1 })
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: "20px" }}>
                <label style={{ fontWeight: "bold", color: "#c9d1d9", display: "block", marginBottom: "6px" }}>Destination Number</label>
                <div style={{ display: "flex", gap: "10px" }}>
                  <input
                    id="country-code"
                    type="text"
                    placeholder="+91"
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    disabled={status === "dialing" || status === "connected"}
                    style={{
                      width: "30%",
                      padding: "10px",
                      borderRadius: "6px",
                      backgroundColor: "#0d0f12",
                      color: "#ffffff",
                      border: "1px solid var(--border-color)",
                      fontSize: "14px",
                      textAlign: "center"
                    }}
                    required
                  />
                  <input
                    id="phone-input"
                    type="text"
                    placeholder="9876543210"
                    value={localNumber}
                    onChange={(e) => setLocalNumber(e.target.value)}
                    disabled={status === "dialing" || status === "connected"}
                    style={{
                      width: "70%",
                      padding: "10px",
                      borderRadius: "6px",
                      backgroundColor: "#0d0f12",
                      color: "#ffffff",
                      border: "1px solid var(--border-color)",
                      fontSize: "14px"
                    }}
                    required
                  />
                </div>
              </div>

              {status === "disconnected" || status === "ended" ? (
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{
                    width: "100%",
                    padding: "12px",
                    backgroundColor: "#2ea44f",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontWeight: "bold",
                    fontSize: "15px"
                  }}
                >
                  Call Phone Number
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleHangUp}
                  style={{
                    width: "100%",
                    padding: "12px",
                    backgroundColor: "#da3637",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontWeight: "bold",
                    fontSize: "15px"
                  }}
                >
                  Hang Up Call
                </button>
              )}
            </form>
          </div>

          {/* Logs Card */}
          <div style={{ backgroundColor: "#161a22", border: "1px solid var(--border-color)", borderRadius: "8px", padding: "20px", display: "flex", flexDirection: "column", height: "300px" }}>
            <h2 style={{ fontSize: "18px", color: "#ffffff", marginTop: 0, marginBottom: "12px" }}>System Event Logs</h2>
            <div style={{ flex: 1, backgroundColor: "#0d0f12", padding: "12px", borderRadius: "6px", fontFamily: "monospace", fontSize: "12px", color: "#56d364", overflowY: "auto", border: "1px solid var(--border-color)" }}>
              {logs.length === 0 ? (
                <div style={{ color: "#8b949e" }}>No system logs generated yet. Dial a number to see live call traces.</div>
              ) : (
                logs.map((log, idx) => (
                  <div key={idx} style={{ marginBottom: "6px", wordBreak: "break-all" }}>{log}</div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* Right Side: Interactive Transcript */}
        <div style={{ display: "flex", flexDirection: "column", backgroundColor: "#161a22", border: "1px solid var(--border-color)", borderRadius: "8px", padding: "24px", minHeight: "560px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px", marginBottom: "20px" }}>
            <div>
              <h2 style={{ fontSize: "18px", color: "#ffffff", margin: 0 }}>Live Telephony Transcript</h2>
              <span style={{ fontSize: "12px", color: "#8b949e" }}>
                {status === "connected" ? "Call Session Active" : status === "dialing" ? "Initiating Stream..." : "Call Ended / Idle"}
              </span>
            </div>
            {status === "connected" && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "4px 8px", backgroundColor: "rgba(86, 211, 100, 0.15)", color: "#56d364", fontSize: "12px", fontWeight: "bold", borderRadius: "20px" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#56d364", animation: "pulse 1.5s infinite" }}></span>
                IN CALL
              </span>
            )}
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "10px", display: "flex", flexDirection: "column", gap: "16px", backgroundColor: "#0d0f12", borderRadius: "8px", border: "1px solid var(--border-color)", maxHeight: "450px" }}>
            {messages.length === 0 ? (
              <div style={{ display: "flex", flex: 1, justifyContent: "center", alignItems: "center", color: "#8b949e", fontSize: "14px", flexDirection: "column", gap: "8px", minHeight: "200px" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#8b949e" }}>
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                </svg>
                <span>Call is not active yet.</span>
              </div>
            ) : (
              messages
                .filter(m => m.role === "user" || m.role === "assistant")
                .map((msg) => {
                  const isUser = msg.role === "user";
                  return (
                    <div
                      key={msg.id}
                      style={{
                        display: "flex",
                        justifyContent: isUser ? "flex-end" : "flex-start",
                        width: "100%"
                      }}
                    >
                      <div
                        style={{
                          maxWidth: "70%",
                          padding: "12px 16px",
                          borderRadius: "12px",
                          borderTopLeftRadius: isUser ? "12px" : "0px",
                          borderTopRightRadius: isUser ? "0px" : "12px",
                          backgroundColor: isUser ? "#1f6feb" : "#21262d",
                          color: "#ffffff",
                          fontSize: "14px",
                          lineHeight: "1.5",
                          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)"
                        }}
                      >
                        <span style={{ fontSize: "11px", color: isUser ? "#8b949e" : "#8b949e", display: "block", marginBottom: "4px", fontWeight: "bold" }}>
                          {isUser ? "Caller (You)" : "Voice Agent"}
                        </span>
                        {msg.content}
                      </div>
                    </div>
                  );
                })
            )}
            <div ref={messagesEndRef} />
          </div>

        </div>

      </div>

      <style jsx global>{`
        @keyframes pulse {
          0% { transform: scale(0.95); opacity: 0.5; }
          50% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(0.95); opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
