export interface CallbackRequestResult {
  isCallback: boolean;
  requestedTimeText?: string;
  requestedMinutes?: number;
}

/**
 * Scans candidate speech transcripts for reschedule/callback requests.
 * Extracts time hints (e.g. "30 minutes", "1 hour") and normalizes relative times.
 */
export function detectCallbackRequest(text: string): CallbackRequestResult {
  const cleaned = text.toLowerCase().trim();
  if (!cleaned) return { isCallback: false };

  // Common callback / rescheduling intent keywords
  const keywords = [
    'call me later',
    'call me tomorrow',
    'busy right now',
    'reschedule',
    'call me in',
    'call later',
    'busy today',
    'not a good time',
    'cannot talk now',
    'can we do this tomorrow',
    'reschedule this'
  ];

  const hasIntent = keywords.some((k) => cleaned.includes(k));
  if (!hasIntent) return { isCallback: false };

  let requestedMinutes: number | undefined = undefined;
  let requestedTimeText = 'later';

  // 1. Parse minutes (e.g. "30 minutes", "in 15 mins")
  const minMatch = cleaned.match(/(\d+)\s*(min|minute)/);
  if (minMatch) {
    requestedMinutes = parseInt(minMatch[1], 10);
    requestedTimeText = `${requestedMinutes} minutes`;
  }
  // 2. Parse hours (e.g. "1 hour", "2 hours")
  else if (cleaned.includes('hour')) {
    const hourMatch = cleaned.match(/(\d+)\s*hour/);
    const hours = hourMatch ? parseInt(hourMatch[1], 10) : 1;
    requestedMinutes = hours * 60;
    requestedTimeText = `${hours} hour(s)`;
  }
  // 3. Parse "tomorrow"
  else if (cleaned.includes('tomorrow')) {
    requestedTimeText = 'tomorrow';
  }

  return {
    isCallback: true,
    requestedTimeText,
    requestedMinutes
  };
}
