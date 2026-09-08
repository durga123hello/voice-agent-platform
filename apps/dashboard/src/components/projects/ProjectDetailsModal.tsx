"use client";

import React from "react";
import Link from "next/link";
import { Project, ProjectStatus, resolveLlmModel } from "../../types/project";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "../ui/dialog";
import { Button } from "../ui/button";
import { 
  FolderKanban,
  Mic, 
  Volume2, 
  Bot,
  Cpu, 
  Calendar, 
  Pencil, 
  Hash,
  Server
} from "lucide-react";

interface ProjectDetailsModalProps {
  project: Project | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ProjectDetailsModal({
  project,
  isOpen,
  onClose,
}: ProjectDetailsModalProps) {
  if (!project) return null;

  const renderStatusBadge = (status: ProjectStatus) => {
    switch (status) {
      case "Active":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60">
            <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
            Active
          </span>
        );
      case "In Development":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/60">
            <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
            In Development
          </span>
        );
      case "Paused":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/60">
            <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
            Paused
          </span>
        );
      case "Archived":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700">
            <span className="h-2 w-2 rounded-full bg-slate-400 shrink-0" />
            Archived
          </span>
        );
      default:
        return <span>{status}</span>;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg p-6">
        {/* Header */}
        <DialogHeader className="pb-3 border-b border-border/70">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-700/10 text-teal-800 dark:bg-teal-500/15 dark:text-teal-300 border border-teal-500/20 shrink-0 shadow-sm">
              <FolderKanban className="h-6 w-6" />
            </div>

            <div>
              <DialogTitle className="text-lg font-bold text-foreground">
                {project.name}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded border border-border">
                  <Hash className="h-3 w-3 text-muted-foreground" />
                  {project.projectId}
                </span>
                {renderStatusBadge(project.status)}
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Content sections */}
        <div className="space-y-4 py-2 text-xs">
          {/* Description */}
          <div className="bg-muted/30 p-3 rounded-lg border border-border/60">
            <span className="text-[10px] text-muted-foreground block mb-1">Project Description & Scope</span>
            <p className="text-foreground leading-relaxed">
              {project.description}
            </p>
          </div>

          {/* Voice & AI Pipeline */}
          <div className="space-y-2">
            <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Bot className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400" />
              Voice Pipeline Configuration
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-muted/30 p-3 rounded-lg border border-border/60">
              <div>
                <span className="text-[10px] text-muted-foreground block">Speech-to-Text (STT)</span>
                <span className="font-semibold text-foreground flex items-center gap-1.5 mt-1">
                  <Mic className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                  {project.stt}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-muted-foreground block">Text-to-Speech (TTS)</span>
                <span className="font-semibold text-foreground flex items-center gap-1.5 mt-1">
                  <Volume2 className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                  {project.tts}
                </span>
              </div>

              <div className="sm:col-span-2 pt-1 border-t border-border/40">
                <span className="text-[10px] text-muted-foreground block">LLM Generation Model</span>
                <span className="font-mono text-xs font-semibold text-teal-800 dark:text-teal-300 flex items-center gap-1.5 mt-1">
                  <Cpu className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                  {resolveLlmModel(project)}
                </span>
              </div>
            </div>
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-2.5 bg-muted/30 p-3 rounded-lg border border-border/60">
            <div>
              <span className="text-[10px] text-muted-foreground block">Target Environment</span>
              <span className="font-medium text-foreground flex items-center gap-1.5 mt-0.5">
                <Server className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                {project.environment || "Production"}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-muted-foreground block">Creation Date</span>
              <span className="font-medium text-foreground flex items-center gap-1.5 mt-0.5">
                <Calendar className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                {project.createdAt}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="pt-3 border-t border-border flex items-center justify-between sm:justify-between">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            Close
          </Button>

          <Button
            asChild
            size="sm"
            className="text-xs gap-1.5 bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white font-medium"
          >
            <Link href={`/projects/create?edit=${project.id}`}>
              <Pencil className="h-3.5 w-3.5" />
              <span>Edit Project</span>
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
