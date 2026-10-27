import type { ProjectConfig } from '../project/config.js';
import { checked, execute, type Execute } from './exec.js';
export async function agentCommand(config: ProjectConfig, cwd: string, args: string[], exec: Execute = execute) {
  if (config.runtime === 'host') return { file: config.agent, args };
  const help = checked(await exec('proot-distro', ['login', '--help'], cwd));
  const text = help.stdout + help.stderr;
  if (!text.includes('--bind') || !text.includes('--work-dir')) throw new Error('Installed proot-distro login help does not advertise --bind and --work-dir. Upgrade or use --runtime host.');
  const guest = '/mnt/mda-project';
  if (cwd.includes(':')) throw new Error('Ubuntu bind paths cannot contain a colon.');
  return { file: 'proot-distro', args: ['login', config.distro, '--bind', `${cwd}:${guest}`, '--work-dir', guest, '--', config.agent, ...args] };
}
