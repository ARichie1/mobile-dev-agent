import { spawn } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';
import type { CodexConfig } from './CodexConfig.js';

export interface ProcessOptions {
  timeout?: number;
  signal?: AbortSignal;
  /** Maximum retained bytes per stream; streaming callbacks still receive all output. */
  maxOutputBytes?: number;
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
}

export interface CodexProcessResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  signal: NodeJS.Signals | null;
  cancelled?: boolean;
}

/** Runs without a shell. Spawn failures reject; process exits are inspectable results. */
export function runProcess(
  executable: string,
  args: string[],
  options: ProcessOptions & { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): Promise<CodexProcessResult> {
  const limit = options.maxOutputBytes ?? 1024 * 1024;
  if (!Number.isSafeInteger(limit) || limit < 0) {
    return Promise.reject(new RangeError('maxOutputBytes must be a non-negative safe integer.'));
  }
  if (options.timeout !== undefined && (!Number.isFinite(options.timeout) || options.timeout < 0 || options.timeout > 2_147_483_647)) {
    return Promise.reject(new RangeError('timeout must be between 0 and 2147483647 milliseconds.'));
  }
  if (options.signal?.aborted) {
    return Promise.resolve({ stdout: '', stderr: '', exitCode: null, timedOut: false, signal: 'SIGTERM', cancelled: true });
  }

  return new Promise((resolve, reject) => {
    const processGroup = process.platform !== 'win32';
    const child = spawn(executable, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: processGroup,
    });
    let timedOut = false;
    let cancelled = false;
    let stopping = false;
    let finished = false;
    let callbackError: unknown;
    let callbackFailed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let escalation: ReturnType<typeof setTimeout> | undefined;
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    const outDecoder = new StringDecoder('utf8');
    const errDecoder = new StringDecoder('utf8');
    const terminate = (signal: NodeJS.Signals) => {
      try {
        if (processGroup && child.pid) process.kill(-child.pid, signal);
        else child.kill(signal);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
      }
    };
    const stop = () => {
      if (finished || stopping) return;
      stopping = true;
      terminate('SIGTERM');
      escalation = setTimeout(() => terminate('SIGKILL'), 250);
    };
    const abort = () => {
      if (finished) return;
      cancelled = true;
      stop();
    };
    const cleanup = () => {
      clearTimeout(timer);
      clearTimeout(escalation);
      options.signal?.removeEventListener('abort', abort);
    };
    const notify = (callback: ((chunk: string) => void) | undefined, chunk: string) => {
      if (!callback || !chunk || callbackFailed) return;
      try { callback(chunk); } catch (error) {
        callbackFailed = true;
        callbackError = error;
        stop();
      }
    };
    child.stdout.on('data', (data: Buffer) => {
      const retained = data.subarray(0, Math.max(0, limit - stdoutBytes));
      if (retained.length) stdout.push(Buffer.from(retained));
      stdoutBytes += retained.length;
      notify(options.onStdout, outDecoder.write(data));
    });
    child.stderr.on('data', (data: Buffer) => {
      const retained = data.subarray(0, Math.max(0, limit - stderrBytes));
      if (retained.length) stderr.push(Buffer.from(retained));
      stderrBytes += retained.length;
      notify(options.onStderr, errDecoder.write(data));
    });
    child.once('error', (error) => { finished = true; cleanup(); reject(error); });
    child.once('close', (exitCode, signal) => {
      if (finished) return;
      // A parent can exit gracefully while descendants ignore TERM and close
      // their pipes. Finish the group before returning and syncing its edits.
      if (stopping && processGroup) terminate('SIGKILL');
      finished = true;
      cleanup();
      notify(options.onStdout, outDecoder.end());
      notify(options.onStderr, errDecoder.end());
      if (callbackFailed) { reject(callbackError); return; }
      // Omit a partial UTF-8 character at the byte boundary.
      const decode = (chunks: Buffer[]) => new StringDecoder('utf8').write(Buffer.concat(chunks));
      resolve({ stdout: decode(stdout), stderr: decode(stderr), exitCode, timedOut, signal, ...(cancelled ? {cancelled: true} : {}) });
    });
    options.signal?.addEventListener('abort', abort, { once: true });
    if (options.signal?.aborted) abort();
    if (options.timeout) {
      timer = setTimeout(() => {
        if (stopping || finished) return;
        timedOut = true;
        stop();
      }, options.timeout);
    }
  });
}

export class CodexProcess {
  constructor(private readonly config: CodexConfig) {}

  execute(args: string[] = [], options: ProcessOptions = {}): Promise<CodexProcessResult> {
    return runProcess(this.config.executable, args, {
      ...this.config,
      ...options,
      cwd: this.config.workingDirectory,
      env: this.config.environment,
    });
  }
}
