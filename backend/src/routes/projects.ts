import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../db/client';
import { sessionAuth } from '../middleware/sessionAuth';

const router = Router();

// Apply auth middleware to all project endpoints
router.use(sessionAuth);

/**
 * 1. Create a new project: POST /api/projects
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).tenantId;
    const { name } = req.body;

    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'Project name is required and must be a string.' });
      return;
    }

    const project = await prisma.project.create({
      data: {
        name: name.trim(),
        tenantId
      }
    });

    res.status(201).json(project);
  } catch (error) {
    next(error);
  }
});

/**
 * 2. List all projects for an organization: GET /api/projects
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).tenantId;

    const projects = await prisma.project.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' }
    });

    res.json(projects);
  } catch (error) {
    next(error);
  }
});

/**
 * 3. Retrieve single project by ID: GET /api/projects/:id
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id } = req.params;

    const project = await prisma.project.findFirst({
      where: { id, tenantId }
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }

    res.json(project);
  } catch (error) {
    next(error);
  }
});

/**
 * 4. Rename / Update project: PATCH /api/projects/:id
 */
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id } = req.params;
    const { name } = req.body;

    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'Project name is required and must be a string.' });
      return;
    }

    const existing = await prisma.project.findFirst({
      where: { id, tenantId }
    });

    if (!existing) {
      res.status(404).json({ error: 'Project not found or unauthorized.' });
      return;
    }

    const updated = await prisma.project.update({
      where: { id },
      data: { name: name.trim() }
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

/**
 * 5. Delete project: DELETE /api/projects/:id
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id } = req.params;

    const existing = await prisma.project.findFirst({
      where: { id, tenantId }
    });

    if (!existing) {
      res.status(404).json({ error: 'Project not found or unauthorized.' });
      return;
    }

    // Check for active sessions running in this project
    const activeSessions = await prisma.session.count({
      where: {
        projectId: id,
        status: 'active'
      }
    });

    if (activeSessions > 0) {
      res.status(400).json({
        error: `Cannot delete project while it has ${activeSessions} active voice session(s). Please terminate sessions first.`
      });
      return;
    }

    await prisma.project.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Project successfully deleted.',
      id
    });
  } catch (error) {
    next(error);
  }
});

export default router;
