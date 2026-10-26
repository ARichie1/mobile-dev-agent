
import { homedir } from "node:os";

export interface CodexConfig {
  executable: string;
  workingDirectory: string;
  environment?: NodeJS.ProcessEnv;
  timeout?: number;
}

export const defaultCodexConfig: CodexConfig = {
  executable: "codex",
  workingDirectory: homedir(),
  timeout: 120_000,
};