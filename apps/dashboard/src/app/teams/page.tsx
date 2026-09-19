"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Users,
  UserPlus,
  Search,
  RotateCcw,
  Trash2,
  Edit2,
  CheckCircle2,
  Globe,
  Mic,
  Cpu,
  Archive,
  RefreshCw,
  X,
  Mail,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { RadioGroup, RadioGroupItem } from "../../components/ui/radio-group";
import { useAuth } from "../../context/auth-context";
import { usePermissions } from "../../context/permissions-context";
import { RouteGuard } from "../../components/shell/RouteGuard";
import { TeamMember, ProjectAssigned } from "../../types/team";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

const INITIAL_MOCK_TEAMS: Omit<TeamMember, "id">[] = [
  {
    firstName: "Durga",
    lastName: "Prasad",
    name: "Durga Prasad",
    employeeId: "EMP-1001",
    officialEmail: "durga@vopx.ai",
    personalEmail: "durga.personal@gmail.com",
    phone: "+974 5512 3456",
    dateOfBirth: "1994-05-12",
    dateOfJoining: "2024-01-15",
    nationality: "Qatar",
    gender: "Male",
    role: "Fullstack Architect & Platform Lead",
    status: "Active",
    projectAssigned: "Both",
    isDeleted: false,
  },
  {
    firstName: "Alexander",
    lastName: "Novak",
    name: "Alexander Novak",
    employeeId: "EMP-1048",
    officialEmail: "alex.novak@vopx.ai",
    personalEmail: "alex.personal@gmail.com",
    phone: "+974 4488 9900",
    dateOfBirth: "1996-08-24",
    dateOfJoining: "2024-02-01",
    nationality: "Qatar",
    gender: "Male",
    role: "Frontend Engineer (vop.x Dashboard)",
    status: "Active",
    projectAssigned: "vopx website",
    isDeleted: false,
  },
  {
    firstName: "Sarah",
    lastName: "Al-Mansoor",
    name: "Sarah Al-Mansoor",
    employeeId: "EMP-1092",
    officialEmail: "sarah.mansoor@vopx.ai",
    personalEmail: "sarah.personal@gmail.com",
    phone: "+974 6611 2233",
    dateOfBirth: "1995-11-03",
    dateOfJoining: "2024-03-10",
    nationality: "Qatar",
    gender: "Female",
    role: "Voice Orchestration Pipeline Engineer",
    status: "Active",
    projectAssigned: "voice orchestration platform",
    isDeleted: false,
  },
];

export default function TeamsPage() {
  const { token } = useAuth();
  const { can } = usePermissions();

  const [activeTab, setActiveTab] = useState<"active" | "archived">("active");
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>("");
  const [projectFilter, setProjectFilter] = useState<string>("ALL");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);

  // Form State matching User attributes
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    employeeId: "",
    countryCode: "+974",
    phone: "",
    officialEmail: "",
    personalEmail: "",
    dateOfBirth: "",
    dateOfJoining: new Date().toISOString().split("T")[0],
    nationality: "Qatar",
    gender: "Male" as "Male" | "Female" | "Other",
    role: "Administrator",
    status: "Active",
    projectAssigned: "Both" as ProjectAssigned,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Fetch Team Members from API (with fallback seeding)
  const fetchTeams = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/teams?includeDeleted=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        let data: TeamMember[] = await res.json();

        // Seed initial team members into Postgres if tenant has 0
        if (data.length === 0) {
          const seedPromises = INITIAL_MOCK_TEAMS.map((m) =>
            fetch(`${API_BASE}/api/teams`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(m),
            })
          );
          await Promise.allSettled(seedPromises);

          const reFetch = await fetch(`${API_BASE}/api/teams?includeDeleted=true`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (reFetch.ok) {
            data = await reFetch.json();
          }
        }
        setMembers(data);
      }
    } catch (e) {
      console.error("Failed to fetch teams", e);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  // Open Modal for Create or Edit
  const handleOpenModal = (member?: TeamMember) => {
    setErrors({});
    if (member) {
      setEditingMember(member);
      let code = "+974";
      let num = member.phone || member.phoneNumber || "";
      if (num && num.startsWith("+")) {
        const parts = num.split(" ");
        code = parts[0];
        num = parts.slice(1).join(" ");
      }

      setFormData({
        firstName: member.firstName || member.name.split(" ")[0] || "",
        lastName: member.lastName || member.name.split(" ").slice(1).join(" ") || "",
        employeeId: member.employeeId || "",
        countryCode: code,
        phone: num,
        officialEmail: member.officialEmail || member.email || "",
        personalEmail: member.personalEmail || "",
        dateOfBirth: member.dateOfBirth || "",
        dateOfJoining: member.dateOfJoining || new Date().toISOString().split("T")[0],
        nationality: member.nationality || "Qatar",
        gender: (member.gender as any) || "Male",
        role: member.role || "Administrator",
        status: member.status || "Active",
        projectAssigned: member.projectAssigned || "Both",
      });
    } else {
      setEditingMember(null);
      setFormData({
        firstName: "",
        lastName: "",
        employeeId: "",
        countryCode: "+974",
        phone: "",
        officialEmail: "",
        personalEmail: "",
        dateOfBirth: "",
        dateOfJoining: new Date().toISOString().split("T")[0],
        nationality: "Qatar",
        gender: "Male",
        role: "Administrator",
        status: "Active",
        projectAssigned: "Both",
      });
    }
    setIsModalOpen(true);
  };

  // Validation
  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.firstName.trim()) newErrors.firstName = "First name is required";
    if (!formData.lastName.trim()) newErrors.lastName = "Last name is required";
    if (!formData.employeeId.trim()) newErrors.employeeId = "Employee ID is required";

    if (!formData.officialEmail.trim()) {
      newErrors.officialEmail = "Official email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.officialEmail)) {
      newErrors.officialEmail = "Invalid email format";
    }

    if (!formData.dateOfJoining) newErrors.dateOfJoining = "Date of joining is required";
    if (!formData.nationality) newErrors.nationality = "Nationality is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const payload = {
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      employeeId: formData.employeeId.trim(),
      officialEmail: formData.officialEmail.trim(),
      personalEmail: formData.personalEmail.trim() || undefined,
      phone: formData.phone ? `${formData.countryCode} ${formData.phone.trim()}` : undefined,
      dateOfBirth: formData.dateOfBirth || undefined,
      dateOfJoining: formData.dateOfJoining,
      nationality: formData.nationality,
      gender: formData.gender,
      role: formData.role,
      status: formData.status,
      projectAssigned: formData.projectAssigned,
    };

    try {
      if (editingMember) {
        // UPDATE
        const res = await fetch(`${API_BASE}/api/teams/${editingMember.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          const updated = await res.json();
          setMembers((prev) =>
            prev.map((m) => (m.id === updated.id ? updated : m))
          );
          setToastMessage(`Team member ${formData.firstName} ${formData.lastName} updated!`);
        }
      } else {
        // CREATE
        const res = await fetch(`${API_BASE}/api/teams`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          const created = await res.json();
          setMembers((prev) => [created, ...prev]);
          setToastMessage(`Team member ${formData.firstName} ${formData.lastName} added successfully!`);
        }
      }
    } catch (err) {
      console.error("Failed saving team member", err);
    } finally {
      setIsModalOpen(false);
    }
  };

  // Soft Delete Handler
  const handleSoftDelete = async (id: string, name: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/teams/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setMembers((prev) =>
          prev.map((m) =>
            m.id === id ? { ...m, isDeleted: true, deletedAt: new Date().toISOString() } : m
          )
        );
        setToastMessage(`Soft-deleted member '${name}'. Moved to Archive.`);
      }
    } catch (err) {
      console.error("Failed soft-deleting team member", err);
    }
  };

  // Restore Soft-Deleted Member
  const handleRestore = async (id: string, name: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/teams/${id}/restore`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setMembers((prev) =>
          prev.map((m) =>
            m.id === id ? { ...m, isDeleted: false, deletedAt: null } : m
          )
        );
        setToastMessage(`Restored '${name}' to active team!`);
      }
    } catch (err) {
      console.error("Failed restoring team member", err);
    }
  };

  // Permanent Hard Delete
  const handleHardDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to PERMANENTLY delete '${name}' from database?`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/teams/${id}/hard`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setMembers((prev) => prev.filter((m) => m.id !== id));
        setToastMessage(`Permanently deleted '${name}' from database.`);
      }
    } catch (err) {
      console.error("Failed hard deleting member", err);
    }
  };

  // Filtered members list
  const activeMembers = useMemo(
    () => members.filter((m) => !m.isDeleted),
    [members]
  );
  const archivedMembers = useMemo(
    () => members.filter((m) => m.isDeleted),
    [members]
  );

  const displayedMembers = useMemo(() => {
    const list = activeTab === "active" ? activeMembers : archivedMembers;
    const q = search.trim().toLowerCase();

    return list.filter((m) => {
      const matchesSearch =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.role.toLowerCase().includes(q) ||
        (m.officialEmail && m.officialEmail.toLowerCase().includes(q)) ||
        (m.employeeId && m.employeeId.toLowerCase().includes(q));

      const matchesProject =
        projectFilter === "ALL" || m.projectAssigned === projectFilter;

      return matchesSearch && matchesProject;
    });
  }, [activeMembers, archivedMembers, activeTab, search, projectFilter]);

  const vopxCount = useMemo(
    () =>
      activeMembers.filter(
        (m) => m.projectAssigned === "vopx website" || m.projectAssigned === "Both"
      ).length,
    [activeMembers]
  );
  const voiceCount = useMemo(
    () =>
      activeMembers.filter(
        (m) =>
          m.projectAssigned === "voice orchestration platform" ||
          m.projectAssigned === "Both"
      ).length,
    [activeMembers]
  );

  const countries = [
    "Qatar", "United States", "United Kingdom", "Canada", "Germany",
    "France", "Japan", "India", "Australia", "Singapore", "Saudi Arabia",
    "United Arab Emirates", "Morocco", "South Korea", "Spain", "Italy"
  ];

  return (
    <RouteGuard module="users">
      <div className="space-y-6 pb-16">
        {/* Toast */}
        {toastMessage && (
          <div className="fixed top-16 right-6 z-50 flex items-center gap-2.5 rounded-lg border border-emerald-500/40 bg-emerald-950/90 px-4 py-3 text-xs font-semibold text-emerald-300 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-top-4">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>{toastMessage}</span>
            <button
              onClick={() => setToastMessage(null)}
              className="ml-2 text-emerald-400 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* 1. Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700/10 text-teal-800 dark:bg-teal-500/15 dark:text-teal-300 border border-teal-500/20 shadow-2xs">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                Teams & Engineering Contributors
              </h1>
              <p className="text-xs text-muted-foreground">
                Manage engineers building the vop.x website and Voice Orchestration Platform with complete user profile attributes.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => fetchTeams()}
              disabled={isLoading}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg border border-border bg-card shadow-2xs transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>

            {can("users", "create") && (
              <Button
                onClick={() => handleOpenModal()}
                size="sm"
                className="gap-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs px-4 shadow-sm"
              >
                <UserPlus className="h-4 w-4" />
                <span>Add Team Member</span>
              </Button>
            )}
          </div>
        </div>

      {/* 2. Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-card shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500/10 text-teal-700 dark:text-teal-400 border border-teal-500/20 shrink-0">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <span className="text-[11px] font-medium text-muted-foreground block">
                Total Team Members
              </span>
              <span className="text-lg font-bold text-foreground">
                {activeMembers.length} Active
              </span>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded border border-teal-200 dark:border-teal-800/60">
            Platform Core
          </span>
        </div>

        <div className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-card shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shrink-0">
              <Globe className="h-4 w-4" />
            </div>
            <div>
              <span className="text-[11px] font-medium text-muted-foreground block">
                vop.x Website
              </span>
              <span className="text-lg font-bold text-foreground">
                {vopxCount} Contributors
              </span>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800/60">
            Dashboard UI
          </span>
        </div>

        <div className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-card shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 shrink-0">
              <Mic className="h-4 w-4" />
            </div>
            <div>
              <span className="text-[11px] font-medium text-muted-foreground block">
                Voice Platform
              </span>
              <span className="text-lg font-bold text-foreground">
                {voiceCount} Engineers
              </span>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-800/60">
            Orchestration
          </span>
        </div>
      </div>

      {/* 3. Controls & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border shadow-2xs">
        {/* Tabs: Active vs Archived */}
        <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg border border-border/60">
          <button
            onClick={() => setActiveTab("active")}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTab === "active"
                ? "bg-background text-foreground shadow-2xs border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400" />
            <span>Active Team</span>
            <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-teal-700/10 text-teal-800 dark:bg-teal-400/20 dark:text-teal-300 font-bold">
              {activeMembers.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("archived")}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTab === "archived"
                ? "bg-background text-foreground shadow-2xs border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Archive className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            <span>Archived (Soft Deleted)</span>
            {archivedMembers.length > 0 && (
              <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold">
                {archivedMembers.length}
              </span>
            )}
          </button>
        </div>

        {/* Search & Project Filter */}
        <div className="flex items-center gap-2.5">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search by name, email, or employee ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>

          <Select value={projectFilter} onValueChange={(val) => setProjectFilter(val)}>
            <SelectTrigger className="h-8 text-xs w-[180px]">
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Projects</SelectItem>
              <SelectItem value="vopx website">vop.x Website</SelectItem>
              <SelectItem value="voice orchestration platform">
                Voice Orchestration Platform
              </SelectItem>
              <SelectItem value="Both">Both Platforms</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 4. Team Members Table */}
      <div className="rounded-xl border border-border bg-card shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 border-b border-border text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Member Name & ID</th>
                <th className="py-3 px-4">Role & Gender</th>
                <th className="py-3 px-4">Assigned Project</th>
                <th className="py-3 px-4">Contact Emails</th>
                <th className="py-3 px-4">Joining & Nationality</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 text-foreground">
              {displayedMembers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <Users className="h-8 w-8 opacity-40 text-muted-foreground" />
                      <p className="text-xs font-semibold">
                        {activeTab === "active"
                          ? "No active team members found."
                          : "No soft-deleted or archived members."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                displayedMembers.map((member) => (
                  <tr
                    key={member.id}
                    className={`hover:bg-muted/30 transition-colors ${
                      member.isDeleted ? "opacity-75 bg-amber-500/5" : ""
                    }`}
                  >
                    {/* Name & Employee ID */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-700/10 text-teal-800 dark:bg-teal-500/20 dark:text-teal-300 font-bold text-xs">
                          {member.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <span className="font-semibold text-foreground block">
                            {member.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {member.employeeId || "EMP-N/A"}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Role & Gender */}
                    <td className="py-3 px-4">
                      <div className="font-medium text-foreground">{member.role}</div>
                      <div className="text-[10px] text-muted-foreground">{member.gender || "Male"}</div>
                    </td>

                    {/* Project Assigned */}
                    <td className="py-3 px-4">
                      {member.projectAssigned === "vopx website" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                          <Globe className="h-3 w-3 text-blue-600" />
                          vop.x Website
                        </span>
                      )}
                      {member.projectAssigned === "voice orchestration platform" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                          <Mic className="h-3 w-3 text-purple-600" />
                          Voice Platform
                        </span>
                      )}
                      {member.projectAssigned === "Both" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-teal-50 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                          <Cpu className="h-3 w-3 text-teal-700 dark:text-teal-400" />
                          Both Projects
                        </span>
                      )}
                    </td>

                    {/* Contact Emails */}
                    <td className="py-3 px-4 text-muted-foreground font-mono text-[11px]">
                      <div className="text-foreground font-medium">{member.officialEmail || member.email || "N/A"}</div>
                      <div className="text-[10px] text-muted-foreground/80">{member.phone || member.phoneNumber}</div>
                    </td>

                    {/* Joining & Nationality */}
                    <td className="py-3 px-4 text-muted-foreground text-[11px]">
                      <div>{member.dateOfJoining || "N/A"}</div>
                      <div className="text-[10px] text-muted-foreground/80">{member.nationality || "Qatar"}</div>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">
                      {member.isDeleted ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300">
                          <Archive className="h-3 w-3" /> Soft-Deleted
                        </span>
                      ) : member.status === "Active" || member.status === "active" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          🟢 Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                          ⚪ {member.status || "Inactive"}
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {!member.isDeleted ? (
                          <>
                            {can("users", "edit") && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenModal(member)}
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                title="Edit Member"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                            )}

                            {can("users", "delete") && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleSoftDelete(member.id, member.name)}
                                className="h-7 w-7 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/50"
                                title="Soft Delete (Archive)"
                              >
                                <Archive className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </>
                        ) : (
                          <>
                            {can("users", "edit") && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRestore(member.id, member.name)}
                                className="h-7 text-[11px] gap-1 px-2.5 text-teal-700 border-teal-500/30 hover:bg-teal-50 dark:hover:bg-teal-950/50"
                                title="Restore Team Member"
                              >
                                <RotateCcw className="h-3 w-3" />
                                <span>Restore</span>
                              </Button>
                            )}

                            {can("users", "delete") && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleHardDelete(member.id, member.name)}
                                className="h-7 w-7 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                                title="Permanent Delete"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Add / Edit Team Member Modal matching User Form Layout (2 Columns Grid) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-3xl p-6 space-y-5 animate-in fade-in zoom-in-95 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Users className="h-4 w-4 text-teal-700 dark:text-teal-400" />
                {editingMember ? "Edit Team Member Profile" : "Add Team Member Profile"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 text-xs">
              {/* 2-COLUMN GRID MATCHING USER FORM LAYOUT */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. First Name * */}
                <div className="space-y-1.5">
                  <Label htmlFor="firstName" className="font-semibold text-foreground flex items-center gap-1">
                    First Name <span className="text-teal-700 font-bold">*</span>
                  </Label>
                  <Input
                    id="firstName"
                    placeholder="e.g. Alexander"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className={errors.firstName ? "border-rose-500 h-9 text-xs" : "h-9 text-xs"}
                  />
                  {errors.firstName && <p className="text-[11px] text-rose-500">{errors.firstName}</p>}
                </div>

                {/* 2. Last Name * */}
                <div className="space-y-1.5">
                  <Label htmlFor="lastName" className="font-semibold text-foreground flex items-center gap-1">
                    Last Name <span className="text-teal-700 font-bold">*</span>
                  </Label>
                  <Input
                    id="lastName"
                    placeholder="e.g. Novak"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className={errors.lastName ? "border-rose-500 h-9 text-xs" : "h-9 text-xs"}
                  />
                  {errors.lastName && <p className="text-[11px] text-rose-500">{errors.lastName}</p>}
                </div>

                {/* 3. Employee ID * */}
                <div className="space-y-1.5">
                  <Label htmlFor="employeeId" className="font-semibold text-foreground flex items-center gap-1">
                    Employee ID <span className="text-teal-700 font-bold">*</span>
                  </Label>
                  <Input
                    id="employeeId"
                    placeholder="e.g. EMP-1048"
                    value={formData.employeeId}
                    onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                    className={errors.employeeId ? "border-rose-500 font-mono h-9 text-xs" : "font-mono h-9 text-xs"}
                  />
                  {errors.employeeId && <p className="text-[11px] text-rose-500">{errors.employeeId}</p>}
                </div>

                {/* 4. Phone Number */}
                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="font-semibold text-foreground">
                    Phone Number
                  </Label>
                  <div className="flex gap-2">
                    <Select
                      value={formData.countryCode}
                      onValueChange={(val) => setFormData({ ...formData, countryCode: val })}
                    >
                      <SelectTrigger className="w-[90px] h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="+974">🇶🇦 +974</SelectItem>
                        <SelectItem value="+1">🇺🇸 +1</SelectItem>
                        <SelectItem value="+44">🇬🇧 +44</SelectItem>
                        <SelectItem value="+91">🇮🇳 +91</SelectItem>
                        <SelectItem value="+971">🇦🇪 +971</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="5512 3456"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="flex-1 h-9 text-xs"
                    />
                  </div>
                </div>

                {/* 5. Official Email * */}
                <div className="space-y-1.5">
                  <Label htmlFor="officialEmail" className="font-semibold text-foreground flex items-center gap-1">
                    Official Email <span className="text-teal-700 font-bold">*</span>
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="officialEmail"
                      type="email"
                      placeholder="alex.novak@vopx.ai"
                      value={formData.officialEmail}
                      onChange={(e) => setFormData({ ...formData, officialEmail: e.target.value })}
                      className={`pl-9 h-9 text-xs ${errors.officialEmail ? "border-rose-500" : ""}`}
                    />
                  </div>
                  {errors.officialEmail && <p className="text-[11px] text-rose-500">{errors.officialEmail}</p>}
                </div>

                {/* 6. Personal Email */}
                <div className="space-y-1.5">
                  <Label htmlFor="personalEmail" className="font-semibold text-foreground">
                    Personal Email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="personalEmail"
                      type="email"
                      placeholder="alex.personal@gmail.com"
                      value={formData.personalEmail}
                      onChange={(e) => setFormData({ ...formData, personalEmail: e.target.value })}
                      className="pl-9 h-9 text-xs"
                    />
                  </div>
                </div>

                {/* 7. Date of Birth */}
                <div className="space-y-1.5">
                  <Label htmlFor="dateOfBirth" className="font-semibold text-foreground">
                    Date of Birth
                  </Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                    className="h-9 text-xs"
                  />
                </div>

                {/* 8. Date of Joining * */}
                <div className="space-y-1.5">
                  <Label htmlFor="dateOfJoining" className="font-semibold text-foreground flex items-center gap-1">
                    Date of Joining <span className="text-teal-700 font-bold">*</span>
                  </Label>
                  <Input
                    id="dateOfJoining"
                    type="date"
                    value={formData.dateOfJoining}
                    onChange={(e) => setFormData({ ...formData, dateOfJoining: e.target.value })}
                    className={errors.dateOfJoining ? "border-rose-500 h-9 text-xs" : "h-9 text-xs"}
                  />
                  {errors.dateOfJoining && <p className="text-[11px] text-rose-500">{errors.dateOfJoining}</p>}
                </div>

                {/* 9. Nationality * */}
                <div className="space-y-1.5">
                  <Label htmlFor="nationality" className="font-semibold text-foreground flex items-center gap-1">
                    Nationality <span className="text-teal-700 font-bold">*</span>
                  </Label>
                  <Select
                    value={formData.nationality}
                    onValueChange={(val) => setFormData({ ...formData, nationality: val })}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Select nationality" />
                    </SelectTrigger>
                    <SelectContent>
                      {countries.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 10. System Role * */}
                <div className="space-y-1.5">
                  <Label className="font-semibold text-foreground flex items-center gap-1">
                    Role / Title <span className="text-teal-700 font-bold">*</span>
                  </Label>
                  <Input
                    placeholder="e.g. Fullstack Architect & Platform Lead"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="h-9 text-xs"
                  />
                </div>

                {/* 11. Assigned Project * */}
                <div className="space-y-1.5">
                  <Label className="font-semibold text-foreground flex items-center gap-1">
                    Assigned Project <span className="text-teal-700 font-bold">*</span>
                  </Label>
                  <Select
                    value={formData.projectAssigned}
                    onValueChange={(val) =>
                      setFormData({ ...formData, projectAssigned: val as ProjectAssigned })
                    }
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vopx website">🌐 vop.x Website (Dashboard)</SelectItem>
                      <SelectItem value="voice orchestration platform">
                        🎙️ Voice Orchestration Platform
                      </SelectItem>
                      <SelectItem value="Both">⚡ Both Projects</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* 12. Status * */}
                <div className="space-y-1.5">
                  <Label className="font-semibold text-foreground flex items-center gap-1">
                    Status <span className="text-teal-700 font-bold">*</span>
                  </Label>
                  <Select
                    value={formData.status}
                    onValueChange={(val) => setFormData({ ...formData, status: val })}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">🟢 Active</SelectItem>
                      <SelectItem value="Away">🟡 Away</SelectItem>
                      <SelectItem value="Do Not Disturb">🔴 Do Not Disturb</SelectItem>
                      <SelectItem value="Inactive">⚪ Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* 13. Gender * */}
                <div className="space-y-2 sm:col-span-2">
                  <Label className="font-semibold text-foreground flex items-center gap-1">
                    Gender <span className="text-teal-700 font-bold">*</span>
                  </Label>
                  <RadioGroup
                    value={formData.gender}
                    onValueChange={(val) => setFormData({ ...formData, gender: val as "Male" | "Female" | "Other" })}
                    className="flex items-center gap-6 pt-1"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Male" id="team-gender-male" />
                      <Label htmlFor="team-gender-male" className="font-normal cursor-pointer">Male</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Female" id="team-gender-female" />
                      <Label htmlFor="team-gender-female" className="font-normal cursor-pointer">Female</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Other" id="team-gender-other" />
                      <Label htmlFor="team-gender-other" className="font-normal cursor-pointer">Other</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="text-xs bg-teal-700 hover:bg-teal-800 text-white font-medium px-5"
                >
                  {editingMember ? "Save Changes" : "Create Member Profile"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </RouteGuard>
  );
}
