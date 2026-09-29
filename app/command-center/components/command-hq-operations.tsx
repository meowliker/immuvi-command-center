import type { ReactNode } from 'react';
import { Link2, RefreshCw } from 'lucide-react';
import { commandHqHealth } from '../../../lib/domain/command-hq-health.js';
import { productClickUpListName } from '../../../lib/domain/product-config.js';
import { useClickUpControls } from './clickup-provider';
import { formatAge, formatDateTime } from '../helpers/format';
import type { Product, Profile } from '../types';
import styles from '../../command-center.module.css';

export function CommandHqOperations({ product, profile, unlink, setup, cleanup, manage, remove }: { product: Product; profile: Profile; unlink?: ReactNode; setup?: ReactNode; cleanup?: ReactNode; manage?: ReactNode; remove?: ReactNode }) {
  const connection = useClickUpControls();
  if (!connection) return null;
  const health = commandHqHealth(product, { busy: connection.busy, error: connection.error, hasKey: Boolean(connection.token.trim()) });
  return <section className={styles.hqOperations} aria-label="Product sync health" data-hq-sync-state={health.state}>
    <div className={styles.productControlRow}>
      <strong>{product.name}</strong>
      {health.listId && <span className={styles.productListBadge} title={health.listId}>✓ {productClickUpListName(product) || health.listId}</span>}
      {profile.role === 'admin' && <button type="button" disabled={!!connection.busy} onClick={connection.openSettings}>{health.listId ? 'Change' : <><Link2 size={13} />Link ClickUp List</>}</button>}
      {health.listId ? <>
        {unlink}
        <button className={styles.productSyncButton} type="button" disabled={!health.canSync} onClick={() => void connection.run('sync')}><RefreshCw size={13} />{connection.busy === 'sync' ? 'Syncing...' : 'Sync Now'}</button>
        {setup}{cleanup}
        <span className={styles.productSyncMeta}>{health.syncedAt ? <>Last synced <time dateTime={new Date(health.syncedAt).toISOString()} title={formatDateTime(health.syncedAt)}>{formatAge(Math.max(0, Date.now() - health.syncedAt))}</time>{health.taskCount !== null && <> · {health.taskCount} tasks</>}</> : 'Not synced yet'}</span>
      </> : <span className={styles.productSyncMeta}>Link a list to enable sync</span>}
      {manage}{remove}
    </div>
  </section>;
}
