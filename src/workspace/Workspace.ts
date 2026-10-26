export interface WorkspaceGit {
  isRepository: boolean;
  branch?: string;
  remote?: string;
}

export interface WorkspaceConfig {
  [key: string]: unknown;
}

export interface WorkspaceOptions {
  path: string;
  name?: string;
  git?: Partial<WorkspaceGit>;
  config?: WorkspaceConfig;
}

export class Workspace {
  readonly path: string;
  readonly name: string;
  readonly git: WorkspaceGit;
  readonly config: WorkspaceConfig;

  constructor(options: WorkspaceOptions) {
    this.path = options.path;
    this.name = options.name ?? this.getDefaultName(options.path);

    this.git = {
      isRepository: options.git?.isRepository ?? false,
      branch: options.git?.branch,
      remote: options.git?.remote
    };

    this.config = options.config ?? {};
  }

  private getDefaultName(path: string): string {
    const normalizedPath = path.replace(/\/+$/, '');
    const segments = normalizedPath.split('/');

    return segments[segments.length - 1] || path;
  }
}