import { describe, it, expect } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, rename, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { main, type AgentRunner } from '../cli/main.js';
import { loadConfig } from '../project/config.js';
import type { Execute } from '../integration/exec.js';
const quiet = () => {};
async function fixture() {
 const root = await mkdtemp(join(tmpdir(), 'mda-safe-'));
 const host = join(root, 'host'), shared = join(root, 'shared');
 await mkdir(host); await mkdir(shared);
 return { root, host, shared, cleanup: () => rm(root, {recursive:true,force:true}) };
}
function bridge(host: string, shared: string) {
 const calls: string[][] = []; let exists = false, conflict = false, mismatch = false, createFails = false;
 const exec: Execute = async (_file,args) => {
  calls.push(args);
  let value: unknown = {schemaVersion:1,ok:true}; let code=0;
  if(args[0] === 'capabilities') value={schemaVersion:1,ok:true,modes:['bidirectional'],commands:['inspect','sync','plan']};
  if(args[0] === 'inspect') {
   if(!exists) {value={schemaVersion:1,ok:false,error:{code:'INVALID_PROFILE'}};code=2;}
   else value={schemaVersion:1,ok:true,mode:'bidirectional',source:shared,destination:mismatch?'/wrong':host};
  }
  if(args[0] === 'create') {if(createFails) return {stdout:'',stderr:'create failed',code:1};exists=true;}
  if(args[0] === 'sync' && conflict) {value={schemaVersion:1,ok:false,conflicts:[{path:'file'}]};code=4;}
  return {stdout:JSON.stringify(value),stderr:'',code};
 };
 return {calls,exec,setConflict:()=>{conflict=true;},setMismatch:()=>{mismatch=true;},failCreate:()=>{createFails=true;},allowCreate:()=>{createFails=false;}};
}
describe('safe project integration',()=>{
 it('reports cancellation independently of an agent exiting zero',async()=>{
  const f=await fixture();const output:string[]=[];
  try {
   await main(['init'],f.host,undefined,quiet);
   const runner:AgentRunner=async()=>({stdout:'',stderr:'',exitCode:0,timedOut:false,signal:null,cancelled:true});
   expect(await main(['run','--json','task'],f.host,undefined,s=>output.push(s),runner)).toBe(130);
   expect(JSON.parse(output[0]!)).toMatchObject({ok:false,result:{cancelled:true}});
  }finally{await f.cleanup();}
 });
 it('reconciles profile creation on retry and never syncs during init',async()=>{
  const f=await fixture(), b=bridge(f.host,f.shared);
  try {
   b.failCreate(); expect(await main(['init','--shared',f.shared],f.host,b.exec,quiet)).toBe(1);
   await expect(readFile(join(f.host,'.mda/config.json'))).rejects.toMatchObject({code:'ENOENT'});
   b.allowCreate();expect(await main(['init','--shared',f.shared],f.host,b.exec,quiet)).toBe(0);
   const original=await readFile(join(f.host,'.mda/config.json'),'utf8');
   expect(await main(['init'],f.host,b.exec,quiet)).toBe(0);
   expect(await readFile(join(f.host,'.mda/config.json'),'utf8')).toBe(original);
   expect(b.calls.filter(a=>a[0]==='sync')).toHaveLength(0);
   expect(b.calls.filter(a=>a[0]==='create')).toHaveLength(2);
   expect(await main(['start'],f.host,b.exec,quiet)).toBe(0);
   expect(b.calls.at(-1)?.[0]).toBe('start');
   expect(await main(['stop'],f.host,b.exec,quiet)).toBe(0);
   expect(b.calls.at(-1)?.[0]).toBe('stop');
  }finally{await f.cleanup();}
 });
 it('stops using only local profile even with unavailable shared storage',async()=>{
  const f=await fixture(), b=bridge(f.host,f.shared);
  try {
   expect(await main(['init','--shared',f.shared],f.host,b.exec,quiet)).toBe(0);
   await rm(f.shared,{recursive:true}); b.setMismatch(); b.setConflict();
   const count=b.calls.length;
   expect(await main(['stop'],f.host,b.exec,quiet)).toBe(0);
   expect(b.calls.slice(count)).toEqual([['stop',(await loadConfig(f.host,{requireShared:false})).profile!]]);
  }finally{await f.cleanup();}
 });
 it('blocks conflicts and mismatched endpoints before running an agent',async()=>{
  const f=await fixture(), b=bridge(f.host,f.shared); let runs=0;
  const runner:AgentRunner=async()=>{runs++;return {stdout:'',stderr:'',exitCode:0,timedOut:false,signal:null};};
  try {
   await main(['init','--shared',f.shared],f.host,b.exec,quiet);
   b.setConflict(); expect(await main(['run','task'],f.host,b.exec,quiet,runner)).toBe(21);expect(runs).toBe(0);
   b.setMismatch();expect(await main(['sync'],f.host,b.exec,quiet)).toBe(1);
  }finally{await f.cleanup();}
 });
 it('syncs around the hardened runner and preserves agent failure separately from outbound conflicts',async()=>{
  const f=await fixture(), b=bridge(f.host,f.shared);
  try {
   await main(['init','--shared',f.shared],f.host,b.exec,quiet);
   const runner:AgentRunner=async(config,args,options)=>{
    expect(config.timeout).toBe(120000);expect(args).toContain('workspace-write');expect(args).not.toContain('--skip-git-repo-check');
    expect(options.onStdout).toBeTypeOf('function');expect(b.calls.at(-1)?.[0]).toBe('sync');b.setConflict();
    return {stdout:'',stderr:'provider failed',exitCode:9,timedOut:false,signal:null};
   };
   expect(await main(['run','task'],f.host,b.exec,quiet,runner)).toBe(9);
   expect(b.calls.filter(a=>a[0]==='sync')).toHaveLength(2);
  }finally{await f.cleanup();}
 });
 it('rejects regular files, nested roots and moved/copied configs',async()=>{
  const f=await fixture();
  try {
   const file=join(f.root,'file');await writeFile(file,'x');
   expect(await main(['init','--shared',file],f.host,undefined,quiet)).toBe(1);
   expect(await main(['init','--shared',f.root],f.host,undefined,quiet)).toBe(1);
   expect(await main(['init'],f.host,undefined,quiet)).toBe(0);
   const moved=join(f.root,'moved');await rename(f.host,moved);
   await expect(loadConfig(moved)).rejects.toThrow('folder moved');
  }finally{await f.cleanup();}
 });
 it('emits one JSON envelope and applies opt-in agent policies',async()=>{
  const f=await fixture();const output:string[]=[];
  try {
   expect(await main(['init','--json'],f.host,undefined,s=>output.push(s))).toBe(0);
   expect(JSON.parse(output[0]!)).toMatchObject({schemaVersion:1,ok:true});
   const path=join(f.host,'.mda/config.json'),config=JSON.parse(await readFile(path,'utf8'));
   await writeFile(path,JSON.stringify({...config,model:'custom-model',instructions:'literal "text"',skipGitRepoCheck:true,timeout:1000}));
   const runner:AgentRunner=async(config,args,options)=>{
    expect(config.timeout).toBe(1000);expect(args).toContain('--skip-git-repo-check');expect(args).toContain('custom-model');
    expect(args).toContain('developer_instructions="literal \\"text\\""');expect(options.onStdout).toBeUndefined();
    return {stdout:'result',stderr:'',exitCode:0,timedOut:false,signal:null};
   };
   expect(await main(['run','--json','--','task'],f.host,undefined,quiet,runner)).toBe(0);
  }finally{await f.cleanup();}
 });
});
