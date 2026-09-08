"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Users as UsersIcon } from "lucide-react";
import { UserToolbar } from "../../components/users/UserToolbar";
import { UsersTable } from "../../components/users/UsersTable";
import { UsersPagination } from "../../components/users/UsersPagination";
import { UserDetailsModal } from "../../components/users/UserDetailsModal";
import { INITIAL_MOCK_USERS } from "../../lib/mock-users";
import { User, UserFilters } from "../../types/user";
import { useAuth } from "../../context/auth-context";

const PAGE_SIZE = 10;
const STORAGE_KEY = "vopx_users_data_v3";
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export default function UsersPage() {
  const { token, user: currentUser } = useAuth();

  const [users, setUsers] = useState<User[]>([]);
  const [filters, setFilters] = useState<UserFilters>({
    search: "",
    role: "ALL",
    status: "ALL",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Load organization-scoped users from backend API (with fallback to local storage)
  useEffect(() => {
    let isMounted = true;

    async function loadUsers() {
      if (token) {
        try {
          const res = await fetch(`${API_BASE}/api/users`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          if (res.ok) {
            const data = await res.json();
            if (isMounted && Array.isArray(data.users)) {
              setUsers(data.users);
              return;
            }
          }
        } catch (err) {
          console.warn("Could not fetch users from API, using fallback:", err);
        }
      }

      // Local storage fallback if API token not present
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        let list: User[] = [];
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
              list = parsed;
            }
          } catch (e) {}
        }
        if (isMounted) {
          setUsers(list.length > 0 ? list : INITIAL_MOCK_USERS);
        }
      } catch (e) {
        console.error("Failed to load users from localStorage", e);
      }
    }

    loadUsers();

    return () => {
      isMounted = false;
    };
  }, [token, currentUser?.email]);

  // Filter users based on multi-field search query, role, and status
  const filteredUsers = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, "");
    const tokens = q ? q.split(/\s+/).filter(Boolean) : [];

    return users.filter((u) => {
      // 1. Comprehensive multi-field search
      let matchesSearch = true;
      if (tokens.length > 0) {
        const searchableText = [
          u.name,
          u.firstName,
          u.lastName,
          u.email,
          u.personalEmail,
          u.employeeId,
          u.role,
          u.status,
          u.phone,
          u.nationality,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        // Check if all space-separated search tokens match anywhere in user's profile
        const matchesTokens = tokens.every((token) => searchableText.includes(token));

        // Also check raw digits for phone numbers (e.g. searching "890292" or "5512")
        const phoneDigits = (u.phone || "").replace(/\D/g, "");
        const matchesPhoneDigits = qDigits.length >= 3 && phoneDigits.includes(qDigits);

        matchesSearch = matchesTokens || matchesPhoneDigits;
      }

      // 2. Role filter
      const matchesRole =
        filters.role === "ALL" || u.role === filters.role;

      // 3. Status filter
      const matchesStatus =
        filters.status === "ALL" || u.status === filters.status;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, filters]);

  // Total pages
  const totalPages = Math.ceil(filteredUsers.length / PAGE_SIZE) || 1;

  // Paginated slice for current page
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredUsers.slice(start, start + PAGE_SIZE);
  }, [filteredUsers, currentPage]);

  // Handle filter changes (resets pagination to page 1)
  const handleFilterChange = (newFilters: Partial<UserFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
    setCurrentPage(1); // Requirement: Filtering/search should reset pagination to page 1
  };

  // Handle Delete user
  const handleDeleteUser = (userId: string) => {
    const updated = users.filter((u) => u.id !== userId);
    setUsers(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {}

    // Adjust page if current page became empty
    const newTotalPages = Math.ceil((filteredUsers.length - 1) / PAGE_SIZE) || 1;
    if (currentPage > newTotalPages) {
      setCurrentPage(newTotalPages);
    }
  };

  // Handle View user details
  const handleViewUser = (user: User) => {
    setSelectedUser(user);
    setIsDetailsOpen(true);
  };

  return (
    <div className="space-y-5">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-border/60">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700/10 text-teal-800 dark:bg-teal-500/15 dark:text-teal-300 border border-teal-500/20 shadow-2xs">
            <UsersIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              User Management
            </h1>
            <p className="text-xs text-muted-foreground">
              Manage all user accounts and their roles within the system.
            </p>
          </div>
        </div>
      </div>

      {/* 2. Toolbar Row (Search, Role, Status, Exports, Create User) */}
      <UserToolbar
        filters={filters}
        onFilterChange={handleFilterChange}
        filteredUsers={filteredUsers}
      />

      {/* 3. Main Sticky Table */}
      <UsersTable
        users={paginatedUsers}
        onDeleteUser={handleDeleteUser}
        onViewUser={handleViewUser}
      />

      {/* 4. Pagination (Showing 1–10 of 47 users, Page numbers, Prev/Next) */}
      <UsersPagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalUsers={filteredUsers.length}
        pageSize={PAGE_SIZE}
        onPageChange={(page) => setCurrentPage(page)}
      />

      {/* View User Details Modal */}
      <UserDetailsModal
        user={selectedUser}
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
      />
    </div>
  );
}
