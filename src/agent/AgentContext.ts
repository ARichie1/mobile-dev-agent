
import type { CodexClient } from '../codex/CodexClient.js';
import type { Workspace } from '../workspace/Workspace.js';

export interface AgentContext {
  workspace: Workspace;
  codex: CodexClient;
}