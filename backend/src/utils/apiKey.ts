import crypto from 'crypto';

/**
 * Generates a raw API key and its prefix.
 * Format: vap_live_[prefix]_[secret]
 * Total length is 44 characters: 'vap_live_' (9) + prefix (8) + '_' (1) + secret (26)
 */
export function generateApiKey(): { rawKey: string; keyPrefix: string } {
  const prefix = crypto.randomBytes(4).toString('hex'); // 8 hex characters
  const secret = crypto.randomBytes(13).toString('hex'); // 26 hex characters
  const keyPrefix = `vap_live_${prefix}`;
  const rawKey = `${keyPrefix}_${secret}`;
  return { rawKey, keyPrefix };
}

/**
 * Hashes an API key securely using SHA-256.
 */
export function hashApiKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}
