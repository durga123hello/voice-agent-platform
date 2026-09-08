"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
  Eye, 
  EyeOff,
  Pencil, 
  Trash2, 
  Bot,
  Key,
  Copy,
  Check,
  Cpu,
  Layers,
  Hash
} from "lucide-react";
import { AIAgent, AgentStatus } from "../../types/agent";
import { Button } from "../ui/button";

interface AgentsTableProps {
  agents: AIAgent[];
  onDeleteAgent?: (id: string) => void;
  onViewAgent?: (agent: AIAgent) => void;
}

export function AgentsTable({
  agents,
  onDeleteAgent,
  onViewAgent,
}: AgentsTableProps) {
  // State for revealed API keys (keyed by agent ID)
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  const toggleRevealKey = (id: string) => {
    setRevealedKeys((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const copyApiKey = (key: string, id: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKeyId(id);
    setTimeout(() => setCopiedKeyId(null), 1500);
  };

  const maskKey = (key: string) => {
    if (!key) return "••••••••••••••••";
    if (key.length <= 8) return "••••••••";
    return `••••••••••••${key.slice(-4)}`;
  };

  const renderStatus = (status: AgentStatus) => {
    switch (status) {
      case "Active":
        return (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
            Active
          </div>
        );
      case "Training":
        return (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800/60">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-500 animate-pulse shrink-0" />
            Training
          </div>
        );
      case "Testing":
        return (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/60">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
            Testing
          </div>
        );
      case "Inactive":
        return (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0" />
            Inactive
          </div>
        );
      default:
        return <span>{status}</span>;
    }
  };

  const renderProviderBadge = (provider: string) => {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800/60">
        <Cpu className="h-3 w-3 text-teal-600 dark:text-teal-400" />
        {provider}
      </span>
    );
  };

  if (agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-700/10 text-teal-800 dark:bg-teal-500/15 dark:text-teal-300 border border-teal-500/20 mb-3">
          <Bot className="h-6 w-6" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">No AI agents found</h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">
          No agent matches your criteria. Configure your first LLM voice persona to get started.
        </p>
        <Button asChild size="sm" className="mt-4 gap-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs">
          <Link href="/agents/create">
            <Bot className="h-3.5 w-3.5" />
            <span>Create Agent</span>
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
      <div className="overflow-x-auto custom-scrollbar relative">
        <table className="w-full border-separate border-spacing-0 text-left text-xs min-w-[1240px]">
          {/* Table Header */}
          <thead>
            <tr className="bg-muted font-semibold text-muted-foreground">
              {/* 1. STICKY LEFT: Agent Name */}
              <th 
                scope="col"
                className="sticky left-0 z-40 py-3.5 pl-4 pr-6 bg-slate-100 dark:bg-slate-900 border-b border-r border-border shadow-[6px_0_16px_-4px_rgba(0,0,0,0.15)] dark:shadow-[6px_0_20px_-4px_rgba(0,0,0,0.7)] w-[220px] min-w-[220px]"
              >
                Agent Name
              </th>

              {/* 2. Agent ID */}
              <th scope="col" className="py-3.5 px-4 min-w-[130px] border-b border-border bg-slate-50/80 dark:bg-slate-900/60">
                Agent ID
              </th>

              {/* 3. Provider */}
              <th scope="col" className="py-3.5 px-4 min-w-[160px] border-b border-border bg-slate-50/80 dark:bg-slate-900/60">
                LLM Provider
              </th>

              {/* 4. Available Models */}
              <th scope="col" className="py-3.5 px-4 min-w-[260px] border-b border-border bg-slate-50/80 dark:bg-slate-900/60">
                Available Models
              </th>

              {/* 5. Status */}
              <th scope="col" className="py-3.5 px-4 min-w-[130px] border-b border-border bg-slate-50/80 dark:bg-slate-900/60">
                Status
              </th>

              {/* 6. API Key */}
              <th scope="col" className="py-3.5 px-4 min-w-[240px] border-b border-border bg-slate-50/80 dark:bg-slate-900/60">
                API Key
              </th>

              {/* 7. STICKY RIGHT: Actions */}
              <th 
                scope="col"
                className="sticky right-0 z-40 py-3.5 px-3 text-center bg-slate-100 dark:bg-slate-900 border-b border-l border-border shadow-[-6px_0_16px_-4px_rgba(0,0,0,0.15)] dark:shadow-[-6px_0_20px_-4px_rgba(0,0,0,0.7)] w-[130px] min-w-[130px]"
              >
                Actions
              </th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody>
            {agents.map((agent) => {
              const isRevealed = Boolean(revealedKeys[agent.id]);
              return (
                <tr 
                  key={agent.id}
                  className="group transition-colors"
                >
                  {/* 1. STICKY LEFT: Agent Name */}
                  <td className="sticky left-0 z-30 py-3 pl-4 pr-6 bg-white dark:bg-slate-950 group-hover:bg-slate-50 dark:group-hover:bg-slate-900 border-b border-r border-border shadow-[6px_0_16px_-4px_rgba(0,0,0,0.15)] dark:shadow-[6px_0_20px_-4px_rgba(0,0,0,0.7)] transition-colors w-[220px] min-w-[220px]">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-700/10 text-teal-800 dark:bg-teal-500/15 dark:text-teal-300 border border-teal-500/20 shrink-0">
                        <Bot className="h-4 w-4" />
                      </div>

                      <div className="flex flex-col min-w-0">
                        <span className="font-semibold text-foreground truncate text-xs sm:text-[13px] group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors">
                          {agent.name}
                        </span>
                        <span className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {agent.createdAt}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* 2. Agent ID */}
                  <td className="py-3 px-4 whitespace-nowrap min-w-[130px] border-b border-border bg-card group-hover:bg-muted/40 transition-colors">
                    <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold px-2 py-0.5 rounded bg-muted/60 text-foreground border border-border">
                      <Hash className="h-3 w-3 text-muted-foreground" />
                      {agent.agentId}
                    </span>
                  </td>

                  {/* 3. Provider */}
                  <td className="py-3 px-4 whitespace-nowrap min-w-[160px] border-b border-border bg-card group-hover:bg-muted/40 transition-colors">
                    {renderProviderBadge(agent.provider)}
                  </td>

                  {/* 4. Available Models */}
                  <td className="py-3 px-4 min-w-[260px] border-b border-border bg-card group-hover:bg-muted/40 transition-colors">
                    <div className="flex flex-wrap gap-1.5">
                      {agent.availableModels.split(",").map((m, idx) => (
                        <span 
                          key={idx}
                          className="font-mono text-[11px] px-2 py-0.5 rounded bg-muted/50 text-foreground/90 border border-border/60 truncate"
                        >
                          {m.trim()}
                        </span>
                      ))}
                    </div>
                  </td>

                  {/* 5. Status */}
                  <td className="py-3 px-4 whitespace-nowrap min-w-[130px] border-b border-border bg-card group-hover:bg-muted/40 transition-colors">
                    {renderStatus(agent.status)}
                  </td>

                  {/* 6. API Key with Reveal / Copy */}
                  <td className="py-3 px-4 whitespace-nowrap min-w-[240px] border-b border-border bg-card group-hover:bg-muted/40 transition-colors">
                    <div className="flex items-center gap-2 font-mono text-xs bg-muted/40 px-2.5 py-1 rounded-md border border-border/70 max-w-[220px]">
                      <Key className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                      <span className="truncate flex-1 font-medium text-foreground">
                        {isRevealed ? agent.apiKey : maskKey(agent.apiKey)}
                      </span>
                      
                      <button
                        type="button"
                        onClick={() => toggleRevealKey(agent.id)}
                        className="text-muted-foreground hover:text-foreground p-0.5"
                        title={isRevealed ? "Hide API key" : "Show API key"}
                      >
                        {isRevealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => copyApiKey(agent.apiKey, agent.id)}
                        className="text-muted-foreground hover:text-foreground p-0.5"
                        title="Copy API key"
                      >
                        {copiedKeyId === agent.id ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </td>

                  {/* 7. STICKY RIGHT: Actions */}
                  <td className="sticky right-0 z-30 py-3 px-3 text-center bg-white dark:bg-slate-950 group-hover:bg-slate-50 dark:group-hover:bg-slate-900 border-b border-l border-border shadow-[-6px_0_16px_-4px_rgba(0,0,0,0.15)] dark:shadow-[-6px_0_20px_-4px_rgba(0,0,0,0.7)] transition-colors w-[130px] min-w-[130px]">
                    <div className="flex items-center justify-center gap-1">
                      {/* View Details */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-teal-700 dark:hover:text-teal-400 hover:bg-teal-500/10"
                        onClick={() => onViewAgent && onViewAgent(agent)}
                        title="View agent details"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span className="sr-only">View</span>
                      </Button>

                      {/* Edit Agent */}
                      <Button
                        variant="ghost"
                        size="icon"
                        asChild
                        className="h-7 w-7 text-muted-foreground hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-500/10"
                        title="Edit agent"
                      >
                        <Link href={`/agents/create?edit=${agent.id}`}>
                          <Pencil className="h-3.5 w-3.5" />
                          <span className="sr-only">Edit</span>
                        </Link>
                      </Button>

                      {/* Delete Agent */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10"
                        onClick={() => onDeleteAgent && onDeleteAgent(agent.id)}
                        title="Delete agent"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
