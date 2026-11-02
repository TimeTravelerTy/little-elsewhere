import { spawn } from 'node:child_process';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
const dir=mkdtempSync(join(tmpdir(),'elsewhere-http-'));const port=3107,base=`http://127.0.0.1:${port}`,token='integration-only-'.repeat(4);
let child:ReturnType<typeof spawn>|undefined;
async function start(){child=spawn(process.execPath,['--import','tsx','src/server/index.ts'],{env:{...process.env,PORT:String(port),HOST:'127.0.0.1',OWNER_TOKEN:token,OPENROUTER_API_KEY:'',DATABASE_PATH:join(dir,'world.sqlite')},stdio:['ignore','pipe','pipe']});let output='';child.stdout?.on('data',c=>output+=c);child.stderr?.on('data',c=>output+=c);for(let i=0;i<100;i++){if(child.exitCode!==null)throw new Error(`Server exited: ${output}`);try{const r=await fetch(base+'/api/world');if(r.status===401)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw new Error('Server failed to start');}
async function stop(){if(!child||child.exitCode!==null)return;const done=new Promise<void>(resolve=>child!.once('exit',()=>resolve()));child.kill('SIGTERM');await done;}
async function login(){const r=await fetch(base+'/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token})});assert.equal(r.status,200);return r.headers.get('set-cookie')!.split(';')[0];}
try{
  await start();assert.equal((await fetch(base+'/api/world')).status,401);
  assert.equal((await fetch(base+'/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token:'wrong'})})).status,401);
  const cookie=await login(),headers={cookie};const first=await fetch(base+'/api/world',{headers}).then(r=>r.json());assert.equal(first.state.residents.length,12);
  assert.equal((await fetch(base+'/api/world',{headers:{cookie,origin:'https://untrusted.example'}})).status,403);
  assert.equal((await fetch(base+'/api/world',{method:'POST',headers})).status,404);
  await new Promise<void>((resolve,reject)=>{const ws=new WebSocket(base.replace('http','ws')+'/live');ws.on('unexpected-response',(_req,res)=>{assert.equal(res.statusCode,403);res.destroy();ws.terminate();resolve();});ws.on('error',()=>{});setTimeout(()=>reject(new Error('Unauthenticated websocket was not rejected')),3000).unref();});
  await new Promise<void>((resolve,reject)=>{const ws=new WebSocket(base.replace('http','ws')+'/live',{headers:{cookie,origin:base}});ws.once('message',raw=>{const message=JSON.parse(String(raw));assert.equal(message.type,'snapshot');assert.ok(message.sequence>=first.state.sequence);ws.close();resolve();});ws.on('error',reject);});
  const events=await fetch(base+'/api/events?after=0',{headers}).then(r=>r.json());assert.ok(events.length>=1);assert.equal(events[0].id,1);
  const prior=await fetch(base+'/api/world',{headers}).then(r=>r.json());await stop();await start();assert.equal((await fetch(base+'/api/world',{headers})).status,401);const newCookie=await login();const restored=await fetch(base+'/api/world',{headers:{cookie:newCookie}}).then(r=>r.json());assert.equal(restored.state.minute,prior.state.minute);assert.equal(restored.state.sequence,prior.state.sequence);
  console.log('Integration checks passed: protected APIs, login, origin checks, read-only world, protected WebSocket snapshots, event-gap recovery, session invalidation, and persistent restart.');
}finally{await stop();rmSync(dir,{recursive:true,force:true});}
