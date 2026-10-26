
import { spawn } from "node:child_process";
import type { CodexConfig } from "./CodexConfig.js";

export interface CodexProcessResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

export class CodexProcess {
  constructor(
    private readonly config: CodexConfig
  ) {}

  execute(
    args: string[] = []
  ): Promise<CodexProcessResult> {
    
    return new Promise(
      (resolve, reject) => {
      const process = spawn(this.config.executable, args, {
        cwd: this.config.workingDirectory,
        env: this.config.environment
          ? { ...processEnv(), ...this.config.environment }
          : processEnv(),
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      process.stdout.on(
        "data", (data: Buffer) => {
        stdout += data.toString();
      });

      process.stderr.on(
        "data", (data: Buffer) => {
        stderr += data.toString();
      });

      process.on("error", (error) => {
        reject(error);
      });

      process.on("close", (exitCode) => {
        resolve({
          stdout,
          stderr,
          exitCode,
        });
      });
    });
  }
}

function processEnv(): NodeJS.ProcessEnv {
  return { ...globalThis.process.env };
}