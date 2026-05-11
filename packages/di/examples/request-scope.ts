// oxlint-disable max-classes-per-file, no-console
/**
 * request-scope.ts — Request-scoped services with isolation
 *
 * Demonstrates: SCOPE.REQUEST, withRequestScope(), per-request instances
 * Run: node packages/di/examples/request-scope.ts
 */

import { Container, Injectable, Module, SCOPE } from '../src/index.ts';

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------
// Singleton — shared across all requests
class SessionManager extends Injectable({ scope: SCOPE.SINGLETON }) {
  readonly #sessionCount = { value: 0 };

  public newSession(): number {
    this.#sessionCount.value += 1;
    return this.#sessionCount.value;
  }
}

// Request-scoped — one instance per withRequestScope() call
class RequestContext extends Injectable({
  scope: SCOPE.REQUEST,
  inject: [['sessionManager', SessionManager]],
}) {
  readonly #requestId: number;

  public constructor(sessionManager: SessionManager) {
    super(sessionManager);
    this.#requestId = sessionManager.newSession();
  }

  public get requestId(): number {
    return this.#requestId;
  }
}

// Request-scoped service depending on another request-scoped service
class RequestLogger extends Injectable({
  scope: SCOPE.REQUEST,
  inject: [['ctx', RequestContext]],
}) {
  public log(message: string): void {
    console.log(`[Request-${this.inject.ctx.requestId}] ${message}`);
  }
}

class AppModule extends Module({
  providers: [SessionManager, RequestContext, RequestLogger],
}) {}

// ---------------------------------------------------------------------------
// Simulate multiple requests
// ---------------------------------------------------------------------------
const container = new Container(AppModule);
await container.start();

const handleRequest = async (action: string): Promise<void> => {
  await container.withRequestScope(() => {
    const logger = container.resolve(RequestLogger);
    logger.log(`Handling: ${action}`);
    // Same request-scoped instance within this request
    const logger2 = container.resolve(RequestLogger);
    logger2.log(`Same logger instance? ${logger === logger2}`);
  });
};

console.log('[request-scope] Simulating 3 concurrent requests...\n');

await Promise.all([
  handleRequest('GET /users'),
  handleRequest('POST /orders'),
  handleRequest('GET /products'),
]);

// Singleton is always the same
const sessionManager = container.resolve(SessionManager);
console.log(`\n[request-scope] Total sessions created: ${sessionManager.newSession() - 1}`);
console.log(
  '[request-scope] Singleton SessionManager always same:',
  container.resolve(SessionManager) === sessionManager,
);

await container.stop();
