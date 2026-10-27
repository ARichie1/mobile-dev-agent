import { describe, it, expect } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { main, type AgentRunner } from '../cli/main.js';
import { FolderSynka } from '../integration/FolderSynka.js';
import { agentCommand } from '../integration/runtime.js';
import type { Execute } from '../integration/exec.js';
const ok = {stdout:JSON.stringify({schemaVersion:1,ok:true,modes:['bidirectional'],commands:['inspect','sync','plan']}),stderr:'',code:0};
describe('project CLI',()=>{
 it('initializes without dependencies, preserves config, ignores private files and uses current folder',async()=>{
  const cwd=await mkdtemp(join(tmpdir(),'mda-')); const calls: unknown[]=[];
  const exec: Execute=async(...args)=>{calls.push(args);return {...ok,code:7};};
  try {
   expect(await main(['init'],cwd,exec,()=>{})).toBe(0);
   const before=await readFile(join(cwd,'.mda/config.json'),'utf8');
   expect(await main(['init'],cwd,exec,()=>{})).toBe(0);
   expect(await readFile(join(cwd,'.mda/config.json'),'utf8')).toBe(before);
   expect(await readFile(join(cwd,'.mda/.gitignore'),'utf8')).not.toContain('!config.json');
   expect(calls).toHaveLength(0);
   const runner: AgentRunner=async(config,args)=>{calls.push([config,args]);return {stdout:'',stderr:'',exitCode:7,timedOut:false,signal:null};};
   expect(await main(['run','literal ; $(hello)'],cwd,exec,()=>{},runner)).toBe(7);
   expect(calls[0]).toEqual([{executable:'codex',workingDirectory:cwd,timeout:120000},['exec','--sandbox','workspace-write','--cd',cwd,'--','literal ; $(hello)']]);
   expect(await main(['init','--runtime','ubuntu'],cwd,exec,()=>{})).toBe(1);
   expect(await main(['sync'],cwd,exec,()=>{})).toBe(1);
  } finally {await rm(cwd,{recursive:true,force:true});}
 });
 it('validates usage and corrupt config',async()=>{
  const cwd=await mkdtemp(join(tmpdir(),'mda-'));
  try {
   expect(await main(['wat'],cwd,undefined,()=>{})).toBe(2);
   expect(await main(['init','--oops','x'],cwd,undefined,()=>{})).toBe(2);
   expect(await main(['status'],cwd,undefined,()=>{})).toBe(1);
   await main(['init'],cwd,undefined,()=>{});
   await writeFile(join(cwd,'.mda/config.json'),'{bad');
   expect(await main(['init'],cwd,undefined,()=>{})).toBe(1);
  }finally{await rm(cwd,{recursive:true,force:true});}
 });
 it('uses FolderSynka argument arrays and rejects malformed JSON',async()=>{
  const calls:unknown[]=[];const exec:Execute=async(...args)=>{calls.push(args);return ok;};
  const adapter=new FolderSynka('/tmp',exec);
  await adapter.capabilities();await adapter.inspect('a b');await adapter.sync('a b');await adapter.plan('a b');await adapter.create('p','/shared space','/host');
  expect(calls).toEqual([
   ['foldersynka',['capabilities','--json'],'/tmp'],['foldersynka',['inspect','a b','--json'],'/tmp'],
   ['foldersynka',['sync','a b','--once','--json'],'/tmp'],['foldersynka',['plan','a b','--json'],'/tmp'],
   ['foldersynka',['create','p','--src','/shared space','--dest','/host','--mode','bidirectional'],'/tmp']]);
  await expect(new FolderSynka('/tmp',async()=>({...ok,stdout:'bad'})).capabilities()).rejects.toThrow('invalid JSON');
 });
 it('checks local proot help before constructing an Ubuntu command',async()=>{
  const config={version:1 as const,host:'/host',runtime:'ubuntu' as const,distro:'ubuntu' as const,agent:'codex'};
  const cmd=await agentCommand(config,'/host space',['exec','hello'],async()=>({...ok,stdout:'--bind --work-dir'}));
  expect(cmd.args).toEqual(['login','ubuntu','--bind','/host space:/mnt/mda-project','--work-dir','/mnt/mda-project','--','codex','exec','hello']);
  await expect(agentCommand(config,'/host',[],async()=>ok)).rejects.toThrow('does not advertise');
 });
});
