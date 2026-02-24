/**
 * User Controller
 *
 * Demonstrates the Voxel controller pattern with static metadata.
 * Routes are defined using the static metadata property.
 */
import type { Request, Response } from 'express';
import { Controller } from '@voxeljs/core';
import type { ControllerMetadata, ConstructorInfer } from '@voxeljs/core';
import type { UserService } from './user.service.ts';

export class UserController extends Controller {
  /**
   * Static inject property defines dependencies
   */
  static readonly inject = ['UserService'] as const satisfies ConstructorInfer<typeof UserController>;

  /**
   * Static metadata defines controller routes
   * The basePath is prepended to all routes
   */
  static readonly metadata: ControllerMetadata = {
    basePath: '/users',
    routes: [
      { method: 'GET', path: '/', handler: 'findAll' },
      { method: 'GET', path: '/:id', handler: 'findById' },
      { method: 'POST', path: '/', handler: 'create' },
      { method: 'PUT', path: '/:id', handler: 'update' },
      { method: 'DELETE', path: '/:id', handler: 'delete' },
    ] as const,
  };

  constructor(private userService: UserService) {
    super();
  }

  /**
   * GET /users - Get all users
   */
  findAll(_req: Request, res: Response): void {
    const users = this.userService.findAll();
    res.json({ data: users, count: users.length });
  }

  /**
   * GET /users/:id - Get user by ID
   */
  findById(req: Request, res: Response): void {
    const { id } = req.params;
    const user = this.userService.findById(typeof id === 'string' ? id : id[0]);

    if (!user) {
      res.status(404).json({ error: `User with id ${id} not found` });
      return;
    }

    res.json({ data: user });
  }

  /**
   * POST /users - Create a new user
   */
  create(req: Request, res: Response): void {
    const { name, email } = req.body as { name: string; email: string };

    if (!name || !email) {
      res.status(400).json({ error: 'name and email are required' });
      return;
    }

    const user = this.userService.create({ name, email });
    res.status(201).json({ data: user });
  }

  /**
   * PUT /users/:id - Update a user
   */
  update(req: Request, res: Response): void {
    const { id } = req.params;
    const { name, email } = req.body as { name?: string; email?: string };

    const user = this.userService.update(typeof id === 'string' ? id : id[0], { name, email });

    if (!user) {
      res.status(404).json({ error: `User with id ${id} not found` });
      return;
    }

    res.json({ data: user });
  }

  /**
   * DELETE /users/:id - Delete a user
   */
  delete(req: Request, res: Response): void {
    const { id } = req.params;
    const deleted = this.userService.delete(typeof id === 'string' ? id : id[0]);

    if (!deleted) {
      res.status(404).json({ error: `User with id ${id} not found` });
      return;
    }

    res.status(204).send();
  }
}
