
import { describe, expect, it } from 'vitest';

import { Agent } from '../agent/Agent.js';
import type { AgentConfig } from '../agent/AgentConfig.js';
import type { AgentContext } from '../agent/AgentContext.js';
import {
  CodexClient
} from '../codex/CodexClient.js';
import {
  defaultCodexConfig
} from '../codex/CodexConfig.js';
import {
  Workspace
} from '../workspace/Workspace.js';

const codexExecutable =
  process.env.CODEX_EXECUTABLE ?? defaultCodexConfig.executable;

describe('Mobile Dev Agent E2E', () => {
  it(
    'executes a prompt through the complete agent pipeline',
    async () => {
      const workspace = new Workspace({
        path: process.cwd(),
        name: 'mobile-dev-agent'
      });

      const codex = new CodexClient({
        ...defaultCodexConfig,
        executable: codexExecutable,
        workingDirectory: workspace.path
      });

      const config: AgentConfig = {
        name: 'Mobile Dev Agent',
        model: 'gpt-5.6'
      };

      const context: AgentContext = {
        workspace,
        codex
      };

      const agent = new Agent(config, context);

      const result = await agent.run(
        'Respond with exactly this text and nothing else: MOBILE_DEV_AGENT_E2E_OK'
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('MOBILE_DEV_AGENT_E2E_OK');
    },
    60_000
  );
});