import { it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { main, type AgentRunner } from '../cli/main.js';
import type { Execute } from '../integration/exec.js';
const fsRoot=resolve(import.meta.dirname,'../../../foldersynka');
it.skipIf(!existsSync(join(fsRoot,'core/cli/router.sh')))('integrates with actual neighboring FolderSynka without syncing .mda or invoking live agents',async()=>{
 const root=await mkdtemp(join(tmpdir(),'mda-bridge-'));
 try {
  const host=join(root,'host folder'),shared=join(root,'shared folder'),home=join(root,'home'),prefix=join(root,'prefix');
  for(const path of [host,shared,home,prefix]) await mkdir(path);
  const execute:Execute=async(file,args,cwd)=>new Promise((resolve,reject)=>{
   expect(file).toBe('foldersynka');
   execFile('bash',[join(fsRoot,'core/cli/router.sh'),...args],{cwd,encoding:'utf8',timeout:20000,env:{...process.env,HOME:home,PREFIX:prefix,FS_HOME:fsRoot,FS_RUNTIME:join(home,'.foldersynka')}},(error,stdout,stderr)=>{
    if(error && typeof error.code!=='number') reject(error);
    else resolve({stdout,stderr,code:typeof error?.code==='number'?error.code:0});
   });
  });
  const output:string[]=[];const out=(s:string)=>output.push(s);
  await writeFile(join(shared,'hello.txt'),'shared initial');
  expect(await main(['init','--shared',shared],host,execute,out),output.join('\n')).toBe(0);
  expect(existsSync(join(host,'hello.txt'))).toBe(false);
  const runner:AgentRunner=async()=>{
   expect(await readFile(join(host,'hello.txt'),'utf8')).toBe('shared initial');
   await writeFile(join(host,'hello.txt'),'agent change');
   return {stdout:'offline',stderr:'',exitCode:0,timedOut:false,signal:null};
  };
  expect(await main(['run','offline task'],host,execute,out,runner),output.join('\n')).toBe(0);
  expect(await readFile(join(shared,'hello.txt'),'utf8')).toBe('agent change');
  expect(existsSync(join(shared,'.mda'))).toBe(false);
  await writeFile(join(shared,'hello.txt'),'human conflict');await writeFile(join(host,'hello.txt'),'host conflict');
  let runs=0;const blocked:AgentRunner=async()=>{runs++;throw new Error('must not run');};
  expect(await main(['run','blocked'],host,execute,out,blocked)).toBe(21);expect(runs).toBe(0);
  expect(await readFile(join(shared,'hello.txt'),'utf8')).toBe('human conflict');
  expect(await readFile(join(host,'hello.txt'),'utf8')).toBe('host conflict');
 }finally{await rm(root,{recursive:true,force:true});}
},20000);
