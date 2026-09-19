"use client";

import React, { useState } from "react";
import { X, CheckCircle2, AlertCircle } from "lucide-react";
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
import { IntegrationCategory } from "../../types/integration";
import { useAuth } from "../../context/auth-context";
import { createIntegrationAgent } from "../../lib/api-integrations";

interface AgentCreateModalProps {
  category: IntegrationCategory; // "STT Agent" | "TTS Agent" | "LLM Provider"
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const STT_VENDOR_OPTIONS = [
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

const TTS_VENDOR_OPTIONS = [
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

const LLM_VENDOR_OPTIONS = [
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

const TELEPHONY_VENDOR_OPTIONS = [
  "Plivo",
  "Twilio",
  "Custom / Other",
];

export function AgentCreateModal({
  category,
  isOpen,
  onClose,
  onSuccess,
}: AgentCreateModalProps) {
  const { token } = useAuth();

  const vendorOptions =
    category === "STT Agent"
      ? STT_VENDOR_OPTIONS
      : category === "TTS Agent"
      ? TTS_VENDOR_OPTIONS
      : category === "LLM Provider"
      ? LLM_VENDOR_OPTIONS
      : TELEPHONY_VENDOR_OPTIONS;

  // Shared fields
  const [name, setName] = useState("");
  const [providerVendor, setProviderVendor] = useState(
    category === "STT Agent"
      ? "Deepgram"
      : category === "TTS Agent"
      ? "ElevenLabs"
      : category === "LLM Provider"
      ? "OpenAI (GPT-4o / o1 / o3)"
      : "Plivo"
  );
  const [customVendor, setCustomVendor] = useState("");
  const [status, setStatus] = useState("active");

  // STT / Models specific fields
  const [availableModels, setAvailableModels] = useState(
    category === "STT Agent"
      ? "nova-2-general, nova-2-medical"
      : category === "TTS Agent"
      ? "eleven_turbo_v2_5"
      : category === "LLM Provider"
      ? "gpt-4o, gpt-4o-mini"
      : "+1 800 555 0199, +91 80 3115 1150"
  );
  const [authId, setAuthId] = useState("MAZJE4OTDLZDATNWRMNI");
  const [authToken, setAuthToken] = useState("MDJlNjlmNGMtYmRlNy00ZWY3LTU1YWQtMzhhZmQ1");
  const [fromNumber, setFromNumber] = useState("+91 80 3115 1150");
  const [avgLatencyMs, setAvgLatencyMs] = useState("110");
  const [supportedLanguages, setSupportedLanguages] = useState("en-US, es-ES");

  // TTS specific fields
  const [availableVoices, setAvailableVoices] = useState("Adam, Rachel, Domi");
  const [sampleRate, setSampleRate] = useState("24000");

  // LLM specific fields
  const [supportsStreaming, setSupportsStreaming] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Agent name is required");
      return;
    }

    const finalVendor =
      providerVendor === "Custom / Other"
        ? customVendor.trim() || "Custom Provider"
        : providerVendor.trim();

    const modelsArr = availableModels
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean);

    if (modelsArr.length === 0) {
      setError("At least one available model must be specified");
      return;
    }

    setIsSubmitting(true);

    let configPayload: any = {};

    if (category === "STT Agent") {
      const langsArr = supportedLanguages
        .split(",")
        .map((l) => l.trim())
        .filter(Boolean);

      configPayload = {
        available_models: modelsArr,
        avg_latency_ms: parseInt(avgLatencyMs) || 110,
        supported_languages: langsArr.length > 0 ? langsArr : ["en-US"],
      };
    } else if (category === "TTS Agent") {
      const voicesArr = availableVoices
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);

      configPayload = {
        available_models: modelsArr,
        avg_latency_ms: parseInt(avgLatencyMs) || 120,
        available_voices: voicesArr.length > 0 ? voicesArr : ["Default"],
        sample_rate: parseInt(sampleRate) || 24000,
      };
    } else if (category === "Mobile Telephony") {
      configPayload = {
        available_models: modelsArr,
        auth_id: authId,
        auth_token: authToken,
        from_number: fromNumber,
      };
    } else {
      // LLM Provider
      configPayload = {
        available_models: modelsArr,
        supports_streaming: Boolean(supportsStreaming),
      };
    }

    const payload = {
      name: name.trim(),
      provider_vendor: finalVendor,
      status: status,
      config: configPayload,
    };

    try {
      await createIntegrationAgent(category, payload, token);
      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error("Failed creating agent:", err);
      setError(err.message || "Failed to create agent");
    } finally {
      setIsSubmitting(false);
    }
  };

  const title =
    category === "STT Agent"
      ? "Create STT Agent"
      : category === "TTS Agent"
      ? "Create TTS Agent"
      : category === "LLM Provider"
      ? "Create LLM Provider"
      : "Create Telephony Agent";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg p-6 space-y-4 animate-in fade-in zoom-in-95 my-8">
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <h3 className="text-base font-bold text-foreground">{title}</h3>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* 1. Name */}
          <div className="space-y-1">
            <Label htmlFor="agentName" className="font-semibold text-foreground">
              Agent Name *
            </Label>
            <Input
              id="agentName"
              placeholder={
                category === "STT Agent"
                  ? "e.g. Deepgram Nova-2 Production Agent"
                  : category === "TTS Agent"
                  ? "e.g. ElevenLabs Turbo Voice Engine"
                  : "e.g. OpenAI GPT-4o Agent"
              }
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9 text-xs"
              required
            />
          </div>

          {/* 2. Provider Vendor Dropdown */}
          <div className="space-y-1">
            <Label htmlFor="vendor" className="font-semibold text-foreground">
              Provider Vendor *
            </Label>
            <Select value={providerVendor} onValueChange={(val) => setProviderVendor(val)}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Select Provider Vendor" />
              </SelectTrigger>
              <SelectContent>
                {vendorOptions.map((v) => (
                  <SelectItem key={v} value={v}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {providerVendor === "Custom / Other" && (
              <Input
                placeholder="Enter custom provider vendor name..."
                value={customVendor}
                onChange={(e) => setCustomVendor(e.target.value)}
                className="h-9 text-xs mt-1.5"
                required
              />
            )}
          </div>

          {/* 3. Status */}
          <div className="space-y-1">
            <Label className="font-semibold text-foreground">Status *</Label>
            <Select value={status} onValueChange={(val) => setStatus(val)}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">🟢 Active</SelectItem>
                <SelectItem value="review">🟡 Ready / Review</SelectItem>
                <SelectItem value="inactive">⚪ Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 4. Available Models */}
          <div className="space-y-1">
            <Label htmlFor="models" className="font-semibold text-foreground">
              Available Models (Comma Separated) *
            </Label>
            <Input
              id="models"
              placeholder="e.g. nova-2-general, nova-2-medical"
              value={availableModels}
              onChange={(e) => setAvailableModels(e.target.value)}
              className="h-9 text-xs font-mono"
              required
            />
          </div>

          {/* TYPE-SPECIFIC FIELDS */}
          {category === "STT Agent" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="sttLatency" className="font-semibold text-foreground">
                    Avg Latency (ms) *
                  </Label>
                  <Input
                    id="sttLatency"
                    type="number"
                    value={avgLatencyMs}
                    onChange={(e) => setAvgLatencyMs(e.target.value)}
                    className="h-9 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="sttLangs" className="font-semibold text-foreground">
                    Supported Languages *
                  </Label>
                  <Input
                    id="sttLangs"
                    placeholder="en-US, es-ES, fr-FR"
                    value={supportedLanguages}
                    onChange={(e) => setSupportedLanguages(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>
            </>
          )}

          {category === "TTS Agent" && (
            <>
              <div className="space-y-1">
                <Label htmlFor="voices" className="font-semibold text-foreground">
                  Available Voices (Comma Separated) *
                </Label>
                <Input
                  id="voices"
                  placeholder="Adam, Rachel, Domi, Bella"
                  value={availableVoices}
                  onChange={(e) => setAvailableVoices(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="ttsLatency" className="font-semibold text-foreground">
                    Avg Latency (ms) *
                  </Label>
                  <Input
                    id="ttsLatency"
                    type="number"
                    value={avgLatencyMs}
                    onChange={(e) => setAvgLatencyMs(e.target.value)}
                    className="h-9 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="sampleRate" className="font-semibold text-foreground">
                    Sample Rate (Hz) *
                  </Label>
                  <Input
                    id="sampleRate"
                    type="number"
                    placeholder="24000"
                    value={sampleRate}
                    onChange={(e) => setSampleRate(e.target.value)}
                    className="h-9 text-xs font-mono"
                  />
                </div>
              </div>
            </>
          )}

          {category === "LLM Provider" && (
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="streaming"
                checked={supportsStreaming}
                onChange={(e) => setSupportsStreaming(e.target.checked)}
                className="rounded border-border"
              />
              <Label htmlFor="streaming" className="font-semibold text-foreground cursor-pointer">
                Supports Response Streaming
              </Label>
            </div>
          )}

          {category === "Mobile Telephony" && (
            <div className="space-y-3 border-t border-border/60 pt-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="authId" className="font-semibold text-foreground">
                    Plivo Auth ID *
                  </Label>
                  <Input
                    id="authId"
                    placeholder="MAZJE4OTDLZDATNWRMNI"
                    value={authId}
                    onChange={(e) => setAuthId(e.target.value)}
                    className="h-9 text-xs font-mono"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="authToken" className="font-semibold text-foreground">
                    Plivo Auth Token (Secret) *
                  </Label>
                  <Input
                    id="authToken"
                    type="password"
                    placeholder="••••••••••••••••"
                    value={authToken}
                    onChange={(e) => setAuthToken(e.target.value)}
                    className="h-9 text-xs font-mono"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="fromNumber" className="font-semibold text-foreground">
                  Default Outbound Caller ID (From Number) *
                </Label>
                <Input
                  id="fromNumber"
                  placeholder="e.g. +91 80 3115 1150"
                  value={fromNumber}
                  onChange={(e) => setFromNumber(e.target.value)}
                  className="h-9 text-xs font-mono"
                  required
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="text-xs bg-teal-700 hover:bg-teal-800 text-white font-medium px-5"
            >
              {isSubmitting ? "Creating..." : title}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
