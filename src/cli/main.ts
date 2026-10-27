import { initialize, loadConfig } from '../project/config.js';
import { FolderSynka } from '../integration/FolderSynka.js';
import { agentCommand } from '../integration/runtime.js';
import { execute, type Execute, checked } from '../integration/exec.js';
import { CodexProcess, type CodexProcessResult, type ProcessOptions } from '../codex/CodexProcess.js';
import type { CodexConfig } from '../codex/CodexConfig.js';
export type AgentRunner = (config: CodexConfig, args: string[], options: ProcessOptions) => Promise<CodexProcessResult>;
const runAgent: AgentRunner = (config, args, options) => new CodexProcess(config).execute(args, options);
export const help = `mda — install once, init in every project folder
mda init [--shared PATH] [--runtime host|ubuntu] [--distro ubuntu] [--agent EXECUTABLE]
mda doctor | status | start | stop | sync [--plan] | agent run PROMPT | run PROMPT | help
Append --json for machine-readable results. Use -- before a prompt containing flags.
Config: .mda/config.json (version 1, machine-local; keep .mda private).
Init never syncs. Shared sync is optional. Start/stop control FolderSynka's continuous service.
Run synchronizes before and after the agent; conflicts block execution.
Config options: model, instructions, timeout (ms, default 120000), skipGitRepoCheck (default false).
Agent sandbox: workspace-write. Sync failures: exit 20; conflicts: 21; busy: 22.
Agent exits preserved; timeout: 124; cancellation: 130.
Next: mda init; mda doctor; mda run "your task"`;
export async function main(
 argv: string[], cwd = process.cwd(), exec: Execute = execute,
 out: (text: string) => void = console.log, runner: AgentRunner = runAgent, signal?: AbortSignal,
): Promise<number> {
 const boundary = argv.indexOf('--');
 const json = argv.slice(0, boundary < 0 ? undefined : boundary).includes('--json');
 const parsed = argv.filter((arg, i) => !(arg === '--json' && (boundary < 0 || i < boundary)));
 const emit = (value: unknown) => out(json ? JSON.stringify({ schemaVersion: 1, ok: true, result: value }) : typeof value === 'string' ? value : JSON.stringify(value, null, 2));
 try {
  const [command = 'help', ...args] = parsed;
  if (['help','--help','-h'].includes(command)) { emit(help); return 0; }
  if (command === 'init') {
   const flags: Record<string,string> = {};
   for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.slice(2), value = args[i + 1];
    if (!args[i]?.startsWith('--') || !['shared','runtime','distro','agent'].includes(key!) || !value?.trim() || value.startsWith('--') || flags[key!] !== undefined) throw Object.assign(new Error('Invalid init flags. See mda help.'), { exitCode: 2 });
    flags[key!] = value;
   }
   if (flags.runtime && !['host','ubuntu'].includes(flags.runtime)) throw new Error('--runtime must be host or ubuntu');
   if (flags.distro && flags.distro !== 'ubuntu') throw new Error('Only ubuntu is supported');
   const { config, created } = await initialize(cwd, flags, async config => {
    if (config.shared) await new FolderSynka(cwd, exec).ensure(config);
   });
   emit({ message: `${created ? 'Initialized' : 'Already initialized'} ${cwd}. No files synced.`, config, next: `mda doctor; mda run "your task"${config.shared ? '; mda sync --plan; mda start' : ''}` });
   return 0;
  }
  if (!['doctor','status','start','stop','sync','run','agent'].includes(command)) throw Object.assign(new Error(`Unknown command: ${command}. See mda help.`), { exitCode: 2 });
  const config = await loadConfig(cwd, { requireShared: command !== 'stop' }), adapter = new FolderSynka(cwd, exec);
  if (command === 'run' || command === 'agent') {
   let prompt = command === 'agent' ? (args[0] === 'run' ? args.slice(1) : []) : args;
   if (prompt[0] === '--') prompt = prompt.slice(1);
   if (!prompt.join(' ').trim()) throw Object.assign(new Error('Usage: mda agent run PROMPT (or mda run PROMPT)'), { exitCode: 2 });
   if (config.profile) { await adapter.verify(config); await adapter.sync(config.profile); }
   const agentArgs = ['exec', '--sandbox', 'workspace-write', '--cd', config.runtime === 'ubuntu' ? '/mnt/mda-project' : cwd];
   if (config.model) agentArgs.push('--model', config.model);
   if (config.instructions !== undefined) agentArgs.push('--config', `developer_instructions=${JSON.stringify(config.instructions)}`);
   if (config.skipGitRepoCheck) agentArgs.push('--skip-git-repo-check');
   agentArgs.push('--', prompt.join(' '));
   const cmd = await agentCommand(config, cwd, agentArgs, exec);
   const result = await runner({ executable: cmd.file, workingDirectory: cwd, timeout: config.timeout ?? 120000 }, cmd.args, {
    signal,
    onStdout: json ? undefined : chunk => { if (out === console.log) process.stdout.write(chunk); else out(chunk); },
    onStderr: json ? undefined : chunk => { if (out === console.log) process.stderr.write(chunk); else out(chunk); },
   });
   const code = result.timedOut ? 124 : result.cancelled || result.signal ? 130 : result.exitCode ?? 1;
   let syncError: unknown;
   if (config.profile) { try { await adapter.verify(config); await adapter.sync(config.profile); } catch (error) { syncError = error; } }
   if (json) out(JSON.stringify({ schemaVersion: 1, ok: code === 0 && !syncError, result, ...(syncError ? { syncError: (syncError as Error).message } : {}) }));
   else if (syncError) out(`Outbound sync failed: ${(syncError as Error).message}`);
   if (code) return code;
   if (syncError) return (syncError as { exitCode?: number }).exitCode ?? 20;
   return 0;
  }
  if (args.length && !(command === 'sync' && args.length === 1 && args[0] === '--plan')) throw Object.assign(new Error('Unexpected arguments. See mda help.'), { exitCode: 2 });
  if (command === 'status') { emit({ ...config, currentFolder: cwd, ...(config.profile ? { sync: await adapter.verify(config) } : { sync: 'disabled' }) }); return 0; }
  if (command === 'doctor') {
   const cmd = await agentCommand(config, cwd, ['--version'], exec);
   const result = checked(await exec(cmd.file, cmd.args, cwd));
   const sync = config.profile ? { capabilities: await adapter.capabilities(), profile: await adapter.verify(config) } : 'disabled (optional)';
   emit({ agent: result.stdout.trim(), runtime: config.runtime, sync }); return 0;
  }
  if (!config.profile) {
   if (command === 'stop') { emit('Sync disabled; nothing to stop.'); return 0; }
   throw new Error('Sync is not configured. Agents can still run. See mda help.');
  }
  if (command === 'stop') { emit(await adapter.service('stop', config.profile)); return 0; }
  await adapter.verify(config);
  if (command === 'start') { emit(await adapter.service('start', config.profile)); return 0; }
  emit(args[0] === '--plan' ? await adapter.plan(config.profile) : await adapter.sync(config.profile)); return 0;
 } catch (error) {
  const e = error as Error & { exitCode?: number; code?: string };
  const code = e.exitCode && e.exitCode > 0 && e.exitCode < 256 ? e.exitCode : 1;
  const message = `${e.code === 'ENOENT' ? 'Executable or folder not found. ' : ''}${e.message}`;
  out(json ? JSON.stringify({ schemaVersion: 1, ok: false, error: { message, exitCode: code } }) : `mda: ${message}`);
  return code;
 }
}
