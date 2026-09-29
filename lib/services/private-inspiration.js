import { privateDecrypt, constants } from 'node:crypto';
import { Marked } from 'marked';
import { assertQaClickUpList } from '../domain/clickup-sync.js';

export const TEST_LIST = '1301130000002447';
export const TEST_WORKSPACE = '9016762494';
export function publicAdUrl(value) {
  const unsupported = 'Use a public Facebook, Instagram, TikTok, YouTube or Google Drive video file URL.';
  let url;
  try { url = new URL(value); } catch { throw new Error(unsupported); }
  const domains = ['facebook.com', 'instagram.com', 'tiktok.com', 'youtube.com', 'youtu.be'];
  if (url.protocol !== 'https:' || url.username || url.password || url.port) throw new Error(unsupported);
  if (['drive.google.com', 'docs.google.com', 'drive.usercontent.google.com'].includes(url.hostname)) {
    // Match the file URL forms handled by the legacy yt-dlp GoogleDrive extractor.
    const pathId = url.pathname.match(/^\/file\/d\/([\w-]{28,})(?:\/(?:view|preview|edit))?\/?$/)?.[1];
    const queryId = /^\/(?:open|uc|download)$/.test(url.pathname) && url.searchParams.getAll('id').length === 1
      ? url.searchParams.get('id') : '';
    if (!pathId && !/^[\w-]{28,}$/.test(queryId || '')) {
      throw new Error('Use a Google Drive video file link, not a folder or document link. The file must be viewable and downloadable without signing in.');
    }
  } else if (!domains.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))) {
    throw new Error(unsupported);
  }
  return url.href;
}

const nonempty = value => typeof value === 'string' && !!value.trim();
const briefMarkdown = new Marked({ gfm:true, async:false });
export function briefContentMatches(expected, actual) {
  // ClickUp rewrites bullets, escapes and table spacing. Compare their parsed
  // output, preserving words, links and structure; never render this HTML in UI.
  return nonempty(expected) && nonempty(actual)
    && briefMarkdown.parse(expected) === briefMarkdown.parse(actual);
}
export function clickUpBriefMarkdown(markdown) {
  const source = markdown.replace(/\r\n?/g, '\n');
  const rules = [];
  let cursor = 0;
  // ClickUp rewrites thematic breaks as dashes before parsing. Without a blank
  // line, a preceding paragraph becomes a setext heading. Preserve all content,
  // including reference definitions and fenced code, using parsed block tokens.
  for (const token of briefMarkdown.lexer(source)) {
    const start = source.indexOf(token.raw, cursor);
    if (start < 0) throw new Error('Could not locate brief formatting for ClickUp.');
    if (token.type === 'hr') rules.push({ start, end: start + token.raw.length });
    cursor = start + token.raw.length;
  }
  let prepared = source;
  for (const { start, end } of rules.reverse()) {
    prepared = prepared.slice(0, start) + '\n\n' + source.slice(start, end) + '\n\n' + prepared.slice(end);
  }
  if (!briefContentMatches(markdown, prepared)) throw new Error('ClickUp formatting changed brief content.');
  return prepared;
}
export function briefSectionText(value, depth = 0) {
  if (depth > 8) throw new Error('Brief section nesting is too deep.');
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    if (!value.length) return '';
    const entries = value.map(item => briefSectionText(item,depth+1));
    if (entries.some(text => !text)) throw new Error('Brief section contains an empty item.');
    return entries.map(text => `- ${text.replaceAll('\n','\n  ')}`).join('\n');
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).map(([key,item]) => {
      const text = briefSectionText(item,depth+1);
      if (!key.trim() || !text) throw new Error('Brief section contains an empty item.');
      return `${key.replaceAll('_',' ')}: ${text}`;
    });
    return entries.join('\n\n');
  }
  throw new Error('Brief section must contain text.');
}
export function validateInspirationResult(result, media) {
  if (result?.status === 'failed' || result?.ready_to_mark_ok === false) {
    const reasons=Array.isArray(result.failure_reasons)?result.failure_reasons.filter(nonempty).join(' ').slice(0,400):'';
    throw new Error(`Classifier could not verify source evidence; no brief was published.${reasons?' '+reasons:''}`);
  }
  const { metadata: m, classification: c, brief: b, markdown } = result || {};
  if (!m || !c || !b || !nonempty(markdown)) throw new Error('Classifier returned an incomplete brief.');
  for (const field of ['hook_type','creative_structure','production_style','funnel_type','persona','angle','creative_usp','creative_hypothesis','notes']) {
    if (!nonempty(c[field])) throw new Error(`Missing classification: ${field}.`);
  }
  if (!nonempty(m.page_name) || !['TOF','MOF','BOF'].includes(c.funnel_type)) throw new Error('Brand or funnel classification is missing.');
  if (c.media_kind !== media.media_kind || m.media_kind !== media.media_kind
    || !(media.media_kind === 'image' ? ['Photo'] : media.media_kind === 'carousel' ? ['Carousel','Photo'] : ['Video','UGC','VSL','AI Style']).includes(c.photo_video)) throw new Error('Classification contradicts downloaded media.');
  if (!Array.isArray(m.caption_timeline) || !Array.isArray(m.voice_over_timeline)) throw new Error('Caption and narration timelines are required.');
  // Legacy writeback resolves narration from classification, then metadata,
  // then brief. It does not require the model to repeat identical aliases.
  const voice = [c.voice_over,m.voice_over,b.voice_over].find(nonempty)?.trim() || '';
  if (!voice) {
    const visualEvidence = m.caption_timeline.some(row => nonempty(row?.caption))
      || (Array.isArray(b.frame_by_frame) && b.frame_by_frame.some(row => nonempty(row?.caption_voice_over)));
    if (!visualEvidence || !nonempty(c.notes)) throw new Error('Unverified narration requires explained uncertainty and a verified visual breakdown.');
    m.audio_verification={status:'unverified',reason:c.notes};
    const snapshot=markdown.split(/^## 2\\?\. /m)[0];
    if (/^\s*(?:\*\*)?Voice Over(?:\*\*)?\s*:/im.test(snapshot)) throw new Error('Unverified narration must be omitted from the snapshot, as in legacy.');
  }
  m.voice_over=voice;c.voice_over=voice;b.voice_over=voice;
  if (!voice || voice === 'No voice over') {
    m.voice_over_timeline=[];c.voice_over_timeline=[];b.voice_over_timeline=[];
  }
  if (voice && media.media_kind === 'video' && media.metadata?.audio_probe?.has_audio && !media.metadata.voice_over?.trim()) throw new Error('Audio transcription is unverified; leave narration blank rather than guessing.');
  if (voice && voice !== 'No voice over' && !media.metadata?.voice_over?.trim()) throw new Error('Narration has no audio source.');
  for (const field of ['why_it_works','replication_brief','what_to_test','competitor_intel','our_next_ad','inspiration_script_skeleton']) {
    // Legacy records contain both prose and structured bullet sections. Preserve
    // their content while adapting to the QA importer's text-only contract.
    if (b[field] !== undefined && b[field] !== null) b[field] = briefSectionText(b[field]);
    if (!nonempty(b[field])) throw new Error(`Missing brief section: ${field}.`);
  }
  if (!Array.isArray(b.frame_by_frame) || !b.frame_by_frame.length || !Array.isArray(b.next_ad_scripts) || b.next_ad_scripts.length !== 3) throw new Error('A breakdown and exactly three scripts are required.');
  for (const script of b.next_ad_scripts) {
    if (!script || typeof script !== 'object') throw new Error('Incomplete next-ad script.');
    script.source_format_match ||= script.sourceFormatMatch;
    script.script_breakdown ||= script.scriptBreakdown;
    for (const field of ['variation','intent','hook_text','source_format_match','voice_over_script','cta','what_to_change','why_it_should_work']) {
      if (!nonempty(script[field])) throw new Error(`Incomplete next-ad script: ${field}.`);
    }
    if (!Array.isArray(script.script_breakdown) || !script.script_breakdown.length
      || script.script_breakdown.some(row => !row || ['time','label','caption_voice_over','visual_beat','editor_note'].some(key => !nonempty(row[key])))) throw new Error('Timed script table is incomplete.');
  }
  // Legacy asks the model to preserve the reference where possible; its verifier
  // checks complete scripts, not literal equality of observed and proposed times.
  if (/audio present;? exact transcript not verified|transcript unavailable|use the source link for full caption|<br\s*\/?\s*>/i.test(JSON.stringify(result))) throw new Error('Brief contains a forbidden placeholder or HTML line break.');
  validateBriefMarkdown(markdown);
  return { ...result, duration_seconds: media.duration, frames_extracted: media.frames.length };
}

export function validateBriefMarkdown(markdown) {
  const inlineText = tokens => tokens.map(token => token.tokens ? inlineText(token.tokens) : token.text || '').join('');
  const normalized = text => text.trim().replace(/\s+/g, ' ').toLowerCase();
  const blocks = briefMarkdown.lexer(markdown);
  const headings = ['SNAPSHOT','CREATIVE BREAKDOWN','WHY IT WORKS','REPLICATION BRIEF','WHAT TO TEST','COMPETITOR INTEL','OUR NEXT AD','NEXT AD SCRIPTS'];
  let sectionStart = -1;
  for (let i=0;i<headings.length;i++) {
    const index = blocks.findIndex((block, position) => position > sectionStart && block.type === 'heading' && block.depth === 2
      && normalized(inlineText(block.tokens)).replace(/^(\d+)\s*\.?\s*/, '$1. ') === `${i+1}. ${headings[i].toLowerCase()}`);
    if (index < 0) throw new Error(`Brief page is missing section ${i+1}.`);
    sectionStart = index;
  }
  const section = blocks.slice(sectionStart + 1);
  const text = section.filter(block => block.type !== 'code').map(block => block.raw).join('\n');
  const tables = section.filter(block => block.type === 'table');
  const headers = table => table.header.map(cell => normalized(inlineText(cell.tokens)).replace(/\s*\/\s*/g, ' / '));
  const snapshots = tables.filter(table => {
    const names = headers(table);
    return names.length === 2 && ['field','strategy snapshot'].includes(names[0]) && ['direction','value'].includes(names[1]);
  });
  const scripts = tables.filter(table => headers(table).join('|') === 'time|label|caption / voice over|visual beat|editor notes');
  if (!/Inspiration Script Skeleton/i.test(text) || !/Voice[- ]over Script/i.test(text)
    || snapshots.length < 3 || scripts.length < 3
    || snapshots.some(table => !table.rows.some(row => normalized(inlineText(row[0].tokens)) === 'source format match' && nonempty(inlineText(row[1].tokens))))
    || scripts.some(table => !table.rows.length || table.rows.some(row => row.some(cell => !nonempty(inlineText(cell.tokens)))))) {
    throw new Error('Brief page does not preserve the legacy three-script table format.');
  }
}

export function verifyLibraryDocument(doc, id) {
  if (!/^[\w-]+$/.test(id || '') || doc?.id !== id || String(doc.workspace_id) !== TEST_WORKSPACE) throw new Error('The QA library identity or workspace could not be verified.');
  if (String(doc.parent?.id) !== TEST_LIST || ![6,'6','LIST'].includes(doc.parent?.type)) throw new Error(`The QA library is not attached to the approved test list (parent type ${String(doc.parent?.type)}, id ${String(doc.parent?.id)}).`);
  if (doc.deleted || doc.archived) throw new Error('The QA library is archived or deleted.');
  // ClickUp returns public:false for this connector-created PUBLIC library.
  // Do not equate that response flag with the requested workspace visibility.
}

export function libraryPages(value) {
  const roots = Array.isArray(value) ? value : value?.pages;
  if (!Array.isArray(roots)) throw new Error('ClickUp library page listing is incomplete.');
  const pages=[],seen=new Set();
  function visit(rows,depth=0) {
    if (depth>30) throw new Error('ClickUp page nesting is too deep.');
    for (const page of rows) {
      if (!/^[\w-]+$/.test(page?.id || '') || seen.has(page.id)) throw new Error('ClickUp library page identity is ambiguous.');
      seen.add(page.id);pages.push(page);
      if (Array.isArray(page.pages)) visit(page.pages,depth+1);
      if (Array.isArray(page.children)) visit(page.children,depth+1);
    }
  }
  visit(roots);return pages;
}

export function masterTrackerMarkdown(name,rows) {
  const cell=value=>String(value || '-').replaceAll('|','\\|').replace(/[\r\n]+/g,' ');
  return `# Master Tracker - ${cell(name)} Inspirations\n\n| ID | Brand | Platform | Angle | Persona | Hook | Funnel | Status | Brief |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- |\n`+rows.map(row=>{
    const url=row.url;
    if (!/^https:\/\/app\.clickup\.com\/9016762494\/docs\/[\w-]+\/[\w-]+$/.test(url || '')) throw new Error('Invalid tracker brief link.');
    return `| ${[row.id,row.brand,row.platform,row.angle,row.persona,row.hook,row.funnel,row.status].map(cell).join(' | ')} | [Open](${url}) |`;
  }).join('\n');
}

export async function deliverPrivateBrief({ job, result, privateKey, checkpoint, fetchImpl = fetch, signal }) {
  assertQaClickUpList(job.context.listId);
  const libraryResume=job.context.libraryDocId && (!job.doc_id || job.doc_id===job.context.libraryDocId);
  if (job.context.listId !== TEST_LIST || (!libraryResume && (job.doc_id || job.delivery_started)) || !/^\d+$/.test(String(job.brief_number))) throw new Error('Delivery requires review; refusing a duplicate or non-test document.');
  const token = privateDecrypt({ key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, Buffer.from(job.sealed_clickup_token,'base64')).toString();
  validateBriefMarkdown(result.markdown || '');
  const deliveryMarkdown = clickUpBriefMarkdown(result.markdown);
  const visibility = job.context.docVisibility || 'PRIVATE';
  if (!['PRIVATE','PUBLIC'].includes(visibility)) throw new Error('Invalid brief visibility.');
  async function request(path, method='GET', body, stage='verify destination') {
    const response = await fetchImpl(`https://api.clickup.com/api/${path}`, { method, redirect:'error', signal: AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(30000)]),
      headers: { Authorization:token, 'Content-Type':'application/json' }, ...(body?{body:JSON.stringify(body)}:{}) });
    if (!response.ok) {
      // Keep only a bounded provider error code, never its response body or token.
      const payload = await response.json().catch(()=>null);
      const rawCode = payload?.ECODE || payload?.code;
      const code = typeof rawCode === 'string' && /^[A-Z][A-Z0-9_]{1,39}$/.test(rawCode) && !rawCode.includes(token) ? rawCode : '';
      const failures = Array.isArray(payload?.meta?.authorization_failures) ? payload.meta.authorization_failures : [];
      const denied = failures.slice(0,3).flatMap(failure => {
        const type = failure?.object_type;
        if (typeof type !== 'string' || !/^[a-z_]{1,30}$/.test(type)) return [];
        const permissions = Array.isArray(failure.invalid_permissions)
          ? failure.invalid_permissions.filter(value => typeof value === 'string' && /^can_[a-z_]{1,40}$/.test(value)).slice(0,4) : [];
        return permissions.length ? [`${type}: ${permissions.join(', ')}`] : [];
      }).join('; ');
      if ((stage === 'create Doc' || (stage === 'create brief page' && job.context.libraryDocId)) && [400,401,403,404,422,429].includes(response.status)) {
        await checkpoint('delivery-rejected',{status:response.status,code});
      }
      const hint = response.status === 403
        ? 'The ClickUp account cannot create or access this Doc with the requested permissions. Check Docs access and visibility.'
        : response.status === 401 ? 'Reconnect your ClickUp key.' : 'Review delivery before retrying.';
      throw new Error(`ClickUp ${stage} failed (${response.status}${code?`, ${code}`:''}).${denied?` Missing permission (${denied}).`:''} ${hint} Your generated brief is saved.`);
    }
    if (response.status===204) return {};
    const bodyText=await response.text();
    // ClickUp page updates return HTTP 200 with an empty body, not JSON.
    if (method==='PUT' && !bodyText.trim()) return {};
    return JSON.parse(bodyText);
  }
  const list = await request(`v2/list/${TEST_LIST}`);
  if (String(list.id) !== TEST_LIST) throw new Error('ClickUp test list could not be verified.');
  if (job.context.libraryDocId) {
    if (visibility!=='PUBLIC') throw new Error('The QA library must use its approved workspace visibility setting.');
    const id=job.context.libraryDocId, trackerId=job.context.libraryTrackerPageId;
    if (!/^[\w-]+$/.test(id) || !/^[\w-]+$/.test(trackerId || '')) throw new Error('Set up the QA Inspiration Library and Master Tracker first.');
    const root=`v3/workspaces/${TEST_WORKSPACE}/docs/${id}`;
    verifyLibraryDocument(await request(root),id);
    const pages=libraryPages(await request(`${root}/page_listing?max_page_depth=-1`));
    if (!pages.some(page=>page.id===trackerId && /Master Tracker/.test(page.name || ''))) throw new Error('QA Master Tracker could not be verified.');
    const title=`test immuvi brief-${job.brief_number}`;
    const matches=pages.filter(page=>page.name===title || page.name===job.inspiration_id || page.name?.startsWith(`${job.inspiration_id} `));
    if (matches.length>1 || matches.some(page=>page.id===trackerId)) throw new Error('Multiple brief pages match this inspiration; review before updating.');
    if (job.page_id && matches[0]?.id!==job.page_id) throw new Error('Saved page receipt differs from the library listing.');
    if (job.delivery_started && !matches.length) throw new Error('Previous page creation has an uncertain outcome; refusing to create a duplicate.');
    await checkpoint('result',result);
    if (!job.delivery_started) await checkpoint('delivery-start');
    if (!job.doc_id) await checkpoint('doc',{id});
    const existing=matches[0];
    const content={name:title,sub_title:`${job.inspiration_id} | ${result.metadata?.page_name || ''}`,content:deliveryMarkdown,content_format:'text/md'};
    const page=existing
      ? (await request(`${root}/pages/${existing.id}`,'PUT',content,'update brief page'),existing)
      : await request(`${root}/pages`,'POST',content,'create brief page');
    if (!/^[\w-]+$/.test(page.id || '')) throw new Error('ClickUp did not return a page receipt.');
    if (!job.page_id) await checkpoint('page',{id:page.id});
    const saved=await request(`${root}/pages/${page.id}?content_format=text%2Fmd`);
    validateBriefMarkdown(saved.content || '');
    if (!briefContentMatches(result.markdown,saved.content)) throw new Error('Saved ClickUp page differs from the generated brief.');
    const rows=await checkpoint('tracker-rows');
    if (!Array.isArray(rows)) throw new Error('Could not load the QA library tracker.');
    const tracker=masterTrackerMarkdown(job.context.product?.name || 'QA',rows);
    await request(`${root}/pages/${trackerId}`,'PUT',{content:tracker,content_format:'text/md'},'update Master Tracker');
    await checkpoint('complete');
    return {docId:id,pageId:page.id};
  }
  await checkpoint('result', result);
  // Mark the non-idempotent boundary before POST. Lost responses never cause a
  // blind retry that could create duplicate documents or paid generations.
  await checkpoint('delivery-start');
  const root = `v3/workspaces/${TEST_WORKSPACE}/docs`;
  const doc = await request(root,'POST',{ name:`test immuvi brief-${job.brief_number}`, parent:{id:TEST_LIST,type:6},visibility,create_page:false },'create Doc');
  if (!/^[\w-]+$/.test(doc.id || '')) throw new Error('ClickUp did not return a document receipt.');
  await checkpoint('doc',{id:doc.id});
  const verified = await request(`${root}/${doc.id}`);
  if (String(verified.parent?.id) !== TEST_LIST || ![6,'6','LIST'].includes(verified.parent?.type)) throw new Error('Document is not attached to the approved test list.');
  const page = await request(`${root}/${doc.id}/pages`,'POST',{ name:`test immuvi brief-${job.brief_number}`,content:deliveryMarkdown,content_format:'text/md' },'create brief page');
  if (!/^[\w-]+$/.test(page.id || '')) throw new Error('ClickUp did not return a page receipt.');
  await checkpoint('page',{id:page.id});
  const saved = await request(`${root}/${doc.id}/pages/${page.id}?content_format=text%2Fmd`);
  validateBriefMarkdown(saved.content || '');
  if (!briefContentMatches(result.markdown,saved.content)) throw new Error('Saved ClickUp page differs from the generated brief. Review delivery before retrying.');
  await checkpoint('complete');
  return { docId:doc.id,pageId:page.id };
}
