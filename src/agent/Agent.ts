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

  async run(prompt: string) {
    if (!prompt.trim()) {
      throw new Error('Agent prompt cannot be empty.');
    }

    return this.context.codex.execute([
      'exec',
      '--skip-git-repo-check',
      '--cd',
      this.context.workspace.path,
      prompt
    ]);
  }
}