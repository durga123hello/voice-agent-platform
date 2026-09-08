"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AIAgent, AgentStatus } from "../../types/agent";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "../ui/dialog";
import { Button } from "../ui/button";
import { 
  Bot,
  Key, 
  Copy, 
  Check, 
  Calendar, 
  Pencil, 
  Hash,
  Cpu,
  Sliders,
  Eye,
  EyeOff
} from "lucide-react";

interface AgentDetailsModalProps {
  agent: AIAgent | null;
  isOpen: boolean;
  onClose: () => void;
}

export function AgentDetailsModal({
  agent,
  isOpen,
  onClose,
}: AgentDetailsModalProps) {
  const [copiedKey, setCopiedKey] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);

  if (!agent) return null;

  const copyApiKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 1500);
  };

  const renderStatusBadge = (status: AgentStatus) => {
    switch (status) {
      case "Active":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60">
            <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
            Active
          </span>
        );
      case "Training":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800/60">
            <span className="h-2 w-2 rounded-full bg-purple-500 animate-pulse shrink-0" />
            Training
          </span>
        );
      case "Testing":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/60">
            <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
            Testing
          </span>
        );
      case "Inactive":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700">
            <span className="h-2 w-2 rounded-full bg-slate-400 shrink-0" />
            Inactive
          </span>
        );
      default:
        return <span>{status}</span>;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg p-6">
        {/* Header */}
        <DialogHeader className="pb-3 border-b border-border/70">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-700/10 text-teal-800 dark:bg-teal-500/15 dark:text-teal-300 border border-teal-500/20 shrink-0 shadow-sm">
              <Bot className="h-6 w-6" />
            </div>

            <div>
              <DialogTitle className="text-lg font-bold text-foreground">
                {agent.name}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded border border-border">
                  <Hash className="h-3 w-3 text-muted-foreground" />
                  {agent.agentId}
                </span>
                {renderStatusBadge(agent.status)}
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Content sections */}
        <div className="space-y-4 py-2 text-xs">
          {/* Provider & Available Models */}
          <div className="space-y-2">
            <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400" />
              LLM Architecture & Model Routing
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-muted/30 p-3 rounded-lg border border-border/60">
              <div>
                <span className="text-[10px] text-muted-foreground block">Primary Provider</span>
                <span className="font-semibold text-foreground flex items-center gap-1.5 mt-1">
                  <Cpu className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                  {agent.provider}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-muted-foreground block">Temperature Setting</span>
                <span className="font-mono text-foreground flex items-center gap-1.5 mt-1">
                  <Sliders className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                  {agent.temperature ?? 0.3}
                </span>
              </div>

              <div className="sm:col-span-2 pt-1 border-t border-border/40">
                <span className="text-[10px] text-muted-foreground block mb-1">Available Models</span>
                <div className="flex flex-wrap gap-1.5">
                  {agent.availableModels.split(",").map((m, idx) => (
                    <span 
                      key={idx}
                      className="font-mono text-[11px] px-2 py-0.5 rounded bg-card text-foreground font-medium border border-border"
                    >
                      {m.trim()}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* API Key */}
          <div className="space-y-1.5">
            <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Key className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400" />
              Provider Credentials
            </h4>
            <div className="flex items-center justify-between gap-2 bg-muted/40 p-3 rounded-lg border border-border/60 font-mono text-xs">
              <span className="truncate flex-1 font-medium text-foreground">
                {isRevealed ? agent.apiKey : `••••••••••••••••${agent.apiKey.slice(-4)}`}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsRevealed(!isRevealed)}
                  className="p-1 text-muted-foreground hover:text-foreground rounded"
                  title={isRevealed ? "Hide key" : "Reveal key"}
                >
                  {isRevealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => copyApiKey(agent.apiKey)}
                  className="p-1 text-muted-foreground hover:text-foreground rounded"
                  title="Copy API key"
                >
                  {copiedKey ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* System Prompt */}
          {agent.systemPrompt && (
            <div className="space-y-1.5">
              <span className="text-[10px] text-muted-foreground block">System Prompt / Persona Instructions</span>
              <div className="bg-muted/30 p-3 rounded-lg border border-border/60 text-foreground leading-relaxed font-mono text-[11px]">
                {agent.systemPrompt}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="flex items-center gap-2 text-muted-foreground text-[11px]">
            <Calendar className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
            <span>Configured on {agent.createdAt}</span>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="pt-3 border-t border-border flex items-center justify-between sm:justify-between">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            Close
          </Button>

          <Button
            asChild
            size="sm"
            className="text-xs gap-1.5 bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white font-medium"
          >
            <Link href={`/agents/create?edit=${agent.id}`}>
              <Pencil className="h-3.5 w-3.5" />
              <span>Edit Agent</span>
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
