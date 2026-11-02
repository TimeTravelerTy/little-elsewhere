import { mkdirSync,openSync,writeFileSync,readFileSync,closeSync,unlinkSync } from 'node:fs';
import { dirname } from 'node:path';
export function acquireWorldLock(databasePath:string):()=>void{
  const path=databasePath+'.lock';mkdirSync(dirname(path),{recursive:true});
  try {const previous=JSON.parse(readFileSync(path,'utf8')) as {pid:number};if(previous.pid!==process.pid){try{process.kill(previous.pid,0);throw new Error(`This world is already running in process ${previous.pid}. Stop it before starting another server.`);}catch(e){if((e as NodeJS.ErrnoException).code!=='ESRCH')throw e;}}unlinkSync(path);}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  const fd=openSync(path,'wx',0o600);writeFileSync(fd,JSON.stringify({pid:process.pid,started:new Date().toISOString()}));closeSync(fd);
  return()=>{try{const current=JSON.parse(readFileSync(path,'utf8'));if(current.pid===process.pid)unlinkSync(path);}catch{/* Lock already removed. */}};
}
