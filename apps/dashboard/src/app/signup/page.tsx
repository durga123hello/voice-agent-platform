"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/auth-context";
import { 
  User, 
  Mail, 
  Building2, 
  Lock, 
  Eye, 
  EyeOff, 
  Loader2, 
  AlertCircle, 
  CheckCircle, 
  Shield 
} from "lucide-react";
import { ThemeToggle } from "../../components/theme-toggle";
import Image from "next/image";

export default function SignupPage() {
  const router = useRouter();
  const { signupUser } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [orgName, setOrgName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!fullName.trim() || !email.trim() || !orgName.trim() || !password) {
      setErrorMsg("Please fill out all required fields.");
      return;
    }

    if (password.length < 6) {
      setErrorMsg("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await signupUser(fullName.trim(), email.trim(), orgName.trim(), password);
      if (success) {
        router.replace("/users");
      } else {
        setErrorMsg("Failed to create account. Please try again.");
      }
    } catch (err) {
      setErrorMsg("An error occurred during account creation.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full overflow-hidden bg-background text-foreground transition-colors">
      
      {/* LEFT PANEL — Visual Banner & Hero Copy (Hidden on mobile, 50% width on lg+) */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-10 xl:p-14 bg-slate-950 text-white overflow-hidden border-r border-slate-800/60">
        
        {/* Background Image with Dark Teal Overlay */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/login_hero_bg.jpg"
            alt="Voice Orchestration AI Banner"
            fill
            className="object-cover object-center opacity-40 mix-blend-luminosity scale-105 transition-transform duration-1000 hover:scale-100"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-slate-950/40" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-transparent to-slate-950/70" />
        </div>

        {/* Top Header Badge Pill */}
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-950/50 backdrop-blur-md px-4 py-1.5 text-xs font-medium text-teal-300 shadow-lg">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
            </span>
            <span>Join enterprises building smarter voice workflows</span>
          </div>
        </div>

        {/* Hero Headline & Key Value Statements */}
        <div className="relative z-10 max-w-xl space-y-6 my-auto py-12">
          <h1 className="text-4xl xl:text-5xl font-extrabold tracking-tight text-white leading-[1.15]">
            Build the Future of{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 via-teal-300 to-emerald-400">
              Voice Orchestration
            </span>
          </h1>
          <p className="text-base text-slate-300/90 leading-relaxed font-normal">
            Create your <span className="font-semibold text-white">vopx</span> account and start transforming customer interactions with AI-powered voice agents, real-time analytics, and seamless provider orchestration.
          </p>

          {/* Feature Badge Pills */}
          <div className="flex flex-wrap gap-2.5 pt-2">
            <div className="inline-flex items-center gap-2 rounded-lg border border-slate-700/60 bg-slate-900/60 backdrop-blur-md px-3.5 py-2 text-xs font-medium text-slate-200">
              <CheckCircle className="h-4 w-4 text-teal-400 shrink-0" />
              <span>Autonomous Voice Agents</span>
            </div>
            <div className="inline-flex items-center gap-2 rounded-lg border border-slate-700/60 bg-slate-900/60 backdrop-blur-md px-3.5 py-2 text-xs font-medium text-slate-200">
              <CheckCircle className="h-4 w-4 text-teal-400 shrink-0" />
              <span>Real-time Conversation Intelligence</span>
            </div>
            <div className="inline-flex items-center gap-2 rounded-lg border border-slate-700/60 bg-slate-900/60 backdrop-blur-md px-3.5 py-2 text-xs font-medium text-slate-200">
              <CheckCircle className="h-4 w-4 text-teal-400 shrink-0" />
              <span>Multi-Provider STT & LLM Routing</span>
            </div>
          </div>
        </div>

        {/* Left Footer Info */}
        <div className="relative z-10 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80 pt-6">
          <span>© 2026 vopx Inc. All rights reserved.</span>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-slate-300 font-medium">System Operational</span>
          </div>
        </div>

      </div>

      {/* RIGHT PANEL — Sign Up Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-between items-center p-6 sm:p-10 relative min-h-screen overflow-y-auto custom-scrollbar">
        
        {/* Top Bar (Theme Toggle + Mobile Brand) */}
        <div className="w-full flex items-center justify-between z-10 mb-4">
          <div className="lg:hidden flex items-center gap-2 font-bold tracking-tight">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-700 dark:bg-teal-600 text-white font-black text-sm shadow-sm">
              vx
            </div>
            <span className="text-lg font-extrabold text-foreground">
              vop<span className="text-teal-700 dark:text-teal-400">x</span>
            </span>
          </div>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>

        {/* Form Container */}
        <div className="w-full max-w-md my-auto py-4 space-y-6">
          
          {/* Logo Header */}
          <div className="hidden lg:flex flex-col items-center text-center space-y-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-700 dark:bg-teal-600 text-white shadow-md font-black text-xl mb-1">
              vx
            </div>
          </div>

          <div className="text-center space-y-1.5">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Create Your Account
            </h2>
            <p className="text-sm text-muted-foreground">
              Get started with AI-powered voice orchestration
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* 1. FULL NAME */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                FULL NAME
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                  required
                  className="w-full rounded-xl border border-input bg-background/80 dark:bg-slate-900/50 pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-teal-600 dark:focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all shadow-sm"
                />
              </div>
            </div>

            {/* 2. WORK EMAIL */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                WORK EMAIL
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your work email"
                  required
                  className="w-full rounded-xl border border-input bg-background/80 dark:bg-slate-900/50 pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-teal-600 dark:focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all shadow-sm"
                />
              </div>
            </div>

            {/* 3. ORGANIZATION NAME */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                ORGANIZATION NAME
              </label>
              <div className="relative">
                <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Enter your organization name"
                  required
                  className="w-full rounded-xl border border-input bg-background/80 dark:bg-slate-900/50 pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-teal-600 dark:focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all shadow-sm"
                />
              </div>
            </div>

            {/* 4. PASSWORD */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                PASSWORD
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a password"
                  required
                  className="w-full rounded-xl border border-input bg-background/80 dark:bg-slate-900/50 pl-10 pr-10 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-teal-600 dark:focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* 5. CONFIRM PASSWORD */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                CONFIRM PASSWORD
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  required
                  className="w-full rounded-xl border border-input bg-background/80 dark:bg-slate-900/50 pl-10 pr-10 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-teal-600 dark:focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 p-3 rounded-lg border border-rose-200 dark:border-rose-900/50">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Submit CTA */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white font-semibold py-3 px-4 text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-teal-700/20 mt-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <span>Create Account</span>
              )}
            </button>
          </form>

          {/* Terms & Conditions note */}
          <p className="text-[11px] text-center text-muted-foreground leading-relaxed px-4">
            By creating an account, you agree to our{" "}
            <a href="#" className="underline font-medium hover:text-foreground">
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="#" className="underline font-medium hover:text-foreground">
              Privacy Policy
            </a>
            .
          </p>

          {/* Divider & Login Switcher */}
          <div className="pt-3 text-center border-t border-border/50 text-xs">
            <span className="text-muted-foreground">Already have an account? </span>
            <Link
              href="/login"
              className="font-bold text-teal-700 dark:text-teal-400 hover:underline transition-colors ml-1"
            >
              Login
            </Link>
          </div>

        </div>

        {/* Bottom Security Info */}
        <div className="w-full flex items-center justify-center gap-4 text-xs text-muted-foreground pt-4 border-t border-border/40">
          <div className="flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
            <span>Secure & Encrypted</span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
            <span>Enterprise-Grade Security</span>
          </div>
        </div>

      </div>

    </div>
  );
}
