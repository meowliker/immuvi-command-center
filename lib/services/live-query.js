/** A load returns a commit function; only the latest valid load may commit. */
export function createLiveQuery({ load, onBusy, onError, delay = 150 }) {
  let active = false;
  let paused = false;
  let revision = 0;
  let timer;
  let controller;
  let pending = false;
  let hasLoaded = false;

  function cancel() {
    revision += 1;
    controller?.abort();
    clearTimeout(timer);
    timer = undefined;
  }

  async function refresh(options = {}) {
    if (!active) return false;
    pending = true;
    cancel();
    if (paused) return false;
    pending = false;
    const current = revision;
    controller = new AbortController();
    const request = { ...options, background: Boolean(options.background && hasLoaded) };
    if (!request.background) onBusy(true);
    try {
      const commit = await load(controller.signal, request);
      if (!active || paused || current !== revision) return false;
      commit();
      hasLoaded = true;
      onError('');
      return true;
    } catch (error) {
      if (active && current === revision && !controller.signal.aborted) {
        onError(error instanceof Error ? error.message : 'Could not refresh data.');
      }
      return false;
    } finally {
      if (active && current === revision) onBusy(false);
    }
  }

  function invalidate() {
    if (!active) return;
    pending = true;
    cancel();
    if (!paused) timer = setTimeout(() => { void refresh({ background: true }); }, delay);
  }

  return {
    start() { active = true; },
    refresh,
    invalidate,
    setPaused(value) {
      if (paused === value) return;
      paused = value;
      if (paused) {
        pending = true;
        cancel();
        onBusy(false);
      } else if (pending) invalidate();
    },
    dispose() {
      active = false;
      pending = false;
      cancel();
    },
  };
}
