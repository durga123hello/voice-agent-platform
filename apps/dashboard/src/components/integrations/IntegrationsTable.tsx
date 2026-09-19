"use client";

import React from "react";
import { 
  Mic, 
  Volume2, 
  Cpu, 
  Phone,
  Clock,
  Globe,
  Check,
  Layers,
  FileAudio
} from "lucide-react";
import { Integration, IntegrationCategory, IntegrationStatus } from "../../types/integration";

interface IntegrationsTableProps {
  integrations: Integration[];
  category: IntegrationCategory;
  isLoading?: boolean;
  onViewIntegration?: (item: Integration) => void;
  onDeleteIntegration?: (id: string) => void;
}

export function IntegrationsTable({
  integrations,
  category,
  isLoading = false,
  onViewIntegration,
  onDeleteIntegration,
}: IntegrationsTableProps) {
  // Category Icon & Accent Colors
  const renderCategoryIcon = (cat: IntegrationCategory) => {
    switch (cat) {
      case "STT Agent":
        return (
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
            <Mic className="h-4 w-4" />
          </div>
        );
      case "TTS Agent":
        return (
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shrink-0">
            <Volume2 className="h-4 w-4" />
          </div>
        );
      case "LLM Provider":
        return (
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20 shrink-0">
            <Cpu className="h-4 w-4" />
          </div>
        );
      case "Mobile Telephony":
        return (
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 shrink-0">
            <Phone className="h-4 w-4" />
          </div>
        );
      default:
        return (
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-muted-foreground shrink-0 border border-border">
            <Layers className="h-4 w-4" />
          </div>
        );
    }
  };

  // Status Badge Rendering
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
      case "Ready":
        return (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/60">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
            {status}
          </div>
        );
      case "Inactive":
      default:
        return (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0" />
            {status || "Inactive"}
          </div>
        );
    }
  };

  // Chip Pills Truncation Affordance
  const renderChipPills = (rawString: string, maxVisible = 2) => {
    if (!rawString) return <span className="text-muted-foreground">—</span>;

    const items = rawString
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (items.length === 0) return <span className="text-muted-foreground">—</span>;

    const visible = items.slice(0, maxVisible);
    const hiddenCount = items.length - maxVisible;

    return (
      <div className="flex flex-wrap items-center gap-1 max-w-[280px]">
        {visible.map((item, idx) => (
          <span
            key={idx}
            className="inline-block max-w-[150px] truncate px-2 py-0.5 text-[11px] font-mono font-medium rounded-md bg-muted/70 text-foreground border border-border/80"
            title={item}
          >
            {item}
          </span>
        ))}
        {hiddenCount > 0 && (
          <span
            className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-teal-500/15 text-teal-800 dark:text-teal-300 border border-teal-500/30 cursor-pointer hover:bg-teal-500/25 transition-colors"
            title={`Full list: ${rawString}`}
          >
            +{hiddenCount} more
          </span>
        )}
      </div>
    );
  };

  // Supported Languages Helper (STT)
  const renderSupportedLanguages = (item: Integration) => {
    const prov = item.provider.toLowerCase();
    let label = "English (en-US)";
    if (prov.includes("deepgram") || prov.includes("gladia") || prov.includes("whisper") || prov.includes("speechmatics")) {
      label = "Multilingual (30+ langs)";
    } else if (prov.includes("sarvam")) {
      label = "Indic (hi, ta, te, kn, ml)";
    } else if (prov.includes("google") || prov.includes("azure")) {
      label = "Global (100+ langs)";
    } else if (prov.includes("assemblyai")) {
      label = "en-US, es-MX, fr-FR, +15 more";
    }

    return (
      <div className="flex items-center gap-1.5 text-xs text-foreground font-medium">
        <Globe className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
        <span>{label}</span>
      </div>
    );
  };

  // Context Window Helper (LLM)
  const renderContextWindow = (item: Integration) => {
    const prov = item.provider.toLowerCase();
    let text = "128k tokens";
    if (prov.includes("openai") || prov.includes("anthropic")) {
      text = "128k - 200k tokens";
    } else if (prov.includes("gemini")) {
      text = "1M - 2M tokens";
    } else if (prov.includes("deepseek")) {
      text = "64k - 128k tokens";
    }

    return (
      <span className="font-mono text-xs font-semibold text-foreground/90 bg-muted/50 px-2 py-0.5 rounded border border-border/70">
        {text}
      </span>
    );
  };

  // Max Tokens Helper (LLM)
  const renderMaxTokens = (item: Integration) => {
    const prov = item.provider.toLowerCase();
    let text = "4,096 tokens";
    if (prov.includes("openai") || prov.includes("gemini") || prov.includes("anthropic") || prov.includes("deepseek")) {
      text = "16,384 tokens";
    } else if (prov.includes("groq") || prov.includes("mistral")) {
      text = "8,192 tokens";
    }

    return (
      <span className="font-mono text-xs font-medium text-muted-foreground">
        {text}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="w-full rounded-xl border border-border bg-card p-6 shadow-xs">
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 w-full animate-pulse rounded-lg bg-muted/60" />
          ))}
        </div>
      </div>
    );
  }

  if (integrations.length === 0) {
    return (
      <div className="w-full rounded-xl border border-dashed border-border bg-card/50 p-12 text-center shadow-xs">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-teal-500/10 text-teal-700 dark:text-teal-400 mb-3 border border-teal-500/20">
          <Layers className="h-6 w-6" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">No integrations found</h3>
        <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
          No provider integration matches your current filters. Add a new agent or change search terms.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full rounded-xl border border-border bg-card shadow-xs overflow-hidden">
      <div className="overflow-x-auto custom-scrollbar relative">
        <table className="w-full border-separate border-spacing-0 text-left text-xs min-w-[900px]">
          {/* Table Header */}
          <thead>
            <tr className="bg-muted font-semibold text-muted-foreground">
              {/* 1. STICKY LEFT: Name */}
              <th 
                scope="col"
                className="sticky left-0 z-40 py-3.5 pl-4 pr-6 bg-slate-100 dark:bg-slate-900 border-b border-r border-border shadow-[6px_0_16px_-4px_rgba(0,0,0,0.15)] dark:shadow-[6px_0_20px_-4px_rgba(0,0,0,0.7)] w-[250px] min-w-[250px]"
              >
                Provider & Agent Name
              </th>

              {/* 2. Vendor Column */}
              <th scope="col" className="py-3.5 px-4 min-w-[160px] border-b border-border bg-slate-50/80 dark:bg-slate-900/60">
                Vendor
              </th>

              {/* Middle Columns customized per Category */}
              {category === "STT Agent" && (
                <>
                  <th scope="col" className="py-3.5 px-4 min-w-[130px] border-b border-border bg-slate-50/80 dark:bg-slate-900/60">
                    Avg Latency
                  </th>
                  <th scope="col" className="py-3.5 px-4 min-w-[240px] border-b border-border bg-slate-50/80 dark:bg-slate-900/60">
                    Available Models
                  </th>
                  <th scope="col" className="py-3.5 px-4 min-w-[200px] border-b border-border bg-slate-50/80 dark:bg-slate-900/60">
                    Supported Languages
                  </th>
                </>
              )}

              {category === "TTS Agent" && (
                <>
                  <th scope="col" className="py-3.5 px-4 min-w-[130px] border-b border-border bg-slate-50/80 dark:bg-slate-900/60">
                    Avg Latency
                  </th>
                  <th scope="col" className="py-3.5 px-4 min-w-[260px] border-b border-border bg-slate-50/80 dark:bg-slate-900/60">
                    Available Models / Voices
                  </th>
                </>
              )}

              {category === "LLM Provider" && (
                <>
                  <th scope="col" className="py-3.5 px-4 min-w-[170px] border-b border-border bg-slate-50/80 dark:bg-slate-900/60">
                    Context Window
                  </th>
                  <th scope="col" className="py-3.5 px-4 min-w-[140px] border-b border-border bg-slate-50/80 dark:bg-slate-900/60">
                    Max Tokens
                  </th>
                  <th scope="col" className="py-3.5 px-4 min-w-[260px] border-b border-border bg-slate-50/80 dark:bg-slate-900/60">
                    Available Models
                  </th>
                </>
              )}

              {category === "Mobile Telephony" && (
                <>
                  <th scope="col" className="py-3.5 px-4 min-w-[240px] border-b border-border bg-slate-50/80 dark:bg-slate-900/60">
                    Phone Numbers
                  </th>
                  <th scope="col" className="py-3.5 px-4 min-w-[150px] border-b border-border bg-slate-50/80 dark:bg-slate-900/60">
                    Recording Enabled
                  </th>
                  <th scope="col" className="py-3.5 px-4 min-w-[180px] border-b border-border bg-slate-50/80 dark:bg-slate-900/60">
                    Recording Format
                  </th>
                </>
              )}

              {/* Status Column */}
              <th scope="col" className="py-3.5 px-4 min-w-[130px] border-b border-border bg-slate-50/80 dark:bg-slate-900/60">
                Status
              </th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody>
            {integrations.map((item) => (
              <tr 
                key={item.id}
                className="group transition-colors cursor-pointer"
                onClick={() => onViewIntegration && onViewIntegration(item)}
              >
                {/* 1. STICKY LEFT: Name */}
                <td className="sticky left-0 z-30 py-3 pl-4 pr-6 bg-white dark:bg-slate-950 group-hover:bg-slate-50 dark:group-hover:bg-slate-900 border-b border-r border-border shadow-[6px_0_16px_-4px_rgba(0,0,0,0.15)] dark:shadow-[6px_0_20px_-4px_rgba(0,0,0,0.7)] transition-colors w-[250px] min-w-[250px]">
                  <div className="flex items-center gap-3">
                    {renderCategoryIcon(item.category)}
                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold text-foreground truncate text-xs sm:text-[13px] group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors">
                        {item.name}
                      </span>
                      <span className="text-[11px] text-muted-foreground font-mono mt-0.5 truncate">
                        {item.provider} • {item.integrationId}
                      </span>
                    </div>
                  </div>
                </td>

                {/* 2. Vendor Column */}
                <td className="py-3 px-4 text-foreground font-medium whitespace-nowrap min-w-[160px] border-b border-border bg-card group-hover:bg-muted/40 transition-colors">
                  <span className="text-xs font-semibold text-foreground/90">
                    {item.provider}
                  </span>
                </td>

                {/* Middle Columns depending on Category */}
                {category === "STT Agent" && (
                  <>
                    {/* Latency */}
                    <td className="py-3 px-4 text-muted-foreground whitespace-nowrap min-w-[130px] border-b border-border bg-card group-hover:bg-muted/40 transition-colors">
                      <div className="flex items-center gap-1 font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        <Clock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>{item.latency || "90ms"}</span>
                      </div>
                    </td>

                    {/* Available Models */}
                    <td className="py-3 px-4 border-b border-border bg-card group-hover:bg-muted/40 transition-colors min-w-[240px]">
                      {renderChipPills(item.availableModels, 2)}
                    </td>

                    {/* Supported Languages */}
                    <td className="py-3 px-4 border-b border-border bg-card group-hover:bg-muted/40 transition-colors min-w-[200px]">
                      {renderSupportedLanguages(item)}
                    </td>
                  </>
                )}

                {category === "TTS Agent" && (
                  <>
                    {/* Latency */}
                    <td className="py-3 px-4 text-muted-foreground whitespace-nowrap min-w-[130px] border-b border-border bg-card group-hover:bg-muted/40 transition-colors">
                      <div className="flex items-center gap-1 font-mono text-xs font-semibold text-blue-700 dark:text-blue-400">
                        <Clock className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                        <span>{item.latency || "120ms"}</span>
                      </div>
                    </td>

                    {/* Available Models / Voices */}
                    <td className="py-3 px-4 border-b border-border bg-card group-hover:bg-muted/40 transition-colors min-w-[260px]">
                      {renderChipPills(item.availableModels, 2)}
                    </td>
                  </>
                )}

                {category === "LLM Provider" && (
                  <>
                    {/* Context Window */}
                    <td className="py-3 px-4 border-b border-border bg-card group-hover:bg-muted/40 transition-colors min-w-[170px]">
                      {renderContextWindow(item)}
                    </td>

                    {/* Max Tokens */}
                    <td className="py-3 px-4 border-b border-border bg-card group-hover:bg-muted/40 transition-colors min-w-[140px]">
                      {renderMaxTokens(item)}
                    </td>

                    {/* Available Models */}
                    <td className="py-3 px-4 border-b border-border bg-card group-hover:bg-muted/40 transition-colors min-w-[260px]">
                      {renderChipPills(item.availableModels, 2)}
                    </td>
                  </>
                )}

                {category === "Mobile Telephony" && (
                  <>
                    {/* Phone Numbers */}
                    <td className="py-3 px-4 border-b border-border bg-card group-hover:bg-muted/40 transition-colors min-w-[240px]">
                      {renderChipPills(item.availableModels, 2)}
                    </td>

                    {/* Recording Enabled */}
                    <td className="py-3 px-4 border-b border-border bg-card group-hover:bg-muted/40 transition-colors min-w-[150px]">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                        <Check className="h-3 w-3 text-emerald-600" />
                        Enabled
                      </span>
                    </td>

                    {/* Recording Format */}
                    <td className="py-3 px-4 border-b border-border bg-card group-hover:bg-muted/40 transition-colors min-w-[180px]">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                        <FileAudio className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                        <span className="text-foreground/90">WAV / 16kHz</span>
                      </div>
                    </td>
                  </>
                )}

                {/* Status Column */}
                <td className="py-3 px-4 whitespace-nowrap min-w-[130px] border-b border-border bg-card group-hover:bg-muted/40 transition-colors">
                  {renderStatus(item.status)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

