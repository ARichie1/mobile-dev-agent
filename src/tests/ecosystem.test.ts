/** Offline public CLI smoke tests. Run only this file; legacy E2E tests may use live Codex. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const fsRepo = resolve(repo, '../foldersynka');
let root: string;
let project: string;
let env: NodeJS.ProcessEnv;
function executable(path: string, source: string) {
  writeFileSync(path, source, { mode: 0o755 });
}
function mda(...args: string[]) {
  const result = spawnSync(process.execPath, ['--import', join(repo, 'node_modules/tsx/dist/loader.mjs'),
    join(repo, 'src/index.ts'), ...args], { cwd: project, env, encoding: 'utf8', timeout: 20_000 });
  expect(result.error, `${args}: ${result.stderr}`).toBeUndefined();
  expect(result.status, `${args}: ${result.stdout}\n${result.stderr}`).toBe(0);
  return result.stdout;
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'mda-ecosystem-'));
  project = join(root, 'project with spaces');
  const bin = join(root, 'bin');
  for (const directory of [project, bin, join(root, 'home'), join(root, 'prefix')]) {
    mkdirSync(directory, { recursive: true });
  }
  executable(join(bin, 'foldersynka'), `#!/bin/bash\nexec bash '${fsRepo}/core/cli/router.sh' "$@"\n`);
  executable(join(bin, 'codex'), '#!/bin/bash\nprintf "%s\\n" "$PWD" "$@" >> "$FAKE_CODEX_LOG"\nprintf "OFFLINE_CODEX_OK\\n"\n');
  // A transparent local stand-in; never enters an installed distro or contacts an agent.
  executable(join(bin, 'proot-distro'), `#!/bin/bash
printf '%s\\n' "$@" >> "$FAKE_PROOT_LOG"
if [[ "$*" == "login --help" ]]; then printf "%s\\n" "--bind --work-dir"; exit 0; fi
while [[ $# -gt 0 && "$1" != -- ]]; do shift; done
[[ $# -gt 0 ]] && shift
exec "$@"
`);
  env = { ...process.env, HOME: join(root, 'home'), PREFIX: join(root, 'prefix'),
    FS_HOME: fsRepo, FS_RUNTIME: join(root, 'home/.foldersynka'),
    PATH: `${bin}:/usr/bin:/bin`, FAKE_CODEX_LOG: join(root, 'codex.log'),
    FAKE_PROOT_LOG: join(root, 'proot.log'), CODEX_EXECUTABLE: join(bin, 'codex') };
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('offline ecosystem CLI', () => {
  it('initializes in cwd and preserves project configuration on repeat init', () => {
    mda('init');
    const path = join(project, '.mda/config.json');
    const original = readFileSync(path, 'utf8');
    expect(JSON.parse(original)).toBeTypeOf('object');
    mda('init');
    expect(readFileSync(path, 'utf8')).toBe(original);
  });
});


describe.skipIf(!existsSync(join(fsRepo, 'core/engine/reconcile.py')))('real FolderSynka bridge and fake execution', () => {
  it('initializes without copying, then plans and syncs both directions', () => {
    const shared = join(root, 'shared with spaces');
    mkdirSync(shared);
    writeFileSync(join(shared, 'note.txt'), 'shared seed\n');
    mda('init', '--shared', shared);
    const config = JSON.parse(readFileSync(join(project, '.mda/config.json'), 'utf8'));
    expect(config.host).toBe(project);
    expect(config.shared).toBe(shared);
    expect(config.profile).toBeTruthy();
    expect(JSON.parse(mda('status')).sync.schemaVersion).toBe(1);
    expect(JSON.parse(mda('sync', '--plan')).actions.length).toBeGreaterThan(0);
    expect(() => readFileSync(join(project, 'note.txt'))).toThrow();
    mda('sync');
    expect(readFileSync(join(project, 'note.txt'), 'utf8')).toBe('shared seed\n');
    writeFileSync(join(project, 'note.txt'), 'host edit\n');
    mda('sync');
    expect(readFileSync(join(shared, 'note.txt'), 'utf8')).toBe('host edit\n');
    writeFileSync(join(shared, 'note.txt'), 'shared edit\n');
    mda('sync');
    expect(readFileSync(join(project, 'note.txt'), 'utf8')).toBe('shared edit\n');
    expect(JSON.parse(mda('status')).sync.converged).toBe(true);
  }, 60_000);

  it.each(['host', 'ubuntu'])('runs only the fake agent in %s runtime', (runtime) => {
    mda('init', '--runtime', runtime, '--agent', join(root, 'bin/codex'));
    expect(mda('run', 'offline prompt with spaces')).toContain('OFFLINE_CODEX_OK');
    const log = readFileSync(join(root, 'codex.log'), 'utf8');
    expect(log).toContain('offline prompt with spaces');
    expect(log).toContain('exec');
    expect(log).toContain(runtime === 'ubuntu' ? '/mnt/mda-project' : project);
    if (runtime === 'ubuntu') {
      const proot = readFileSync(join(root, 'proot.log'), 'utf8');
      expect(proot).toContain(`${project}:/mnt/mda-project`);
      expect(proot).toContain('--work-dir');
    }
  });
});


it('builds and invokes the package mda executable with idempotent init', () => {
  const manifest = JSON.parse(readFileSync(join(repo, 'package.json'), 'utf8'));
  expect(manifest.bin.mda).toBe('dist/index.js');
  const output = join(root, 'package');
  mkdirSync(output);
  writeFileSync(join(output, 'package.json'), '{"type":"module"}');
  const build = spawnSync(process.execPath, [join(repo, 'node_modules/typescript/bin/tsc'),
    '--project', join(repo, 'tsconfig.json'), '--outDir', join(output, 'dist')],
    { cwd: repo, env, encoding: 'utf8', timeout: 30_000 });
  expect(build.status, `${build.stdout}\n${build.stderr}`).toBe(0);
  const entry = join(output, manifest.bin.mda);
  expect(readFileSync(entry, 'utf8')).toMatch(/^#!\/usr\/bin\/env node/);
  const invoke = () => spawnSync(process.execPath, [entry, 'init'],
    { cwd: project, env, encoding: 'utf8', timeout: 10_000 });
  const first = invoke();
  expect(first.status, first.stdout + first.stderr).toBe(0);
  const path = join(project, '.mda/config.json');
  const original = readFileSync(path, 'utf8');
  const second = invoke();
  expect(second.status, second.stdout + second.stderr).toBe(0);
  expect(readFileSync(path, 'utf8')).toBe(original);
}, 45_000);
