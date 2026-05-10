import { describe, it, expect } from "vitest";
import { DIError } from "@ultranomic/di";
import { ORPCError } from "@orpc/server";
import { defaultErrorInterceptor, createErrorInterceptor } from "./error-interceptor.js";

describe("defaultErrorInterceptor", () => {
  it("maps DIError to ORPCError with INTERNAL_SERVER_ERROR", () => {
    const diError = new DIError("MISSING_PROVIDER", "Provider not found");
    const result = defaultErrorInterceptor(diError, {});

    expect(result).toBeInstanceOf(ORPCError);
    expect(result.code).toBe("INTERNAL_SERVER_ERROR");
    expect(result.message).toBe("[MISSING_PROVIDER] Provider not found");
  });

  it("passes through ORPCError unchanged", () => {
    const orpcError = new ORPCError("NOT_FOUND", { message: "Not found" });
    const result = defaultErrorInterceptor(orpcError, {});

    expect(result).toBe(orpcError);
  });

  it("maps generic Error to ORPCError with INTERNAL_SERVER_ERROR", () => {
    const error = new Error("Something went wrong");
    const result = defaultErrorInterceptor(error, {});

    expect(result).toBeInstanceOf(ORPCError);
    expect(result.code).toBe("INTERNAL_SERVER_ERROR");
    expect(result.message).toBe("Something went wrong");
  });

  it("maps non-Error to ORPCError with Unknown error message", () => {
    const result = defaultErrorInterceptor("string error", {});

    expect(result).toBeInstanceOf(ORPCError);
    expect(result.code).toBe("INTERNAL_SERVER_ERROR");
    expect(result.message).toBe("Unknown error");
  });

  it("maps null to ORPCError with Unknown error message", () => {
    const result = defaultErrorInterceptor(null, {});

    expect(result).toBeInstanceOf(ORPCError);
    expect(result.code).toBe("INTERNAL_SERVER_ERROR");
    expect(result.message).toBe("Unknown error");
  });

  it("maps undefined to ORPCError with Unknown error message", () => {
    const result = defaultErrorInterceptor(undefined, {});

    expect(result).toBeInstanceOf(ORPCError);
    expect(result.code).toBe("INTERNAL_SERVER_ERROR");
    expect(result.message).toBe("Unknown error");
  });

  it("maps number to ORPCError with Unknown error message", () => {
    const result = defaultErrorInterceptor(42, {});

    expect(result).toBeInstanceOf(ORPCError);
    expect(result.code).toBe("INTERNAL_SERVER_ERROR");
    expect(result.message).toBe("Unknown error");
  });
});

describe("createErrorInterceptor", () => {
  it("returns defaultErrorInterceptor when no custom provided", () => {
    const interceptor = createErrorInterceptor();
    expect(interceptor).toBe(defaultErrorInterceptor);
  });

  it("returns defaultErrorInterceptor when undefined provided", () => {
    const interceptor = createErrorInterceptor(undefined);
    expect(interceptor).toBe(defaultErrorInterceptor);
  });

  it("uses custom interceptor when it returns ORPCError", async () => {
    const custom: typeof import("./types.ts").ErrorInterceptor = (error, _context) => {
      if (error instanceof Error && error.message === "custom") {
        return new ORPCError("BAD_REQUEST", { message: "Custom handled" });
      }
      throw new Error("not handled");
    };
    const interceptor = createErrorInterceptor(custom);
    const result = await interceptor(new Error("custom"), {});

    expect(result).toBeInstanceOf(ORPCError);
    expect(result.code).toBe("BAD_REQUEST");
    expect(result.message).toBe("Custom handled");
  });

  it("falls back to default when custom throws non-ORPCError", async () => {
    const custom: typeof import("./types.ts").ErrorInterceptor = (_error, _context) => {
      throw new Error("custom failed");
    };
    const interceptor = createErrorInterceptor(custom);
    const result = await interceptor(new DIError("MISSING_PROVIDER", "test"), {});

    expect(result).toBeInstanceOf(ORPCError);
    expect(result.code).toBe("INTERNAL_SERVER_ERROR");
    expect(result.message).toBe("custom failed");
  });

  it("returns ORPCError when custom throws ORPCError", async () => {
    const thrownError = new ORPCError("FORBIDDEN", { message: "Access denied" });
    const custom: typeof import("./types.ts").ErrorInterceptor = (_error, _context) => {
      throw thrownError;
    };
    const interceptor = createErrorInterceptor(custom);
    const result = await interceptor(new Error("input"), {});

    expect(result).toBe(thrownError);
  });

  it("custom receives error and context arguments", async () => {
    let receivedError: unknown;
    let receivedContext: unknown;
    const custom: typeof import("./types.ts").ErrorInterceptor = (error, context) => {
      receivedError = error;
      receivedContext = context;
      return new ORPCError("BAD_REQUEST", { message: "ok" });
    };
    const interceptor = createErrorInterceptor(custom);
    const inputError = new Error("test");
    const inputContext = { requestId: "123" };
    await interceptor(inputError, inputContext);

    expect(receivedError).toBe(inputError);
    expect(receivedContext).toBe(inputContext);
  });
});
