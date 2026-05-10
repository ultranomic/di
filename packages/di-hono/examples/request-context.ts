// oxlint-disable max-classes-per-file, no-console
/**
 * request-context.ts — RequestContext usage in request handlers
 *
 * Demonstrates: RequestContext.get() inside handlers, per-request isolation
 * Run: node libs/di-hono/examples/request-context.ts
 */

import { Container, Injectable, Module, SCOPE } from "@ultranomic/di";
import { Controller, HonoModule, HonoService, RequestContext } from "../src/index.ts";

// ---------------------------------------------------------------------------
// 1. Singleton service that reads RequestContext per-request
// ---------------------------------------------------------------------------
class AuditService extends Injectable({ scope: SCOPE.SINGLETON }) {
  #log: string[] = [];

  public record(action: string): void {
    const ctx = RequestContext.get();
    const requestId = ctx?.req.header("x-request-id") ?? "unknown";
    const entry = `[${requestId}] ${action}`;
    this.#log.push(entry);
    console.log(`[AuditService] ${entry}`);
  }

  public getLog(): readonly string[] {
    return this.#log;
  }
}

// ---------------------------------------------------------------------------
// 2. Controller uses RequestContext inside handlers
// ---------------------------------------------------------------------------
class DemoController extends Controller({
  path: "/demo",
  inject: [["audit", AuditService]],
}) {
  public handle = this.route({
    method: "GET",
    path: "/",
    handler: (c) => {
      const requestId = c.req.header("x-request-id") ?? "unknown";
      this.inject.audit.record(`Request handled: ${requestId}`);
      return c.json({ requestId, message: "Check console for per-request logs" });
    },
  });
}

// ---------------------------------------------------------------------------
// 3. Module + run
// ---------------------------------------------------------------------------
class DemoModule extends Module({
  providers: [AuditService, DemoController],
  exports: [AuditService, DemoController],
}) {}

class HttpModule extends HonoModule() {}

class AppModule extends Module({
  imports: [HttpModule, DemoModule],
}) {}

const main = async (): Promise<void> => {
  const container = new Container(AppModule);
  await container.start();

  const app = container.resolve(HonoService).hono;

  // Request 1
  console.log("--- Request 1 (x-request-id: req-001) ---");
  const res1 = await app.fetch(
    new Request("http://localhost/demo", {
      headers: { "x-request-id": "req-001" },
    }),
  );
  console.log("Response:", await res1.json());

  // Request 2
  console.log("--- Request 2 (x-request-id: req-002) ---");
  const res2 = await app.fetch(
    new Request("http://localhost/demo", {
      headers: { "x-request-id": "req-002" },
    }),
  );
  console.log("Response:", await res2.json());

  console.log("Audit log:", container.resolve(AuditService).getLog());
  await container.stop();
  console.log("[request-context] Done — RequestContext provided per-request context.");
};

await main();
