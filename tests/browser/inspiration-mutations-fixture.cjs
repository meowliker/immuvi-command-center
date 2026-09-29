const assert = require('node:assert/strict');
module.exports = function inspirationMutation(data, input, control) {
  const {p_product_id:product,p_request_id:key,p_operation:operation,p_id:id,p_values:values} = input;
  (control.inspirationCalls ||= []).push(structuredClone(input));
  const receipts = control.inspirationReceipts ||= new Map();
  const reject = (message) => ({code:'P0001',message});
  if (receipts.has(key)) { const old=receipts.get(key); assert.deepEqual(old.input,input); return structuredClone(old.result); }
  let row=data.inspirations.find((item)=>item.id===id && item.product_id===product);
  let queue=data.inspiration_queue.find((item)=>item.ins_id===id && item.product_id===product);
  if (operation!=='create' && (!row || row.updated_at!==input.p_expected_updated_at)) return reject('Inspiration changed. Reopen it before saving; your draft has been kept.');
  if (operation!=='create') assert.deepEqual(values.queue,queue || null);
  const mapping=values.mapping;let targetId=null;
  if(mapping) {
    const items=data[mapping.kind==='angle'?'angles':'personas'];
    if(mapping.mode==='existing') {
      const target=items.find((item)=>item.id===mapping.targetId && item.product_id===product);
      if(!target || target.archived_at || target.updated_at!==mapping.targetVersion || target.name!==values.fields[mapping.kind])return reject('Taxonomy entry changed or is unavailable. Reopen mapping.');
      targetId=target.id;
    } else if(mapping.mode==='new' && items.some((item)=>item.product_id===product && item.name.toLowerCase().trim()===values.fields[mapping.kind].toLowerCase().trim()))return reject('This taxonomy name already exists, possibly archived.');
  }
  const stamp = new Date(Date.now()+(control.inspirationSequence=(control.inspirationSequence || 0)+1)).toISOString();
  const remoteAdIds=[];
  if (operation==='create') {
    if (data.inspirations.some((item)=>item.product_id===product && item.url===values.fields.sourceUrl)) return reject('This source URL already exists in this product.');
    row={id:`QAF-INS-${control.inspirationSequence}`,product_id:product,url:values.fields.sourceUrl,title:values.fields.formatName || values.fields.sourceUrl,platform:values.fields.platform,status:values.mode==='url'?'Blocked':'Saved',data:{...values.fields},created_at:stamp,updated_at:stamp};
    data.inspirations.push(row);
  } else if (operation==='save' || operation==='import') {
    let fields=values.fields;
    if (operation==='import') {
      const result=data.inspiration_results.find((item)=>item.id===values.result_id && item.product_id===product && item.ins_id===id);
      assert.equal(result.classified_at,values.result_at);
      if (!result.brief?.next_ad_scripts) return reject('Eight-section brief is incomplete: next_ad_scripts');
      fields={formatName:result.classification.creative_usp,_classificationBrief:result.brief,nextAdScripts:result.brief.next_ad_scripts,_qaImportedResultId:result.id,_qaImportedResultAt:result.classified_at};
      row.status='Classified';
    }
    if (fields.formatName && fields.formatName!==row.data.formatName) {
      const children=data.ads.filter((ad)=>ad.product_id===product && ad.meta?._fromInspoId===id && !ad.deleted_at);
      assert.deepEqual(values.children,children.map((ad)=>({id:ad.id,version:ad.updated_at})).sort((a,b)=>a.id.localeCompare(b.id)));
      for (const ad of children) {
        ad.format_name=fields.formatName;ad.updated_at=stamp;
        if (ad.clickup_task_id) remoteAdIds.push(ad.id);
        for (const action of data.manual_actions.filter((item)=>item.payload.adId===ad.id)) action.payload.title=fields.formatName;
      }
      row.title=fields.formatName;
    }
    const detail=Object.hasOwn(fields,'formatDetail')?fields.formatDetail: (row.data.creativeUSP || '').split(' \u2014 ').slice(1).join(' \u2014 ');
    if(Object.hasOwn(fields,'formatDetail') || fields.formatName)row.data.creativeUSP=(fields.formatName || row.data.formatName || row.title)+(detail?' \u2014 '+detail:'');
    const stored={...fields};delete stored.formatDetail;
    row.data={...row.data,...stored};
    if(Object.hasOwn(fields,'addedBy'))row.added_by=fields.addedBy;
  } else if (operation==='approve') row.status='Approved';
  else if (operation==='dismiss_duplicate') {row.data._dupeBannerDismissed=true;row.data._qaDupeReviewSignature=values.duplicateSignature;}
  else if (operation==='delete') {
    data.inspirations=data.inspirations.filter((item)=>item!==row);
    data.inspiration_queue=data.inspiration_queue.filter((item)=>item!==queue);
    data.inspiration_results=data.inspiration_results.filter((item)=>item.ins_id!==id || item.product_id!==product);
    queue=null;
  }
  if (operation==='requeue' || (operation==='create' && values.mode==='url')) {
    if (!queue) { queue={id:`JOB-${row.id}`,ins_id:row.id,product_id:product,url:row.url,platform:row.platform};data.inspiration_queue.push(queue); }
    Object.assign(queue,{status:'blocked',attempts:0,claimed_by:null,claimed_at:null,processed_at:null,queued_at:stamp,worker_assignment:'blocked:qa-isolation',error_message:'QA classifier is disabled.'});
    row.status='Blocked';
  }
  row.updated_at=stamp;
  if(mapping) {
    if(mapping.mode==='new') {
      targetId=`QA-MAPPED-${key}`;data[mapping.kind==='angle'?'angles':'personas'].push({id:targetId,product_id:product,name:values.fields[mapping.kind],status:'Untested',updated_at:stamp,created_at:stamp});
    }
    Object.assign(row.data,{[`_${mapping.kind}Scope`]:mapping.mode==='custom'?'inspiration':'product',[`_needs${mapping.kind==='angle'?'Angle':'Persona'}Review`]:false,[`_${mapping.kind}PromptDone`]:true});
  }
  const result={requestId:key,productId:product,operation,id:row.id,row:operation==='delete'?null:structuredClone(row),deleted:operation==='delete',remoteAdIds,queue:queue || null,dispatchEnabled:false};
  if(mapping)result.mapping={...mapping,name:values.fields[mapping.kind],targetId};
  receipts.set(key,{input:structuredClone(input),result:structuredClone(result)});
  if(control.corruptInspirationFieldAck) {
    const field=control.corruptInspirationFieldAck;control.corruptInspirationFieldAck=null;
    return {...result,row:{...result.row,data:{...result.row.data,[field]:'Incorrect returned field'}}};
  }
  if (control.loseInspirationAck || (control.loseInspirationId && control.loseInspirationId===id)) { control.loseInspirationAck=false;control.loseInspirationId=null;return {...result,requestId:'lost-ack'}; }
  return result;
};
