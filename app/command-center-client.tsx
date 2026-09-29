'use client';

import { useState } from 'react';

import styles from './command-center.module.css';
import { useCommandCenter } from './command-center/hooks/use-command-center';
import { CommandNavigation } from './command-center/components/command-navigation';
import { ActionPlanTab } from './command-center/tabs/action-plan-tab';
import { AdminTab } from './command-center/tabs/admin-tab';
import { CompetitorsTab } from './command-center/tabs/competitors-tab';
import { CreativeMatrixTab } from './command-center/tabs/creative-matrix-tab';
import { CreativeTrackerTab } from './command-center/tabs/creative-tracker-tab';
import { InspirationTab } from './command-center/tabs/inspiration-tab';
import { OverviewTab } from './command-center/tabs/overview-tab';
import { ClickUpConnection } from './command-center/components/clickup-connection';
import { ClickUpProvider } from './command-center/components/clickup-provider';
import { HeaderClickUpControls } from './command-center/components/header-clickup-controls';
import { WorkspaceSessionProvider, SessionHeaderControls } from './command-center/components/workspace-session';
import headerStyles from './command-center/workspace-header.module.css';
import { ProductFieldCatalogProvider } from './command-center/components/product-field-catalog';
import { ProductionTab } from './command-center/tabs/production-tab';
import { StrategistTab } from './command-center/tabs/strategist-tab';
import { TaxonomyTab } from './command-center/tabs/taxonomy-tab';
import type { QaNextClientProps } from './command-center/types';

export default function CommandCenterClient({ supabaseUrl, supabaseAnonKey }: QaNextClientProps) {
  const [matrixTarget, setMatrixTarget] = useState<{ scope: string; angle: string; persona: string } | null>(null);
  const [creativeTarget,setCreativeTarget]=useState<{scope:string;id:string}|null>(null);
  const {
    state,
    signIn,
    email,
    setEmail,
    password,
    setPassword,
    busy,
    changePassword,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    signOut,
    switchProduct,
    setActiveTab,
    supabase,
    reloadAccess,
  } = useCommandCenter({ supabaseUrl, supabaseAnonKey });

  if (state.view === 'checking') {
    return (
      <main className={styles.shell}>
        <section className={styles.authCard}>
          <h1>Immuvi Command Center</h1>
          <p>{state.message || 'Checking session...'}</p>
          {state.message ? <button type="button" onClick={() => reloadAccess()}>Retry</button> : null}
        </section>
      </main>
    );
  }

  if (state.view === 'login') {
    return (
      <main className={styles.shell}>
        <form className={styles.authCard} onSubmit={signIn}>
          <h1>Immuvi Command Center</h1>
          <p>Sign in to continue</p>
          <label>
            <span>Email</span>
            <input
              autoComplete="username"
              autoFocus
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label>
            <span>Password</span>
            <input
              autoComplete="current-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {state.error ? <div className={styles.error}>{state.error}</div> : null}
          <button disabled={busy} type="submit">{busy ? 'Signing in...' : 'Sign in'}</button>
          <small>Need access? Contact your admin.</small>
        </form>
      </main>
    );
  }

  if (state.view === 'password') {
    return (
      <main className={styles.shell}>
        <form className={styles.authCard} onSubmit={changePassword}>
          <h1>Set a new password</h1>
          <p>Choose a new password to continue.</p>
          <label>
            <span>New password</span>
            <input
              autoComplete="new-password"
              minLength={8}
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
            />
          </label>
          <label>
            <span>Confirm password</span>
            <input
              autoComplete="new-password"
              minLength={8}
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
          </label>
          {state.error ? <div className={styles.error}>{state.error}</div> : null}
          <button disabled={busy} type="submit">{busy ? 'Updating...' : 'Set new password'}</button>
          <button className={styles.linkButton} type="button" onClick={signOut}>Sign out</button>
        </form>
      </main>
    );
  }

  const activeProduct = state.products.find((product) => product.id === state.activeProductId) || state.products[0];

  const dashboard = (
    <main className={styles.dashboard} data-workspace>
      <header className={headerStyles.header}>
        <div className={headerStyles.brand}>
          <h1>Immuvi Command Center</h1>
          <small>{activeProduct?.name || 'Creative'} Ops</small>
        <label className={headerStyles.product}>
          <span>Product</span>
          <select
            aria-label="Product"
            value={activeProduct?.id || ''}
            onChange={(event) => { setMatrixTarget(null); switchProduct(event.target.value); }}
            disabled={!state.products.length}
          >
            {state.products.map((product) => (
              <option key={product.id} value={product.id}>{product.name || product.id}</option>
            ))}
          </select>
        </label>
        </div>
        {activeProduct?<HeaderClickUpControls product={activeProduct}/>:<div/>}
        <SessionHeaderControls signOut={signOut}/>
      </header>

      {state.error ? <div className={styles.error}>{state.error}</div> : null}
      {activeProduct ? <ClickUpConnection product={activeProduct} profile={state.profile} /> : null}

      <CommandNavigation key={`navigation:${state.user.id}:${state.activeProductId}`} profile={state.profile} activeTab={state.activeTab} onChange={(tab) => { setMatrixTarget(null);setCreativeTarget(null); setActiveTab(tab); }} supabase={supabase} productId={state.activeProductId} />

      <section className={`${styles.tabPanel} ${state.activeTab === 'action-plan' ? styles.planSurface : ''}`} key={`${state.user.id}:${state.activeProductId}:${state.activeTab}`}>
        {state.activeTab === 'overview' ? (
          <OverviewTab supabase={supabase} profile={state.profile} products={state.products} activeProduct={activeProduct} switchProduct={switchProduct} />
        ) : null}
        {state.activeTab === 'angles' ? (
          <TaxonomyTab kind="angle" supabase={supabase} activeProductId={state.activeProductId} userId={state.user.id} openCreative={(id) => { setCreativeTarget({ scope: `${state.user.id}:${state.activeProductId}`, id }); setActiveTab('creative-tracker'); }} />
        ) : null}
        {state.activeTab === 'personas' ? (
          <TaxonomyTab kind="persona" supabase={supabase} activeProductId={state.activeProductId} userId={state.user.id} openCreative={(id) => { setCreativeTarget({ scope: `${state.user.id}:${state.activeProductId}`, id }); setActiveTab('creative-tracker'); }} />
        ) : null}
        {state.activeTab === 'competitors' ? (
          <CompetitorsTab supabase={supabase} activeProductId={state.activeProductId} userId={state.user.id} />
        ) : null}
        {state.activeTab === 'action-plan' ? (
          <ActionPlanTab key={state.activeProductId} supabase={supabase} activeProductId={state.activeProductId} activeProduct={activeProduct} openMatrix={(angle, persona) => {
            setMatrixTarget({ scope: `${state.user.id}:${state.activeProductId}`, angle, persona });
            setActiveTab('creative-matrix');
          }} />
        ) : null}
        {state.activeTab === 'creative-tracker' ? (
          <CreativeTrackerTab supabase={supabase} activeProductId={state.activeProductId} activeProduct={activeProduct} target={creativeTarget?.scope===`${state.user.id}:${state.activeProductId}`?creativeTarget.id:null} consumeTarget={()=>setCreativeTarget(null)}/>
        ) : null}
        {state.activeTab === 'creative-matrix' ? (
          <CreativeMatrixTab supabase={supabase} activeProductId={state.activeProductId}
            target={matrixTarget?.scope === `${state.user.id}:${state.activeProductId}` ? matrixTarget : null} consumeTarget={() => setMatrixTarget(null)} />
        ) : null}
        {state.activeTab === 'production' ? (
          <ProductionTab supabase={supabase} activeProductId={state.activeProductId} activeProduct={activeProduct} />
        ) : null}
        {state.activeTab === 'strategist' ? (
          <StrategistTab supabase={supabase} activeProductId={state.activeProductId} activeProduct={activeProduct} userId={state.user.id} />
        ) : null}
        {state.activeTab === 'inspiration' ? (
          <InspirationTab workerAdminId={state.profile.role === 'admin' ? state.user.id : undefined} supabase={supabase} activeProductId={state.activeProductId} activeProduct={activeProduct} products={state.products} openCreative={(id)=>{setCreativeTarget({scope:`${state.user.id}:${state.activeProductId}`,id});setActiveTab('creative-tracker');}} />
        ) : null}
        {state.activeTab === 'admin' && state.profile.role === 'admin' ? (
          <AdminTab supabase={supabase} session={state.session} />
        ) : null}
      </section>
    </main>
  );
  return <WorkspaceSessionProvider key={state.user.id} db={supabase} profile={state.profile}><ProductFieldCatalogProvider product={activeProduct}>{activeProduct ? <ClickUpProvider key={`${state.user.id}:${activeProduct.id}:${state.profile.role}`} supabase={supabase} product={activeProduct} profile={state.profile}>{dashboard}</ClickUpProvider> : dashboard}</ProductFieldCatalogProvider></WorkspaceSessionProvider>;
}
