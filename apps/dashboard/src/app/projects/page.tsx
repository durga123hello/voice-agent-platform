"use client";

import React, { useState, useMemo, useEffect } from "react";
import { FolderKanban } from "lucide-react";
import { ProjectToolbar } from "../../components/projects/ProjectToolbar";
import { ProjectsTable } from "../../components/projects/ProjectsTable";
import { ProjectDetailsModal } from "../../components/projects/ProjectDetailsModal";
import { INITIAL_MOCK_PROJECTS } from "../../lib/mock-projects";
import { Project, ProjectFilters, resolveLlmModel } from "../../types/project";

const STORAGE_KEY = "vopx_projects_data_v1";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>(INITIAL_MOCK_PROJECTS);
  const [filters, setFilters] = useState<ProjectFilters>({
    search: "",
    status: "ALL",
    stt: "ALL",
  });
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Load and merge local storage with initial mock data
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      let list: Project[] = [];
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            list = parsed;
          }
        } catch (e) {}
      }

      // Upgrade existing stored records to popular LLM models
      const sanitizedList: Project[] = list.map((p) => ({
        ...p,
        llmModel: resolveLlmModel(p),
      }));

      // Ensure initial demo projects exist
      const existingIds = new Set(sanitizedList.map((p) => p.id));
      const existingProjectIds = new Set(sanitizedList.map((p) => p.projectId.toUpperCase()));
      const toAdd = INITIAL_MOCK_PROJECTS.filter(
        (m) => !existingIds.has(m.id) && !existingProjectIds.has(m.projectId.toUpperCase())
      );

      const combined = [...sanitizedList, ...toAdd];
      setProjects(combined);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(combined));
    } catch (e) {
      console.error("Failed to load projects", e);
    }
  }, []);

  // Filter projects based on multi-field search and filters
  const filteredProjects = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    const tokens = q ? q.split(/\s+/).filter(Boolean) : [];

    return projects.filter((project) => {
      // 1. Search filter
      let matchesSearch = true;
      if (tokens.length > 0) {
        const searchableText = [
          project.name,
          project.projectId,
          project.description,
          project.stt,
          project.tts,
          resolveLlmModel(project),
          project.status,
          project.environment
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        matchesSearch = tokens.every((token) => searchableText.includes(token));
      }

      // 2. Status filter
      const matchesStatus =
        filters.status === "ALL" || project.status === filters.status;

      return matchesSearch && matchesStatus;
    });
  }, [projects, filters]);

  // Handle Delete
  const handleDeleteProject = (id: string) => {
    const updated = projects.filter((p) => p.id !== id);
    setProjects(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {}
  };

  // Handle View Details
  const handleViewProject = (project: Project) => {
    setSelectedProject(project);
    setIsDetailsOpen(true);
  };

  const handleFilterChange = (newFilters: Partial<ProjectFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  return (
    <div className="space-y-5">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-border/60">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700/10 text-teal-800 dark:bg-teal-500/15 dark:text-teal-300 border border-teal-500/20 shadow-2xs">
            <FolderKanban className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Projects & Workspaces
            </h1>
            <p className="text-xs text-muted-foreground">
              Configure speech-to-text, text-to-speech, and AI voice agents for each isolated workspace environment.
            </p>
          </div>
        </div>
      </div>

      {/* 2. Toolbar */}
      <ProjectToolbar
        filters={filters}
        onFilterChange={handleFilterChange}
        filteredProjects={filteredProjects}
      />

      {/* 3. Table */}
      <ProjectsTable
        projects={filteredProjects}
        onDeleteProject={handleDeleteProject}
        onViewProject={handleViewProject}
      />


      {/* 4. Details Modal */}
      <ProjectDetailsModal
        project={selectedProject}
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
      />
    </div>
  );
}
