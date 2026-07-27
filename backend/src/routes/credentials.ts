import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../db/client';
import { DEFAULT_USER_ID } from '../index';
import { encrypt } from '../utils/crypto';

const router = Router();
const VALID_PROVIDERS = ['deepgram', 'openai'];

// 1. Save or Update (Upsert) credentials: POST /api/credentials
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { provider, key } = req.body;

    // Validate provider
    if (!provider || !VALID_PROVIDERS.includes(provider)) {
      res.status(400).json({ error: `provider must be one of: ${VALID_PROVIDERS.join(', ')}` });
      return;
    }

    // Validate key
    if (!key || typeof key !== 'string' || !key.trim()) {
      res.status(400).json({ error: 'key is required and must be a non-empty string.' });
      return;
    }

    // Encrypt key
    const encryptedKey = encrypt(key.trim());

    // Upsert record (Unique constraint is on [userId, provider])
    const credential = await prisma.apiCredential.upsert({
      where: {
        userId_provider: {
          userId: DEFAULT_USER_ID,
          provider
        }
      },
      update: {
        encryptedKey
      },
      create: {
        userId: DEFAULT_USER_ID,
        provider,
        encryptedKey
      }
    });

    // Never return the encrypted or decrypted key in the response
    res.json({
      message: 'Credential successfully saved.',
      id: credential.id,
      provider: credential.provider,
      createdAt: credential.createdAt
    });
  } catch (error) {
    next(error);
  }
});

// 2. Fetch list of saved credentials: GET /api/credentials
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const credentials = await prisma.apiCredential.findMany({
      where: { userId: DEFAULT_USER_ID },
      select: {
        id: true,
        provider: true,
        createdAt: true
      }
    });

    // Add a masked string/flag to confirm setup to the client without leaking actual values
    const result = credentials.map(cred => ({
      id: cred.id,
      provider: cred.provider,
      isConfigured: true,
      key: '********', // Masked representation
      createdAt: cred.createdAt
    }));

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// 3. Delete credential: DELETE /api/credentials/:provider
router.delete('/:provider', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { provider } = req.params;

    if (!VALID_PROVIDERS.includes(provider)) {
      res.status(400).json({ error: `Invalid provider. Must be one of: ${VALID_PROVIDERS.join(', ')}` });
      return;
    }

    const existing = await prisma.apiCredential.findUnique({
      where: {
        userId_provider: {
          userId: DEFAULT_USER_ID,
          provider
        }
      }
    });

    if (!existing) {
      res.status(404).json({ error: `No credential found for provider ${provider}.` });
      return;
    }

    await prisma.apiCredential.delete({
      where: {
        userId_provider: {
          userId: DEFAULT_USER_ID,
          provider
        }
      }
    });

    res.json({ message: `Successfully deleted credential for provider ${provider}.`, provider });
  } catch (error) {
    next(error);
  }
});

export default router;
