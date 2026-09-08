"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Organization, OrganizationStatus } from "../../types/organization";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "../ui/dialog";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Button } from "../ui/button";
import { 
  Building,
  Mail, 
  Phone, 
  Globe, 
  Calendar, 
  Pencil, 
  User as UserIcon, 
  Briefcase, 
  Check, 
  Copy,
  Hash
} from "lucide-react";

interface OrganizationDetailsModalProps {
  org: Organization | null;
  isOpen: boolean;
  onClose: () => void;
}

export function OrganizationDetailsModal({
  org,
  isOpen,
  onClose,
}: OrganizationDetailsModalProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!org) return null;

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const renderStatusBadge = (status: OrganizationStatus) => {
    switch (status) {
      case "Active":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60">
            <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
            Active
          </span>
        );
      case "Pending":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/60">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
            Pending
          </span>
        );
      case "Inactive":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700">
            <span className="h-2 w-2 rounded-full bg-slate-400 shrink-0" />
            Inactive
          </span>
        );
      default:
        return <span>{status}</span>;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg p-6">
        {/* Header */}
        <DialogHeader className="pb-3 border-b border-border/70">
          <div className="flex items-center gap-3.5">
            {org.logoUrl ? (
              <img src={org.logoUrl} alt={org.name} className="h-14 w-14 rounded-xl object-cover border-2 border-teal-600/30 shrink-0 shadow-sm" />
            ) : (
              <Avatar className="h-14 w-14 rounded-xl border-2 border-teal-600/30 shrink-0 shadow-sm">
                <AvatarFallback className="bg-teal-700/15 text-teal-800 dark:bg-teal-500/20 dark:text-teal-300 font-bold text-base rounded-xl">
                  {org.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            )}

            <div>
              <DialogTitle className="text-lg font-bold text-foreground">
                {org.name}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded border border-border">
                  <Hash className="h-3 w-3 text-muted-foreground" />
                  {org.code}
                </span>
                {renderStatusBadge(org.status)}
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Content sections */}
        <div className="space-y-4 py-2 text-xs">
          {/* Section 1: Contact Information */}
          <div className="space-y-2">
            <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400" />
              Corporate Communications
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-muted/30 p-3 rounded-lg border border-border/60">
              <div>
                <span className="text-[10px] text-muted-foreground block">Official Email</span>
                <div className="flex items-center justify-between gap-1 mt-0.5">
                  <span className="font-medium text-foreground truncate">{org.email}</span>
                  <button 
                    onClick={() => copyToClipboard(org.email, "email")}
                    className="text-muted-foreground hover:text-foreground p-0.5"
                    title="Copy email"
                  >
                    {copiedField === "email" ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-muted-foreground block">Phone Number</span>
                <div className="flex items-center justify-between gap-1 mt-0.5">
                  <span className="font-medium font-mono text-foreground">{org.phone}</span>
                  <button 
                    onClick={() => copyToClipboard(org.phone, "phone")}
                    className="text-muted-foreground hover:text-foreground p-0.5"
                    title="Copy phone"
                  >
                    {copiedField === "phone" ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Enterprise Details */}
          <div className="space-y-2">
            <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Building className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400" />
              Organizational Parameters
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-muted/30 p-3 rounded-lg border border-border/60">
              <div>
                <span className="text-[10px] text-muted-foreground block">Country of Operation</span>
                <span className="font-medium text-foreground block mt-0.5 flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                  {org.country}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-muted-foreground block">Primary Administrator</span>
                <span className="font-medium text-foreground block mt-0.5 flex items-center gap-1.5">
                  <UserIcon className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                  {org.adminName || "Not specified"}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-muted-foreground block">Industry / Sector</span>
                <span className="font-medium text-foreground block mt-0.5 flex items-center gap-1.5">
                  <Briefcase className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                  {org.industry || "Enterprise Telephony"}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-muted-foreground block">Registration Date</span>
                <span className="font-medium text-foreground block mt-0.5 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                  {org.createdAt}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="pt-3 border-t border-border flex items-center justify-between sm:justify-between">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            Close
          </Button>

          <Button
            asChild
            size="sm"
            className="text-xs gap-1.5 bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white font-medium"
          >
            <Link href={`/organization/create?edit=${org.id}`}>
              <Pencil className="h-3.5 w-3.5" />
              <span>Edit Organization</span>
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
