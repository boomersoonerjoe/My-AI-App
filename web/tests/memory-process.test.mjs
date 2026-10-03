import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';

it('reopens persisted memory in a fresh process with no previous chat/runtime state', () => {
  const directory = mkdtempSync(join(tmpdir(), 'nhomeai-memory-test-'));
  try {
    for (const name of ['types', 'memory', 'storage', 'context']) {
      const source = readFileSync(new URL(`../src/${name}.ts`, import.meta.url), 'utf8');
      const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
      writeFileSync(join(directory, `${name}.cjs`), js.replace(/require\("\.\/(\w+)"\)/g, 'require("./$1.cjs")'));
    }
    writeFileSync(join(directory, 'run.cjs'), `
const fs=require('node:fs'); const file=__dirname+'/state.json';
function read(){try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch(error){if(error.code==='ENOENT')return {};throw error}}
global.localStorage={getItem(key){return read()[key]??null},setItem(key,value){fs.writeFileSync(file,JSON.stringify({...read(),[key]:value}))}};
const {loadData,saveData}=require('./storage.cjs'); const {emptyData}=require('./types.cjs');
const {memoryCommand,upsertMemory}=require('./memory.cjs'); const {buildPrompt}=require('./context.cjs');
if(process.argv[2]==='save'){
 const data=emptyData(); data.memories=upsertMemory([],memoryCommand('Remember this: my project codename is Cedar Lantern 8642.'));
 saveData(data); console.log('Saved');
}else{
 const data=loadData(); const c={id:'separate',title:'New chat',messages:[{id:'question',role:'user',text:'What is my project codename?',createdAt:''}]};
 console.log(JSON.stringify({memories:data.memories,conversations:data.conversations,prompt:buildPrompt(c,data.memories)}));
}
`);
    const run = mode => execFileSync(process.execPath, [join(directory, 'run.cjs'), mode], { encoding: 'utf8' });
    expect(run('save')).toContain('Saved');
    const reopened = JSON.parse(run('reopen'));
    expect(reopened.conversations).toEqual([]);
    expect(reopened.memories).toHaveLength(1);
    expect(reopened.prompt).toContain('Cedar Lantern 8642');
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
