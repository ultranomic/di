// oxlint-disable max-classes-per-file, no-console
/**
 * module-re-exports.ts — Module re-exports: exporting imported modules
 *
 * Demonstrates: ModuleClass in exports preserves the ModuleClass entry in _exports
 * Run: node libs/di/examples/module-re-exports.ts
 */

import { Container, Injectable, Module, SCOPE } from "../src/index.ts";

// ---------------------------------------------------------------------------
// Deep Module — provides and exports DeepService
// ---------------------------------------------------------------------------
class DeepService extends Injectable({ scope: SCOPE.SINGLETON }) {
  public getValue(): string {
    return "deep-value";
  }
}

class DeepModule extends Module({
  providers: [DeepService],
  exports: [DeepService],
}) {}

// ---------------------------------------------------------------------------
// Mid Module — imports DeepModule, re-exports it + own MidService
// ---------------------------------------------------------------------------
class MidService extends Injectable({ scope: SCOPE.SINGLETON }) {
  public getValue(): string {
    return "mid-value";
  }
}

class MidModule extends Module({
  providers: [MidService],
  imports: [DeepModule],
  exports: [DeepModule, MidService], // Re-export DeepModule + own service
}) {}
// MidModule._exports → [DeepModule, MidService] (preserves ModuleClass entries)

// ---------------------------------------------------------------------------
// App Module — imports only MidModule, gets access to both services
// ---------------------------------------------------------------------------
class AppModule extends Module({
  imports: [MidModule],
}) {}

// ---------------------------------------------------------------------------
// Resolve and verify
// ---------------------------------------------------------------------------
const container = new Container(AppModule);
await container.start();

const deep = container.resolve(DeepService);
console.log(`[module-re-exports] DeepService: ${deep.getValue()}`);

const mid = container.resolve(MidService);
console.log(`[module-re-exports] MidService: ${mid.getValue()}`);

// Verify MidModule._exports preserves DeepModule entry
const exportsList = MidModule._exports.map((e) => e.name).join(", ");
console.log(`[module-re-exports] MidModule._exports: [${exportsList}]`);

await container.stop();
