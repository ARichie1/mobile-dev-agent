import type { ProcessOptions } from '../codex/CodexProcess.js';
import type { AgentConfig } from './AgentConfig.js';
import type { AgentContext } from './AgentContext.js';

export class Agent {
  constructor(
    private readonly config: AgentConfig,
    private readonly context: AgentContext
  ) {}

  getConfig(): AgentConfig {
    return this.config;
  }

  getContext(): AgentContext {
    return this.context;
  }

  getWorkspace() {
    return this.context.workspace;
  }

  getCodexClient() {
    return this.context.codex;
  }

  async run(prompt: string, options?: ProcessOptions) {
    if (!prompt.trim()) {
      throw new Error('Agent prompt cannot be empty.');
    }

    const args = [
      'exec',
      '--sandbox', 'workspace-write',
      '--model', this.config.model,
      '--cd', this.context.workspace.path,
    ];
    if (this.config.instructions !== undefined) {
      args.push('--config', `developer_instructions=${JSON.stringify(this.config.instructions)}`);
    }
    if (this.config.skipGitRepoCheck) args.push('--skip-git-repo-check');
    args.push('--', prompt);
    return options === undefined
      ? this.context.codex.execute(args)
      : this.context.codex.execute(args, options);
  }
}
