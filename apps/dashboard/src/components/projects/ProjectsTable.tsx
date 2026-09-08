"use client";

import React from "react";
import Link from "next/link";
import { 
  Eye, 
  Pencil, 
  Trash2, 
  FolderKanban,
  Cpu,
  Mic,
  Volume2,
  Calendar,
  Hash
} from "lucide-react";
import { Project, ProjectStatus, resolveLlmModel } from "../../types/project";
import { Button } from "../ui/button";

interface ProjectsTableProps {
  projects: Project[];
  onDeleteProject?: (id: string) => void;
  onViewProject?: (project: Project) => void;
}

export function ProjectsTable({
  projects,
  onDeleteProject,
  onViewProject,
}: ProjectsTableProps) {
  const renderStatus = (status: ProjectStatus) => {
    switch (status) {
      case "Active":
        return (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
            Active
          </div>
        );
      case "In Development":
        return (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/60">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
            In Dev
          </div>
        );
      case "Paused":
        return (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/60">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
            Paused
          </div>
        );
      case "Archived":
        return (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0" />
            Archived
          </div>
        );
      default:
        return <span>{status}</span>;
    }
  };

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-700/10 text-teal-800 dark:bg-teal-500/15 dark:text-teal-300 border border-teal-500/20 mb-3">
          <FolderKanban className="h-6 w-6" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">No projects found</h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">
          No project matches your filters. Create a new voice workspace project to get started.
        </p>
        <Button asChild size="sm" className="mt-4 gap-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs">
          <Link href="/projects/create">
            <FolderKanban className="h-3.5 w-3.5" />
            <span>Create Project</span>
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
      <div className="overflow-x-auto custom-scrollbar relative">
        <table className="w-full border-separate border-spacing-0 text-left text-xs min-w-[1200px]">
          {/* Table Header */}
          <thead>
            <tr className="bg-muted font-semibold text-muted-foreground">
              {/* 1. STICKY LEFT: Project Name */}
              <th 
                scope="col"
                className="sticky left-0 z-40 py-3.5 pl-4 pr-6 bg-slate-100 dark:bg-slate-900 border-b border-r border-border shadow-[6px_0_16px_-4px_rgba(0,0,0,0.15)] dark:shadow-[6px_0_20px_-4px_rgba(0,0,0,0.7)] w-[210px] min-w-[210px]"
              >
                Project Name
              </th>

              {/* 2. Project ID */}
              <th scope="col" className="py-3.5 px-4 min-w-[140px] border-b border-border bg-slate-50/80 dark:bg-slate-900/60">
                Project ID
              </th>

              {/* 3. Description */}
              <th scope="col" className="py-3.5 px-4 min-w-[260px] border-b border-border bg-slate-50/80 dark:bg-slate-900/60">
                Description
              </th>

              {/* 4. Status */}
              <th scope="col" className="py-3.5 px-4 min-w-[130px] border-b border-border bg-slate-50/80 dark:bg-slate-900/60">
                Status
              </th>

              {/* 5. STT */}
              <th scope="col" className="py-3.5 px-4 min-w-[180px] border-b border-border bg-slate-50/80 dark:bg-slate-900/60">
                STT Engine
              </th>

              {/* 6. TTS */}
              <th scope="col" className="py-3.5 px-4 min-w-[180px] border-b border-border bg-slate-50/80 dark:bg-slate-900/60">
                TTS Engine
              </th>

              {/* 7. LLM Model */}
              <th scope="col" className="py-3.5 px-4 min-w-[180px] border-b border-border bg-slate-50/80 dark:bg-slate-900/60">
                LLM Model
              </th>

              {/* 8. STICKY RIGHT: Actions */}
              <th 
                scope="col"
                className="sticky right-0 z-40 py-3.5 px-3 text-center bg-slate-100 dark:bg-slate-900 border-b border-l border-border shadow-[-6px_0_16px_-4px_rgba(0,0,0,0.15)] dark:shadow-[-6px_0_20px_-4px_rgba(0,0,0,0.7)] w-[130px] min-w-[130px]"
              >
                Actions
              </th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody>
            {projects.map((project) => (
              <tr 
                key={project.id}
                className="group transition-colors"
              >
                {/* 1. STICKY LEFT: Project Name */}
                <td className="sticky left-0 z-30 py-3 pl-4 pr-6 bg-white dark:bg-slate-950 group-hover:bg-slate-50 dark:group-hover:bg-slate-900 border-b border-r border-border shadow-[6px_0_16px_-4px_rgba(0,0,0,0.15)] dark:shadow-[6px_0_20px_-4px_rgba(0,0,0,0.7)] transition-colors w-[210px] min-w-[210px]">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-700/10 text-teal-800 dark:bg-teal-500/15 dark:text-teal-300 border border-teal-500/20 shrink-0">
                      <FolderKanban className="h-4 w-4" />
                    </div>

                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold text-foreground truncate text-xs sm:text-[13px] group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors">
                        {project.name}
                      </span>
                      <span className="text-[11px] text-muted-foreground truncate mt-0.5">
                        {project.environment || "Production"}
                      </span>
                    </div>
                  </div>
                </td>

                {/* 2. Project ID */}
                <td className="py-3 px-4 whitespace-nowrap min-w-[140px] border-b border-border bg-card group-hover:bg-muted/40 transition-colors">
                  <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold px-2 py-0.5 rounded bg-muted/60 text-foreground border border-border">
                    <Hash className="h-3 w-3 text-muted-foreground" />
                    {project.projectId}
                  </span>
                </td>

                {/* 3. Description */}
                <td className="py-3 px-4 max-w-[300px] border-b border-border bg-card group-hover:bg-muted/40 transition-colors">
                  <p className="text-muted-foreground text-xs line-clamp-2 leading-relaxed">
                    {project.description}
                  </p>
                </td>

                {/* 4. Status */}
                <td className="py-3 px-4 whitespace-nowrap min-w-[130px] border-b border-border bg-card group-hover:bg-muted/40 transition-colors">
                  {renderStatus(project.status)}
                </td>

                {/* 5. STT */}
                <td className="py-3 px-4 whitespace-nowrap min-w-[180px] border-b border-border bg-card group-hover:bg-muted/40 transition-colors">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground bg-muted/40 px-2.5 py-1 rounded-md border border-border/70">
                    <Mic className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                    <span className="truncate">{project.stt}</span>
                  </span>
                </td>

                {/* 6. TTS */}
                <td className="py-3 px-4 whitespace-nowrap min-w-[180px] border-b border-border bg-card group-hover:bg-muted/40 transition-colors">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground bg-muted/40 px-2.5 py-1 rounded-md border border-border/70">
                    <Volume2 className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                    <span className="truncate">{project.tts}</span>
                  </span>
                </td>

                {/* 7. LLM Model */}
                <td className="py-3 px-4 whitespace-nowrap min-w-[180px] border-b border-border bg-card group-hover:bg-muted/40 transition-colors">
                  <div className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 px-2.5 py-1 rounded-md border border-teal-200 dark:border-teal-800/60">
                    <Cpu className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                    <span className="truncate">{resolveLlmModel(project)}</span>
                  </div>
                </td>


                {/* 8. STICKY RIGHT: Actions */}
                <td className="sticky right-0 z-30 py-3 px-3 text-center bg-white dark:bg-slate-950 group-hover:bg-slate-50 dark:group-hover:bg-slate-900 border-b border-l border-border shadow-[-6px_0_16px_-4px_rgba(0,0,0,0.15)] dark:shadow-[-6px_0_20px_-4px_rgba(0,0,0,0.7)] transition-colors w-[130px] min-w-[130px]">
                  <div className="flex items-center justify-center gap-1">
                    {/* View Details */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-teal-700 dark:hover:text-teal-400 hover:bg-teal-500/10"
                      onClick={() => onViewProject && onViewProject(project)}
                      title="View project details"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span className="sr-only">View</span>
                    </Button>

                    {/* Edit Project */}
                    <Button
                      variant="ghost"
                      size="icon"
                      asChild
                      className="h-7 w-7 text-muted-foreground hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-500/10"
                      title="Edit project"
                    >
                      <Link href={`/projects/create?edit=${project.id}`}>
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="sr-only">Edit</span>
                      </Link>
                    </Button>

                    {/* Delete Project */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10"
                      onClick={() => onDeleteProject && onDeleteProject(project.id)}
                      title="Delete project"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="sr-only">Delete</span>
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
