
import { CodexProcess } from "./CodexProcess.js";
import {
  defaultCodexConfig,
  type CodexConfig,
} from "./CodexConfig.js";

export class CodexClient {
  private readonly process: CodexProcess;

  constructor(config: CodexConfig = defaultCodexConfig) {
    this.process = new CodexProcess(config);
  }

  async execute(args: string[] = []) {
    return this.process.execute(args);
  }

  async getVersion(): Promise<string> {
    const result = await this.execute(["--version"]);

    if (result.exitCode !== 0) {
      throw new Error(
        result.stderr.trim() || "Codex process exited with an error.",
      );
    }

    return result.stdout.trim();
  }
}