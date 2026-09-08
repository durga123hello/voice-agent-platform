"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { useAuth } from "../../context/auth-context";
import { Loader2 } from "lucide-react";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isAuthPage = pathname === "/login" || pathname === "/signup";

  useEffect(() => {
    if (!isLoading) {
      if (isAuthPage && isAuthenticated) {
        router.replace("/users");
      } else if (!isAuthPage && !isAuthenticated) {
        router.replace("/login");
      }
    }
  }, [isLoading, isAuthenticated, isAuthPage, router]);

  // Loading screen while checking auth session state
  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700 dark:bg-teal-600 text-white font-extrabold text-lg shadow-md animate-pulse">
            vx
          </div>
          <Loader2 className="h-5 w-5 animate-spin text-teal-600 dark:text-teal-400" />
        </div>
      </div>
    );
  }

  // Standalone Auth pages (/login & /signup) — no Header/Sidebar chrome
  if (isAuthPage) {
    if (isAuthenticated) {
      return (
        <div className="flex h-screen w-full items-center justify-center bg-background">
          <Loader2 className="h-6 w-6 animate-spin text-teal-600 dark:text-teal-400" />
        </div>
      );
    }
    return <>{children}</>;
  }

  // Protected dashboard routes: require authentication
  if (!isAuthenticated) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-teal-600 dark:text-teal-400" />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground transition-colors">
      {/* Left Sidebar: Extends all the way to the top of the screen */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        isMobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Right Area: Header + Page Content */}
      <div className="flex flex-1 flex-col min-w-0 h-screen overflow-hidden">
        {/* Header */}
        <Header 
          onToggleSidebar={() => setMobileMenuOpen(!mobileMenuOpen)} 
          isSidebarCollapsed={sidebarCollapsed}
        />

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 overflow-y-auto custom-scrollbar">
          {children}
        </main>
      </div>
    </div>
  );
}

