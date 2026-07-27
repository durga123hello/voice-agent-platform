import { Router, Request, Response } from 'express';
import prisma from '../db/client';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    // Perform a simple query to verify db health
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      database: 'connected',
      uptime: process.uptime()
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      database: 'disconnected',
      message: error?.message || 'Database connection error'
    });
  }
});

export default router;
