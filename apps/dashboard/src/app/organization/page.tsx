"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Building } from "lucide-react";
import { OrganizationToolbar } from "../../components/organization/OrganizationToolbar";
import { OrganizationsTable } from "../../components/organization/OrganizationsTable";
import { OrganizationDetailsModal } from "../../components/organization/OrganizationDetailsModal";
import { INITIAL_MOCK_ORGANIZATIONS } from "../../lib/mock-organizations";
import { Organization, OrganizationFilters } from "../../types/organization";

const STORAGE_KEY = "vopx_organizations_data_v1";

export default function OrganizationPage() {
  const [organizations, setOrganizations] = useState<Organization[]>(INITIAL_MOCK_ORGANIZATIONS);
  const [filters, setFilters] = useState<OrganizationFilters>({
    search: "",
    status: "ALL",
    country: "ALL",
  });
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Load and merge local storage with initial mock data
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      let list: Organization[] = [];
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            list = parsed;
          }
        } catch (e) {}
      }

      // Ensure initial demo organizations exist
      const existingIds = new Set(list.map((o) => o.id));
      const existingCodes = new Set(list.map((o) => o.code.toUpperCase()));
      const toAdd = INITIAL_MOCK_ORGANIZATIONS.filter(
        (m) => !existingIds.has(m.id) && !existingCodes.has(m.code.toUpperCase())
      );

      const combined = [...list, ...toAdd];
      setOrganizations(combined);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(combined));
    } catch (e) {
      console.error("Failed to load organizations", e);
    }
  }, []);

  // Filter organizations based on multi-field search and filters
  const filteredOrgs = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, "");
    const tokens = q ? q.split(/\s+/).filter(Boolean) : [];

    return organizations.filter((org) => {
      // 1. Search filter
      let matchesSearch = true;
      if (tokens.length > 0) {
        const searchableText = [
          org.name,
          org.code,
          org.email,
          org.phone,
          org.country,
          org.industry,
          org.adminName,
          org.status
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        const matchesTokens = tokens.every((token) => searchableText.includes(token));
        const phoneDigits = (org.phone || "").replace(/\D/g, "");
        const matchesPhoneDigits = qDigits.length >= 3 && phoneDigits.includes(qDigits);

        matchesSearch = matchesTokens || matchesPhoneDigits;
      }

      // 2. Status filter
      const matchesStatus =
        filters.status === "ALL" || org.status === filters.status;

      return matchesSearch && matchesStatus;
    });
  }, [organizations, filters]);

  // Handle Delete
  const handleDeleteOrg = (id: string) => {
    const updated = organizations.filter((o) => o.id !== id);
    setOrganizations(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {}
  };

  // Handle View Details
  const handleViewOrg = (org: Organization) => {
    setSelectedOrg(org);
    setIsDetailsOpen(true);
  };

  const handleFilterChange = (newFilters: Partial<OrganizationFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  return (
    <div className="space-y-5">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-border/60">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700/10 text-teal-800 dark:bg-teal-500/15 dark:text-teal-300 border border-teal-500/20 shadow-2xs">
            <Building className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Organizations Directory
            </h1>
            <p className="text-xs text-muted-foreground">
              Manage enterprise tenants, corporate credentials, country domains, and billing boundaries.
            </p>
          </div>
        </div>
      </div>

      {/* 2. Toolbar */}
      <OrganizationToolbar
        filters={filters}
        onFilterChange={handleFilterChange}
        filteredOrgs={filteredOrgs}
      />

      {/* 3. Table */}
      <OrganizationsTable
        organizations={filteredOrgs}
        onDeleteOrg={handleDeleteOrg}
        onViewOrg={handleViewOrg}
      />

      {/* 4. Details Modal */}
      <OrganizationDetailsModal
        org={selectedOrg}
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
      />
    </div>
  );
}
