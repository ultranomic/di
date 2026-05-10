// oxlint-disable max-classes-per-file, no-console
/**
 * dynamic-options.ts — Options factory with ConfigService
 *
 * Demonstrates: HonoModule options factory, resolve() for config-driven setup
 * Run: node libs/di-hono/examples/dynamic-options.ts
 */

import { Container, Injectable, Module, SCOPE } from "@ultranomic/di";
import { Controller, HonoModule, HonoService, type HonoModuleOptions } from "../src/index.ts";

// ---------------------------------------------------------------------------
// 1. ConfigService provides runtime configuration
// ---------------------------------------------------------------------------
class ConfigService extends Injectable({ scope: SCOPE.SINGLETON }) {
  public readonly port = 3000;
  public readonly host = "0.0.0.0";
  public readonly appName = "My Hono App";
}

// ---------------------------------------------------------------------------
// 2. Simple controller
// ---------------------------------------------------------------------------
class HealthController extends Controller({
  path: "/health",
  inject: [["config", ConfigService]],
}) {
  public check = this.route({
    method: "GET",
    path: "/",
    handler: (c) => {
      return c.json({
        status: "ok",
        app: this.inject.config.appName,
        port: this.inject.config.port,
        host: this.inject.config.host,
      });
    },
  });
}

// ---------------------------------------------------------------------------
// 3. HonoModule with options factory — resolves ConfigService at startup
// ---------------------------------------------------------------------------
class HealthModule extends Module({
  providers: [HealthController, ConfigService],
  exports: [HealthController],
}) {}

class HttpModule extends HonoModule({
  options: (resolve): HonoModuleOptions => {
    const config = resolve(ConfigService);
    console.log(`[options factory] Resolved config: port=${config.port}, host=${config.host}`);
    return {
      port: config.port,
      host: config.host,
    };
  },
}) {}

class AppModule extends Module({
  imports: [HttpModule, HealthModule],
}) {}

const main = async (): Promise<void> => {
  const container = new Container(AppModule);
  await container.start();

  const app = container.resolve(HonoService).hono;

  // GET /health
  const res = await app.fetch(new Request("http://localhost/health"));
  const body = await res.json();
  console.log("GET /health →", body);

  await container.stop();
  console.log("[dynamic-options] Done — options factory resolved ConfigService dynamically.");
};

await main();
