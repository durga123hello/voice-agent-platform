import crypto from 'crypto';

/**
 * Generates a raw API key and its prefix based on type ('private' | 'public').
 * Private: sk_live_[prefix]_[secret]
 * Public: pk_live_[prefix]_[secret]
 */
export function generateApiKey(type: 'private' | 'public' = 'private'): { rawKey: string; keyPrefix: string } {
  const prefix = crypto.randomBytes(4).toString('hex'); // 8 hex characters
  const secret = crypto.randomBytes(13).toString('hex'); // 26 hex characters
  const rootPrefix = type === 'public' ? 'pk' : 'sk';
  const keyPrefix = `${rootPrefix}_live_${prefix}`;
  const rawKey = `${keyPrefix}_${secret}`;
  return { rawKey, keyPrefix };
}

/**
 * Hashes an API key securely using SHA-256.
 */
export function hashApiKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}
