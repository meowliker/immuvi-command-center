// UI tests only. Real persistence semantics are covered by the rolled-back SQL suite.
module.exports = function trackerRpc(data, name, input) {
  const a = data.ads.find((row) => row.id === input.p_ad_id && row.product_id === input.p_product_id);
  const stamp = () => new Date(Date.now() + Math.random() * 1000).toISOString();
  if (['qa_tracker_save','qa_tracker_delete'].includes(name) && a && !(name === 'qa_tracker_delete' && a.deleted_at) && a.updated_at !== input.p_expected_updated_at) return { message: 'Creative changed. Reload it before saving; your draft has been kept.', code: 'P0001' };
  if (name === 'qa_tracker_save') {
    const row = a || { id: `new-${data.ads.length}`, product_id: input.p_product_id, created_at: stamp(), status: 'Untested', meta: {} };
    Object.assign(row, { ...input.p_values, meta: { ...row.meta, ...input.p_values.meta }, updated_at: stamp() });
    for (const [id, field] of Object.entries(input.p_custom)) {
      (row.meta._customFieldsRaw ||= {})[field.name.toLowerCase()] = field.value;
      (row.meta._customFields ||= {})[field.name.toLowerCase()] = field.display;
    }
    if (!a) data.ads.push(row);
    return row;
  }
  if (name === 'qa_tracker_winner') {
    data.task_video_winners = data.task_video_winners.filter((file) => !(file.ad_id === a.id && file.drive_file_id === input.p_file_id));
    if (!input.p_remove) data.task_video_winners.push({ id: `winner-${input.p_file_id}`, ad_id: a.id, drive_file_id: input.p_file_id, file_name: input.p_name, web_view_url: `https://drive.google.com/file/d/${input.p_file_id}/view` });
    a.meta._winningArtifacts = data.task_video_winners.filter((file) => file.ad_id === a.id).map((file) => ({ id: file.drive_file_id, name: file.file_name, url: file.web_view_url }));
    a.updated_at = stamp(); return a;
  }
  if (name === 'qa_tracker_spawn') {
    const parent = data.ads.find((row) => row.id === input.p_parent_id && row.product_id === input.p_product_id && !row.deleted_at);
    if (!parent) return { code: 'P0001', message: 'Parent creative is unavailable' };
    if (parent.updated_at !== input.p_expected_updated_at) return { code: 'P0001', message: 'Parent changed. Reopen the variation form.' };
    if (!['Winner', 'Mild Winner', 'Scale'].includes(parent.status)) return { code: 'P0001', message: 'Choose a winning creative' };
    if (!Array.isArray(input.p_rows) || input.p_rows.length < 1 || input.p_rows.length > 20) return { code: 'P0001', message: 'Choose 1 to 20 variations' };
    const winner = data.task_video_winners.find((file) => file.ad_id === parent.id && file.drive_file_id === input.p_winner_file_id);
    if (input.p_winner_file_id && !winner) return { code: 'P0001', message: 'Selected winning file is no longer available' };
    let number = Math.max(0, ...data.ads.filter((ad) => ad.parent_ad_id === parent.id && ad.product_id === parent.product_id).map((ad) => Number(ad.variation_number) || 0));
    const ids = [];
    for (const [index, row] of input.p_rows.entries()) {
      if (input.p_kind === 'funnel' && data.ads.some((ad) => !ad.deleted_at && ad.angle === parent.angle && ad.persona === parent.persona && ad.funnel_stage === row.stage)) continue;
      let id;
      do { number++; id = `${parent.id}-V${number}`; } while (data.ads.some((ad) => ad.id === id) || data.deleted_ads.some((ad) => ad.id === id));
      if (input.p_kind === 'funnel') id = `funnel-${row.stage}`;
      data.ads.push({ ...parent, id, format_name: `${parent.format_name} - ${row.stage || `V${number}`}`, status: 'Untested', clickup_task_id: null, drive_link: '', ad_link: '',
        parent_ad_id: input.p_kind === 'variation' ? parent.id : null, variation_number: number,
        ad_origin: input.p_kind === 'variation' ? 'Winner Variation' : 'Funnel Expansion', funnel_stage: row.stage || parent.funnel_stage,
        meta: { notes: row.brief || '', variationBrief: row.brief || '', variationChanges: input.p_kind === 'variation' ? [row.axis] : [], variationFromText: row.from || '', variationToText: row.to || '', variationHypothesis: row.hypothesis || '',
          dueDate: row.dueDate || '', assignees: (row.editorIds || []).map((id) => ({ id: Number(id) })), _customFieldsRaw: { reviewer: (row.reviewerIds || []).map((id) => ({ id: Number(id) })) },
          ...(winner ? { _sourceWinningArtifact: { id: winner.drive_file_id, name: winner.file_name, url: winner.web_view_url } } : {}) }, updated_at: stamp() });
      data.matrix_cells.find((cell) => cell.product_id === parent.product_id).creative_assignments.push(id); ids.push(id);
    }
    return ids;
  }
  if (name === 'qa_tracker_delete') {
    if (!a) return { code: 'P0001', message: 'Creative is unavailable' };
    if (a.deleted_at) return a;
    if (data.qa_clickup_creations.some((j) => j.ad_id === a.id && !['linked', 'rejected'].includes(j.state))) return { code: 'P0001', message: 'ClickUp creation is unresolved.' };
    a.deleted_at = stamp(); a.updated_at = a.deleted_at;
    data.deleted_ads.push({ id: a.id, product_id: a.product_id, clickup_task_id: a.clickup_task_id || a.meta?._clickupId || a.meta?.clickupTaskId || null });
    data.manual_actions = data.manual_actions.filter((row) => row.product_id !== a.product_id || (row.payload.sourceAdId || row.payload.adId || row.payload._sourceAdId) !== a.id ||
      ((row.payload._clickupId || row.payload.clickupTaskId) && a.clickup_task_id && (row.payload._clickupId || row.payload.clickupTaskId) !== a.clickup_task_id));
    for (const cell of data.matrix_cells.filter((c) => c.product_id === a.product_id)) {
      cell.creative_assignments = (cell.creative_assignments || []).filter((id) => id !== a.id);
      cell.meta = Object.fromEntries(Object.entries(cell.meta || {}).filter(([key]) => key !== a.id && !key.startsWith(`${a.id}||`)));
    }
    if (a.meta?._fromInspoId && !data.ads.some((row) => row.product_id === a.product_id && !row.deleted_at && row.meta?._fromInspoId === a.meta._fromInspoId)) {
      const inspiration = data.inspirations.find((row) => row.product_id === a.product_id && row.id === a.meta._fromInspoId && row.status === 'Testing');
      if (inspiration) inspiration.status = 'Classified';
    }
    return a;
  }
  throw new Error(`Unmocked Tracker RPC: ${name}`);
};
