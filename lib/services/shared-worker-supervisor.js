import { QA_WORKER_PROTOCOL, rejectRelease } from './shared-worker-updates.js';

export function waitForWorkerReady(child, {timeoutMs=90000,signal}={}) {
  return new Promise((resolve,reject)=>{
    const finish = error=>{
      clearTimeout(timer);
      child.off('message',message);child.off('exit',exit);child.off('error',exit);
      signal?.removeEventListener('abort',abort);
      if (error) reject(error); else resolve();
    };
    const message = value=>{
      if (value?.type !== 'qa-worker-ready') return;
      finish(value.protocol === QA_WORKER_PROTOCOL && value.classifier === true ? null : new Error('Candidate capability check failed.'));
    };
    const exit = ()=>finish(new Error('Candidate exited before activation.'));
    const abort = ()=>finish(new Error('Supervisor stopped.'));
    const timer = setTimeout(()=>finish(new Error('Candidate startup timed out.')),timeoutMs);
    child.on('message',message);child.once('exit',exit);child.once('error',exit);
    signal?.addEventListener('abort',abort,{once:true});
    if (signal?.aborted) abort();
  });
}

export async function superviseRelease({child,state,saveState,signal,startupTimeoutMs=90000,stopTimeoutMs=5000}) {
  const exited = new Promise(resolve=>{
    child.once('exit',code=>resolve(code));child.once('error',()=>resolve(1));
  });
  let active = false, ended = false;
  void exited.then(()=>{ended=true;});
  const stop = ()=>{if (!ended) child.kill('SIGTERM');};
  signal?.addEventListener('abort',stop,{once:true});
  try {
    await waitForWorkerReady(child,{timeoutMs:startupTimeoutMs,signal});
    if (state.pending) await saveState({...state,pending:false});
    if (ended || signal?.aborted) throw new Error('Candidate stopped before activation.');
    await new Promise((resolve,reject)=>child.send({type:'qa-worker-activate',protocol:QA_WORKER_PROTOCOL},error=>error?reject(error):resolve()));
    active = true;
    return {code:await exited,rollback:false};
  } catch {
    // No queue claims are allowed before the supervisor acknowledges activation.
    if (state.pending && !signal?.aborted) {
      await saveState(rejectRelease(state));
      return {code:75,rollback:true};
    }
    return {code:1,rollback:false};
  } finally {
    signal?.removeEventListener('abort',stop);
    if (!active && !ended) {
      stop();
      const timer = setTimeout(()=>{if (!ended) child.kill('SIGKILL');},stopTimeoutMs);
      await exited;
      clearTimeout(timer);
    }
  }
}
