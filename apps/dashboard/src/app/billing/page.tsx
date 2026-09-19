"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { 
  CreditCard, 
  CheckCircle2, 
  Check,
  Sparkles, 
  Mic, 
  Volume2, 
  Cpu, 
  Calculator, 
  ArrowRight, 
  ArrowLeft,
  ShieldCheck, 
  AlertCircle
} from "lucide-react";
import { RouteGuard } from "../../components/shell/RouteGuard";
import { usePermissions } from "../../context/permissions-context";
import { useAuth } from "../../context/auth-context";
import { Button } from "../../components/ui/button";
import { cn } from "../../lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

interface SubscriptionPlan {
  id: string;
  name: string;
  platformFee: number;
  description: string;
  isActive: boolean;
}

interface AgentOption {
  id: string;
  name: string;
  providerVendor: string;
  status: string;
  input_token_rate?: number;
  output_token_rate?: number;
  rate_per_minute?: number;
  rate_per_million_chars?: number;
}

interface ActiveSubscription {
  id: string;
  status: string;
  plan: {
    id: string;
    name: string;
    platformFee: number;
    description: string;
  };
  llmAgent?: AgentOption | null;
  sttAgent?: AgentOption | null;
  ttsAgent?: AgentOption | null;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedSttMinutes: number;
  estimatedTtsChars: number;
  aiCost: number;
  sttCost: number;
  ttsCost: number;
  platformFee: number;
  total: number;
  createdAt?: string;
}

interface ServerEstimate {
  planId: string;
  planName: string;
  platformFee: number;
  aiCost: number;
  sttCost: number;
  ttsCost: number;
  total: number;
  details: {
    llmAgentName: string | null;
    sttAgentName: string | null;
    ttsAgentName: string | null;
    estimatedInputTokens: number;
    estimatedOutputTokens: number;
    estimatedSttMinutes: number;
    estimatedTtsChars: number;
  };
}

const STEP_ITEMS = [
  { id: 1, label: "Plan", title: "Choose Subscription Plan", desc: "Select a base platform tier for your organization." },
  { id: 2, label: "AI Agent", title: "Select AI Reasoning Agent (LLM)", desc: "Choose the LLM model to power your voice agents." },
  { id: 3, label: "STT", title: "Select Speech-to-Text Agent (STT)", desc: "Select the STT engine for real-time speech transcription." },
  { id: 4, label: "TTS", title: "Select Text-to-Speech Agent (TTS)", desc: "Choose the TTS engine for natural voice response synthesis." },
  { id: 5, label: "Usage", title: "Configure Monthly Usage Estimates", desc: "Set your estimated monthly tokens, minutes, and characters." },
  { id: 6, label: "Review", title: "Estimated Monthly Cost Preview", desc: "Review your total estimated cost breakdown and activate subscription." },
];

export default function BillingPage() {
  const { token } = useAuth();
  const { can } = usePermissions();

  const [activeSubscription, setActiveSubscription] = useState<ActiveSubscription | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [llmAgents, setLlmAgents] = useState<AgentOption[]>([]);
  const [sttAgents, setSttAgents] = useState<AgentOption[]>([]);
  const [ttsAgents, setTtsAgents] = useState<AgentOption[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isEstimating, setIsEstimating] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);

  // Wizard Step State
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [maxStepReached, setMaxStepReached] = useState<number>(1);

  // Form Selections
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [selectedLlmAgentId, setSelectedLlmAgentId] = useState<string>("");
  const [selectedSttAgentId, setSelectedSttAgentId] = useState<string>("");
  const [selectedTtsAgentId, setSelectedTtsAgentId] = useState<string>("");

  // Usage Inputs
  const [inputTokens, setInputTokens] = useState<number>(500000);
  const [outputTokens, setOutputTokens] = useState<number>(150000);
  const [sttMinutes, setSttMinutes] = useState<number>(1000);
  const [ttsChars, setTtsChars] = useState<number>(250000);

  // Review State
  const [serverEstimate, setServerEstimate] = useState<ServerEstimate | null>(null);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const goToStep = useCallback((step: number) => {
    if (step >= 1 && step <= 6) {
      setCurrentStep(step);
      setMaxStepReached((prev) => Math.max(prev, step));
    }
  }, []);

  // Fetch initial billing data
  const fetchBillingData = useCallback(async () => {
    if (!token) return;
    try {
      setIsLoading(true);

      const [subRes, plansRes, agentsRes] = await Promise.all([
        fetch(`${API_BASE}/api/billing/subscription`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/subscription-plans`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/billing/agent-options`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (plansRes.ok) {
        const plansData = await plansRes.json();
        setPlans(plansData);
        if (plansData.length > 0 && !selectedPlanId) {
          setSelectedPlanId(plansData[1]?.id || plansData[0]?.id);
        }
      }

      if (agentsRes.ok) {
        const agentsData = await agentsRes.json();
        setLlmAgents(agentsData.llmAgents || []);
        setSttAgents(agentsData.sttAgents || []);
        setTtsAgents(agentsData.ttsAgents || []);

        if (agentsData.llmAgents?.length > 0 && !selectedLlmAgentId) {
          setSelectedLlmAgentId(agentsData.llmAgents[0].id);
        }
        if (agentsData.sttAgents?.length > 0 && !selectedSttAgentId) {
          setSelectedSttAgentId(agentsData.sttAgents[0].id);
        }
        if (agentsData.ttsAgents?.length > 0 && !selectedTtsAgentId) {
          setSelectedTtsAgentId(agentsData.ttsAgents[0].id);
        }
      }

      if (subRes.ok) {
        const subData = await subRes.json();
        setActiveSubscription(subData);
        if (subData) {
          setSelectedPlanId(subData.plan.id);
          if (subData.llmAgent?.id) setSelectedLlmAgentId(subData.llmAgent.id);
          if (subData.sttAgent?.id) setSelectedSttAgentId(subData.sttAgent.id);
          if (subData.ttsAgent?.id) setSelectedTtsAgentId(subData.ttsAgent.id);
          setInputTokens(subData.estimatedInputTokens || 500000);
          setOutputTokens(subData.estimatedOutputTokens || 150000);
          setSttMinutes(subData.estimatedSttMinutes || 1000);
          setTtsChars(subData.estimatedTtsChars || 250000);
        }
      }
    } catch (err) {
      console.error("Failed to load billing data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchBillingData();
  }, [fetchBillingData]);

  // Derived selections
  const currentPlan = useMemo(() => plans.find((p) => p.id === selectedPlanId), [plans, selectedPlanId]);
  const currentLlmAgent = useMemo(() => llmAgents.find((a) => a.id === selectedLlmAgentId), [llmAgents, selectedLlmAgentId]);
  const currentSttAgent = useMemo(() => sttAgents.find((a) => a.id === selectedSttAgentId), [sttAgents, selectedSttAgentId]);
  const currentTtsAgent = useMemo(() => ttsAgents.find((a) => a.id === selectedTtsAgentId), [ttsAgents, selectedTtsAgentId]);

  // Client-side live preview estimate calculation
  const livePreviewCost = useMemo(() => {
    const platformFee = currentPlan?.platformFee || 0;
    const inputRate = currentLlmAgent?.input_token_rate || 250;
    const outputRate = currentLlmAgent?.output_token_rate || 1000;
    const sttRate = currentSttAgent?.rate_per_minute || 0.80;
    const ttsRate = currentTtsAgent?.rate_per_million_chars || 1200;

    const aiCost = (inputTokens / 1_000_000) * inputRate + (outputTokens / 1_000_000) * outputRate;
    const sttCost = sttMinutes * sttRate;
    const ttsCost = (ttsChars / 1_000_000) * ttsRate;
    const total = aiCost + sttCost + ttsCost + platformFee;

    return {
      aiCost: Math.round(aiCost * 100) / 100,
      sttCost: Math.round(sttCost * 100) / 100,
      ttsCost: Math.round(ttsCost * 100) / 100,
      platformFee,
      total: Math.round(total * 100) / 100,
    };
  }, [currentPlan, currentLlmAgent, currentSttAgent, currentTtsAgent, inputTokens, outputTokens, sttMinutes, ttsChars]);

  // Validate step completion
  const isStepValid = useCallback((step: number): boolean => {
    switch (step) {
      case 1:
        return Boolean(selectedPlanId);
      case 2:
        return Boolean(selectedLlmAgentId);
      case 3:
        return Boolean(selectedSttAgentId);
      case 4:
        return Boolean(selectedTtsAgentId);
      case 5:
        return Boolean(inputTokens > 0 && outputTokens > 0 && sttMinutes > 0 && ttsChars > 0);
      case 6:
        return true;
      default:
        return false;
    }
  }, [selectedPlanId, selectedLlmAgentId, selectedSttAgentId, selectedTtsAgentId, inputTokens, outputTokens, sttMinutes, ttsChars]);

  // Handle Step 5 -> Step 6 transition ("Review Subscription")
  const handleNextFromStep5 = async () => {
    if (!token || !selectedPlanId) {
      goToStep(6);
      return;
    }
    try {
      setIsEstimating(true);
      setNotification(null);

      const res = await fetch(`${API_BASE}/api/billing/estimate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          planId: selectedPlanId,
          llmAgentId: selectedLlmAgentId,
          sttAgentId: selectedSttAgentId,
          ttsAgentId: selectedTtsAgentId,
          estimatedInputTokens: inputTokens,
          estimatedOutputTokens: outputTokens,
          estimatedSttMinutes: sttMinutes,
          estimatedTtsChars: ttsChars,
        }),
      });

      if (res.ok) {
        const estimateData = await res.json();
        setServerEstimate(estimateData);
      }
    } catch (err) {
      console.error("Error fetching estimate:", err);
    } finally {
      setIsEstimating(false);
      goToStep(6);
    }
  };

  // Handle Confirm & Subscribe Button Click
  const handleConfirmSubscribe = async () => {
    if (!token || !selectedPlanId) return;
    try {
      setIsSubscribing(true);

      const res = await fetch(`${API_BASE}/api/billing/subscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          planId: selectedPlanId,
          llmAgentId: selectedLlmAgentId,
          sttAgentId: selectedSttAgentId,
          ttsAgentId: selectedTtsAgentId,
          estimatedInputTokens: inputTokens,
          estimatedOutputTokens: outputTokens,
          estimatedSttMinutes: sttMinutes,
          estimatedTtsChars: ttsChars,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setActiveSubscription(data.subscription);
        setNotification({
          type: "success",
          message: `Subscription successfully activated for ${data.subscription.plan.name} Plan!`,
        });
      } else {
        const err = await res.json();
        setNotification({ type: "error", message: err.error || "Failed to activate subscription." });
      }
    } catch (err) {
      console.error("Error subscribing:", err);
      setNotification({ type: "error", message: "Server request failed during subscription." });
    } finally {
      setIsSubscribing(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(val);
  };

  const activeStepDetails = STEP_ITEMS.find((s) => s.id === currentStep) || STEP_ITEMS[0];

  return (
    <RouteGuard module="billing">
      <div className="space-y-8 pb-16">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-500/10 text-teal-700 dark:text-teal-400 border border-teal-500/20 shadow-xs">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                Billing & Subscription
              </h1>
              <p className="text-xs text-muted-foreground">
                Manage platform tier, select voice & reasoning engines, configure usage, and review billing.
              </p>
            </div>
          </div>
        </div>

        {/* Notifications Banner */}
        {notification && (
          <div
            className={cn(
              "flex items-center justify-between gap-3 p-4 rounded-xl text-xs font-medium border shadow-2xs",
              notification.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800"
                : "bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-800"
            )}
          >
            <div className="flex items-center gap-2.5">
              {notification.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
              )}
              <span>{notification.message}</span>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-xs opacity-70 hover:opacity-100 font-bold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ALWAYS-VISIBLE TOP SECTION: Current Plan Card */}
        <div className="rounded-2xl border border-border bg-gradient-to-br from-card via-card to-teal-500/5 p-6 shadow-xs relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Current Active Plan
                </span>
                {activeSubscription ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                    No Active Plan
                  </span>
                )}
              </div>

              <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
                {activeSubscription ? `${activeSubscription.plan.name} Tier` : "No Active Subscription"}
              </h2>
              <p className="text-xs text-muted-foreground max-w-xl">
                {activeSubscription
                  ? activeSubscription.plan.description
                  : "Your organization has not subscribed to a platform tier yet. Choose a plan and configure your voice agents below to activate."}
              </p>
            </div>

            {/* Current Monthly Cost Box */}
            <div className="flex flex-col items-start md:items-end justify-center bg-card/80 border border-border/80 p-4 rounded-xl min-w-[220px] shadow-2xs">
              <span className="text-xs font-medium text-muted-foreground">Estimated Monthly Charge</span>
              <div className="text-2xl font-black text-teal-700 dark:text-teal-400 mt-1">
                {activeSubscription ? formatCurrency(activeSubscription.total) : "₹0.00"}
              </div>
              <span className="text-[11px] text-muted-foreground/80 mt-0.5">Billed monthly</span>
            </div>
          </div>

          {/* Active Subscription Agent Details */}
          {activeSubscription && (
            <div className="mt-6 pt-5 border-t border-border/60 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border border-border/50">
                <Cpu className="h-4 w-4 text-teal-600 shrink-0" />
                <div className="min-w-0">
                  <div className="font-semibold text-foreground truncate">
                    {activeSubscription.llmAgent?.name || "No LLM Agent"}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {activeSubscription.llmAgent?.providerVendor || "Default"}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border border-border/50">
                <Mic className="h-4 w-4 text-emerald-600 shrink-0" />
                <div className="min-w-0">
                  <div className="font-semibold text-foreground truncate">
                    {activeSubscription.sttAgent?.name || "No STT Agent"}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {activeSubscription.sttAgent?.providerVendor || "Default"}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border border-border/50">
                <Volume2 className="h-4 w-4 text-blue-600 shrink-0" />
                <div className="min-w-0">
                  <div className="font-semibold text-foreground truncate">
                    {activeSubscription.ttsAgent?.name || "No TTS Agent"}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {activeSubscription.ttsAgent?.providerVendor || "Default"}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* BUILD YOUR SUBSCRIPTION STEP-BY-STEP WIZARD CONTAINER */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-6">
          {/* Header & Title */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/60">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-teal-600" />
                <span>Build Your Subscription</span>
              </h2>
              <p className="text-xs text-muted-foreground">
                Step-by-step subscription wizard. Complete each section to configure your plan.
              </p>
            </div>

            <div className="text-xs font-semibold text-teal-700 dark:text-teal-400 bg-teal-500/10 px-3 py-1 rounded-full border border-teal-500/20 self-start sm:self-auto">
              Step {currentStep} of 6
            </div>
          </div>

          {/* 1. HORIZONTAL STEP INDICATOR */}
          <div className="py-2 border-b border-border/50 overflow-x-auto custom-scrollbar">
            <div className="flex items-center justify-between min-w-[620px] gap-2">
              {STEP_ITEMS.map((step, idx) => {
                const stepNum = step.id;
                const isCompleted = stepNum < currentStep;
                const isCurrent = stepNum === currentStep;
                const isClickable = stepNum <= maxStepReached;

                return (
                  <React.Fragment key={stepNum}>
                    <button
                      type="button"
                      onClick={() => isClickable && goToStep(stepNum)}
                      disabled={!isClickable}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 focus:outline-none focus:ring-2 focus:ring-teal-500/20",
                        isCurrent
                          ? "bg-teal-700 text-white shadow-xs font-bold"
                          : isCompleted
                          ? "bg-teal-500/10 text-teal-800 dark:text-teal-300 hover:bg-teal-500/20 cursor-pointer"
                          : isClickable
                          ? "bg-muted/50 text-foreground hover:bg-muted cursor-pointer"
                          : "bg-muted/20 text-muted-foreground/50 cursor-not-allowed opacity-60"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-extrabold shrink-0",
                          isCurrent
                            ? "bg-white text-teal-800"
                            : isCompleted
                            ? "bg-teal-700 text-white"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {isCompleted ? <Check className="h-3 w-3 stroke-[3]" /> : stepNum}
                      </span>
                      <span className="whitespace-nowrap">{step.label}</span>
                    </button>

                    {idx < STEP_ITEMS.length - 1 && (
                      <div
                        className={cn(
                          "h-0.5 w-6 sm:w-8 shrink-0 transition-colors rounded-full",
                          stepNum < currentStep ? "bg-teal-600 dark:bg-teal-500" : "bg-border"
                        )}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* 2. COMPACT SUMMARY FOR COMPLETED STEPS */}
          {currentStep > 1 && (
            <div className="rounded-xl border border-teal-500/20 bg-teal-500/5 p-4 text-xs space-y-2.5">
              <div className="flex items-center justify-between font-bold text-teal-800 dark:text-teal-300">
                <span className="flex items-center gap-1.5 uppercase text-[10px] tracking-wider">
                  <CheckCircle2 className="h-3.5 w-3.5 text-teal-600" />
                  Completed Selections Summary
                </span>
                <span className="text-[11px] font-normal text-muted-foreground">
                  Click any selection to return to that step
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
                {currentStep > 1 && (
                  <div 
                    onClick={() => goToStep(1)}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-border/60 bg-card hover:border-teal-500/40 cursor-pointer transition-colors"
                  >
                    <div className="min-w-0">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block">1. Plan</span>
                      <span className="font-semibold text-foreground truncate block">
                        {currentPlan ? `${currentPlan.name} Tier` : "None"}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-teal-700 dark:text-teal-400 font-bold shrink-0 ml-2">
                      {currentPlan ? formatCurrency(currentPlan.platformFee) : "—"}
                    </span>
                  </div>
                )}

                {currentStep > 2 && (
                  <div 
                    onClick={() => goToStep(2)}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-border/60 bg-card hover:border-teal-500/40 cursor-pointer transition-colors"
                  >
                    <div className="min-w-0">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block">2. AI Agent</span>
                      <span className="font-semibold text-foreground truncate block">
                        {currentLlmAgent?.name || "None"}
                      </span>
                    </div>
                    <Cpu className="h-3.5 w-3.5 text-teal-600 shrink-0 ml-2" />
                  </div>
                )}

                {currentStep > 3 && (
                  <div 
                    onClick={() => goToStep(3)}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-border/60 bg-card hover:border-teal-500/40 cursor-pointer transition-colors"
                  >
                    <div className="min-w-0">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block">3. STT Agent</span>
                      <span className="font-semibold text-foreground truncate block">
                        {currentSttAgent?.name || "None"}
                      </span>
                    </div>
                    <Mic className="h-3.5 w-3.5 text-emerald-600 shrink-0 ml-2" />
                  </div>
                )}

                {currentStep > 4 && (
                  <div 
                    onClick={() => goToStep(4)}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-border/60 bg-card hover:border-teal-500/40 cursor-pointer transition-colors"
                  >
                    <div className="min-w-0">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block">4. TTS Agent</span>
                      <span className="font-semibold text-foreground truncate block">
                        {currentTtsAgent?.name || "None"}
                      </span>
                    </div>
                    <Volume2 className="h-3.5 w-3.5 text-blue-600 shrink-0 ml-2" />
                  </div>
                )}

                {currentStep > 5 && (
                  <div 
                    onClick={() => goToStep(5)}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-border/60 bg-card hover:border-teal-500/40 cursor-pointer transition-colors col-span-1 sm:col-span-2 lg:col-span-4"
                  >
                    <div className="min-w-0">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block">5. Configured Usage</span>
                      <span className="font-mono text-[11px] text-foreground truncate block">
                        Input: {inputTokens.toLocaleString()} | Output: {outputTokens.toLocaleString()} | STT: {sttMinutes.toLocaleString()} mins | TTS: {ttsChars.toLocaleString()} chars
                      </span>
                    </div>
                    <Calculator className="h-3.5 w-3.5 text-teal-600 shrink-0 ml-2" />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ACTIVE STEP CONTENT CONTAINER */}
          <div className="pt-2">
            <div className="mb-4">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-700 text-white text-[11px]">
                  {currentStep}
                </span>
                <span>{activeStepDetails.title}</span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {activeStepDetails.desc}
              </p>
            </div>

            {/* STEP 1: Choose Subscription Plan */}
            {currentStep === 1 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {plans.map((p) => {
                  const isSelected = p.id === selectedPlanId;
                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedPlanId(p.id)}
                      className={cn(
                        "group relative rounded-xl border p-5 cursor-pointer transition-all duration-200 bg-card shadow-2xs hover:shadow-md",
                        isSelected
                          ? "border-teal-600 dark:border-teal-400 ring-2 ring-teal-500/20 bg-teal-500/5"
                          : "border-border hover:border-border/80"
                      )}
                    >
                      {isSelected && (
                        <div className="absolute top-3 right-3 flex items-center gap-1 text-[10px] font-bold text-teal-800 dark:text-teal-300 bg-teal-500/15 px-2 py-0.5 rounded-full border border-teal-500/30">
                          <CheckCircle2 className="h-3 w-3 text-teal-600" />
                          <span>Selected</span>
                        </div>
                      )}
                      <h3 className="text-base font-bold text-foreground group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors">
                        {p.name} Plan
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1.5 min-h-[36px]">
                        {p.description}
                      </p>
                      <div className="mt-4 pt-3 border-t border-border/60">
                        <div className="text-xl font-black text-foreground">
                          {formatCurrency(p.platformFee)}
                          <span className="text-xs font-normal text-muted-foreground"> / month</span>
                        </div>
                        <span className="text-[11px] text-muted-foreground">Base platform fee</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* STEP 2: Select AI Reasoning Agent (LLM) */}
            {currentStep === 2 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {llmAgents.map((agent) => {
                  const isSelected = agent.id === selectedLlmAgentId;
                  return (
                    <div
                      key={agent.id}
                      onClick={() => setSelectedLlmAgentId(agent.id)}
                      className={cn(
                        "relative rounded-xl border p-4 cursor-pointer transition-all duration-200 bg-card shadow-2xs hover:shadow-md",
                        isSelected
                          ? "border-teal-600 dark:border-teal-400 ring-2 ring-teal-500/20 bg-teal-500/5"
                          : "border-border hover:border-border/80"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20 shrink-0">
                            <Cpu className="h-4 w-4" />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-foreground truncate max-w-[160px]">
                              {agent.name}
                            </h4>
                            <span className="text-[11px] text-muted-foreground font-mono">
                              {agent.providerVendor}
                            </span>
                          </div>
                        </div>
                        {isSelected && (
                          <CheckCircle2 className="h-4 w-4 text-teal-600 dark:text-teal-400 shrink-0" />
                        )}
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center justify-between text-[11px]">
                        <div>
                          <span className="text-muted-foreground">Input: </span>
                          <span className="font-mono font-bold text-foreground">
                            {formatCurrency(agent.input_token_rate || 250)} / 1M
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Output: </span>
                          <span className="font-mono font-bold text-foreground">
                            {formatCurrency(agent.output_token_rate || 1000)} / 1M
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* STEP 3: Select Speech-to-Text Agent (STT) */}
            {currentStep === 3 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sttAgents.map((agent) => {
                  const isSelected = agent.id === selectedSttAgentId;
                  return (
                    <div
                      key={agent.id}
                      onClick={() => setSelectedSttAgentId(agent.id)}
                      className={cn(
                        "relative rounded-xl border p-4 cursor-pointer transition-all duration-200 bg-card shadow-2xs hover:shadow-md",
                        isSelected
                          ? "border-emerald-600 dark:border-emerald-400 ring-2 ring-emerald-500/20 bg-emerald-500/5"
                          : "border-border hover:border-border/80"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                            <Mic className="h-4 w-4" />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-foreground truncate max-w-[160px]">
                              {agent.name}
                            </h4>
                            <span className="text-[11px] text-muted-foreground font-mono">
                              {agent.providerVendor}
                            </span>
                          </div>
                        </div>
                        {isSelected && (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        )}
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">Transcription Rate:</span>
                        <span className="font-mono font-bold text-foreground">
                          {formatCurrency(agent.rate_per_minute || 0.80)} / min
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* STEP 4: Select Text-to-Speech Agent (TTS) */}
            {currentStep === 4 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {ttsAgents.map((agent) => {
                  const isSelected = agent.id === selectedTtsAgentId;
                  return (
                    <div
                      key={agent.id}
                      onClick={() => setSelectedTtsAgentId(agent.id)}
                      className={cn(
                        "relative rounded-xl border p-4 cursor-pointer transition-all duration-200 bg-card shadow-2xs hover:shadow-md",
                        isSelected
                          ? "border-blue-600 dark:border-blue-400 ring-2 ring-blue-500/20 bg-blue-500/5"
                          : "border-border hover:border-border/80"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shrink-0">
                            <Volume2 className="h-4 w-4" />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-foreground truncate max-w-[160px]">
                              {agent.name}
                            </h4>
                            <span className="text-[11px] text-muted-foreground font-mono">
                              {agent.providerVendor}
                            </span>
                          </div>
                        </div>
                        {isSelected && (
                          <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                        )}
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">Synthesis Rate:</span>
                        <span className="font-mono font-bold text-foreground">
                          {formatCurrency(agent.rate_per_million_chars || 1200)} / 1M chars
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* STEP 5: Configure Monthly Usage Estimates */}
            {currentStep === 5 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-card border border-border p-6 rounded-2xl shadow-2xs">
                {/* AI Tokens Side-by-Side */}
                <div className="space-y-4 col-span-1 lg:col-span-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                    <Cpu className="h-4 w-4 text-teal-600" />
                    <span>AI Tokens (Input & Output)</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {/* Estimated Input Tokens */}
                    <div className="space-y-2 p-4 rounded-xl bg-muted/30 border border-border/60">
                      <div className="flex items-center justify-between text-xs">
                        <label className="font-semibold text-foreground">Est. Input Tokens / Month</label>
                        <span className="font-mono text-xs font-bold text-teal-700 dark:text-teal-400">
                          {inputTokens.toLocaleString()} tokens
                        </span>
                      </div>
                      <input
                        type="range"
                        min={50000}
                        max={5000000}
                        step={50000}
                        value={inputTokens}
                        onChange={(e) => setInputTokens(Number(e.target.value))}
                        className="w-full accent-teal-600 h-2 bg-muted rounded-lg cursor-pointer"
                      />
                      <input
                        type="number"
                        value={inputTokens}
                        onChange={(e) => setInputTokens(Math.max(0, Number(e.target.value)))}
                        className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-teal-500"
                      />
                    </div>

                    {/* Estimated Output Tokens */}
                    <div className="space-y-2 p-4 rounded-xl bg-muted/30 border border-border/60">
                      <div className="flex items-center justify-between text-xs">
                        <label className="font-semibold text-foreground">Est. Output Tokens / Month</label>
                        <span className="font-mono text-xs font-bold text-teal-700 dark:text-teal-400">
                          {outputTokens.toLocaleString()} tokens
                        </span>
                      </div>
                      <input
                        type="range"
                        min={10000}
                        max={2000000}
                        step={10000}
                        value={outputTokens}
                        onChange={(e) => setOutputTokens(Number(e.target.value))}
                        className="w-full accent-teal-600 h-2 bg-muted rounded-lg cursor-pointer"
                      />
                      <input
                        type="number"
                        value={outputTokens}
                        onChange={(e) => setOutputTokens(Math.max(0, Number(e.target.value)))}
                        className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-teal-500"
                      />
                    </div>
                  </div>
                </div>

                {/* STT Minutes */}
                <div className="space-y-2 p-4 rounded-xl bg-muted/30 border border-border/60">
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-semibold text-foreground flex items-center gap-1.5">
                      <Mic className="h-3.5 w-3.5 text-emerald-600" />
                      Est. STT Minutes / Month
                    </label>
                    <span className="font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400">
                      {sttMinutes.toLocaleString()} mins
                    </span>
                  </div>
                  <input
                    type="range"
                    min={100}
                    max={20000}
                    step={100}
                    value={sttMinutes}
                    onChange={(e) => setSttMinutes(Number(e.target.value))}
                    className="w-full accent-emerald-600 h-2 bg-muted rounded-lg cursor-pointer"
                  />
                  <input
                    type="number"
                    value={sttMinutes}
                    onChange={(e) => setSttMinutes(Math.max(0, Number(e.target.value)))}
                    className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                {/* TTS Characters */}
                <div className="space-y-2 p-4 rounded-xl bg-muted/30 border border-border/60">
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-semibold text-foreground flex items-center gap-1.5">
                      <Volume2 className="h-3.5 w-3.5 text-blue-600" />
                      Est. TTS Characters / Month
                    </label>
                    <span className="font-mono text-xs font-bold text-blue-700 dark:text-blue-400">
                      {ttsChars.toLocaleString()} chars
                    </span>
                  </div>
                  <input
                    type="range"
                    min={50000}
                    max={5000000}
                    step={50000}
                    value={ttsChars}
                    onChange={(e) => setTtsChars(Number(e.target.value))}
                    className="w-full accent-blue-600 h-2 bg-muted rounded-lg cursor-pointer"
                  />
                  <input
                    type="number"
                    value={ttsChars}
                    onChange={(e) => setTtsChars(Math.max(0, Number(e.target.value)))}
                    className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            {/* STEP 6: Review & Confirm Subscription */}
            {currentStep === 6 && (
              <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-6">
                {/* Authoritative / Live Cost Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div className="p-4 rounded-xl bg-muted/40 border border-border/60">
                    <div className="text-muted-foreground font-medium">Platform Fee ({currentPlan?.name || "Plan"})</div>
                    <div className="text-lg font-bold text-foreground mt-1 font-mono">
                      {formatCurrency(serverEstimate?.platformFee ?? livePreviewCost.platformFee)}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-muted/40 border border-border/60">
                    <div className="text-muted-foreground font-medium">AI Tokens Cost</div>
                    <div className="text-lg font-bold text-teal-700 dark:text-teal-400 mt-1 font-mono">
                      {formatCurrency(serverEstimate?.aiCost ?? livePreviewCost.aiCost)}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-muted/40 border border-border/60">
                    <div className="text-muted-foreground font-medium">STT Transcription Cost</div>
                    <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400 mt-1 font-mono">
                      {formatCurrency(serverEstimate?.sttCost ?? livePreviewCost.sttCost)}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-muted/40 border border-border/60">
                    <div className="text-muted-foreground font-medium">TTS Synthesis Cost</div>
                    <div className="text-lg font-bold text-blue-700 dark:text-blue-400 mt-1 font-mono">
                      {formatCurrency(serverEstimate?.ttsCost ?? livePreviewCost.ttsCost)}
                    </div>
                  </div>
                </div>

                {/* Breakdown Details Table */}
                <div className="space-y-3 border border-border rounded-xl p-5 bg-muted/20 text-xs">
                  <div className="flex items-center gap-2 font-bold text-foreground uppercase tracking-wider text-[11px] pb-2 border-b border-border">
                    <ShieldCheck className="h-4 w-4 text-teal-600" />
                    <span>Verified Monthly Cost Breakdown</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                    <div className="space-y-2">
                      <div className="flex justify-between py-1 border-b border-border/40 font-mono">
                        <span className="text-muted-foreground">Base Platform Fee:</span>
                        <span className="font-semibold text-foreground">
                          {formatCurrency(serverEstimate?.platformFee ?? livePreviewCost.platformFee)}
                        </span>
                      </div>

                      <div className="flex justify-between py-1 border-b border-border/40 font-mono">
                        <span className="text-muted-foreground">
                          AI Tokens ({inputTokens.toLocaleString()} in / {outputTokens.toLocaleString()} out):
                        </span>
                        <span className="font-semibold text-teal-700 dark:text-teal-400">
                          {formatCurrency(serverEstimate?.aiCost ?? livePreviewCost.aiCost)}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between py-1 border-b border-border/40 font-mono">
                        <span className="text-muted-foreground">
                          Speech-to-Text ({sttMinutes.toLocaleString()} mins):
                        </span>
                        <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                          {formatCurrency(serverEstimate?.sttCost ?? livePreviewCost.sttCost)}
                        </span>
                      </div>

                      <div className="flex justify-between py-1 border-b border-border/40 font-mono">
                        <span className="text-muted-foreground">
                          Text-to-Speech ({ttsChars.toLocaleString()} chars):
                        </span>
                        <span className="font-semibold text-blue-700 dark:text-blue-400">
                          {formatCurrency(serverEstimate?.ttsCost ?? livePreviewCost.ttsCost)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-3 border-t border-border font-bold">
                    <span className="text-foreground text-xs uppercase tracking-wider">Total Estimated Monthly Charge:</span>
                    <span className="text-2xl font-black text-teal-700 dark:text-teal-400 font-mono">
                      {formatCurrency(serverEstimate?.total ?? livePreviewCost.total)}
                      <span className="text-xs font-normal text-muted-foreground font-sans"> / mo</span>
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* STEP NAVIGATION BOTTOM BAR */}
          <div className="flex items-center justify-between pt-6 border-t border-border mt-6">
            {currentStep > 1 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => goToStep(currentStep - 1)}
                className="text-xs font-semibold gap-1.5"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back</span>
              </Button>
            ) : (
              <div />
            )}

            {currentStep < 5 && (
              <Button
                type="button"
                size="sm"
                disabled={!isStepValid(currentStep)}
                onClick={() => goToStep(currentStep + 1)}
                className="bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold px-5 gap-1.5 shadow-xs"
              >
                <span>Next</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}

            {currentStep === 5 && (
              <Button
                type="button"
                size="sm"
                disabled={isEstimating || !can("billing", "edit")}
                onClick={handleNextFromStep5}
                className="bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold px-6 gap-1.5 shadow-xs"
              >
                {isEstimating ? (
                  <span>Validating Estimate...</span>
                ) : (
                  <>
                    <span>Review Subscription</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </Button>
            )}

            {currentStep === 6 && (
              <Button
                type="button"
                size="sm"
                disabled={isSubscribing || !can("billing", "edit")}
                onClick={handleConfirmSubscribe}
                className="bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold px-6 gap-1.5 shadow-xs"
              >
                {isSubscribing ? (
                  <span>Activating Subscription...</span>
                ) : !can("billing", "edit") ? (
                  <span>Requires Edit Permission</span>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Confirm & Subscribe</span>
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </RouteGuard>
  );
}
