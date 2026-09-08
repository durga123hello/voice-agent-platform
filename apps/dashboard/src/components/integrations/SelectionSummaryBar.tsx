"use client";

import React, { useState } from "react";
import { Integration } from "../../types/integration";
import { 
  CheckCircle2, 
  Mic, 
  Volume2, 
  Cpu, 
  RotateCcw, 
  Copy, 
  Check,
  Zap
} from "lucide-react";
import { Button } from "../ui/button";

interface SelectionSummaryBarProps {
  selectedStt: Integration | null;
  selectedTts: Integration | null;
  selectedLlm: Integration | null;
  onClearSelection: () => void;
}

export function SelectionSummaryBar({
  selectedStt,
  selectedTts,
  selectedLlm,
  onClearSelection,
}: SelectionSummaryBarProps) {
  const [copied, setCopied] = useState(false);

  const hasSelection = Boolean(selectedStt || selectedTts || selectedLlm);

  const copyConfigSummary = () => {
    const text = `Selected Voice Pipeline Combination:
- Speech-to-Text (STT): ${selectedStt ? selectedStt.name : "None selected"}
- Text-to-Speech (TTS): ${selectedTts ? selectedTts.name : "None selected"}
- LLM Provider: ${selectedLlm ? selectedLlm.name : "None selected"}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="sticky bottom-6 z-40 rounded-xl border border-teal-500/40 bg-card/95 dark:bg-slate-900/95 p-3.5 shadow-xl backdrop-blur-md transition-all">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        {/* Left: Selected Combination Status */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-700/10 text-teal-800 dark:bg-teal-500/20 border border-teal-500/30 shrink-0">
            <Zap className="h-4 w-4 text-teal-600 dark:text-teal-400" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-foreground">
                Active Provider Combination
              </span>
              {hasSelection ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  Combination Active
                </span>
              ) : (
                <span className="text-[10px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
                  Click any card to select
                </span>
              )}
            </div>

            {/* Micro badges summary */}
            <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs">
              {/* STT Selection */}
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-muted/60 border border-border/70">
                <Mic className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="text-[11px] font-medium text-muted-foreground">STT:</span>
                <span className="text-[11px] font-bold text-foreground truncate max-w-[150px]">
                  {selectedStt ? selectedStt.name : "[none selected]"}
                </span>
              </div>

              {/* TTS Selection */}
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-muted/60 border border-border/70">
                <Volume2 className="h-3 w-3 text-blue-600 dark:text-blue-400 shrink-0" />
                <span className="text-[11px] font-medium text-muted-foreground">TTS:</span>
                <span className="text-[11px] font-bold text-foreground truncate max-w-[150px]">
                  {selectedTts ? selectedTts.name : "[none selected]"}
                </span>
              </div>

              {/* LLM Selection */}
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-muted/60 border border-border/70">
                <Cpu className="h-3 w-3 text-teal-600 dark:text-teal-400 shrink-0" />
                <span className="text-[11px] font-medium text-muted-foreground">LLM:</span>
                <span className="text-[11px] font-bold text-foreground truncate max-w-[150px]">
                  {selectedLlm ? selectedLlm.name : "[none selected]"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        {hasSelection && (
          <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={copyConfigSummary}
              className="h-8 gap-1.5 text-xs border-border/80 hover:bg-muted"
              title="Copy selected provider combination details"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Copy Pipeline</span>
                </>
              )}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={onClearSelection}
              className="h-8 gap-1 text-xs text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10"
              title="Clear current selection"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset</span>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
