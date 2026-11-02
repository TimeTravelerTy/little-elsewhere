import { DatabaseSync } from 'node:sqlite';
import { readFileSync,copyFileSync,mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/server/store.ts';
import { Engine } from '../src/server/engine.ts';
import { Intelligence } from '../src/server/ai.ts';
const source=process.argv[2];if(!source)throw new Error('Usage: npm run restore-check -- path/to/backup.sqlite');
const dir=mkdtempSync(join(tmpdir(),'elsewhere-restore-'));try{const target=join(dir,'restored.sqlite');copyFileSync(source,target);const db=new DatabaseSync(target);const integrity=db.prepare('PRAGMA integrity_check').get();if(Object.values(integrity||{})[0]!=='ok')throw new Error('Integrity check failed');db.close();const store=new Store(target);const before=store.load();if(!before)throw new Error('No saved world in backup');const e=new Engine(store,new Intelligence(store,undefined));e.tick(1);if(e.state.minute!==before.minute+1)throw new Error('Could not resume restored world');console.log(JSON.stringify({integrity:'ok',residents:e.state.residents.length,sequence:e.state.sequence,resumed:true,bytes:readFileSync(source).length},null,2));store.close();}finally{rmSync(dir,{recursive:true,force:true});}
