import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:child_process', () => ({ spawn: vi.fn() }));
import { spawn } from 'node:child_process';
import { CodexProcess } from '../codex/CodexProcess.js';
import { CodexClient } from '../codex/CodexClient.js';
import { CommandRunner } from '../commands/CommandRunner.js';

class FakeProcess extends EventEmitter {
  stdout = new PassThrough();
  stderr = new PassThrough();
  exitCode: number | null = null;
  signalCode: NodeJS.Signals | null = null;
  kill = vi.fn((_signal: NodeJS.Signals) => true);
  close(code: number | null, signal: NodeJS.Signals | null = null) {
    this.exitCode = code;
    this.signalCode = signal;
    this.emit('close', code, signal);
  }
}

const config = { executable: 'fake-codex', workingDirectory: '/tmp', timeout: 1000 };
let child: FakeProcess;
beforeEach(() => {
  vi.useFakeTimers();
  child = new FakeProcess();
  vi.mocked(spawn).mockReset().mockReturnValue(child as unknown as ReturnType<typeof spawn>);
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('process execution', () => {
  it('retains the original result fields and exposes nonzero status', async () => {
    const pending = new CodexProcess(config).execute(['exec']);
    child.stdout.write('partial');
    child.stderr.write('failure');
    child.close(42);
    expect(await pending).toEqual({ stdout: 'partial', stderr: 'failure', exitCode: 42, timedOut: false, signal: null });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('times out, escalates an uncooperative child, and reports its signal', async () => {
    const pending = new CodexProcess(config).execute();
    await vi.advanceTimersByTimeAsync(1000);
    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
    await vi.advanceTimersByTimeAsync(250);
    expect(child.kill).toHaveBeenCalledWith('SIGKILL');
    child.close(null, 'SIGKILL');
    expect(await pending).toMatchObject({ exitCode: null, timedOut: true, signal: 'SIGKILL' });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('supports cancellation through CodexClient and removes the listener', async () => {
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, 'removeEventListener');
    const pending = new CodexClient(config).execute([], { signal: controller.signal });
    controller.abort();
    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
    await vi.advanceTimersByTimeAsync(1000);
    child.close(null, 'SIGTERM');
    expect(await pending).toMatchObject({ timedOut: false, signal: 'SIGTERM', exitCode: null });
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not spawn an already cancelled request', async () => {
    const controller = new AbortController();
    controller.abort();
    expect(await new CodexProcess(config).execute([], { signal: controller.signal })).toMatchObject({ exitCode: null, signal: 'SIGTERM', timedOut: false });
    expect(spawn).not.toHaveBeenCalled();
  });

  it('bounds each retained stream while delivering complete decoded streaming output', async () => {
    const onStdout = vi.fn();
    const onStderr = vi.fn();
    const pending = new CodexProcess({ ...config, maxOutputBytes: 5 }).execute([], { onStdout, onStderr });
    const bytes = Buffer.from('abc😀tail');
    child.stdout.write(bytes.subarray(0, 5));
    child.stdout.write(bytes.subarray(5));
    child.stderr.write('123456789');
    child.close(0);
    const result = await pending;
    expect(result.stdout).toBe('abc');
    expect(result.stderr).toBe('12345');
    expect(onStdout.mock.calls.map(([s]) => s).join('')).toBe('abc😀tail');
    expect(onStderr.mock.calls.map(([s]) => s).join('')).toBe('123456789');
  });

  it('permits streaming without buffering', async () => {
    const onStdout = vi.fn();
    const pending = new CodexProcess(config).execute([], { maxOutputBytes: 0, onStdout });
    child.stdout.write('stream');
    child.close(0);
    expect((await pending).stdout).toBe('');
    expect(onStdout).toHaveBeenCalledWith('stream');
  });

  it('rejects spawn failures and clears timers', async () => {
    const pending = new CodexProcess(config).execute();
    const check = expect(pending).rejects.toMatchObject({ code: 'ENOENT' });
    child.emit('error', Object.assign(new Error('missing executable'), { code: 'ENOENT' }));
    await check;
    expect(vi.getTimerCount()).toBe(0);
  });

  it('reports external signal termination without marking timeout', async () => {
    const pending = new CodexProcess(config).execute();
    child.close(null, 'SIGINT');
    expect(await pending).toMatchObject({ exitCode: null, timedOut: false, signal: 'SIGINT' });
  });

  it('stops the process and rejects when a streaming callback throws', async () => {
    const pending = new CodexProcess(config).execute([], { onStdout: () => { throw new Error('callback failed'); } });
    const check = expect(pending).rejects.toThrow('callback failed');
    child.stdout.write('data');
    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
    child.close(null, 'SIGTERM');
    await check;
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects invalid limits before spawning', async () => {
    await expect(new CodexProcess(config).execute([], { maxOutputBytes: -1 })).rejects.toThrow(RangeError);
    await expect(new CodexProcess(config).execute([], { timeout: Infinity })).rejects.toThrow(RangeError);
    expect(spawn).not.toHaveBeenCalled();
  });
});

describe('CommandRunner process contract', () => {
  it('merges environment overrides and passes cwd without enabling a shell', async () => {
    const pending = new CommandRunner().run('fake', ['argument'], { cwd: '/tmp', env: { AGENT_TEST: 'value' } });
    expect(spawn).toHaveBeenCalledWith('fake', ['argument'], {
      cwd: '/tmp', env: { ...process.env, AGENT_TEST: 'value' }, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32',
    });
    child.close(42);
    expect(await pending).toMatchObject({ exitCode: 42, timedOut: false, signal: null });
  });

  it('returns launch errors in the existing result shape', async () => {
    const pending = new CommandRunner().run('missing');
    child.emit('error', Object.assign(new Error('missing executable'), { code: 'ENOENT' }));
    expect(await pending).toEqual({ stdout: '', stderr: 'missing executable', exitCode: 1, timedOut: false, signal: null });
  });

  it('returns a nonzero numeric code and explicit timeout signal', async () => {
    const pending = new CommandRunner().run('fake', [], { timeout: 10 });
    await vi.advanceTimersByTimeAsync(10);
    child.close(null, 'SIGTERM');
    expect(await pending).toMatchObject({ exitCode: 1, timedOut: true, signal: 'SIGTERM' });
  });

  it('forwards cancellation, buffer limits and streaming callbacks', async () => {
    const controller = new AbortController();
    const onStderr = vi.fn();
    const pending = new CommandRunner().run('fake', [], { signal: controller.signal, maxOutputBytes: 2, onStderr });
    child.stderr.write('error');
    controller.abort();
    child.close(null, 'SIGTERM');
    expect(await pending).toMatchObject({ stderr: 'er', exitCode: 1, timedOut: false, signal: 'SIGTERM' });
    expect(onStderr).toHaveBeenCalledWith('error');
  });
});
