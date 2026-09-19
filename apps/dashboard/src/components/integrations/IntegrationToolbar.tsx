"use client";

import React from "react";
import Link from "next/link";
import { 
  Search, 
  Plus, 
  X
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
import { usePermissions } from "../../context/permissions-context";

interface IntegrationToolbarProps {
  filters: IntegrationFilters;
  onFilterChange: (newFilters: Partial<IntegrationFilters>) => void;
  filteredIntegrations: Integration[];
  currentRoute?: "overview" | "stt" | "tts" | "llm" | "telephony";
  createButtonText?: string;
  onCreateClick?: () => void;
}

export function IntegrationToolbar({
  filters,
  onFilterChange,
  filteredIntegrations,
  currentRoute,
  createButtonText,
  onCreateClick,
}: IntegrationToolbarProps) {
  const { can } = usePermissions();
  return (
    <div className="space-y-3">
      {/* 2. Search & Filter Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 py-1">
        {/* Search Input & Select Filters */}
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search by name, ID, provider, model..."
              value={filters.search}
              onChange={(e) => onFilterChange({ search: e.target.value })}
              className="pl-9 pr-8 h-8 text-xs bg-background"
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
          <div className="w-[140px]">
            <Select
              value={filters.provider}
              onValueChange={(val) => onFilterChange({ provider: val })}
            >
              <SelectTrigger className="h-8 text-xs bg-background">
                <SelectValue placeholder="All Providers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Providers</SelectItem>
                <SelectItem value="Deepgram">Deepgram</SelectItem>
                <SelectItem value="ElevenLabs">ElevenLabs</SelectItem>
                <SelectItem value="Cartesia">Cartesia</SelectItem>
                <SelectItem value="OpenAI">OpenAI</SelectItem>
                <SelectItem value="Anthropic">Anthropic</SelectItem>
                <SelectItem value="Plivo">Plivo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status Filter */}
          <div className="w-[130px]">
            <Select
              value={filters.status}
              onValueChange={(val) => onFilterChange({ status: val })}
            >
              <SelectTrigger className="h-8 text-xs bg-background">
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

        {/* Type-Specific or Generic Create Button */}
        {can("integrations", "create") && (
          onCreateClick ? (
            <Button
              onClick={onCreateClick}
              size="sm"
              className="h-8 gap-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs px-3.5 shadow-xs self-start md:self-auto"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{createButtonText || "Create Agent"}</span>
            </Button>
          ) : (
            <Button asChild size="sm" className="h-8 gap-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs px-3.5 shadow-xs self-start md:self-auto">
              <Link href="/integrations/stt">
                <Plus className="h-3.5 w-3.5" />
                <span>Add Integration</span>
              </Link>
            </Button>
          )
        )}
      </div>
    </div>
  );
}
