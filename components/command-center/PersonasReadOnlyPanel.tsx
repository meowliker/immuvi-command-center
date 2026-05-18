"use client";

import { useState, type FormEvent } from "react";
import type { KeyboardEvent } from "react";
import { getPersonasSummary, type CommandCenterState, type StatusTone } from "@/lib/command-center";

type PersonasReadOnlyPanelProps = {
  onAddPersona: () => void;
  onDeletePersona: (index: number) => void;
  onEditPersona: (index: number) => void;
  onSavePersonaFields: (index: number, fields: { name: string; notes: string; sourceLink: string }) => void;
  onUpdatePersonaName: (index: number, value: string) => void;
  onUpdatePersonaNotes: (index: number, value: string) => void;
  state: CommandCenterState;
};

type EditingPersona = {
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

export function PersonasReadOnlyPanel({
  onAddPersona,
  onDeletePersona,
  onSavePersonaFields,
  onUpdatePersonaName,
  onUpdatePersonaNotes,
  state
}: PersonasReadOnlyPanelProps) {
  const [editingPersona, setEditingPersona] = useState<EditingPersona | null>(null);
  const summary = getPersonasSummary(state);
  const summaryItems = [
    ["Total Personas", summary.totalPersonas],
    ["Winners", summary.winners],
    ["Testing", summary.testing],
    ["Untested", summary.untested],
    ["Total Creatives", summary.totalCreatives]
  ];

  function openEditor(persona: EditingPersona) {
    setEditingPersona(persona);
  }

  function handleEditorSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingPersona) return;
    const form = new FormData(event.currentTarget);
    onSavePersonaFields(editingPersona.index, {
      name: String(form.get("name") || editingPersona.name),
      notes: String(form.get("notes") || ""),
      sourceLink: String(form.get("sourceLink") || "")
    });
    setEditingPersona(null);
  }

  return (
    <section className="next-angles-panel" aria-label="Personas read-only summary">
      <div className="next-panel-head">
        <div>
          <h1>Persona Tracker</h1>
        </div>
        <button className="next-panel-action" onClick={onAddPersona} type="button">
          Add Persona
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
      <div className="next-angle-grid with-actions" role="table" aria-label="Personas">
        <div className="next-angle-header" role="row">
          <span>#</span>
          <span>Persona Name</span>
          <span>Status</span>
          <span>Source Link</span>
          <span>Stats</span>
          <span>Notes</span>
          <span>Actions</span>
        </div>
        {summary.personas.length === 0 ? (
          <div className="next-empty-state">No personas yet</div>
        ) : (
          summary.personas.map((persona) => (
            <div className={`next-angle-row status-${persona.tone}`} key={persona.id} role="row">
              <div className="next-angle-num">{persona.index + 1}</div>
              <div className="next-angle-name">
                <input
                  aria-label={`Persona name ${persona.index + 1}`}
                  defaultValue={persona.name}
                  onBlur={(event) => onUpdatePersonaName(persona.index, event.currentTarget.value)}
                  onKeyDown={blurOnEnter}
                  type="text"
                />
                {persona.tone === "win" ? <span className="next-win-badge">Winner</span> : null}
              </div>
              <div>
                <span className={toneClass(persona.tone)}>{persona.status}</span>
              </div>
              <div className="next-angle-source">
                {persona.sourceLink ? (
                  <a href={persona.sourceLink} target="_blank" rel="noopener noreferrer">
                    {persona.sourceLabel}
                  </a>
                ) : (
                  <button onClick={() => openEditor(persona)} type="button">
                    Add source
                  </button>
                )}
              </div>
              <div className="next-angle-stats">
                <span>{formatNumber(persona.angles)} angles</span>
                <span>{formatNumber(persona.creatives)} creatives</span>
                {persona.creatives > 0 ? <span>{persona.winRate}% win</span> : null}
              </div>
              <div className="next-angle-notes">
                <input
                  aria-label={`Persona notes ${persona.index + 1}`}
                  defaultValue={persona.notes}
                  onBlur={(event) => onUpdatePersonaNotes(persona.index, event.currentTarget.value)}
                  onKeyDown={blurOnEnter}
                  placeholder="Add notes"
                  type="text"
                />
              </div>
              <div className="next-angle-actions">
                <button onClick={() => openEditor(persona)} type="button">
                  Edit
                </button>
                <button className="danger" onClick={() => onDeletePersona(persona.index)} type="button">
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      {editingPersona ? (
        <div className="next-modal-backdrop" role="presentation">
          <form className="next-edit-modal" onSubmit={handleEditorSubmit} aria-label="Edit persona">
            <h2>Edit Persona</h2>
            <label>
              <span>Persona Name</span>
              <input name="name" defaultValue={editingPersona.name} autoFocus />
            </label>
            <label>
              <span>Source Link</span>
              <input name="sourceLink" defaultValue={editingPersona.sourceLink} />
            </label>
            <label>
              <span>Notes</span>
              <textarea name="notes" defaultValue={editingPersona.notes} rows={3} />
            </label>
            <div className="next-modal-actions">
              <button type="button" onClick={() => setEditingPersona(null)}>
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
