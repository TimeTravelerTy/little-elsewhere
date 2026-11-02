import { DatabaseSync } from 'node:sqlite';
import { mkdirSync,existsSync } from 'node:fs';
import { resolve } from 'node:path';
try { process.loadEnvFile('.env'); } catch {}
const input=resolve(process.env.DATABASE_PATH||'data/world.sqlite');
if(!existsSync(input))throw new Error('Start the village before making a backup.');
const dir=resolve(process.env.BACKUP_DIR||'data/backups');mkdirSync(dir,{recursive:true});
const target=resolve(dir,`elsewhere-${new Date().toISOString().replaceAll(':','-')}.sqlite`);
const db=new DatabaseSync(input);db.exec('PRAGMA busy_timeout=10000');db.prepare('VACUUM INTO ?').run(target);db.close();console.log(target);
