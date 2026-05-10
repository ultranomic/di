import { assertType, describe, test } from "vitest";
import { Injectable } from "./injectable.ts";
import { SCOPE } from "./scope.ts";

class ConfigService extends Injectable() {
  public getDbUrl(): string {
    return "postgres://localhost:5432/mydb";
  }
}

class DatabaseService extends Injectable({
  inject: [["config", ConfigService]],
}) {
  public connect(): string {
    return this.inject.config.getDbUrl();
  }
}

class CacheService extends Injectable({
  inject: [
    ["db", DatabaseService],
    ["config", ConfigService],
  ],
}) {
  public get(): string {
    return this.inject.db.connect() + this.inject.config.getDbUrl();
  }
}

class TransientService extends Injectable({
  scope: SCOPE.TRANSIENT,
}) {}

describe("Injectable types", () => {
  test("instance properties work correctly", () => {
    const db = new DatabaseService(new ConfigService());
    const url: string = db.inject.config.getDbUrl();
    assertType<string>(url);

    const cache = new CacheService(new DatabaseService(new ConfigService()), new ConfigService());
    const dbUrl: string = cache.inject.db.connect();
    const configUrl: string = cache.inject.config.getDbUrl();
    assertType<string>(dbUrl);
    assertType<string>(configUrl);
  });

  test("static properties are correct", () => {
    assertType<"SINGLETON">(ConfigService._scope);
    assertType<"SINGLETON">(DatabaseService._scope);
    assertType<"TRANSIENT">(TransientService._scope);
  });

  test("inject metadata is correct", () => {
    assertType<readonly []>(ConfigService._inject);
    assertType<readonly [typeof ConfigService]>(DatabaseService._inject);
  });

  test("empty inject shape rejects property access", () => {
    // @ts-expect-error -- no inject properties on no-config Injectable
    assertType(new ConfigService().inject.nonexistent);
  });
});
