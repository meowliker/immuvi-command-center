// Reviewed source provenance, not fuzzy matching or target category counts.
export const sourceTaxonomyRepair = [
  ['angles','ang-manual-mumgb7oo-r3naaj','Relationship Growth & Understanding','ARI-INS-214: inspiration-local angle'],
  ['angles','ang-manual-mumj6cx6-s1am2a','Soulmate Sketch Recognition','ARI-INS-220: inspiration-local angle before later reuse'],
  ['angles','ang-manual-mumj6cx6-wqsefh','Guided Confidence Reset','ARI-INS-215: skincare source, product fit explicitly unverified'],
  ['personas','per-manual-mumgb7ol-3bmq09',null,'Instruction paragraph was promoted as a persona'],
  ['personas','per-manual-mumgb7ol-pd90yj','Trend-Aware Snack Shoppers','ARI-INS-206: snack-buyer persona explicitly inspiration-local'],
  ['personas','per-manual-mumgb7ol-szli53','Astrology Practitioners','ARI-INS-209: source sells practitioner software, not consumer readings'],
  ['personas','per-manual-mumgb7om-0jhdnj','Professional Astrologers','ARI-INS-208: B2B buyer explicitly inspiration-local'],
  ['personas','per-manual-mumgb7om-p9avv7',null,'Scene-specific breakup paragraph promoted as a master persona'],
  ['personas','per-manual-mumgb7oo-d0s68s','Couples Strengthening Their Relationship','ARI-INS-214: inspiration-local persona'],
  ['personas','per-manual-mumj6cx6-ac6kjw','People Seeking Clarity About an Ex','ARI-INS-221: inspiration-local persona before later reuse'],
  ['personas','per-manual-mumj6cx6-eumjqv','Adults Seeking Personal Clarity','ARI-INS-215: skincare source, buyer fit explicitly unverified'],
  ['personas','per-manual-mumj6cx6-ggjntm','Adults Questioning an Ex-Partner Connection','ARI-INS-220: inspiration-local persona'],
  ['personas','per-manual-mumj6cx6-h4gyc3','Romantic Seekers Curious About Their Future Spouse','ARI-INS-217: inspiration-local persona before later reuse'],
  ['personas','per-manual-mumj6cx6-iss2vn','Romantic Seekers Curious About Hidden Feelings','ARI-INS-218: inspiration-local persona'],
  ['personas','per-manual-mumj6cx6-xw4o2d','Adults Questioning a Past Relationship','ARI-INS-222: inspiration-local persona'],
  ['angles','ang-auto-1781941408010-0','Monetize Your Canva Skills','Sewing INS-047: winning format imported from Canva'],
  ['angles','ang-auto-1784705064106-0','Medical Weight Loss Offer','ADH-INS-090: TrimRx GLP-1 offer'],
  ['angles','ang-manual-mtlfu85v-uivr4u','side hustle / quick income angle','ADHD INS-164/165: soap-business and Canva source labels'],
  ['personas','per-manual-mtlfu85v-a1dhzs','Side-Hustle Sellers','ADHD INS-164/165: soap-business and Canva source buyer'],
  ['angles','ang-auto-1785412283534-0','Natural Wellness Remedies','KMH-INS-161: herbal medicine source'],
  ['personas','per-auto-1782983294521-5','ADHD Adults Seeking Focus','PAT-INS-042/043/044: therapy/ADHD sources; later reused for patchwork'],
  ['personas','per-manual-mtdz7t5k-2x29jw','Concerned Parents Seeking Emotional Skills','PAT-INS-106: Kids Mental Health source, inspiration-local'],
  ['personas','per-manual-muatfeaz-vx08nb','Parents of Kids','YN-INS-077/078: source quilting persona, explicitly inspiration-local'],
  ['personas','per-manual-muatfeaz-wfjqvw','Quilting Hobbyists','YN-INS-077 notes and YN-085-INS-077: source-only quilter buyer'],
  ['personas','per-manual-muatfeb1-r7f4tf','Female Teachers 25-44','Yoga INS-084: Art Therapy source, inspiration-local'],
  ['personas','per-auto-1786602708403-0','Value-anchored giveaway','T-INS-092: hair-care offer mechanic stored as a persona'],
  ['personas','per-auto-1786971486549-0','Kindergarten Teachers','M-INS-059: children classroom activity source, inspiration-local'],
  ['personas','per-manual-mu12lgki-2t5m8e','Home Gardeners Preserving Harvest','M-INS-144: pickle-making source, inspiration-local'],
  ['personas','per-auto-1786784697503-3','Mom Nursing Students 30-45','Paramedic INS-038: Medical import; inspiration already adapted to Mom Paramedic Students'],
  ['personas','per-auto-1786784697504-4','ADHD Adults Seeking Practical Resources','PN-INS-003: first aid study book; ADHD source label on PN-015-INS-003 is not the current buyer']
];

export function buildSourceRepairPlan(tables) {
  return sourceTaxonomyRepair.map(([table,id,name,reason])=>{
    const row=tables[table].find(row=>row.id===id);
    if(!row || row.archived_at || (name!==null && row.name!==name)) throw new Error('Repair target changed: '+id);
    if(row.notes || row.source_link) throw new Error('Review manually annotated category: '+id);
    if(name===null && row.name.length<100) throw new Error('Expected malformed paragraph: '+id);
    return {table,row,reason};
  });
}

export function auditAllProducts(tables,plan) {
  const key=s=>String(s||'').toLowerCase().trim();
  return tables.products.map(product=>({
    id:product.id,name:product.name,
    categories:['angles','personas'].flatMap(table=>tables[table].filter(row=>row.product_id===product.id).map(row=>{
      const field=table==='angles'?'angle':'persona';
      const inspirations=tables.inspirations.filter(i=>i.product_id===product.id&&key(i.data?.[field])===key(row.name));
      const decision=plan.find(p=>p.table===table&&p.row.id===row.id);
      return {table,id:row.id,name:row.name,archived:!!row.archived_at,decision:decision?'archive-source-label':'preserve',reason:decision?.reason||null,
        creativeIds:tables.ads.filter(a=>a.product_id===product.id&&!a.deleted_at&&key(a[field])===key(row.name)).map(a=>a.id),
        sources:inspirations.map(i=>({id:i.id,brand:i.data.brand,scope:i.data['_'+field+'Scope']||null})),
        reviewOnly:!row.archived_at&&!decision&&(row.name.length>85||inspirations.some(i=>i.data['_'+field+'Scope']==='inspiration'))};
    }))
  }));
}
