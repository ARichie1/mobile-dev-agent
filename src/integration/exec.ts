import { execFile } from 'node:child_process';
export interface Result { stdout: string; stderr: string; code: number }
export type Execute = (file: string, args: string[], cwd: string) => Promise<Result>;
export const execute: Execute = (file, args, cwd) => new Promise((resolve, reject) => {
  execFile(file, args, { cwd, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 120000 }, (error, stdout, stderr) => {
    if (error && typeof error.code !== 'number') { reject(error); return; }
    resolve({ stdout, stderr, code: typeof error?.code === 'number' ? error.code : 0 });
  });
});
export function checked(result: Result): Result {
  if (result.code !== 0) throw Object.assign(new Error(result.stderr.trim() || `Command failed (${result.code})`), { exitCode: result.code });
  return result;
}
