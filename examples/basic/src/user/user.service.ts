import type { ConstructorInfer } from '@voxeljs/core';

/**
 * User Service
 *
 * Demonstrates the Voxel service pattern with static inject property.
 * This service manages user data in memory (for demo purposes).
 */
export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

export class UserService {
  /**
   * Static inject property defines dependencies
   * Voxel container uses this to inject dependencies
   */
  static readonly inject = [] as const satisfies ConstructorInfer<typeof UserService>;

  // In-memory user store (in real app, this would be a database)
  private users: Map<string, User> = new Map();

  constructor() {
    // Initialize with some sample data
    this.users.set('1', {
      id: '1',
      name: 'John Doe',
      email: 'john@example.com',
      createdAt: new Date('2024-01-01'),
    });
    this.users.set('2', {
      id: '2',
      name: 'Jane Smith',
      email: 'jane@example.com',
      createdAt: new Date('2024-01-02'),
    });
  }

  /**
   * Get all users
   */
  findAll(): User[] {
    return Array.from(this.users.values());
  }

  /**
   * Find a user by ID
   */
  findById(id: string): User | undefined {
    return this.users.get(id);
  }

  /**
   * Create a new user
   */
  create(data: { name: string; email: string }): User {
    const id = String(this.users.size + 1);
    const user: User = {
      id,
      name: data.name,
      email: data.email,
      createdAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  /**
   * Update an existing user
   */
  update(id: string, data: Partial<{ name: string; email: string }>): User | undefined {
    const existing = this.users.get(id);
    if (!existing) {
      return undefined;
    }
    const updated: User = {
      ...existing,
      ...data,
    };
    this.users.set(id, updated);
    return updated;
  }

  /**
   * Delete a user
   */
  delete(id: string): boolean {
    return this.users.delete(id);
  }
}
