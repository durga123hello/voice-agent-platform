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

interface SessionDetail {
  id: string;
  status: string;
  transport: string;
  phoneNumber: string | null;
  providerCallId: string | null;
  callState: string;
  mediaState: string;
  conversationState: string;
  endedReason: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  userMessage: string | null;
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
  
  // Real-time diagnostics state
  const [diagnostics, setDiagnostics] = useState<SessionDetail | null>(null);

  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const userUtteranceIdRef = useRef<string | null>(null);

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

  const prevLengthRef = useRef(0);

  // Scroll transcripts to bottom only when a new message arrives
  useEffect(() => {
    if (messages.length > prevLengthRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      prevLengthRef.current = messages.length;
    }
  }, [messages]);

  // Clean up timers and websockets on unmount
  useEffect(() => {
    return () => {
      cleanupRealtimeConnections();
    };
  }, []);

  const cleanupRealtimeConnections = () => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

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

    cleanupRealtimeConnections();

    // Format and sanitize E.164 phone number
    let cleanCode = countryCode.trim();
    if (!cleanCode.startsWith("+")) {
      cleanCode = "+" + cleanCode;
    }
    const cleanNumber = localNumber.replace(/[^0-9]/g, "");
    const fullPhoneNumber = `${cleanCode}${cleanNumber}`;

    setStatus("dialing");
    setSessionId(null);
    setDiagnostics(null);
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
      addLog(`Outbound call request successfully sent to Plivo. Session ID: ${session.id}`);
      addLog(`Call status: initiating / ringing.`);

      // Establish real-time tracking (WS with HTTP fallback polling)
      connectSessionRealtime(session.id);
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
        addLog("Call ended.");
      }
    } catch (err: any) {
      addLog(`Error ending session: ${err.message}`);
    } finally {
      stopSession();
    }
  };

  const stopSession = () => {
    setStatus("ended");
    cleanupRealtimeConnections();
    addLog("Call ended.");
  };

  const connectSessionRealtime = (sessionUuid: string) => {
    // 1. Establish WebSocket for real-time state change messages
    const wsUrl = `${BACKEND_URL.replace(/^http/, "ws")}/ws/sessions/${sessionUuid}`;
    addLog(`Connecting diagnostics tracking link: ${wsUrl}`);
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("[Diagnostics WS Message] Received update:", data);
        
        if (data.callState) {
          setDiagnostics((prev) => ({
            ...(prev || {
              id: sessionUuid,
              status: "active",
              transport: "plivo",
              phoneNumber: localNumber,
              providerCallId: null,
              callState: "initiating",
              mediaState: "disconnected",
              conversationState: "idle",
              endedReason: null,
              errorCode: null,
              errorMessage: null,
              userMessage: null
            }),
            ...data
          }));

          syncUiCallState(data.callState, data.userMessage, data.endedReason);
        }

        if (data.type === "transcript") {
          const { isFinal, text } = data;
          console.log("[Diagnostics WS Message] Received live transcript:", text, "isFinal:", isFinal);
          
          setMessages((prev) => {
            const currentId = userUtteranceIdRef.current;

            if (currentId) {
              // Active bubble already exists, update it
              if (isFinal) {
                userUtteranceIdRef.current = null;
                return prev.map((msg) =>
                  msg.id === currentId
                    ? { ...msg, id: currentId, role: "user" as const, content: text }
                    : msg
                );
              } else {
                return prev.map((msg) =>
                  msg.id === currentId
                    ? { ...msg, content: text }
                    : msg
                );
              }
            } else {
              // No active bubble exists, create one
              const newId = `user-${Date.now()}`;
              if (!isFinal) {
                userUtteranceIdRef.current = newId;
              }
              return [
                ...prev,
                { id: newId, role: "user" as const, content: text, createdAt: new Date().toISOString() }
              ];
            }
          });
        }
      } catch (err) {
        console.error("Failed to parse websocket event data:", err);
      }
    };

    ws.onerror = (err) => {
      console.warn("Diagnostics websocket experienced error, falling back to HTTP polling:", err);
    };

    ws.onclose = () => {
      console.log("Diagnostics websocket closed.");
    };

    // 2. Setup HTTP Polling for transcripts and failover state synchronization
    pollingTimerRef.current = setInterval(async () => {
      try {
        // Fetch transcripts
        const txRes = await fetch(`${BACKEND_URL}/api/sessions/${sessionUuid}/transcript`);
        if (txRes.ok) {
          const polledMessages = await txRes.json();
          setMessages((prev) => {
            const currentId = userUtteranceIdRef.current;
            if (currentId) {
              const activeUserBubble = prev.find((m) => m.id === currentId);
              if (activeUserBubble) {
                const exists = polledMessages.some((m: any) => m.id === currentId);
                if (!exists) {
                  return [...polledMessages, activeUserBubble];
                }
              }
            }
            return polledMessages;
          });
        }

        // Fetch detailed session diagnostics
        const sessionRes = await fetch(`${BACKEND_URL}/api/sessions/${sessionUuid}`);
        if (sessionRes.ok) {
          const detail: SessionDetail = await sessionRes.json();
          setDiagnostics(detail);
          syncUiCallState(detail.callState, detail.userMessage, detail.endedReason);
        }
      } catch (err) {
        // Suppress background polling errors
      }
    }, 1500);
  };

  const syncUiCallState = (callState: string, userMsg: string | null, endedReason: string | null) => {
    const cleanState = callState.toLowerCase();
    
    if (cleanState === "ringing") {
      setStatus("dialing");
    } else if (cleanState === "connected" || cleanState === "in_progress") {
      setStatus("connected");
    } else if (
      ["completed", "no_answer", "busy", "rejected", "failed", "cancelled", "timeout", "aborted", "user_hangup", "ai_hangup", "unexpected_disconnect"].includes(cleanState)
    ) {
      setStatus("ended");
      cleanupRealtimeConnections();
      if (userMsg) {
        setErrorMsg(userMsg);
      }
      addLog(`Call finished. State: ${callState}. Reason: ${endedReason || userMsg || "None"}`);
    }
  };

  // State color mapping helpers
  const getCallStateColor = (state: string) => {
    switch (state.toLowerCase()) {
      case "connected":
      case "in_progress":
        return "#56d364"; // green
      case "ringing":
        return "#58a6ff"; // blue
      case "initiating":
        return "#ffb86c"; // orange/amber
      case "busy":
      case "no_answer":
      case "rejected":
      case "timeout":
      case "cancelled":
        return "#ff79c6"; // pink/violet
      case "failed":
      case "unexpected_disconnect":
        return "#ff5555"; // red
      default:
        return "#8b949e";
    }
  };

  const getMediaStateColor = (state: string) => {
    switch (state.toLowerCase()) {
      case "connected":
      case "streaming":
        return "#56d364";
      case "connecting":
      case "reconnecting":
        return "#ffb86c";
      case "failed":
      case "closed":
        return "#ff5555";
      default:
        return "#8b949e";
    }
  };

  const getConversationStateColor = (state: string) => {
    switch (state.toLowerCase()) {
      case "listening":
        return "#56d364";
      case "responding":
        return "#58a6ff";
      case "processing":
        return "#ffb86c";
      case "greeting":
        return "#bd93f9"; // purple
      default:
        return "#8b949e";
    }
  };

  return (
    <div style={{ maxWidth: "1300px", margin: "0 auto", padding: "30px", fontFamily: "system-ui, -apple-system, sans-serif", color: "#c9d1d9", backgroundColor: "#0d1117", minHeight: "100vh" }}>
      
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px", borderBottom: "1px solid #21262d", paddingBottom: "15px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "28px", fontWeight: "800", background: "linear-gradient(90deg, #58a6ff, #56d364)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Production Telephony Live Control & Diagnostics
          </h1>
          <p style={{ margin: "5px 0 0 0", fontSize: "14px", color: "#8b949e" }}>
            Plivo Phone Call Integration & Real-time State Telemetry
          </p>
        </div>
        <Link href="/" style={{ color: "#58a6ff", textDecoration: "none", fontSize: "14px", fontWeight: "600", display: "flex", alignItems: "center", gap: "5px" }}>
          &larr; Portal Dashboard
        </Link>
      </div>

      {/* Main Grid Layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 2fr", gap: "30px" }}>
        
        {/* Left Hand: Controls & Diagnostics */}
        <div style={{ display: "flex", flexDirection: "column", gap: "25px" }}>
          
          {/* Dialing Console Card */}
          <div style={{ backgroundColor: "#161b22", border: "1px solid #30363d", borderRadius: "12px", padding: "24px", boxShadow: "0 10px 25px rgba(0,0,0,0.3)" }}>
            <h2 style={{ fontSize: "20px", color: "#ffffff", marginTop: 0, marginBottom: "20px", fontWeight: "700", borderBottom: "1px solid #21262d", paddingBottom: "10px" }}>Call Console</h2>
            
            {errorMsg && (
              <div style={{ backgroundColor: "rgba(255, 85, 85, 0.15)", border: "1px solid #ff5555", color: "#ff6e6e", padding: "12px 16px", borderRadius: "8px", marginBottom: "20px", fontSize: "14px", fontWeight: "500", lineHeight: "1.4" }}>
                <strong style={{ display: "block", marginBottom: "3px" }}>Call Diagnostic Error:</strong>
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleStartCall}>
              <div style={{ marginBottom: "20px" }}>
                <label htmlFor="config-select" style={{ fontWeight: "600", color: "#c9d1d9", display: "block", marginBottom: "8px", fontSize: "14px" }}>Select Voice Agent Config</label>
                <select
                  id="config-select"
                  value={selectedConfigId}
                  onChange={(e) => setSelectedConfigId(e.target.value)}
                  disabled={status === "dialing" || status === "connected"}
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "8px",
                    backgroundColor: "#0d1117",
                    color: "#ffffff",
                    border: "1px solid #30363d",
                    fontSize: "14px",
                    cursor: "pointer"
                  }}
                >
                  {configs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name || "Unnamed Agent"} (v{ (c as any).version || 1 })
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: "25px" }}>
                <label style={{ fontWeight: "600", color: "#c9d1d9", display: "block", marginBottom: "8px", fontSize: "14px" }}>Destination Phone Number</label>
                <div style={{ display: "flex", gap: "12px" }}>
                  <input
                    id="country-code"
                    type="text"
                    placeholder="+91"
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    disabled={status === "dialing" || status === "connected"}
                    style={{
                      width: "30%",
                      padding: "12px",
                      borderRadius: "8px",
                      backgroundColor: "#0d1117",
                      color: "#ffffff",
                      border: "1px solid #30363d",
                      fontSize: "14px",
                      textAlign: "center",
                      fontWeight: "600"
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
                      padding: "12px",
                      borderRadius: "8px",
                      backgroundColor: "#0d1117",
                      color: "#ffffff",
                      border: "1px solid #30363d",
                      fontSize: "14px",
                      letterSpacing: "0.5px"
                    }}
                    required
                  />
                </div>
              </div>

              {status === "disconnected" || status === "ended" ? (
                <button
                  type="submit"
                  style={{
                    width: "100%",
                    padding: "14px",
                    backgroundColor: "#2ea44f",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontWeight: "700",
                    fontSize: "15px",
                    transition: "background-color 0.2s"
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
                    padding: "14px",
                    backgroundColor: "#da3637",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontWeight: "700",
                    fontSize: "15px",
                    transition: "background-color 0.2s"
                  }}
                >
                  Hang Up Call
                </button>
              )}
            </form>
          </div>

          {/* Diagnostics Panel Card */}
          <div style={{ backgroundColor: "#161b22", border: "1px solid #30363d", borderRadius: "12px", padding: "24px", boxShadow: "0 10px 25px rgba(0,0,0,0.3)" }}>
            <h3 style={{ fontSize: "18px", color: "#ffffff", marginTop: 0, marginBottom: "16px", fontWeight: "700", borderBottom: "1px solid #21262d", paddingBottom: "10px" }}>
              Call Telemetry States
            </h3>
            {diagnostics ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px", fontSize: "14px" }}>
                
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#8b949e" }}>Call State:</span>
                  <span style={{ padding: "4px 10px", borderRadius: "12px", fontSize: "12px", fontWeight: "bold", backgroundColor: `${getCallStateColor(diagnostics.callState)}1A`, color: getCallStateColor(diagnostics.callState), border: `1px solid ${getCallStateColor(diagnostics.callState)}40` }}>
                    {diagnostics.callState.toUpperCase()}
                  </span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#8b949e" }}>Media Pipeline:</span>
                  <span style={{ padding: "4px 10px", borderRadius: "12px", fontSize: "12px", fontWeight: "bold", backgroundColor: `${getMediaStateColor(diagnostics.mediaState)}1A`, color: getMediaStateColor(diagnostics.mediaState), border: `1px solid ${getMediaStateColor(diagnostics.mediaState)}40` }}>
                    {diagnostics.mediaState.toUpperCase()}
                  </span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#8b949e" }}>Conversation State:</span>
                  <span style={{ padding: "4px 10px", borderRadius: "12px", fontSize: "12px", fontWeight: "bold", backgroundColor: `${getConversationStateColor(diagnostics.conversationState)}1A`, color: getConversationStateColor(diagnostics.conversationState), border: `1px solid ${getConversationStateColor(diagnostics.conversationState)}40` }}>
                    {diagnostics.conversationState.toUpperCase()}
                  </span>
                </div>

                <div style={{ borderTop: "1px solid #21262d", marginTop: "5px", paddingTop: "12px" }}>
                  <span style={{ display: "block", color: "#8b949e", marginBottom: "4px" }}>Plivo Call UUID:</span>
                  <span style={{ fontFamily: "monospace", color: "#ffffff", fontSize: "12px", wordBreak: "break-all" }}>
                    {diagnostics.providerCallId || "Pending provider hook..."}
                  </span>
                </div>

                {diagnostics.endedReason && (
                  <div style={{ borderTop: "1px solid #21262d", paddingTop: "12px" }}>
                    <span style={{ display: "block", color: "#8b949e", marginBottom: "4px" }}>Termination Reason:</span>
                    <span style={{ color: "#ffb86c", fontSize: "13px" }}>
                      {diagnostics.endedReason}
                    </span>
                  </div>
                )}

              </div>
            ) : (
              <div style={{ color: "#8b949e", fontSize: "14px", textAlign: "center", padding: "10px 0" }}>
                No active call diagnostics available. Initiating a call will display real-time network and pipeline telemetry.
              </div>
            )}
          </div>

          {/* Logs Card */}
          <div style={{ backgroundColor: "#161b22", border: "1px solid #30363d", borderRadius: "12px", padding: "24px", display: "flex", flexDirection: "column", height: "300px", boxShadow: "0 10px 25px rgba(0,0,0,0.3)" }}>
            <h2 style={{ fontSize: "18px", color: "#ffffff", marginTop: 0, marginBottom: "16px", fontWeight: "700" }}>System Event Logs</h2>
            <div style={{ flex: 1, backgroundColor: "#0d1117", padding: "12px", borderRadius: "8px", fontFamily: "monospace", fontSize: "12px", color: "#56d364", overflowY: "auto", border: "1px solid #30363d" }}>
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

        {/* Right Hand: Interactive Transcript */}
        <div style={{ display: "flex", flexDirection: "column", backgroundColor: "#161b22", border: "1px solid #30363d", borderRadius: "12px", padding: "24px", minHeight: "650px", boxShadow: "0 10px 25px rgba(0,0,0,0.3)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #21262d", paddingBottom: "15px", marginBottom: "20px" }}>
            <div>
              <h2 style={{ fontSize: "20px", color: "#ffffff", margin: 0, fontWeight: "700" }}>Live Conversation Transcript</h2>
              <span style={{ fontSize: "13px", color: "#8b949e" }}>
                {status === "connected" ? "Call Session Active" : status === "dialing" ? "Initiating Call Stream..." : "Call Ended / Idle"}
              </span>
            </div>
            {status === "connected" && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 12px", backgroundColor: "rgba(86, 211, 100, 0.15)", color: "#56d364", fontSize: "12px", fontWeight: "bold", borderRadius: "20px", border: "1px solid rgba(86, 211, 100, 0.3)" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#56d364", animation: "pulse 1.5s infinite" }}></span>
                IN CALL
              </span>
            )}
          </div>

          {/* Transcript Dialogue Container */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "16px", backgroundColor: "#0d1117", borderRadius: "8px", border: "1px solid #30363d", maxHeight: "550px" }}>
            {messages.length === 0 ? (
              <div style={{ display: "flex", flex: 1, justifyContent: "center", alignItems: "center", color: "#8b949e", fontSize: "14px", flexDirection: "column", gap: "12px", minHeight: "300px" }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#8b949e" }}>
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                </svg>
                <span>No dialogue has occurred yet. Make a call to see live transcript bubbles.</span>
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
                          maxWidth: "75%",
                          padding: "12px 18px",
                          borderRadius: "12px",
                          borderTopLeftRadius: isUser ? "12px" : "0px",
                          borderTopRightRadius: isUser ? "0px" : "12px",
                          backgroundColor: isUser ? "#1f6feb" : "#21262d",
                          color: "#ffffff",
                          fontSize: "14px",
                          lineHeight: "1.5",
                          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                          border: isUser ? "1px solid #388bfd" : "1px solid #30363d"
                        }}
                      >
                        <span style={{ fontSize: "11px", color: "#8b949e", display: "block", marginBottom: "6px", fontWeight: "600" }}>
                          {isUser ? "Caller (User)" : "Voice Agent (AI)"}
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
