import type { ConstructorInfer } from '@voxeljs/core';

/**
 * In-memory user service
 *
 * Manages user data with CRUD operations.
 */
export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

export interface CreateUserInput {
  name: string;
  email: string;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
}

export class UserService {
  static readonly inject = [] as const satisfies ConstructorInfer<typeof UserService>;

  private users: Map<string, User> = new Map();
  private nextId = 1;

  findAll(): User[] {
    return Array.from(this.users.values());
  }

  findById(id: string): User | undefined {
    return this.users.get(id);
  }

  create(input: CreateUserInput): User {
    const id = String(this.nextId++);
    const user: User = {
      id,
      name: input.name,
      email: input.email,
      createdAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  update(id: string, input: UpdateUserInput): User | undefined {
    const user = this.users.get(id);
    if (!user) {
      return undefined;
    }
    const updated: User = {
      ...user,
      name: input.name ?? user.name,
      email: input.email ?? user.email,
    };
    this.users.set(id, updated);
    return updated;
  }

  delete(id: string): boolean {
    return this.users.delete(id);
  }
}
