import { runProcess, type ProcessOptions } from '../codex/CodexProcess.js';

export interface CommandOptions extends ProcessOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
  signal: NodeJS.Signals | null;
}

export class CommandRunner {
  async run(command: string, args: string[] = [], options: CommandOptions = {}): Promise<CommandResult> {
    try {
      const result = await runProcess(command, args, options);
      return { ...result, exitCode: result.exitCode ?? 1 };
    } catch (error) {
      // Preserve the CommandRunner convention of returning launch failures.
      const failure = error as NodeJS.ErrnoException;
      if (!failure?.code) throw error;
      return {
        stdout: '', stderr: failure.message, exitCode: 1,
        timedOut: false, signal: null,
      };
    }
  }
}
