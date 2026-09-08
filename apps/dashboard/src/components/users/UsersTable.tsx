"use client";

import React from "react";
import Link from "next/link";
import { 
  Eye, 
  Pencil, 
  Trash2, 
  Mail, 
  Phone,
  UserCheck, 
  Calendar 
} from "lucide-react";
import { User, UserStatus } from "../../types/user";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Button } from "../ui/button";

interface UsersTableProps {
  users: User[];
  isLoading?: boolean;
  onDeleteUser?: (userId: string) => void;
  onViewUser?: (user: User) => void;
}

export function UsersTable({
  users,
  isLoading = false,
  onDeleteUser,
  onViewUser,
}: UsersTableProps) {

  const getInitials = (name?: string) => {
    if (!name || typeof name !== "string") return "VX";
    const parts = name.trim().split(" ");
    if (parts.length >= 2 && parts[0] && parts[parts.length - 1]) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase() || "VX";
  };

  const renderStatus = (status: UserStatus) => {
    switch (status) {
      case "Active":
        return (
          <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
            <span>Active</span>
          </div>
        );
      case "Away":
        return (
          <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
            <span>Away</span>
          </div>
        );
      case "Do Not Disturb":
        return (
          <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full text-xs font-medium text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/60">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0" />
            <span>Do Not Disturb</span>
          </div>
        );
      default:
        return (
          <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/60">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0" />
            <span>{status}</span>
          </div>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="w-full rounded-xl border border-border bg-card p-6 shadow-xs">
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-12 w-full animate-pulse rounded-lg bg-muted/60" />
          ))}
        </div>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="w-full rounded-xl border border-dashed border-border bg-card/50 p-12 text-center shadow-xs">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-400 mb-3 border border-teal-500/20">
          <UserCheck className="h-6 w-6" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">No users in the system</h3>
        <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
          No user accounts exist yet. Get started by provisioning your first user account.
        </p>
        <div className="mt-4">
          <Button asChild size="sm" className="h-8 text-xs bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white">
            <a href="/users/create">+ Create User</a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full rounded-xl border border-border bg-card shadow-xs overflow-hidden">
      {/* 
        CRITICAL LAYOUT REQUIREMENT:
        Horizontally scrollable container with Sticky Left (Name) and Sticky Right (Actions) columns!
        The remaining columns (Role, Status, Phone, Email, Members, Joined) scroll freely underneath!
      */}
      <div className="overflow-x-auto custom-scrollbar relative">
        <table className="w-full border-separate border-spacing-0 text-left text-xs min-w-[1280px]">
          
          {/* Table Header */}
          <thead>
            <tr className="bg-muted font-semibold text-muted-foreground">
              
              {/* 1. STICKY LEFT: Name Column Header (100% Solid & Opaque) */}
              <th 
                scope="col"
                className="sticky left-0 z-40 py-3.5 pl-4 pr-6 bg-slate-100 dark:bg-slate-900 border-b border-r border-border shadow-[6px_0_16px_-4px_rgba(0,0,0,0.15)] dark:shadow-[6px_0_20px_-4px_rgba(0,0,0,0.7)] w-[210px] min-w-[210px]"
              >
                Name
              </th>

              {/* 2. SCROLLING MIDDLE: Role Column */}
              <th scope="col" className="py-3.5 px-4 min-w-[170px] border-b border-border bg-slate-50/80 dark:bg-slate-900/60">
                Role
              </th>

              {/* 3. SCROLLING MIDDLE: Status Column */}
              <th scope="col" className="py-3.5 px-4 min-w-[150px] border-b border-border bg-slate-50/80 dark:bg-slate-900/60">
                Status
              </th>

              {/* 4. SCROLLING MIDDLE: Phone Number Column */}
              <th scope="col" className="py-3.5 px-4 min-w-[160px] border-b border-border bg-slate-50/80 dark:bg-slate-900/60">
                Phone
              </th>

              {/* 5. SCROLLING MIDDLE: Email Column */}
              <th scope="col" className="py-3.5 px-4 min-w-[220px] border-b border-border bg-slate-50/80 dark:bg-slate-900/60">
                Email
              </th>

              {/* 6. SCROLLING MIDDLE: Joined Date Column */}
              <th scope="col" className="py-3.5 px-4 min-w-[160px] border-b border-border bg-slate-50/80 dark:bg-slate-900/60">
                Joined Date
              </th>

              {/* 7. STICKY RIGHT: Actions Column Header (100% Solid & Opaque) */}
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
            {users.map((user) => (
              <tr 
                key={user.id} 
                className="group transition-colors"
              >
                
                {/* 1. STICKY LEFT: Name Cell (100% OPAQUE Solid Background, No Transparency) */}
                <td className="sticky left-0 z-30 py-3 pl-4 pr-6 bg-white dark:bg-slate-950 group-hover:bg-slate-50 dark:group-hover:bg-slate-900 border-b border-r border-border shadow-[6px_0_16px_-4px_rgba(0,0,0,0.15)] dark:shadow-[6px_0_20px_-4px_rgba(0,0,0,0.7)] transition-colors w-[210px] min-w-[210px]">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9 border border-border/70 shrink-0">
                      <AvatarFallback className="bg-teal-700/15 text-teal-800 dark:bg-teal-500/20 dark:text-teal-300 font-bold text-xs">
                        {getInitials(user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.officialEmail || user.email)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold text-foreground truncate text-xs sm:text-[13px] group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors">
                        {user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.officialEmail || user.email || 'User'}
                      </span>
                      <span className="text-[11px] text-muted-foreground font-mono mt-0.5">
                        {user.employeeId || 'EMP-100'}
                      </span>
                    </div>
                  </div>
                </td>

                {/* 2. SCROLLING MIDDLE: Role */}
                <td className="py-3 px-4 text-foreground font-medium whitespace-nowrap min-w-[170px] border-b border-border bg-card group-hover:bg-muted/40 transition-colors">
                  <span className="text-xs font-semibold text-foreground/90">
                    {user.role || 'Member'}
                  </span>
                </td>

                {/* 3. SCROLLING MIDDLE: Status Column */}
                <td className="py-3 px-4 whitespace-nowrap min-w-[150px] border-b border-border bg-card group-hover:bg-muted/40 transition-colors">
                  {renderStatus(user.status || 'Active')}
                </td>

                {/* 4. SCROLLING MIDDLE: Phone Number */}
                <td className="py-3 px-4 text-muted-foreground whitespace-nowrap min-w-[160px] border-b border-border bg-card group-hover:bg-muted/40 transition-colors">
                  <div className="flex items-center gap-1.5 font-mono text-[11px]">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                    <span className="text-foreground/90">{user.phone || user.phoneNumber || "—"}</span>
                  </div>
                </td>

                {/* 5. SCROLLING MIDDLE: Email */}
                <td className="py-3 px-4 text-muted-foreground whitespace-nowrap min-w-[220px] border-b border-border bg-card group-hover:bg-muted/40 transition-colors">
                  <div className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                    <span className="truncate text-foreground/90 hover:text-foreground">{user.email || user.officialEmail || '—'}</span>
                  </div>
                </td>

                {/* 6. SCROLLING MIDDLE: Joined Date */}
                <td className="py-3 px-4 text-muted-foreground whitespace-nowrap min-w-[160px] border-b border-border bg-card group-hover:bg-muted/40 transition-colors">
                  <div className="flex items-center gap-1 text-[11px]">
                    <Calendar className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                    <span>{user.joinedDate || user.dateOfJoining || "Recently"}</span>
                  </div>
                </td>

                {/* 8. STICKY RIGHT: Actions Cell (100% OPAQUE Solid Background, No Transparency) */}
                <td className="sticky right-0 z-30 py-3 px-3 text-center bg-white dark:bg-slate-950 group-hover:bg-slate-50 dark:group-hover:bg-slate-900 border-b border-l border-border shadow-[-6px_0_16px_-4px_rgba(0,0,0,0.15)] dark:shadow-[-6px_0_20px_-4px_rgba(0,0,0,0.7)] transition-colors w-[130px] min-w-[130px]">
                  <div className="flex items-center justify-center gap-1">
                    
                    {/* View Button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-teal-700 dark:hover:text-teal-400 hover:bg-teal-500/10"
                      onClick={() => onViewUser && onViewUser(user)}
                      title="View user details"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span className="sr-only">View</span>
                    </Button>

                    {/* Edit Button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      asChild
                      className="h-7 w-7 text-muted-foreground hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-500/10"
                      title="Edit user"
                    >
                      <Link href={`/users/create?edit=${user.id}`}>
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="sr-only">Edit</span>
                      </Link>
                    </Button>

                    {/* Delete Button (Destructive red) */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10"
                      onClick={() => onDeleteUser && onDeleteUser(user.id)}
                      title="Delete user"
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
