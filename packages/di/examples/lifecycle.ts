// oxlint-disable max-classes-per-file, no-console
/**
 * lifecycle.ts — Container lifecycle hooks (onStart / onStop)
 *
 * Demonstrates: onStart(container), onStop(container), dependency ordering
 * Run: node packages/di/examples/lifecycle.ts
 */

import { Container, Injectable, Module, SCOPE } from "../src/index.ts";

// ---------------------------------------------------------------------------
// Services with lifecycle hooks
// ---------------------------------------------------------------------------
class ConfigService extends Injectable({ scope: SCOPE.SINGLETON }) {
  public readonly env = "production";

  public async onStart(container: Container): Promise<void> {
    console.log("[lifecycle] ConfigService.onStart — loading configuration...");
    await Promise.resolve();
    console.log("[lifecycle] ConfigService.onStart — configuration loaded");
  }

  public onStop(container: Container) {
    console.log("[lifecycle] ConfigService.onStop — configuration flushed");
  }
}

class DatabaseService extends Injectable({
  scope: SCOPE.SINGLETON,
  inject: [["config", ConfigService]],
}) {
  public async onStart(container: Container): Promise<void> {
    console.log(
      `[lifecycle] DatabaseService.onStart — connecting (env=${this.inject.config.env})...`,
    );
    await Promise.resolve();
    console.log("[lifecycle] DatabaseService.onStart — database connected");
  }

  public onStop(container: Container) {
    console.log("[lifecycle] DatabaseService.onStop — closing connections");
  }
}

class CacheService extends Injectable({
  scope: SCOPE.SINGLETON,
  inject: [["config", ConfigService]],
}) {
  public async onStart(container: Container): Promise<void> {
    console.log(
      `[lifecycle] CacheService.onStart — warming cache (env=${this.inject.config.env})...`,
    );
    await Promise.resolve();
    console.log("[lifecycle] CacheService.onStart — cache ready");
  }

  public onStop(container: Container) {
    console.log("[lifecycle] CacheService.onStop — cache invalidated");
  }
}

class DatabaseModule extends Module({
  providers: [DatabaseService],
  exports: [DatabaseService],
}) {}

class AppModule extends Module({
  imports: [DatabaseModule],
  providers: [ConfigService, CacheService],
}) {}

// ---------------------------------------------------------------------------
// Run lifecycle
// ---------------------------------------------------------------------------
console.log("[lifecycle] === Starting container ===\n");

const container = new Container(AppModule);
await container.start();

console.log("\n[lifecycle] === Container started, all services ready ===\n");

console.log("[lifecycle] === Stopping container ===\n");
await container.stop();

console.log("\n[lifecycle] === Container stopped ===");
