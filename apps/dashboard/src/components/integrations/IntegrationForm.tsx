"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Layers,
  CheckCircle2,
  ArrowLeft,
  AlertCircle,
} from "lucide-react";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Button } from "../ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { IntegrationCategory, IntegrationStatus } from "../../types/integration";
import { useAuth } from "../../context/auth-context";
import { createIntegrationAgent, updateIntegrationAgent } from "../../lib/api-integrations";

const STT_VENDORS = [
  "Deepgram",
  "OpenAI (Whisper)",
  "AssemblyAI",
  "Gladia",
  "Google Cloud Speech-to-Text",
  "Microsoft Azure Speech",
  "AWS Transcribe",
  "Speechmatics",
  "ElevenLabs (Scribe)",
  "Rev AI",
  "Picovoice",
  "IBM Watson Speech",
  "Soniox",
  "Groq STT (Whisper LPU)",
  "Fireworks AI STT",
  "Sarvam AI (Indic STT)",
  "Cobalt Speech",
  "WhisperX / Faster-Whisper",
  "Custom / OpenAI Compatible Endpoint",
];

const TTS_VENDORS = [
  "ElevenLabs",
  "Cartesia",
  "Play.ht",
  "OpenAI Audio TTS",
  "Deepgram Aura",
  "Google Cloud Text-to-Speech",
  "Microsoft Azure Neural Voice",
  "AWS Polly",
  "Resemble AI",
  "LMNT",
  "Fish Speech",
  "Rime AI",
  "Murf AI",
  "WellSaid Labs",
  "Lovo AI",
  "Neets AI",
  "Inworld AI",
  "Sarvam AI (Indic TTS)",
  "Kokoro TTS (Self-Hosted)",
  "Custom / OpenAI Compatible Audio Endpoint",
];

const LLM_VENDORS = [
  "OpenAI (GPT-4o / o1 / o3)",
  "Anthropic (Claude 3.5)",
  "Google Gemini",
  "Groq (LPU Engine)",
  "DeepSeek",
  "Mistral AI",
  "Together AI",
  "Fireworks AI",
  "Cohere (Command R+)",
  "AWS Bedrock",
  "Microsoft Azure OpenAI",
  "Perplexity AI",
  "xAI (Grok)",
  "Anyscale / Ray",
  "Replicate",
  "SambaNova Systems",
  "Cerebras Systems",
  "OpenRouter",
  "Sarvam AI (Indic LLM)",
  "Alibaba Cloud DashScope (Qwen)",
  "Ollama / vLLM (Self-Hosted)",
  "Custom / OpenAI Compatible API",
];

const TELEPHONY_VENDORS = [
  "Plivo",
  "Twilio",
  "Custom / Other",
];

export function IntegrationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams ? searchParams.get("edit") : null;
  const isEditMode = Boolean(editId);
  const { token } = useAuth();

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    category: "STT Agent" as IntegrationCategory,
    provider: "Deepgram",
    availableModels: "",
    status: "Active" as IntegrationStatus,
    apiKey: "",
    latency: "120ms",
  });

  const [customProvider, setCustomProvider] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const providerOptions =
    formData.category === "STT Agent"
      ? STT_VENDORS
      : formData.category === "TTS Agent"
      ? TTS_VENDORS
      : formData.category === "LLM Provider"
      ? LLM_VENDORS
      : TELEPHONY_VENDORS;

  // Sync default provider when category changes if current provider not in category options
  useEffect(() => {
    if (!isEditMode) {
      if (!providerOptions.includes(formData.provider)) {
        setFormData((prev) => ({ ...prev, provider: providerOptions[0] }));
      }
    }
  }, [formData.category, isEditMode, providerOptions]);

  // Validation
  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = "Integration name is required";
    if (!formData.availableModels.trim()) newErrors.availableModels = "Available models are required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);
    if (!validate()) return;

    setIsSubmitting(true);

    const modelsList = formData.availableModels
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean);

    const latencyNum = parseInt(formData.latency.replace(/\D/g, "")) || 120;

    // Convert UI status to backend status enum
    let statusEnum = "active";
    if (formData.status === "Inactive") statusEnum = "inactive";
    else if (formData.status === "Ready" || formData.status === "Connected") statusEnum = "review";

    // Build payload according to Zod validator specs
    let configPayload: any = {};
    if (formData.category === "STT Agent") {
      configPayload = {
        available_models: modelsList.length > 0 ? modelsList : ["default-model"],
        avg_latency_ms: latencyNum,
        supported_languages: ["en-US", "es-ES"],
      };
    } else if (formData.category === "TTS Agent") {
      configPayload = {
        available_models: modelsList.length > 0 ? modelsList : ["default-model"],
        avg_latency_ms: latencyNum,
        available_voices: ["Adam", "Rachel"],
        sample_rate: 24000,
      };
    } else if (formData.category === "Mobile Telephony") {
      configPayload = {
        available_models: modelsList.length > 0 ? modelsList : ["+1 800 555 0199"],
        auth_id: "MAZJE4OTDLZDATNWRMNI",
      };
    } else {
      configPayload = {
        available_models: modelsList.length > 0 ? modelsList : ["gpt-4o"],
        supports_streaming: true,
      };
    }

    const finalProvider =
      formData.provider === "Custom / Other"
        ? customProvider.trim() || "Custom Vendor"
        : formData.provider.trim();

    const payload = {
      name: formData.name.trim(),
      provider_vendor: finalProvider,
      status: statusEnum,
      config: configPayload,
    };

    try {
      if (isEditMode && editId) {
        await updateIntegrationAgent(formData.category, editId, payload, token);
        setToastMessage(`Integration ${formData.name} updated successfully! Redirecting...`);
      } else {
        await createIntegrationAgent(formData.category, payload, token);
        setToastMessage(`Integration ${formData.name} created successfully! Redirecting...`);
      }

      setTimeout(() => {
        router.push("/integrations");
      }, 900);
    } catch (err: any) {
      console.error("API error during submit:", err);
      setApiError(err.message || "Failed to save integration agent");
      setIsSubmitting(false);
    }
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
          <Link href="/integrations">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700/10 text-teal-800 dark:bg-teal-500/15 dark:text-teal-300 border border-teal-500/20 shadow-2xs">
          <Layers className="h-5 w-5" />
        </div>

        <div>
          <h1 className="text-lg font-bold tracking-tight text-foreground">
            {isEditMode ? "Edit Provider Integration" : "Add Provider Integration"}
          </h1>
          <p className="text-xs text-muted-foreground">
            Configure STT agent, TTS agent, LLM provider, or Mobile Telephony credentials.
          </p>
        </div>
      </div>

      {apiError && (
        <div className="flex items-center gap-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-semibold text-rose-600 dark:text-rose-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{apiError}</span>
        </div>
      )}

      {/* Main Form Fields */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-2xs space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* 1. Integration Name */}
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="name" className="text-xs font-semibold text-foreground flex items-center gap-1">
              Integration Name <span className="text-teal-700 dark:text-teal-400 font-bold">*</span>
            </Label>
            <Input
              id="name"
              placeholder="e.g. Deepgram Nova-2 STT Agent, ElevenLabs Turbo v2.5, OpenAI GPT-4o, Plivo Primary Gateway"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={`h-9 text-xs ${errors.name ? "border-rose-500" : ""}`}
            />
            {errors.name && <p className="text-[11px] font-medium text-rose-500">{errors.name}</p>}
          </div>

          {/* 2. Category */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground flex items-center gap-1">
              Category <span className="text-teal-700 dark:text-teal-400 font-bold">*</span>
            </Label>
            <Select
              value={formData.category}
              onValueChange={(val) => setFormData({ ...formData, category: val as IntegrationCategory })}
              disabled={isEditMode}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="STT Agent">🎙️ STT Agent (Speech-to-Text)</SelectItem>
                <SelectItem value="TTS Agent">🔊 TTS Agent (Text-to-Speech)</SelectItem>
                <SelectItem value="LLM Provider">🤖 LLM Provider (Language Model)</SelectItem>
                <SelectItem value="Mobile Telephony">📞 Mobile Telephony (Plivo & Voice Trunks)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 3. Provider Vendor Dropdown */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground flex items-center gap-1">
              Provider Vendor <span className="text-teal-700 dark:text-teal-400 font-bold">*</span>
            </Label>
            <Select
              value={formData.provider}
              onValueChange={(val) => setFormData({ ...formData, provider: val })}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Select Provider Vendor" />
              </SelectTrigger>
              <SelectContent>
                {providerOptions.map((v) => (
                  <SelectItem key={v} value={v}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {formData.provider === "Custom / Other" && (
              <Input
                placeholder="Enter custom provider vendor name..."
                value={customProvider}
                onChange={(e) => setCustomProvider(e.target.value)}
                className="h-9 text-xs mt-1.5"
              />
            )}
          </div>

          {/* 4. Status */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground flex items-center gap-1">
              Status <span className="text-teal-700 dark:text-teal-400 font-bold">*</span>
            </Label>
            <Select
              value={formData.status}
              onValueChange={(val) => setFormData({ ...formData, status: val as IntegrationStatus })}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Active">🟢 Active</SelectItem>
                <SelectItem value="Connected">🔵 Connected</SelectItem>
                <SelectItem value="Ready">🟡 Ready</SelectItem>
                <SelectItem value="Inactive">⚪ Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 5. Target Average Latency */}
          <div className="space-y-1.5">
            <Label htmlFor="latency" className="text-xs font-semibold text-foreground flex items-center gap-1">
              Target Average Latency
            </Label>
            <Input
              id="latency"
              placeholder="e.g. 120ms"
              value={formData.latency}
              onChange={(e) => setFormData({ ...formData, latency: e.target.value })}
              className="h-9 text-xs font-mono"
            />
          </div>

          {/* 6. Available Models */}
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="availableModels" className="text-xs font-semibold text-foreground flex items-center gap-1">
              Available Models & Engine Catalogs (Comma Separated) <span className="text-teal-700 dark:text-teal-400 font-bold">*</span>
            </Label>
            <Input
              id="availableModels"
              placeholder="e.g. nova-2-general, nova-2-medical OR gpt-4o, gpt-4o-mini OR eleven_turbo_v2_5"
              value={formData.availableModels}
              onChange={(e) => setFormData({ ...formData, availableModels: e.target.value })}
              className={`h-9 text-xs font-mono ${errors.availableModels ? "border-rose-500" : ""}`}
            />
            {errors.availableModels && <p className="text-[11px] font-medium text-rose-500">{errors.availableModels}</p>}
          </div>

        </div>
      </div>
    </form>
  );
}
