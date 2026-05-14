"use client";

import { useState, type FormEvent } from "react";
import type { KeyboardEvent } from "react";
import { getAnglesSummary, type CommandCenterState, type StatusTone } from "@/lib/command-center";

type AnglesReadOnlyPanelProps = {
  onAddAngle: () => void;
  onDeleteAngle: (index: number) => void;
  onEditAngle: (index: number) => void;
  onSaveAngleFields: (index: number, fields: { name: string; notes: string; sourceLink: string }) => void;
  onUpdateAngleName: (index: number, value: string) => void;
  onUpdateAngleNotes: (index: number, value: string) => void;
  state: CommandCenterState;
};

type EditingAngle = {
  index: number;
  name: string;
  notes: string;
  sourceLink: string;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function toneClass(tone: StatusTone) {
  return `next-status-badge ${tone}`;
}

function blurOnEnter(event: KeyboardEvent<HTMLInputElement>) {
  if (event.key === "Enter") {
    event.currentTarget.blur();
  }
}

export function AnglesReadOnlyPanel({
  onAddAngle,
  onDeleteAngle,
  onSaveAngleFields,
  onUpdateAngleName,
  onUpdateAngleNotes,
  state
}: AnglesReadOnlyPanelProps) {
  const [editingAngle, setEditingAngle] = useState<EditingAngle | null>(null);
  const summary = getAnglesSummary(state);
  const summaryItems = [
    ["Total Angles", summary.totalAngles],
    ["Winners", summary.winners],
    ["Testing", summary.testing],
    ["Untested", summary.untested],
    ["Total Creatives", summary.totalCreatives]
  ];

  function openEditor(angle: EditingAngle) {
    setEditingAngle(angle);
  }

  function handleEditorSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingAngle) return;
    const form = new FormData(event.currentTarget);
    onSaveAngleFields(editingAngle.index, {
      name: String(form.get("name") || editingAngle.name),
      notes: String(form.get("notes") || ""),
      sourceLink: String(form.get("sourceLink") || "")
    });
    setEditingAngle(null);
  }

  return (
    <section className="next-angles-panel" aria-label="Angles read-only summary">
      <div className="next-panel-head">
        <div>
          <h1>Angle Tracker</h1>
        </div>
        <button className="next-panel-action" onClick={onAddAngle} type="button">
          Add Angle
        </button>
      </div>
      <div className="next-tracker-summary">
        {summaryItems.map(([label, value]) => (
          <div className="next-tracker-summary-stat" key={label}>
            <span>{label}</span>
            <strong>{formatNumber(Number(value))}</strong>
          </div>
        ))}
      </div>
      <div className="next-angle-grid with-actions" role="table" aria-label="Angles">
        <div className="next-angle-header" role="row">
          <span>#</span>
          <span>Angle Name</span>
          <span>Status</span>
          <span>Source Link</span>
          <span>Stats</span>
          <span>Notes</span>
          <span>Actions</span>
        </div>
        {summary.angles.length === 0 ? (
          <div className="next-empty-state">No angles yet</div>
        ) : (
          summary.angles.map((angle) => (
            <div className={`next-angle-row status-${angle.tone}`} key={angle.id} role="row">
              <div className="next-angle-num">{angle.index + 1}</div>
              <div className="next-angle-name">
                <input
                  aria-label={`Angle name ${angle.index + 1}`}
                  defaultValue={angle.name}
                  onBlur={(event) => onUpdateAngleName(angle.index, event.currentTarget.value)}
                  onKeyDown={blurOnEnter}
                  type="text"
                />
                {angle.tone === "win" ? <span className="next-win-badge">Winner</span> : null}
              </div>
              <div>
                <span className={toneClass(angle.tone)}>{angle.status}</span>
              </div>
              <div className="next-angle-source">
                {angle.sourceLink ? (
                  <a href={angle.sourceLink} target="_blank" rel="noopener noreferrer">
                    {angle.sourceLabel}
                  </a>
                ) : (
                  <button onClick={() => openEditor(angle)} type="button">
                    Add source
                  </button>
                )}
              </div>
              <div className="next-angle-stats">
                <span>{formatNumber(angle.personas)} personas</span>
                <span>{formatNumber(angle.creatives)} creatives</span>
                {angle.creatives > 0 ? <span>{angle.winRate}% win</span> : null}
              </div>
              <div className="next-angle-notes">
                <input
                  aria-label={`Angle notes ${angle.index + 1}`}
                  defaultValue={angle.notes}
                  onBlur={(event) => onUpdateAngleNotes(angle.index, event.currentTarget.value)}
                  onKeyDown={blurOnEnter}
                  placeholder="Add notes"
                  type="text"
                />
              </div>
              <div className="next-angle-actions">
                <button onClick={() => openEditor(angle)} type="button">
                  Edit
                </button>
                <button className="danger" onClick={() => onDeleteAngle(angle.index)} type="button">
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      {editingAngle ? (
        <div className="next-modal-backdrop" role="presentation">
          <form className="next-edit-modal" onSubmit={handleEditorSubmit} aria-label="Edit angle">
            <h2>Edit Angle</h2>
            <label>
              <span>Angle Name</span>
              <input name="name" defaultValue={editingAngle.name} autoFocus />
            </label>
            <label>
              <span>Source Link</span>
              <input name="sourceLink" defaultValue={editingAngle.sourceLink} />
            </label>
            <label>
              <span>Notes</span>
              <textarea name="notes" defaultValue={editingAngle.notes} rows={3} />
            </label>
            <div className="next-modal-actions">
              <button type="button" onClick={() => setEditingAngle(null)}>
                Cancel
              </button>
              <button className="primary" type="submit">
                Save
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
