const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const trackerRpc = require('./tracker-fixture.cjs');
const testTracker = require('./tracker-flow.cjs');
const testTaxonomyRelationships = require('./taxonomy-relationships-flow.cjs');
const taxonomyMutation = require('./taxonomy-mutations-fixture.cjs');
const testTaxonomyMutations = require('./taxonomy-mutations-flow.cjs');
const testTaxonomyRename = require('./taxonomy-rename-flow.cjs');
const productAdministration = require('./product-administration-fixture.cjs');
const testProductAdministration = require('./product-administration-flow.cjs');
const adminAccess = require('./admin-access-fixture.cjs');
const testAdminAccess = require('./admin-access-flow.cjs');
const accountOperation = require('./account-operations-fixture.cjs');
const testAccountOperations = require('./account-operations-flow.cjs');
const accountCreation = require('./account-creation-fixture.cjs');
const testAccountCreation = require('./account-creation-flow.cjs');
const staleCleanup = require('./stale-ad-cleanup-fixture.cjs');
const testStaleCleanup = require('./stale-ad-cleanup-flow.cjs');
const workerPause = require('./worker-controls-fixture.cjs');
const testWorkerControls = require('./worker-controls-flow.cjs');
const testTaxonomyAdminFinal = require('./taxonomy-admin-final-flow.cjs');
const matrixRpc = require('./matrix-fixture.cjs');
const testMatrix = require('./matrix-flow.cjs');
const creationFixture = require('./creation-fixture.cjs');
const testCreation = require('./creation-flow.cjs');
const planBatch = require('./action-plan-fixture.cjs');
const testPlan = require('./action-plan-flow.cjs');
const planFields = require('./action-plan-fields-fixture.cjs');
const testPlanFields = require('./action-plan-fields-flow.cjs');
const testPlanViews = require('./action-plan-views-flow.cjs');
const planCreative = require('./action-plan-creative-fixture.cjs');
const testPlanCreative = require('./action-plan-creative-flow.cjs');
const testPlanLayouts = require('./action-plan-layouts-flow.cjs');
const testPlanTrends = require('./action-plan-trends-flow.cjs');
const testPlanHealth = require('./action-plan-health-flow.cjs');
const planCheckpoint = require('./action-plan-checkpoint-fixture.cjs');
const testPlanCheckpoint = require('./action-plan-checkpoint-flow.cjs');
const testPlanLinkedDone = require('./action-plan-linked-done-flow.cjs');
const testPlanPulse = require('./action-plan-pulse-flow.cjs');
const testPulsePeriod = require('./action-plan-pulse-period-flow.cjs');
const testPlanAge = require('./action-plan-age-flow.cjs');
const historyRows = require('./history-fixture.cjs');
const testPlanHistory = require('./action-plan-history-flow.cjs');
const testPlanFilters = require('./action-plan-filters-flow.cjs');
const testPlanVisibility = require('./action-plan-visibility-flow.cjs');
const testPlanAdoption = require('./action-plan-adoption-flow.cjs');
const testPlanDeletion = require('./action-plan-deletion-flow.cjs');
const testPlanRecreation = require('./action-plan-recreation-flow.cjs');
const planRecreation = require('./action-plan-recreation-fixture.cjs');
const testPlanOneScale = require('./action-plan-onescale-flow.cjs');
const testPlanVisual = require('./action-plan-visual-flow.cjs');
const testPlanTableParity = require('./action-plan-table-parity-flow.cjs');
const testImageProducer = require('./image-producer-flow.cjs');
const testPlanDrawer = require('./action-plan-drawer-flow.cjs');
const testModalDismiss = require('./modal-dismiss-flow.cjs');
const testPlanSelection = require('./action-plan-selection-flow.cjs');
const testPlanVariations = require('./action-plan-variations-flow.cjs');
const testVariationLab = require('./variation-lab-flow.cjs');
const testPlanMenus = require('./action-plan-menus-flow.cjs');
const testPlanDateMenu = require('./action-plan-date-menu-flow.cjs');
const testPlanCount = require('./action-plan-count-flow.cjs');
const testDetailCards = require('./action-plan-detail-cards-flow.cjs');
const testPlanAcceptance = require('./action-plan-acceptance-flow.cjs');
const testInspirationLibrary = require('./inspiration-library-flow.cjs');
const inspirationMutation = require('./inspiration-mutations-fixture.cjs');
const testInspirationMutations = require('./inspiration-mutations-flow.cjs');
const testInspirationPlacement = require('./inspiration-placement-flow.cjs');
const inspirationCrossImport = require('./inspiration-cross-import-fixture.cjs');
const testInspirationCrossImport = require('./inspiration-cross-import-flow.cjs');
const testInspirationAnalytics = require('./inspiration-analytics-flow.cjs');
const inspirationRecovery = require('./inspiration-recovery-fixture.cjs');
const testInspirationRecovery = require('./inspiration-recovery-flow.cjs');
const testInspirationBatch = require('./inspiration-batch-flow.cjs');
const testInspirationParity = require('./inspiration-parity-flow.cjs');
const testInspirationInline = require('./inspiration-inline-flow.cjs');
const testInspirationMapping = require('./inspiration-mapping-flow.cjs');
const testInspirationDuplicates = require('./inspiration-duplicates-flow.cjs');
const testFinalInspiration = require('./inspiration-final-flow.cjs');
const testProduction = require('./production-flow.cjs');
const testProductionTasks = require('./production-tasks-flow.cjs');
const testProductionFinal = require('./production-final-flow.cjs');
const testCommandHq = require('./command-hq-flow.cjs');
const testHqOperations = require('./command-hq-operations-flow.cjs');
const testHqFinal = require('./command-hq-final-flow.cjs');
const artifactDir = process.env.BROWSER_ARTIFACTS || path.join(os.tmpdir(), 'immuvi-realtime-browser');
const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000';
fs.mkdirSync(artifactDir, { recursive: true });
const stamp = new Date().toISOString();
const user = { id: '11111111-1111-4111-8111-111111111111', email: 'qa-fixture@example.test', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: stamp };
const jwt = [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' })).toString('base64url'), 'fixture-signature'].join('.');
const session = { access_token: jwt, refresh_token: 'fixture-refresh', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user };
const product = { id: 'qa-fixture', name: 'QA Fixture', updated_at: stamp, config: { clickup_list_id: '1301130000002447', clickup_list_name: 'QA Test List' } };
const errors = [];
const external = [];
const writes = [];
const results = [];
let browser;
async function makePage(role = 'admin', passwordChange = false, mobile = false) {
  const profile = { ...user, username: 'QA Fixture', full_name: 'QA Fixture', role, is_active: true, must_change_password: passwordChange, ap_dismissed_ad_ids: [] };
  const data = {
    profiles: [profile],
    profiles_with_products: [{ ...profile, product_ids: [product.id] }],
    user_products: [{ user_id: user.id, product_id: product.id }],
    products: [structuredClone(product), { id: 'qa-second', name: 'Second QA', config: {} }],
    angles: [{ id: 'ANG-1', product_id: product.id, name: 'Energy', status: 'Untested', notes: 'QA notes', created_at: stamp, updated_at: stamp }],
    personas: [{ id: 'PER-1', product_id: product.id, name: 'Busy people', status: 'Untested', created_at: stamp, updated_at: stamp }],
    ads: [{ id: 'AD-1', product_id: product.id, format_name: 'QA creative', angle: 'Energy', persona: 'Busy people', status: 'Untested', ad_type: 'Video', funnel_stage: 'TOF', meta: {}, created_at: stamp, updated_at: stamp }],
    deleted_ads: [],
    matrix_cells: [{ id: 'CELL-1', product_id: product.id, angle_id: 'ANG-1', persona_id: 'PER-1', creative_assignments: ['AD-1'] }],
    manual_actions: [{ id: 'ACTION-1', product_id: product.id, live_status: 'Untested', payload: { id: 'manual-test', title: 'QA action', adId: 'AD-1', angle: 'Energy', persona: 'Busy people' }, created_at: stamp, updated_at: stamp }],
    activity_events: [],
    task_video_winners: [],
    inspirations: [],
    qa_clickup_creations: [],
    competitor_brands: [{ id: 'BRAND-1', product_id: product.id, name: 'QA Brand', category: 'direct', approved: true, created_at: stamp }],
    competitor_research_queue: [], competitor_creatives: [],
    strategist_memory: [{ product_id: product.id, json: { strategy_layer: { angle: 'Energy' } }, markdown: '## QA memory\n\nTest narrative.', updated_at: stamp }],
    strategist_runs: [], strategist_recommendations: [],
    inspiration_queue: [{ id: 'JOB-1', product_id: product.id, url: 'https://example.test/ad', status: 'pending', queued_at: stamp, attempts: 0 }],
    worker_registry: [],
    qa_image_runs: [],
    variation_brief_queue: [],
    qa_image_worker: [],
  };
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 } });
  const channels = new Map();
  const requests = [];
  let nextSubscription = 1;
  let nextSocket = 1;
  const control = { holdNextAds: false, release: null, clickupFailure: false, clickupCalls: [] };
  await context.routeWebSocket(/supabase\.co\/realtime\//, (socket) => {
    const socketId = nextSocket++;
    socket.onMessage((raw) => {
      const [joinRef, ref, topic, event, payload] = JSON.parse(String(raw));
      if (event === 'phx_join') {
        const changes = payload.config.postgres_changes.map((change) => ({ ...change, id: nextSubscription++ }));
        channels.set(`${socketId}:${topic}`, { socket, topic, changes });
        socket.send(JSON.stringify([joinRef, ref, topic, 'phx_reply', { status: 'ok', response: { postgres_changes: changes } }]));
      } else if (event === 'phx_leave') {
        channels.delete(`${socketId}:${topic}`);
        socket.send(JSON.stringify([joinRef, ref, topic, 'phx_reply', { status: 'ok', response: {} }]));
      } else if (event === 'heartbeat') socket.send(JSON.stringify([null, ref, topic, 'phx_reply', { status: 'ok', response: {} }]));
    });
  });
  function emit(table, type, row) {
    for (const { socket, topic, changes } of channels.values()) {
      const ids = changes.filter((change) => change.table === table && change.event === type).map((change) => change.id);
      if (!ids.length) continue;
      const columns = Object.entries(row).map(([name, value]) => ({ name, type: typeof value === 'boolean' ? 'bool' : 'text' }));
      socket.send(JSON.stringify([null, null, topic, 'postgres_changes', {
        ids, data: { schema: 'public', table, type, commit_timestamp: new Date().toISOString(), columns, record: type === 'DELETE' ? {} : row, old_record: type === 'DELETE' ? row : {}, errors: null },
      }]));
    }
  }
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.hostname.endsWith('.supabase.co')) {
      if (url.hostname !== 'entgcnlfsnysnwyadzzp.supabase.co') throw new Error('Unexpected Supabase project');
      if (url.pathname === '/auth/v1/token') return json(session);
      if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204 });
      if (url.pathname === '/rest/v1/rpc/apply_qa_clickup_sync') {
        const input=request.postDataJSON();
        assert.equal(input.p_list_id,'1301130000002447');
        const product=data.products.find(row=>row.id===input.p_product_id);
        assert.ok(product);
        product.config.last_synced_at_ms=Date.now();product.config.last_synced_count=input.p_plan.fetched;
        emit('products','UPDATE',product);
        return json({fetched:input.p_plan.fetched,imported:0,updated:0,skipped:0});
      }
      if (url.pathname === '/rest/v1/rpc/qa_presence') {
        if(request.postDataJSON().p_leave)return json([]);
        if(control.presenceFailure){control.expectedPresenceFailures=(control.expectedPresenceFailures || 0)+1;return json({message:'Presence unavailable'},503);}
        const roster=control.onlineMembers || [{id:user.id,name:profile.username}];
        return json(roster.map(member=>member.id===user.id && request.postDataJSON().p_clickup_user_id==='42'?{...member,name:'QA ClickUp User'}:member));
      }
      if (url.pathname === '/rest/v1/rpc/qa_reload_state') return json({serverNow:new Date().toISOString(),latest:control.latestReload || null});
      if (url.pathname === '/rest/v1/rpc/qa_request_reload') {
        const input=request.postDataJSON();control.reloadRequests ||= [];
        control.reloadRequests.push(input);
        if(data.profiles[0].role!=='admin')return json({message:'Active QA administrator access is required'},403);
        control.latestReload ||= {id:input.p_request_id,actor_id:user.id,triggered_by:'QA admin',triggered_at:new Date().toISOString()};
        emit('qa_force_reloads','INSERT',control.latestReload);return json(control.latestReload);
      }
      if (url.pathname === '/auth/v1/user') {
        if (request.method() === 'PUT' && request.postDataJSON().password) {
          data.profiles[0].must_change_password = false; emit('profiles', 'UPDATE', data.profiles[0]);
          writes.push({ auth: 'password-update' });
        }
        return json(user);
      }
      if (url.pathname === '/rest/v1/rpc/qa_account_audit_page') {
        const before = request.postDataJSON().p_before;
        return json((data.account_audit || []).filter((row) => !before || BigInt(row.id) < BigInt(before)).sort((a,b) => Number(BigInt(b.id)-BigInt(a.id))).slice(0,50));
      }
      if (url.pathname === '/rest/v1/rpc/qa_admin_users_page') return json(adminAccess.page(data, request.postDataJSON().p_after));
      if (url.pathname === '/rest/v1/rpc/qa_private_workers_list') return json(data.qa_image_worker || []);
      if (url.pathname === '/rest/v1/rpc/qa_workers_page') {
        if (control.failWorkersRead) return json({ code: 'P0001', message: 'Worker read unavailable' }, 409);
        const after = request.postDataJSON().p_after;
        return json(data.worker_registry.filter((row) => !after || row.worker_id > after).sort((a,b) => a.worker_id < b.worker_id ? -1 : 1).slice(0,200));
      }
      if (url.pathname === '/rest/v1/rpc/qa_worker_pause') {
        const input = request.postDataJSON(); writes.push({ rpc: 'qa_worker_pause', input });
        const result = workerPause(data, input, control);
        if (control.loseWorkerAck) { control.loseWorkerAck = false; return json(null); }
        return json(result, result.code ? 409 : 200);
      }
      if (url.pathname === '/rest/v1/rpc/qa_admin_access_mutate') {
        const input = request.postDataJSON(); writes.push({ rpc: 'qa_admin_access_mutate', input });
        const result = adminAccess.mutate(data, input, control);
        if (control.loseAdminAccessAck) { control.loseAdminAccessAck = false; return json(null); }
        return json(result, result.code ? 409 : 200);
      }
      if (url.pathname === '/rest/v1/rpc/qa_product_delete_preview') return json(productAdministration.preview(data, request.postDataJSON().p_product_id));
      if (url.pathname === '/rest/v1/rpc/qa_product_mutate') {
        const input = request.postDataJSON(); writes.push({ rpc: 'qa_product_mutate', input });
        const result = productAdministration.mutate(data, input, control);
        if (control.loseProductAck) { control.loseProductAck = false; return json(null); }
        return json(result, result.code ? 409 : 200);
      }
      if (url.pathname === '/rest/v1/rpc/qa_taxonomy_rename_preview') {
        const input = request.postDataJSON();
        const result = await taxonomyMutation.preview(data, input);
        if (control.holdRenamePreview) { control.holdRenamePreview = false; await new Promise((resolve) => { control.releaseRenamePreview = resolve; }); }
        if (control.invalidRenamePreview) { control.invalidRenamePreview = false; return json(null); }
        return json(result, result.code ? 409 : 200);
      }
      if (url.pathname === '/rest/v1/rpc/qa_taxonomy_mutate') {
        const input = request.postDataJSON(); assert.equal(input.p_product_id, product.id);
        writes.push({ rpc: 'qa_taxonomy_mutate', input });
        if (control.holdTaxonomy) { control.holdTaxonomy = false; await new Promise((resolve) => { control.releaseTaxonomy = resolve; }); }
        const result = await taxonomyMutation(data, input, control);
        if (control.loseTaxonomyAck) { control.loseTaxonomyAck = false; return json(null); }
        return json(result, result.code ? 409 : 200);
      }
      if (url.pathname === '/rest/v1/rpc/qa_inspiration_recover') {
        const input=request.postDataJSON();assert.equal(input.p_product_id,product.id);
        writes.push({rpc:'qa_inspiration_recover',input});(control.recoveryCalls ||= []).push(input);
        const result=inspirationRecovery(data,input,control);
        if(control.loseRecoveryAck){control.loseRecoveryAck=false;return json(null);}
        return json(result,result?.code?409:200);
      }
      if (['/rest/v1/rpc/qa_inspiration_mutate','/rest/v1/rpc/qa_inspiration_detail','/rest/v1/rpc/qa_inspiration_mapping','/rest/v1/rpc/qa_inspiration_duplicate_review'].includes(url.pathname)) {
        const input=request.postDataJSON();assert.equal(input.p_product_id,product.id);
        writes.push({rpc:url.pathname.split('/').at(-1),input});
        const result=inspirationMutation(data,input,control);
        return json(result,result.code ? 409 : 200);
      }
      if(url.pathname==='/rest/v1/rpc/qa_inspiration_brief') {
        const input=request.postDataJSON();assert.equal(input.p_product_id,product.id);
        writes.push({rpc:'qa_inspiration_brief',input});(control.briefCalls ||= []).push(input);
        const receipts=control.briefReceipts ||= new Map();
        if(receipts.has(input.p_request_id))return json(receipts.get(input.p_request_id));
        const row=data.inspirations.find((item)=>item.id===input.p_id && item.product_id===input.p_product_id);
        if(!row || row.updated_at!==input.p_expected_updated_at)return json({code:'P0001',message:'Inspiration changed.'});
        row.data._clickupDocPageUrl=input.p_url;row.updated_at=new Date(Date.now()+100).toISOString();
        const result={requestId:input.p_request_id,productId:input.p_product_id,row:structuredClone(row),dispatchEnabled:false};receipts.set(input.p_request_id,result);
        if(control.loseBriefAck){control.loseBriefAck=false;return json(null);}return json(result);
      }
      if (url.pathname === '/rest/v1/rpc/qa_plan_checkpoint') {
        const input = request.postDataJSON(); assert.equal(input.p_product_id, product.id);
        writes.push({ rpc: 'qa_plan_checkpoint', input });
        if (control.holdReview) { control.holdReview = false; await new Promise((resolve) => { control.releaseReview = resolve; }); }
        const result = await planCheckpoint(data, input, control.checkpointNow || Date.now());
        if (result.code) { (control.rejectedCheckpoints ||= []).push(result.message); return json(result, 409); }
        emit('ads', 'UPDATE', result.ad); emit('manual_actions', 'UPDATE', result.action);
        return json(result);
      }
      if (url.pathname === '/rest/v1/rpc/qa_plan_creative') {
        const input = request.postDataJSON(); assert.equal(input.p_product_id, product.id);
        if (control.failNextCreative) {
          control.failNextCreative = false;
          return json({ code: 'P0001', message: 'Synthetic edit conflict; draft preserved.' }, 409);
        }
        const result = planCreative(data, input); writes.push({ rpc: 'qa_plan_creative', input });
        emit('manual_actions', 'UPDATE', result.action); if (result.ad) emit('ads', 'UPDATE', result.ad);
        return json(result);
      }
      if (url.pathname === '/rest/v1/rpc/qa_plan_preferences') {
        const input = request.postDataJSON(), profile = data.profiles[0];
        if (control.holdPreferences) { control.holdPreferences = false; await new Promise(resolve => { control.releasePreferences = resolve; control.preferencesHeld?.(); }); }
        for (const view of input.p_value.views) for (const column of view.columns) {
          if (typeof column.width !== 'number' || column.width < 44 || column.width > 600) return json({ code: 'P0001', message: 'Invalid column width' }, 400);
        }
        if (control.failNextPreferences) {
          control.failNextPreferences = false;
          return json({ code: 'P0001', message: 'Could not save column layout. Please try again.' }, 409);
        }
        assert.deepEqual(input.p_expected, profile.ap_col_state?.qa_next ?? null, 'Preference snapshot is stale');
        profile.ap_col_state = { ...profile.ap_col_state, qa_next: input.p_value };
        writes.push({ rpc: 'qa_plan_preferences' }); emit('profiles', 'UPDATE', profile); return json(input.p_value);
      }
      if (url.pathname === '/rest/v1/rpc/qa_production_format') {
        const input=request.postDataJSON();
        const result=planCreative(data,{...input,p_values:{}});
        result.action.payload.format=input.p_format;result.action.updated_at=new Date().toISOString();
        writes.push({rpc:'qa_production_format',input});emit('manual_actions','UPDATE',result.action);return json(result);
      }
      if (url.pathname === '/rest/v1/rpc/qa_production_intake') {
        const input=request.postDataJSON();assert.equal(input.p_product_id,product.id);
        writes.push({rpc:'qa_production_intake',input});(control.productionCalls ||= []).push(input);
        const receipts=control.productionReceipts ||= {};
        let result=receipts[input.p_request_id];
        if(!result){
          const {format,...values}=input.p_values;
          const ad=trackerRpc(data,'qa_tracker_save',{p_product_id:product.id,p_ad_id:null,p_values:{...values,status:'Untested'},p_custom:{}});
          ad.meta.taskType='production';ad.meta._productionRequestId=input.p_request_id;
          const action=creationFixture.stage(data,{p_product_id:product.id,p_ad_id:ad.id,p_expected_updated_at:ad.updated_at});
          if(format!==undefined)action.payload.format=format;
          result={productId:product.id,requestId:input.p_request_id,ad,action};receipts[input.p_request_id]=structuredClone(result);
        }
        if(control.loseProductionAck){control.loseProductionAck=false;return json(null);}
        return json(result);
      }
      if (url.pathname === '/rest/v1/rpc/qa_plan_fields') {
        const input = request.postDataJSON(); assert.equal(input.p_product_id, product.id);
        writes.push({ rpc: 'qa_plan_fields', input });
        const result = planFields(data, input); return json(result, result?.code === 'P0001' ? 409 : 200);
      }
      if (url.pathname === '/rest/v1/rpc/qa_plan_batch') {
        const input = request.postDataJSON(); assert.equal(input.p_product_id, product.id);
        writes.push({ rpc: 'qa_plan_batch', input }); return json(planBatch(data, input));
      }
      if (url.pathname === '/rest/v1/rpc/qa_plan_edit') {
        const input=request.postDataJSON();assert.equal(input.p_product_id,product.id);
        writes.push({rpc:'qa_plan_edit',input});
        const result = creationFixture.edit(data,input);
        return json(result, result?.code === 'P0001' ? 409 : 200);
      }
      if (url.pathname === '/rest/v1/rpc/qa_plan_stage') {
        const input=request.postDataJSON();assert.equal(input.p_product_id,product.id);
        writes.push({rpc:'qa_plan_stage',input});
        (control.stageCalls ||= []).push(input);
        try { return json(creationFixture.stage(data,input)); }
        catch (cause) { return json({ code: 'P0001', message: cause.message }, 409); }
      }
      if (url.pathname === '/rest/v1/rpc/qa_inspiration_cross_import') {
        const input=request.postDataJSON();assert.equal(input.p_product_id,product.id);
        writes.push({rpc:'qa_inspiration_cross_import',input});(control.crossImportCalls ||= []).push(input);
        const result=inspirationCrossImport(data,input);
        if(control.loseCrossImportAck){control.loseCrossImportAck=false;return json(null);}
        return json(result,result?.code ? 409 : 200);
      }
      if (url.pathname.startsWith('/rest/v1/rpc/qa_matrix_')) {
        const name=url.pathname.split('/').at(-1), input=request.postDataJSON();
        assert.equal(input.p_product_id,product.id);
        const result=matrixRpc(data,name,input); writes.push({rpc:name,input});
        if(control.loseMatrixAck) {control.loseMatrixAck=false;return json(null);}
        return json(result,result?.code ? 409 : 200);
      }
      if (url.pathname.startsWith('/rest/v1/rpc/qa_tracker_')) {
        const name = url.pathname.split('/').at(-1), input = request.postDataJSON();
        assert.equal(input.p_product_id, product.id);
        if (name === 'qa_tracker_delete' && control.holdDelete) { control.holdDelete = false; await new Promise((resolve) => { control.releaseDelete = resolve; }); }
        const result = trackerRpc(data, name, input);
        writes.push({ rpc: name, input });
        if (name === 'qa_tracker_spawn' && control.loseSpawnAck) { control.loseSpawnAck = false; return json(null); }
        if (name === 'qa_tracker_delete') {
          (control.deleteCalls ||= []).push(input);
          if (control.loseDeleteAck) { control.loseDeleteAck = false; return json(null); }
        }
        // PostgREST errors use an HTTP failure; omit console logging of expected failures below.
        return json(result, result?.code === 'P0001' ? 409 : 200);
      }
      const table = url.pathname.split('/')[3];
      requests.push({ table, method: request.method(), product: url.searchParams.get('product_id') });
      if (!Object.hasOwn(data, table)) throw new Error(`Unmocked table: ${table}`);
      let rows = data[table];
      if (table === 'profiles' && request.method() === 'PATCH' && control.visibilityConflicts > 0 && Object.hasOwn(request.postDataJSON(), 'ap_dismissed_ad_ids')) {
        data.profiles[0].ap_dismissed_ad_ids.push(`concurrent-${control.visibilityConflicts--}`);
      }
      if (table === 'profiles' && request.method() === 'GET' && url.searchParams.get('select')?.includes('ap_dismissed_ad_ids') && control.visibilityReadFailure) return json(null);
      for (const [key, value] of url.searchParams) if (value.startsWith('eq.')) rows = rows.filter((row) => (key === 'ap_dismissed_ad_ids' ? JSON.stringify(row[key]) : String(row[key])) === value.slice(3));
      for (const [key, value] of url.searchParams) if (value === 'is.null') rows = rows.filter((row) => row[key] == null);
      for (const [key, value] of url.searchParams) if (value.startsWith('in.(')) rows = rows.filter((row) => value.slice(4,-1).split(',').map((v) => v.replaceAll('"','')).includes(String(row[key])));
      if (table === 'activity_events' && request.method() === 'GET') {
        rows = historyRows(rows, url);
        if (control.historyFailure && url.searchParams.get('or')?.includes('created_at.lt')) return json(null);
        if (control.holdHistory && url.searchParams.get('or')?.includes('created_at.lt')) {
          control.holdHistory = false; rows = structuredClone(rows);
          await new Promise((resolve) => { control.releaseHistory = resolve; control.historyHeld?.(); });
        }
      }
      if (request.method() === 'GET' && url.searchParams.has('offset')) rows = rows.slice(Number(url.searchParams.get('offset')), Number(url.searchParams.get('offset')) + Number(url.searchParams.get('limit')));
      if (table === 'ads' && request.method() === 'GET' && control.holdNextAds) {
        control.holdNextAds = false;
        rows = structuredClone(rows);
        await new Promise((resolve) => { control.release = resolve; });
      }
      if (request.method() === 'PATCH') {
        const patch = request.postDataJSON();
        rows.forEach((row) => Object.assign(row, patch));
        writes.push({ table, patch });
      } else if (request.method() === 'POST') {
        const row = request.postDataJSON();
        data[table].push(row);
        rows = [row];
        writes.push({ table, insert: row });
      } else if (request.method() === 'DELETE') {
        data[table] = data[table].filter((row) => !rows.includes(row));
        writes.push({ table, delete: rows });
      }
      return json(request.headers().accept?.includes('vnd.pgrst.object') ? rows[0] || null : rows);
    }
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      if (url.pathname.startsWith('/api/')) {
        if (url.pathname === '/api/app-version') return json({version:control.appVersion || 'fixture-v1'});
        if (url.pathname === '/api/admin/health') return json({ ok: true });
        if (url.pathname === '/api/clickup/qa-cleanup') {
          const input = request.postDataJSON(); if (input.operation === 'commit') writes.push({ cleanup: input });
          const result = staleCleanup(data, input, control);
          if (control.loseCleanupAck) { control.loseCleanupAck = false; return json(null); }
          return json(result, result.error ? result.definite ? 400 : 409 : 200);
        }
        if (url.pathname === '/api/admin/create-user') {
          const input = request.postDataJSON(); writes.push({ account: 'create-user', input });
          const result = accountCreation(data, input, control);
          if (control.loseCreationAck) { control.loseCreationAck = false; return json(null); }
          return json(result, result.error ? result.definite ? 400 : 409 : 200);
        }
        if (/^\/api\/admin\/(reset-password|deactivate|reactivate|delete-user)$/.test(url.pathname)) {
          const input = request.postDataJSON(); writes.push({ account: input.operation, input });
          const result = accountOperation(data, input, control);
          if (control.loseAccountAck) { control.loseAccountAck = false; return json(null); }
          return json(result, result.error ? result.definite ? 400 : 409 : 200);
        }
        if (url.pathname === '/api/clickup/qa') {
          const input = request.postDataJSON();
          if(input.operation==='identity') { control.identityCalls=(control.identityCalls || 0)+1;return json(control.identityFailure?{error:'ClickUp rejected this key.'}:{user:{id:'42',name:'QA ClickUp User',email:'clickup@example.test'}}); }
          control.clickupCalls.push(input);
          assert.equal(request.headers()['x-clickup-token'], 'synthetic-clickup-key');
          assert.ok(request.headers().authorization.startsWith('Bearer '));
          if (control.clickupFailure) return json({ error: 'Synthetic ClickUp outage' });
          if(input.operation==='inspiration-brief')return json({productId:input.productId,inspirationId:input.inspirationId,version:input.expectedUpdatedAt,url:control.briefUrl});
          if (input.operation === 'sync-inspiration-type') {
            const row=data.inspirations.find((item)=>item.id===input.inspirationId && item.product_id===input.productId);
            if(!row || row.updated_at!==input.expectedUpdatedAt)return json({error:'Inspiration changed. Reopen it before syncing.'});
            return json({synced:!control.sourceSyncUnverified,productId:input.productId,inspirationId:row.id,version:row.updated_at,taskId:row.data._sourceClickupId,adType:row.data.adType});
          }
          if (input.operation === 'plan-statuses') return json({ statuses: control.pipelineStatuses || [] });
          if (input.operation === 'review-onescale') {
            if (control.holdOneScale) { control.holdOneScale = false; await new Promise((resolve) => { control.releaseOneScale = resolve; }); }
            if (control.oneScaleError) return json({ error: control.oneScaleError });
            return json({ productId: input.productId, tasks: input.targets.map((target) => ({ adId: target.adId, taskId: target.taskId })),
              checkedAt: new Date().toISOString(), externalLaunchEnabled: !!control.oneScaleUnsafe });
          }
          if (input.operation === 'plan-linked-done') {
            const rows = input.adIds.map((id) => {
              const ad = data.ads.find((row) => row.id === id);
              return { adId: id, taskId: ad.clickup_task_id || ad.meta?._clickupId, version: ad.updated_at, doneAt: null, error: '', ...control.linkedDone?.[id] };
            });
            if (control.holdNextLinked) { control.holdNextLinked = false; await new Promise((resolve) => { control.releaseLinked = resolve; control.linkedHeld?.(); }); }
            return json({ rows });
          }
          if (input.operation === 'inspect' || input.operation === 'link') {
            if (input.listId !== '1301130000002447') return json({ error: 'QA test list required' }, 400);
            if (input.operation === 'link') {
              data.products[0].config.clickup_list_id = input.listId;
              data.products[0].config.clickup_sync = { list_id: input.listId, mappings: { angle: 'field-angle' } };
              emit('products', 'UPDATE', data.products[0]);
            }
            return json({ list: { id: input.listId, name: 'QA Test List' }, productUpdatedAt: stamp,
              fields: [{ id: 'field-angle', name: 'Angle Tag', type: 'short_text' }], mappings: { angle: 'field-angle' } });
          }
          if (input.operation === 'sync') return json(input.prepareOnly?{productId:input.productId,listId:input.listId,productUpdatedAt:stamp,plan:{ads:[],actions:[],fetched:3}}:{ fetched: 3, imported: 1, updated: 1, skipped: 1 });
          if (input.operation === 'creative-schema') return json(control.schema || { fields: [{ id: 'check', name: 'Approved flag', type: 'checkbox' }, { id: 'score', name: 'Score', type: 'number' }], members: [], mappings: {} });
          if (input.operation === 'create-plan-task') return json(creationFixture.push(data,input,control));
          if (input.operation === 'repair-plan-task') {
            if (control.holdRepair) { control.holdRepair = false; await new Promise((resolve) => { control.releaseRepair = resolve; }); }
            return json(planRecreation(data, input, control));
          }
          if (input.operation === 'delete-plan-task') {
            const ad = data.ads.find((a) => a.product_id === input.productId && a.id === input.adId);
            assert.ok(ad?.deleted_at); assert.equal(ad.clickup_task_id || ad.meta?._clickupId, input.taskId);
            return json({ deleted: true, adId: input.adId, taskId: input.taskId });
          }
          if (input.operation === 'push-creative') {
            if (control.holdNextPush) { control.holdNextPush = false; await new Promise((resolve) => { control.releasePush = resolve; }); }
            return json({pushed:1,failed:[]});
          }
          if (input.operation === 'push-all-creative-fields') {
            if (control.holdBulkPush) { control.holdBulkPush = false; await new Promise((resolve) => { control.releaseBulkPush = resolve; }); }
            const ad = data.ads.find((row) => row.id === input.adId && row.product_id === input.productId);
            assert.equal(ad.updated_at, input.expectedUpdatedAt);
            assert.equal(ad.clickup_task_id, input.expectedTaskId);
            const failed = control.bulkFailedId === input.adId ? [{ field: 'Hook Type', error: 'Missing dropdown option' }] : [];
            return json({ adId: ad.id, taskId: ad.clickup_task_id, pushed: failed.length ? 5 : 6, failed });
          }
          throw new Error(`Unmocked ClickUp operation: ${input.operation}`);
        }
        throw new Error(`Unexpected live API call: ${url.pathname}`);
      }
      return route.continue();
    }
    external.push(url.origin);
    return route.abort();
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if(control.expectedPresenceFailures>0 && message.location().url.endsWith('/rest/v1/rpc/qa_presence') && message.text().includes('503 (Service Unavailable)')){control.expectedPresenceFailures--;return;}
    if (control.expectedPreferenceRejections > 0 && message.location().url.endsWith('/rest/v1/rpc/qa_plan_preferences') && message.text().includes('409 (Conflict)')) { control.expectedPreferenceRejections--; return; }
    if (control.expectedWorkerErrors > 0 && /\/rest\/v1\/rpc\/qa_(worker_pause|workers_page)$/.test(message.location().url) && message.text().includes('409 (Conflict)')) { control.expectedWorkerErrors--; return; }
    if (message.type() !== 'error') return;
    if (control.expectedCleanupRejections > 0 && message.location().url.endsWith('/api/clickup/qa-cleanup') && /400 \(Bad Request\)|409 \(Conflict\)/.test(message.text())) { control.expectedCleanupRejections--; return; }
    if (control.expectedCreationRejections > 0 && message.location().url.endsWith('/api/admin/create-user') && /400 \(Bad Request\)|409 \(Conflict\)/.test(message.text())) { control.expectedCreationRejections--; return; }
    if (control.expectedAccountRejections > 0 && /\/api\/admin\/(reset-password|deactivate|reactivate|delete-user)$/.test(message.location().url) && /400 \(Bad Request\)|409 \(Conflict\)/.test(message.text())) { control.expectedAccountRejections--; return; }
    if (control.expectedAdminAccessRejections > 0 && message.location().url.endsWith('/rest/v1/rpc/qa_admin_access_mutate') && message.text().includes('409 (Conflict)')) { control.expectedAdminAccessRejections--; return; }
    if (control.expectedTaxonomyRejections > 0 && message.location().url.endsWith('/rest/v1/rpc/qa_taxonomy_mutate') && message.text().includes('409 (Conflict)')) { control.expectedTaxonomyRejections--; return; }
    if (control.expectedProductRejections > 0 && message.location().url.endsWith('/rest/v1/rpc/qa_product_mutate') && message.text().includes('409 (Conflict)')) { control.expectedProductRejections--; return; }
    if(control.expectedRecoveryRejections>0 && message.location().url.endsWith('/rest/v1/rpc/qa_inspiration_recover') && message.text().includes('409 (Conflict)')){control.expectedRecoveryRejections--;return;}
    if (control.expectedCrossImportRejections > 0 && message.location().url.endsWith('/rest/v1/rpc/qa_inspiration_cross_import') && message.text().includes('409 (Conflict)')) {
      control.expectedCrossImportRejections--;return;
    }
    if (control.expectedPlacementRejections > 0 && message.location().url.endsWith('/rest/v1/rpc/qa_matrix_create') && message.text().includes('409 (Conflict)')) {
      control.expectedPlacementRejections--; return;
    }
    if (control.expectedInspirationRejections > 0 && /\/rest\/v1\/rpc\/qa_inspiration_(mutate|mapping|detail|duplicate_review)$/.test(message.location().url) && message.text().includes('409 (Conflict)')) {
      control.expectedInspirationRejections--; return;
    }
    if (control.expectedWorkflowRejections > 0 && message.location().url.endsWith('/rest/v1/rpc/qa_plan_edit') && message.text().includes('409 (Conflict)')) {
      control.expectedWorkflowRejections--; return;
    }
    if (control.expectedSpawnRejections > 0 && message.location().url.endsWith('/rest/v1/rpc/qa_tracker_spawn') && message.text().includes('409 (Conflict)')) {
      control.expectedSpawnRejections--; return;
    }
    if (control.expectedDeleteRejections > 0 && message.location().url.endsWith('/rest/v1/rpc/qa_tracker_delete') && message.text().includes('409 (Conflict)')) {
      control.expectedDeleteRejections--; return;
    }
    if (control.expectedAdoptionRejections > 0 && /\/rest\/v1\/rpc\/qa_plan_(creative|stage)$/.test(message.location().url) && message.text().includes('409 (Conflict)')) {
      control.expectedAdoptionRejections--; return;
    }
    if (control.expectedCheckpointRejections > 0 && message.location().url.endsWith('/rest/v1/rpc/qa_plan_checkpoint') && message.text().includes('409 (Conflict)')) {
      control.expectedCheckpointRejections--; return;
    }
    errors.push(message.text());
  });
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Sign in', exact: true }).waitFor();
  await page.getByLabel('Email', { exact: true }).fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill('fixture-password-only');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('button', { name: passwordChange ? 'Sign out' : 'Login and user details', exact: true }).waitFor();
  return { page, context, data, emit, requests, channels, control };
}
async function tab(page, name) {
  await page.getByRole('navigation', { name: 'Command Center sections' }).getByRole('button', { name }).click();
  await page.waitForLoadState('networkidle');
  assert.equal(new URL(page.url()).pathname, '/');
}
(async () => {
  browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'chrome' });
  if (process.env.MATRIX_ADD_INSIGHTS_ONLY) {
    const matrix = await makePage();
    await require('./matrix-add-insights-flow.cjs')({ ...matrix, tab, artifactDir, results });
    await matrix.context.close();
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    console.log(JSON.stringify({ results, errors, external, mutationCount: writes.length }, null, 2)); return;
  }
  if (process.env.MATRIX_INSPECTOR_ONLY) {
    const matrix = await makePage();
    await require('./matrix-inspector-flow.cjs')({ ...matrix, tab, artifactDir, results });
    await matrix.context.close();
    assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.equal(writes.length, 3);
    console.log(JSON.stringify({ results, errors, external, mutationCount: writes.length }, null, 2)); return;
  }
  if (process.env.MATRIX_PRESENTATION_ONLY) {
    const matrix = await makePage();
    await require('./matrix-presentation-flow.cjs')({ ...matrix, tab, artifactDir, results });
    await matrix.context.close();
    assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.equal(writes.length, 0);
    console.log(JSON.stringify({ results, errors, external, mutationCount: writes.length }, null, 2)); return;
  }
  if (process.env.TRACKER_FIELDS_ONLY) {
    const tracker = await makePage();
    await require('./tracker-fields-flow.cjs')({ ...tracker, tab, artifactDir, results });
    await tracker.context.close();
    assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.equal(writes.length, 3);
    console.log(JSON.stringify({ results, errors, external, mutationCount: writes.length }, null, 2)); return;
  }
  if (process.env.TRACKER_LINKS_ONLY) {
    const tracker = await makePage();
    await require('./tracker-links-flow.cjs')({ ...tracker, tab, artifactDir, results });
    await tracker.context.close();
    assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.equal(writes.length, 0);
    console.log(JSON.stringify({ results, errors, external, mutationCount: writes.length }, null, 2)); return;
  }
  if (process.env.TRACKER_PRESENTATION_ONLY) {
    const tracker = await makePage();
    await require('./tracker-presentation-flow.cjs')({ ...tracker, tab, artifactDir, results });
    await tracker.context.close();
    assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.equal(writes.length, 0);
    console.log(JSON.stringify({ results, errors, external, mutationCount: writes.length }, null, 2)); return;
  }
  if (process.env.TRACKER_BULK_ONLY) {
    const tracker = await makePage();
    await require('./tracker-bulk-flow.cjs')({ ...tracker, tab, artifactDir, results });
    await tracker.context.close();
    assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.equal(writes.length, 0);
    console.log(JSON.stringify({ results, errors, external, mutationCount: writes.length }, null, 2)); return;
  }
  if (process.env.NAVIGATION_COUNTS_ONLY) {
    const counts = await makePage();
    await require('./navigation-counts-flow.cjs')({ ...counts, tab, artifactDir, results });
    await counts.context.close();
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    fs.writeFileSync(`${artifactDir}/results.json`, JSON.stringify({ results, errors, external, mutationCount: writes.length }, null, 2));
    console.log(JSON.stringify({ results, errors, external, mutationCount: writes.length }, null, 2)); return;
  }
  if (process.env.RELEASE_AUDIT_ONLY) {
    const audit = await makePage();
    await require('./release-audit-flow.cjs')({ ...audit, tab, artifactDir, results });
    await audit.context.close();
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    fs.writeFileSync(`${artifactDir}/results.json`, JSON.stringify({ results, errors, external, mutationCount: writes.length }, null, 2));
    console.log(JSON.stringify({ results, errors, external, mutationCount: writes.length }, null, 2)); return;
  }
  if (process.env.TAXONOMY_RENAME_ONLY) {
    const rename = await makePage(); await testTaxonomyRename({ ...rename, tab, artifactDir, results }); await rename.context.close();
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    fs.writeFileSync(`${artifactDir}/results.json`, JSON.stringify({ results, errors, external, mutationCount: writes.length }, null, 2));
    console.log(JSON.stringify({ results, errors, external, mutationCount: writes.length }, null, 2)); return;
  }
  if (process.env.TAXONOMY_ADMIN_FINAL_ONLY) {
    const admin=await makePage(); await testTaxonomyAdminFinal({...admin,tab,artifactDir,results}); await admin.context.close();
    assert.deepEqual(errors,[]); assert.deepEqual(external,[]);
    fs.writeFileSync(`${artifactDir}/results.json`,JSON.stringify({results,errors,external,mutationCount:writes.length},null,2));
    console.log(JSON.stringify({results,errors,external,mutationCount:writes.length},null,2)); return;
  }
  if (process.env.WORKER_CONTROLS_ONLY) {
    const admin = await makePage(); await testWorkerControls({ ...admin, tab, artifactDir, results }); await admin.context.close();
    const member = await makePage('member'); await tab(member.page, 'Inspiration');
    await member.page.getByRole('button',{name:'Queue and worker health',exact:true}).click();
    assert.equal(await member.page.getByRole('region', { name: 'Worker pool', exact: true }).count(), 0); await member.context.close();
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    fs.writeFileSync(`${artifactDir}/results.json`, JSON.stringify({ results, errors, external, mutationCount: writes.length }, null, 2));
    console.log(JSON.stringify({ results, errors, external, mutationCount: writes.length }, null, 2)); return;
  }
  if (process.env.STALE_CLEANUP_ONLY) {
    const admin = await makePage(); await testStaleCleanup({ ...admin, tab, artifactDir, results }); await admin.context.close();
    const member = await makePage('member'); await tab(member.page, 'COMMAND HQ'); assert.equal(await member.page.getByRole('button', { name: 'Clean stale', exact: true }).count(), 0); await member.context.close();
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    fs.writeFileSync(`${artifactDir}/results.json`, JSON.stringify({ results, errors, external, mutationCount: writes.length }, null, 2));
    console.log(JSON.stringify({ results, errors, external, mutationCount: writes.length }, null, 2)); return;
  }
  if (process.env.ACCOUNT_CREATION_ONLY) {
    const admin = await makePage(); await testAccountCreation({ ...admin, tab, artifactDir, results }); await admin.context.close();
    const member = await makePage('member'); assert.equal(await member.page.getByRole('navigation').getByRole('button', { name: 'Admin', exact: true }).count(), 0); await member.context.close();
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    fs.writeFileSync(`${artifactDir}/results.json`, JSON.stringify({ results, errors, external, mutationCount: writes.length }, null, 2));
    console.log(JSON.stringify({ results, errors, external, mutationCount: writes.length }, null, 2)); return;
  }
  if (process.env.ACCOUNT_OPERATIONS_ONLY) {
    const admin = await makePage(); await testAccountOperations({ ...admin, tab, artifactDir, results }); await admin.context.close();
    const password = await makePage('member', true);
    await password.page.getByLabel('New password', { exact: true }).fill('fixture-new-password');
    await password.page.getByLabel('Confirm password', { exact: true }).fill('fixture-new-password');
    await password.page.getByRole('button', { name: 'Set new password', exact: true }).click();
    await password.page.getByRole('navigation', { name: 'Command Center sections' }).waitFor();
    assert.equal(writes.some((write) => write.table === 'profiles' && Object.hasOwn(write.patch || {}, 'must_change_password')), false);
    await password.context.close();
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    fs.writeFileSync(`${artifactDir}/results.json`, JSON.stringify({ results, errors, external, mutationCount: writes.length }, null, 2));
    console.log(JSON.stringify({ results, errors, external, mutationCount: writes.length }, null, 2)); return;
  }
  if (process.env.ADMIN_ACCESS_ONLY) {
    const admin = await makePage(); await testAdminAccess({ ...admin, tab, artifactDir, results }); await admin.context.close();
    const member = await makePage('member'); assert.equal(await member.page.getByRole('navigation').getByRole('button', { name: 'Admin', exact: true }).count(), 0); await member.context.close();
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    fs.writeFileSync(`${artifactDir}/results.json`, JSON.stringify({ results, errors, external, mutationCount: writes.length }, null, 2));
    console.log(JSON.stringify({ results, errors, external, mutationCount: writes.length }, null, 2)); return;
  }
  if (process.env.PRODUCT_ADMIN_ONLY) {
    const admin = await makePage(); await testProductAdministration({ ...admin, tab, artifactDir, results }); await admin.context.close();
    const member = await makePage('member'); await testProductAdministration.member({ ...member, tab, results }); await member.context.close();
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    fs.writeFileSync(`${artifactDir}/results.json`, JSON.stringify({ results, errors, external, mutationCount: writes.length }, null, 2));
    console.log(JSON.stringify({ results, errors, external, mutationCount: writes.length }, null, 2)); return;
  }
  if (process.env.TAXONOMY_MUTATIONS_ONLY) {
    const taxonomy = await makePage(); await testTaxonomyMutations({ ...taxonomy, tab, artifactDir, results }); await taxonomy.context.close();
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    fs.writeFileSync(`${artifactDir}/results.json`, JSON.stringify({ results, errors, external, mutationCount: writes.length }, null, 2));
    console.log(JSON.stringify({ results, errors, external, mutationCount: writes.length }, null, 2)); return;
  }
  if (process.env.TAXONOMY_RELATIONSHIPS_ONLY) {
    const taxonomy = await makePage(); await testTaxonomyRelationships({ ...taxonomy, tab, artifactDir, results }); await taxonomy.context.close();
    assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.equal(writes.length, 0);
    fs.writeFileSync(`${artifactDir}/results.json`, JSON.stringify({ results, errors, external, mutationCount: writes.length }, null, 2));
    console.log(JSON.stringify({ results, errors, external, mutationCount: writes.length }, null, 2)); return;
  }
  if (process.env.HQ_FINAL_ONLY) {
    for (const test of [testHqFinal, testCommandHq, testHqOperations]) {
      const hq = await makePage(); await test({ ...hq, tab, artifactDir, results }); await hq.context.close();
    }
    const member = await makePage('member'); await testHqOperations.member({ ...member, tab, results }); await member.context.close();
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    fs.writeFileSync(`${artifactDir}/results.json`, JSON.stringify({ results, errors, external, mutationCount: writes.length }, null, 2));
    console.log(JSON.stringify({ results, errors, external, mutationCount: writes.length }, null, 2)); return;
  }
  if (process.env.HQ_OPERATIONS_ONLY) {
    const hq = await makePage(); await testHqOperations({ ...hq, tab, artifactDir, results }); await hq.context.close();
    const member = await makePage('member'); await testHqOperations.member({ ...member, tab, results }); await member.context.close();
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    fs.writeFileSync(`${artifactDir}/results.json`, JSON.stringify({ results, errors, external, mutationCount: writes.length }, null, 2));
    console.log(JSON.stringify({ results, errors, external, mutationCount: writes.length }, null, 2)); return;
  }
  if (process.env.HQ_ONLY) {
    const hq = await makePage(); await testCommandHq({ ...hq, tab, artifactDir, results }); await hq.context.close();
    assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.equal(writes.length, 0);
    fs.writeFileSync(`${artifactDir}/results.json`, JSON.stringify({ results, errors, external, mutationCount: writes.length }, null, 2));
    console.log(JSON.stringify({ results, errors, external, mutationCount: writes.length }, null, 2)); return;
  }
  if(process.env.PRODUCTION_FINAL_ONLY) {
    for(const test of [testProductionFinal,testProduction,testProductionTasks]) {
      const production=await makePage();await test({...production,tab,artifactDir,results});await production.context.close();
    }
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
    fs.writeFileSync(`${artifactDir}/results.json`,JSON.stringify({results,errors,external,mutationCount:writes.length},null,2));
    console.log(JSON.stringify({results,errors,external,mutationCount:writes.length},null,2));return;
  }
  if(process.env.PRODUCTION_TASKS_ONLY) {
    const production=await makePage();await testProductionTasks({...production,tab,artifactDir,results});await production.context.close();
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
    fs.writeFileSync(`${artifactDir}/results.json`,JSON.stringify({results,errors,external,mutationCount:writes.length},null,2));
    console.log(JSON.stringify({results,errors,external,mutationCount:writes.length},null,2));return;
  }
  if(process.env.PRODUCTION_ONLY) {
    const production=await makePage();await testProduction({...production,tab,artifactDir,results});await production.context.close();
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
    fs.writeFileSync(`${artifactDir}/results.json`,JSON.stringify({results,errors,external,mutationCount:writes.length},null,2));
    console.log(JSON.stringify({results,errors,external,mutationCount:writes.length},null,2));return;
  }
  if(process.env.INSPIRATION_FINAL_ONLY) {
    const final=await makePage('member');await testFinalInspiration({...final,tab,artifactDir,results});await final.context.close();
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
    fs.writeFileSync(`${artifactDir}/results.json`,JSON.stringify({results,errors,external,mutationCount:writes.length},null,2));
    console.log(JSON.stringify({results,errors,external,mutationCount:writes.length},null,2));return;
  }
  if(process.env.INSPIRATION_DUPLICATES_ONLY) {
    const duplicates=await makePage('member');await testInspirationDuplicates({...duplicates,tab,artifactDir,results});await duplicates.context.close();
    const mapping=await makePage('member');await testInspirationMapping({...mapping,tab,artifactDir,results});await mapping.context.close();
    const inline=await makePage('member');await testInspirationInline({...inline,tab,artifactDir,results});await inline.context.close();
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
    fs.writeFileSync(`${artifactDir}/results.json`,JSON.stringify({results,errors,external,mutationCount:writes.length},null,2));
    console.log(JSON.stringify({results,errors,external,mutationCount:writes.length},null,2));return;
  }
  if(process.env.INSPIRATION_MAPPING_ONLY) {
    const mapping=await makePage('member');await testInspirationMapping({...mapping,tab,artifactDir,results});await mapping.context.close();
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
    fs.writeFileSync(`${artifactDir}/results.json`,JSON.stringify({results,errors,external,mutationCount:writes.length},null,2));
    console.log(JSON.stringify({results,errors,external,mutationCount:writes.length},null,2));return;
  }
  if(process.env.INSPIRATION_INLINE_ONLY) {
    const inline=await makePage('member');await testInspirationInline({...inline,tab,artifactDir,results});await inline.context.close();
    const parity=await makePage('member');await testInspirationParity({...parity,tab,artifactDir,results});await parity.context.close();
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
    fs.writeFileSync(`${artifactDir}/results.json`,JSON.stringify({results,errors,external,mutationCount:writes.length},null,2));
    console.log(JSON.stringify({results,errors,external,mutationCount:writes.length},null,2));return;
  }
  if(process.env.HEADER_ONLY) {
    const result=await makePage();
    await require('./workspace-header-flow.cjs')({...result,tab,artifactDir,results});
    await result.context.close();
    const member=await makePage('member');
    member.data.products[0].name='AstroRekha - QA Sample';member.data.products[0].config={};member.data.profiles[0].username='likermeow';
    await member.page.reload();
    await member.page.getByRole('button',{name:'Online users',exact:true}).getByText('1 online',{exact:true}).waitFor();
    assert.equal(await member.page.getByRole('button',{name:'Force reload everyone',exact:true}).isDisabled(),true);
    assert.equal(await member.page.getByRole('checkbox',{name:'Live sync',exact:true}).isDisabled(),false);
    await member.page.getByText('No linked list',{exact:true}).waitFor();
    await member.page.screenshot({path:`${artifactDir}/header-member-unlinked.png`});
    await member.page.getByRole('button',{name:'Login and user details',exact:true}).click();
    await member.page.getByRole('dialog',{name:'Login and user details',exact:true}).getByText('member',{exact:true}).waitFor();
    await member.page.getByRole('dialog',{name:'Login and user details',exact:true}).getByRole('button',{name:'Sign out',exact:true}).click();
    await member.page.getByRole('button',{name:'Sign in',exact:true}).waitFor();
    await member.context.close();
    results.push('Invalid keys clear stale identity; deployment notices support snooze; member reload icon stays disabled; sign-out works from user details');
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);console.log(JSON.stringify({results,errors,external},null,2));await browser.close();process.exit(0);
  }
  if(process.env.INSPIRATION_PARITY_ONLY) {
    const parity=await makePage('member');await testInspirationParity({...parity,tab,artifactDir,results});await parity.context.close();
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
    fs.writeFileSync(`${artifactDir}/results.json`,JSON.stringify({results,errors,external,mutationCount:writes.length},null,2));
    console.log(JSON.stringify({results,errors,external,mutationCount:writes.length},null,2));return;
  }
  if(process.env.INSPIRATION_BATCH_ONLY) {
    const batch=await makePage('member');await testInspirationBatch({...batch,tab,artifactDir,results});await batch.context.close();
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
    fs.writeFileSync(`${artifactDir}/results.json`,JSON.stringify({results,errors,external,mutationCount:writes.length},null,2));
    console.log(JSON.stringify({results,errors,external,mutationCount:writes.length},null,2));return;
  }
  if(process.env.INSPIRATION_RECOVERY_ONLY) {
    const recovery=await makePage();await testInspirationRecovery({...recovery,tab,artifactDir,results});await recovery.context.close();
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
    fs.writeFileSync(`${artifactDir}/results.json`,JSON.stringify({results,errors,external,mutationCount:writes.length},null,2));
    console.log(JSON.stringify({results,errors,external,mutationCount:writes.length},null,2));return;
  }
  if (process.env.INSPIRATION_ACTIVITY_ONLY) {
    const activity=await makePage();await require('./inspiration-activity-flow.cjs')({...activity,tab,artifactDir,results});await activity.context.close();
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.deepEqual(writes,[]);
    console.log(JSON.stringify({results,errors,external},null,2));return;
  }
  if (process.env.INSPIRATION_ANALYTICS_ONLY) {
    const inspiration=await makePage();await testInspirationAnalytics({...inspiration,tab,artifactDir,results});await inspiration.context.close();
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.deepEqual(writes,[]);
    fs.writeFileSync(`${artifactDir}/results.json`,JSON.stringify({results,errors,external,mutationCount:writes.length},null,2));
    console.log(JSON.stringify({results,errors,external,mutationCount:writes.length},null,2));return;
  }
  if (process.env.INSPIRATION_CROSS_IMPORT_ONLY) {
    const inspiration=await makePage();await testInspirationCrossImport({...inspiration,tab,artifactDir,results});await inspiration.context.close();
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
    fs.writeFileSync(`${artifactDir}/results.json`,JSON.stringify({results,errors,external,mutationCount:writes.length},null,2));
    console.log(JSON.stringify({results,errors,external,mutationCount:writes.length},null,2));return;
  }
  if (process.env.INSPIRATION_PLACEMENT_ONLY) {
    const inspiration = await makePage(); await testInspirationPlacement({...inspiration,tab,artifactDir,results});await inspiration.context.close();
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
    fs.writeFileSync(`${artifactDir}/results.json`,JSON.stringify({results,errors,external,mutationCount:writes.length},null,2));
    console.log(JSON.stringify({results,errors,external,mutationCount:writes.length},null,2));return;
  }
  if (process.env.INSPIRATION_MUTATIONS_ONLY) {
    const inspiration = await makePage(); await testInspirationMutations({ ...inspiration, tab, artifactDir, results }); await inspiration.context.close();
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    fs.writeFileSync(`${artifactDir}/results.json`, JSON.stringify({results,errors,external,mutationCount:writes.length},null,2));
    console.log(JSON.stringify({results,errors,external,mutationCount:writes.length},null,2));return;
  }
  if (process.env.INSPIRATION_LIBRARY_ONLY) {
    const inspiration = await makePage(); await testInspirationLibrary({ ...inspiration, tab, artifactDir, results }); await inspiration.context.close();
    assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.deepEqual(writes, []);
    fs.writeFileSync(`${artifactDir}/results.json`, JSON.stringify({ results, errors, external, mutationCount: writes.length }, null, 2));
    console.log(JSON.stringify({ results, errors, external, mutationCount: writes.length }, null, 2)); return;
  }
  if (process.env.PLAN_ACCEPTANCE_ONLY) {
    const acceptance = await makePage(); await testPlanAcceptance({ ...acceptance, tab, artifactDir, results }); await acceptance.context.close();
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    console.log(JSON.stringify({ results, errors, external, mutationCount: writes.length }, null, 2)); return;
  }
  if (process.env.PULSE_PERIOD_ONLY) {
    const period = await makePage(); await testPulsePeriod({ ...period, tab, artifactDir, results }); await period.context.close();
    assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.deepEqual(writes, []);
    console.log(JSON.stringify({ results, errors, external }, null, 2)); return;
  }
  if (process.env.VARIATION_LAB_ONLY) {
    const lab = await makePage(); await testVariationLab({ ...lab, tab, artifactDir, results }); await lab.context.close();
    assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.ok(writes.every((write) => write.rpc === 'qa_tracker_spawn'));
    console.log(JSON.stringify({ results, errors, external, mutationCount: writes.length }, null, 2)); return;
  }
  if (process.env.PLAN_DETAIL_CARDS_ONLY) {
    const detail = await makePage(); await testDetailCards({ ...detail, tab, artifactDir, results }); await detail.context.close();
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    console.log(JSON.stringify({ results, errors, external }, null, 2)); return;
  }
  if (process.env.PLAN_COUNT_ONLY) {
    const counts = await makePage(); await testPlanCount({ ...counts, tab, artifactDir, results }); await counts.context.close();
    assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.deepEqual(writes, []);
    console.log(JSON.stringify({ results, errors, external }, null, 2)); return;
  }
  if (process.env.PLAN_MENUS_ONLY) {
    const menus = await makePage(); await testPlanMenus({ ...menus, tab, artifactDir, results });
    await menus.context.close(); assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.deepEqual(writes, []);
    console.log(JSON.stringify({ results, errors, external }, null, 2)); return;
  }
  if (process.env.PLAN_DATE_MENU_ONLY) {
    const dates = await makePage(); await testPlanDateMenu({ ...dates, tab, artifactDir, results }); await dates.context.close();
    assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.deepEqual(writes, []);
    console.log(JSON.stringify({ results, errors, external }, null, 2)); return;
  }
  if (process.env.PLAN_VARIATIONS_ONLY) {
    const variations = await makePage(); await testPlanVariations({ ...variations, tab, artifactDir, results });
    await variations.context.close(); assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.deepEqual(writes, []);
    console.log(JSON.stringify({ results, errors, external }, null, 2)); return;
  }
  if (process.env.PLAN_SELECTION_ONLY) {
    const selection = await makePage(); await testPlanSelection({ ...selection, tab, artifactDir, results });
    await selection.context.close(); assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.deepEqual(writes, []);
    console.log(JSON.stringify({ results, errors, external }, null, 2)); return;
  }
  if (process.env.MODAL_DISMISS_ONLY) {
    const fixture = await makePage(); await testModalDismiss({ ...fixture, tab, artifactDir, results });
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    assert.ok(writes.every(write => write.rpc === 'qa_plan_preferences'));
    console.log(JSON.stringify({ results, errors, external }, null, 2)); return;
  }
  if (process.env.PLAN_DRAWER_ONLY) {
    const drawer = await makePage(); await testPlanDrawer({ ...drawer, tab, artifactDir, results });
    await drawer.context.close(); assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.deepEqual(writes, []);
    console.log(JSON.stringify({ results, errors, external }, null, 2)); return;
  }
  if (process.env.IMAGE_PRODUCER_ONLY) {
    const producer = await makePage(); await testImageProducer({ ...producer, tab, artifactDir, results });
    await producer.context.close(); assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.deepEqual(writes, []);
    console.log(JSON.stringify({ results, errors, external }, null, 2)); return;
  }
  if (process.env.PLAN_TABLE_PARITY_ONLY) {
    const parity = await makePage(); await testPlanTableParity({ ...parity, tab, artifactDir, results });
    await parity.context.close(); assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.deepEqual(writes, []);
    console.log(JSON.stringify({ results, errors, external }, null, 2)); return;
  }
  if (process.env.PLAN_VISUAL_ONLY) {
    const visual = await makePage(); await testPlanVisual({ ...visual, tab, artifactDir, results });
    await visual.context.close(); assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.deepEqual(writes, []);
    console.log(JSON.stringify({ results, errors, external }, null, 2)); return;
  }
  if (process.env.PLAN_ONESCALE_ONLY) {
    const onescale = await makePage(); await testPlanOneScale({ ...onescale, tab, artifactDir, results });
    await onescale.context.close(); assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.deepEqual(writes, []);
    console.log(JSON.stringify({ results, errors, external }, null, 2)); return;
  }
  if (process.env.PLAN_RECREATION_ONLY) {
    const recreation = await makePage(); await testPlanRecreation({ ...recreation, tab, artifactDir, results });
    assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.deepEqual(writes, []);
    console.log(JSON.stringify({ results, errors, external }, null, 2)); return;
  }
  if (process.env.PLAN_DELETION_ONLY) {
    const deletion = await makePage(); await testPlanDeletion({ ...deletion, tab, artifactDir, results });
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    assert.ok(writes.every((w) => w.rpc === 'qa_tracker_delete'));
    console.log(JSON.stringify({ results, errors, external }, null, 2)); return;
  }
  if (process.env.PLAN_ADOPTION_ONLY) {
    const adoption = await makePage(); await testPlanAdoption({ ...adoption, tab, artifactDir, results });
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    assert.ok(writes.every((w) => ['qa_plan_stage', 'qa_plan_creative', 'qa_plan_fields', 'qa_plan_checkpoint', 'qa_plan_batch', 'qa_plan_edit'].includes(w.rpc) || w.table === 'profiles'));
    console.log(JSON.stringify({ results, errors, external }, null, 2)); return;
  }
  if (process.env.PLAN_VISIBILITY_ONLY) {
    const visibility = await makePage(); await testPlanVisibility({ ...visibility, tab, artifactDir, results });
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    assert.ok(writes.every((write) => write.table === 'profiles' && Object.keys(write.patch).join() === 'ap_dismissed_ad_ids'));
    console.log(JSON.stringify({ results, errors, external }, null, 2)); return;
  }
  if (process.env.PLAN_FILTERS_ONLY) {
    const filters = await makePage(); await testPlanFilters({ ...filters, tab, artifactDir, results });
    assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.deepEqual(writes, []);
    console.log(JSON.stringify({ results, errors, external }, null, 2)); return;
  }
  if (process.env.PLAN_HISTORY_ONLY) {
    const history = await makePage(); await testPlanHistory({ ...history, tab, artifactDir, results });
    assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.deepEqual(writes, []);
    console.log(JSON.stringify({ results, errors, external }, null, 2)); return;
  }
  if (process.env.PLAN_AGE_ONLY) {
    const age = await makePage(); await testPlanAge({ ...age, tab, artifactDir, results });
    assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.ok(writes.every((write) => write.rpc === 'qa_plan_preferences'));
    console.log(JSON.stringify({ results, errors, external }, null, 2)); return;
  }
  if (process.env.PLAN_PULSE_ONLY) {
    const pulse = await makePage(); await testPlanPulse({ ...pulse, tab, artifactDir, results });
    assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.deepEqual(writes, []);
    console.log(JSON.stringify({ results, errors, external }, null, 2)); return;
  }
  if (process.env.PLAN_LINKED_ONLY) {
    const linked = await makePage(); await testPlanLinkedDone({ ...linked, tab, artifactDir, results });
    assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.deepEqual(writes, []);
    console.log(JSON.stringify({ results, errors, external }, null, 2)); return;
  }
  if (process.env.PLAN_CHECKPOINT_ONLY) {
    const checkpoint = await makePage(); await testPlanCheckpoint({ ...checkpoint, tab, artifactDir, results });
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    console.log(JSON.stringify({ results, errors, external }, null, 2)); return;
  }
  if (process.env.PLAN_HEALTH_ONLY) {
    const health = await makePage(); await testPlanHealth({ ...health, tab, artifactDir, results });
    assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.deepEqual(writes, []);
    console.log(JSON.stringify({ results, errors, external }, null, 2)); return;
  }
  if (process.env.PLAN_TRENDS_ONLY) {
    const trends = await makePage(); await testPlanTrends({ ...trends, tab, artifactDir, results });
    assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.deepEqual(writes, []);
    console.log(JSON.stringify({ results, errors, external }, null, 2)); return;
  }
  if (process.env.PLAN_LAYOUTS_ONLY) {
    const layouts = await makePage(); await testPlanLayouts({ ...layouts, tab, artifactDir, results });
    assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.deepEqual(writes, []);
    console.log(JSON.stringify({ results, errors, external }, null, 2)); return;
  }
  if (process.env.PLAN_CREATIVE_ONLY) {
    const creative = await makePage(); await testPlanCreative({ ...creative, tab, artifactDir, results });
    assert.deepEqual(errors, []); assert.deepEqual(external, []); console.log(JSON.stringify({ results, errors, external }, null, 2)); return;
  }
  if (process.env.PLAN_VIEWS_ONLY) {
    const views = await makePage(); await testPlanViews({ ...views, tab, artifactDir, results });
    assert.deepEqual(errors, []); assert.deepEqual(external, []); console.log(JSON.stringify({ results, errors, external }, null, 2)); return;
  }
  if (process.env.PLAN_FIELDS_ONLY) {
    const fields = await makePage(); await testPlanFields({ ...fields, tab, artifactDir, results });
    assert.deepEqual(errors, []); assert.deepEqual(external, []); console.log(JSON.stringify({ results, errors, external }, null, 2)); return;
  }
  if (process.env.PLAN_ONLY) {
    const plan = await makePage(); await testPlan({ ...plan, tab, artifactDir, results });
    assert.deepEqual(errors, []); assert.deepEqual(external, []); console.log(JSON.stringify({ results, errors, external }, null, 2)); return;
  }
  if (process.env.CREATION_ONLY) {
    const creation=await makePage();await testCreation({...creation,tab,artifactDir,results});
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);console.log(JSON.stringify({results,errors,external},null,2));return;
  }
  if (process.env.MATRIX_ONLY) {
    const matrix=await makePage();
    await testMatrix({...matrix,tab,artifactDir,results});
    assert.deepEqual(errors,[]); assert.deepEqual(external,[]);
    console.log(JSON.stringify({results,errors,external},null,2)); return;
  }
  if (process.env.TRACKER_ONLY) {
    const tracker = await makePage();
    await testTracker({ ...tracker, tab, artifactDir, results });
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    console.log(JSON.stringify({ results, errors, external }, null, 2));
    return;
  }
  const { page, context, data, emit, requests, channels, control } = await makePage();
  const names = ['Command HQ', 'Angles', 'Personas', 'Competitors', 'Creative Tracker', 'Creative Matrix', 'Action Plan', 'Production', 'Strategist', 'Inspiration', 'Admin'];
  assert.equal(await page.locator('nav button').count(), 11);
  for (const name of names) {
    await tab(page, name);
    assert.ok((await page.locator('main > section').last().innerText()).trim().length > 20, `${name} is blank`);
    await page.screenshot({ path: `${artifactDir}/${name.replaceAll(' ', '-').toLowerCase()}.png`, fullPage: true });
    results.push(`${name} renders at /`);
  }
  await tab(page, 'Creative Tracker');
  const angleFilter = page.locator('select').filter({ has: page.locator('option[value="Energy"]') }).first();
  await angleFilter.selectOption('Energy');
  await page.locator('tr[data-creative-id="AD-1"]').evaluate((element) => { window.__preservedCreative = element; });
  const requestCount = requests.filter((request) => request.table === 'ads').length;
  data.ads[0].status = 'Winner';
  for (let count = 0; count < 20; count++) emit('ads', 'UPDATE', data.ads[0]);
  await page.waitForFunction(() => document.querySelector('[aria-label="Status for QA creative"]')?.value === 'Winner');
  assert.equal(await angleFilter.inputValue(), 'Energy');
  assert.equal(await page.locator('tr[data-creative-id="AD-1"]').evaluate((element) => window.__preservedCreative === element), true);
  assert.ok(requests.filter((request) => request.table === 'ads').length - requestCount <= 2, 'Events were not batched');
  const beforeUnrelated = requests.filter((request) => request.table === 'ads').length;
  emit('ads', 'UPDATE', { ...data.ads[0], product_id: 'unrelated-product' });
  await page.waitForTimeout(250);
  assert.equal(requests.filter((request) => request.table === 'ads').length, beforeUnrelated);
  results.push('Realtime bursts update rows once, preserve DOM/filter state, and ignore other products');
  await tab(page, 'Angles');
  await page.locator('textarea').fill('Unsaved draft survives');
  await page.locator('textarea').focus();
  data.angles[0].source_link = 'https://example.test/new-source';
  emit('angles', 'UPDATE', data.angles[0]);
  await page.waitForFunction(() => [...document.querySelectorAll('input')].some((input) => input.value === 'https://example.test/new-source'));
  assert.equal(await page.locator('textarea').inputValue(), 'Unsaved draft survives');
  assert.equal(await page.locator('textarea').evaluate((element) => element === document.activeElement), true);
  results.push('Taxonomy draft and focus survive while untouched fields update live');
  await tab(page, 'Inspiration');
  await page.getByRole('button',{name:'Open task activity',exact:true}).click();
  await page.getByText('JOB-1', { exact: true }).waitFor();
  data.inspiration_queue.length = 0;
  emit('inspiration_queue', 'DELETE', { id: 'JOB-1' });
  await page.getByText('JOB-1', { exact: true }).waitFor({ state: 'detached' });
  results.push('Primary-key-only realtime deletion refreshes the scoped queue');
  await page.keyboard.press('Escape');
  await tab(page, 'Creative Tracker');
  data.ads.push({ ...data.ads[0], id: 'AD-OTHER', product_id: 'qa-second', format_name: 'Other product only' });
  control.holdNextAds = true;
  emit('ads', 'UPDATE', data.ads[0]);
  for (let attempt = 0; !control.release && attempt < 100; attempt++) await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(typeof control.release, 'function');
  await page.locator('main > section').first().locator('select').selectOption('qa-second');
  await page.locator('tr[data-creative-id]').getByText('Other product only', { exact: true }).waitFor();
  control.release();
  control.release = null;
  await page.waitForTimeout(250);
  assert.equal(await page.locator('tr[data-creative-id]').getByText('QA creative', { exact: true }).count(), 0);
  await page.locator('main > section').first().locator('select').selectOption('qa-fixture');
  await page.locator('tr[data-creative-id]').getByText('QA creative', { exact: true }).waitFor();
  results.push('Delayed previous-product fetch cannot overwrite the active product');
  await tab(page, 'Action Plan');
  await page.getByRole('button', { name: 'QA creative', exact: true }).click();
  await page.getByRole('button', { name: 'Close task detail' }).waitFor();
  data.ads[0].status = 'Approved';
  emit('ads', 'UPDATE', data.ads[0]);
  await page.waitForFunction(() => document.querySelector('[aria-label="Status for QA creative"]')?.value === 'Approved');
  assert.equal(await page.getByRole('button', { name: 'Close task detail' }).count(), 1);
  results.push('Action Plan inspector stays open while linked creative updates');
  const secondPage = await context.newPage();
  secondPage.on('pageerror', (error) => errors.push(error.message));
  await secondPage.goto(baseUrl, { waitUntil: 'networkidle' });
  await secondPage.getByRole('navigation', { name: 'Command Center sections' }).waitFor();
  await tab(secondPage, 'Production');
  await secondPage.waitForFunction(() => document.querySelector('[aria-label="Status for QA creative"]')?.value === 'Approved');
  await page.getByRole('dialog').getByRole('combobox', { name: 'Status', exact: true }).selectOption('Testing');
  await page.getByText('Task successfully updated.', { exact: true }).waitFor();
  await secondPage.waitForFunction(() => document.querySelector('[aria-label="Status for QA creative"]')?.value === 'Testing');
  results.push('Local save updates a second browser tab without a server event');
  await secondPage.close();
  await page.getByRole('dialog').getByLabel('Due date', { exact: true }).fill('2026-10-01');
  await page.getByText('Task successfully updated.', { exact: true }).waitFor();
  assert.ok(writes.some((write) => write.rpc === 'qa_plan_edit' && write.input.p_status === 'Testing'));
  results.push('Action Plan detail, status, and due-date mutations');
  await page.getByRole('button', { name: 'Close task detail', exact: true }).click();
  await tab(page, 'Creative Matrix');
  await page.locator('[data-matrix-cell]').first().click();
  await page.getByRole('tab', { name: 'Insights', exact: true }).click();
  await page.getByRole('button', { name: 'Close inspector' }).click();
  results.push('Matrix cell selection and inspector navigation');
  await tab(page, 'Competitors');
  await page.getByRole('button', { name: 'Add brand', exact: true }).click();
  await page.getByLabel('Brand name', { exact: true }).fill('Additional QA Brand');
  await page.getByRole('button', { name: 'Save brand', exact: true }).click();
  await page.getByText('Added Additional QA Brand.', { exact: true }).waitFor();
  results.push('Competitor create form and save');
  await tab(page, 'Strategist');
  await page.getByRole('button', { name: 'Structured', exact: true }).click();
  await page.getByRole('heading', { name: 'Strategy', exact: true }).waitFor();
  results.push('Strategist structured memory');
  await tab(page, 'Command HQ');
  await page.locator('main > section').first().locator('select').selectOption('qa-second');
  assert.equal(await page.evaluate(() => localStorage.getItem('immuvi_active_product')), 'qa-second');
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.locator('main > section').first().locator('select').inputValue(), 'qa-second');
  await page.getByRole('button', { name: 'Login and user details', exact: true }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.getByRole('button', { name: 'Sign in', exact: true }).waitFor();
  results.push('Product selection persistence and sign-out');
  await context.close();
  const connection = await makePage();
  await connection.page.locator('details summary').click();
  await connection.page.getByLabel('QA session API key').fill('synthetic-clickup-key');
  await connection.page.locator('details').first().getByRole('button', { name: /ClickUp list/ }).click();
  const listDialog = connection.page.getByRole('dialog', { name: 'Link ClickUp List', exact: true });
  await listDialog.getByRole('button', { name: 'Select', exact: true }).waitFor();
  assert.equal(await listDialog.getByRole('combobox').count(), 0);
  await listDialog.getByText('Manual entry', { exact: true }).click();
  await listDialog.getByLabel('List ID', { exact: true }).fill('https://app.clickup.com/9016762494/v/li/1301130000002447');
  await listDialog.getByRole('button', { name: 'Save', exact: true }).click();
  await listDialog.waitFor({ state: 'detached' });
  assert.equal(connection.control.clickupCalls.find((call) => call.operation === 'link').mappings, undefined);
  assert.ok(connection.control.clickupCalls.some((call) => call.operation === 'sync'));
  await connection.page.getByText('QA Test List linked. 3 tasks checked: 1 imported, 1 updated, 1 skipped.', { exact: true }).first().waitFor();
  assert.equal(await connection.page.evaluate(() => localStorage.getItem('immuvi_api_key')), null);
  await connection.page.screenshot({ path: `${artifactDir}/clickup-connection-desktop.png`, fullPage: true });
  await connection.page.setViewportSize({ width: 390, height: 844 });
  await connection.page.screenshot({ path: `${artifactDir}/clickup-connection-mobile.png`, fullPage: true });
  const overflow = await connection.page.evaluate(() => [...document.querySelectorAll('main *')].filter((node) => {
    const rect = node.getBoundingClientRect(); return rect.width && rect.right > innerWidth;
  }).map((node) => ({ tag: node.tagName, className: node.className, right: node.getBoundingClientRect().right })));
  assert.equal(await connection.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, JSON.stringify(overflow));
  await connection.page.getByRole('button', { name: 'Forget key', exact: true }).click();
  assert.equal(await connection.page.getByLabel('QA session API key').inputValue(), '');
  assert.equal(await connection.page.getByRole('button', { name: 'Sync ClickUp', exact: true }).isDisabled(), true);
  await connection.page.getByLabel('QA session API key').fill('synthetic-clickup-key');
  await connection.page.getByText('ClickUp: QA ClickUp User', { exact: true }).waitFor();
  await connection.page.getByRole('button', { name: 'Login and user details', exact: true }).click();
  await connection.page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await connection.page.getByRole('button', { name: 'Sign in', exact: true }).waitFor();
  assert.equal(await connection.page.evaluate(() => Object.keys(sessionStorage).some((key) => key.startsWith('immuvi:qa:'))), false);
  results.push('ClickUp list picker, manual URL fallback, automatic field detection, link-and-import, session-only key and responsive controls');
  await connection.context.close();
  const tracker = await makePage();
  await testTracker({ ...tracker, tab, artifactDir, results });
  const trackerBulk = await makePage();
  await require('./tracker-bulk-flow.cjs')({ ...trackerBulk, tab, artifactDir, results });
  await trackerBulk.context.close();
  await tracker.context.close();
  const trackerPresentation = await makePage();
  await require('./tracker-presentation-flow.cjs')({ ...trackerPresentation, tab, artifactDir, results });
  await trackerPresentation.context.close();
  const trackerLinks = await makePage();
  await require('./tracker-links-flow.cjs')({ ...trackerLinks, tab, artifactDir, results });
  await trackerLinks.context.close();
  const trackerFields = await makePage();
  await require('./tracker-fields-flow.cjs')({ ...trackerFields, tab, artifactDir, results });
  await trackerFields.context.close();
  const matrix=await makePage();
  await testMatrix({...matrix,tab,artifactDir,results});
  await matrix.context.close();
  const matrixPresentation = await makePage();
  await require('./matrix-presentation-flow.cjs')({ ...matrixPresentation, tab, artifactDir, results });
  await matrixPresentation.context.close();
  const matrixInspector = await makePage();
  await require('./matrix-inspector-flow.cjs')({ ...matrixInspector, tab, artifactDir, results });
  await matrixInspector.context.close();
  const matrixAddInsights = await makePage();
  await require('./matrix-add-insights-flow.cjs')({ ...matrixAddInsights, tab, artifactDir, results });
  await matrixAddInsights.context.close();
  const creation=await makePage();await testCreation({...creation,tab,artifactDir,results});await creation.context.close();
  const plan = await makePage(); await testPlan({ ...plan, tab, artifactDir, results }); await plan.context.close();
  const health = await makePage(); await testPlanHealth({ ...health, tab, artifactDir, results }); await health.context.close();
  const checkpoint = await makePage(); await testPlanCheckpoint({ ...checkpoint, tab, artifactDir, results }); await checkpoint.context.close();
  const linked = await makePage(); await testPlanLinkedDone({ ...linked, tab, artifactDir, results }); await linked.context.close();
  const pulse = await makePage(); await testPlanPulse({ ...pulse, tab, artifactDir, results }); await pulse.context.close();
  const period = await makePage(); await testPulsePeriod({ ...period, tab, artifactDir, results }); await period.context.close();
  const age = await makePage(); await testPlanAge({ ...age, tab, artifactDir, results }); await age.context.close();
  const history = await makePage(); await testPlanHistory({ ...history, tab, artifactDir, results }); await history.context.close();
  const filters = await makePage(); await testPlanFilters({ ...filters, tab, artifactDir, results }); await filters.context.close();
  const visibility = await makePage(); await testPlanVisibility({ ...visibility, tab, artifactDir, results }); await visibility.context.close();
  const adoption = await makePage(); await testPlanAdoption({ ...adoption, tab, artifactDir, results }); await adoption.context.close();
  const deletion = await makePage(); await testPlanDeletion({ ...deletion, tab, artifactDir, results }); await deletion.context.close();
  const recreation = await makePage(); await testPlanRecreation({ ...recreation, tab, artifactDir, results }); await recreation.context.close();
  const onescale = await makePage(); await testPlanOneScale({ ...onescale, tab, artifactDir, results }); await onescale.context.close();
  const visual = await makePage(); await testPlanVisual({ ...visual, tab, artifactDir, results }); await visual.context.close();
  const drawer = await makePage(); await testPlanDrawer({ ...drawer, tab, artifactDir, results }); await drawer.context.close();
  const modalDismiss = await makePage(); await testModalDismiss({ ...modalDismiss, tab, artifactDir, results }); await modalDismiss.context.close();
  const detail = await makePage(); await testDetailCards({ ...detail, tab, artifactDir, results }); await detail.context.close();
  const acceptance = await makePage(); await testPlanAcceptance({ ...acceptance, tab, artifactDir, results }); await acceptance.context.close();
  const selection = await makePage(); await testPlanSelection({ ...selection, tab, artifactDir, results }); await selection.context.close();
  const variations = await makePage(); await testPlanVariations({ ...variations, tab, artifactDir, results }); await variations.context.close();
  const lab = await makePage(); await testVariationLab({ ...lab, tab, artifactDir, results }); await lab.context.close();
  const menus = await makePage(); await testPlanMenus({ ...menus, tab, artifactDir, results }); await menus.context.close();
  const dates = await makePage(); await testPlanDateMenu({ ...dates, tab, artifactDir, results }); await dates.context.close();
  const counts = await makePage(); await testPlanCount({ ...counts, tab, artifactDir, results }); await counts.context.close();
  const navigationCounts = await makePage();
  await require('./navigation-counts-flow.cjs')({ ...navigationCounts, tab, artifactDir, results });
  await navigationCounts.context.close();
  const fields = await makePage(); await testPlanFields({ ...fields, tab, artifactDir, results }); await fields.context.close();
  const views = await makePage(); await testPlanViews({ ...views, tab, artifactDir, results }); await views.context.close();
  const creative = await makePage(); await testPlanCreative({ ...creative, tab, artifactDir, results }); await creative.context.close();
  const layouts = await makePage(); await testPlanLayouts({ ...layouts, tab, artifactDir, results }); await layouts.context.close();
  const trends = await makePage(); await testPlanTrends({ ...trends, tab, artifactDir, results }); await trends.context.close();
  const inspiration = await makePage(); await testInspirationLibrary({ ...inspiration, tab, artifactDir, results }); await inspiration.context.close();
  const inspirationEdits = await makePage(); await testInspirationMutations({ ...inspirationEdits, tab, artifactDir, results }); await inspirationEdits.context.close();
  const inspirationPlacement = await makePage(); await testInspirationPlacement({...inspirationPlacement,tab,artifactDir,results});await inspirationPlacement.context.close();
  const crossImport=await makePage();await testInspirationCrossImport({...crossImport,tab,artifactDir,results});await crossImport.context.close();
  const analytics=await makePage();await testInspirationAnalytics({...analytics,tab,artifactDir,results});await analytics.context.close();
  const recovery=await makePage();await testInspirationRecovery({...recovery,tab,artifactDir,results});await recovery.context.close();
  const batch=await makePage('member');await testInspirationBatch({...batch,tab,artifactDir,results});await batch.context.close();
  const parity=await makePage('member');await testInspirationParity({...parity,tab,artifactDir,results});await parity.context.close();
  const inline=await makePage('member');await testInspirationInline({...inline,tab,artifactDir,results});await inline.context.close();
  const mapping=await makePage('member');await testInspirationMapping({...mapping,tab,artifactDir,results});await mapping.context.close();
  const duplicates=await makePage('member');await testInspirationDuplicates({...duplicates,tab,artifactDir,results});await duplicates.context.close();
  const final=await makePage('member');await testFinalInspiration({...final,tab,artifactDir,results});await final.context.close();
  const production=await makePage();await testProduction({...production,tab,artifactDir,results});await production.context.close();
  const productionTasks=await makePage();await testProductionTasks({...productionTasks,tab,artifactDir,results});await productionTasks.context.close();
  const productionFinal=await makePage();await testProductionFinal({...productionFinal,tab,artifactDir,results});await productionFinal.context.close();
  const hq = await makePage(); await testCommandHq({ ...hq, tab, artifactDir, results }); await hq.context.close();
  const hqOps = await makePage(); await testHqOperations({ ...hqOps, tab, artifactDir, results }); await hqOps.context.close();
  const hqMember = await makePage('member'); await testHqOperations.member({ ...hqMember, tab, results }); await hqMember.context.close();
  const hqFinal = await makePage(); await testHqFinal({ ...hqFinal, tab, artifactDir, results }); await hqFinal.context.close();
  const taxonomy = await makePage(); await testTaxonomyRelationships({ ...taxonomy, tab, artifactDir, results }); await taxonomy.context.close();
  const taxonomyEdits = await makePage(); await testTaxonomyMutations({ ...taxonomyEdits, tab, artifactDir, results }); await taxonomyEdits.context.close();
  const taxonomyRename = await makePage(); await testTaxonomyRename({ ...taxonomyRename, tab, artifactDir, results }); await taxonomyRename.context.close();
  const productAdmin = await makePage(); await testProductAdministration({ ...productAdmin, tab, artifactDir, results }); await productAdmin.context.close();
  const accessAdmin = await makePage(); await testAdminAccess({ ...accessAdmin, tab, artifactDir, results }); await accessAdmin.context.close();
  const accountAdmin = await makePage(); await testAccountOperations({ ...accountAdmin, tab, artifactDir, results }); await accountAdmin.context.close();
  const creationAdmin = await makePage(); await testAccountCreation({ ...creationAdmin, tab, artifactDir, results }); await creationAdmin.context.close();
  const cleanupAdmin = await makePage(); await testStaleCleanup({ ...cleanupAdmin, tab, artifactDir, results }); await cleanupAdmin.context.close();
  const workersAdmin = await makePage(); await testWorkerControls({ ...workersAdmin, tab, artifactDir, results }); await workersAdmin.context.close();
  const taxonomyAdminFinal=await makePage(); await testTaxonomyAdminFinal({...taxonomyAdminFinal,tab,artifactDir,results}); await taxonomyAdminFinal.context.close();
  const member = await makePage('member', false, true);
  await testProductAdministration.member({ ...member, tab, results });
  assert.equal(await member.page.locator('nav button').count(), 10);
  assert.equal(await member.page.locator('main > section').first().locator('select option').count(), 1);
  for (const name of names.filter((name) => name !== 'Admin')) await tab(member.page, name);
  await member.page.screenshot({ path: `${artifactDir}/mobile.png`, fullPage: true });
  results.push('Member access and all ten tabs on mobile');
  await member.context.close();
  const password = await makePage('member', true);
  await password.page.getByLabel('New password', { exact: true }).fill('fixture-new-password');
  await password.page.getByLabel('Confirm password', { exact: true }).fill('fixture-mismatch');
  await password.page.getByRole('button', { name: 'Set new password', exact: true }).click();
  await password.page.getByText('Passwords do not match.', { exact: true }).waitFor();
  await password.page.getByLabel('Confirm password', { exact: true }).fill('fixture-new-password');
  await password.page.getByRole('button', { name: 'Set new password', exact: true }).click();
  await password.page.getByRole('navigation', { name: 'Command Center sections' }).waitFor();
  results.push('Forced password change validation and completion');
  await password.context.close();
  assert.deepEqual(errors, [], 'Browser errors');
  assert.deepEqual(external, [], 'Unexpected external requests');
  fs.writeFileSync(`${artifactDir}/results.json`, JSON.stringify({ results, errors, external, mutationCount: writes.length }, null, 2));
  console.log(JSON.stringify({ results, errors, external, mutationCount: writes.length }, null, 2));
})().catch(async (error) => {
  console.error(error); process.exitCode = 1;
  const page = browser?.contexts().at(-1)?.pages().at(-1);
  if (page) {
    await page.screenshot({ path: `${artifactDir}/failure.png`, fullPage: true });
    if (await page.locator('dialog').count()) console.error(await page.locator('dialog').ariaSnapshot());
  }
}).finally(async () => { await browser?.close(); });
