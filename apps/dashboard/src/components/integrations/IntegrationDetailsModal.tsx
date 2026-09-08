"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Integration, IntegrationCategory } from "../../types/integration";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "../ui/dialog";
import { Button } from "../ui/button";
import { 
  Layers,
  Mic, 
  Volume2, 
  Cpu, 
  Key, 
  Calendar, 
  Pencil, 
  Hash,
  Activity,
  Check,
  Copy,
  Eye,
  EyeOff
} from "lucide-react";

interface IntegrationDetailsModalProps {
  integration: Integration | null;
  isOpen: boolean;
  onClose: () => void;
}

export function IntegrationDetailsModal({
  integration,
  isOpen,
  onClose,
}: IntegrationDetailsModalProps) {
  const [isRevealed, setIsRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!integration) return null;

  const copyApiKey = () => {
    navigator.clipboard.writeText(integration.apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const renderCategoryIcon = (category: IntegrationCategory) => {
    switch (category) {
      case "STT Agent":
        return <Mic className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />;
      case "TTS Agent":
        return <Volume2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />;
      case "LLM Provider":
        return <Cpu className="h-6 w-6 text-teal-600 dark:text-teal-400" />;
      default:
        return <Layers className="h-6 w-6 text-teal-600" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg p-6">
        {/* Header */}
        <DialogHeader className="pb-3 border-b border-border/70">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-700/10 text-teal-800 dark:bg-teal-500/15 dark:text-teal-300 border border-teal-500/20 shrink-0 shadow-xs">
              {renderCategoryIcon(integration.category)}
            </div>

            <div>
              <DialogTitle className="text-lg font-bold text-foreground">
                {integration.name}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded border border-border">
                  <Hash className="h-3 w-3 text-muted-foreground" />
                  {integration.integrationId}
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800/60">
                  <span className="h-2 w-2 rounded-full bg-teal-500 shrink-0" />
                  {integration.category}
                </span>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Content sections */}
        <div className="space-y-4 py-2 text-xs">
          {/* Provider details */}
          <div className="grid grid-cols-2 gap-2.5 bg-muted/30 p-3 rounded-lg border border-border/60">
            <div>
              <span className="text-[10px] text-muted-foreground block font-medium">Provider Vendor</span>
              <span className="font-semibold text-foreground text-xs mt-0.5 block">
                {integration.provider}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-muted-foreground block font-medium">Status</span>
              <span className="font-semibold text-emerald-700 dark:text-emerald-300 text-xs mt-0.5 block">
                {integration.status}
              </span>
            </div>
          </div>

          {/* Available Models */}
          <div className="bg-muted/30 p-3 rounded-lg border border-border/60 space-y-1">
            <span className="text-[10px] text-muted-foreground block font-medium">Available Models & Engine Catalogs</span>
            <p className="font-mono text-xs text-foreground bg-background p-2 rounded border border-border/70">
              {integration.availableModels}
            </p>
          </div>

          {/* API Credentials */}
          <div className="bg-muted/30 p-3 rounded-lg border border-border/60 space-y-1">
            <span className="text-[10px] text-muted-foreground block font-medium">API Key Credentials</span>
            <div className="flex items-center justify-between gap-2 bg-background p-2 rounded border border-border/70">
              <div className="flex items-center gap-1.5 min-w-0">
                <Key className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                <span className="font-mono text-xs text-foreground truncate">
                  {isRevealed ? integration.apiKey : `••••••••••••${integration.apiKey.slice(-4)}`}
                </span>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={() => setIsRevealed(!isRevealed)}
                >
                  {isRevealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-teal-600"
                  onClick={copyApiKey}
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-2.5 bg-muted/30 p-3 rounded-lg border border-border/60">
            {integration.latency && (
              <div>
                <span className="text-[10px] text-muted-foreground block font-medium">Average Latency</span>
                <span className="font-medium text-foreground flex items-center gap-1.5 mt-0.5">
                  <Activity className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                  {integration.latency}
                </span>
              </div>
            )}

            <div>
              <span className="text-[10px] text-muted-foreground block font-medium">Creation Date</span>
              <span className="font-medium text-foreground flex items-center gap-1.5 mt-0.5">
                <Calendar className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                {integration.createdAt}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="pt-2 border-t border-border/70 flex justify-between items-center sm:justify-between">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            Close
          </Button>

          <Button asChild size="sm" className="gap-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs">
            <Link href={`/integrations/create?edit=${integration.id}`}>
              <Pencil className="h-3.5 w-3.5" />
              <span>Edit Integration</span>
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
