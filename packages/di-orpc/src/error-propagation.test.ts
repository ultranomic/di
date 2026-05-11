import { Container, DIError, DI_ERROR_CODE, Injectable, Module, SCOPE } from '@ultranomic/di';
import { afterEach, describe, expect, it } from 'vite-plus/test';
import { OrpcModule } from './orpc-module.ts';
import { OrpcRouter } from './orpc-router.ts';
import { OrpcService } from './orpc-service.ts';
import { z } from 'zod';

let container: Container;

afterEach(async () => {
  if (container) await container.stop();
});

describe('Cross-package error propagation', () => {
  describe('DIError propagation through ORPC', () => {
    it('creates handler with error-throwing procedures', async () => {
      class TestRouter extends OrpcRouter({ path: 'test' }) {
        getValue = this.orpc
          .input(z.object({}))
          .output(z.object({ value: z.string() }))
          .handler(async () => {
            throw new DIError(DI_ERROR_CODE.MISSING_PROVIDER, 'Provider not found');
          });
      }

      class TestModule extends Module({
        imports: [OrpcModule()],
        providers: [TestRouter],
      }) {}

      container = new Container(TestModule);
      await container.start();
      const service = container.resolve(OrpcService);

      expect(service.handler).toBeDefined();
    });

    it('creates handler with SCOPE_VIOLATION throwing procedures', async () => {
      class TestRouter extends OrpcRouter({ path: 'test' }) {
        getValue = this.orpc
          .input(z.object({}))
          .output(z.object({ value: z.string() }))
          .handler(async () => {
            throw new DIError(DI_ERROR_CODE.SCOPE_VIOLATION, 'Scope violation');
          });
      }

      class TestModule extends Module({
        imports: [OrpcModule()],
        providers: [TestRouter],
      }) {}

      container = new Container(TestModule);
      await container.start();
      const service = container.resolve(OrpcService);

      expect(service.handler).toBeDefined();
    });
  });

  describe('Service resolution error propagation', () => {
    it('creates handler with failing service', async () => {
      class FailingService extends Injectable({ scope: SCOPE.SINGLETON }) {
        public getValue(): string {
          throw new Error('Service initialization failed');
        }
      }

      class TestRouter extends OrpcRouter({
        path: 'test',
        inject: [['service', FailingService]] as const,
      }) {
        getValue = this.orpc
          .input(z.object({}))
          .output(z.object({ value: z.string() }))
          .handler(async () => {
            return { value: this.inject.service.getValue() };
          });
      }

      class TestModule extends Module({
        imports: [OrpcModule()],
        providers: [FailingService, TestRouter],
      }) {}

      container = new Container(TestModule);
      await container.start();
      const service = container.resolve(OrpcService);

      expect(service.handler).toBeDefined();
    });
  });
});
