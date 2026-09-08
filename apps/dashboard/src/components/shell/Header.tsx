"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  MoreVertical, 
  HelpCircle, 
  Sparkles, 
  User, 
  Settings, 
  LogOut, 
  ShieldCheck,
  Menu
} from "lucide-react";
import { ThemeToggle } from "../theme-toggle";
import { Button } from "../ui/button";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "../ui/dropdown-menu";
import { useAuth } from "../../context/auth-context";

interface HeaderProps {
  onToggleSidebar?: () => void;
  isSidebarCollapsed?: boolean;
}

export function Header({ onToggleSidebar }: HeaderProps) {
  const router = useRouter();
  const { user, logout } = useAuth();

  const currentUser = {
    name: user?.name || "Administrator",
    email: user?.email || "admin@vopx.ai",
    role: "Administrator",
    initials: user?.initials || "AD"
  };

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-40 flex h-14 w-full items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 transition-colors">
      
      {/* Left side: Mobile menu + Brand Logo / Wordmark */}
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="md:hidden h-8 w-8 text-muted-foreground"
            onClick={onToggleSidebar}
            aria-label="Toggle navigation"
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}

        {/* Brand Logo / Wordmark */}
        <Link href="/users" className="flex items-center gap-2 font-bold tracking-tight focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md p-0.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-700 dark:bg-teal-500 text-white shadow-sm font-black text-sm">
            vx
          </div>
          <span className="text-base font-extrabold text-foreground tracking-tight">
            vop<span className="text-teal-700 dark:text-teal-400">x</span>
          </span>
        </Link>
      </div>

      {/* Right side: In exact order:
          1. Theme toggle
          2. More options kebab
          3. Role badge
          4. Profile avatar dropdown
      */}
      <div className="flex items-center gap-2">
        
        {/* 1. Theme Toggle */}
        <ThemeToggle />

        {/* 2. More Options (Three-dot Kebab) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
              <MoreVertical className="h-4 w-4" />
              <span className="sr-only">More options</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem className="text-xs flex items-center gap-2 cursor-pointer">
              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
              Help & Documentation
            </DropdownMenuItem>
            <DropdownMenuItem className="text-xs flex items-center gap-2 cursor-pointer">
              <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
              What&apos;s New
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <span className="h-4 w-px bg-border mx-0.5" />

        {/* 3. Administrator Role Label / Badge */}
        <div className="hidden sm:flex items-center gap-1.5 rounded-md bg-teal-500/10 px-2 py-0.5 text-xs font-semibold text-teal-700 dark:text-teal-300 border border-teal-500/20">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>{currentUser.role}</span>
        </div>

        {/* 4. Profile Button & Dropdown Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 p-0.5 transition-all">
              <Avatar className="h-8 w-8 border border-border">
                <AvatarFallback className="bg-teal-700 dark:bg-teal-600 text-white font-semibold text-xs">
                  {currentUser.initials}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="flex flex-col space-y-1 p-2">
              <p className="text-xs font-semibold leading-none text-foreground">{currentUser.name}</p>
              <p className="text-[11px] leading-none text-muted-foreground truncate">{currentUser.email}</p>
              <div className="pt-1">
                <span className="inline-block text-[10px] uppercase font-bold text-teal-700 dark:text-teal-400 bg-teal-500/10 px-1.5 py-0.5 rounded border border-teal-500/20">
                  {currentUser.role}
                </span>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-xs flex items-center gap-2 cursor-pointer">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem className="text-xs flex items-center gap-2 cursor-pointer">
              <Settings className="h-3.5 w-3.5 text-muted-foreground" />
              Account Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={handleLogout}
              className="text-xs flex items-center gap-2 text-rose-600 dark:text-rose-400 focus:text-rose-600 dark:focus:text-rose-400 focus:bg-rose-50 dark:focus:bg-rose-950/40 cursor-pointer font-medium"
            >
              <LogOut className="h-3.5 w-3.5" />
              Log Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

      </div>
    </header>
  );
}

