
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface CommandOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeout?: number;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class CommandRunner {
  async run(
    command: string,
    args: string[] = [],
    options: CommandOptions = {}
  ): Promise<CommandResult> {
    try {
      const result = await execFileAsync(command, args, {
        cwd: options.cwd,
        env: options.env,
        timeout: options.timeout
      });

      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: 0
      };
    } catch (error) {
      const commandError = error as {
        stdout?: string;
        stderr?: string;
        code?: number | string;
        message?: string;
      };

      const exitCode =
        typeof commandError.code === 'number'
          ? commandError.code
          : 1;

      return {
        stdout: commandError.stdout ?? '',
        stderr: commandError.stderr ?? commandError.message ?? '',
        exitCode
      };
    }
  }
}