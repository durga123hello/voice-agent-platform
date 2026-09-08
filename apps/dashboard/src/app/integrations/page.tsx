"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Layers, Mic, Volume2, Cpu } from "lucide-react";
import { IntegrationToolbar } from "../../components/integrations/IntegrationToolbar";
import { IntegrationsGrid } from "../../components/integrations/IntegrationsGrid";
import { SelectionSummaryBar } from "../../components/integrations/SelectionSummaryBar";
import { IntegrationDetailsModal } from "../../components/integrations/IntegrationDetailsModal";
import { INITIAL_MOCK_INTEGRATIONS } from "../../lib/mock-integrations";
import { Integration, IntegrationFilters } from "../../types/integration";

const STORAGE_KEY = "vopx_integrations_data_v1";
const SELECTION_STORAGE_KEY = "vopx_selected_integrations_v1";

interface SelectedCombination {
  sttId?: string;
  ttsId?: string;
  llmId?: string;
}

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>(INITIAL_MOCK_INTEGRATIONS);
  const [filters, setFilters] = useState<IntegrationFilters>({
    search: "",
    category: "ALL",
    provider: "ALL",
    status: "ALL",
  });

  const [selectedCombination, setSelectedCombination] = useState<SelectedCombination>({
    sttId: "int-1", // Default: Deepgram Nova-2
    ttsId: "int-6", // Default: ElevenLabs Turbo v2.5
    llmId: "int-11", // Default: OpenAI GPT-4o
  });

  const [selectedIntegrationDetails, setSelectedIntegrationDetails] = useState<Integration | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Load integrations and stored selection from localStorage
  useEffect(() => {
    try {
      // 1. Integrations list
      const savedList = localStorage.getItem(STORAGE_KEY);
      let list: Integration[] = [];
      if (savedList) {
        try {
          const parsed = JSON.parse(savedList);
          if (Array.isArray(parsed) && parsed.length > 0) {
            list = parsed;
          }
        } catch (e) {}
      }

      const existingIds = new Set(list.map((i) => i.id));
      const existingIntegrationIds = new Set(list.map((i) => i.integrationId.toUpperCase()));
      const toAdd = INITIAL_MOCK_INTEGRATIONS.filter(
        (m) => !existingIds.has(m.id) && !existingIntegrationIds.has(m.integrationId.toUpperCase())
      );

      const combinedList = [...list, ...toAdd];
      setIntegrations(combinedList);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(combinedList));

      // 2. Selection state
      const savedSelection = localStorage.getItem(SELECTION_STORAGE_KEY);
      if (savedSelection) {
        try {
          const parsedSel = JSON.parse(savedSelection);
          if (parsedSel && typeof parsedSel === "object") {
            setSelectedCombination(parsedSel);
          }
        } catch (e) {}
      }
    } catch (e) {
      console.error("Failed to load integrations page state", e);
    }
  }, []);

  // Handle provider card click (single-select per category section)
  const handleSelectProvider = (item: Integration) => {
    setSelectedCombination((prev) => {
      let nextState = { ...prev };
      if (item.category === "STT Agent") {
        nextState.sttId = prev.sttId === item.id ? undefined : item.id;
      } else if (item.category === "TTS Agent") {
        nextState.ttsId = prev.ttsId === item.id ? undefined : item.id;
      } else if (item.category === "LLM Provider") {
        nextState.llmId = prev.llmId === item.id ? undefined : item.id;
      }

      try {
        localStorage.setItem(SELECTION_STORAGE_KEY, JSON.stringify(nextState));
      } catch (e) {}

      return nextState;
    });
  };

  const handleClearSelection = () => {
    const emptyState = {};
    setSelectedCombination(emptyState);
    try {
      localStorage.setItem(SELECTION_STORAGE_KEY, JSON.stringify(emptyState));
    } catch (e) {}
  };

  // Filter integrations based on search, category, provider, and status
  const filteredIntegrations = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    const tokens = q ? q.split(/\s+/).filter(Boolean) : [];

    return integrations.filter((item) => {
      // 1. Search filter
      let matchesSearch = true;
      if (tokens.length > 0) {
        const searchableText = [
          item.name,
          item.integrationId,
          item.category,
          item.provider,
          item.availableModels,
          item.status,
          item.latency
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        matchesSearch = tokens.every((token) => searchableText.includes(token));
      }

      // 2. Category filter
      const matchesCategory =
        filters.category === "ALL" || item.category === filters.category;

      // 3. Provider filter
      const matchesProvider =
        filters.provider === "ALL" || item.provider.toLowerCase().includes(filters.provider.toLowerCase());

      // 4. Status filter
      const matchesStatus =
        filters.status === "ALL" || item.status === filters.status;

      return matchesSearch && matchesCategory && matchesProvider && matchesStatus;
    });
  }, [integrations, filters]);

  // Selected Integrations for Summary Bar
  const selectedStt = useMemo(
    () => integrations.find((i) => i.id === selectedCombination.sttId) || null,
    [integrations, selectedCombination.sttId]
  );
  const selectedTts = useMemo(
    () => integrations.find((i) => i.id === selectedCombination.ttsId) || null,
    [integrations, selectedCombination.ttsId]
  );
  const selectedLlm = useMemo(
    () => integrations.find((i) => i.id === selectedCombination.llmId) || null,
    [integrations, selectedCombination.llmId]
  );

  // Counts for metric cards
  const sttCount = useMemo(() => integrations.filter((i) => i.category === "STT Agent").length, [integrations]);
  const ttsCount = useMemo(() => integrations.filter((i) => i.category === "TTS Agent").length, [integrations]);
  const llmCount = useMemo(() => integrations.filter((i) => i.category === "LLM Provider").length, [integrations]);

  // Delete Handler
  const handleDeleteIntegration = (id: string) => {
    const updated = integrations.filter((i) => i.id !== id);
    setIntegrations(updated);

    // Also deselect if deleted
    setSelectedCombination((prev) => {
      const next = { ...prev };
      if (next.sttId === id) delete next.sttId;
      if (next.ttsId === id) delete next.ttsId;
      if (next.llmId === id) delete next.llmId;
      try {
        localStorage.setItem(SELECTION_STORAGE_KEY, JSON.stringify(next));
      } catch (e) {}
      return next;
    });

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {}
  };

  // View Details Handler
  const handleViewIntegration = (integration: Integration) => {
    setSelectedIntegrationDetails(integration);
    setIsDetailsOpen(true);
  };

  const handleFilterChange = (newFilters: Partial<IntegrationFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-border/60">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700/10 text-teal-800 dark:bg-teal-500/15 dark:text-teal-300 border border-teal-500/20 shadow-2xs">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Integrations & AI Providers
            </h1>
            <p className="text-xs text-muted-foreground">
              Choose and combine Speech-to-Text (STT Agents), Text-to-Speech (TTS Agents), and Large Language Model (LLM) providers into active voice pipelines.
            </p>
          </div>
        </div>
      </div>

      {/* 2. Top Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* STT Agents */}
        <div 
          onClick={() => handleFilterChange({ category: "STT Agent" })}
          className="flex items-center justify-between p-3.5 rounded-xl border border-border/70 bg-card hover:bg-muted/30 transition-all cursor-pointer shadow-2xs group"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
              <Mic className="h-4 w-4" />
            </div>
            <div>
              <span className="text-[11px] font-medium text-muted-foreground block">STT Agents</span>
              <span className="text-lg font-bold text-foreground group-hover:text-emerald-600 transition-colors">{sttCount} Providers</span>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/60">
            Speech-to-Text
          </span>
        </div>

        {/* TTS Agents */}
        <div 
          onClick={() => handleFilterChange({ category: "TTS Agent" })}
          className="flex items-center justify-between p-3.5 rounded-xl border border-border/70 bg-card hover:bg-muted/30 transition-all cursor-pointer shadow-2xs group"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shrink-0">
              <Volume2 className="h-4 w-4" />
            </div>
            <div>
              <span className="text-[11px] font-medium text-muted-foreground block">TTS Agents</span>
              <span className="text-lg font-bold text-foreground group-hover:text-blue-600 transition-colors">{ttsCount} Providers</span>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800/60">
            Text-to-Speech
          </span>
        </div>

        {/* LLM Providers */}
        <div 
          onClick={() => handleFilterChange({ category: "LLM Provider" })}
          className="flex items-center justify-between p-3.5 rounded-xl border border-border/70 bg-card hover:bg-muted/30 transition-all cursor-pointer shadow-2xs group"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20 shrink-0">
              <Cpu className="h-4 w-4" />
            </div>
            <div>
              <span className="text-[11px] font-medium text-muted-foreground block">LLM Providers</span>
              <span className="text-lg font-bold text-foreground group-hover:text-teal-700 transition-colors">{llmCount} Providers</span>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded border border-teal-200 dark:border-teal-800/60">
            AI Logic
          </span>
        </div>
      </div>

      {/* 3. Toolbar */}
      <IntegrationToolbar
        filters={filters}
        onFilterChange={handleFilterChange}
        filteredIntegrations={filteredIntegrations}
      />

      {/* 4. Grouped Card-Based Provider Grid (Replaces Table) */}
      <IntegrationsGrid
        integrations={filteredIntegrations}
        selectedCombination={selectedCombination}
        onSelectProvider={handleSelectProvider}
        onDeleteIntegration={handleDeleteIntegration}
        onViewIntegration={handleViewIntegration}
        activeCategoryFilter={filters.category}
      />

      {/* 5. Persistent Selected Combination Summary Bar */}
      <SelectionSummaryBar
        selectedStt={selectedStt}
        selectedTts={selectedTts}
        selectedLlm={selectedLlm}
        onClearSelection={handleClearSelection}
      />

      {/* 6. Details Modal */}
      <IntegrationDetailsModal
        integration={selectedIntegrationDetails}
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
      />
    </div>
  );
}
