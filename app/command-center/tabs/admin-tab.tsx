import { productAssignmentLabel } from '../../../lib/domain/admin-users.js';
import styles from '../../command-center.module.css';
import { useAdmin } from '../hooks/use-admin';
import type { CreateUserForm } from '../types';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { useState } from 'react';
import type { AdminUser } from '../types';
import { TrackerDialog } from '../components/tracker-dialog';
import { AccountAudit } from '../components/account-audit';
import { WorkerControls } from '../components/worker-controls';
import parity from '../admin.module.css';

export function AdminTab({ supabase, session }: { supabase: SupabaseClient; session: Session }) {
  const [deleting, setDeleting] = useState<AdminUser | null>(null), [confirmEmail, setConfirmEmail] = useState('');
  const {
    users,
    products,
    healthOk,
    reload,
    notice,
    error,
    createUser,
    createForm,
    setCreateForm,
    setCreateProduct,
    busyAction,
    productNameById,
    drafts,
    setDraftProduct,
    updateProducts,
    resetPassword,
    setRole,
    setActive,
    accessPending, retryAccess, accessBusy, writesBlocked, staleAccess, dirtyAccess, reviewAccess,
    accountPending, accountBusy, recoverAccount, deleteUser,
    creationPending, creationBusy, recoverCreation,
  } = useAdmin({ supabase, session });

  return (
    <div className={parity.surface}>
      <section className={`${styles.adminToolbar} ${parity.toolbar}`}>
        <div><strong>{users.length}</strong><span>Users</span></div>
        <div><strong>{products.length}</strong><span>Products</span></div>
        <div className={healthOk ? styles.healthOk : styles.healthBad}><strong>{healthOk ? 'Ready' : 'Offline'}</strong><span>Admin API</span></div>
        <button type="button" onClick={() => reload()}>Refresh</button>
      </section>
      {notice ? <div className={styles.notice}>{notice}</div> : null}
      {error ? <div className={styles.error} role="alert">{error}</div> : null}
      {accessPending ? <div className={styles.notice} role="status">User access save needs confirmation. <button type="button" disabled={accessBusy} onClick={retryAccess}>Retry pending access change</button></div> : null}
      {accountPending ? <div className={styles.notice} role="status">Pending account operation: {accountPending.operation}. <button type="button" disabled={accountBusy} onClick={recoverAccount}>Recover account operation</button></div> : null}
      {creationPending ? <div className={styles.notice} role="status">Pending account creation: {creationPending.email}. <button type="button" disabled={creationBusy} onClick={recoverCreation}>Recover account creation</button></div> : null}
      <section className={`${styles.adminGrid} ${parity.grid}`}>
        <form className={`${styles.adminCreate} ${parity.create}`} onSubmit={createUser} aria-label="New teammate">
          <div><h2>Invite a user</h2></div>
          <label><span>Email</span><input disabled={creationBusy || !!creationPending} autoComplete="off" type="email" value={createForm.email} onChange={(event) => setCreateForm({ ...createForm, email: event.target.value })} required /></label>
          <label><span>Username</span><input disabled={creationBusy || !!creationPending} autoComplete="off" value={createForm.username} onChange={(event) => setCreateForm({ ...createForm, username: event.target.value })} /></label>
          <label><span>Full Name</span><input disabled={creationBusy || !!creationPending} autoComplete="off" value={createForm.fullName} onChange={(event) => setCreateForm({ ...createForm, fullName: event.target.value })} /></label>
          <label>
            <span>Role</span>
            <select aria-label="Role" disabled={creationBusy || !!creationPending} value={createForm.role} onChange={(event) => setCreateForm({ ...createForm, role: event.target.value as CreateUserForm['role'] })}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <label><span>Temporary Password</span><input disabled={creationBusy || !!creationPending} autoComplete="new-password" type="password" value={createForm.tempPassword} onChange={(event) => setCreateForm({ ...createForm, tempPassword: event.target.value })} placeholder="Leave blank to generate" /></label>
          {createForm.role === 'member' ? (
            <fieldset className={styles.productChecks} disabled={creationBusy || !!creationPending}>
              <legend>Product Access</legend>
              {products.map((product) => (
                <label key={product.id}>
                  <input checked={createForm.productIds.includes(product.id)} type="checkbox" onChange={() => setCreateProduct(product.id)} />
                  <span>{product.name || product.id}</span>
                </label>
              ))}
            </fieldset>
          ) : null}
          <button disabled={writesBlocked} type="submit">{busyAction === 'create-user' ? 'Creating...' : 'Create user'}</button>
        </form>
        <section className={`${styles.adminUsers} ${parity.users}`}>
          <div className={styles.adminSectionHeader}><div><span className={styles.eyebrow}>Admin</span><h2>Users</h2></div></div>
          <div className={styles.userRows}>
            {users.map((user) => (
              <article className={styles.userRow} key={user.id} aria-label={user.email}>
                <div className={styles.userIdentity}><strong>{user.email}</strong><span>{user.fullName || user.username || 'No profile name'}</span><small>Last sign-in: {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Not recorded'}</small></div>
                <div className={styles.statusStack}>
                  <span className={user.role === 'admin' ? styles.roleAdmin : styles.roleMember}>{user.role}</span>
                  <span className={user.isActive ? styles.activeBadge : styles.inactiveBadge}>{user.isActive ? 'Active' : 'Inactive'}</span>
                  {user.mustChangePassword ? <span className={styles.pendingBadge}>Password reset</span> : null}
                </div>
                <div className={styles.assignmentSummary}>{productAssignmentLabel(user, productNameById)}</div>
                {user.role === 'member' ? (
                  <fieldset className={styles.inlineProducts} disabled={writesBlocked}>
                    <legend>Assigned products</legend>
                    {products.map((product) => (
                      <label key={product.id}>
                        <input checked={(drafts[user.id] || []).includes(product.id)} type="checkbox" onChange={() => setDraftProduct(user.id, product.id)} />
                        <span>{product.name || product.id}</span>
                      </label>
                    ))}
                    {staleAccess(user) ? <><span role="status">Saved access changed. Your selections are retained.</span><button type="button" onClick={() => reviewAccess(user)}>Review latest access</button></> : null}
                    <button disabled={writesBlocked || staleAccess(user) || !dirtyAccess(user)} type="button" onClick={() => updateProducts(user)}>Save access</button>
                  </fieldset>
                ) : null}
                <div className={styles.rowActions}>
                  <button disabled={writesBlocked || user.id === session.user.id} type="button" onClick={() => resetPassword(user)}>Reset password</button>
                  <button disabled={writesBlocked || user.id === session.user.id} type="button" onClick={() => setRole(user)}>{user.role === 'admin' ? 'Make member' : 'Make admin'}</button>
                  <button disabled={writesBlocked || user.id === session.user.id} type="button" onClick={() => setActive(user, !user.isActive)}>{user.isActive ? 'Deactivate' : 'Reactivate'}</button>
                  <button disabled={writesBlocked || user.id === session.user.id} type="button" onClick={() => { setDeleting(structuredClone(user)); setConfirmEmail(''); }}>Delete account</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
      <AccountAudit db={supabase} />
      <WorkerControls key={session.user.id} db={supabase} userId={session.user.id} />
      {deleting && <TrackerDialog title="Delete account" closeLabel="Close account deletion" busy={accountBusy} error={error} onClose={() => setDeleting(null)}>
        <p>{deleting.email}</p><p>This permanently removes the login, profile, and assigned access. Product content is retained.</p>
        <label className={styles.accountConfirm}>Type account email<input autoComplete="off" value={confirmEmail} onChange={(event) => setConfirmEmail(event.target.value)} disabled={accountBusy || !!accountPending} /></label>
        <footer><button type="button" disabled={accountBusy} onClick={() => setDeleting(null)}>Cancel</button>
          <button type="button" disabled={writesBlocked || confirmEmail !== deleting.email} onClick={async () => { if (await deleteUser(deleting, confirmEmail)) setDeleting(null); }}>Delete account permanently</button></footer>
      </TrackerDialog>}
    </div>
  );
}
