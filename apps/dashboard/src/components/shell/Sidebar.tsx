"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Users, 
  Shield,
  Building, 
  FolderKanban, 
  FlaskConical, 
  Settings, 
  PanelLeftClose, 
  PanelLeft,
  ExternalLink,
  Layers,
  Mic,
  Volume2,
  Cpu,
  Phone,
  ChevronDown,
  ChevronRight,
  CreditCard
} from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { usePermissions } from "../../context/permissions-context";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "../ui/dropdown-menu";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  className?: string;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({ 
  collapsed, 
  onToggle, 
  className, 
  isMobileOpen = false, 
  onCloseMobile 
}: SidebarProps) {
  const { can } = usePermissions();
  const pathname = usePathname();
  const voicePlatformUrl = process.env.NEXT_PUBLIC_VOICE_PLATFORM_URL || "http://localhost:3001";

  const [integrationsOpen, setIntegrationsOpen] = useState(
    () => pathname.startsWith("/integrations")
  );

  useEffect(() => {
    if (pathname.startsWith("/integrations")) {
      setIntegrationsOpen(true);
    }
  }, [pathname]);

  const mainNavItems = [
    { name: "User", href: "/users", icon: Users, module: "users" },
    { name: "Roles & Permissions", href: "/roles", icon: Shield, module: "roles" },
    { name: "Organization", href: "/organization", icon: Building, module: "organization" },
    { name: "Projects", href: "/projects", icon: FolderKanban, module: "projects" },
    { name: "Testing", href: voicePlatformUrl, icon: FlaskConical, isExternal: true, module: "testing" },
    { name: "Integrations", href: "/integrations/stt", icon: Layers, isDropdown: true, module: "integrations" },
    { name: "Billing", href: "/billing", icon: CreditCard, module: "billing" },
  ];

  const integrationSubItems = [
    { name: "STT Agents", href: "/integrations/stt", icon: Mic },
    { name: "TTS Agents", href: "/integrations/tts", icon: Volume2 },
    { name: "LLM Providers", href: "/integrations/llm", icon: Cpu },
    { name: "Mobile Telephony", href: "/integrations/telephony", icon: Phone },
  ];

  const bottomNavItems = [
    { name: "Teams", href: "/teams", icon: Users, module: "users" },
    { name: "Settings", href: "/settings", icon: Settings, module: "settings" },
  ];

  const visibleMainNavItems = mainNavItems.filter((item) => can(item.module, "view"));
  const visibleBottomNavItems = bottomNavItems.filter((item) => can(item.module, "view"));

  const renderNavLink = (item: { name: string; href: string; icon: any; isExternal?: boolean; isDropdown?: boolean }) => {
    const Icon = item.icon;
    const isIntegrationsRoute = pathname.startsWith("/integrations");
    const isActive = !item.isExternal && (pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href)));

    // External link (Testing)
    if (item.isExternal) {
      return (
        <a
          key={item.name}
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onCloseMobile}
          title={collapsed ? `${item.name} (Opens in new tab)` : undefined}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold transition-all group relative text-muted-foreground hover:bg-muted/80 hover:text-foreground"
          )}
        >
          <Icon className="h-4 w-4 shrink-0 transition-colors text-muted-foreground group-hover:text-foreground" />
          {!collapsed && (
            <div className="flex flex-1 items-center justify-between min-w-0">
              <span className="truncate tracking-wide">{item.name}</span>
              <ExternalLink className="h-3 w-3 opacity-60 group-hover:opacity-100 transition-opacity ml-1 shrink-0 text-muted-foreground" />
            </div>
          )}
        </a>
      );
    }

    // Integrations Dropdown / Accordion Item
    if (item.isDropdown && item.name === "Integrations") {
      if (collapsed) {
        return (
          <DropdownMenu key={item.name}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                title="Integrations & AI Providers"
                className={cn(
                  "flex items-center justify-center w-full rounded-lg px-3 py-2 text-xs font-semibold transition-all group relative",
                  isIntegrationsRoute
                    ? "bg-teal-700/10 text-teal-800 dark:bg-teal-500/15 dark:text-teal-300 font-bold shadow-2xs"
                    : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                )}
              >
                {isIntegrationsRoute && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-teal-700 dark:bg-teal-400" />
                )}
                <Icon className={cn(
                  "h-4 w-4 shrink-0 transition-colors",
                  isIntegrationsRoute ? "text-teal-700 dark:text-teal-400" : "text-muted-foreground group-hover:text-foreground"
                )} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start" className="w-52">
              <DropdownMenuLabel className="text-xs font-bold text-foreground">
                Integrations & Providers
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {integrationSubItems.map((sub) => {
                const SubIcon = sub.icon;
                const isSubActive = pathname === sub.href;
                return (
                  <DropdownMenuItem key={sub.href} asChild>
                    <Link
                      href={sub.href}
                      onClick={onCloseMobile}
                      className={cn(
                        "flex items-center gap-2 text-xs font-medium cursor-pointer w-full",
                        isSubActive ? "text-teal-700 dark:text-teal-400 font-bold" : ""
                      )}
                    >
                      <SubIcon className="h-3.5 w-3.5 shrink-0" />
                      <span>{sub.name}</span>
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      }

      // Expanded Sidebar Accordion
      return (
        <div key={item.name} className="space-y-0.5">
          <button
            type="button"
            onClick={() => setIntegrationsOpen((prev) => !prev)}
            className={cn(
              "flex items-center justify-between w-full rounded-lg px-3 py-2 text-xs font-semibold transition-all group relative",
              isIntegrationsRoute
                ? "bg-teal-700/10 text-teal-800 dark:bg-teal-500/15 dark:text-teal-300 font-bold shadow-2xs"
                : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            )}
          >
            {isIntegrationsRoute && (
              <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-teal-700 dark:bg-teal-400" />
            )}

            <div className="flex items-center gap-3 min-w-0">
              <Icon className={cn(
                "h-4 w-4 shrink-0 transition-colors",
                isIntegrationsRoute ? "text-teal-700 dark:text-teal-400" : "text-muted-foreground group-hover:text-foreground"
              )} />
              <span className="truncate tracking-wide">{item.name}</span>
            </div>

            {integrationsOpen ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            )}
          </button>

          {/* Sub-menu Items */}
          {integrationsOpen && (
            <div className="ml-4 pl-2.5 border-l border-border/70 space-y-1 pt-1 pb-1">
              {integrationSubItems.map((sub) => {
                const SubIcon = sub.icon;
                const isSubActive = pathname === sub.href;
                return (
                  <Link
                    key={sub.name}
                    href={sub.href}
                    onClick={onCloseMobile}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-all group relative",
                      isSubActive
                        ? "bg-teal-700/15 text-teal-900 dark:bg-teal-500/20 dark:text-teal-200 font-bold shadow-2xs"
                        : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                    )}
                  >
                    <SubIcon className={cn(
                      "h-3.5 w-3.5 shrink-0 transition-colors",
                      isSubActive ? "text-teal-700 dark:text-teal-400" : "text-muted-foreground group-hover:text-foreground"
                    )} />
                    <span className="truncate">{sub.name}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    // Standard Nav Link
    return (
      <Link
        key={item.name}
        href={item.href}
        onClick={onCloseMobile}
        title={collapsed ? item.name : undefined}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold transition-all group relative",
          isActive
            ? "bg-teal-700/10 text-teal-800 dark:bg-teal-500/15 dark:text-teal-300 font-bold shadow-2xs"
            : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
        )}
      >
        {isActive && (
          <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-teal-700 dark:bg-teal-400" />
        )}

        <Icon className={cn(
          "h-4 w-4 shrink-0 transition-colors",
          isActive ? "text-teal-700 dark:text-teal-400" : "text-muted-foreground group-hover:text-foreground"
        )} />

        {!collapsed && (
          <span className="truncate tracking-wide">{item.name}</span>
        )}
      </Link>
    );
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs md:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Full-Height Left Sidebar */}
      <aside
        className={cn(
          "flex flex-col justify-between border-r border-border bg-background transition-all duration-300 ease-in-out z-40 h-screen shrink-0",
          collapsed ? "w-16" : "w-56",
          isMobileOpen 
            ? "fixed inset-y-0 left-0 z-50 translate-x-0 shadow-2xl" 
            : "fixed inset-y-0 left-0 md:static -translate-x-full md:translate-x-0",
          className
        )}
      >
        {/* Top Section */}
        <div className="flex flex-col">
          {/* Top Bar of Left Sidebar */}
          <div className="flex h-14 items-center border-b border-border px-3 shrink-0">
            {collapsed ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggle}
                className="mx-auto h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/80"
                title="Expand sidebar"
              >
                <PanelLeft className="h-4 w-4" />
                <span className="sr-only">Expand sidebar</span>
              </Button>
            ) : (
              <div className="flex w-full items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 pl-1">
                  Dashboard
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onToggle}
                  className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/80"
                  title="Collapse sidebar"
                >
                  <PanelLeftClose className="h-4 w-4" />
                  <span className="sr-only">Collapse sidebar</span>
                </Button>
              </div>
            )}
          </div>

          {/* Navigation Items */}
          <div className="flex flex-col p-2 space-y-1">
            {visibleMainNavItems.map(renderNavLink)}
          </div>
        </div>

        {/* Bottom Pinned Items */}
        <div className="p-2 border-t border-border space-y-1">
          {visibleBottomNavItems.map(renderNavLink)}
        </div>
      </aside>
    </>
  );
}
