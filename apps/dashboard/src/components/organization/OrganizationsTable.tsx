"use client";

import React from "react";
import Link from "next/link";
import { 
  Eye, 
  Pencil, 
  Trash2, 
  Mail, 
  Phone, 
  Globe, 
  Calendar,
  Building,
  Hash
} from "lucide-react";
import { Organization, OrganizationStatus } from "../../types/organization";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Button } from "../ui/button";

interface OrganizationsTableProps {
  organizations: Organization[];
  onDeleteOrg?: (id: string) => void;
  onViewOrg?: (org: Organization) => void;
}

export function OrganizationsTable({
  organizations,
  onDeleteOrg,
  onViewOrg,
}: OrganizationsTableProps) {
  const renderStatus = (status: OrganizationStatus) => {
    switch (status) {
      case "Active":
        return (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
            Active
          </div>
        );
      case "Pending":
        return (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/60">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
            Pending
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

  const getInitials = (name: string) => {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  if (organizations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-700/10 text-teal-800 dark:bg-teal-500/15 dark:text-teal-300 border border-teal-500/20 mb-3">
          <Building className="h-6 w-6" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">No organizations found</h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">
          No organization matches your search criteria. Create a new organization to get started.
        </p>
        <Button asChild size="sm" className="mt-4 gap-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs">
          <Link href="/organization/create">
            <Building className="h-3.5 w-3.5" />
            <span>Create Organization</span>
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
      <div className="overflow-x-auto custom-scrollbar relative">
        <table className="w-full border-separate border-spacing-0 text-left text-xs min-w-[1100px]">
          {/* Table Header */}
          <thead>
            <tr className="bg-muted font-semibold text-muted-foreground">
              {/* 1. STICKY LEFT: Organization Name (100% Solid & Opaque) */}
              <th 
                scope="col"
                className="sticky left-0 z-40 py-3.5 pl-4 pr-6 bg-slate-100 dark:bg-slate-900 border-b border-r border-border shadow-[6px_0_16px_-4px_rgba(0,0,0,0.15)] dark:shadow-[6px_0_20px_-4px_rgba(0,0,0,0.7)] w-[230px] min-w-[230px]"
              >
                Organization Name
              </th>

              {/* 2. Organization Code */}
              <th scope="col" className="py-3.5 px-4 min-w-[160px] border-b border-border bg-slate-50/80 dark:bg-slate-900/60">
                Organization Code
              </th>

              {/* 3. Email */}
              <th scope="col" className="py-3.5 px-4 min-w-[220px] border-b border-border bg-slate-50/80 dark:bg-slate-900/60">
                Email
              </th>

              {/* 4. Phone */}
              <th scope="col" className="py-3.5 px-4 min-w-[170px] border-b border-border bg-slate-50/80 dark:bg-slate-900/60">
                Phone Number
              </th>

              {/* 5. Country */}
              <th scope="col" className="py-3.5 px-4 min-w-[160px] border-b border-border bg-slate-50/80 dark:bg-slate-900/60">
                Country
              </th>

              {/* 6. Created Date */}
              <th scope="col" className="py-3.5 px-4 min-w-[160px] border-b border-border bg-slate-50/80 dark:bg-slate-900/60">
                Created
              </th>

              {/* 7. Status */}
              <th scope="col" className="py-3.5 px-4 min-w-[130px] border-b border-border bg-slate-50/80 dark:bg-slate-900/60">
                Status
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
            {organizations.map((org) => (
              <tr 
                key={org.id}
                className="group transition-colors"
              >
                {/* 1. STICKY LEFT: Name Cell */}
                <td className="sticky left-0 z-30 py-3 pl-4 pr-6 bg-white dark:bg-slate-950 group-hover:bg-slate-50 dark:group-hover:bg-slate-900 border-b border-r border-border shadow-[6px_0_16px_-4px_rgba(0,0,0,0.15)] dark:shadow-[6px_0_20px_-4px_rgba(0,0,0,0.7)] transition-colors w-[230px] min-w-[230px]">
                  <div className="flex items-center gap-3">
                    {org.logoUrl ? (
                      <img src={org.logoUrl} alt={org.name} className="h-9 w-9 rounded-lg object-cover border border-border shrink-0" />
                    ) : (
                      <Avatar className="h-9 w-9 rounded-lg border border-border/70 shrink-0">
                        <AvatarFallback className="bg-teal-700/15 text-teal-800 dark:bg-teal-500/20 dark:text-teal-300 font-bold text-xs rounded-lg">
                          {getInitials(org.name)}
                        </AvatarFallback>
                      </Avatar>
                    )}

                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold text-foreground truncate text-xs sm:text-[13px] group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors">
                        {org.name}
                      </span>
                      {org.industry && (
                        <span className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {org.industry}
                        </span>
                      )}
                    </div>
                  </div>
                </td>

                {/* 2. Organization Code */}
                <td className="py-3 px-4 whitespace-nowrap min-w-[160px] border-b border-border bg-card group-hover:bg-muted/40 transition-colors">
                  <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold px-2 py-0.5 rounded bg-muted/60 text-foreground border border-border">
                    <Hash className="h-3 w-3 text-muted-foreground" />
                    {org.code}
                  </span>
                </td>

                {/* 3. Email */}
                <td className="py-3 px-4 text-muted-foreground whitespace-nowrap min-w-[220px] border-b border-border bg-card group-hover:bg-muted/40 transition-colors">
                  <div className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                    <span className="truncate text-foreground/90">{org.email}</span>
                  </div>
                </td>

                {/* 4. Phone Number */}
                <td className="py-3 px-4 text-muted-foreground whitespace-nowrap min-w-[170px] border-b border-border bg-card group-hover:bg-muted/40 transition-colors">
                  <div className="flex items-center gap-1.5 font-mono text-[11px]">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                    <span className="text-foreground/90">{org.phone}</span>
                  </div>
                </td>

                {/* 5. Country */}
                <td className="py-3 px-4 text-muted-foreground whitespace-nowrap min-w-[160px] border-b border-border bg-card group-hover:bg-muted/40 transition-colors">
                  <div className="flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                    <span className="text-foreground/90 font-medium">{org.country}</span>
                  </div>
                </td>

                {/* 6. Created Date */}
                <td className="py-3 px-4 text-muted-foreground whitespace-nowrap min-w-[160px] border-b border-border bg-card group-hover:bg-muted/40 transition-colors">
                  <div className="flex items-center gap-1 text-[11px]">
                    <Calendar className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                    <span>{org.createdAt}</span>
                  </div>
                </td>

                {/* 7. Status */}
                <td className="py-3 px-4 whitespace-nowrap min-w-[130px] border-b border-border bg-card group-hover:bg-muted/40 transition-colors">
                  {renderStatus(org.status)}
                </td>

                {/* 8. STICKY RIGHT: Actions */}
                <td className="sticky right-0 z-30 py-3 px-3 text-center bg-white dark:bg-slate-950 group-hover:bg-slate-50 dark:group-hover:bg-slate-900 border-b border-l border-border shadow-[-6px_0_16px_-4px_rgba(0,0,0,0.15)] dark:shadow-[-6px_0_20px_-4px_rgba(0,0,0,0.7)] transition-colors w-[130px] min-w-[130px]">
                  <div className="flex items-center justify-center gap-1">
                    {/* View Details */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-teal-700 dark:hover:text-teal-400 hover:bg-teal-500/10"
                      onClick={() => onViewOrg && onViewOrg(org)}
                      title="View organization details"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span className="sr-only">View</span>
                    </Button>

                    {/* Edit Organization */}
                    <Button
                      variant="ghost"
                      size="icon"
                      asChild
                      className="h-7 w-7 text-muted-foreground hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-500/10"
                      title="Edit organization"
                    >
                      <Link href={`/organization/create?edit=${org.id}`}>
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="sr-only">Edit</span>
                      </Link>
                    </Button>

                    {/* Delete Organization */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10"
                      onClick={() => onDeleteOrg && onDeleteOrg(org.id)}
                      title="Delete organization"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="sr-only">Delete</span>
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
