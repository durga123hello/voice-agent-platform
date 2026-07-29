"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

const BACKEND_URL = "http://localhost:3000";

interface Message {
  id: string;
  role: string;
  content: string;
  createdAt: string;
  latency?: {
    utteranceEndToFirstTokenMs: number;
    firstTokenToFirstAudioMs: number;
    totalTurnMs: number;
    sttDurationMs?: number;
    llmDurationMs?: number;
    firstTokenMs?: number;
    ttsDurationMs?: number;
  } | null;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } | null;
}

interface Session {
  id: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  summary: string | null;
  agentConfig: {
    name: string | null;
    systemPrompt: string;
    llmModel: string;
  };
}

export default function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        // Fetch session info
        const sessionRes = await fetch(`${BACKEND_URL}/api/sessions`);
        if (!sessionRes.ok) throw new Error("Failed to fetch session metadata");
        const allSessions: Session[] = await sessionRes.json();
        const found = allSessions.find((s) => s.id === id);
        if (!found) throw new Error("Session not found in history");
        setSession(found);

        // Fetch transcript messages
        const messagesRes = await fetch(`${BACKEND_URL}/api/sessions/${id}/transcript`);
        if (!messagesRes.ok) throw new Error("Failed to fetch session transcript");
        const messagesData = await messagesRes.json();
        setMessages(messagesData);
      } catch (err: any) {
        setError(err.message || "Failed to load session details");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  return (
    <div className="container">
      <h1>Voice AI Agent Platform — Session Transcript</h1>

      <div style={{ marginBottom: "20px", display: "flex", gap: "12px" }}>
        <Link href="/sessions" className="btn btn-secondary">
          &larr; Back to Session History
        </Link>
        <Link href="/test-voice" className="btn btn-secondary">
          Go to Voice Testing Page &rarr;
        </Link>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="card">
          <div style={{ color: "var(--text-muted)", fontStyle: "italic" }}>Loading details...</div>
        </div>
      ) : session ? (
        <>
          {/* Session Overview */}
          <div className="card">
            <h2>Session Metadata</h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "16px",
                marginTop: "12px",
                fontSize: "14px"
              }}
            >
              <div>
                <strong style={{ color: "var(--text-muted)" }}>Session ID:</strong>
                <div style={{ color: "#ffffff", fontFamily: "monospace", marginTop: "4px" }}>{session.id}</div>
              </div>
              <div>
                <strong style={{ color: "var(--text-muted)" }}>Agent Configuration:</strong>
                <div style={{ color: "#ffffff", marginTop: "4px" }}>
                  {session.agentConfig?.name || "Unnamed Agent"}
                </div>
              </div>
              <div>
                <strong style={{ color: "var(--text-muted)" }}>Started At:</strong>
                <div style={{ color: "#ffffff", marginTop: "4px" }}>
                  {new Date(session.startedAt).toLocaleString()}
                </div>
              </div>
              <div>
                <strong style={{ color: "var(--text-muted)" }}>Status:</strong>
                <div style={{ marginTop: "4px" }}>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "2px 8px",
                      borderRadius: "12px",
                      fontSize: "12px",
                      fontWeight: "bold",
                      backgroundColor:
                        session.status === "completed"
                          ? "rgba(86, 211, 100, 0.15)"
                          : session.status === "active"
                          ? "rgba(56, 139, 253, 0.15)"
                          : "rgba(248, 81, 73, 0.15)",
                      color:
                        session.status === "completed"
                          ? "#56d364"
                          : session.status === "active"
                          ? "#388bfd"
                          : "#f85149",
                      border: `1px solid ${
                        session.status === "completed"
                          ? "rgba(86, 211, 100, 0.3)"
                          : session.status === "active"
                          ? "rgba(56, 139, 253, 0.3)"
                          : "rgba(248, 81, 73, 0.3)"
                      }`
                    }}
                  >
                    {session.status.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Transcript Chat Log */}
          <div className="card">
            <h2>Transcript Logs</h2>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                maxHeight: "550px",
                overflowY: "auto",
                padding: "16px",
                backgroundColor: "#0d0f12",
                border: "1px solid var(--border-color)",
                borderRadius: "6px",
                marginTop: "12px"
              }}
            >
              {messages.length === 0 ? (
                <div style={{ color: "var(--text-muted)", fontStyle: "italic" }}>
                  No messages logged in this session.
                </div>
              ) : (
                messages.map((m) => {
                  const isUser = m.role === "user";
                  const messageTime = new Date(m.createdAt).toLocaleTimeString();

                  return (
                    <div
                      key={m.id}
                      style={{
                        alignSelf: isUser ? "flex-end" : "flex-start",
                        backgroundColor: isUser ? "rgba(35, 134, 54, 0.15)" : "rgba(88, 166, 255, 0.1)",
                        border: `1px solid ${isUser ? "rgba(35, 134, 54, 0.4)" : "rgba(88, 166, 255, 0.3)"}`,
                        borderRadius: "8px",
                        padding: "10px 14px",
                        maxWidth: "80%",
                        wordBreak: "break-word"
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "24px",
                          alignItems: "center",
                          fontSize: "11px",
                          fontWeight: "bold",
                          color: isUser ? "#56d364" : "#58a6ff",
                          marginBottom: "4px"
                        }}
                      >
                        <span>{isUser ? "User" : "Assistant"}</span>
                        <span style={{ color: "var(--text-muted)", fontWeight: "normal" }}>{messageTime}</span>
                      </div>
                      <div style={{ color: "#ffffff", fontSize: "15px" }}>{m.content}</div>
                      
                      {!isUser && (m.latency || m.usage) && (
                        <div
                          style={{
                            marginTop: "8px",
                            paddingTop: "6px",
                            borderTop: "1px dashed var(--border-color)",
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "12px",
                            fontSize: "11px",
                            color: "var(--text-muted)"
                          }}
                        >
                          {m.latency && (
                            <>
                              <div>
                                STT: <strong style={{ color: "#58a6ff" }}>{m.latency.sttDurationMs || 0}ms</strong>
                              </div>
                              <div>
                                LLM: <strong style={{ color: "#56d364" }}>{m.latency.llmDurationMs || 0}ms</strong>{" "}
                                <span style={{ fontSize: "9px" }}>(first token: {m.latency.firstTokenMs || m.latency.utteranceEndToFirstTokenMs || 0}ms)</span>
                              </div>
                              <div>
                                TTS: <strong style={{ color: "#ffb454" }}>{m.latency.ttsDurationMs || 0}ms</strong>
                              </div>
                              <div style={{ color: "var(--border-color)", borderLeft: "1px solid var(--border-color)", height: "12px", margin: "0 4px" }}></div>
                              <div>
                                Total Turn: <strong style={{ color: "#ffffff" }}>{m.latency.totalTurnMs}ms</strong>
                              </div>
                            </>
                          )}
                          {m.usage && (
                            <div>
                              Tokens: <strong style={{ color: "#ffffff" }}>{m.usage.totalTokens}</strong>{" "}
                              <span style={{ fontSize: "9px" }}>
                                (P: {m.usage.promptTokens} / C: {m.usage.completionTokens})
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
