import { type ModuleClass, Container } from "@ultranomic/di";
import { expect } from "vite-plus/test";
import { HonoService, VALIDATION_ERROR_MESSAGE } from "./hono-service.ts";

export const setupModule = async (moduleClass: ModuleClass) => {
  const container = new Container(moduleClass);
  await container.start();
  const app = container.resolve(HonoService).hono;
  return { container, app };
};

export const expectValidationFailed = (body: unknown) => {
  expect(body).toEqual({
    error: VALIDATION_ERROR_MESSAGE,
    issues: expect.arrayContaining([expect.objectContaining({ message: expect.any(String) })]),
  });
  const issues = (body as { issues: { message: string }[] }).issues;
  expect(issues.length).toBeGreaterThan(0);
  for (const issue of issues) {
    expect(issue.message).toBeTypeOf("string");
    expect(issue.message.length).toBeGreaterThan(0);
  }
};
