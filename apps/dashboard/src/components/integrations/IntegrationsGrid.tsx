"use client";

import React from "react";
import Link from "next/link";
import { 
  Mic, 
  Volume2, 
  Cpu, 
  Phone,
  Layers, 
  Activity, 
  Check, 
  MoreVertical, 
  Eye, 
  Pencil, 
  Trash2,
  CheckCircle2
} from "lucide-react";
import { Integration, IntegrationCategory, IntegrationStatus } from "../../types/integration";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

import { INITIAL_MOCK_INTEGRATIONS } from "../../lib/mock-integrations";

interface SelectedCombination {
  sttId?: string;
  ttsId?: string;
  llmId?: string;
}

interface IntegrationsGridProps {
  integrations: Integration[];
  selectedCombination?: SelectedCombination;
  onSelectProvider?: (integration: Integration) => void;
  onDeleteIntegration?: (id: string) => void;
  onViewIntegration?: (integration: Integration) => void;
  activeCategoryFilter: string;
}

export function IntegrationsGrid({
  integrations,
  selectedCombination,
  onSelectProvider,
  onDeleteIntegration,
  onViewIntegration,
  activeCategoryFilter,
}: IntegrationsGridProps) {
  // Use provided integrations or fallback to rich catalog if empty
  const displayIntegrations =
    integrations.length > 0
      ? integrations
      : INITIAL_MOCK_INTEGRATIONS.filter(
          (i) => activeCategoryFilter === "ALL" || i.category === activeCategoryFilter
        );

  // Categorize integrations
  const sttIntegrations = displayIntegrations.filter((i) => i.category === "STT Agent");
  const ttsIntegrations = displayIntegrations.filter((i) => i.category === "TTS Agent");
  const llmIntegrations = displayIntegrations.filter((i) => i.category === "LLM Provider");
  const telephonyIntegrations = displayIntegrations.filter((i) => i.category === "Mobile Telephony");

  const renderStatusBadge = (status: IntegrationStatus) => {
    switch (status) {
      case "Active":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 shrink-0">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
            Active
          </span>
        );
      case "Connected":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800/60 shrink-0">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-500 shrink-0" />
            Connected
          </span>
        );
      case "Ready":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/60 shrink-0">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
            Ready
          </span>
        );
      case "Inactive":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 shrink-0">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0" />
            Inactive
          </span>
        );
      default:
        return <span>{status}</span>;
    }
  };

  const renderCategoryIcon = (category: IntegrationCategory) => {
    switch (category) {
      case "STT Agent":
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
            <Mic className="h-4 w-4" />
          </div>
        );
      case "TTS Agent":
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shrink-0">
            <Volume2 className="h-4 w-4" />
          </div>
        );
      case "LLM Provider":
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20 shrink-0">
            <Cpu className="h-4 w-4" />
          </div>
        );
      case "Mobile Telephony":
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 shrink-0">
            <Phone className="h-4 w-4" />
          </div>
        );
      default:
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground shrink-0">
            <Layers className="h-4 w-4" />
          </div>
        );
    }
  };

  const isSelected = (item: Integration) => {
    if (!selectedCombination) return false;
    if (item.category === "STT Agent") return selectedCombination.sttId === item.id;
    if (item.category === "TTS Agent") return selectedCombination.ttsId === item.id;
    if (item.category === "LLM Provider") return selectedCombination.llmId === item.id;
    return false;
  };

  const renderCard = (item: Integration) => {
    const selected = isSelected(item);

    return (
      <div
        key={item.id}
        onClick={() => {
          if (onSelectProvider) {
            onSelectProvider(item);
          } else if (onViewIntegration) {
            onViewIntegration(item);
          }
        }}
        className={`group relative flex flex-col justify-between rounded-xl border p-4 transition-all duration-200 cursor-pointer shadow-xs ${
          selected
            ? "border-teal-600 dark:border-teal-400 bg-teal-500/10 dark:bg-teal-950/40 ring-2 ring-teal-500/40 shadow-sm"
            : "border-border/80 bg-card hover:border-teal-500/50 hover:bg-accent/40 hover:shadow-md"
        }`}
      >
        {/* Top Header Row */}
        <div>
          <div className="flex items-start justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              {renderCategoryIcon(item.category)}
              <div className="min-w-0 flex-1">
                <h4 className="font-bold text-foreground text-xs sm:text-[13px] tracking-tight truncate group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors">
                  {item.name}
                </h4>
                <p className="text-[11px] font-medium text-muted-foreground truncate">
                  {item.provider}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
              {/* Checkmark Indicator when Selected */}
              {selected && (
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-700 dark:bg-teal-500 text-white shadow-xs">
                  <Check className="h-3.5 w-3.5 stroke-[3]" />
                </div>
              )}

              {/* Kebab / More Actions Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    title="More actions"
                  >
                    <MoreVertical className="h-3.5 w-3.5" />
                    <span className="sr-only">Actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40 text-xs">
                  <DropdownMenuItem
                    onClick={() => onViewIntegration && onViewIntegration(item)}
                    className="gap-2 cursor-pointer"
                  >
                    <Eye className="h-3.5 w-3.5 text-teal-600" />
                    <span>View Details</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem asChild className="gap-2 cursor-pointer">
                    <Link href={`/integrations/create?edit=${item.id}`}>
                      <Pencil className="h-3.5 w-3.5 text-blue-600" />
                      <span>Edit Provider</span>
                    </Link>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    onClick={() => onDeleteIntegration && onDeleteIntegration(item.id)}
                    className="gap-2 cursor-pointer text-rose-600 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete Provider</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Latency / Active Numbers Row */}
          {item.latency && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-3 bg-muted/30 px-2 py-1 rounded-md border border-border/50 w-fit">
              <Activity className="h-3 w-3 text-teal-600 dark:text-teal-400 shrink-0" />
              <span>
                {item.category === "Mobile Telephony" ? "Active Numbers: " : "Avg Latency: "}
                <strong className="font-semibold text-foreground">{item.latency}</strong>
              </span>
            </div>
          )}

          {/* Available Models / Phone Numbers (Wrapped Pills) */}
          <div className="space-y-1 my-2">
            <span className="text-[10px] uppercase font-bold text-muted-foreground/80 tracking-wider block">
              {item.category === "Mobile Telephony" ? "Configured Numbers:" : "Available Models:"}
            </span>
            <div className="flex flex-wrap gap-1">
              {item.availableModels.split(',').map((model, idx) => (
                <span 
                  key={idx} 
                  className="inline-flex items-center font-mono text-[10px] font-medium px-2 py-0.5 rounded-md bg-muted/60 text-foreground border border-border/70 group-hover:border-border transition-colors"
                >
                  {model.trim()}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Row: Status Badge */}
        <div className="pt-3 mt-3 border-t border-border/60 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {selected ? (
              <span className="text-[11px] font-bold text-teal-700 dark:text-teal-300 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                Selected
              </span>
            ) : (
              <span className="text-[11px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                Click to view details
              </span>
            )}
          </div>

          {renderStatusBadge(item.status)}
        </div>
      </div>
    );
  };

  const renderSection = (
    title: string, 
    icon: React.ReactNode, 
    items: Integration[], 
    categoryName: string
  ) => {
    return (
      <div className="space-y-3">
        {/* Section Header */}
        <div className="flex items-center justify-between pb-2 border-b border-border/70">
          <div className="flex items-center gap-2">
            {icon}
            <h3 className="text-sm font-bold text-foreground tracking-tight">
              {title}
            </h3>
            <span className="font-mono text-xs font-semibold text-muted-foreground bg-muted/80 px-2 py-0.5 rounded-full border border-border">
              {items.length}
            </span>
          </div>

          {items.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {items.length} Available Providers
            </span>
          )}
        </div>

        {/* Section Grid */}
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/40 p-6 text-center text-xs text-muted-foreground">
            No {title.toLowerCase()} match your search filters.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {items.map(renderCard)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* 1. STT Agents Section */}
      {(activeCategoryFilter === "ALL" || activeCategoryFilter === "STT Agent") &&
        renderSection(
          "STT Agents (Speech-to-Text)",
          <Mic className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />,
          sttIntegrations,
          "STT"
        )}

      {/* 2. TTS Agents Section */}
      {(activeCategoryFilter === "ALL" || activeCategoryFilter === "TTS Agent") &&
        renderSection(
          "TTS Agents (Text-to-Speech)",
          <Volume2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />,
          ttsIntegrations,
          "TTS"
        )}

      {/* 3. LLM Providers Section */}
      {(activeCategoryFilter === "ALL" || activeCategoryFilter === "LLM Provider") &&
        renderSection(
          "LLM Providers (Language Models)",
          <Cpu className="h-4 w-4 text-teal-600 dark:text-teal-400" />,
          llmIntegrations,
          "LLM"
        )}

      {/* 4. Mobile Telephony Section */}
      {(activeCategoryFilter === "ALL" || activeCategoryFilter === "Mobile Telephony") &&
        renderSection(
          "Mobile Telephony (Plivo & Voice Trunks)",
          <Phone className="h-4 w-4 text-purple-600 dark:text-purple-400" />,
          telephonyIntegrations,
          "Telephony"
        )}
    </div>
  );
}
