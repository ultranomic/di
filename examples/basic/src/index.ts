import { Container } from '@voxeljs/core';
import { ExpressAdapter } from '@voxeljs/express';
import { AppModule } from './app.module.js';
import { UserController } from './user/user.controller.js';

const PORT = Number(process.env.PORT) || 3000;

async function bootstrap(): Promise<void> {
  const container = new Container();

  const userModule = new AppModule();
  userModule.register(container);

  const adapter = new ExpressAdapter(container);
  adapter.registerController(UserController);

  const app = adapter.getApp();
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  await adapter.listen(PORT);
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Available endpoints:');
  console.log('  GET    /health       - Health check');
  console.log('  GET    /users        - List all users');
  console.log('  GET    /users/:id    - Get user by ID');
  console.log('  POST   /users        - Create a new user');
  console.log('  PUT    /users/:id    - Update a user');
  console.log('  DELETE /users/:id    - Delete a user');
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
