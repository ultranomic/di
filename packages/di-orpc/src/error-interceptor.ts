import { DIError } from "@ultranomic/di";
import { ORPCError } from "@orpc/server";
import type { ErrorInterceptor } from "./types.ts";

export const defaultErrorInterceptor: ErrorInterceptor = (error, _context) => {
  if (error instanceof ORPCError) {
    return error;
  }

  if (error instanceof DIError) {
    return new ORPCError("INTERNAL_SERVER_ERROR", {
      message: `[${error.code}] ${error.message}`,
    });
  }

  if (error instanceof Error) {
    return new ORPCError("INTERNAL_SERVER_ERROR", {
      message: error.message,
    });
  }

  return new ORPCError("INTERNAL_SERVER_ERROR", {
    message: "Unknown error",
  });
};

export const createErrorInterceptor = (custom?: ErrorInterceptor): ErrorInterceptor => {
  if (!custom) return defaultErrorInterceptor;

  return async (error: unknown, context: unknown): Promise<ORPCError<string, unknown>> => {
    try {
      return await custom(error, context);
    } catch (caught) {
      return defaultErrorInterceptor(caught, context);
    }
  };
};
