import { execute, checked, type Execute } from './exec.js';
import type { ProjectConfig } from '../project/config.js';
export interface SyncDocument { schemaVersion: 1; ok: boolean; [key: string]: unknown }
export class FolderSynka {
  constructor(private cwd: string, private exec: Execute = execute) {}
  private async json(args: string[], allowConflicts = false): Promise<SyncDocument> {
    const result = await this.exec('foldersynka', [...args, '--json'], this.cwd);
    let value: SyncDocument;
    try { value = JSON.parse(result.stdout); } catch { throw new Error('FolderSynka returned invalid JSON. Check its CLI version.'); }
    if (!value || value.schemaVersion !== 1 || typeof value.ok !== 'boolean') throw new Error('Unsupported FolderSynka JSON contract (expected schemaVersion 1 and ok).');
    if (allowConflicts && result.code === 4 && Array.isArray(value.conflicts)) return value;
    if (result.code || !value.ok) throw Object.assign(new Error(`FolderSynka ${args[0]} failed (${result.code}): ${JSON.stringify(value)}`), { exitCode: result.code === 4 ? 21 : result.code === 3 ? 22 : 20, document: value });
    return value;
  }
  async capabilities() {
    const value = await this.json(['capabilities']);
    if (!Array.isArray(value.modes) || !value.modes.includes('bidirectional') || !Array.isArray(value.commands) || !['inspect','sync','plan'].every(c => (value.commands as unknown[]).includes(c))) throw new Error('FolderSynka requires bidirectional mode and inspect/sync/plan support.');
    return value;
  }
  inspect(profile: string, allowConflicts = false) { return this.json(['inspect', profile], allowConflicts); }
  plan(profile: string) { return this.json(['plan', profile]); }
  sync(profile: string) { return this.json(['sync', profile, '--once']); }
  async verify(config: ProjectConfig, allowConflicts = false) {
    const value = await this.inspect(config.profile!, allowConflicts);
    if (value.mode !== 'bidirectional' || value.source !== config.shared || value.destination !== config.host) throw new Error('FolderSynka profile endpoints or mode do not match this project. Refusing to sync; inspect the profile before correcting config.');
    return value;
  }
  async ensure(config: ProjectConfig) {
    await this.capabilities();
    try { await this.verify(config); return; }
    catch (error) {
      const document = (error as {document?: SyncDocument}).document;
      if ((document?.error as {code?: string} | undefined)?.code !== 'INVALID_PROFILE') throw error;
    }
    await this.create(config.profile!, config.shared!, config.host);
    await this.verify(config);
  }
  async create(profile: string, shared: string, host: string) {
    checked(await this.exec('foldersynka', ['create', profile, '--src', shared, '--dest', host, '--mode', 'bidirectional'], this.cwd));
  }
  async service(command: 'start' | 'stop', profile: string) {
    return checked(await this.exec('foldersynka', [command, profile], this.cwd));
  }
}
