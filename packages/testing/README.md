# @voxeljs/testing

Testing utilities for Voxel framework. Works with vitest for isolated unit testing.

## Installation

```bash
pnpm add -D @voxeljs/testing
```

## Quick Start

```typescript
import { describe, it, expect, vi } from 'vitest';
import { Test, mock } from '@voxeljs/testing';
import { UserService } from './user.service.ts';

describe('UserService', () => {
  it('returns user by id', async () => {
    const module = await Test.createModule({
      providers: [UserService],
    }).compile();

    const service = module.get(UserService);
    const user = await service.findById('1');

    expect(user).toEqual({ id: '1', name: 'Alice' });
  });
});
```

## API Reference

### Test.createModule(config)

Creates a test module builder. Call `.compile()` to build the testing module.

```typescript
const builder = Test.createModule({
  providers: [UserService],
  controllers: [UserController],
  imports: [DatabaseModule],
});

const module = await builder.compile();
```

**Config options:**

- `providers` - Array of provider classes to register
- `controllers` - Array of controller classes
- `imports` - Array of modules to import

### TestModuleBuilder.overrideProvider(token, implementation)

Replaces a provider with a mock or stub implementation. Returns the builder for chaining.

```typescript
const module = await Test.createModule({
  providers: [UserService],
})
  .overrideProvider('Logger', mockLogger)
  .overrideProvider('Database', mockDatabase)
  .compile();
```

### TestModuleBuilder.overrideProviderFactory(token, factory)

Replaces a provider with a factory function. Useful when the mock needs access to the container.

```typescript
const module = await Test.createModule({
  providers: [UserService],
})
  .overrideProviderFactory('Database', (container) => {
    return createMockDatabase();
  })
  .compile();
```

### TestModuleBuilder.addProvider(token, implementation)

Adds an extra provider to the test module. Useful for injecting test-only dependencies.

```typescript
const module = await Test.createModule({
  providers: [UserService],
})
  .addProvider('TestConfig', { apiUrl: 'http://test.local' })
  .compile();
```

### TestingModule.get(token)

Retrieves a provider from the compiled test module.

```typescript
const service = module.get(UserService);
const repository = module.get('UserRepository');
```

### TestingModule.has(token)

Checks if a token is registered in the module.

```typescript
if (module.has('Logger')) {
  const logger = module.get('Logger');
}
```

## Mocking

### mock(token).use(implementation)

Creates a mock implementation for a token. The fluent API keeps types intact.

```typescript
import { mock } from '@voxeljs/testing';

const mockLogger = mock('Logger').use({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
});

const mockDatabase = mock('Database').use({
  query: vi.fn().mockResolvedValue([{ id: '1', name: 'Test' }]),
  connect: vi.fn().mockResolvedValue(undefined),
});
```

For class tokens, the mock preserves the type:

```typescript
import { UserService } from './user.service.ts';

const mockUserService = mock(UserService).use({
  findById: vi.fn().mockResolvedValue({ id: '1', name: 'Alice' }),
  findAll: vi.fn().mockResolvedValue([]),
});
```

## Examples

### Testing a Service in Isolation

```typescript
import { describe, it, expect, vi } from 'vitest';
import { Test, mock } from '@voxeljs/testing';
import { UserService } from './user.service.ts';

describe('UserService', () => {
  it('fetches user from database', async () => {
    const mockDb = mock('Database').use({
      query: vi.fn().mockResolvedValue([{ id: '1', name: 'Alice', email: 'alice@example.com' }]),
    });

    const mockLogger = mock('Logger').use({
      info: vi.fn(),
      error: vi.fn(),
    });

    const module = await Test.createModule({
      providers: [UserService],
    })
      .overrideProvider('Database', mockDb)
      .overrideProvider('Logger', mockLogger)
      .compile();

    const service = module.get(UserService);
    const user = await service.findById('1');

    expect(user).toEqual({ id: '1', name: 'Alice', email: 'alice@example.com' });
    expect(mockDb.query).toHaveBeenCalledWith('SELECT * FROM users WHERE id = $1', ['1']);
  });

  it('handles database errors', async () => {
    const mockDb = mock('Database').use({
      query: vi.fn().mockRejectedValue(new Error('Connection failed')),
    });

    const mockLogger = mock('Logger').use({
      info: vi.fn(),
      error: vi.fn(),
    });

    const module = await Test.createModule({
      providers: [UserService],
    })
      .overrideProvider('Database', mockDb)
      .overrideProvider('Logger', mockLogger)
      .compile();

    const service = module.get(UserService);

    await expect(service.findById('1')).rejects.toThrow('Connection failed');
    expect(mockLogger.error).toHaveBeenCalled();
  });
});
```

### Testing Controllers

```typescript
import { describe, it, expect, vi } from 'vitest';
import { Test, mock } from '@voxeljs/testing';
import { UserController } from './user.controller.ts';
import { UserService } from './user.service.ts';

describe('UserController', () => {
  it('lists all users', async () => {
    const mockService = mock(UserService).use({
      findAll: vi.fn().mockResolvedValue([
        { id: '1', name: 'Alice' },
        { id: '2', name: 'Bob' },
      ]),
    });

    const module = await Test.createModule({
      controllers: [UserController],
    })
      .addProvider(UserService, mockService)
      .compile();

    const controller = module.get(UserController);

    const req = {} as any;
    const res = {
      json: vi.fn(),
    } as any;

    await controller.list(req, res);

    expect(res.json).toHaveBeenCalledWith([
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ]);
  });

  it('returns 404 for missing user', async () => {
    const mockService = mock(UserService).use({
      findById: vi.fn().mockResolvedValue(null),
    });

    const module = await Test.createModule({
      controllers: [UserController],
    })
      .addProvider(UserService, mockService)
      .compile();

    const controller = module.get(UserController);

    const req = { params: { id: '999' } } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;

    await controller.get(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not found' });
  });
});
```

### Testing with Module Imports

```typescript
import { describe, it, expect, vi } from 'vitest';
import { Test, mock } from '@voxeljs/testing';
import { UserModule } from './user.module.ts';
import { UserService } from './user.service.ts';
import { DatabaseModule } from '../database/database.module.ts';

describe('UserModule', () => {
  it('integrates with database module', async () => {
    const mockDb = mock('Database').use({
      query: vi.fn().mockResolvedValue([]),
    });

    const module = await Test.createModule({
      imports: [DatabaseModule, UserModule],
    })
      .overrideProvider('Database', mockDb)
      .compile();

    const service = module.get(UserService);

    expect(service).toBeDefined();
    expect(module.has('Database')).toBe(true);
  });
});
```

### Testing Services with Complex Dependencies

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, mock } from '@voxeljs/testing';
import { OrderService } from './order.service.ts';
import { PaymentService } from './payment.service.ts';
import { InventoryService } from './inventory.service.ts';
import { NotificationService } from './notification.service.ts';

describe('OrderService', () => {
  let mockPayment: PaymentService;
  let mockInventory: InventoryService;
  let mockNotification: NotificationService;
  let orderService: OrderService;

  beforeEach(async () => {
    mockPayment = mock('PaymentService').use({
      charge: vi.fn().mockResolvedValue({ id: 'pay_123', status: 'success' }),
    });

    mockInventory = mock('InventoryService').use({
      checkStock: vi.fn().mockResolvedValue(true),
      reserve: vi.fn().mockResolvedValue(undefined),
    });

    mockNotification = mock('NotificationService').use({
      sendEmail: vi.fn().mockResolvedValue(undefined),
    });

    const module = await Test.createModule({
      providers: [OrderService],
    })
      .overrideProvider('PaymentService', mockPayment)
      .overrideProvider('InventoryService', mockInventory)
      .overrideProvider('NotificationService', mockNotification)
      .compile();

    orderService = module.get(OrderService);
  });

  it('processes order successfully', async () => {
    const order = await orderService.createOrder({
      userId: 'user_1',
      items: [{ productId: 'prod_1', quantity: 2 }],
    });

    expect(mockInventory.checkStock).toHaveBeenCalled();
    expect(mockInventory.reserve).toHaveBeenCalled();
    expect(mockPayment.charge).toHaveBeenCalled();
    expect(mockNotification.sendEmail).toHaveBeenCalled();
    expect(order.status).toBe('confirmed');
  });
});
```

## Integration with Vitest

This package is designed to work with vitest. Mocks created with `mock().use()` pair naturally with vitest's `vi.fn()`.

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest';
import { mock } from '@voxeljs/testing';

describe('with vitest mocks', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('tracks calls', async () => {
    const mockService = mock('Service').use({
      doWork: vi.fn().mockReturnValue('result'),
    });

    mockService.doWork();
    mockService.doWork();

    expect(mockService.doWork).toHaveBeenCalledTimes(2);
  });
});
```

## License

MIT
