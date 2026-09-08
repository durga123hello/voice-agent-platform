"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
  Eye, 
  EyeOff,
  Pencil, 
  Trash2, 
  Layers,
  Key,
  Copy,
  Check,
  Cpu,
  Mic,
  Volume2,
  Hash,
  Activity
} from "lucide-react";
import { Integration, IntegrationStatus, IntegrationCategory } from "../../types/integration";
import { Button } from "../ui/button";

interface IntegrationsTableProps {
  integrations: Integration[];
  onDeleteIntegration?: (id: string) => void;
  onViewIntegration?: (integration: Integration) => void;
}

export function IntegrationsTable({
  integrations,
  onDeleteIntegration,
  onViewIntegration,
}: IntegrationsTableProps) {
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

  const renderCategoryBadge = (category: IntegrationCategory) => {
    switch (category) {
      case "STT Agent":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60">
            <Mic className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
            STT Agent
          </span>
        );
      case "TTS Agent":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/60">
            <Volume2 className="h-3 w-3 text-blue-600 dark:text-blue-400 shrink-0" />
            TTS Agent
          </span>
        );
      case "LLM Provider":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800/60">
            <Cpu className="h-3 w-3 text-teal-600 dark:text-teal-400 shrink-0" />
            LLM Provider
          </span>
        );
      default:
        return <span>{category}</span>;
    }
  };

  const renderStatus = (status: IntegrationStatus) => {
    switch (status) {
      case "Active":
        return (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
            Active
          </div>
        );
      case "Connected":
        return (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800/60">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-500 shrink-0" />
            Connected
          </div>
        );
      case "Ready":
        return (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/60">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
            Ready
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

  const renderCategoryIcon = (category: IntegrationCategory) => {
    switch (category) {
      case "STT Agent":
        return <Mic className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
      case "TTS Agent":
        return <Volume2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
      case "LLM Provider":
        return <Cpu className="h-4 w-4 text-teal-600 dark:text-teal-400" />;
      default:
        return <Layers className="h-4 w-4 text-teal-600" />;
    }
  };

  if (integrations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-700/10 text-teal-800 dark:bg-teal-500/15 dark:text-teal-300 border border-teal-500/20 mb-3">
          <Layers className="h-6 w-6" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">No integrations found</h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">
          No integration matches your criteria. Connect your first STT, TTS, or LLM provider to get started.
        </p>
        <Button asChild size="sm" className="mt-4 gap-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs">
          <Link href="/integrations/create">
            <Layers className="h-3.5 w-3.5" />
            <span>Add Integration</span>
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
      <div className="overflow-x-auto custom-scrollbar relative">
        <table className="w-full border-separate border-spacing-0 text-left text-xs min-w-[1260px]">
          {/* Table Header */}
          <thead>
            <tr className="bg-muted font-semibold text-muted-foreground">
              {/* 1. STICKY LEFT: Integration Name */}
              <th 
                scope="col"
                className="sticky left-0 z-40 py-3.5 pl-4 pr-6 bg-slate-100 dark:bg-slate-900 border-b border-r border-border shadow-[6px_0_16px_-4px_rgba(0,0,0,0.15)] dark:shadow-[6px_0_20px_-4px_rgba(0,0,0,0.7)] w-[240px] min-w-[240px]"
              >
                Integration Name
              </th>

              {/* 2. Integration ID */}
              <th scope="col" className="py-3.5 px-4 min-w-[130px] border-b border-border bg-slate-50/80 dark:bg-slate-900/60">
                ID
              </th>

              {/* 3. Category */}
              <th scope="col" className="py-3.5 px-4 min-w-[150px] border-b border-border bg-slate-50/80 dark:bg-slate-900/60">
                Category
              </th>

              {/* 4. Provider Vendor */}
              <th scope="col" className="py-3.5 px-4 min-w-[160px] border-b border-border bg-slate-50/80 dark:bg-slate-900/60">
                Provider Vendor
              </th>

              {/* 5. Available Models */}
              <th scope="col" className="py-3.5 px-4 min-w-[260px] border-b border-border bg-slate-50/80 dark:bg-slate-900/60">
                Available Models & Specs
              </th>

              {/* 6. Status */}
              <th scope="col" className="py-3.5 px-4 min-w-[130px] border-b border-border bg-slate-50/80 dark:bg-slate-900/60">
                Status
              </th>

              {/* 7. API Key */}
              <th scope="col" className="py-3.5 px-4 min-w-[240px] border-b border-border bg-slate-50/80 dark:bg-slate-900/60">
                API Key Credentials
              </th>

              {/* 8. STICKY RIGHT: Actions */}
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
            {integrations.map((item) => {
              const isRevealed = Boolean(revealedKeys[item.id]);
              return (
                <tr 
                  key={item.id}
                  className="group transition-colors"
                >
                  {/* 1. STICKY LEFT: Integration Name */}
                  <td className="sticky left-0 z-30 py-3 pl-4 pr-6 bg-white dark:bg-slate-950 group-hover:bg-slate-50 dark:group-hover:bg-slate-900 border-b border-r border-border shadow-[6px_0_16px_-4px_rgba(0,0,0,0.15)] dark:shadow-[6px_0_20px_-4px_rgba(0,0,0,0.7)] transition-colors w-[240px] min-w-[240px]">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-700/10 dark:bg-teal-500/15 border border-teal-500/20 shrink-0">
                        {renderCategoryIcon(item.category)}
                      </div>

                      <div className="flex flex-col min-w-0">
                        <span className="font-semibold text-foreground truncate text-xs sm:text-[13px] group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors">
                          {item.name}
                        </span>
                        {item.latency && (
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Activity className="h-3 w-3 text-teal-600 dark:text-teal-400" />
                            <span>Avg Latency: {item.latency}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* 2. Integration ID */}
                  <td className="py-3 px-4 whitespace-nowrap min-w-[130px] border-b border-border bg-card group-hover:bg-muted/40 transition-colors">
                    <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold px-2 py-0.5 rounded bg-muted/60 text-foreground border border-border">
                      <Hash className="h-3 w-3 text-muted-foreground" />
                      {item.integrationId}
                    </span>
                  </td>

                  {/* 3. Category */}
                  <td className="py-3 px-4 whitespace-nowrap min-w-[150px] border-b border-border bg-card group-hover:bg-muted/40 transition-colors">
                    {renderCategoryBadge(item.category)}
                  </td>

                  {/* 4. Provider Vendor */}
                  <td className="py-3 px-4 whitespace-nowrap min-w-[160px] border-b border-border bg-card group-hover:bg-muted/40 transition-colors">
                    <span className="font-semibold text-foreground">
                      {item.provider}
                    </span>
                  </td>

                  {/* 5. Available Models */}
                  <td className="py-3 px-4 max-w-[280px] border-b border-border bg-card group-hover:bg-muted/40 transition-colors">
                    <div className="font-mono text-[11px] text-muted-foreground bg-muted/30 px-2 py-1 rounded border border-border/60 truncate" title={item.availableModels}>
                      {item.availableModels}
                    </div>
                  </td>

                  {/* 6. Status */}
                  <td className="py-3 px-4 whitespace-nowrap min-w-[130px] border-b border-border bg-card group-hover:bg-muted/40 transition-colors">
                    {renderStatus(item.status)}
                  </td>

                  {/* 7. API Key */}
                  <td className="py-3 px-4 whitespace-nowrap min-w-[240px] border-b border-border bg-card group-hover:bg-muted/40 transition-colors">
                    <div className="inline-flex items-center gap-1.5 bg-muted/40 dark:bg-slate-900/60 p-1 rounded-md border border-border max-w-[230px]">
                      <Key className="h-3.5 w-3.5 text-muted-foreground shrink-0 pl-0.5" />
                      <span className="font-mono text-[11px] truncate flex-1 select-all text-foreground">
                        {isRevealed ? item.apiKey : maskKey(item.apiKey)}
                      </span>

                      {/* Toggle Reveal */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-foreground shrink-0"
                        onClick={() => toggleRevealKey(item.id)}
                        title={isRevealed ? "Hide API key" : "Show API key"}
                      >
                        {isRevealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </Button>

                      {/* Copy Key */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-teal-700 dark:hover:text-teal-400 shrink-0"
                        onClick={() => copyApiKey(item.apiKey, item.id)}
                        title="Copy API key"
                      >
                        {copiedKeyId === item.id ? (
                          <Check className="h-3 w-3 text-emerald-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </td>

                  {/* 8. STICKY RIGHT: Actions */}
                  <td className="sticky right-0 z-30 py-3 px-3 text-center bg-white dark:bg-slate-950 group-hover:bg-slate-50 dark:group-hover:bg-slate-900 border-b border-l border-border shadow-[-6px_0_16px_-4px_rgba(0,0,0,0.15)] dark:shadow-[-6px_0_20px_-4px_rgba(0,0,0,0.7)] transition-colors w-[130px] min-w-[130px]">
                    <div className="flex items-center justify-center gap-1">
                      {/* View Details */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-teal-700 dark:hover:text-teal-400 hover:bg-teal-500/10"
                        onClick={() => onViewIntegration && onViewIntegration(item)}
                        title="View details"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span className="sr-only">View</span>
                      </Button>

                      {/* Edit Integration */}
                      <Button
                        variant="ghost"
                        size="icon"
                        asChild
                        className="h-7 w-7 text-muted-foreground hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-500/10"
                        title="Edit integration"
                      >
                        <Link href={`/integrations/create?edit=${item.id}`}>
                          <Pencil className="h-3.5 w-3.5" />
                          <span className="sr-only">Edit</span>
                        </Link>
                      </Button>

                      {/* Delete Integration */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10"
                        onClick={() => onDeleteIntegration && onDeleteIntegration(item.id)}
                        title="Delete integration"
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
