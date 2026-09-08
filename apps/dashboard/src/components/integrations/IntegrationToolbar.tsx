"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
  Search, 
  Plus, 
  X,
  Layers,
  Mic,
  Volume2,
  Cpu
} from "lucide-react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "../ui/select";
import { Integration, IntegrationFilters } from "../../types/integration";

interface IntegrationToolbarProps {
  filters: IntegrationFilters;
  onFilterChange: (newFilters: Partial<IntegrationFilters>) => void;
  filteredIntegrations: Integration[];
}

export function IntegrationToolbar({
  filters,
  onFilterChange,
  filteredIntegrations,
}: IntegrationToolbarProps) {
  const categoryTabs = [
    { label: "All Integrations", value: "ALL", icon: Layers },
    { label: "STT Agents", value: "STT Agent", icon: Mic },
    { label: "TTS Agents", value: "TTS Agent", icon: Volume2 },
    { label: "LLM Providers", value: "LLM Provider", icon: Cpu },
  ];

  return (
    <div className="space-y-3 py-1">
      {/* Category Pill Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1">
        {categoryTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = filters.category === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => onFilterChange({ category: tab.value })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                isActive
                  ? "bg-teal-700 text-white shadow-xs dark:bg-teal-600"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/60"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Search & Controls Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Left side: Search & Filters */}
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search by provider, category, model, or status..."
              value={filters.search}
              onChange={(e) => onFilterChange({ search: e.target.value })}
              className="pl-9 pr-8 h-9 text-xs bg-background"
            />
            {filters.search && (
              <button
                type="button"
                onClick={() => onFilterChange({ search: "" })}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
                title="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Provider Filter */}
          <div className="w-[150px]">
            <Select
              value={filters.provider}
              onValueChange={(val) => onFilterChange({ provider: val })}
            >
              <SelectTrigger className="h-9 text-xs bg-background">
                <SelectValue placeholder="All Providers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Providers</SelectItem>
                <SelectItem value="Deepgram">Deepgram</SelectItem>
                <SelectItem value="ElevenLabs">ElevenLabs</SelectItem>
                <SelectItem value="OpenAI">OpenAI</SelectItem>
                <SelectItem value="Anthropic">Anthropic</SelectItem>
                <SelectItem value="Cartesia">Cartesia</SelectItem>
                <SelectItem value="Google Cloud">Google Cloud</SelectItem>
                <SelectItem value="Microsoft Azure">Azure</SelectItem>
                <SelectItem value="DeepSeek">DeepSeek</SelectItem>
                <SelectItem value="AssemblyAI">AssemblyAI</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status Filter */}
          <div className="w-[140px]">
            <Select
              value={filters.status}
              onValueChange={(val) => onFilterChange({ status: val })}
            >
              <SelectTrigger className="h-9 text-xs bg-background">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Connected">Connected</SelectItem>
                <SelectItem value="Ready">Ready</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Right side: Add Integration Button */}
        <div className="flex items-center gap-2 self-end md:self-auto">
          <Button asChild size="sm" className="h-9 gap-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs px-3.5 shadow-xs">
            <Link href="/integrations/create">
              <Plus className="h-3.5 w-3.5" />
              <span>Add Integration</span>
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
