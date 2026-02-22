import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export interface ProjectTemplate {
  name: string
  files: Record<string, string>
}

function getPackageJsonContent(projectName: string): string {
  return JSON.stringify({
    name: projectName,
    version: '1.0.0',
    type: 'module',
    main: './dist/index.js',
    scripts: {
      build: 'tsc',
      dev: 'tsx watch src/index.ts',
      start: 'node dist/index.js'
    },
    dependencies: {
      '@voxeljs/core': 'workspace:*',
      '@voxeljs/express': 'workspace:*',
      express: '^5.0.0'
    },
    devDependencies: {
      '@types/express': '^5.0.0',
      '@types/node': '^22.0.0',
      tsx: '^4.0.0',
      typescript: '^5.0.0'
    }
  }, null, 2)
}

function getTsConfigContent(): string {
  return JSON.stringify({
    compilerOptions: {
      target: 'ES2024',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      outDir: './dist',
      rootDir: './src',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      declaration: true
    },
    include: ['src/**/*'],
    exclude: ['node_modules', 'dist']
  }, null, 2)
}

function getIndexContent(): string {
  return `import { Container } from '@voxeljs/core'
import { createExpressAdapter } from '@voxeljs/express'
import { AppModule } from './app.js'

const container = new Container()
const app = createExpressAdapter(container, [AppModule])

const port = Number(process.env['PORT']) || 3000
app.listen(port, () => {
  console.log(\`Server running at http://localhost:\${port}\`)
})
`
}

function getAppModuleContent(): string {
  return `import { Controller, Module } from '@voxeljs/core'
import type { Request, Response } from 'express'
import { UserService } from './services/user.service.js'

class UserController {
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

@Module({
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService]
})
export class AppModule {}
`
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
`
}

function getTemplateFiles(projectName: string): ProjectTemplate {
  return {
    name: projectName,
    files: {
      'package.json': getPackageJsonContent(projectName),
      'tsconfig.json': getTsConfigContent(),
      'src/index.ts': getIndexContent(),
      'src/app.ts': getAppModuleContent(),
      'src/services/user.service.ts': getUserServiceContent()
    }
  }
}

export async function createProject(projectName: string, targetDir?: string): Promise<void> {
  if (!isValidProjectName(projectName)) {
    throw new Error(
      `Invalid project name "${projectName}". ` +
      `Use lowercase letters, numbers, and hyphens only.`
    )
  }

  const baseDir = targetDir ?? process.cwd()
  const projectDir = join(baseDir, projectName)
  const template = getTemplateFiles(projectName)

  await mkdir(projectDir, { recursive: true })
  await mkdir(join(projectDir, 'src', 'services'), { recursive: true })

  for (const [filePath, content] of Object.entries(template.files)) {
    const fullPath = join(projectDir, filePath)
    await writeFile(fullPath, content, 'utf-8')
  }
}

function isValidProjectName(name: string): boolean {
  return /^[a-z][a-z0-9-]*$/.test(name)
}
