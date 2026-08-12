/**
 * Utility to extract speech pause threshold (utterance_end_ms) from system prompts
 * if not explicitly provided via UI fields.
 */

export const DEFAULT_UTTERANCE_END_MS = 1800; // 1.8s natural baseline
export const MIN_UTTERANCE_END_MS = 500;       // 0.5s minimum
export const MAX_UTTERANCE_END_MS = 5000;      // 5.0s maximum

export function extractPacingFromPrompt(prompt?: string | null): number | null {
  if (!prompt || typeof prompt !== 'string') return null;

  // 1. Direct seconds / ms pattern:
  // e.g. "pause: 2.5s", "wait 2 seconds", "allow 2s pause", "thinking time: 2500ms", "silence window of 2 sec"
  const timeMatch = prompt.match(
    /(?:pause|wait|delay|thinking\s*time|silence\s*(?:window|delay|threshold)?|allow\s+(?:the\s+)?(?:candidate|user|speaker)\s+(?:a\s+)?pause\s*(?:of)?|give\s+(?:the\s+)?(?:candidate|user|speaker))[:\s]+(\d+(?:\.\d+)?)\s*(s|sec|seconds?|ms|milliseconds?)/i
  ) || prompt.match(
    /(?:allow|give)\s+(?:the\s+)?(?:candidate|user|speaker)\s+(\d+(?:\.\d+)?)\s*(s|sec|seconds?)\s*(?:of\s+)?(?:pause|thinking\s*time|silence|to\s*think)/i
  );

  if (timeMatch) {
    const val = parseFloat(timeMatch[1]);
    const unit = timeMatch[2].toLowerCase();
    const ms = unit.startsWith('s') ? Math.round(val * 1000) : Math.round(val);
    if (!isNaN(ms)) {
      return Math.min(MAX_UTTERANCE_END_MS, Math.max(MIN_UTTERANCE_END_MS, ms));
    }
  }

  // 2. Keyword-based pacing pattern:
  // e.g. "pacing: fast", "pacing: natural", "pacing: relaxed", "pacing: interview"
  const keywordMatch = prompt.match(/(?:pacing|conversational\s*pacing|turn\s*taking)[:\s]*(fast|snappy|quick|natural|balanced|relaxed|thoughtful|interview|slow)/i);
  if (keywordMatch) {
    const mode = keywordMatch[1].toLowerCase();
    switch (mode) {
      case 'fast':
      case 'snappy':
      case 'quick':
        return 1000;
      case 'natural':
      case 'balanced':
        return 1800;
      case 'relaxed':
      case 'thoughtful':
      case 'interview':
      case 'slow':
        return 2500;
    }
  }

  return null;
}

export function resolveUtteranceEndMs(explicitValue?: any, prompt?: string | null): number {
  if (explicitValue !== undefined && explicitValue !== null && explicitValue !== '') {
    const parsed = parseInt(explicitValue, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return Math.min(MAX_UTTERANCE_END_MS, Math.max(MIN_UTTERANCE_END_MS, parsed));
    }
  }

  const extracted = extractPacingFromPrompt(prompt);
  if (extracted !== null) {
    return extracted;
  }

  return DEFAULT_UTTERANCE_END_MS;
}
