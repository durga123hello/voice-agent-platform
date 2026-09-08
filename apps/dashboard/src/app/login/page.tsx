"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/auth-context";
import { Mail, ArrowLeft, Loader2, AlertCircle, CheckCircle, Shield, Lock } from "lucide-react";
import { ThemeToggle } from "../../components/theme-toggle";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();
  const { sendOtp, verifyOtp } = useAuth();

  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  
  // OTP state (6 digits)
  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Countdown timer for OTP resend (30 seconds)
  const [resendCooldown, setResendCooldown] = useState(30);
  const [canResend, setCanResend] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Simple email regex validation
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  // Handle Resend Cooldown Countdown
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === 2 && resendCooldown > 0) {
      setCanResend(false);
      timer = setInterval(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
    } else if (resendCooldown === 0) {
      setCanResend(true);
    }
    return () => clearInterval(timer);
  }, [step, resendCooldown]);

  // Handle Step 1: Send OTP
  const handleSendCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isValidEmail || isSending) return;

    setIsSending(true);
    setErrorMsg("");
    try {
      await sendOtp(email.trim());
      setStep(2);
      setResendCooldown(30);
      setOtp(Array(6).fill(""));
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    } catch (err) {
      setErrorMsg("Failed to send code. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  // Handle Step 2: Resend Code
  const handleResendCode = async () => {
    if (!canResend || isSending) return;
    setIsSending(true);
    setErrorMsg("");
    try {
      await sendOtp(email.trim());
      setResendCooldown(30);
      setOtp(Array(6).fill(""));
      inputRefs.current[0]?.focus();
    } catch (err) {
      setErrorMsg("Failed to resend code. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  // Handle OTP digit changes
  const handleOtpChange = (index: number, value: string) => {
    setErrorMsg("");
    const digit = value.replace(/[^0-9]/g, "").slice(-1);

    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    const completedCode = newOtp.join("");
    if (completedCode.length === 6 && !newOtp.includes("")) {
      handleVerify(completedCode);
    }
  };

  // Handle Backspace and Navigation
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!otp[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Handle Paste
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/[^0-9]/g, "").slice(0, 6);
    if (!pastedData) return;

    const newOtp = Array(6).fill("");
    for (let i = 0; i < pastedData.length; i++) {
      newOtp[i] = pastedData[i];
    }
    setOtp(newOtp);
    setErrorMsg("");

    if (pastedData.length === 6) {
      inputRefs.current[5]?.focus();
      handleVerify(pastedData);
    } else {
      inputRefs.current[pastedData.length]?.focus();
    }
  };

  // Handle Step 2 Verification
  const handleVerify = async (codeToVerify?: string) => {
    const code = codeToVerify || otp.join("");
    if (code.length < 6 || isVerifying) return;

    setIsVerifying(true);
    setErrorMsg("");
    try {
      const success = await verifyOtp(code);
      if (success) {
        router.replace("/users");
      } else {
        setErrorMsg("Invalid code, please try again. (Hint: enter any 6 digits)");
      }
    } catch (err) {
      setErrorMsg("Verification error. Please try again.");
    } finally {
      setIsVerifying(false);
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

      {/* RIGHT PANEL — Authentication Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-between items-center p-6 sm:p-12 relative min-h-screen">
        
        {/* Top Bar (Theme Toggle) */}
        <div className="w-full flex items-center justify-between z-10">
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

        {/* Center Card / Form */}
        <div className="w-full max-w-md my-auto py-8 space-y-8">
          
          {/* Logo Header inside Right Panel */}
          <div className="hidden lg:flex flex-col items-center text-center space-y-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-700 dark:bg-teal-600 text-white shadow-md font-black text-xl mb-1">
              vx
            </div>
          </div>

          {/* STEP 1: EMAIL ENTRY */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                  Sign in to vop.x
                </h2>
                <p className="text-sm text-muted-foreground">
                  Enter your work email to receive a one-time code
                </p>
              </div>

              <form onSubmit={handleSendCode} className="space-y-5">
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Work Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@company.com"
                      autoFocus
                      required
                      className="w-full rounded-xl border border-input bg-background/80 dark:bg-slate-900/50 pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-teal-600 dark:focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all shadow-sm"
                    />
                  </div>
                </div>

                {errorMsg && (
                  <div className="flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 p-3 rounded-lg border border-rose-200 dark:border-rose-900/50">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!isValidEmail || isSending}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white font-semibold py-3 px-4 text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-teal-700/20"
                >
                  {isSending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Sending Code...</span>
                    </>
                  ) : (
                    <span>Send Code</span>
                  )}
                </button>
              </form>

              {/* Divider & Sign Up Switcher */}
              <div className="pt-3 text-center border-t border-border/50 text-xs">
                <span className="text-muted-foreground">Don&apos;t have an account? </span>
                <Link
                  href="/signup"
                  className="font-bold text-teal-700 dark:text-teal-400 hover:underline transition-colors ml-1"
                >
                  Sign Up
                </Link>
              </div>
            </div>
          )}

          {/* STEP 2: CODE ENTRY */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                  Enter the code
                </h2>
                <p className="text-sm text-muted-foreground">
                  We sent a 6-digit verification code to{" "}
                  <span className="font-semibold text-foreground">{email}</span>
                </p>
              </div>

              <div className="space-y-5">
                {/* 6 Segmented Input Boxes */}
                <div className="flex items-center justify-center gap-2 sm:gap-3">
                  {otp.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => {
                        inputRefs.current[idx] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(idx, e)}
                      onPaste={handlePaste}
                      className={`w-11 sm:w-12 h-13 text-center text-xl font-bold rounded-xl border bg-background text-foreground outline-none transition-all shadow-sm ${
                        errorMsg
                          ? "border-rose-500 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 text-rose-600 dark:text-rose-400"
                          : "border-input focus:border-teal-600 dark:focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                      }`}
                    />
                  ))}
                </div>

                {errorMsg && (
                  <div className="flex items-center justify-center gap-2 text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 p-3 rounded-lg border border-rose-200 dark:border-rose-900/50 text-center">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => handleVerify()}
                  disabled={otp.join("").length < 6 || isVerifying}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white font-semibold py-3 px-4 text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-teal-700/20"
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <span>Verify & Continue</span>
                  )}
                </button>
              </div>

              {/* Actions Footer */}
              <div className="space-y-3 pt-4 text-center border-t border-border/50 text-xs">
                <div className="text-muted-foreground">
                  Didn&apos;t get a code?{" "}
                  {canResend ? (
                    <button
                      type="button"
                      onClick={handleResendCode}
                      disabled={isSending}
                      className="font-semibold text-teal-700 dark:text-teal-400 hover:underline inline-flex items-center gap-1"
                    >
                      {isSending && <Loader2 className="h-3 w-3 animate-spin" />}
                      Resend code
                    </button>
                  ) : (
                    <span className="font-medium text-muted-foreground/80">
                      Resend code in <span className="font-mono font-semibold">{resendCooldown}s</span>
                    </span>
                  )}
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setStep(1);
                      setErrorMsg("");
                    }}
                    className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors font-medium"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Use a different email
                  </button>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Bottom Footer Info */}
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
