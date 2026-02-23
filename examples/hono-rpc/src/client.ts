/**
 * Type-safe RPC client for the Hono server
 *
 * Demonstrates:
 * 1. Creating a type-safe client using hc from @voxeljs/hono
 * 2. Using the createRpcClient utility
 * 3. Making typed requests with full autocomplete support
 */
import { hc, createRpcClient, type InferHonoAppType } from '@voxeljs/hono';
import type { HonoAdapter } from '@voxeljs/hono';

/**
 * Define the app type for RPC client generation
 *
 * In a real application, you would export this from your server module
 * and import it here. For this example, we'll define the expected type.
 */
export type AppType = {
  '/health': {
    $get: {
      input: {};
      output: {
        status: string;
        timestamp: string;
      };
    };
  };
  '/users': {
    $get: {
      input: {};
      output: {
        data: Array<{
          id: string;
          name: string;
          email: string;
          createdAt: string;
        }>;
        count?: number;
      };
    };
    $post: {
      input: {
        json: {
          name: string;
          email: string;
        };
      };
      output: {
        data: {
          id: string;
          name: string;
          email: string;
          createdAt: string;
        };
      };
    };
  };
  '/users/:id': {
    $get: {
      input: {
        param: {
          id: string;
        };
      };
      output: {
        data: {
          id: string;
          name: string;
          email: string;
          createdAt: string;
        };
      } | {
        error: string;
      };
    };
    $put: {
      input: {
        param: {
          id: string;
        };
        json: {
          name?: string;
          email?: string;
        };
      };
      output: {
        data: {
          id: string;
          name: string;
          email: string;
          createdAt: string;
        };
      } | {
        error: string;
      };
    };
    $delete: {
      input: {
        param: {
          id: string;
        };
      };
      output: {};
    };
  };
};

/**
 * Base URL for the API client
 */
const BASE_URL = process.env.API_URL || 'http://localhost:3000';

/**
 * Method 1: Using the hc utility directly
 *
 * Create a type-safe client by passing the app type to hc.
 * This gives you full autocomplete and type safety.
 */
export const client = hc<AppType>(BASE_URL);

/**
 * Method 2: Using the createRpcClient utility
 *
 * This utility works with any object that has a getApp() method.
 * It extracts the Hono app type and creates a typed client.
 *
 * Note: This requires access to the adapter instance or app type.
 * In a real application, you would export the app type from your server.
 */
export function createClientFromAdapter(adapter: HonoAdapter) {
  return createRpcClient(adapter, BASE_URL);
}

/**
 * Example usage functions
 *
 * These demonstrate how to use the typed client with full type safety.
 */
export async function exampleUsage() {
  console.log('=== Hono RPC Client Example Usage ===\n');

  // Health check
  const healthRes = await client.health.$get();
  const health = await healthRes.json();
  console.log('Health check:', health);

  // List all users
  const usersRes = await client.users.$get();
  const users = await usersRes.json();
  console.log('\nAll users:', users);

  // Get a specific user
  const userRes = await client.users[':id'].$get({
    param: { id: '1' },
  });
  const user = await userRes.json();
  console.log('\nUser by id:', user);

  // Create a new user
  const createRes = await client.users.$post({
    json: {
      name: 'Jane Doe',
      email: 'jane@example.com',
    },
  });
  const created = await createRes.json();
  console.log('\nCreated user:', created);

  // Update a user
  const updateRes = await client.users[':id'].$put({
    param: { id: '1' },
    json: {
      name: 'Jane Smith',
    },
  });
  const updated = await updateRes.json();
  console.log('\nUpdated user:', updated);

  // Delete a user
  const deleteRes = await client.users[':id'].$delete({
    param: { id: '1' },
  });
  console.log('\nDelete status:', deleteRes.status);
}

/**
 * Run the example if this file is executed directly
 */
export async function runExample(): Promise<void> {
  try {
    await exampleUsage();
    process.exit(0);
  } catch (error) {
    console.error('Error running example:', error);
    process.exit(1);
  }
}
