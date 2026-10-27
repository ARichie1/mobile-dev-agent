
export interface AgentConfig {
  name: string;
  model: string;
  instructions?: string;
  /** Allow execution outside a Git repository. Defaults to false. */
  skipGitRepoCheck?: boolean;
}