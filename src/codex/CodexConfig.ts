
import type { ProcessOptions } from "./CodexProcess.js";
import { homedir } from "node:os";

export interface CodexConfig extends ProcessOptions {
  executable: string;
  workingDirectory: string;
  environment?: NodeJS.ProcessEnv;
}

export const defaultCodexConfig: CodexConfig = {
  executable: "codex",
  workingDirectory: homedir(),
  timeout: 120_000,
};