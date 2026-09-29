const clients = new WeakMap();
const GLOBAL_TABLES = new Set(['products', 'profiles', 'user_products', 'worker_registry', 'qa_image_worker', 'variation_brief_queue','qa_force_reloads']);
let channelSequence = 0;

/** Share table subscriptions and coordinate writes across mounted views. */
export function getLiveSync(client) {
  if (clients.has(client)) return clients.get(client);
  const subscriptions = new Map();
  const observers = new Set();
  const writing = new Set();
  const waiting = [];
  let broadcast;

  function notify(productId) {
    for (const observer of observers) {
      if (!productId || !observer.productId || observer.productId === productId) observer.invalidate();
    }
  }
  function isWriting(productId) {
    return writing.has('') || (productId ? writing.has(productId) : writing.size > 0);
  }
  function updatePause() {
    for (const observer of observers) observer.pause(isWriting(observer.productId));
  }
  function closeBroadcast() {
    if (!observers.size && !writing.size && !waiting.length) {
      broadcast?.close();
      broadcast = undefined;
    }
  }

  const overlaps = (one, two) => !one || !two || one === two;
  function startWrite(productId) {
    writing.add(productId);
    updatePause();
    let finished = false;
    return () => {
      if (finished) return;
      finished = true;
      writing.delete(productId);
      drain();
      updatePause();
      notify(productId);
      broadcast?.postMessage({ type: 'invalidate', productId });
      closeBroadcast();
    };
  }
  function drain() {
    for (let index = 0; index < waiting.length;) {
      const entry = waiting[index];
      if (isWriting(entry.productId) || waiting.slice(0, index).some(prior => overlaps(prior.productId, entry.productId))) { index++; continue; }
      waiting.splice(index, 1);
      entry.signal?.removeEventListener('abort', entry.abort);
      entry.resolve(startWrite(entry.productId));
    }
  }

  const sync = {
    isWriting,
    watch({ productId, tables, invalidate, pause }) {
      const observer = { productId, invalidate, pause };
      observers.add(observer);
      pause(isWriting(productId));
      if (!broadcast && typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
        broadcast = new BroadcastChannel(`immuvi-live:${new URL(client.supabaseUrl).host}`);
        broadcast.onmessage = ({ data }) => {
          if (data?.type === 'invalidate' && typeof data.productId === 'string') notify(data.productId);
        };
      }
      const entries = [...new Set(tables)].map((table) => {
        const scope = GLOBAL_TABLES.has(table) ? '' : productId;
        const key = JSON.stringify([table, scope]);
        let entry = subscriptions.get(key);
        if (!entry) {
          const listeners = new Set();
          const changed = (payload) => {
            const row = payload.eventType === 'DELETE' ? payload.old : payload.new;
            if (scope && row?.product_id && row.product_id !== scope) return;
            // Deletes may contain only a primary key. Re-query with RLS/product filters.
            for (const listener of listeners) listener();
          };
          const channel = client.channel(`command-center:${++channelSequence}`);
          for (const event of ['INSERT', 'UPDATE', 'DELETE']) {
            channel.on('postgres_changes', {
              event, schema: 'public', table,
              ...(scope && event !== 'DELETE' ? { filter: `product_id=eq.${scope}` } : {}),
            }, changed);
          }
          channel.on('system', {}, (payload) => {
            // Socket join can precede the database subscription becoming ready.
            if (payload.status === 'ok') for (const listener of listeners) listener();
          });
          entry = { channel, listeners };
          subscriptions.set(key, entry);
          listeners.add(invalidate);
          channel.subscribe((status) => {
            if (status === 'SUBSCRIBED') for (const listener of listeners) listener();
          });
        } else entry.listeners.add(invalidate);
        return [key, entry];
      });
      return () => {
        observers.delete(observer);
        for (const [key, entry] of entries) {
          entry.listeners.delete(invalidate);
          if (!entry.listeners.size) {
            subscriptions.delete(key);
            void client.removeChannel(entry.channel);
          }
        }
        closeBroadcast();
      };
    },
    beginWrite(productId) {
      if (isWriting(productId) || waiting.some(entry => overlaps(entry.productId, productId))) return null;
      return startWrite(productId);
    },
    acquireWrite(productId, signal) {
      return new Promise((resolve, reject) => {
        if (signal?.aborted) { reject(signal.reason); return; }
        const entry = { productId, signal, resolve, abort: () => {
          const index = waiting.indexOf(entry);
          if (index < 0) return;
          waiting.splice(index, 1);
          reject(signal.reason);
          drain(); closeBroadcast();
        } };
        waiting.push(entry);
        signal?.addEventListener('abort', entry.abort, { once: true });
        drain();
      });
    },
  };
  clients.set(client, sync);
  return sync;
}
