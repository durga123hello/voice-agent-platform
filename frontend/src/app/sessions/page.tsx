"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

const BACKEND_URL = "http://localhost:3000";

interface Session {
  id: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  agentConfig: {
    name: string | null;
  };
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSessions() {
      try {
        const res = await fetch(`${BACKEND_URL}/api/sessions`);
        if (!res.ok) throw new Error("Failed to fetch sessions");
        const data = await res.json();
        setSessions(data);
      } catch (err: any) {
        setError(err.message || "Failed to load session history");
      } finally {
        setLoading(false);
      }
    }
    fetchSessions();
  }, []);

  return (
    <div className="container">
      <h1>Voice AI Agent Platform — Session History</h1>

      <div style={{ marginBottom: "20px", display: "flex", gap: "12px" }}>
        <Link href="/" className="btn btn-secondary">
          &larr; Back to Setup Page
        </Link>
        <Link href="/test-voice" className="btn btn-secondary">
          Go to Voice Testing Page &rarr;
        </Link>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <h2>Past Voice Sessions</h2>
        {loading ? (
          <div style={{ color: "var(--text-muted)", fontStyle: "italic" }}>Loading sessions...</div>
        ) : sessions.length === 0 ? (
          <div style={{ color: "var(--text-muted)", fontStyle: "italic" }}>
            No sessions found. Create a session on the Voice Testing page first!
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "12px" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border-color)", textAlign: "left" }}>
                  <th style={{ padding: "12px 8px", color: "var(--text-muted)" }}>Agent Configuration</th>
                  <th style={{ padding: "12px 8px", color: "var(--text-muted)" }}>Started At</th>
                  <th style={{ padding: "12px 8px", color: "var(--text-muted)" }}>Status</th>
                  <th style={{ padding: "12px 8px", color: "var(--text-muted)", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => {
                  const agentName = session.agentConfig?.name || "Unnamed Agent";
                  const formattedDate = new Date(session.startedAt).toLocaleString();
                  const statusColors: Record<string, string> = {
                    active: "#388bfd",
                    completed: "#56d364",
                    aborted: "#f85149"
                  };
                  const statusColor = statusColors[session.status] || "var(--text-muted)";

                  return (
                    <tr
                      key={session.id}
                      style={{ borderBottom: "1px solid var(--border-color)", fontSize: "14px" }}
                    >
                      <td style={{ padding: "12px 8px", fontWeight: "600", color: "#ffffff" }}>
                        {agentName}{" "}
                        <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "normal" }}>
                          ({session.id.slice(0, 8)})
                        </span>
                      </td>
                      <td style={{ padding: "12px 8px", color: "var(--text-muted)" }}>{formattedDate}</td>
                      <td style={{ padding: "12px 8px" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "3px 8px",
                            borderRadius: "12px",
                            fontSize: "12px",
                            fontWeight: "bold",
                            backgroundColor: `${statusColor}22`,
                            color: statusColor,
                            border: `1px solid ${statusColor}44`
                          }}
                        >
                          {session.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: "12px 8px", textAlign: "right" }}>
                        <Link
                          href={`/sessions/${session.id}`}
                          className="btn btn-secondary"
                          style={{ padding: "6px 12px", fontSize: "12px" }}
                        >
                          View Transcript
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
