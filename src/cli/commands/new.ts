import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface ProjectTemplate {
  name: string;
  files: Record<string, string>;
}

function getPackageJsonContent(projectName: string): string {
  return JSON.stringify(
    {
      name: projectName,
      version: '1.0.0',
      type: 'module',
      main: './dist/index.ts',
      engines: {
        node: '>=24.0.0',
      },
      scripts: {
        build: 'tsc',
        dev: 'node --watch src/index.ts',
        start: 'node dist/index.ts',
      },
      dependencies: {
        '@ultranomic/voxel': 'latest',
        express: '5.0.0',
      },
      devDependencies: {
        '@types/express': '5.0.0',
        '@types/node': '22.0.0',
        typescript: '5.0.0',
      },
    },
    null,
    2,
  );
}

function getTsConfigContent(): string {
  return JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2024',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        outDir: './dist',
        rootDir: './src',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        declaration: true,
      },
      include: ['src/**/*'],
      exclude: ['node_modules', 'dist'],
    },
    null,
    2,
  );
}

function getIndexContent(): string {
  return `import { Container } from '@ultranomic/voxel/core'
import { ExpressAdapter } from '@ultranomic/voxel/express'
import { AppModule, UserController } from './app.ts'

const PORT = Number(process.env['PORT']) || 3000

async function bootstrap(): Promise<void> {
  const container = new Container()

  const appModule = new AppModule()
  appModule.register(container)

  const adapter = new ExpressAdapter(container)
  adapter.registerController(UserController)

  await adapter.listen(PORT)
  console.log(\`Server running on http://localhost:\${PORT}\`)
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
`;
}

function getAppModuleContent(): string {
  return `import { Module } from '@ultranomic/voxel/core'
import type { Request, Response } from 'express'
import { UserService } from './services/user.service.ts'

export class UserController {
  static readonly inject = {
    users: UserService
  } as const

  static readonly routes = [
    { method: 'GET', path: '/users', handler: 'list' },
    { method: 'GET', path: '/users/:id', handler: 'get' }
  ] as const

  constructor(private deps: typeof UserController.inject) {}

  async list(_req: Request, res: Response): Promise<void> {
    const users = await this.deps.users.findAll()
    res.json(users)
  }

  async get(req: Request, res: Response): Promise<void> {
    const user = await this.deps.users.findById(req.params.id as string)
    if (user === null) {
      res.status(404).json({ error: 'User not found' })
      return
    }
    res.json(user)
  }
}

export class AppModule extends Module {
  static readonly metadata = {
    providers: [UserService],
    exports: [UserService]
  } as const

  register(container: import('@ultranomic/voxel/core').ContainerInterface): void {
    container.register(UserService, (c) => {
      const deps = c.buildDeps(UserService.inject)
      return new UserService(deps)
    }).asSingleton()

    container.register(UserController, (c) => {
      const deps = c.buildDeps(UserController.inject)
      return new UserController(deps)
    })
  }
}
`;
}

function getUserServiceContent(): string {
  return `export class UserService {
  static readonly inject = {} as const

  constructor(_deps: typeof UserService.inject) {}

  async findAll(): Promise<Array<{ id: string; name: string }>> {
    return [
      { id: '1', name: 'John Doe' },
      { id: '2', name: 'Jane Smith' }
    ]
  }

  async findById(id: string): Promise<{ id: string; name: string } | null> {
    const users = await this.findAll()
    return users.find(u => u.id === id) ?? null
  }
}
`;
}

function getTemplateFiles(projectName: string): ProjectTemplate {
  return {
    name: projectName,
    files: {
      'package.json': getPackageJsonContent(projectName),
      'tsconfig.json': getTsConfigContent(),
      'src/index.ts': getIndexContent(),
      'src/app.ts': getAppModuleContent(),
      'src/services/user.service.ts': getUserServiceContent(),
    },
  };
}

export async function createProject(projectName: string, targetDir?: string): Promise<void> {
  if (!isValidProjectName(projectName)) {
    throw new Error(`Invalid project name "${projectName}". ` + `Use lowercase letters, numbers, and hyphens only.`);
  }

  const baseDir = targetDir ?? process.cwd();
  const projectDir = join(baseDir, projectName);
  const template = getTemplateFiles(projectName);

  await mkdir(projectDir, { recursive: true });
  await mkdir(join(projectDir, 'src', 'services'), { recursive: true });

  for (const [filePath, content] of Object.entries(template.files)) {
    const fullPath = join(projectDir, filePath);
    await writeFile(fullPath, content, 'utf-8');
  }
}

function isValidProjectName(name: string): boolean {
  return /^[a-z][a-z0-9-]*$/.test(name);
}
