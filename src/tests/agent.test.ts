import { describe, expect, it, vi } from 'vitest';
import { Agent } from '../agent/Agent.js';
import type { AgentConfig } from '../agent/AgentConfig.js';
import type { AgentContext } from '../agent/AgentContext.js';

describe('Agent ↔ CodexClient integration', () => {
  const config: AgentConfig = {
    name: 'Test Agent',
    model: 'test-model',
    instructions: 'Test instructions'
  };

  it('exposes the CodexClient through the agent context', () => {
    const codex = {
      execute: vi.fn(),
      getVersion: vi.fn()
    };

    const workspace = {
      path: '/tmp/test-workspace'
    };

    const context = {
      workspace,
      codex
    } as unknown as AgentContext;

    const agent = new Agent(config, context);

    expect(agent.getCodexClient()).toBe(codex);
  });

  it('delegates a prompt to CodexClient', async () => {
    const codex = {
      execute: vi.fn().mockResolvedValue({
        stdout: 'Codex response',
        stderr: '',
        exitCode: 0
      }),
      getVersion: vi.fn()
    };

    const workspace = {
      path: '/tmp/test-workspace'
    };

    const context = {
      workspace,
      codex
    } as unknown as AgentContext;

    const agent = new Agent(config, context);

    const result = await agent.run('Explain this project.');

    expect(codex.execute).toHaveBeenCalledWith([
      'exec',
      '--skip-git-repo-check',
      '--cd',
      '/tmp/test-workspace',
      'Explain this project.'
    ]);

    expect(result).toEqual({
      stdout: 'Codex response',
      stderr: '',
      exitCode: 0
    });
  });

  it('rejects an empty prompt', async () => {
    const codex = {
      execute: vi.fn(),
      getVersion: vi.fn()
    };

    const context = {
      workspace: {
        path: '/tmp/test-workspace'
      },
      codex
    } as unknown as AgentContext;

    const agent = new Agent(config, context);

    await expect(agent.run('')).rejects.toThrow(
      'Agent prompt cannot be empty.'
    );

    expect(codex.execute).not.toHaveBeenCalled();
  });
});