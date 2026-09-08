"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { 
  Layers, 
  CheckCircle2, 
  ArrowLeft,
  Mic,
  Volume2,
  Cpu,
  Key,
  Activity
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
import { Integration, IntegrationCategory, IntegrationStatus } from "../../types/integration";

const STORAGE_KEY = "vopx_integrations_data_v1";

export function IntegrationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams ? searchParams.get("edit") : null;
  const isEditMode = Boolean(editId);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    integrationId: "",
    category: "STT Agent" as IntegrationCategory,
    provider: "Deepgram",
    availableModels: "",
    status: "Active" as IntegrationStatus,
    apiKey: "",
    latency: "120ms",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Pre-fill on Edit
  useEffect(() => {
    if (!editId) return;
    try {
      const existing = localStorage.getItem(STORAGE_KEY);
      if (existing) {
        const list: Integration[] = JSON.parse(existing);
        const target = list.find((item) => item.id === editId);
        if (target) {
          setFormData({
            name: target.name,
            integrationId: target.integrationId,
            category: target.category,
            provider: target.provider,
            availableModels: target.availableModels,
            status: target.status,
            apiKey: target.apiKey,
            latency: target.latency || "120ms",
          });
        }
      }
    } catch (e) {
      console.error("Failed loading integration for edit", e);
    }
  }, [editId]);

  // Validation
  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = "Integration name is required";
    if (!formData.integrationId.trim()) newErrors.integrationId = "Integration ID is required";
    if (!formData.availableModels.trim()) newErrors.availableModels = "Available models are required";
    if (!formData.apiKey.trim()) newErrors.apiKey = "API Key is required";

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
        const list: Integration[] = existing ? JSON.parse(existing) : [];
        const updatedList = list.map((item) => {
          if (item.id === editId) {
            return {
              ...item,
              name: formData.name.trim(),
              integrationId: formData.integrationId.trim().toUpperCase(),
              category: formData.category,
              provider: formData.provider.trim(),
              availableModels: formData.availableModels.trim(),
              status: formData.status,
              apiKey: formData.apiKey.trim(),
              latency: formData.latency.trim(),
            };
          }
          return item;
        });

        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
      } catch (err) {
        console.error("Failed updating integration", err);
      }

      setToastMessage(`Integration ${formData.name} updated successfully! Redirecting...`);
      setTimeout(() => {
        router.push("/integrations");
      }, 900);
      return;
    }

    // CREATE MODE
    const newIntegration: Integration = {
      id: `int-${Date.now()}`,
      integrationId: formData.integrationId.trim().toUpperCase(),
      name: formData.name.trim(),
      category: formData.category,
      provider: formData.provider.trim(),
      availableModels: formData.availableModels.trim(),
      status: formData.status,
      apiKey: formData.apiKey.trim(),
      latency: formData.latency.trim(),
      createdAt: formattedDate,
    };

    try {
      const existing = localStorage.getItem(STORAGE_KEY);
      const list: Integration[] = existing ? JSON.parse(existing) : [];
      list.unshift(newIntegration);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (err) {
      console.error("Failed saving integration", err);
    }

    setToastMessage(`Integration ${newIntegration.name} added successfully! Redirecting...`);
    setTimeout(() => {
      router.push("/integrations");
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
            Configure STT agent, TTS agent, or LLM provider credentials and model catalogs.
          </p>
        </div>
      </div>

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
              placeholder="e.g. Deepgram Nova-2 STT Agent, ElevenLabs Turbo v2.5, OpenAI GPT-4o"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={`h-9 text-xs ${errors.name ? "border-rose-500" : ""}`}
            />
            {errors.name && <p className="text-[11px] font-medium text-rose-500">{errors.name}</p>}
          </div>

          {/* 2. Integration ID */}
          <div className="space-y-1.5">
            <Label htmlFor="integrationId" className="text-xs font-semibold text-foreground flex items-center gap-1">
              Integration ID <span className="text-teal-700 dark:text-teal-400 font-bold">*</span>
            </Label>
            <Input
              id="integrationId"
              placeholder="e.g. INT-820"
              value={formData.integrationId}
              onChange={(e) => setFormData({ ...formData, integrationId: e.target.value })}
              className={`h-9 text-xs font-mono uppercase ${errors.integrationId ? "border-rose-500" : ""}`}
            />
            {errors.integrationId && <p className="text-[11px] font-medium text-rose-500">{errors.integrationId}</p>}
          </div>

          {/* 3. Category */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground flex items-center gap-1">
              Category <span className="text-teal-700 dark:text-teal-400 font-bold">*</span>
            </Label>
            <Select
              value={formData.category}
              onValueChange={(val) => setFormData({ ...formData, category: val as IntegrationCategory })}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="STT Agent">🎙️ STT Agent (Speech-to-Text)</SelectItem>
                <SelectItem value="TTS Agent">🔊 TTS Agent (Text-to-Speech)</SelectItem>
                <SelectItem value="LLM Provider">🤖 LLM Provider (Language Model)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 4. Provider Vendor */}
          <div className="space-y-1.5">
            <Label htmlFor="provider" className="text-xs font-semibold text-foreground flex items-center gap-1">
              Provider Vendor <span className="text-teal-700 dark:text-teal-400 font-bold">*</span>
            </Label>
            <Input
              id="provider"
              placeholder="e.g. Deepgram, ElevenLabs, OpenAI, Anthropic, Cartesia, Google Cloud"
              value={formData.provider}
              onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
              className="h-9 text-xs"
            />
          </div>

          {/* 5. Status */}
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

          {/* 6. Available Models */}
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="availableModels" className="text-xs font-semibold text-foreground flex items-center gap-1">
              Available Models & Engine Catalogs <span className="text-teal-700 dark:text-teal-400 font-bold">*</span>
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

          {/* 7. API Key */}
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="apiKey" className="text-xs font-semibold text-foreground flex items-center gap-1">
              API Key Credentials <span className="text-teal-700 dark:text-teal-400 font-bold">*</span>
            </Label>
            <Input
              id="apiKey"
              type="password"
              placeholder="sk-live-••••••••••••••••"
              value={formData.apiKey}
              onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
              className={`h-9 text-xs font-mono ${errors.apiKey ? "border-rose-500" : ""}`}
            />
            {errors.apiKey && <p className="text-[11px] font-medium text-rose-500">{errors.apiKey}</p>}
          </div>

          {/* 8. Latency */}
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
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/70">
          <Button variant="outline" size="sm" asChild className="text-xs">
            <Link href="/integrations">Cancel</Link>
          </Button>

          <Button
            type="submit"
            size="sm"
            disabled={isSubmitting}
            className="gap-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs px-5 shadow-xs"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>{isEditMode ? "Update Integration" : "Save Integration"}</span>
          </Button>
        </div>
      </div>
    </form>
  );
}
