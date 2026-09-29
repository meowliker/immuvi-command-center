import { useState } from 'react';
import { Check, Clock } from 'lucide-react';
import { TrackerDialog } from './tracker-dialog';
import type { usePlanCheckpoint } from '../hooks/use-plan-checkpoint';
import { PLAN_TESTING_DECISIONS } from '../../../lib/domain/action-plan-checkpoint.js';
import styles from '../../command-center.module.css';

export function PlanCheckpointDialog({ review }: { review: ReturnType<typeof usePlanCheckpoint> }) {
  const target = review.target!;
  const [decision, setDecision] = useState('');
  const [push, setPush] = useState(Boolean(target.action.display.clickupTaskId));
  return <TrackerDialog title={target.phase === 'final' ? 'Final testing review' : 'Day 7 testing review'} closeLabel="Close testing review" busy={review.busy} error={review.error} onClose={review.close}>
    <form className={styles.trackerForm} onSubmit={(event) => { event.preventDefault(); if (decision) void review.save(decision, push); }}>
      <h3>{target.action.display.title}</h3>
      <fieldset className={styles.planReviewChoices} disabled={review.busy}><legend>Decision</legend>
        {PLAN_TESTING_DECISIONS.map((value) => <label key={value}><input type="radio" name="testing-decision" value={value} checked={decision === value} onChange={() => setDecision(value)} />{value}</label>)}
        {target.canSnooze ? <label><input type="radio" name="testing-decision" value="snooze" checked={decision === 'snooze'} onChange={() => setDecision('snooze')} /><Clock size={15} />Needs more testing (+7 days)</label> : null}
      </fieldset>
      {target.action.display.clickupTaskId && decision !== 'snooze' ? <label className={styles.planReviewPush}><input type="checkbox" checked={push} disabled={review.busy} onChange={(e) => setPush(e.target.checked)} />Update ClickUp</label> : null}
      <footer><button type="submit" disabled={review.busy || !decision}><Check size={16} />{review.busy ? 'Saving review...' : 'Save testing review'}</button></footer>
    </form>
  </TrackerDialog>;
}
