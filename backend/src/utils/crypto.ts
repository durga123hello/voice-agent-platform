import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

// We fetch the secret from env (support both ENCRYPTION_SECRET and ENCRYPTION_KEY).
const SECRET = process.env.ENCRYPTION_SECRET || process.env.ENCRYPTION_KEY;

// Ensure the secret is present and is sufficiently long.
if (!SECRET) {
  throw new Error('CRITICAL: ENCRYPTION_SECRET (or ENCRYPTION_KEY) environment variable is not defined.');
}

// Derive a 32-byte key from the secret using SHA-256
const getSecretKey = (): Buffer => {
  return crypto.createHash('sha256').update(SECRET).digest();
};

/**
 * Encrypts plain text using AES-256-GCM.
 * Returns the encrypted string in the format: iv_hex:auth_tag_hex:ciphertext_hex
 */
export function encrypt(text: string): string {
  const key = getSecretKey();
  const iv = crypto.randomBytes(12); // GCM recommended IV length is 12 bytes
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts encrypted text formatted as: iv_hex:auth_tag_hex:ciphertext_hex
 * Returns the decrypted plain text.
 */
export function decrypt(encryptedText: string): string {
  const key = getSecretKey();
  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted key format. Expected iv:authTag:ciphertext');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const ciphertext = parts[2];

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
