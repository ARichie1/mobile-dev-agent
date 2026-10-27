import { mkdir, readFile, rename, writeFile, unlink, realpath, stat } from 'node:fs/promises';
import { join, isAbsolute, resolve } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
export interface ProjectConfig {
  version: 1; host: string; runtime: 'host' | 'ubuntu'; distro: 'ubuntu'; agent: string;
  shared?: string; profile?: string; model?: string; instructions?: string; skipGitRepoCheck?: boolean; timeout?: number;
}
export async function loadConfig(cwd: string, options: { requireShared?: boolean } = {}): Promise<ProjectConfig> {
  let value: unknown;
  try { value = JSON.parse(await readFile(join(cwd, '.mda/config.json'), 'utf8')); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new Error('No project config in this folder. Run mda init first.');
    throw new Error(`Cannot read .mda/config.json: ${(error as Error).message}`);
  }
  const c = value as ProjectConfig;
  if (!c || c.version !== 1 || !['host', 'ubuntu'].includes(c.runtime) || c.distro !== 'ubuntu' || typeof c.agent !== 'string' || !c.agent.trim() || typeof c.host !== 'string' || !isAbsolute(c.host) || (c.shared !== undefined && (typeof c.shared !== 'string' || !isAbsolute(c.shared) || typeof c.profile !== 'string' || !c.profile))) throw new Error('Invalid or unsupported .mda/config.json (expected version 1).');
  if (await realpath(cwd) !== c.host) throw new Error('Project folder moved or config copied: config.host differs from this folder. Review .mda/config.json and reinitialize the new folder before syncing.');
  if ((c.profile !== undefined) !== (c.shared !== undefined) || (c.profile !== undefined && !/^[a-zA-Z0-9_-]+$/.test(c.profile)) || (c.skipGitRepoCheck !== undefined && typeof c.skipGitRepoCheck !== 'boolean') || (c.model !== undefined && (typeof c.model !== 'string' || !c.model.trim())) || (c.instructions !== undefined && typeof c.instructions !== 'string') || (c.timeout !== undefined && (!Number.isSafeInteger(c.timeout) || c.timeout <= 0 || c.timeout > 2147483647))) throw new Error('Invalid project agent or sync configuration.');
  if (c.shared) {
    if (options.requireShared !== false && (await realpath(c.shared) !== c.shared || !(await stat(c.shared)).isDirectory())) throw new Error('Shared endpoint must be an available canonical directory.');
    assertSeparate(c.host, c.shared);
  }
  return c;
}
export async function atomicJson(path: string, value: unknown) {
  const temp = `${path}.${randomUUID()}.tmp`;
  try { await writeFile(temp, JSON.stringify(value, null, 2) + '\n', { mode: 0o600, flag: 'wx' }); await rename(temp, path); }
  finally { await unlink(temp).catch(() => {}); }
}
export async function initialize(cwd: string, flags: Record<string, string>, prepare?: (config: ProjectConfig) => Promise<void>): Promise<{ config: ProjectConfig; created: boolean }> {
  const host = await realpath(cwd);
  await mkdir(join(cwd, '.mda'), { recursive: true });
  // Exclusive lock protects concurrent init and prevents overwriting an existing configuration.
  const lock = join(cwd, '.mda/init.lock');
  await writeFile(lock, '', { flag: 'wx', mode: 0o600 }).catch(() => { throw new Error('Another init is active (or .mda/init.lock is stale).'); });
  try {
    let existing: ProjectConfig | undefined;
    try { existing = await loadConfig(cwd); } catch (error) { if (!(error as Error).message.startsWith('No project config')) throw error; }
    if (existing) {
      for (const [key, value] of Object.entries(flags)) {
        const expected = key === 'shared' ? await realpath(resolve(cwd, value)) : value;
        if (existing[key as keyof ProjectConfig] !== expected) throw new Error(`Project already initialized with different ${key}; edit .mda/config.json explicitly.`);
      }
      await prepare?.(existing);
      await ignorePrivate(cwd);
      return { config: existing, created: false };
    }
    const config: ProjectConfig = { version: 1, host, runtime: (flags.runtime ?? 'host') as ProjectConfig['runtime'], distro: 'ubuntu', agent: flags.agent ?? 'codex' };
    if (flags.shared) {
      config.shared = await realpath(resolve(cwd, flags.shared));
      if (!(await stat(config.shared)).isDirectory()) throw new Error('Shared endpoint must be a directory.');
      assertSeparate(host, config.shared);
      config.profile = `mda-${createHash('sha256').update(host).digest('hex').slice(0, 16)}`;
    }
    await prepare?.(config);
    await ignorePrivate(cwd);
    await atomicJson(join(cwd, '.mda/config.json'), config);
    return { config, created: true };
  } finally { await unlink(lock); }
}
async function ignorePrivate(cwd: string) {
  await writeFile(join(cwd, '.mda/.gitignore'), '*\n!.gitignore\n');
}

function assertSeparate(a: string, b: string) {
  if (a === b || a.startsWith(b.endsWith('/') ? b : b + '/') || b.startsWith(a.endsWith('/') ? a : a + '/')) throw new Error('Shared and host folders must be separate, non-overlapping folders.');
}
