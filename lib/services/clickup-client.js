import { assertClickUpEnvironmentList } from '../domain/clickup-environment.js';

export function createClickUpClient(token, { fetchImpl = fetch, signal, environment = 'qa', productId } = {}) {
  if (!['qa', 'production'].includes(environment)) throw new Error('Unknown ClickUp environment.');
  const label = environment === 'production' ? 'production' : 'QA';
  const assertQaClickUpList = (listId) => assertClickUpEnvironmentList(listId, environment, productId);
  if (!token?.trim()) throw new Error(`Enter a ClickUp API key for this ${label} session.`);
  async function request(path, method = 'GET', body) {
    const response = await fetchImpl(`https://api.clickup.com/api/v2${path}`, {
      method, signal, cache: 'no-store', redirect: 'error',
      headers: { Authorization: token, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) {
      // Do not echo third-party response bodies: they can contain credentials or task content.
      if (response.status === 429) throw new Error('ClickUp rate limit reached. Wait a minute before retrying.');
      const error = new Error([401,403].includes(response.status) ? `ClickUp rejected this key or its access to the ${label} list.` : `ClickUp request failed (${response.status}). No automatic write retry was attempted.`);
      error.status = response.status;
      throw error;
    }
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!data || typeof data !== 'object') throw new Error('ClickUp returned an invalid response.');
    return data;
  }
  async function verifiedTask(listId, taskId) {
    assertQaClickUpList(listId);
    if (!/^[a-zA-Z0-9_-]+$/.test(taskId)) throw new Error('Invalid task ID.');
    const task = await request(`/task/${taskId}`);
    if (environment === 'production' && String(task.id) !== String(taskId)) throw new Error('ClickUp task identity did not match.');
    if (String(task.list?.id || '') !== listId) throw new Error(`This task does not belong to the linked ${label} list.`);
    return task;
  }
  return {
    async identity() {
      const { user } = await request('/user');
      if (!user || !user.id || typeof user.username !== 'string' && typeof user.email !== 'string') throw new Error('ClickUp user identity could not be verified.');
      return { id: String(user.id), name: String(user.username || user.email).slice(0,200), email: typeof user.email === 'string' ? user.email.slice(0,254) : '' };
    },
    getTask: verifiedTask,
    async comments(listId,taskId) {
      await verifiedTask(listId,taskId);
      const comments=[],cursors=new Set();let query='';
      for(let page=0;page<100;page++) {
        const result=await request(`/task/${taskId}/comment${query}`);
        if(!Array.isArray(result.comments))throw new Error('ClickUp returned incomplete comments.');
        comments.push(...result.comments);
        if(result.comments.length<25)return comments;
        const last=result.comments.at(-1),cursor=JSON.stringify([last?.date,last?.id]);
        if(!last?.id || !/^\d+$/.test(String(last.date)) || cursors.has(cursor))throw new Error('ClickUp comment pagination did not advance.');
        cursors.add(cursor);query=`?start=${encodeURIComponent(last.date)}&start_id=${encodeURIComponent(last.id)}`;
      }
      throw new Error('ClickUp comment history exceeds the lookup limit.');
    },
    async setAssignees(listId, taskId, ids) {
      const task = await verifiedTask(listId, taskId);
      if (!Array.isArray(ids) || ids.some((id) => !Number.isSafeInteger(id) || id <= 0)) throw new Error('Invalid task assignees.');
      const current = (task.assignees || []).map((user) => Number(user.id));
      return request(`/task/${taskId}`, 'PUT', { assignees: { add: ids.filter((id) => !current.includes(id)), rem: current.filter((id) => !ids.includes(id)) } });
    },
    async members(listId) {
      assertQaClickUpList(listId);
      const result = await request(`/list/${listId}/member`);
      return result.members || [];
    },
    async setField(listId, taskId, field, value) {
      const task = await verifiedTask(listId, taskId);
      if (!/^[a-zA-Z0-9_-]+$/.test(field.id)) throw new Error('Invalid custom field ID.');
      const path = `/task/${taskId}/field/${field.id}`;
      if (value === null) return request(path, 'DELETE');
      if (field.type === 'users') {
        const current = task.custom_fields?.find((item) => item.id === field.id)?.value || [];
        const before = current.map((user) => Number(user.id ?? user));
        return request(path, 'POST', { value: { add: value.filter((id) => !before.includes(id)), rem: before.filter((id) => !value.includes(id)) } });
      }
      return request(path, 'POST', { value });
    },
    async deleteTask(listId, taskId) {
      try { await verifiedTask(listId, taskId); } catch (error) { if (error.status === 404) return {}; throw error; }
      const result = await request(`/task/${taskId}`, 'DELETE');
      if (environment === 'production') {
        try { await verifiedTask(listId, taskId); } catch (error) { if (error.status === 404) return result; throw error; }
        throw new Error('Task deletion has not been confirmed. Retry the same task identity.');
      }
      return result;
    },
    async comment(listId, taskId, text) {
      await verifiedTask(listId, taskId);
      return request(`/task/${taskId}/comment`, 'POST', { comment_text: text, notify_all: false });
    },
    async addTag(listId,taskId,tag) {
      await verifiedTask(listId,taskId);
      if (!['production','app-created'].includes(tag)) throw new Error('Unsupported creation tag.');
      return request(`/task/${taskId}/tag/${encodeURIComponent(tag)}`,'POST');
    },
    async inspect(listId) {
      assertQaClickUpList(listId);
      const [list, schema] = await Promise.all([
        request(`/list/${listId}`),
        request(`/list/${listId}/field?include_applied_objects=true`),
      ]);
      if (String(list.id) !== listId) throw new Error('ClickUp list identity did not match.');
      if (!Array.isArray(schema.fields)) throw new Error('ClickUp did not return a field schema.');
      return { list: { id: String(list.id), name: list.name, statuses: list.statuses || [],
        spaceName: list.space?.name || '', folderName: list.folder?.hidden ? '' : list.folder?.name || '' }, fields: schema.fields };
    },
    async tasks(listId, { includeArchived = false, requireExplicitEnd = environment === 'production' } = {}) {
      assertQaClickUpList(listId);
      const tasks = new Map();
      for (const archived of (includeArchived ? [false,true] : [false])) {
        let complete = false;
        const pageIds = new Set();
        for (let page = 0; page < 200; page++) {
        const data = await request(`/list/${listId}/task?include_closed=true&subtasks=true&archived=${archived}&page=${page}`);
        if (!Array.isArray(data.tasks)) throw new Error('ClickUp returned an incomplete task page. Nothing was imported.');
        if (requireExplicitEnd && typeof data.last_page !== 'boolean') throw new Error('ClickUp did not explicitly confirm pagination completion. Cleanup is blocked.');
        let added = 0;
        for (const task of data.tasks) {
          if (!task.id || String(task.list?.id || '') !== listId) throw new Error('Task list boundary check failed. Nothing was imported.');
          if (requireExplicitEnd && pageIds.has(task.id)) throw new Error('ClickUp repeated a task during pagination. Cleanup is blocked.');
          if (!pageIds.has(task.id)) added++;
          pageIds.add(task.id);
          tasks.set(task.id, task);
        }
        if (data.last_page === true || (data.last_page !== false && data.tasks.length < 100)) { complete = true; break; }
        if (!added) throw new Error('ClickUp pagination repeated a page. Nothing was imported.');
        }
        if (!complete) throw new Error('ClickUp pagination exceeded the safety limit. Nothing was imported.');
      }
      return [...tasks.values()];
    },
    async updateTask(listId, taskId, fields) {
      await verifiedTask(listId, taskId);
      const allowed = Object.keys(fields).every((key) => ['status', 'due_date', 'name', 'description'].includes(key));
      if (!allowed || !Object.keys(fields).length) throw new Error('Unsupported task update.');
      if (fields.status !== undefined && (typeof fields.status !== 'string' || !fields.status.trim())) throw new Error('Invalid status.');
      if (fields.due_date !== undefined && fields.due_date !== null && !Number.isFinite(fields.due_date)) throw new Error('Invalid due date.');
      if (fields.name !== undefined && (typeof fields.name !== 'string' || !fields.name.trim())) throw new Error('Invalid name.');
      if (fields.description !== undefined && typeof fields.description !== 'string') throw new Error('Invalid description.');
      const updated = await request(`/task/${taskId}`, 'PUT', fields);
      if (fields.status !== undefined) {
        // A 2xx alone is insufficient: unknown statuses can be ignored by ClickUp.
        const confirmed = await verifiedTask(listId, taskId);
        if (String(confirmed.status?.status || '').trim().toLowerCase() !== fields.status.trim().toLowerCase()) {
          throw new Error('ClickUp did not confirm the requested status. The change remains pending; check the list statuses and retry.');
        }
      }
      return updated;
    },
    async createTask(listId, fields) {
      assertQaClickUpList(listId);
      const result = await request(`/list/${listId}/task`, 'POST', fields);
      if (!result.id) throw new Error('ClickUp did not confirm the new task identity. Check the list before retrying.');
      return { id: String(result.id) };
    },
  };
}
