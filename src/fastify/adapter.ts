import fastify, { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import type { ControllerConstructor, ResolverInterface, HttpMethod } from '../core/index.js';
import { joinPath } from '../core/utils/path.js';

export class FastifyAdapter {
  private readonly app: FastifyInstance;
  private readonly container: ResolverInterface;

  constructor(container: ResolverInterface) {
    this.container = container;
    this.app = fastify({
      routerOptions: {
        ignoreTrailingSlash: true,
      },
    });
  }

  getApp(): FastifyInstance {
    return this.app;
  }

  registerController(ControllerClass: ControllerConstructor): void {
    const metadata = ControllerClass.metadata;
    if (metadata?.routes === undefined) {
      return;
    }

    const basePath = metadata.basePath ?? '';

    for (const route of metadata.routes) {
      const fullPath = joinPath(basePath, route.path);
      const method = route.method.toLowerCase() as Lowercase<HttpMethod>;

      this.app.route({
        method: method.toUpperCase() as HttpMethod,
        url: fullPath,
        handler: async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
          try {
            const controller = this.container.resolve(ControllerClass);
            const handlerMethod = controller[route.handler as keyof typeof controller];

            if (typeof handlerMethod !== 'function') {
              await reply.status(500).send({ error: `Handler '${route.handler}' not found on controller` });
              return;
            }

            const result = (handlerMethod as (req: FastifyRequest, reply: FastifyReply) => unknown).call(
              controller,
              req,
              reply,
            );

            if (result instanceof Promise) {
              await result;
            }
          } catch (error) {
            await reply.status(500).send({
              error: error instanceof Error ? error.message : 'Internal server error',
            });
          }
        },
      });
    }
  }

  async listen(port: number): Promise<void> {
    await this.app.listen({ port, host: '0.0.0.0' });
  }

  async close(): Promise<void> {
    await this.app.close();
  }
}
