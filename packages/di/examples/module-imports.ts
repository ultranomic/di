// oxlint-disable max-classes-per-file, no-console
/**
 * module-imports.ts — Multi-module DI with imports/exports
 *
 * Demonstrates: Module imports, exports, provider accessibility
 * Run: node libs/di/examples/module-imports.ts
 */

import { Container, Injectable, Module, SCOPE } from "../src/index.ts";

// ---------------------------------------------------------------------------
// Core Module — provides and exports ConfigService
// ---------------------------------------------------------------------------
class ConfigService extends Injectable({ scope: SCOPE.SINGLETON }) {
  public readonly env = "development";
  public getLogLevel(): string {
    return "info";
  }
}

class InternalService extends Injectable({ scope: SCOPE.SINGLETON }) {
  // NOT exported — private to CoreModule
  public readonly secret = "internal-123";
}

class CoreModule extends Module({
  providers: [ConfigService, InternalService],
  exports: [ConfigService],
}) {}

// ---------------------------------------------------------------------------
// Database Module — imports CoreModule to access ConfigService
// ---------------------------------------------------------------------------
class DatabaseService extends Injectable({
  scope: SCOPE.SINGLETON,
  inject: [["config", ConfigService]],
}) {
  public getInfo(): string {
    return `DB env=${this.inject.config.env} log=${this.inject.config.getLogLevel()}`;
  }
}

class DatabaseModule extends Module({
  providers: [DatabaseService],
  exports: [DatabaseService],
  imports: [CoreModule],
}) {}

// ---------------------------------------------------------------------------
// App Module — composes everything
// ---------------------------------------------------------------------------
class UserService extends Injectable({
  scope: SCOPE.SINGLETON,
  inject: [["db", DatabaseService]],
}) {
  public greet(): string {
    return `UserService using ${this.inject.db.getInfo()}`;
  }
}

class AppModule extends Module({
  providers: [UserService],
  imports: [DatabaseModule],
}) {}

// ---------------------------------------------------------------------------
// Resolve and use
// ---------------------------------------------------------------------------
const container = new Container(AppModule);
await container.start();

const user = container.resolve(UserService);
console.log(`[module-imports] ${user.greet()}`);

// Verify exported service is accessible
const db = container.resolve(DatabaseService);
console.log(`[module-imports] ${db.getInfo()}`);

// Verify InternalService is NOT accessible (not exported)
try {
  container.resolve(InternalService);
  console.log("[module-imports] ERROR: InternalService should not be resolvable");
} catch {
  console.log("[module-imports] InternalService correctly inaccessible (not exported)");
}

await container.stop();
