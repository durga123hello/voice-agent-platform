"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Mic } from "lucide-react";
import { IntegrationToolbar } from "../../../components/integrations/IntegrationToolbar";
import { IntegrationsTable } from "../../../components/integrations/IntegrationsTable";
import { IntegrationsPagination } from "../../../components/integrations/IntegrationsPagination";
import { IntegrationDetailsModal } from "../../../components/integrations/IntegrationDetailsModal";
import { AgentCreateModal } from "../../../components/integrations/AgentCreateModal";
import { Integration, IntegrationFilters } from "../../../types/integration";
import { INITIAL_MOCK_INTEGRATIONS } from "../../../lib/mock-integrations";
import { RouteGuard } from "../../../components/shell/RouteGuard";

const PAGE_SIZE = 10;

export default function STTAgentsPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<IntegrationFilters>({
    search: "",
    category: "STT Agent",
    provider: "ALL",
    status: "ALL",
  });

  const [selectedIntegrationDetails, setSelectedIntegrationDetails] = useState<Integration | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const [integrationsList, setIntegrationsList] = useState<Integration[]>(() =>
    INITIAL_MOCK_INTEGRATIONS.filter((i) => i.category === "STT Agent")
  );

  const handleFilterChange = (newF: Partial<IntegrationFilters>) => {
    setFilters((prev) => ({ ...prev, ...newF }));
    setCurrentPage(1);
  };

  const filteredIntegrations = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    const tokens = q ? q.split(/\s+/).filter(Boolean) : [];

    return integrationsList.filter((item) => {
      let matchesSearch = true;
      if (tokens.length > 0) {
        const searchableText = [
          item.name,
          item.integrationId,
          item.category,
          item.provider,
          item.availableModels,
          item.status,
          item.latency,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        matchesSearch = tokens.every((token) => searchableText.includes(token));
      }

      const matchesProvider =
        filters.provider === "ALL" ||
        item.provider.toLowerCase().includes(filters.provider.toLowerCase());

      const matchesStatus =
        filters.status === "ALL" || item.status === filters.status;

      return matchesSearch && matchesProvider && matchesStatus;
    });
  }, [integrationsList, filters]);

  const totalPages = Math.ceil(filteredIntegrations.length / PAGE_SIZE);

  const paginatedIntegrations = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredIntegrations.slice(start, start + PAGE_SIZE);
  }, [filteredIntegrations, currentPage]);

  const handleDeleteIntegration = (id: string) => {
    setIntegrationsList((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <RouteGuard module="integrations">
      <div className="space-y-6 pb-12">
        {/* Breadcrumb & Header */}
        <div>
          <Link
            href="/integrations"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground mb-3 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Integrations Overview</span>
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-border/60">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-2xs">
                <Mic className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-foreground">
                  Speech-to-Text (STT) Agents
                </h1>
                <p className="text-xs text-muted-foreground">
                  Configure real-time audio transcription and speech recognition providers.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <IntegrationToolbar
          filters={filters}
          onFilterChange={handleFilterChange}
          filteredIntegrations={filteredIntegrations}
          currentRoute="stt"
          createButtonText="Create STT Agent"
          onCreateClick={() => setIsCreateOpen(true)}
        />

        {/* Data Table */}
        <IntegrationsTable
          integrations={paginatedIntegrations}
          category="STT Agent"
          onViewIntegration={(item) => {
            setSelectedIntegrationDetails(item);
            setIsDetailsOpen(true);
          }}
          onDeleteIntegration={handleDeleteIntegration}
        />

        {/* Pagination Controls */}
        <IntegrationsPagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredIntegrations.length}
          pageSize={PAGE_SIZE}
          onPageChange={setCurrentPage}
          itemLabel="STT agents"
        />

        {/* Details Modal */}
        <IntegrationDetailsModal
          integration={selectedIntegrationDetails}
          isOpen={isDetailsOpen}
          onClose={() => setIsDetailsOpen(false)}
        />

        {/* Creation Modal */}
        <AgentCreateModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          category="STT Agent"
        />
      </div>
    </RouteGuard>
  );
}

