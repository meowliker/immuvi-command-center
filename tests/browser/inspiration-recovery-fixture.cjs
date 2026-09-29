const assert=require('node:assert/strict');
module.exports=function recover(data,input,control) {
  const receipts=control.recoveryReceipts ||= new Map(),reject=(message)=>({code:'P0001',message});
  if(receipts.has(input.p_request_id)){const prior=receipts.get(input.p_request_id);assert.deepEqual(prior.input,input);return structuredClone(prior.result);}
  const q=data.inspiration_queue.find((row)=>row.id===input.p_queue_id && row.product_id===input.p_product_id);
  if(!q)return reject('Queue entry is no longer available');
  if(JSON.stringify(q)!==JSON.stringify(input.p_expected_queue))return reject('Queue changed. Close recovery and reopen the entry.');
  if(!['failed','error','blocked','classified','done','completed'].includes(q.status))return reject('Only terminal or blocked queue entries can be recovered');
  if(data.inspirations.some((row)=>row.id===q.ins_id))return reject('Source identity already exists. Refresh the library.');
  const old=structuredClone(q),row={id:q.ins_id,product_id:q.product_id,url:q.url,title:q.ins_id,platform:q.platform,status:'Blocked',created_at:q.queued_at,updated_at:new Date().toISOString(),data:{formatName:q.ins_id,_qaRecoveredQueue:old}};
  data.inspirations.push(row);Object.assign(q,{status:'blocked',worker_assignment:'blocked:qa-isolation',claimed_by:null,claimed_at:null,error_message:'Classifier dispatch is disabled in QA until an isolated test worker and destination are verified.'});
  const result={requestId:input.p_request_id,productId:input.p_product_id,operation:'recover',id:q.ins_id,row:structuredClone(row),queue:structuredClone(q),dispatchEnabled:false};
  receipts.set(input.p_request_id,{input:structuredClone(input),result:structuredClone(result)});return result;
};
