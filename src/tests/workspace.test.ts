
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { Workspace } from '../workspace/Workspace.js';
import { WorkspaceManager } from '../workspace/WorkspaceManager.js';

const temporaryDirectories: string[] = [];

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), 'mobile-dev-agent-')
  );

  temporaryDirectories.push(directory);

  return directory;
}

async function initializeGitRepository(
  directory: string
): Promise<void> {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');

  const execFileAsync = promisify(execFile);

  await execFileAsync('git', [
    '-C',
    directory,
    'init'
  ]);
}

afterEach(async () => {
  while (temporaryDirectories.length > 0) {
    const directory = temporaryDirectories.pop();

    if (!directory) {
      continue;
    }

    await rm(directory, {
      recursive: true,
      force: true
    });
  }
});

describe('Workspace', () => {
  it('creates a workspace from a path', () => {
    const workspace = new Workspace({
      path: '/projects/example'
    });

    expect(workspace.path).toBe('/projects/example');
    expect(workspace.name).toBe('example');
  });

  it('uses a custom workspace name when provided', () => {
    const workspace = new Workspace({
      path: '/projects/example',
      name: 'Example Project'
    });

    expect(workspace.name).toBe('Example Project');
  });

  it('initializes default Git metadata', () => {
    const workspace = new Workspace({
      path: '/projects/example'
    });

    expect(workspace.git).toEqual({
      isRepository: false,
      branch: undefined,
      remote: undefined
    });
  });

  it('stores Git metadata', () => {
    const workspace = new Workspace({
      path: '/projects/example',
      git: {
        isRepository: true,
        branch: 'main',
        remote: 'origin'
      }
    });

    expect(workspace.git).toEqual({
      isRepository: true,
      branch: 'main',
      remote: 'origin'
    });
  });

  it('stores workspace configuration', () => {
    const workspace = new Workspace({
      path: '/projects/example',
      config: {
        language: 'typescript',
        framework: 'svelte'
      }
    });

    expect(workspace.config).toEqual({
      language: 'typescript',
      framework: 'svelte'
    });
  });
});

describe('WorkspaceManager', () => {
  it('registers a workspace', () => {
    const manager = new WorkspaceManager();

    const workspace = manager.register({
      path: '/projects/example',
      name: 'Example'
    });

    expect(manager.size).toBe(1);
    expect(workspace.name).toBe('Example');
  });

  it('returns an existing workspace for duplicate paths', () => {
    const manager = new WorkspaceManager();

    const first = manager.register({
      path: '/projects/example',
      name: 'Example'
    });

    const second = manager.register({
      path: '/projects/example',
      name: 'Another Name'
    });

    expect(second).toBe(first);
    expect(manager.size).toBe(1);
  });

  it('finds a workspace by path', () => {
    const manager = new WorkspaceManager();

    const workspace = manager.register({
      path: '/projects/example'
    });

    expect(manager.getByPath('/projects/example')).toBe(workspace);
  });

  it('finds a workspace by name', () => {
    const manager = new WorkspaceManager();

    const workspace = manager.register({
      path: '/projects/example',
      name: 'Example'
    });

    expect(manager.getByName('Example')).toBe(workspace);
  });

  it('returns undefined for an unknown workspace', () => {
    const manager = new WorkspaceManager();

    expect(manager.getByPath('/projects/missing')).toBeUndefined();
    expect(manager.getByName('Missing')).toBeUndefined();
  });

  it('lists registered workspaces', () => {
    const manager = new WorkspaceManager();

    manager.register({
      path: '/projects/one',
      name: 'One'
    });

    manager.register({
      path: '/projects/two',
      name: 'Two'
    });

    expect(manager.list()).toHaveLength(2);
  });

  it('checks whether a workspace exists', () => {
    const manager = new WorkspaceManager();

    manager.register({
      path: '/projects/example'
    });

    expect(manager.has('/projects/example')).toBe(true);
    expect(manager.has('/projects/missing')).toBe(false);
  });

  it('removes a workspace', () => {
    const manager = new WorkspaceManager();

    manager.register({
      path: '/projects/example'
    });

    expect(manager.remove('/projects/example')).toBe(true);
    expect(manager.size).toBe(0);
    expect(manager.has('/projects/example')).toBe(false);
  });

  it('returns false when removing an unknown workspace', () => {
    const manager = new WorkspaceManager();

    expect(manager.remove('/projects/missing')).toBe(false);
  });

  it('clears all workspaces', () => {
    const manager = new WorkspaceManager();

    manager.register({
      path: '/projects/one'
    });

    manager.register({
      path: '/projects/two'
    });

    manager.clear();

    expect(manager.size).toBe(0);
    expect(manager.list()).toEqual([]);
  });
});

describe('WorkspaceManager filesystem validation', () => {
  it('detects a valid directory', async () => {
    const directory = await createTemporaryDirectory();
    const manager = new WorkspaceManager();

    const result = await manager.validate(directory);

    expect(result).toEqual({
      exists: true,
      isDirectory: true,
      isGitRepository: false
    });
  });

  it('detects a missing path', async () => {
    const directory = await createTemporaryDirectory();
    const missingPath = path.join(directory, 'missing');
    const manager = new WorkspaceManager();

    const result = await manager.validate(missingPath);

    expect(result).toEqual({
      exists: false,
      isDirectory: false,
      isGitRepository: false
    });
  });

  it('detects a file instead of a directory', async () => {
    const directory = await createTemporaryDirectory();
    const filePath = path.join(directory, 'file.txt');

    await writeFile(filePath, 'test');

    const manager = new WorkspaceManager();
    const result = await manager.validate(filePath);

    expect(result).toEqual({
      exists: true,
      isDirectory: false,
      isGitRepository: false
    });
  });

  it('detects a Git repository', async () => {
    const directory = await createTemporaryDirectory();

    await initializeGitRepository(directory);

    const manager = new WorkspaceManager();
    const result = await manager.validate(directory);

    expect(result.exists).toBe(true);
    expect(result.isDirectory).toBe(true);
    expect(result.isGitRepository).toBe(true);
  });
});

describe('WorkspaceManager Git integration', () => {
  it('identifies a Git repository', async () => {
    const directory = await createTemporaryDirectory();

    await initializeGitRepository(directory);

    const manager = new WorkspaceManager();
    const git = await manager.inspectGit(directory);

    expect(git.isRepository).toBe(true);
  });

  it('identifies a non-Git directory', async () => {
    const directory = await createTemporaryDirectory();
    const manager = new WorkspaceManager();

    const git = await manager.inspectGit(directory);

    expect(git.isRepository).toBe(false);
  });

  it('registers a validated workspace', async () => {
    const directory = await createTemporaryDirectory();
    const manager = new WorkspaceManager();

    const workspace = await manager.registerValidated({
      path: directory
    });

    expect(workspace.path).toBe(directory);
    expect(manager.getByPath(directory)).toBe(workspace);
  });

  it('rejects a missing workspace path', async () => {
    const directory = await createTemporaryDirectory();
    const missingPath = path.join(directory, 'missing');
    const manager = new WorkspaceManager();

    await expect(
      manager.registerValidated({
        path: missingPath
      })
    ).rejects.toThrow(
      `Workspace path does not exist: ${missingPath}`
    );
  });
});