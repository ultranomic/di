/**
 * User Controller
 *
 * Demonstrates the Voxel controller pattern with Hono Context.
 * This controller is designed to work with Hono RPC for type-safe client generation.
 */
import type { Context } from 'hono';
import { Controller } from '@voxeljs/core';
import type { ControllerMetadata } from '@voxeljs/core';
import type { CreateUserInput, UpdateUserInput, User, UserService } from './user.service.js';

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T> {
  data: T;
  count?: number;
}

export interface ApiError {
  error: string;
}

export class UserController extends Controller {
  /**
   * Static inject property defines dependencies
   */
  static readonly inject = {
    userService: 'UserService',
  } as const;

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

  constructor(private deps: typeof UserController.inject) {
    super();
  }

  /**
   * GET /users - Get all users
   * Returns a list of users with count
   */
  findAll(c: Context): Response {
    const users = (this.deps.userService as UserService).findAll();
    const response: ApiResponse<User[]> = { data: users, count: users.length };
    return c.json(response);
  }

  /**
   * GET /users/:id - Get user by ID
   * Returns a single user or 404 error
   */
  findById(c: Context): Response {
    const id = c.req.param('id');
    const user = (this.deps.userService as UserService).findById(id);

    if (!user) {
      const error: ApiError = { error: `User with id ${id} not found` };
      return c.json(error, 404);
    }

    const response: ApiResponse<User> = { data: user };
    return c.json(response);
  }

  /**
   * POST /users - Create a new user
   * Accepts CreateUserInput and returns created user with 201 status
   */
  async create(c: Context): Promise<Response> {
    const body = await c.req.json<CreateUserInput>();

    if (!body.name || !body.email) {
      const error: ApiError = { error: 'name and email are required' };
      return c.json(error, 400);
    }

    const user = (this.deps.userService as UserService).create(body);
    const response: ApiResponse<User> = { data: user };
    return c.json(response, 201);
  }

  /**
   * PUT /users/:id - Update a user
   * Accepts UpdateUserInput and returns updated user or 404
   */
  async update(c: Context): Promise<Response> {
    const id = c.req.param('id');
    const body = await c.req.json<UpdateUserInput>();

    const user = (this.deps.userService as UserService).update(id, body);

    if (!user) {
      const error: ApiError = { error: `User with id ${id} not found` };
      return c.json(error, 404);
    }

    const response: ApiResponse<User> = { data: user };
    return c.json(response);
  }

  /**
   * DELETE /users/:id - Delete a user
   * Returns 204 on success, 404 if user not found
   */
  delete(c: Context): Response {
    const id = c.req.param('id');
    const deleted = (this.deps.userService as UserService).delete(id);

    if (!deleted) {
      const error: ApiError = { error: `User with id ${id} not found` };
      return c.json(error, 404);
    }

    return c.newResponse(null, 204);
  }
}
