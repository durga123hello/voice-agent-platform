"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { 
  FolderKanban, 
  Pencil,
  CheckCircle2, 
  ArrowLeft,
  Bot,
  Mic,
  Volume2,
  Server
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
import { 
  Project, 
  ProjectStatus, 
  resolveLlmModel, 
  STT_PROVIDERS, 
  TTS_PROVIDERS, 
  LLM_PROVIDERS 
} from "../../types/project";

const STORAGE_KEY = "vopx_projects_data_v1";

export function ProjectForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams ? searchParams.get("edit") : null;
  const isEditMode = Boolean(editId);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    projectId: "",
    description: "",
    status: "Active" as ProjectStatus,
    stt: "Deepgram Nova-2",
    tts: "Cartesia Sonic (Fastest)",
    llmModel: "GPT-4o",
    environment: "Production",
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
        const projectList: Project[] = JSON.parse(existing);
        const target = projectList.find((p) => p.id === editId);
        if (target) {
          setFormData({
            name: target.name,
            projectId: target.projectId,
            description: target.description,
            status: target.status,
            stt: target.stt,
            tts: target.tts,
            llmModel: resolveLlmModel(target),
            environment: target.environment || "Production",
          });
        }
      }
    } catch (e) {
      console.error("Failed loading project for edit", e);
    }
  }, [editId]);

  // Validation
  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = "Project name is required";
    if (!formData.projectId.trim()) newErrors.projectId = "Project ID is required";
    if (!formData.description.trim()) newErrors.description = "Description is required";

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
        const projectList: Project[] = existing ? JSON.parse(existing) : [];
        const updatedList = projectList.map((p) => {
          if (p.id === editId) {
            return {
              ...p,
              name: formData.name.trim(),
              projectId: formData.projectId.trim().toUpperCase(),
              description: formData.description.trim(),
              status: formData.status,
              stt: formData.stt,
              tts: formData.tts,
              llmModel: formData.llmModel,
              environment: formData.environment,
            };
          }
          return p;
        });

        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
      } catch (err) {
        console.error("Failed updating project", err);
      }

      setToastMessage(`Project ${formData.name} updated successfully! Redirecting...`);
      setTimeout(() => {
        router.push("/projects");
      }, 900);
      return;
    }

    // CREATE MODE
    const newProject: Project = {
      id: `prj-${Date.now()}`,
      projectId: formData.projectId.trim().toUpperCase(),
      name: formData.name.trim(),
      description: formData.description.trim(),
      status: formData.status,
      stt: formData.stt,
      tts: formData.tts,
      llmModel: formData.llmModel,
      environment: formData.environment,
      createdAt: formattedDate,
    };

    try {
      const existing = localStorage.getItem(STORAGE_KEY);
      const projectList: Project[] = existing ? JSON.parse(existing) : [];
      projectList.unshift(newProject);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projectList));
    } catch (err) {
      console.error("Failed saving project", err);
    }

    setToastMessage(`Project ${newProject.name} created successfully! Redirecting...`);
    setTimeout(() => {
      router.push("/projects");
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
          <Link href="/projects">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            {isEditMode ? (
              <>
                <Pencil className="h-5 w-5 text-teal-700 dark:text-teal-400" />
                Edit Project
              </>
            ) : (
              <>
                <FolderKanban className="h-5 w-5 text-teal-700 dark:text-teal-400" />
                Create Project Workspace
              </>
            )}
          </h1>
          <p className="text-xs text-muted-foreground">
            {isEditMode 
              ? `Update voice pipeline configuration, assigned agent persona, and target environment.`
              : `Provision an isolated voice application workspace with assigned STT, TTS, and conversational agents.`}
          </p>
        </div>
      </div>

      {/* Form Content */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-xs space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* 1. Project Name */}
          <div className="space-y-1.5">
            <Label htmlFor="projectName" className="text-xs font-semibold text-foreground flex items-center gap-1">
              Project Name <span className="text-teal-700 dark:text-teal-400 font-bold">*</span>
            </Label>
            <Input
              id="projectName"
              placeholder="e.g. Clinical Inbound Triage"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={errors.name ? "border-rose-500" : ""}
            />
            {errors.name && <p className="text-[11px] text-rose-500">{errors.name}</p>}
          </div>

          {/* 2. Project ID */}
          <div className="space-y-1.5">
            <Label htmlFor="projectId" className="text-xs font-semibold text-foreground flex items-center gap-1">
              Project ID <span className="text-teal-700 dark:text-teal-400 font-bold">*</span>
            </Label>
            <Input
              id="projectId"
              placeholder="e.g. PRJ-401"
              value={formData.projectId}
              onChange={(e) => setFormData({ ...formData, projectId: e.target.value.toUpperCase() })}
              className={`font-mono text-xs ${errors.projectId ? "border-rose-500" : ""}`}
            />
            {errors.projectId && <p className="text-[11px] text-rose-500">{errors.projectId}</p>}
          </div>

          {/* 3. Status */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground flex items-center gap-1">
              Status <span className="text-teal-700 dark:text-teal-400 font-bold">*</span>
            </Label>
            <Select
              value={formData.status}
              onValueChange={(val) => setFormData({ ...formData, status: val as ProjectStatus })}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Active">🟢 Active</SelectItem>
                <SelectItem value="In Development">🔵 In Development</SelectItem>
                <SelectItem value="Paused">🟡 Paused</SelectItem>
                <SelectItem value="Archived">⚪ Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 4. STT Engine */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground flex items-center gap-1">
              Speech-to-Text (STT) <span className="text-teal-700 dark:text-teal-400 font-bold">*</span>
            </Label>
            <Select
              value={formData.stt}
              onValueChange={(val) => setFormData({ ...formData, stt: val })}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STT_PROVIDERS.map((stt) => (
                  <SelectItem key={stt} value={stt}>{stt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 5. TTS Engine */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground flex items-center gap-1">
              Text-to-Speech (TTS) <span className="text-teal-700 dark:text-teal-400 font-bold">*</span>
            </Label>
            <Select
              value={formData.tts}
              onValueChange={(val) => setFormData({ ...formData, tts: val })}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TTS_PROVIDERS.map((tts) => (
                  <SelectItem key={tts} value={tts}>{tts}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 6. LLM Model */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground flex items-center gap-1">
              LLM Generation Model <span className="text-teal-700 dark:text-teal-400 font-bold">*</span>
            </Label>
            <Select
              value={formData.llmModel}
              onValueChange={(val) => setFormData({ ...formData, llmModel: val })}
            >
              <SelectTrigger className="h-9 text-xs font-mono">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LLM_PROVIDERS.map((model) => (
                  <SelectItem key={model} value={model} className="font-mono text-xs">{model}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 7. Target Environment */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground flex items-center gap-1">
              Environment
            </Label>
            <Select
              value={formData.environment}
              onValueChange={(val) => setFormData({ ...formData, environment: val })}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Production">Production</SelectItem>
                <SelectItem value="Staging">Staging</SelectItem>
                <SelectItem value="Development">Development</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Description Textarea */}
        <div className="pt-2 border-t border-border/70 space-y-1.5">
          <Label htmlFor="description" className="text-xs font-semibold text-foreground flex items-center gap-1">
            Project Description & Use Case Scope <span className="text-teal-700 dark:text-teal-400 font-bold">*</span>
          </Label>
          <textarea
            id="description"
            rows={4}
            placeholder="Describe the clinical/business purpose, patient workflow, or call handling scope of this project..."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className={`w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${errors.description ? "border-rose-500" : ""}`}
          />
          {errors.description && <p className="text-[11px] text-rose-500">{errors.description}</p>}
        </div>
      </div>

      {/* Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-between border-t border-border bg-background/95 px-6 py-3.5 backdrop-blur shadow-lg">
        <div className="text-xs text-muted-foreground hidden sm:block">
          {isEditMode ? (
            <span>Updating project pipeline. Changes apply to all active audio stream workers immediately.</span>
          ) : (
            <span>Please verify all required voice pipeline fields marked with an asterisk (<span className="text-teal-700 dark:text-teal-400 font-bold">*</span>).</span>
          )}
        </div>
        <div className="flex items-center gap-3 ml-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => router.push("/projects")}
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
              ? (isEditMode ? "Saving Changes..." : "Creating...") 
              : (isEditMode ? "Save Changes" : "Create Project")}
          </Button>
        </div>
      </div>
    </form>
  );
}
