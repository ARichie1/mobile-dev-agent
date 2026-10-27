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
      '--sandbox',
      'workspace-write',
      '--model',
      'test-model',
      '--cd',
      '/tmp/test-workspace',
      '--config',
      'developer_instructions="Test instructions"',
      '--',
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
  it('opts into Git-check skipping and forwards execution options and failure results', async () => {
    const failure = { stdout: '', stderr: 'failed', exitCode: 42, timedOut: false, signal: null };
    const codex = { execute: vi.fn().mockResolvedValue(failure) };
    const context = { workspace: { path: '/tmp/workspace' }, codex } as unknown as AgentContext;
    const instructions = 'Use "quotes"\nthen a second line';
    const agent = new Agent({ ...config, instructions, skipGitRepoCheck: true }, context);
    const options = { signal: new AbortController().signal, timeout: 10, onStdout: vi.fn() };
    expect(await agent.run('--a prompt', options)).toBe(failure);
    const [args, forwarded] = codex.execute.mock.calls[0]!;
    expect(args).toContain('--skip-git-repo-check');
    expect(args).toContain(`developer_instructions=${JSON.stringify(instructions)}`);
    expect(args.slice(-2)).toEqual(['--', '--a prompt']);
    expect(forwarded).toBe(options);
  });

  it('omits unset instructions and Git-check bypass by default', async () => {
    const codex = { execute: vi.fn() };
    const context = { workspace: { path: '/tmp/workspace' }, codex } as unknown as AgentContext;
    await new Agent({ name: 'minimal', model: 'chosen-model' }, context).run('task');
    const args = codex.execute.mock.calls[0]![0];
    expect(args).not.toContain('--config');
    expect(args).not.toContain('--skip-git-repo-check');
    expect(args).not.toContain('--dangerously-bypass-approvals-and-sandbox');
    expect(args).toContain('workspace-write');
    expect(args).toContain('chosen-model');
  });

});