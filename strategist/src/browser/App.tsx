import { useCallback,useEffect,useRef,useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ArrowLeft,RefreshCw,Play,ScanText,Layers,CloudDownload,X,ExternalLink,AlertCircle } from 'lucide-react'
import { api,initSession,SessionError } from './api'
import type { Snapshot } from '../lib/data/types'
import CreativesTable from '../components/CreativesTable'
import HooksView from '../components/HooksView'
import Formats from '../views/Formats'
import Keywords from '../views/Keywords'
import Verification from '../views/Verification'
import Research from '../views/Research'
import '../app/globals.css'
import './immuvi.css'

const VIEWS=['Overview','Creatives','Formats','Keywords','Verification','Research','Hooks'] as const
type View=typeof VIEWS[number]
type Product={key:string;name:string;short:string;immuviId:string|null}
type Session={user:{id:string;name:string;isAdmin:boolean};products:Product[]}
type Job={id:string;kind:string;product_key:string|null;status:string;log:string[];error:string|null;cancel_requested:boolean;created_at:string}
const active=(j:Job)=>j.status==='queued'||j.status==='running'
function readLocation() {
  const params=new URLSearchParams(location.search)
  const view=VIEWS.find(v=>v.toLowerCase()===params.get('view')) || 'Overview'
  return {view,product:params.get('product') || ''}
}

function App() {
  const [session,setSession]=useState<Session|null>(null)
  const [authError,setAuthError]=useState('')
  const [locationState,setLocationState]=useState(readLocation)
  const [snap,setSnap]=useState<Snapshot|null>(null)
  const [research,setResearch]=useState<any>(null)
  const [hooks,setHooks]=useState<any[]|null>(null)
  const [loading,setLoading]=useState(true)
  const [loadedKey,setLoadedKey]=useState('')
  const [error,setError]=useState('')
  const [jobs,setJobs]=useState<Job[]>([])
  const [pending,setPending]=useState({toWatch:0,toEnrich:0})
  const [busy,setBusy]=useState('')
  const [version,setVersion]=useState(0)
  const [logOpen,setLogOpen]=useState(false)
  const requestRef=useRef(0)
  const seenRunning=useRef(new Set<string>())
  const {view,product}=locationState
  const loadKey=`${view}:${product}:${version}`
  const waiting=loading||(!error&&loadedKey!==loadKey)
  const activeProduct=useRef(product)
  activeProduct.current=product
  const selected=session?.products.find(p=>p.key===product)
  const scope:Record<string,string>=product?{product}:{}

  useEffect(()=>{
    let mounted=true
    initSession().then(s=>{
      if(!mounted)return
      setSession(s)
      const params=new URLSearchParams(location.search)
      const from=params.get('immuviProduct')
      if(from && !params.get('product')) {
        const p=s.products.find((p:Product)=>p.immuviId===from)
        // An unsupported Immuvi product must not fall through to another product's data.
        if(p)navigate(view,p.key)
        else {setError('This product is not configured in Strategist yet.');setLocationState({view,product:'unconfigured'})}
      }
    }).catch(e=>mounted&&setAuthError(e.message))
    return()=>{mounted=false}
  },[])

  useEffect(()=>{
    const listener=()=>setLocationState(readLocation())
    window.addEventListener('popstate',listener)
    return()=>window.removeEventListener('popstate',listener)
  },[])

  function navigate(nextView:View,nextProduct=product) {
    const params=new URLSearchParams({view:nextView.toLowerCase()})
    if(nextProduct)params.set('product',nextProduct)
    history.pushState(null,'',`/strategist.html?${params}`)
    setLocationState({view:nextView,product:nextProduct})
  }

  useEffect(()=>{
    if(!session)return
    const seq=++requestRef.current
    const controller=new AbortController()
    setSnap(null);setResearch(null);setHooks(null);setJobs([]);setPending({toWatch:0,toEnrich:0});setLoading(true);setError('')
    if(product && !session.products.some(p=>p.key===product)) {
      setError('This product is not configured in Strategist or is not assigned to your account.')
      setLoading(false)
      return()=>controller.abort()
    }
    const load=async()=>{
      const [snapshot,extra]=await Promise.all([
        api('snapshot',scope,undefined,controller.signal),
        view==='Research'?api('research',scope,undefined,controller.signal):view==='Hooks'?api('hooks',scope,undefined,controller.signal):null,
      ])
      if(seq!==requestRef.current)return
      setSnap(snapshot)
      if(view==='Research')setResearch(extra)
      if(view==='Hooks')setHooks(extra)
      setLoadedKey(`${view}:${product}:${version}`)
    }
    load().catch(e=>{
      if(e.name==='AbortError'||seq!==requestRef.current)return
      if(e instanceof SessionError)setAuthError(e.message)
      else setError(e.message)
    }).finally(()=>{if(seq===requestRef.current)setLoading(false)})
    return()=>controller.abort()
  },[session,product,view,version])

  const loadJobs=useCallback(async(signal?:AbortSignal)=>{
    if(!session || (product&&!session.products.some(p=>p.key===product)))return
    const response=await api('jobs',product?{product}:{},undefined,signal)
    if(signal?.aborted || product!==activeProduct.current)return
    const running=response.jobs.filter(active) as Job[]
    const finished=response.jobs.some((j:Job)=>!active(j)&&seenRunning.current.has(j.id))
    seenRunning.current=new Set(running.map(j=>j.id))
    setJobs(response.jobs);setPending(response.pending)
    if(finished)setVersion(v=>v+1)
  },[session,product])

  useEffect(()=>{
    const controller=new AbortController()
    seenRunning.current=new Set()
    const tick=()=>loadJobs(controller.signal).catch(e=>{if(e.name!=='AbortError'&&!(e instanceof SessionError))setError(e.message)})
    tick()
    const timer=setInterval(()=>{if(document.visibilityState==='visible')tick()},8000)
    return()=>{controller.abort();clearInterval(timer)}
  },[loadJobs])

  async function start(kind:string) {
    setBusy(kind);setError('')
    try {
      await api('jobs',{}, {kind,product:product||null,requestId:crypto.randomUUID()})
      setLogOpen(true);await loadJobs()
    } catch(e:any){setError(e.message)}finally{setBusy('')}
  }
  async function cancel(id:string) {
    try{await api('cancel',{}, {id});await loadJobs()}catch(e:any){setError(e.message)}
  }
  const activeJobs=jobs.filter(active)
  if(authError)return <main className="session-state"><h1>Immuvi Strategist</h1><p>{authError}</p><a className="primary-action" href="/"><ArrowLeft size={16}/>Open Immuvi</a></main>
  if(!session)return <main className="session-state" aria-busy="true"><h1>Immuvi Strategist</h1><p>Checking your session...</p></main>
  const blocked=Boolean(busy)||Boolean(product&&!selected)||(!product&&!session.user.isAdmin)
  return <>
    <header className="imm-header">
      <a className="back-link" href="/" title="Back to Immuvi"><ArrowLeft size={18}/><span>Immuvi</span></a>
      <span className="header-divider"/><strong>Strategist</strong>
      <label className="product-picker"><span className="sr-only">Product</span>
        <select aria-label="Product" value={product} onChange={e=>navigate(view,e.target.value)}>
          <option value="">All products</option>
          {product&&!selected&&<option value={product}>Product not configured</option>}
          {session.products.map(p=><option value={p.key} key={p.key}>{p.name}</option>)}
        </select>
      </label>
      <span className="header-user">{session.user.name || 'Immuvi account'}</span>
      <button className="icon-action" title="Refresh data" aria-label="Refresh data" onClick={()=>setVersion(v=>v+1)} disabled={loading}><RefreshCw size={17} className={loading?'spin':''}/></button>
    </header>
    <nav className="imm-nav" aria-label="Strategist views">
      {VIEWS.map(v=><button key={v} aria-current={v===view?'page':undefined} onClick={()=>navigate(v)}>{v}</button>)}
    </nav>
    <main className="imm-main">
      <div className="workspace-heading"><div><div className="scope-label">{selected?.name || (product?'Unconfigured product':'All assigned products')}</div><h1>{view==='Overview'?'Creative intelligence':view}</h1></div>
        <div className="job-controls">
          <button disabled={blocked} onClick={()=>start('sync')} title="Sync ClickUp"><CloudDownload size={15}/>Sync ClickUp</button>
          <button disabled={blocked} onClick={()=>start('watch')} title="Analyze outstanding winner media"><Play size={15}/>Watch{pending.toWatch>0&&<span className="count">{pending.toWatch}</span>}</button>
          <button disabled={blocked} onClick={()=>start('enrich')} title="Enrich creative research"><ScanText size={15}/>Enrich{pending.toEnrich>0&&<span className="count">{pending.toEnrich}</span>}</button>
          <button disabled={blocked} onClick={()=>start('synthesize')} title="Generate product synthesis"><Layers size={15}/>Synthesize</button>
        </div>
      </div>
      {error&&<div className="error-banner" role="alert"><AlertCircle size={17}/><span>{error}</span><button onClick={()=>setVersion(v=>v+1)}>Retry</button></div>}
      <div className="run-status">
        <span className={`status-dot ${activeJobs.length?'working':''}`}/>
        <button onClick={()=>setLogOpen(!logOpen)} aria-expanded={logOpen}>{activeJobs.length?`${activeJobs.length} job${activeJobs.length===1?'':'s'} ${activeJobs.some(j=>j.status==='running')?'in progress':'queued'}`:'Job history'}</button>
        {snap&&<span className="data-time">Updated {new Date(snap.generatedAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>}
      </div>
      {logOpen&&<section className="job-history" aria-label="Job history">
        {jobs.length===0?<p>No jobs yet.</p>:jobs.slice(0,10).map(j=><div className="job-entry" key={j.id}>
          <div className="job-entry-head"><strong>{j.kind}</strong><span>{session.products.find(p=>p.key===j.product_key)?.name||'All products'}</span><span className={`job-state ${j.status}`}>{j.cancel_requested&&active(j)?'Cancelling':j.status}</span>
            {active(j)&&<button className="icon-action" disabled={j.cancel_requested} title="Cancel job" aria-label="Cancel job" onClick={()=>cancel(j.id)}><X size={14}/></button>}</div>
          {j.log.length>0&&<pre>{j.log.slice(-6).join('\n')}</pre>}{j.error&&<p className="job-error">{j.error}</p>}
        </div>)}
      </section>}
      {waiting?<div className="loading-state" aria-busy="true"><RefreshCw className="spin" size={20}/><span>Loading {view.toLowerCase()}...</span></div>:snap&&<div className="view-content" key={`${view}:${product}`}>
        {view==='Overview'&&<Overview snap={snap} navigate={navigate}/>}
        {view==='Creatives'&&<CreativesTable snapshot={snap}/>}
        {view==='Formats'&&<Formats snap={snap}/>}
        {view==='Keywords'&&<Keywords snap={snap}/>}
        {view==='Verification'&&<Verification snap={snap}/>}
        {view==='Research'&&research&&<Research {...research}/>}
        {view==='Hooks'&&hooks&&<HooksView groups={hooks}/>}
      </div>}
    </main>
  </>
}

function Overview({snap,navigate}:{snap:Snapshot;navigate:(view:View)=>void}) {
  const stats=[['Tasks',snap.totals.tasks],['Winners',snap.totals.winners],['Losers',snap.totals.losers],['Tasks analyzed',snap.totals.analysed],['Field mismatches',snap.totals.mismatches]]
  const products=[...new Set(snap.creatives.map(c=>c.product))]
  return <>
    <div className="metric-band">{stats.map(([label,value])=><div key={label}><span>{label}</span><strong>{Number(value).toLocaleString()}</strong></div>)}</div>
    <section className="overview-products"><div className="section-title"><h2>Product coverage</h2><button onClick={()=>navigate('Creatives')}>View creatives<ExternalLink size={14}/></button></div>
      <div className="coverage-row coverage-labels"><span>Product</span><span>Winning tasks</span><span>Analyzed</span><span>Coverage</span></div>
      {products.map(product=>{
        const rows=snap.creatives.filter(c=>c.product===product)
        const winners=new Set(rows.filter(c=>['win','mild','scale'].includes(c.status)).map(c=>c.taskId))
        const analyzed=new Set(rows.filter(c=>c.analysed&&winners.has(c.taskId)).map(c=>c.taskId))
        const pct=winners.size?Math.round(analyzed.size/winners.size*100):0
        return <div className="coverage-row" key={product}><strong>{rows[0].productName}</strong><span>{winners.size}</span><span>{analyzed.size}</span><div className="coverage-value"><div className="coverage-track"><i style={{width:`${pct}%`}}/></div><span>{pct}%</span></div></div>
      })}
      {!products.length&&<p className="empty">No synced creatives in this product.</p>}
    </section>
    <section><div className="section-title"><h2>Field agreement</h2><button onClick={()=>navigate('Verification')}>View verification<ExternalLink size={14}/></button></div>
      <div className="agreement-grid">{snap.trust.map(t=><div key={t.field}><span>{t.label}</span><strong>{Math.round(t.agree/t.total*100)}%</strong><small>{t.agree} / {t.total} agree</small></div>)}</div>
      {!snap.trust.length&&<p className="empty">No verified fields yet.</p>}
    </section>
  </>
}
createRoot(document.getElementById('root')!).render(<App/> )
