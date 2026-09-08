"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
  Search, 
  Plus, 
  FileSpreadsheet, 
  FileText, 
  FileType,
  X,
  Building
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "../ui/dialog";
import { Organization, OrganizationFilters } from "../../types/organization";
import { exportOrgsToExcel, exportOrgsToPdf, exportOrgsToWord } from "../../lib/export-utils";

interface OrganizationToolbarProps {
  filters: OrganizationFilters;
  onFilterChange: (newFilters: Partial<OrganizationFilters>) => void;
  filteredOrgs: Organization[];
}

export function OrganizationToolbar({
  filters,
  onFilterChange,
  filteredOrgs,
}: OrganizationToolbarProps) {
  const [exporting, setExporting] = useState<string | null>(null);
  const [pendingExport, setPendingExport] = useState<"excel" | "pdf" | "word" | null>(null);

  const handleConfirmExport = async () => {
    const type = pendingExport;
    setPendingExport(null);
    if (!type) return;

    try {
      setExporting(type);
      if (type === "excel") {
        exportOrgsToExcel(filteredOrgs);
      } else if (type === "pdf") {
        exportOrgsToPdf(filteredOrgs);
      } else if (type === "word") {
        await exportOrgsToWord(filteredOrgs);
      }
    } catch (err) {
      console.error("Export error", err);
    } finally {
      setExporting(null);
    }
  };

  return (
    <>
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 py-1">
        {/* Left side: Search & Filter Dropdowns */}
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          {/* Search Input with Clear Button */}
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search by name, code, email, phone, or country..."
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

          {/* Status filter */}
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
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Right side: Export cluster + Create Organization button */}
        <div className="flex items-center gap-2 self-end md:self-auto">
          {/* Export Buttons: Excel, PDF, Word */}
          <div className="flex items-center gap-1 border border-border rounded-lg p-0.5 bg-muted/30">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setPendingExport("excel")}
              disabled={exporting !== null || filteredOrgs.length === 0}
              className="h-8 w-8 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
              title="Export to Excel (.xlsx)"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span className="sr-only">Export to Excel</span>
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setPendingExport("pdf")}
              disabled={exporting !== null || filteredOrgs.length === 0}
              className="h-8 w-8 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors"
              title="Export to PDF (.pdf)"
            >
              <FileText className="h-4 w-4" />
              <span className="sr-only">Export to PDF</span>
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setPendingExport("word")}
              disabled={exporting !== null || filteredOrgs.length === 0}
              className="h-8 w-8 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 transition-colors"
              title="Export to Word (.docx)"
            >
              <FileType className="h-4 w-4" />
              <span className="sr-only">Export to Word</span>
            </Button>
          </div>

          <span className="h-6 w-px bg-border mx-0.5 hidden sm:inline-block" />

          {/* "+ Create Organization" Button */}
          <Button asChild className="h-9 px-3.5 gap-1.5 bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white font-medium text-xs shadow-sm">
            <Link href="/organization/create">
              <Plus className="h-4 w-4" />
              <span>Create Organization</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Confirmation Dialog before saving document */}
      <Dialog 
        open={pendingExport !== null} 
        onOpenChange={(open) => !open && setPendingExport(null)}
      >
        <DialogContent className="max-w-md p-6">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700/10 text-teal-800 dark:bg-teal-500/15 dark:text-teal-300 border border-teal-500/20 shrink-0">
                {pendingExport === "excel" && <FileSpreadsheet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
                {pendingExport === "pdf" && <FileText className="h-5 w-5 text-rose-600 dark:text-rose-400" />}
                {pendingExport === "word" && <FileType className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  Confirm Export & Save
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Do you want to save this document to your device?
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="py-3 text-xs space-y-2.5">
            <div className="bg-muted/40 rounded-lg p-3 border border-border/70 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Document Format:</span>
                <span className="font-semibold text-foreground">
                  {pendingExport === "excel" && "Microsoft Excel (.xlsx)"}
                  {pendingExport === "pdf" && "Adobe PDF (.pdf)"}
                  {pendingExport === "word" && "Microsoft Word (.docx)"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">File Name:</span>
                <span className="font-mono text-[11px] text-foreground font-semibold">
                  {pendingExport === "excel" && "vopx-organizations.xlsx"}
                  {pendingExport === "pdf" && "vopx-organizations.pdf"}
                  {pendingExport === "word" && "vopx-organizations.docx"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Records to Export:</span>
                <span className="font-semibold text-teal-700 dark:text-teal-400">
                  {filteredOrgs.length} organization{filteredOrgs.length === 1 ? "" : "s"}
                </span>
              </div>
            </div>
            <p className="text-muted-foreground text-[11px]">
              Clicking &ldquo;Save Document&rdquo; will generate the file and download it directly to your device.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPendingExport(null)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmExport}
              className="text-xs bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white font-medium shadow-sm"
            >
              Save Document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
