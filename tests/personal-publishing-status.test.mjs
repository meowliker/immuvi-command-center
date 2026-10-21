import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
for(const file of ['../immuvi-command-center.html','../public/immuvi-command-center.html']){
  test(file+': publishing review is explicit without changing unrelated queue/lifecycle states',()=>{
    const source=readFileSync(new URL(file,import.meta.url),'utf8');
    const start=source.indexOf('function _insQueueDisplayStatus('),end=source.indexOf('function _insQueueIsWorkerBlocked(',start);
    const sandbox={window:{},_insQueueIsWorkerBlocked:()=>false};vm.createContext(sandbox);vm.runInContext(source.slice(start,end),sandbox);
    const display=(status,error_message,worker_assignment='private',lifecycle='Queued')=>sandbox._insQueueDisplayStatus({id:'fixture',status:lifecycle},{fixture:{status,error_message,worker_assignment}});
    assert.equal(display('blocked','Brief verification needs review [BRIEF_READBACK_MISMATCH].'),'Brief needs review');
    assert.equal(display('blocked','Brief publishing needs review. Analysis preserved.'),'Brief needs review');
    assert.equal(display('blocked','Brief verification needs review','shared'),'Blocked');
    assert.equal(display('blocked','Source unavailable'),'Blocked');
    assert.equal(display('classified',''),'Classified');assert.equal(display('classified','','private','Testing'),'Testing');
    assert.equal(display('private_publishing',''),'Classifying');
    assert.match(source,/status === 'Blocked' && effectiveStatus === 'Brief needs review'/);
  });
}
