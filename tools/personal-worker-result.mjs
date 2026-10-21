import {fromMarkdown} from 'mdast-util-from-markdown';
import {gfmFromMarkdown} from 'mdast-util-gfm';
import {gfm} from 'micromark-extension-gfm';

const required = ['brand','angle','persona','hook_type','creative_structure','production_style','funnel_type','photo_video','media_kind'];
const sections = ['SNAPSHOT','CREATIVE BREAKDOWN','WHY IT WORKS','REPLICATION BRIEF','WHAT TO TEST','COMPETITOR INTEL','OUR NEXT AD','NEXT AD SCRIPTS'];
export class PersonalWorkerError extends Error {
  constructor(message, status=400) { super(message); this.status=status; }
}
const reject = message => { throw new PersonalWorkerError(message); };
const pick=(value,keys)=>Object.fromEntries(keys.filter(key=>Object.hasOwn(value,key)).map(key=>[key,value[key]]));
export function briefContentMatches(actual,expected){
  if(typeof actual!=='string'||typeof expected!=='string'||!actual.trim()||!expected.trim()||actual.length>180000||expected.length>180000)return false;
  // Parse content, retaining word boundaries, link destinations, table cells and
  // ordered-list starts. Bullet glyphs, escapes and table alignment are syntax.
  const canonical=node=>{
    const out={type:node.type};
    for(const key of ['depth','ordered','checked','url','title','identifier','label','alt','lang','meta']){
      if(node[key]!=null)out[key]=node[key];
    }
    if(node.ordered)out.start=node.start;
    if(typeof node.value==='string')out.value=node.type==='text'?node.value.replace(/\s+/g,' '):node.value;
    if(node.children)out.children=node.children.map(canonical);
    return out;
  };
  try{
    const parse=value=>canonical(fromMarkdown(value,{extensions:[gfm()],mdastExtensions:[gfmFromMarkdown()]}));
    return JSON.stringify(parse(actual))===JSON.stringify(parse(expected));
  }catch{return false;}
}
export function validatePersonalResult(raw, context, now=new Date().toISOString()) {
  if (!raw || typeof raw!=='object' || Array.isArray(raw)) reject('Invalid result artifact');
  for (const field of ['ins_id','product_id','source_url']) {
    if (raw[field]!==context[field]) reject('Result source or product does not match the assigned job');
  }
  if (!raw.classification || !raw.metadata || typeof raw.classification!=='object' || typeof raw.metadata!=='object' ||
      Array.isArray(raw.classification) || Array.isArray(raw.metadata)) reject('Classification and metadata are required');
  const c=pick(raw.classification,[...required,'format_name','creative_usp','creative_hypothesis','notes',
    'angle_needs_review','persona_needs_review','voice_over','voice_over_timeline']);
  const m=pick(raw.metadata,['source_url','media_sha256','evidence_summary','page_name','body_text','hook_text',
    'caption_transcript','caption_timeline','audio_probe','ad_id','text_evidence','drive_media_selection',
    'selected_drive_file_id','selected_drive_file_name','selected_drive_file_sha256','source_assets',
    'title','headline','cta_text','cta_type','landing_url','link_url']);
  const b=raw.brief;
  for (const key of required) {
    if (typeof c[key]!=='string' || !c[key].trim() || c[key].length>500) reject('Missing classification field: '+key);
  }
  if (!['video','image','carousel','text'].includes(c.media_kind)) reject('Invalid media kind');
  if ((c.media_kind==='image' && c.photo_video!=='Photo') ||
      (c.media_kind==='carousel' && !['Photo','Carousel'].includes(c.photo_video)) ||
      (c.media_kind==='video' && ['Photo','Carousel','Text'].includes(c.photo_video)) ||
      (c.media_kind==='text' && c.photo_video!=='Text')) reject('Media kind and creative type disagree');
  if (m.source_url!==context.source_url || typeof m.evidence_summary!=='string' || m.evidence_summary.trim().length<40) reject('Source-scoped evidence is required');
  if (typeof m.media_sha256!=='string' || !/^[a-f0-9]{64}$/.test(m.media_sha256)) reject('Downloaded evidence checksum is required');
  if (!Number.isInteger(raw.frames_extracted) || raw.frames_extracted<0 || raw.frames_extracted>500 ||
      !Number.isFinite(raw.duration_seconds) || raw.duration_seconds<0 || raw.duration_seconds>86400) reject('Invalid media measurements');
  if (!Array.isArray(m.caption_timeline) || !Array.isArray(c.voice_over_timeline)) reject('Caption and narration timelines are required');
  if (c.media_kind==='video') {
    if (raw.frames_extracted<1 || typeof m.audio_probe?.method!=='string' ||
        !['present','absent','uncertain'].includes(m.audio_probe.narration)) reject('Visual and local audio evidence are required');
    if (m.audio_probe.local_only!==true) reject('Audio must be verified locally');
    if (!context.no_brief && (m.audio_probe.narration==='uncertain' || !c.voice_over?.trim())) reject('Narration needs verification before publishing a brief');
    if (m.audio_probe.narration==='absent' && (c.voice_over!=='No voice over' || c.voice_over_timeline.length)) reject('Music-only media must not contain invented narration');
    if (m.audio_probe.narration==='present' && (!c.voice_over?.trim() || c.voice_over==='No voice over' || !c.voice_over_timeline.length)) reject('Verified narration needs its source timeline');
    if (m.audio_probe.narration==='uncertain') {
      if (c.voice_over || c.voice_over_timeline.length || typeof m.audio_probe.limitations!=='string' || m.audio_probe.limitations.length<20) reject('Unverified narration must stay blank with a recorded limitation');
      m.voice_over_status='unverified';
    }
  }
  const source=new URL(context.source_url);
  if (/(^|\.)facebook\.com$/.test(source.hostname) && source.pathname.includes('/ads/library')) {
    if (!source.searchParams.get('id') || m.ad_id!==source.searchParams.get('id')) reject('Facebook evidence must match the exact requested ad ID');
  }
  if (c.media_kind==='text') {
    if (m.text_evidence?.source_url!==context.source_url || !m.text_evidence?.title ||
      typeof m.text_evidence?.body!=='string' || m.text_evidence.body.length<40 || raw.frames_extracted!==0) reject('The complete original text is required');
    if(!/(^|\.)reddit\.com$/.test(source.hostname)||!source.pathname.includes('/comments/')||
      !['public_http','web_reader'].includes(m.text_evidence.retrieval_method)||!Number.isFinite(Date.parse(m.text_evidence.retrieved_at))||
      c.production_style!=='Text Post'||c.voice_over!=='No voice over'||c.voice_over_timeline.length||m.caption_timeline.length||raw.duration_seconds!==0) reject('Text evidence must not invent media or narration');
  }
  if (context.selection) {
    if (!m.drive_media_selection || Object.keys(context.selection).some(key=>m.drive_media_selection[key]!==context.selection[key]) ||
      m.selected_drive_file_id!==context.selection.file_id || m.selected_drive_file_name!==context.selection.file_name ||
      m.selected_drive_file_sha256!==m.media_sha256 || m.source_assets?.length!==1 ||
      m.source_assets[0]!==context.selection.file_name) reject('Result must cover only the selected Drive file');
  }
  const markdown=raw.markdown||'';
  if (context.no_brief) {
    if (markdown || (b && Object.keys(b).length)) reject('No Brief must not generate a brief or scripts');
  } else {
    if (typeof markdown!=='string' || markdown.length<1500 || markdown.length>180000 || !markdown.includes(context.source_url)) reject('A complete source-linked brief is required');
    const headings=[...markdown.matchAll(/^##\s+(\d)\\?\.\s+([^\n]+)$/gm)];
    if (headings.length!==8 || headings.some((h,i)=>Number(h[1])!==i+1 || h[2].trim().toUpperCase()!==sections[i])) reject('All eight brief sections are required');
    if (!b || !Array.isArray(b.next_ad_scripts) || b.next_ad_scripts.length!==3) reject('Exactly three next-ad scripts are required');
    for (const script of b.next_ad_scripts) {
      if (!script.name || !script.voice_over_script || !Array.isArray(script.script_breakdown) || !script.script_breakdown.length || !script.source_format_match) reject('Each next-ad script needs a complete script and breakdown');
    }
    if ((markdown.match(/\|\s*Time\s*\|\s*Label\s*\|\s*Caption \/ Voice Over\s*\|/g)||[]).length<4) reject('The source and three script breakdown tables are required');
  }
  const angleMatched=context.angles.includes(c.angle) && c.angle_needs_review!==true;
  const personaMatched=context.personas.includes(c.persona) && c.persona_needs_review!==true;
  const classification={...c,angle_matched:angleMatched,persona_matched:personaMatched};
  const patch={formatName: String(c.format_name||c.creative_usp||c.angle).slice(0,200),
    brand:c.brand,angle:c.angle,persona:c.persona,hookType:c.hook_type,creativeStructure:c.creative_structure,
    productionStyle:c.production_style,funnelStage:c.funnel_type,adType:c.photo_video,mediaKind:c.media_kind,
    sourceUrl:context.source_url,bodyCopy:m.body_text||m.text_evidence?.body||'',hookText:m.hook_text||'',
    captionTranscript:m.caption_transcript||'',captionTimeline:m.caption_timeline,
    voiceOver:c.voice_over||'',voiceOverTimeline:c.voice_over_timeline,creativeHypothesis:c.creative_hypothesis||'',
    duration_seconds:raw.duration_seconds,notes:c.notes||'',detectedAngle:c.angle,detectedPersona:c.persona,
    _angleScope:angleMatched?'product':'inspiration',_personaScope:personaMatched?'product':'inspiration',
    _needsAngleReview:!angleMatched,_needsPersonaReview:!personaMatched,
    _angleLocked:true,_personaLocked:true,_anglePromptDone:true,_personaPromptDone:true,classifiedAt:context.created_at||now,
    noBrief:context.no_brief};
  if(c.media_kind==='text')patch.textEvidence=m.text_evidence;
  if (!context.no_brief) patch.nextAdScripts=b.next_ad_scripts;
  if (context.selection) Object.assign(patch,{sourceMediaSelection:context.selection,
    selectedMediaFileId:context.selection.file_id,selectedMediaFileName:context.selection.file_name});
  // No caller-provided patch, page URL, device identity or arbitrary record keys
  // are accepted. Taxonomy suggestions remain local to this inspiration.
  return {classification,metadata:m,brief:context.no_brief?{}:b,markdown,patch,
    duration_seconds:raw.duration_seconds,frames_extracted:raw.frames_extracted};
}
