"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Users, 
  Building, 
  FolderKanban, 
  FlaskConical, 
  Bot, 
  Settings, 
  PanelLeftClose, 
  PanelLeft,
  ExternalLink,
  Layers
} from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";

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
  const pathname = usePathname();
  const voicePlatformUrl = process.env.NEXT_PUBLIC_VOICE_PLATFORM_URL || "http://localhost:3001";

  // Navigation Items in exact required order:
  // 1. User
  // 2. Organization
  // 3. Projects
  // 4. Testing (Opens external voice platform in new tab)
  // 5. Integrations
  // (Settings pinned to bottom)
  const mainNavItems = [
    { name: "User", href: "/users", icon: Users },
    { name: "Organization", href: "/organization", icon: Building },
    { name: "Projects", href: "/projects", icon: FolderKanban },
    { name: "Testing", href: voicePlatformUrl, icon: FlaskConical, isExternal: true },
    { name: "Integrations", href: "/integrations", icon: Layers },
  ];

  const bottomNavItems = [
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  const renderNavLink = (item: { name: string; href: string; icon: any; isExternal?: boolean }) => {
    const Icon = item.icon;
    const isActive = !item.isExternal && (pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href)));

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
        {/* Active Indicator Bar */}
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

      {/* Full-Height Left Sidebar extending to top of screen */}
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
          {/* Top Bar of Left Sidebar: Aligned with Header (h-14) with Collapse Icon on Top */}
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
            {mainNavItems.map(renderNavLink)}
          </div>
        </div>

        {/* Bottom Pinned Items: Settings (Collapse button removed from below) */}
        <div className="p-2 border-t border-border space-y-1">
          {bottomNavItems.map(renderNavLink)}
        </div>
      </aside>
    </>
  );
}
