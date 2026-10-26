import { describe, expect, it } from 'vitest';
import { CommandRunner } from '../commands/CommandRunner.js';

describe('CommandRunner', () => {
  const runner = new CommandRunner();

  it('executes a command successfully', async () => {
    const result = await runner.run('echo', ['hello']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('hello');
    expect(result.stderr).toBe('');
  });

  it('passes arguments to the command', async () => {
    const result = await runner.run('printf', [
      '%s %s',
      'hello',
      'world'
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('hello world');
  });

  it('captures stderr from a successful command', async () => {
    const result = await runner.run('sh', [
      '-c',
      'printf "warning" >&2'
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('warning');
  });

  it('returns the command exit code when a command fails', async () => {
    const result = await runner.run('sh', [
      '-c',
      'exit 42'
    ]);

    expect(result.exitCode).toBe(42);
  });

  it('captures stderr from a failed command', async () => {
    const result = await runner.run('sh', [
      '-c',
      'printf "command failed" >&2; exit 1'
    ]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('command failed');
  });

  it('returns a non-zero exit code when the command does not exist', async () => {
    const result = await runner.run(
      'command-that-does-not-exist-mobile-dev-agent'
    );

    expect(result.exitCode).not.toBe(0);
  });

  it('respects the working directory option', async () => {
    const cwd = process.cwd();

    const result = await runner.run('pwd', [], {
      cwd
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe(cwd);
  });

  it('terminates a command when the timeout is exceeded', async () => {
    const result = await runner.run('sleep', ['2'], {
      timeout: 50
    });

    expect(result.exitCode).not.toBe(0);
  });
});