import type { Request, Response } from 'express';
import { describe, expect, it } from 'vitest';
import type { ControllerRoute, ExtractPathParams, HttpMethod, TypedRequest, TypedResponse } from './controller.ts';

describe('Controller types', () => {
  describe('HttpMethod', () => {
    it('should only accept valid HTTP methods', () => {
      const methods: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

      expect(methods).toHaveLength(7);
    });
  });

  describe('ExtractPathParams', () => {
    it('should extract single path parameter', () => {
      type Params = ExtractPathParams<'/users/:id'>;

      const params: Params = { id: '123' };
      expect(params.id).toBe('123');
    });

    it('should extract multiple path parameters', () => {
      type Params = ExtractPathParams<'/users/:userId/posts/:postId'>;

      const params: Params = { userId: 'user1', postId: 'post1' };
      expect(params.userId).toBe('user1');
      expect(params.postId).toBe('post1');
    });

    it('should return empty record for no parameters', () => {
      type Params = ExtractPathParams<'/health'>;

      const params: Params = {};
      expect(Object.keys(params)).toHaveLength(0);
    });

    it('should handle deeply nested paths', () => {
      type Params = ExtractPathParams<'/api/v1/:version/users/:userId/posts/:postId/comments/:commentId'>;

      const params: Params = {
        version: 'v1',
        userId: 'user1',
        postId: 'post1',
        commentId: 'comment1',
      };
      expect(params.version).toBe('v1');
      expect(params.userId).toBe('user1');
      expect(params.postId).toBe('post1');
      expect(params.commentId).toBe('comment1');
    });

    it('should handle trailing parameter', () => {
      type Params = ExtractPathParams<'/files/:filename'>;

      const params: Params = { filename: 'document.pdf' };
      expect(params.filename).toBe('document.pdf');
    });
  });

  describe('ControllerRoute', () => {
    it('should validate handler names against controller methods', () => {
      class UserController {
        async getUser(_req: Request, _res: Response) {
          return null;
        }
        async createUser(_req: Request, _res: Response) {
          return null;
        }
      }

      const routes: ControllerRoute<UserController>[] = [
        { method: 'GET', path: '/users/:id', handler: 'getUser' },
        { method: 'POST', path: '/users', handler: 'createUser' },
      ];

      expect(routes).toHaveLength(2);
      expect(routes[0]?.handler).toBe('getUser');
      expect(routes[1]?.handler).toBe('createUser');
    });

    it('should work with satisfies constraint', () => {
      class ProductController {
        async getProduct(_req: Request, _res: Response) {
          return null;
        }
        async listProducts(_req: Request, _res: Response) {
          return null;
        }
        async deleteProduct(_req: Request, _res: Response) {
          return null;
        }
      }

      const routes = [
        { method: 'GET' as const, path: '/products/:id', handler: 'getProduct' },
        { method: 'GET' as const, path: '/products', handler: 'listProducts' },
        { method: 'DELETE' as const, path: '/products/:id', handler: 'deleteProduct' },
      ] as const satisfies ControllerRoute<ProductController>[];

      expect(routes).toHaveLength(3);
    });
  });

  describe('TypedRequest', () => {
    it('should type params correctly', () => {
      interface UserParams {
        id: string;
      }

      const mockReq = {
        params: { id: '123' },
        body: {},
        query: {},
      } as TypedRequest<UserParams>;

      expect(mockReq.params.id).toBe('123');
    });

    it('should type body correctly', () => {
      interface CreateUserBody {
        name: string;
        email: string;
      }

      const mockReq = {
        params: {},
        body: { name: 'John', email: 'john@example.com' },
        query: {},
      } as TypedRequest<Record<string, string>, CreateUserBody>;

      expect(mockReq.body.name).toBe('John');
      expect(mockReq.body.email).toBe('john@example.com');
    });

    it('should type query correctly', () => {
      interface PaginationQuery {
        page: string;
        limit: string;
      }

      const mockReq = {
        params: {},
        body: {},
        query: { page: '1', limit: '10' },
      } as TypedRequest<Record<string, string>, unknown, PaginationQuery>;

      expect(mockReq.query.page).toBe('1');
      expect(mockReq.query.limit).toBe('10');
    });

    it('should combine all type parameters', () => {
      interface UpdateParams {
        id: string;
      }
      interface UpdateBody {
        name: string;
      }
      interface UpdateQuery {
        validate: string;
      }

      const mockReq = {
        params: { id: '123' },
        body: { name: 'Updated' },
        query: { validate: 'true' },
      } as TypedRequest<UpdateParams, UpdateBody, UpdateQuery>;

      expect(mockReq.params.id).toBe('123');
      expect(mockReq.body.name).toBe('Updated');
      expect(mockReq.query.validate).toBe('true');
    });
  });

  describe('TypedResponse', () => {
    it('should be compatible with Express Response', () => {
      const mockRes = {
        json: (data: unknown) => data,
        status: (code: number) => ({ json: (data: unknown) => ({ code, data }) }),
      } as unknown as TypedResponse;

      expect(mockRes.json({ test: true })).toEqual({ test: true });
    });
  });
});
