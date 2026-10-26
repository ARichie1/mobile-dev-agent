import { execFile } from 'node:child_process';
import { access, stat } from 'node:fs/promises';
import { promisify } from 'node:util';

import {
  Workspace,
  type WorkspaceGit,
  type WorkspaceOptions
} from './Workspace.js';

const execFileAsync = promisify(execFile);

export interface WorkspaceValidation {
  exists: boolean;
  isDirectory: boolean;
  isGitRepository: boolean;
}

export class WorkspaceManager {
  private readonly workspaces = new Map<string, Workspace>();

  register(options: WorkspaceOptions): Workspace {
    const workspace = new Workspace(options);
    const existing = this.workspaces.get(workspace.path);

    if (existing) {
      return existing;
    }

    this.workspaces.set(workspace.path, workspace);

    return workspace;
  }

  async validate(path: string): Promise<WorkspaceValidation> {
    try {
      await access(path);

      const information = await stat(path);

      if (!information.isDirectory()) {
        return {
          exists: true,
          isDirectory: false,
          isGitRepository: false
        };
      }

      const git = await this.inspectGit(path);

      return {
        exists: true,
        isDirectory: true,
        isGitRepository: git.isRepository
      };
    } catch {
      return {
        exists: false,
        isDirectory: false,
        isGitRepository: false
      };
    }
  }

  async inspectGit(path: string): Promise<WorkspaceGit> {
    try {
      await execFileAsync('git', [
        '-C',
        path,
        'rev-parse',
        '--is-inside-work-tree'
      ]);

      const branch = await this.getGitValue(path, [
        'rev-parse',
        '--abbrev-ref',
        'HEAD'
      ]);

      const remote = await this.getGitValue(path, [
        'remote',
        'get-url',
        'origin'
      ]);

      return {
        isRepository: true,
        branch,
        remote
      };
    } catch {
      return {
        isRepository: false
      };
    }
  }

  async registerValidated(
    options: WorkspaceOptions
  ): Promise<Workspace> {
    const validation = await this.validate(options.path);

    if (!validation.exists) {
      throw new Error(
        `Workspace path does not exist: ${options.path}`
      );
    }

    if (!validation.isDirectory) {
      throw new Error(
        `Workspace path is not a directory: ${options.path}`
      );
    }

    const git = await this.inspectGit(options.path);

    return this.register({
      ...options,
      git
    });
  }

  getByPath(path: string): Workspace | undefined {
    return this.workspaces.get(path);
  }

  getByName(name: string): Workspace | undefined {
    for (const workspace of this.workspaces.values()) {
      if (workspace.name === name) {
        return workspace;
      }
    }

    return undefined;
  }

  list(): Workspace[] {
    return [...this.workspaces.values()];
  }

  remove(path: string): boolean {
    return this.workspaces.delete(path);
  }

  has(path: string): boolean {
    return this.workspaces.has(path);
  }

  clear(): void {
    this.workspaces.clear();
  }

  get size(): number {
    return this.workspaces.size;
  }

  private async getGitValue(
    path: string,
    args: string[]
  ): Promise<string | undefined> {
    try {
      const { stdout } = await execFileAsync('git', [
        '-C',
        path,
        ...args
      ]);

      const value = stdout.trim();

      return value || undefined;
    } catch {
      return undefined;
    }
  }
}