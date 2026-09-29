'use client';

import type { taxonomyRelationships } from '../../../lib/domain/taxonomy-workspace.js';
import type { TaxonomyKind, TaxonomyRow } from '../types';
import { TaxonomyGroupsDialog } from './taxonomy-groups-dialog';
import { TaxonomyCreativesDialog } from './taxonomy-creatives-dialog';

export function TaxonomyRelationships({ kind, row, relation, initialView, error, onClose, openCreative }: {
  kind: TaxonomyKind; row?: TaxonomyRow; relation?: ReturnType<typeof taxonomyRelationships>;
  initialView: 'relationships' | 'creatives'; error: string; onClose: () => void; openCreative: (id: string) => void;
}) {
  const Dialog = initialView === 'creatives' ? TaxonomyCreativesDialog : TaxonomyGroupsDialog;
  return <Dialog kind={kind} row={row} relation={relation} error={error} onClose={onClose} openCreative={openCreative} />;
}
