"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  FlaskConical, 
  ExternalLink, 
  RefreshCw, 
  AlertTriangle, 
  Loader2, 
  Sparkles 
} from "lucide-react";
import { Button } from "../../components/ui/button";

export default function TestingPage() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);

  // Configurable URL via env var, defaults to http://localhost:3001 for local development
  const voicePlatformUrl = 
    process.env.NEXT_PUBLIC_VOICE_PLATFORM_URL || "http://localhost:3001";

  useEffect(() => {
    setIsLoading(true);
    setHasError(false);

    // 6-second timeout to check if the voice platform is running
    const timer = setTimeout(() => {
      // If still loading after timeout, show fallback
      setIsLoading((currentlyLoading) => {
        if (currentlyLoading) {
          setHasError(true);
        }
        return false;
      });
    }, 6000);

    return () => clearTimeout(timer);
  }, [iframeKey]);

  const handleIframeLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleRetry = () => {
    setIframeKey((prev) => prev + 1);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6.5rem)] w-full rounded-xl border border-border bg-card overflow-hidden shadow-xs relative">
      
      {/* Top Embedded Control Bar */}
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2 text-xs">
        <div className="flex items-center gap-2 font-semibold text-foreground">
          <FlaskConical className="h-4 w-4 text-teal-700 dark:text-teal-400" />
          <span>Embedded Voice Testing Console</span>
          <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded border border-border">
            {voicePlatformUrl}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRetry}
            className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
            title="Reload embedded app"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Reload</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            asChild
            className="h-7 text-xs gap-1.5"
          >
            <a href={voicePlatformUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Open in New Tab</span>
            </a>
          </Button>
        </div>
      </div>

      {/* Main Iframe Container */}
      <div className="relative flex-1 w-full h-full bg-background">
        
        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/90 backdrop-blur-xs space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-teal-700 dark:text-teal-400" />
            <div className="text-center">
              <p className="text-xs font-semibold text-foreground">Connecting to Voice Platform...</p>
              <p className="text-[11px] text-muted-foreground">Initializing WebRTC audio engine & telemetry bridge</p>
            </div>
          </div>
        )}

        {/* Error / Offline Fallback */}
        {hasError && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 bg-card text-center space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
              <AlertTriangle className="h-6 w-6" />
            </div>
            
            <div className="max-w-md space-y-1.5">
              <h3 className="text-sm font-bold text-foreground">
                Unable to reach the voice orchestration platform
              </h3>
              <p className="text-xs text-muted-foreground">
                The embedded voice platform at <code className="bg-muted px-1 py-0.5 rounded text-foreground font-mono text-[11px]">{voicePlatformUrl}</code> did not respond within the expected time frame.
              </p>
              <p className="text-[11px] text-muted-foreground pt-1">
                Please verify that the voice platform dev server is running locally (e.g. <code className="font-mono text-teal-700 dark:text-teal-400">npm run dev:voice</code> on port 3001).
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="default"
                size="sm"
                onClick={handleRetry}
                className="gap-2 bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white text-xs font-medium"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Retry Connection</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                asChild
                className="text-xs"
              >
                <a href={voicePlatformUrl} target="_blank" rel="noopener noreferrer">
                  <span>Open Directly</span>
                </a>
              </Button>
            </div>
          </div>
        )}

        {/* 
          TODO: If deployed to separate origins in production, review and tune 
          iframe sandbox permissions (e.g., allow-scripts allow-same-origin allow-forms)
          and ensure microphone media permissions are permitted via allow="microphone; camera".
        */}
        <iframe
          key={iframeKey}
          ref={iframeRef}
          src={voicePlatformUrl}
          onLoad={handleIframeLoad}
          title="Voice Orchestration Platform"
          allow="microphone; camera; autoplay; display-capture"
          className="w-full h-full border-0 block"
        />

      </div>
    </div>
  );
}
