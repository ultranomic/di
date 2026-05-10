// oxlint-disable max-classes-per-file, no-console
/**
 * basic-usage.ts — Minimal DI example
 *
 * Demonstrates: Injectable, Module, Container, resolve
 * Run: node libs/di/examples/basic-usage.ts
 */

import { Container, Injectable, Module, SCOPE } from "../src/index.ts";

// ---------------------------------------------------------------------------
// 1. Define a standalone service (no dependencies)
// ---------------------------------------------------------------------------
class ConfigService extends Injectable({ scope: SCOPE.SINGLETON }) {
  public getDbUrl(): string {
    return "postgres://localhost:5432/mydb";
  }
}

class DefaultConfigService extends Injectable() {
  public getDefaultUrl(): string {
    return "postgres://localhost:5432/default";
  }
}

// ---------------------------------------------------------------------------
// 2. Define a service that depends on ConfigService
// ---------------------------------------------------------------------------
class DatabaseService extends Injectable({
  scope: SCOPE.SINGLETON,
  inject: [
    ["config", ConfigService],
    ["defaults", DefaultConfigService],
  ],
}) {
  public connect(): void {
    console.log(`[DatabaseService] Connecting to ${this.inject.config.getDbUrl()}`);
    console.log(`[DatabaseService] Default: ${this.inject.defaults.getDefaultUrl()}`);
  }
}

// ---------------------------------------------------------------------------
// 3. Declare a module that provides both services
// ---------------------------------------------------------------------------
class AppModule extends Module({
  providers: [ConfigService, DefaultConfigService, DatabaseService],
}) {}

// ---------------------------------------------------------------------------
// 4. Create a container, start, resolve, stop
// ---------------------------------------------------------------------------
const container = new Container(AppModule);
await container.start();

const db = container.resolve(DatabaseService);
db.connect();

// Verify singleton: same instance every time
const db2 = container.resolve(DatabaseService);
console.log(`[basic-usage] Same instance? ${db === db2}`); // true

await container.stop();
