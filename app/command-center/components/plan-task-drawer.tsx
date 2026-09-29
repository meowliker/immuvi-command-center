'use client';
import { useId, type ReactNode } from 'react';
import { X } from 'lucide-react';
import type { ActionRecord } from '../types';
import { useModalDialog } from '../hooks/use-modal-dialog';
import styles from '../../command-center.module.css';
import { planSourceLabel } from '../../../lib/domain/action-plan-presentation.js';

export function PlanTaskDrawer({ action, age, busy, close, children, toolbar }: {
  action: ActionRecord; age: ReactNode; busy: boolean; close: () => void; children: ReactNode; toolbar?: ReactNode;
}) {
  const ref = useModalDialog({ onClose: close, busy, panelSelector: '[data-modal-panel]' });
  const titleId = useId();
  const display = action.display;
  const source = planSourceLabel(action);
  return <dialog ref={ref} className={styles.planDrawer} aria-labelledby={titleId} aria-modal="true"
    onCancel={(event) => { event.preventDefault(); if (!busy) close(); }}
    onKeyDown={(event) => {
      if (event.key !== 'Tab') return;
      const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]')]
        .filter((element) => element.tabIndex >= 0 && !element.matches(':disabled') && element.getClientRects().length > 0);
      const edge = event.shiftKey ? controls[0] : controls.at(-1);
      if (document.activeElement === edge) {
        event.preventDefault();
        (event.shiftKey ? controls.at(-1) : controls[0])?.focus();
      }
    }}>
    <aside className={styles.planDrawerPanel} data-modal-panel>
      <header className={styles.planDrawerHeader}>
        <div className={styles.planDrawerSource}><span data-plan-source={source.kind}>{source.label}{display.source.label && display.source.label !== source.label ? ` / ${display.source.label}` : ''}</span>
          <button type="button" autoFocus aria-label="Close task detail" title="Close task detail" disabled={busy} onClick={close}><X size={16} /></button>
        </div>
        <h2 id={titleId}>{display.title || 'Untitled action'}</h2>
        <p>{display.angle || '-'} <span aria-hidden="true">x</span> {display.persona || '-'}</p>
        <dl className={styles.planDrawerFacts}>
          <div><dt>Status</dt><dd>{display.status}</dd></div>
          <div><dt>Age</dt><dd>{age}</dd></div>
          <div><dt>Funnel</dt><dd>{display.funnelStage || '-'}</dd></div>
          <div><dt>Type</dt><dd>{display.adType || '-'}</dd></div>
          {display.dueDate ? <div><dt>Due</dt><dd>{display.dueDate}</dd></div> : null}
        </dl>
        {toolbar}
      </header>
      <div className={`${styles.actionInspectorBody} ${styles.planDrawerBody}`}>{children}</div>
    </aside>
  </dialog>;
}
