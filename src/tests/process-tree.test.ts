import { describe, expect, it } from 'vitest';
import { runProcess } from '../codex/CodexProcess.js';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('real subprocess lifecycle', () => {
  it('records cancellation even when the subprocess handles TERM with exit zero', async () => {
    const controller = new AbortController();
    const result = await runProcess(process.execPath, ['-e', `
      process.on('SIGTERM', () => process.exit(0));
      process.stdout.write('ready'); setInterval(()=>{},1000);
    `], {timeout: 3000, signal: controller.signal, onStdout: () => controller.abort()});
    expect(result.exitCode).toBe(0);
    expect(result.cancelled).toBe(true);
  });

  it('kills a TERM-resistant descendant that does not retain output pipes', async () => {
    if (process.platform === 'win32') return;
    const root = await mkdtemp(join(tmpdir(), 'mda-child-'));
    let pid: number | undefined;
    const controller = new AbortController();
    try {
      await runProcess(process.execPath, ['-e', `
        const {spawn} = require('node:child_process');
        process.on('SIGTERM', () => process.exit(0));
        const child = spawn(process.execPath, ['-e',
          'process.on("SIGTERM",()=>{}); const fs=require("node:fs"); const pulse=()=>fs.writeFileSync(process.argv[1],String(Date.now())); pulse(); process.send("ready"); setInterval(pulse,10)', process.argv[2]],
          {stdio:['ignore','ignore','ignore','ipc']});
        child.once('message',()=>{
          require('node:fs').writeFileSync(process.argv[1], String(child.pid));
          process.stdout.write('ready');
        });
      `, join(root, 'pid'), join(root, 'heartbeat')], {timeout: 3000, signal: controller.signal, onStdout: () => controller.abort()});
      pid = Number(await readFile(join(root, 'pid'), 'utf8'));
      // Verify the safety outcome (no continued writes). /proc PID visibility
      // can differ from Node's namespace in containerized CI; zombies also do
      // not mean the process is still executing.
      await new Promise(resolve => setTimeout(resolve, 30));
      const pulse = await readFile(join(root, 'heartbeat'), 'utf8');
      await new Promise(resolve => setTimeout(resolve, 120));
      expect(await readFile(join(root, 'heartbeat'), 'utf8')).toBe(pulse);
    } finally {
      if (pid) { try {process.kill(pid, 'SIGKILL');} catch {} }
      await rm(root, {recursive:true,force:true});
    }
  });

  it('times out descendants retaining inherited pipes after their parent exits', async () => {
    if (process.platform === 'win32') return;
    const before = Date.now();
    const result = await runProcess(process.execPath, ['-e', `
      const {spawn} = require('node:child_process');
      spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], {stdio: ['ignore', 1, 2]});
      process.exit(0);
    `], {timeout: 150});
    expect(result.timedOut).toBe(true);
    expect(Date.now() - before).toBeLessThan(3000);
  });

  it('streams output while retaining a bounded amount', async () => {
    let streamed = '';
    const result = await runProcess(process.execPath, ['-e', 'process.stdout.write("abcdef")'], {
      timeout: 3000, maxOutputBytes: 3, onStdout: chunk => {streamed += chunk;},
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('abc');
    expect(streamed).toBe('abcdef');
  });
});
