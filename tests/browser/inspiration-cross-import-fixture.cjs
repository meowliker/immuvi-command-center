module.exports=function crossImport(data,input) {
  const fail=(message)=>({code:'P0001',message});
  const receipts=data.crossImportReceipts ||= new Map();
  const prior=receipts.get(input.p_request_id);
  if(prior)return JSON.stringify(prior.input)===JSON.stringify(input)?prior.result:fail('Request identity conflicts');
  const sources=input.p_items.map((item)=>({item,row:data[item.kind==='winner'?'ads':'inspirations'].find((row)=>row.product_id===item.sourceProductId && row.id===item.sourceId)}));
  if(sources.some(({item,row})=>!row || row.updated_at!==item.version))return fail('Source changed. Refresh sources and select again.');
  let imported=0;
  const items=sources.map(({item,row})=>{
    const key=item.kind==='winner'?'_sourceAdId':'_sourceInsId';
    let target=data.inspirations.find((entry)=>entry.product_id===input.p_product_id && entry.data?._sourceProductId===item.sourceProductId && entry.data?.[key]===item.sourceId);
    const existing=!!target;
    if(!target) {
      const content=row.data || row.meta || {};
      target={id:`QAF-INS-${String(data.inspirations.length+1).padStart(3,'0')}`,product_id:input.p_product_id,title:row.title || row.format_name,status:row.status==='Saved'?'Saved':'Classified',url:row.url || row.ad_link,updated_at:new Date().toISOString(),created_at:new Date().toISOString(),data:{formatName:row.title || row.format_name,creativeHypothesis:content.creativeHypothesis,_clickupDocPageUrl:content._clickupDocPageUrl || content._sourceInspirationBriefUrl,_sourceProductId:item.sourceProductId,_sourceProductName:'Second QA',[key]:item.sourceId,reusedIn:[]}};
      data.inspirations.push(target);imported++;
    }
    return {...item,id:target.id,status:existing?'existing':'imported'};
  });
  const result={requestId:input.p_request_id,productId:input.p_product_id,operation:'cross_import',items,imported,existing:items.length-imported,dispatchEnabled:false};
  receipts.set(input.p_request_id,{input,result});return result;
};
