// oxlint-disable max-classes-per-file, no-console
/**
 * transient-scope.ts — Transient-scoped services: fresh instance per resolve
 *
 * Demonstrates: SCOPE.TRANSIENT, new instance on every resolve(), transient depending on singleton
 * Run: node libs/di/examples/transient-scope.ts
 */

import { Container, Injectable, Module, SCOPE } from "../src/index.ts";

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------
// Singleton — shared across all resolves
class CounterService extends Injectable({ scope: SCOPE.SINGLETON }) {
  readonly #count = { value: 0 };

  public next(): number {
    this.#count.value += 1;
    return this.#count.value;
  }
}

// Transient — fresh instance on every resolve()
class TaskRunner extends Injectable({
  scope: SCOPE.TRANSIENT,
  inject: [["counter", CounterService]],
}) {
  readonly #taskId: number;

  public constructor(counter: CounterService) {
    super(counter);
    this.#taskId = counter.next();
  }

  public get taskId(): number {
    return this.#taskId;
  }
}

class AppModule extends Module({
  providers: [CounterService, TaskRunner],
}) {}

// ---------------------------------------------------------------------------
// Demonstrate transient vs singleton behavior
// ---------------------------------------------------------------------------
const container = new Container(AppModule);
await container.start();

// Each resolve() returns a fresh transient instance
const task1 = container.resolve(TaskRunner);
const task2 = container.resolve(TaskRunner);
const task3 = container.resolve(TaskRunner);

console.log("[transient-scope] task1.taskId:", task1.taskId); // 1
console.log("[transient-scope] task2.taskId:", task2.taskId); // 2
console.log("[transient-scope] task3.taskId:", task3.taskId); // 3

console.log("[transient-scope] Fresh instance each resolve? task1 !== task2:", task1 !== task2); // true
console.log("[transient-scope] Fresh instance each resolve? task2 !== task3:", task2 !== task3); // true

// Singleton is always the same instance
const counter1 = container.resolve(CounterService);
const counter2 = container.resolve(CounterService);
console.log(
  "[transient-scope] Singleton always same? counter1 === counter2:",
  counter1 === counter2,
); // true

await container.stop();
