"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { 
  Bot, 
  Pencil,
  CheckCircle2, 
  ArrowLeft,
  Key,
  Eye,
  EyeOff,
  Cpu,
  Sliders
} from "lucide-react";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Button } from "../ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "../ui/select";
import { AIAgent, AgentStatus } from "../../types/agent";

const STORAGE_KEY = "vopx_agents_data_v1";

export function AgentForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams ? searchParams.get("edit") : null;
  const isEditMode = Boolean(editId);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    agentId: "",
    provider: "OpenAI",
    availableModels: "gpt-4o, gpt-4o-mini",
    status: "Active" as AgentStatus,
    apiKey: "",
    systemPrompt: "",
    temperature: 0.3,
  });

  const [showApiKey, setShowApiKey] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Provider model presets map
  const providerPresets: Record<string, string> = {
    "OpenAI": "gpt-4o, gpt-4o-mini",
    "Anthropic": "claude-3-5-sonnet, claude-3-haiku",
    "Groq": "llama-3.3-70b-versatile, mixtral-8x7b",
    "Google DeepMind": "gemini-1.5-pro, gemini-1.5-flash",
    "DeepSeek": "deepseek-chat, deepseek-coder"
  };

  const handleProviderChange = (newProvider: string) => {
    setFormData((prev) => ({
      ...prev,
      provider: newProvider,
      availableModels: providerPresets[newProvider] || prev.availableModels,
    }));
  };

  // Pre-fill on Edit
  useEffect(() => {
    if (!editId) return;
    try {
      const existing = localStorage.getItem(STORAGE_KEY);
      if (existing) {
        const agentList: AIAgent[] = JSON.parse(existing);
        const target = agentList.find((a) => a.id === editId);
        if (target) {
          setFormData({
            name: target.name,
            agentId: target.agentId,
            provider: target.provider,
            availableModels: target.availableModels,
            status: target.status,
            apiKey: target.apiKey,
            systemPrompt: target.systemPrompt || "",
            temperature: target.temperature ?? 0.3,
          });
        }
      }
    } catch (e) {
      console.error("Failed loading agent for edit", e);
    }
  }, [editId]);

  // Validation
  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = "Agent name is required";
    if (!formData.agentId.trim()) newErrors.agentId = "Agent ID is required";
    if (!formData.availableModels.trim()) newErrors.availableModels = "At least one model is required";
    if (!formData.apiKey.trim()) newErrors.apiKey = "API key is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submit Handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);

    const formattedDate = new Date().toLocaleDateString("en-US", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    if (isEditMode && editId) {
      try {
        const existing = localStorage.getItem(STORAGE_KEY);
        const agentList: AIAgent[] = existing ? JSON.parse(existing) : [];
        const updatedList = agentList.map((a) => {
          if (a.id === editId) {
            return {
              ...a,
              name: formData.name.trim(),
              agentId: formData.agentId.trim().toUpperCase(),
              provider: formData.provider,
              availableModels: formData.availableModels.trim(),
              status: formData.status,
              apiKey: formData.apiKey.trim(),
              systemPrompt: formData.systemPrompt.trim() || undefined,
              temperature: Number(formData.temperature),
            };
          }
          return a;
        });

        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
      } catch (err) {
        console.error("Failed updating agent", err);
      }

      setToastMessage(`Agent ${formData.name} updated successfully! Redirecting...`);
      setTimeout(() => {
        router.push("/agents");
      }, 900);
      return;
    }

    // CREATE MODE
    const newAgent: AIAgent = {
      id: `agt-${Date.now()}`,
      agentId: formData.agentId.trim().toUpperCase(),
      name: formData.name.trim(),
      provider: formData.provider,
      availableModels: formData.availableModels.trim(),
      status: formData.status,
      apiKey: formData.apiKey.trim(),
      systemPrompt: formData.systemPrompt.trim() || undefined,
      temperature: Number(formData.temperature),
      createdAt: formattedDate,
    };

    try {
      const existing = localStorage.getItem(STORAGE_KEY);
      const agentList: AIAgent[] = existing ? JSON.parse(existing) : [];
      agentList.unshift(newAgent);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(agentList));
    } catch (err) {
      console.error("Failed saving agent", err);
    }

    setToastMessage(`AI Agent ${newAgent.name} provisioned successfully! Redirecting...`);
    setTimeout(() => {
      router.push("/agents");
    }, 900);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pb-24">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 right-6 z-50 flex items-center gap-2.5 rounded-lg border border-emerald-500/40 bg-emerald-950/90 px-4 py-3 text-xs font-semibold text-emerald-300 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 pb-3 border-b border-border/60">
        <Button variant="ghost" size="icon" asChild className="h-8 w-8 text-muted-foreground">
          <Link href="/agents">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            {isEditMode ? (
              <>
                <Pencil className="h-5 w-5 text-teal-700 dark:text-teal-400" />
                Edit AI Voice Agent
              </>
            ) : (
              <>
                <Bot className="h-5 w-5 text-teal-700 dark:text-teal-400" />
                Provision AI Voice Agent
              </>
            )}
          </h1>
          <p className="text-xs text-muted-foreground">
            {isEditMode 
              ? `Update conversational parameters, prompt persona, model routing, and API credentials.`
              : `Configure an intelligent voice agent persona, model selection, and credentials for real-time telephony.`}
          </p>
        </div>
      </div>

      {/* Form Content */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-xs space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* 1. Agent Name */}
          <div className="space-y-1.5">
            <Label htmlFor="agentName" className="text-xs font-semibold text-foreground flex items-center gap-1">
              Agent Name <span className="text-teal-700 dark:text-teal-400 font-bold">*</span>
            </Label>
            <Input
              id="agentName"
              placeholder="e.g. Healthcare Triage Assistant"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={errors.name ? "border-rose-500" : ""}
            />
            {errors.name && <p className="text-[11px] text-rose-500">{errors.name}</p>}
          </div>

          {/* 2. Agent ID */}
          <div className="space-y-1.5">
            <Label htmlFor="agentId" className="text-xs font-semibold text-foreground flex items-center gap-1">
              Agent ID <span className="text-teal-700 dark:text-teal-400 font-bold">*</span>
            </Label>
            <Input
              id="agentId"
              placeholder="e.g. AGT-701"
              value={formData.agentId}
              onChange={(e) => setFormData({ ...formData, agentId: e.target.value.toUpperCase() })}
              className={`font-mono text-xs ${errors.agentId ? "border-rose-500" : ""}`}
            />
            {errors.agentId && <p className="text-[11px] text-rose-500">{errors.agentId}</p>}
          </div>

          {/* 3. Provider */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground flex items-center gap-1">
              LLM Provider <span className="text-teal-700 dark:text-teal-400 font-bold">*</span>
            </Label>
            <Select
              value={formData.provider}
              onValueChange={handleProviderChange}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="OpenAI">OpenAI</SelectItem>
                <SelectItem value="Anthropic">Anthropic</SelectItem>
                <SelectItem value="Groq">Groq</SelectItem>
                <SelectItem value="Google DeepMind">Google DeepMind</SelectItem>
                <SelectItem value="DeepSeek">DeepSeek</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 4. Available Models */}
          <div className="space-y-1.5">
            <Label htmlFor="availableModels" className="text-xs font-semibold text-foreground flex items-center gap-1">
              Available Models (comma-separated) <span className="text-teal-700 dark:text-teal-400 font-bold">*</span>
            </Label>
            <Input
              id="availableModels"
              placeholder="e.g. gpt-4o, gpt-4o-mini"
              value={formData.availableModels}
              onChange={(e) => setFormData({ ...formData, availableModels: e.target.value })}
              className={`font-mono text-xs ${errors.availableModels ? "border-rose-500" : ""}`}
            />
            {errors.availableModels && <p className="text-[11px] text-rose-500">{errors.availableModels}</p>}
          </div>

          {/* 5. Status */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground flex items-center gap-1">
              Status <span className="text-teal-700 dark:text-teal-400 font-bold">*</span>
            </Label>
            <Select
              value={formData.status}
              onValueChange={(val) => setFormData({ ...formData, status: val as AgentStatus })}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Active">🟢 Active</SelectItem>
                <SelectItem value="Training">🟣 Training</SelectItem>
                <SelectItem value="Testing">🔵 Testing</SelectItem>
                <SelectItem value="Inactive">⚪ Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 6. Temperature */}
          <div className="space-y-1.5">
            <Label htmlFor="temperature" className="text-xs font-semibold text-foreground flex items-center gap-1">
              Temperature (0.0 to 1.0)
            </Label>
            <Input
              id="temperature"
              type="number"
              step="0.05"
              min="0"
              max="1"
              value={formData.temperature}
              onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) || 0 })}
              className="font-mono text-xs"
            />
          </div>

          {/* 7. API Key */}
          <div className="space-y-1.5 md:col-span-2 lg:col-span-3">
            <Label htmlFor="apiKey" className="text-xs font-semibold text-foreground flex items-center gap-1">
              Provider API Key <span className="text-teal-700 dark:text-teal-400 font-bold">*</span>
            </Label>
            <div className="relative max-w-md">
              <Key className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                id="apiKey"
                type={showApiKey ? "text" : "password"}
                placeholder="sk-live-..."
                value={formData.apiKey}
                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                className={`pl-9 pr-9 font-mono text-xs ${errors.apiKey ? "border-rose-500" : ""}`}
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.apiKey && <p className="text-[11px] text-rose-500">{errors.apiKey}</p>}
          </div>
        </div>

        {/* System Prompt Textarea */}
        <div className="pt-2 border-t border-border/70 space-y-1.5">
          <Label htmlFor="systemPrompt" className="text-xs font-semibold text-foreground flex items-center gap-1">
            System Prompt / Persona Instructions
          </Label>
          <textarea
            id="systemPrompt"
            rows={5}
            placeholder="Define the voice persona, clinical guidelines, conversational guardrails, and handling instructions..."
            value={formData.systemPrompt}
            onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
      </div>

      {/* Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-between border-t border-border bg-background/95 px-6 py-3.5 backdrop-blur shadow-lg">
        <div className="text-xs text-muted-foreground hidden sm:block">
          {isEditMode ? (
            <span>Updating agent configuration. Real-time voice inference models will update on next call session.</span>
          ) : (
            <span>Please verify all required agent parameters marked with an asterisk (<span className="text-teal-700 dark:text-teal-400 font-bold">*</span>).</span>
          )}
        </div>
        <div className="flex items-center gap-3 ml-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => router.push("/agents")}
            disabled={isSubmitting}
            className="text-xs px-4"
          >
            Cancel
          </Button>

          <Button
            type="submit"
            size="sm"
            disabled={isSubmitting}
            className="text-xs px-5 bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white font-medium shadow-sm"
          >
            {isSubmitting 
              ? (isEditMode ? "Saving Changes..." : "Provisioning...") 
              : (isEditMode ? "Save Changes" : "Create Agent")}
          </Button>
        </div>
      </div>
    </form>
  );
}
