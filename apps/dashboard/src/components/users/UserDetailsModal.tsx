"use client";

import React, { useState } from "react";
import Link from "next/link";
import { User, UserStatus } from "../../types/user";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from "../ui/dialog";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Button } from "../ui/button";
import { 
  Mail, 
  Phone, 
  Globe, 
  Calendar, 
  Layers, 
  Pencil, 
  User as UserIcon, 
  ShieldCheck, 
  FileCheck, 
  Check, 
  Copy,
  Clock
} from "lucide-react";

interface UserDetailsModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
}

export function UserDetailsModal({
  user,
  isOpen,
  onClose,
}: UserDetailsModalProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!user) return null;

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const renderStatusBadge = (status: UserStatus) => {
    switch (status) {
      case "Active":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60">
            <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
            Active
          </span>
        );
      case "Away":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/60">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
            Away
          </span>
        );
      case "Do Not Disturb":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/60">
            <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0" />
            Do Not Disturb
          </span>
        );
      default:
        return <span>{status}</span>;
    }
  };

  const displayName = user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.officialEmail || user.email || 'User';
  const initials = displayName.slice(0, 2).toUpperCase() || 'VX';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto p-6">
        
        {/* Profile Card Header */}
        <DialogHeader className="pb-3 border-b border-border/70">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={displayName}
                  className="h-14 w-14 rounded-full object-cover border-2 border-teal-600/30 shrink-0 shadow-sm"
                />
              ) : (
                <Avatar className="h-14 w-14 border-2 border-teal-600/30 shrink-0 shadow-sm">
                  <AvatarFallback className="bg-teal-700/15 text-teal-800 dark:bg-teal-500/20 dark:text-teal-300 font-bold text-base">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              )}

              <div>
                <DialogTitle className="text-lg font-bold text-foreground">
                  {displayName}
                </DialogTitle>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-mono text-xs text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded border border-border">
                    {user.employeeId || 'EMP-100'}
                  </span>
                  {renderStatusBadge(user.status || 'Active')}
                </div>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Detailed Profile Sections */}
        <div className="space-y-5 py-2 text-xs">

          {/* Section 1: Contact & Credentials */}
          <div className="space-y-2">
            <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400" />
              Contact & Credentials
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-muted/30 p-3 rounded-lg border border-border/60">
              <div>
                <span className="text-[10px] text-muted-foreground block">Official Email</span>
                <div className="flex items-center justify-between gap-1 mt-0.5">
                  <span className="font-medium text-foreground truncate">{user.officialEmail || user.email || "Not provided"}</span>
                  {(user.officialEmail || user.email) && (
                    <button 
                      onClick={() => copyToClipboard(user.officialEmail || user.email || "", "email")}
                      className="text-muted-foreground hover:text-foreground p-0.5"
                      title="Copy official email"
                    >
                      {copiedField === "email" ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    </button>
                  )}
                </div>
              </div>

              <div>
                <span className="text-[10px] text-muted-foreground block">Personal Email</span>
                <span className="font-medium text-foreground block mt-0.5 truncate">
                  {user.personalEmail || "Not provided"}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-muted-foreground block">Phone Number</span>
                <div className="flex items-center justify-between gap-1 mt-0.5">
                  <span className="font-medium font-mono text-foreground">{user.phone || user.phoneNumber || "Not provided"}</span>
                  {(user.phone || user.phoneNumber) && (
                    <button 
                      onClick={() => copyToClipboard(user.phone || user.phoneNumber || "", "phone")}
                      className="text-muted-foreground hover:text-foreground p-0.5"
                      title="Copy phone"
                    >
                      {copiedField === "phone" ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    </button>
                  )}
                </div>
              </div>

              <div>
                <span className="text-[10px] text-muted-foreground block">Nationality</span>
                <span className="font-medium text-foreground block mt-0.5">
                  {user.nationality || "Not specified"}
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Organization & System Access */}
          <div className="space-y-2">
            <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400" />
              Role & System Access
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-muted/30 p-3 rounded-lg border border-border/60">
              <div>
                <span className="text-[10px] text-muted-foreground block">Assigned Role</span>
                <span className="font-semibold text-teal-700 dark:text-teal-300 block mt-0.5">
                  {user.role || "Member"}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-muted-foreground block">Joined Date</span>
                <span className="font-medium text-foreground block mt-0.5">
                  {user.joinedDate || user.dateOfJoining || "Recently"}
                </span>
              </div>
            </div>
          </div>

          {/* Section 3: Personal Information */}
          <div className="space-y-2">
            <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <UserIcon className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400" />
              Personal Details
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-muted/30 p-3 rounded-lg border border-border/60">
              <div>
                <span className="text-[10px] text-muted-foreground block">Gender</span>
                <span className="font-medium text-foreground block mt-0.5">
                  {user.gender || "Not specified"}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-muted-foreground block">Date of Birth</span>
                <span className="font-medium text-foreground block mt-0.5">
                  {user.dateOfBirth || "Not provided"}
                </span>
              </div>
            </div>
          </div>

          {/* Section 4: Signature & Documentation */}
          {(user.avatarUrl || user.signatureUrl) && (
            <div className="space-y-2">
              <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <FileCheck className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400" />
                Verification & Assets
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-muted/30 p-3 rounded-lg border border-border/60">
                {user.avatarUrl && (
                  <div>
                    <span className="text-[10px] text-muted-foreground block mb-1">Profile Photo</span>
                    <img
                      src={user.avatarUrl}
                      alt="Profile"
                      className="h-20 w-20 object-cover rounded-lg border border-border shadow-xs"
                    />
                  </div>
                )}

                {user.signatureUrl && (
                  <div>
                    <span className="text-[10px] text-muted-foreground block mb-1">Digital Signature</span>
                    <img
                      src={user.signatureUrl}
                      alt="Signature"
                      className="h-16 max-w-[180px] object-contain rounded border border-border bg-white p-1"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

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
            <Link href={`/users/create?edit=${user.id}`}>
              <Pencil className="h-3.5 w-3.5" />
              <span>Edit User Profile</span>
            </Link>
          </Button>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}
