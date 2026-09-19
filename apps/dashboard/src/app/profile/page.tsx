"use client";

import React, { useState, useEffect } from "react";
import { 
  User as UserIcon, 
  Mail, 
  Phone, 
  Calendar, 
  ShieldCheck, 
  Building2, 
  Briefcase, 
  Globe, 
  UserCheck, 
  ArrowLeft,
  Sparkles
} from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "../../components/ui/avatar";
import { Button } from "../../components/ui/button";
import { useAuth } from "../../context/auth-context";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

interface ManagerInfo {
  id: string;
  name: string;
  email?: string;
  officialEmail?: string;
  role?: string;
}

interface ProfileData {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  officialEmail?: string;
  personalEmail?: string;
  employeeId?: string;
  phone?: string;
  phoneNumber?: string;
  dateOfBirth?: string;
  dateOfJoining?: string;
  joinedDate?: string;
  nationality?: string;
  gender?: string;
  role?: string;
  status?: string;
  avatarUrl?: string;
  managerId?: string;
  manager?: ManagerInfo | null;
}

export default function ProfilePage() {
  const { token, user: authUser } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      if (token) {
        try {
          const res = await fetch(`${API_BASE}/api/users/me`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          if (res.ok) {
            const data = await res.json();
            if (isMounted && data.user) {
              setProfile(data.user);
              setIsLoading(false);
              return;
            }
          }
        } catch (err) {
          console.warn("Could not fetch /api/users/me:", err);
        }
      }

      // Fallback using auth user context
      if (isMounted) {
        if (authUser) {
          setProfile({
            id: authUser.id || "me",
            name: authUser.name || `${(authUser as any).firstName || ''} ${(authUser as any).lastName || ''}`.trim(),
            email: authUser.email,
            role: authUser.role || "Member",
            status: "Active",
          });
        }
        setIsLoading(false);
      }
    }

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [token, authUser]);

  const getInitials = (name?: string) => {
    if (!name || typeof name !== "string") return "VX";
    const parts = name.trim().split(" ");
    if (parts.length >= 2 && parts[0] && parts[parts.length - 1]) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase() || "VX";
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 max-w-5xl mx-auto animate-pulse">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="h-40 w-full bg-muted rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-64 bg-muted rounded-xl" />
          <div className="h-64 bg-muted rounded-xl" />
        </div>
      </div>
    );
  }

  const fullName = profile?.name || `${profile?.firstName || ''} ${profile?.lastName || ''}`.trim() || profile?.officialEmail || profile?.email || "User Profile";
  const managerEmail = profile?.manager?.officialEmail || profile?.manager?.email;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto pb-16">
      
      {/* Page Header */}
      <div className="flex items-center gap-3 pb-2 border-b border-border/60">
        <Button variant="ghost" size="icon" asChild className="h-8 w-8 text-muted-foreground">
          <Link href="/users">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <UserIcon className="h-5 w-5 text-teal-700 dark:text-teal-400" />
            My Profile
          </h1>
          <p className="text-xs text-muted-foreground">
            View your employment details, role credentials, and reporting manager information.
          </p>
        </div>
      </div>

      {/* Hero Banner Card */}
      <div className="rounded-xl border border-border bg-gradient-to-r from-teal-900/10 via-card to-card p-6 shadow-sm relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <Avatar className="h-20 w-20 border-2 border-teal-500/30 shadow-md">
            {profile?.avatarUrl && <AvatarImage src={profile.avatarUrl} alt={fullName} />}
            <AvatarFallback className="bg-teal-700 text-white font-bold text-xl">
              {getInitials(fullName)}
            </AvatarFallback>
          </Avatar>

          <div className="space-y-1.5 flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-2xl font-bold text-foreground">{fullName}</h2>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-500/10 px-3 py-1 text-xs font-semibold text-teal-700 dark:text-teal-300 border border-teal-500/20">
                <ShieldCheck className="h-3.5 w-3.5" />
                {profile?.role || "Member"}
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {profile?.status || "Active"}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground pt-1">
              <div className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-muted-foreground/70" />
                <span>{profile?.officialEmail || profile?.email || "—"}</span>
              </div>
              <div className="flex items-center gap-1.5 font-mono">
                <Briefcase className="h-3.5 w-3.5 text-muted-foreground/70" />
                <span>ID: {profile?.employeeId || "—"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2-Column Grid Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Card 1: Personal & Work Information */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-border/60">
            <UserIcon className="h-4 w-4 text-teal-700 dark:text-teal-400" />
            <h3 className="text-sm font-semibold text-foreground">Personal & Employment Details</h3>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-muted-foreground block text-[11px] mb-0.5">Employee ID</span>
              <span className="font-mono font-medium text-foreground">{profile?.employeeId || "—"}</span>
            </div>

            <div>
              <span className="text-muted-foreground block text-[11px] mb-0.5">Official Email</span>
              <span className="font-medium text-foreground truncate block">{profile?.officialEmail || profile?.email || "—"}</span>
            </div>

            <div>
              <span className="text-muted-foreground block text-[11px] mb-0.5">Personal Email</span>
              <span className="font-medium text-foreground truncate block">{profile?.personalEmail || "—"}</span>
            </div>

            <div>
              <span className="text-muted-foreground block text-[11px] mb-0.5">Phone Number</span>
              <span className="font-mono font-medium text-foreground">{profile?.phone || profile?.phoneNumber || "—"}</span>
            </div>

            <div>
              <span className="text-muted-foreground block text-[11px] mb-0.5">Date of Joining</span>
              <span className="font-medium text-foreground">{profile?.dateOfJoining || profile?.joinedDate || "—"}</span>
            </div>

            <div>
              <span className="text-muted-foreground block text-[11px] mb-0.5">Date of Birth</span>
              <span className="font-medium text-foreground">{profile?.dateOfBirth || "—"}</span>
            </div>

            <div>
              <span className="text-muted-foreground block text-[11px] mb-0.5">Nationality</span>
              <span className="font-medium text-foreground">{profile?.nationality || "—"}</span>
            </div>

            <div>
              <span className="text-muted-foreground block text-[11px] mb-0.5">Gender</span>
              <span className="font-medium text-foreground">{profile?.gender || "—"}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Reporting Manager */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-border/60">
            <UserCheck className="h-4 w-4 text-teal-700 dark:text-teal-400" />
            <h3 className="text-sm font-semibold text-foreground">Reporting Manager</h3>
          </div>

          {profile?.manager ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3.5 p-3.5 rounded-lg border border-teal-500/20 bg-teal-500/5">
                <Avatar className="h-11 w-11 border border-teal-500/30 shrink-0">
                  <AvatarFallback className="bg-teal-700 text-white font-bold text-xs">
                    {getInitials(profile.manager.name)}
                  </AvatarFallback>
                </Avatar>

                <div className="space-y-0.5 min-w-0">
                  <h4 className="text-sm font-semibold text-foreground truncate">{profile.manager.name}</h4>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-teal-700 dark:text-teal-300 font-medium">
                      {profile.manager.role || "Manager"}
                    </span>
                  </div>
                  {managerEmail && (
                    <p className="text-[11px] text-muted-foreground truncate">{managerEmail}</p>
                  )}
                </div>
              </div>

              {managerEmail && (
                <Button asChild variant="outline" size="sm" className="w-full text-xs gap-2">
                  <a href={`mailto:${managerEmail}`}>
                    <Mail className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400" />
                    Send Email to Manager
                  </a>
                </Button>
              )}
            </div>
          ) : (
            <div className="py-8 text-center border border-dashed border-border rounded-lg bg-muted/20">
              <Building2 className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-xs font-semibold text-foreground">No Manager Assigned</p>
              <p className="text-[11px] text-muted-foreground max-w-xs mx-auto mt-1">
                You currently do not have a reporting manager set for your account. Contact your administrator if this needs to be updated.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
