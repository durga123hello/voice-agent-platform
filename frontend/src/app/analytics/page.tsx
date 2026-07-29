"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

const BACKEND_URL = "http://localhost:3000";

interface LatencyStat {
  avgMs: number;
  p95Ms: number;
}

interface SubComponentStat {
  avgMs: number | null;
  p95Ms: number | null;
  reason?: string;
  note?: string;
}

interface OverviewData {
  totalSessions: number;
  statusBreakdown: {
    completed: number;
    aborted: number;
    active: number;
  };
  avgDurationSeconds: number;
  avgTurnsPerSession: number;
  avgInterruptionsPerSession: number;
  avgSilenceNudgesPerSession: number;
  avgReconnectsPerSession: number;
  totalTokens: number;
  avgTokensPerSession: number;
  latencies: {
    utteranceEndToFirstToken: LatencyStat;
    firstTokenToFirstAudio: LatencyStat;
    totalTurn: LatencyStat;
    stt: LatencyStat;
    llm: LatencyStat;
    tts: LatencyStat;
    firstToken: LatencyStat;
    subComponents?: {
      micToMediasoup: SubComponentStat;
      mediasoupToFfmpeg: SubComponentStat;
      ffmpegTranscode: SubComponentStat;
      deepgramNetworkAndEndpointing: SubComponentStat;
      localPipeline?: SubComponentStat;
      deepgramNetworkRtt?: SubComponentStat;
      deepgramProcessing?: SubComponentStat;
      interimTranscriptCount?: { avg: number };
      networkToOpenAi: SubComponentStat;
      generation: SubComponentStat;
      networkToDeepgramTts: SubComponentStat;
      audioRelayToClient: SubComponentStat;
      clientBufferToPlayback: SubComponentStat;
    };
  };
  reliability: {
    providerErrorRate: number;
    openaiErrorCount: number;
    deepgramSttErrorCount: number;
    deepgramTtsErrorCount: number;
    avgAbortedTurn: number;
    avgAbortedElapsedTimeSeconds: number;
    avgBargeInRate: number;
    nudgeComparison: {
      completed: number;
      aborted: number;
    };
  };
}

interface SessionData {
  id: string;
  startedAt: string;
  endedAt: string | null;
  status: string;
  agentConfigName: string;
  avgTurnLatencyMs: number;
  avgSttLatencyMs: number;
  avgLlmLatencyMs: number;
  avgTtsLatencyMs: number;
  avgUtteranceEndToFirstTokenMs: number;
  avgFirstTokenToFirstAudioMs: number;
  avgDeepgramWaitMs: number;
  avgSttNetworkAndComputeMs: number;
  avgLlmNetworkMs: number;
  avgLlmGenerationMs: number;
  avgTtsNetworkAndSynthesisMs: number;
  avgMediasoupToFfmpegMs: number | null;
  avgFfmpegTranscodeMs: number | null;
  avgDeepgramNetworkAndComputeMs: number;
  avgLocalPipelineMs: number;
  avgDeepgramNetworkRttMs: number;
  avgDeepgramProcessingMs: number;
  avgInterimTranscriptCount: number;
  totalTokensUsed: number;
  turnsCount: number;
  interruptionsCount: number;
  silenceNudgesCount: number;
  reconnectsCount: number;
  providerErrorsCount: number;
  abortedAtTurn: number | null;
  abortedElapsedTimeMs: number | null;
}

interface ConfigItem {
  id: string;
  name: string;
}

export default function AnalyticsPage() {
  const [data, setData] = useState<{ overview: OverviewData; sessions: SessionData[]; configs: ConfigItem[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter States
  const [selectedConfigId, setSelectedConfigId] = useState<string>("");
  const [excludeActiveZeroTurns, setExcludeActiveZeroTurns] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  // Sorting States
  const [sortField, setSortField] = useState<keyof SessionData | "">("");
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Expandable Session Rows Map
  const [expandedSessions, setExpandedSessions] = useState<Record<string, boolean>>({});

  // Toggle for Collapsible Platform Averages
  const [showPlatformStats, setShowPlatformStats] = useState<boolean>(false);

  // Expandable/Nested Card Toggle States
  const [showSttBreakdown, setShowSttBreakdown] = useState(false);
  const [showLlmBreakdown, setShowLlmBreakdown] = useState(false);
  const [showTtsBreakdown, setShowTtsBreakdown] = useState(false);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (selectedConfigId) {
        queryParams.append("configId", selectedConfigId);
      }
      queryParams.append("excludeActiveZeroTurns", String(excludeActiveZeroTurns));

      const res = await fetch(`${BACKEND_URL}/api/analytics/overview?${queryParams.toString()}`);
      if (!res.ok) throw new Error("Failed to load analytics statistics.");
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || "Failed to load analytics data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [selectedConfigId, excludeActiveZeroTurns]);

  const formatDuration = (seconds: number) => {
    if (!seconds) return "0s";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const toggleExpandSession = (id: string) => {
    setExpandedSessions(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleSort = (field: keyof SessionData) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const filteredSessions = (data?.sessions || []).filter(s => {
    // Status filter
    if (statusFilter && s.status !== statusFilter) {
      return false;
    }

    // Search query (Session ID or Config name)
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchId = s.id.toLowerCase().includes(q);
      const matchConfig = s.agentConfigName.toLowerCase().includes(q);
      if (!matchId && !matchConfig) {
        return false;
      }
    }

    return true;
  });

  const sortedSessions = [...filteredSessions].sort((a, b) => {
    if (!sortField) return 0;
    const aVal = a[sortField];
    const bVal = b[sortField];

    if (aVal === null || aVal === undefined) return sortAsc ? 1 : -1;
    if (bVal === null || bVal === undefined) return sortAsc ? -1 : 1;

    if (typeof aVal === "number" && typeof bVal === "number") {
      return sortAsc ? aVal - bVal : bVal - aVal;
    }
    
    const aStr = String(aVal).toLowerCase();
    const bStr = String(bVal).toLowerCase();
    if (aStr < bStr) return sortAsc ? -1 : 1;
    if (aStr > bStr) return sortAsc ? 1 : -1;
    return 0;
  });

  const renderSubStat = (stat: SubComponentStat | undefined, label: string) => {
    if (!stat) return null;
    if (stat.avgMs === null) {
      const skipReasons: Record<string, string> = {
        skipped_clock_sync_limits: "Skipped (Requires high-res clock synchronization between client and server)",
        skipped_continuous_stream: "Skipped (Continuous media routing pipeline, startup offset only)",
        skipped_out_of_process_udp: "Skipped (FFmpeg runs out-of-process writing UDP directly to Mediasoup plain transport)"
      };
      const text = skipReasons[stat.reason || ""] || "Skipped (Not cleanly measurable)";
      return (
        <div style={{ padding: "8px 12px", borderBottom: "1px solid #21262d", display: "flex", flexDirection: "column", gap: "2px" }}>
          <div style={{ fontSize: "13px", fontWeight: "600", color: "#ffffff" }}>{label}</div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", fontStyle: "italic" }}>{text}</div>
        </div>
      );
    }

    return (
      <div style={{ padding: "8px 12px", borderBottom: "1px solid #21262d", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: "13px", fontWeight: "600", color: "#ffffff" }}>{label}</div>
          {stat.note && (
            <div style={{ fontSize: "10px", color: "#ffb454", marginTop: "2px" }}>
              Note: {stat.note}
            </div>
          )}
        </div>
        <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>
          Avg: <strong style={{ color: "#ffffff" }}>{stat.avgMs}ms</strong> | p95: <strong style={{ color: "#ffffff" }}>{stat.p95Ms}ms</strong>
        </div>
      </div>
    );
  };

  return (
    <div className="container">
      <h1>Voice AI Agent Platform — Analytics Dashboard</h1>

      {/* Navigation Controls */}
      <div style={{ marginBottom: "20px", display: "flex", gap: "12px" }}>
        <Link href="/" className="btn btn-secondary">
          &larr; Back to Setup Page
        </Link>
        <Link href="/test-voice" className="btn btn-secondary">
          Go to Voice Testing Page &rarr;
        </Link>
        <Link href="/sessions" className="btn btn-secondary">
          View Session History &rarr;
        </Link>
      </div>

      {/* Interactive Filter Panel */}
      <div className="card" style={{ marginBottom: "20px", padding: "16px", backgroundColor: "#161b22" }}>
        <h3 style={{ margin: "0 0 12px 0", color: "#ffffff" }}>Filter Sessions</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "20px", alignItems: "center" }}>
          
          {/* Search Query */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: "1 1 200px" }}>
            <label style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "bold" }}>Search Session</label>
            <input
              type="text"
              placeholder="Search by ID or Config name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "6px",
                backgroundColor: "#0d1117",
                border: "1px solid var(--border-color)",
                color: "#ffffff",
                fontSize: "14px"
              }}
            />
          </div>

          {/* Config Filter */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "bold" }}>Agent Configuration</label>
            <select
              value={selectedConfigId}
              onChange={(e) => setSelectedConfigId(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "6px",
                backgroundColor: "#0d1117",
                border: "1px solid var(--border-color)",
                color: "#ffffff",
                fontSize: "14px",
                minWidth: "220px"
              }}
            >
              <option value="">All Configurations</option>
              {data?.configs?.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "bold" }}>Session Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "6px",
                backgroundColor: "#0d1117",
                border: "1px solid var(--border-color)",
                color: "#ffffff",
                fontSize: "14px",
                minWidth: "150px"
              }}
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="aborted">Aborted</option>
            </select>
          </div>

        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="card" style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontStyle: "italic" }}>
          Loading filtered metrics...
        </div>
      ) : !data ? (
        <div className="card" style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)" }}>
          No analytics data available.
        </div>
      ) : (
        <>
          {/* Lightweight top-of-page status summary bar */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "20px", padding: "12px 16px", borderRadius: "8px", backgroundColor: "#161b22", border: "1px solid var(--border-color)", marginBottom: "20px", fontSize: "14px", alignItems: "center" }}>
            <div>Total Sessions: <strong style={{ color: "#ffffff", fontSize: "16px" }}>{data.overview.totalSessions}</strong></div>
            <div style={{ color: "var(--border-color)" }}>|</div>
            <div>Active: <strong style={{ color: "#388bfd" }}>{data.overview.statusBreakdown.active}</strong></div>
            <div style={{ color: "var(--border-color)" }}>|</div>
            <div>Completed: <strong style={{ color: "#56d364" }}>{data.overview.statusBreakdown.completed}</strong></div>
            <div style={{ color: "var(--border-color)" }}>|</div>
            <div>Aborted: <strong style={{ color: "#f85149" }}>{data.overview.statusBreakdown.aborted}</strong></div>
            <div style={{ color: "var(--border-color)" }}>|</div>
            <div>Avg Duration: <strong style={{ color: "#ffffff" }}>{formatDuration(data.overview.avgDurationSeconds)}</strong></div>
            <div style={{ color: "var(--border-color)" }}>|</div>
            <div>Total LLM Tokens: <strong style={{ color: "#ffffff" }}>{data.overview.totalTokens.toLocaleString()}</strong></div>
          </div>

          {/* De-prioritized Collapsible Platform Statistics Section */}
          <div style={{ marginBottom: "24px" }}>
            <button
              className="btn btn-secondary"
              onClick={() => setShowPlatformStats(!showPlatformStats)}
              style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", fontSize: "13px" }}
            >
              {showPlatformStats ? "Hide Platform-Wide Aggregate Statistics ▲" : "Show Platform-Wide Aggregate Statistics ▼"}
            </button>

            {showPlatformStats && (
              <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "24px" }}>
                
                {/* Platform Averages Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
                  <div className="card" style={{ margin: 0, padding: "20px", backgroundColor: "#0d0f12" }}>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "bold" }}>Total Sessions</div>
                    <div style={{ fontSize: "36px", fontWeight: "bold", color: "#ffffff", marginTop: "8px" }}>{data.overview.totalSessions}</div>
                  </div>

                  <div className="card" style={{ margin: 0, padding: "20px", backgroundColor: "#0d0f12" }}>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "bold" }}>Avg Session Duration</div>
                    <div style={{ fontSize: "36px", fontWeight: "bold", color: "#ffffff", marginTop: "8px" }}>
                      {formatDuration(data.overview.avgDurationSeconds)}
                    </div>
                  </div>

                  <div className="card" style={{ margin: 0, padding: "20px", backgroundColor: "#0d0f12" }}>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "bold" }}>Total LLM Tokens</div>
                    <div style={{ fontSize: "36px", fontWeight: "bold", color: "#ffffff", marginTop: "8px" }}>{data.overview.totalTokens.toLocaleString()}</div>
                  </div>

                  <div className="card" style={{ margin: 0, padding: "20px", backgroundColor: "#0d0f12" }}>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "bold" }}>Averages per Session</div>
                    <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "6px", fontSize: "14px" }}>
                      <div>Turns: <strong style={{ color: "#ffffff" }}>{data.overview.avgTurnsPerSession}</strong></div>
                      <div>Interruptions: <strong style={{ color: "#f85149" }}>{data.overview.avgInterruptionsPerSession}</strong></div>
                      <div>Silence Nudges: <strong style={{ color: "#ffb454" }}>{data.overview.avgSilenceNudgesPerSession}</strong></div>
                      <div>Reconnects: <strong style={{ color: "#388bfd" }}>{data.overview.avgReconnectsPerSession}</strong></div>
                    </div>
                  </div>
                </div>

                {/* Reliability & Session Health Section */}
                <div className="card" style={{ margin: 0 }}>
                  <h2>Reliability & Session Health</h2>
                  <p style={{ color: "var(--text-muted)", fontSize: "14px", marginTop: "4px" }}>
                    Key indicators of system API reliability and user engagement dropouts.
                  </p>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px", marginTop: "16px" }}>
                    <div style={{ border: "1px solid var(--border-color)", borderRadius: "8px", padding: "16px", backgroundColor: "#0d0f12" }}>
                      <h4 style={{ margin: 0, color: "#ffffff" }}>Provider Error Rate</h4>
                      <div style={{ fontSize: "28px", fontWeight: "bold", color: data.overview.reliability.providerErrorRate > 0.05 ? "#f85149" : "#56d364", marginTop: "8px" }}>
                        {(data.overview.reliability.providerErrorRate * 100).toFixed(2)}%
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "8px", lineHeight: "1.5" }}>
                        <div>OpenAI API Errors: <strong>{data.overview.reliability.openaiErrorCount}</strong></div>
                        <div>Deepgram STT Errors: <strong>{data.overview.reliability.deepgramSttErrorCount}</strong></div>
                        <div>Deepgram TTS Errors: <strong>{data.overview.reliability.deepgramTtsErrorCount}</strong></div>
                      </div>
                    </div>

                    <div style={{ border: "1px solid var(--border-color)", borderRadius: "8px", padding: "16px", backgroundColor: "#0d0f12" }}>
                      <h4 style={{ margin: 0, color: "#ffffff" }}>Avg Abandonment Point</h4>
                      <div style={{ fontSize: "28px", fontWeight: "bold", color: "#ffb454", marginTop: "8px" }}>
                        Turn {data.overview.reliability.avgAbortedTurn || "—"}
                      </div>
                      <p style={{ color: "var(--text-muted)", fontSize: "12px", marginTop: "8px" }}>
                        Avg elapsed time: <strong>{data.overview.reliability.avgAbortedElapsedTimeSeconds}s</strong>
                      </p>
                    </div>

                    <div style={{ border: "1px solid var(--border-color)", borderRadius: "8px", padding: "16px", backgroundColor: "#0d0f12" }}>
                      <h4 style={{ margin: 0, color: "#ffffff" }}>Barge-in Rate (Normalized)</h4>
                      <div style={{ fontSize: "28px", fontWeight: "bold", color: "#58a6ff", marginTop: "8px" }}>
                        {(data.overview.reliability.avgBargeInRate * 100).toFixed(1)}%
                      </div>
                      <p style={{ color: "var(--text-muted)", fontSize: "12px", marginTop: "8px" }}>
                        Average interruptions per conversation turn.
                      </p>
                    </div>

                    <div style={{ border: "1px solid var(--border-color)", borderRadius: "8px", padding: "16px", backgroundColor: "#0d0f12" }}>
                      <h4 style={{ margin: 0, color: "#ffffff" }}>Silence Nudges Correlation</h4>
                      <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "6px", fontSize: "14px" }}>
                        <div>Completed Sessions: <strong style={{ color: "#56d364" }}>{data.overview.reliability.nudgeComparison.completed}</strong> avg nudges</div>
                        <div>Aborted Sessions: <strong style={{ color: "#f85149" }}>{data.overview.reliability.nudgeComparison.aborted}</strong> avg nudges</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Component Latency Metrics (STT / LLM / TTS) */}
                <div className="card" style={{ margin: 0 }}>
                  <h2>Component Processing Latencies (Own Durations)</h2>
                  <p style={{ color: "var(--text-muted)", fontSize: "14px", marginTop: "4px" }}>
                    Metrics measuring each pipeline component's actual processing time (isolated from stage handoff delays).
                  </p>
                  
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px", marginTop: "16px" }}>
                    <div style={{ border: "1px solid var(--border-color)", borderRadius: "8px", padding: "16px", backgroundColor: "#0d0f12", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                      <div>
                        <h4 style={{ margin: 0, color: "#ffffff" }}>Speech-to-Text (STT) Duration</h4>
                        <p style={{ color: "var(--text-muted)", fontSize: "12px", margin: "4px 0 12px 0" }}>Time from end of speech audio arrival to transcription resolved</p>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", marginBottom: "12px" }}>
                          <div>Average: <strong style={{ color: "#58a6ff" }}>{data.overview.latencies.stt?.avgMs || 0}ms</strong></div>
                          <div>p95: <strong style={{ color: "#ffb454" }}>{data.overview.latencies.stt?.p95Ms || 0}ms</strong></div>
                        </div>
                      </div>

                      <div style={{ marginTop: "12px", borderTop: "1px solid var(--border-color)", paddingTop: "12px" }}>
                        <button
                          onClick={() => setShowSttBreakdown(!showSttBreakdown)}
                          className="btn btn-secondary"
                          style={{ width: "100%", padding: "6px", fontSize: "12px" }}
                        >
                          {showSttBreakdown ? "Hide Breakdown ▲" : "Show Breakdown ▼"}
                        </button>

                        {showSttBreakdown && data.overview.latencies.subComponents && (
                          <div style={{ marginTop: "12px", border: "1px solid #30363d", borderRadius: "6px", backgroundColor: "#161b22", overflow: "hidden" }}>
                            {renderSubStat(data.overview.latencies.subComponents.micToMediasoup, "Mic &rarr; Mediasoup")}
                            {renderSubStat(data.overview.latencies.subComponents.mediasoupToFfmpeg, "Mediasoup &rarr; FFmpeg")}
                            {renderSubStat(data.overview.latencies.subComponents.ffmpegTranscode, "FFmpeg Transcode")}
                            {renderSubStat(data.overview.latencies.subComponents.deepgramNetworkAndEndpointing, "Deepgram Network & Endpointing")}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ border: "1px solid var(--border-color)", borderRadius: "8px", padding: "16px", backgroundColor: "#0d0f12", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                      <div>
                        <h4 style={{ margin: 0, color: "#ffffff" }}>Language Model (LLM) Duration</h4>
                        <p style={{ color: "var(--text-muted)", fontSize: "12px", margin: "4px 0 12px 0" }}>Time to generate complete response (first token to stream end)</p>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", marginBottom: "12px" }}>
                          <div>Average: <strong style={{ color: "#58a6ff" }}>{data.overview.latencies.llm?.avgMs || 0}ms</strong></div>
                          <div>p95: <strong style={{ color: "#ffb454" }}>{data.overview.latencies.llm?.p95Ms || 0}ms</strong></div>
                        </div>
                      </div>

                      <div style={{ marginTop: "12px", borderTop: "1px solid var(--border-color)", paddingTop: "12px" }}>
                        <button
                          onClick={() => setShowLlmBreakdown(!showLlmBreakdown)}
                          className="btn btn-secondary"
                          style={{ width: "100%", padding: "6px", fontSize: "12px" }}
                        >
                          {showLlmBreakdown ? "Hide Breakdown ▲" : "Show Breakdown ▼"}
                        </button>

                        {showLlmBreakdown && data.overview.latencies.subComponents && (
                          <div style={{ marginTop: "12px", border: "1px solid #30363d", borderRadius: "6px", backgroundColor: "#161b22", overflow: "hidden" }}>
                            {renderSubStat(data.overview.latencies.subComponents.networkToOpenAi, "Network to OpenAI (TTFT)")}
                            {renderSubStat(data.overview.latencies.subComponents.generation, "Generation Time")}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ border: "1px solid var(--border-color)", borderRadius: "8px", padding: "16px", backgroundColor: "#0d0f12", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                      <div>
                        <h4 style={{ margin: 0, color: "#ffffff" }}>Text-to-Speech (TTS) Duration</h4>
                        <p style={{ color: "var(--text-muted)", fontSize: "12px", margin: "4px 0 12px 0" }}>Time to synthesize completed sentence audio chunk</p>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", marginBottom: "12px" }}>
                          <div>Average: <strong style={{ color: "#58a6ff" }}>{data.overview.latencies.tts?.avgMs || 0}ms</strong></div>
                          <div>p95: <strong style={{ color: "#ffb454" }}>{data.overview.latencies.tts?.p95Ms || 0}ms</strong></div>
                        </div>
                      </div>

                      <div style={{ marginTop: "12px", borderTop: "1px solid var(--border-color)", paddingTop: "12px" }}>
                        <button
                          onClick={() => setShowTtsBreakdown(!showTtsBreakdown)}
                          className="btn btn-secondary"
                          style={{ width: "100%", padding: "6px", fontSize: "12px" }}
                        >
                          {showTtsBreakdown ? "Hide Breakdown ▲" : "Show Breakdown ▼"}
                        </button>

                        {showTtsBreakdown && data.overview.latencies.subComponents && (
                          <div style={{ marginTop: "12px", border: "1px solid #30363d", borderRadius: "6px", backgroundColor: "#161b22", overflow: "hidden" }}>
                            {renderSubStat(data.overview.latencies.subComponents.networkToDeepgramTts, "Network to Deepgram TTS")}
                            {renderSubStat(data.overview.latencies.subComponents.audioRelayToClient, "Audio Relay to Client")}
                            {renderSubStat(data.overview.latencies.subComponents.clientBufferToPlayback, "Client Buffer to Playback")}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pipeline Handoff Section */}
                <div className="card" style={{ margin: 0 }}>
                  <h2>Pipeline Handoff / Stage Transitions</h2>
                  <p style={{ color: "var(--text-muted)", fontSize: "14px", marginTop: "4px" }}>
                    Metrics measuring handoff delays and perceived response gaps between stages.
                  </p>
                  
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px", marginTop: "16px" }}>
                    <div style={{ border: "1px solid var(--border-color)", borderRadius: "8px", padding: "16px", backgroundColor: "#0d0f12" }}>
                      <h4 style={{ margin: 0, color: "#ffffff" }}>UtteranceEnd &rarr; First Token</h4>
                      <p style={{ color: "var(--text-muted)", fontSize: "12px", margin: "4px 0 12px 0" }}>Perceived silence delay until LLM first character arrives</p>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}>
                        <div>Average: <strong style={{ color: "#56d364" }}>{data.overview.latencies.utteranceEndToFirstToken.avgMs}ms</strong></div>
                        <div>p95: <strong style={{ color: "#ffb454" }}>{data.overview.latencies.utteranceEndToFirstToken.p95Ms}ms</strong></div>
                      </div>
                    </div>

                    <div style={{ border: "1px solid var(--border-color)", borderRadius: "8px", padding: "16px", backgroundColor: "#0d0f12" }}>
                      <h4 style={{ margin: 0, color: "#ffffff" }}>First Token &rarr; First Audio</h4>
                      <p style={{ color: "var(--text-muted)", fontSize: "12px", margin: "4px 0 12px 0" }}>Delay from stream start to TTS audio buffering</p>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}>
                        <div>Average: <strong style={{ color: "#56d364" }}>{data.overview.latencies.firstTokenToFirstAudio.avgMs}ms</strong></div>
                        <div>p95: <strong style={{ color: "#ffb454" }}>{data.overview.latencies.firstTokenToFirstAudio.p95Ms}ms</strong></div>
                      </div>
                    </div>

                    <div style={{ border: "1px solid var(--border-color)", borderRadius: "8px", padding: "16px", backgroundColor: "#0d0f12" }}>
                      <h4 style={{ margin: 0, color: "#ffffff" }}>Total Turn Runtime</h4>
                      <p style={{ color: "var(--text-muted)", fontSize: "12px", margin: "4px 0 12px 0" }}>Total conversational turn delay including browser playback</p>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}>
                        <div>Average: <strong style={{ color: "#56d364" }}>{data.overview.latencies.totalTurn.avgMs}ms</strong></div>
                        <div>p95: <strong style={{ color: "#ffb454" }}>{data.overview.latencies.totalTurn.p95Ms}ms</strong></div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* Primary detailed Sessions list view */}
          <div className="card">
            <h2>Detailed Sessions Overview</h2>
            <p style={{ color: "var(--text-muted)", fontSize: "14px", margin: "4px 0 16px 0" }}>
              Showing {sortedSessions.length} sessions matching filters. Click a session row to expand all metrics for that specific session.
            </p>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--border-color)", textAlign: "left" }}>
                    <th style={{ padding: "12px 8px", width: "30px" }}></th>
                    <th
                      style={{ padding: "12px 8px", color: "var(--text-muted)", fontSize: "13px", cursor: "pointer", userSelect: "none" }}
                      onClick={() => handleSort("id")}
                    >
                      Session ID {sortField === "id" ? (sortAsc ? "▲" : "▼") : ""}
                    </th>
                    <th
                      style={{ padding: "12px 8px", color: "var(--text-muted)", fontSize: "13px", cursor: "pointer", userSelect: "none" }}
                      onClick={() => handleSort("agentConfigName")}
                    >
                      Agent Config {sortField === "agentConfigName" ? (sortAsc ? "▲" : "▼") : ""}
                    </th>
                    <th
                      style={{ padding: "12px 8px", color: "var(--text-muted)", fontSize: "13px", cursor: "pointer", userSelect: "none" }}
                      onClick={() => handleSort("status")}
                    >
                      Status {sortField === "status" ? (sortAsc ? "▲" : "▼") : ""}
                    </th>
                    <th
                      style={{ padding: "12px 8px", color: "var(--text-muted)", fontSize: "13px", textAlign: "right", cursor: "pointer", userSelect: "none" }}
                      onClick={() => handleSort("turnsCount")}
                    >
                      Turns {sortField === "turnsCount" ? (sortAsc ? "▲" : "▼") : ""}
                    </th>
                    <th style={{ padding: "12px 8px", color: "var(--text-muted)", fontSize: "13px", textAlign: "right" }}>
                      STT / LLM / TTS Latency (Avg)
                    </th>
                    <th
                      style={{ padding: "12px 8px", color: "var(--text-muted)", fontSize: "13px", textAlign: "right", cursor: "pointer", userSelect: "none" }}
                      onClick={() => handleSort("avgTurnLatencyMs")}
                    >
                      Total Turn (Avg) {sortField === "avgTurnLatencyMs" ? (sortAsc ? "▲" : "▼") : ""}
                    </th>
                    <th
                      style={{ padding: "12px 8px", color: "var(--text-muted)", fontSize: "13px", textAlign: "right", cursor: "pointer", userSelect: "none" }}
                      onClick={() => handleSort("totalTokensUsed")}
                    >
                      Tokens {sortField === "totalTokensUsed" ? (sortAsc ? "▲" : "▼") : ""}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSessions.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: "24px 8px", textAlign: "center", color: "var(--text-muted)" }}>
                        No sessions match current search query or status criteria.
                      </td>
                    </tr>
                  ) : (
                    sortedSessions.map((s) => {
                      const statusColors: Record<string, string> = {
                        active: "#388bfd",
                        completed: "#56d364",
                        aborted: "#f85149"
                      };
                      const isExpanded = !!expandedSessions[s.id];

                      return (
                        <React.Fragment key={s.id}>
                          <tr
                            onClick={() => toggleExpandSession(s.id)}
                            style={{
                              borderBottom: isExpanded ? "none" : "1px solid var(--border-color)",
                              fontSize: "14px",
                              cursor: "pointer",
                              backgroundColor: isExpanded ? "#161b2255" : "transparent",
                              transition: "background-color 0.2s ease"
                            }}
                          >
                            <td style={{ padding: "12px 8px", color: "var(--text-muted)", textAlign: "center", fontSize: "10px" }}>
                              {isExpanded ? "▼" : "▶"}
                            </td>
                            <td style={{ padding: "12px 8px" }}>
                              <Link
                                href={`/sessions/${s.id}`}
                                style={{ color: "#58a6ff", fontWeight: "600", textDecoration: "none" }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {s.id.slice(0, 8)}...
                              </Link>
                            </td>
                            <td style={{ padding: "12px 8px", color: "#ffffff", fontWeight: "600" }}>{s.agentConfigName}</td>
                            <td style={{ padding: "12px 8px" }}>
                              <span style={{
                                display: "inline-block",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                backgroundColor: (statusColors[s.status] || "var(--text-muted)") + "22",
                                color: statusColors[s.status] || "var(--text-muted)",
                                fontSize: "12px",
                                fontWeight: "bold",
                                textTransform: "capitalize"
                              }}>
                                {s.status}
                              </span>
                            </td>
                            <td style={{ padding: "12px 8px", textAlign: "right", color: "#ffffff" }}>{s.turnsCount}</td>
                            <td style={{ padding: "12px 8px", textAlign: "right", color: "var(--text-muted)", fontSize: "12px" }}>
                              {s.turnsCount > 0 ? (
                                <>
                                  STT: <span style={{ color: "#58a6ff", fontWeight: "bold" }}>{s.avgSttLatencyMs}ms</span> |{" "}
                                  LLM: <span style={{ color: "#56d364", fontWeight: "bold" }}>{s.avgLlmLatencyMs}ms</span> |{" "}
                                  TTS: <span style={{ color: "#ffb454", fontWeight: "bold" }}>{s.avgTtsLatencyMs}ms</span>
                                </>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td style={{ padding: "12px 8px", textAlign: "right", fontWeight: "bold", color: "#56d364" }}>
                              {s.avgTurnLatencyMs > 0 ? `${s.avgTurnLatencyMs}ms` : "—"}
                            </td>
                            <td style={{ padding: "12px 8px", textAlign: "right", color: "#ffffff" }}>
                              {s.totalTokensUsed > 0 ? s.totalTokensUsed.toLocaleString() : "—"}
                            </td>
                          </tr>

                          {/* Expanded detailed stats panel for this session */}
                          {isExpanded && (
                            <tr style={{ backgroundColor: "#161b2255" }}>
                              <td colSpan={8} style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-color)" }}>
                                <div style={{
                                  display: "grid",
                                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                                  gap: "20px"
                                }}>
                                  
                                  {/* Session Status & Health */}
                                  <div style={{ backgroundColor: "#0d1117", padding: "14px", borderRadius: "6px", border: "1px solid var(--border-color)" }}>
                                    <h4 style={{ margin: "0 0 10px 0", color: "#58a6ff", fontSize: "14px" }}>Status & Health</h4>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "var(--text-muted)" }}>
                                      <div>Status: <span style={{ color: statusColors[s.status], fontWeight: "bold" }}>{s.status.toUpperCase()}</span></div>
                                      {s.status === "aborted" && (
                                        <>
                                          <div>Aborted At: <strong style={{ color: "#ffffff" }}>Turn {s.abortedAtTurn ?? "—"}</strong></div>
                                          <div>Elapsed Time: <strong style={{ color: "#ffffff" }}>{s.abortedElapsedTimeMs ? formatDuration(Math.round(s.abortedElapsedTimeMs / 1000)) : "—"}</strong></div>
                                        </>
                                      )}
                                      <div>Provider Errors: <strong style={{ color: s.providerErrorsCount > 0 ? "#f85149" : "#56d364" }}>{s.providerErrorsCount}</strong></div>
                                      <div>Total Tokens Used: <strong style={{ color: "#ffffff" }}>{s.totalTokensUsed.toLocaleString()}</strong></div>
                                    </div>
                                  </div>

                                  {/* Interaction Details */}
                                  <div style={{ backgroundColor: "#0d1117", padding: "14px", borderRadius: "6px", border: "1px solid var(--border-color)" }}>
                                    <h4 style={{ margin: "0 0 10px 0", color: "#58a6ff", fontSize: "14px" }}>Interaction details</h4>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "var(--text-muted)" }}>
                                      <div>Total turns: <strong style={{ color: "#ffffff" }}>{s.turnsCount}</strong></div>
                                      <div>Interruptions (Barge-ins): <strong style={{ color: s.interruptionsCount > 0 ? "#f85149" : "#ffffff" }}>{s.interruptionsCount}</strong></div>
                                      <div>Silence nudges: <strong style={{ color: s.silenceNudgesCount > 0 ? "#ffb454" : "#ffffff" }}>{s.silenceNudgesCount}</strong></div>
                                      <div>Reconnects: <strong style={{ color: s.reconnectsCount > 0 ? "#58a6ff" : "#ffffff" }}>{s.reconnectsCount}</strong></div>
                                    </div>
                                  </div>

                                  {/* Pipeline Handoff */}
                                  <div style={{ backgroundColor: "#0d1117", padding: "14px", borderRadius: "6px", border: "1px solid var(--border-color)" }}>
                                    <h4 style={{ margin: "0 0 10px 0", color: "#58a6ff", fontSize: "14px" }}>Pipeline Handoff (Avg)</h4>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "var(--text-muted)" }}>
                                      <div>Speech end &rarr; First token: <strong style={{ color: "#ffffff" }}>{s.turnsCount > 0 ? `${s.avgUtteranceEndToFirstTokenMs}ms` : "—"}</strong></div>
                                      <div>First token &rarr; First audio: <strong style={{ color: "#ffffff" }}>{s.turnsCount > 0 ? `${s.avgFirstTokenToFirstAudioMs}ms` : "—"}</strong></div>
                                      <div>Total turn runtime: <strong style={{ color: "#56d364" }}>{s.avgTurnLatencyMs > 0 ? `${s.avgTurnLatencyMs}ms` : "—"}</strong></div>
                                    </div>
                                  </div>

                                  {/* Component Durations */}
                                  <div style={{ backgroundColor: "#0d1117", padding: "14px", borderRadius: "6px", border: "1px solid var(--border-color)" }}>
                                    <h4 style={{ margin: "0 0 10px 0", color: "#58a6ff", fontSize: "14px" }}>Component Durations (Avg)</h4>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "var(--text-muted)" }}>
                                      <div>STT Processing: <strong style={{ color: "#ffffff" }}>{s.turnsCount > 0 ? `${s.avgSttLatencyMs}ms` : "—"}</strong></div>
                                      <div>LLM Generation: <strong style={{ color: "#ffffff" }}>{s.turnsCount > 0 ? `${s.avgLlmLatencyMs}ms` : "—"}</strong></div>
                                      <div>TTS Synthesis: <strong style={{ color: "#ffffff" }}>{s.turnsCount > 0 ? `${s.avgTtsLatencyMs}ms` : "—"}</strong></div>
                                    </div>
                                  </div>

                                </div>

                                {/* Collapsible Latency Sub-Breakdown Section */}
                                {s.turnsCount > 0 && (
                                  <details style={{ marginTop: "16px", padding: "12px", border: "1px solid var(--border-color)", borderRadius: "6px", backgroundColor: "#0d1117" }}>
                                    <summary style={{ cursor: "pointer", color: "#58a6ff", fontSize: "13px", fontWeight: "600", outline: "none", userSelect: "none" }}>
                                      Pipeline Latency Breakdown (5 Key Parts)
                                    </summary>
                                    <div style={{
                                      display: "grid",
                                      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                                      gap: "12px",
                                      marginTop: "12px",
                                      fontSize: "13px",
                                      color: "var(--text-muted)"
                                    }}>
                                      <div>
                                        <div style={{ fontWeight: "600", color: "#ffffff", marginBottom: "2px" }}>1. Deepgram Wait Time</div>
                                        <div>avgDeepgramWaitMs: <strong>{s.avgDeepgramWaitMs}ms</strong></div>
                                        <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "2px" }}>Configured endpointing + silence wait</div>
                                      </div>
                                      <div>
                                        <div style={{ fontWeight: "600", color: "#ffffff", marginBottom: "2px" }}>2. STT Compute & Network</div>
                                        <div>avgSttNetworkAndComputeMs: <strong>{s.avgSttNetworkAndComputeMs}ms</strong></div>
                                        <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "2px" }}>Speech transcode and resolve transit</div>
                                        <div style={{ marginTop: "6px", paddingLeft: "8px", borderLeft: "2px solid #30363d", display: "flex", flexDirection: "column", gap: "2px", fontSize: "11px" }}>
                                          <div>mediasoup &rarr; ffmpeg: <strong style={{ color: "#ffffff" }}>{s.avgMediasoupToFfmpegMs !== null ? `${s.avgMediasoupToFfmpegMs}ms` : "skipped (continuous)"}</strong></div>
                                          <div>ffmpeg transcode: <strong style={{ color: "#ffffff" }}>{s.avgFfmpegTranscodeMs !== null ? `${s.avgFfmpegTranscodeMs}ms` : "skipped (continuous)"}</strong></div>
                                          <div>deepgram network/compute: <strong style={{ color: "#58a6ff" }}>{s.avgDeepgramNetworkAndComputeMs}ms</strong></div>
                                          <div style={{ marginTop: "4px", paddingLeft: "8px", borderLeft: "2px solid #58a6ff", display: "flex", flexDirection: "column", gap: "2px", fontSize: "10px", color: "var(--text-muted)" }}>
                                            <div>local pipeline: <strong style={{ color: "#ffffff" }}>{s.avgLocalPipelineMs}ms</strong></div>
                                            <div>deepgram network rtt: <strong style={{ color: "#ffffff" }}>{s.avgDeepgramNetworkRttMs}ms</strong></div>
                                            <div>deepgram processing: <strong style={{ color: "#ffffff" }}>{s.avgDeepgramProcessingMs}ms</strong></div>
                                            <div>interim updates: <strong style={{ color: "#ffffff" }}>{s.avgInterimTranscriptCount}</strong></div>
                                          </div>
                                        </div>
                                      </div>
                                      <div>
                                        <div style={{ fontWeight: "600", color: "#ffffff", marginBottom: "2px" }}>3. LLM Network Delay (TTFT)</div>
                                        <div>avgLlmNetworkMs: <strong>{s.avgLlmNetworkMs}ms</strong></div>
                                        <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "2px" }}>Send prompt to OpenAI first byte</div>
                                      </div>
                                      <div>
                                        <div style={{ fontWeight: "600", color: "#ffffff", marginBottom: "2px" }}>4. LLM Generation Time</div>
                                        <div>avgLlmGenerationMs: <strong>{s.avgLlmGenerationMs}ms</strong></div>
                                        <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "2px" }}>OpenAI first byte to complete response</div>
                                      </div>
                                      <div>
                                        <div style={{ fontWeight: "600", color: "#ffffff", marginBottom: "2px" }}>5. TTS Network & Synthesis</div>
                                        <div>avgTtsNetworkAndSynthesisMs: <strong>{s.avgTtsNetworkAndSynthesisMs}ms</strong></div>
                                        <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "2px" }}>Aura model synthesis turnaround</div>
                                      </div>
                                    </div>
                                  </details>
                                )}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
