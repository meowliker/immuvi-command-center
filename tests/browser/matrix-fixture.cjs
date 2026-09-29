// Synthetic UI backend only; SQL transaction tests cover actual persistence.
module.exports=function matrixRpc(data,name,input) {
  const stamp=new Date().toISOString();
  const angle=data.angles.find((a) => a.id===input.p_angle_id),persona=data.personas.find((p) => p.id===input.p_persona_id);
  let cell=data.matrix_cells.find((c) => c.product_id===input.p_product_id && c.angle_id===angle.id && c.persona_id===persona.id);
  if (!cell) { cell={id:`cell-${data.matrix_cells.length}`,product_id:input.p_product_id,angle_id:angle.id,persona_id:persona.id,creative_assignments:[],meta:{},updated_at:stamp};data.matrix_cells.push(cell); }
  cell.meta ||= {};
  if(name==='qa_matrix_assignment') {
    cell.creative_assignments=cell.creative_assignments.filter((id) => id!==input.p_ad_id);
    cell.meta._excludedCreativeIds=(cell.meta._excludedCreativeIds||[]).filter((id) => id!==input.p_ad_id);
    (input.p_assigned ? cell.creative_assignments : cell.meta._excludedCreativeIds).push(input.p_ad_id);
    cell.updated_at=stamp;return cell;
  }
  if(name!=='qa_matrix_create') throw new Error(`Unknown matrix RPC ${name}`);
  const replay=data.ads.filter((ad)=>ad.product_id===input.p_product_id && ad.meta?._matrixRequestId===input.p_request_id);
  if(replay.length) return replay.map((ad)=>ad.id);
  if(input.p_kind==='inspiration') {
    for(const item of input.p_items) {
      const source=data.inspirations.find((row)=>row.id===item.sourceId && row.product_id===input.p_product_id);
      if(!source || source.updated_at!==item.version) return {code:'P0001',message:'Inspiration changed. Refresh before creating.'};
      if(!['saved','classified','approved','testing'].includes(source.status.toLowerCase())) return {code:'P0001',message:'Inspiration is not ready'};
    }
  }
  const ids=[];
  const product=data.products.find((p) => p.id===input.p_product_id),words=product.name.trim().split(/\s+/);
  const prefix=(words.length>1 ? words[0][0]+words[1][0] : words[0].slice(0,2)).toUpperCase();
  product.config._qaMatrixNameSerials ||= {};
  for(const item of input.p_items) {
    const source=data.ads.find((a) => a.id===item.sourceId),inspo=data.inspirations.find((i) => i.id===item.sourceId);
    const existing=input.p_kind==='inspiration' && data.ads.find((ad)=>ad.product_id===input.p_product_id && !ad.deleted_at && ad.meta?._fromInspoId===item.sourceId && ad.angle===angle.name && ad.persona===persona.name);
    if(existing) {if(!cell.creative_assignments.includes(existing.id))cell.creative_assignments.push(existing.id);ids.push(existing.id);continue;}
    const id=`matrix-new-${data.ads.length}`;
    const meta=input.p_kind==='tracker' ? {...source.meta,taskType:'production',sourceFormatId:source.id,_sourceFormatName:source.format_name}
      : input.p_kind==='inspiration' ? {...inspo.data,_fromInspoId:inspo.id,taskType:'production'} : {creativeHypothesis:item.hypothesis,notes:item.notes,taskType:'production'};
    meta._matrixRequestId=input.p_request_id;
    const serial=(product.config._qaMatrixNameSerials[prefix]||0)+1;
    if(input.p_kind!=='blank') product.config._qaMatrixNameSerials[prefix]=serial;
    const suffix=source?.format_name || (inspo?.id.match(/INS-\d+/i)?.[0]||inspo?.id);
    const ad={id,product_id:input.p_product_id,format_name:item.name||`${prefix}-${String(serial).padStart(3,'0')}-${suffix}`,
      angle:angle.name,persona:persona.name,status:'Untested',ad_type:item.adType||source?.ad_type||inspo?.data?.adType||'',
      funnel_stage:item.funnelStage||source?.funnel_stage||inspo?.data?.funnelStage||'',drive_link:'',meta,created_at:stamp,updated_at:stamp};
    data.ads.push(ad);cell.creative_assignments.push(id);ids.push(id);
    if(input.p_kind==='inspiration') {inspo.status='Testing';inspo.updated_at=stamp;}
  }
  cell.updated_at=stamp;return ids;
};
