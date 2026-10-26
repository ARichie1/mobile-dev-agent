
import { describe, expect, it } from 'vitest';
import { Agent } from '../agent/Agent.js';
import type { AgentConfig } from '../agent/AgentConfig.js';
import type { AgentContext } from '../agent/AgentContext.js';
import { CodexClient } from '../codex/CodexClient.js';
import { Workspace } from '../workspace/Workspace.js';

describe('Mobile Dev Agent - End-to-End', () => {
  it(
    'executes a prompt through the complete agent pipeline',
    async () => {
      const workspace = new Workspace({
        path: process.cwd(),
        name: 'mobile-dev-agent-e2e'
      });

      const codex = new CodexClient();

      const config: AgentConfig = {
        name: 'E2E Test Agent',
        model: 'default',
        instructions: 'Respond concisely.'
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
      expect(result.stderr).toBe('');
      expect(result.stdout).toContain('MOBILE_DEV_AGENT_E2E_OK');
    },
    120_000
  );
});