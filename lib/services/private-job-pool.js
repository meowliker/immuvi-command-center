export function createPrivateJobPool(limit = 2) {
  const running = new Map();
  return {
    get size() { return running.size; },
    start(id, work) {
      if (running.has(id) || running.size >= limit) throw new Error('Private worker capacity exceeded.');
      const promise = Promise.resolve().then(work).finally(() => running.delete(id));
      running.set(id, promise);
      return promise;
    },
    async drain() { await Promise.allSettled([...running.values()]); },
  };
}
