import { access, mkdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createProject, type ProjectTemplate } from './commands/new.ts';

describe('createProject', () => {
  const testDir = join(process.cwd(), 'test-projects');

  beforeEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('should create project directory with all files', async () => {
    await createProject('my-app', testDir);

    const projectPath = join(testDir, 'my-app');
    await expect(access(projectPath)).resolves.toBeUndefined();
    await expect(access(join(projectPath, 'package.json'))).resolves.toBeUndefined();
    await expect(access(join(projectPath, 'tsconfig.json'))).resolves.toBeUndefined();
    await expect(access(join(projectPath, 'src', 'index.ts'))).resolves.toBeUndefined();
    await expect(access(join(projectPath, 'src', 'app.ts'))).resolves.toBeUndefined();
    await expect(access(join(projectPath, 'src', 'services', 'user.service.ts'))).resolves.toBeUndefined();
  });

  it('should create valid package.json with project name', async () => {
    await createProject('test-project', testDir);

    const packageJsonPath = join(testDir, 'test-project', 'package.json');
    const content = await readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(content) as { name: string };

    expect(packageJson.name).toBe('test-project');
  });

  it('should throw error for invalid project name with uppercase', async () => {
    await expect(createProject('MyApp', testDir)).rejects.toThrow('Invalid project name "MyApp"');
  });

  it('should throw error for invalid project name with spaces', async () => {
    await expect(createProject('my app', testDir)).rejects.toThrow('Invalid project name "my app"');
  });

  it('should throw error for invalid project name starting with number', async () => {
    await expect(createProject('123-app', testDir)).rejects.toThrow('Invalid project name "123-app"');
  });

  it('should throw error for invalid project name with special characters', async () => {
    await expect(createProject('my@app', testDir)).rejects.toThrow('Invalid project name "my@app"');
  });

  it('should accept valid project names', async () => {
    await createProject('my-app', testDir);
    await createProject('myapp', testDir);
    await createProject('my-app-123', testDir);
    await createProject('a', testDir);

    const dirs = ['my-app', 'myapp', 'my-app-123', 'a'];
    for (const dir of dirs) {
      await expect(access(join(testDir, dir))).resolves.toBeUndefined();
    }
  });

  it('should create tsconfig.json with correct configuration', async () => {
    await createProject('config-test', testDir);

    const tsconfigPath = join(testDir, 'config-test', 'tsconfig.json');
    const content = await readFile(tsconfigPath, 'utf-8');
    const tsconfig = JSON.parse(content) as { compilerOptions: { target: string; strict: boolean } };

    expect(tsconfig.compilerOptions.target).toBe('ES2024');
    expect(tsconfig.compilerOptions.strict).toBe(true);
  });

  it('should create src/index.ts with correct imports', async () => {
    await createProject('import-test', testDir);

    const indexPath = join(testDir, 'import-test', 'src', 'index.ts');
    const content = await readFile(indexPath, 'utf-8');

    expect(content).toContain('@ultranomic/voxel/core');
    expect(content).toContain('@ultranomic/voxel/express');
    expect(content).toContain('AppModule');
  });

  it('should create src/app.ts with controller and service', async () => {
    await createProject('app-test', testDir);

    const appPath = join(testDir, 'app-test', 'src', 'app.ts');
    const content = await readFile(appPath, 'utf-8');

    expect(content).toContain('UserController');
    expect(content).toContain('UserService');
    expect(content).toContain('AppModule');
  });

  it('should create user service with expected methods', async () => {
    await createProject('service-test', testDir);

    const servicePath = join(testDir, 'service-test', 'src', 'services', 'user.service.ts');
    const content = await readFile(servicePath, 'utf-8');

    expect(content).toContain('findAll');
    expect(content).toContain('findById');
  });

  it('should use current working directory when targetDir is not provided', async () => {
    // Save original cwd
    const originalCwd = process.cwd();
    const customCwd = join(testDir, 'cwd-test');

    try {
      // Create and change to custom directory
      await mkdir(customCwd, { recursive: true });
      process.chdir(customCwd);

      // Call createProject without targetDir (undefined)
      await createProject('no-target-dir-project');

      // Verify project was created in the current working directory
      const projectPath = join(customCwd, 'no-target-dir-project');
      await expect(access(projectPath)).resolves.toBeUndefined();
      await expect(access(join(projectPath, 'package.json'))).resolves.toBeUndefined();
    } finally {
      // Restore original cwd
      process.chdir(originalCwd);
    }
  });

  it('should use current working directory when targetDir is explicitly undefined', async () => {
    const originalCwd = process.cwd();
    const customCwd = join(testDir, 'undefined-test');

    try {
      await mkdir(customCwd, { recursive: true });
      process.chdir(customCwd);

      // Call with explicitly undefined targetDir
      await createProject('undefined-target-project', undefined);

      const projectPath = join(customCwd, 'undefined-target-project');
      await expect(access(projectPath)).resolves.toBeUndefined();
      await expect(access(join(projectPath, 'src', 'index.ts'))).resolves.toBeUndefined();
    } finally {
      process.chdir(originalCwd);
    }
  });
});

describe('ProjectTemplate type', () => {
  it('should have correct structure', () => {
    const template: ProjectTemplate = {
      name: 'test',
      files: {
        'package.json': '{}',
      },
    };

    expect(template.name).toBe('test');
    expect(template.files['package.json']).toBe('{}');
  });
});
