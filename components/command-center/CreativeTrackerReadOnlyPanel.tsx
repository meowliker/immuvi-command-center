"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  getCreativeTrackerSummary,
  type CommandCenterState,
  type Creative,
  type CreativeFormValues,
  type StatusTone
} from "@/lib/command-center";

type CreativeTrackerReadOnlyPanelProps = {
  onCreateCreative: (values: CreativeFormValues) => void;
  onDeleteCreative: (id: string) => void;
  onSaveCreative: (id: string, values: CreativeFormValues) => void;
  onUpdateCreativeField: (adId: string, field: string, value: string) => void;
  onUpdateCreativeStatus: (adId: string, status: string) => void;
  state: CommandCenterState;
};

const statusOptions = [
  "Untested",
  "Approved",
  "In Production",
  "Ready to Launch",
  "Testing",
  "Mild Winner",
  "Winner",
  "Loser",
  "Scale",
  "Complete"
];

const adTypeOptions = ["Video", "Photo", "Carousel", "UGC", "VSL", "AI Style"];
const funnelOptions = ["TOF", "MOF", "BOF"];

type CreativeModalState =
  | {
      mode: "add";
      values: CreativeFormValues;
    }
  | {
      creativeId: string;
      mode: "edit";
      values: CreativeFormValues;
    };

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function toneClass(tone: StatusTone) {
  return `next-status-badge ${tone}`;
}

function buildOptions(values: string[], currentValue: string) {
  return Array.from(new Set([...values, currentValue].filter(Boolean))).sort();
}

function valuesFromCreative(creative?: Creative): CreativeFormValues {
  return {
    adLink: creative?.adLink || "",
    adType: creative?.adType || "Video",
    angle: creative?.angle || "",
    creativeHypothesis: creative?.creativeHypothesis || "",
    creativeStructure: creative?.creativeStructure || creative?.structure || "",
    driveLink: creative?.driveLink || "",
    formatName: creative?.formatName || creative?.name || "",
    funnelStage: creative?.funnelStage || "TOF",
    hookType: creative?.hookType || "",
    persona: creative?.persona || "",
    productionStyle: creative?.productionStyle || "",
    status: creative?.status || "Untested"
  };
}

function valuesFromForm(form: HTMLFormElement): CreativeFormValues {
  const formData = new FormData(form);
  return {
    adLink: String(formData.get("adLink") || ""),
    adType: String(formData.get("adType") || ""),
    angle: String(formData.get("angle") || ""),
    creativeHypothesis: String(formData.get("creativeHypothesis") || ""),
    creativeStructure: String(formData.get("creativeStructure") || ""),
    driveLink: String(formData.get("driveLink") || ""),
    formatName: String(formData.get("formatName") || ""),
    funnelStage: String(formData.get("funnelStage") || ""),
    hookType: String(formData.get("hookType") || ""),
    persona: String(formData.get("persona") || ""),
    productionStyle: String(formData.get("productionStyle") || ""),
    status: String(formData.get("status") || "")
  };
}

export function CreativeTrackerReadOnlyPanel({
  onCreateCreative,
  onDeleteCreative,
  onSaveCreative,
  onUpdateCreativeField,
  onUpdateCreativeStatus,
  state
}: CreativeTrackerReadOnlyPanelProps) {
  const [angle, setAngle] = useState("");
  const [funnel, setFunnel] = useState("");
  const [kind, setKind] = useState("");
  const [persona, setPersona] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [modal, setModal] = useState<CreativeModalState | null>(null);
  const summary = getCreativeTrackerSummary(state);
  const angles = useMemo(() => Array.from(new Set(summary.rows.map((row) => row.angle).filter(Boolean))).sort(), [summary.rows]);
  const personas = useMemo(() => Array.from(new Set(summary.rows.map((row) => row.persona).filter(Boolean))).sort(), [summary.rows]);
  const statuses = useMemo(() => Array.from(new Set(summary.rows.map((row) => row.status).filter(Boolean))).sort(), [summary.rows]);
  const structures = useMemo(() => (state.fieldOptions.creativeStructure || []).map((option) => option.name), [state.fieldOptions.creativeStructure]);
  const hooks = useMemo(() => (state.fieldOptions.hookType || []).map((option) => option.name), [state.fieldOptions.hookType]);
  const productionStyles = useMemo(() => (state.fieldOptions.productionStyle || []).map((option) => option.name), [state.fieldOptions.productionStyle]);
  const filteredRows = summary.rows.filter((row) => {
    const text = [
      row.formatName,
      row.id,
      row.angle,
      row.persona,
      row.creativeStructure,
      row.hookType,
      row.productionStyle,
      row.creativeHypothesis,
      row.adType,
      row.funnelStage,
      row.status
    ]
      .join(" ")
      .toLowerCase();

    if (query.trim() && !text.includes(query.trim().toLowerCase())) return false;
    if (kind && row.kind !== kind) return false;
    if (status && row.status !== status) return false;
    if (funnel && row.funnelStage !== funnel) return false;
    if (angle && row.angle !== angle) return false;
    if (persona && row.persona !== persona) return false;
    return true;
  });
  const summaryItems = [
    ["Total", summary.total],
    ["Formats", summary.formats],
    ["Production", summary.production],
    ["Variations", summary.variations],
    ["Winners", summary.winners],
    ["Testing", summary.testing]
  ];
  const openAddModal = () => {
    setModal({
      mode: "add",
      values: valuesFromCreative({
        adType: "Video",
        angle: angles[0] || "",
        funnelStage: "TOF",
        persona: personas[0] || "",
        status: "Untested"
      } as Creative)
    });
  };
  const openEditModal = (id: string) => {
    const creative = state.creatives.find((item) => item.id === id);
    if (!creative) return;
    setModal({ creativeId: id, mode: "edit", values: valuesFromCreative(creative) });
  };
  const handleModalSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!modal) return;
    const values = valuesFromForm(event.currentTarget);
    if (modal.mode === "add") {
      onCreateCreative(values);
    } else {
      onSaveCreative(modal.creativeId, values);
    }
    setModal(null);
  };

  return (
    <section className="next-creative-panel" aria-label="Creative Tracker">
      <div className="next-panel-head">
        <div>
          <h1>Creative Tracker</h1>
        </div>
        <button className="next-panel-action" onClick={openAddModal} type="button">
          Add Creative
        </button>
      </div>
      <div className="next-tracker-summary">
        {summaryItems.map(([label, value]) => (
          <div className="next-tracker-summary-stat" key={label}>
            <span>{label}</span>
            <strong>{formatNumber(Number(value))}</strong>
          </div>
        ))}
        <div className="next-tracker-summary-stat active">
          <span>Showing</span>
          <strong>{formatNumber(filteredRows.length)}</strong>
        </div>
      </div>
      <div className="next-creative-filters" aria-label="Creative Tracker filters">
        <input
          aria-label="Search creatives"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search creatives"
          type="search"
          value={query}
        />
        <select aria-label="Kind" onChange={(event) => setKind(event.target.value)} value={kind}>
          <option value="">All Types</option>
          <option value="format">Formats</option>
          <option value="production">Production</option>
          <option value="variation">Variations</option>
        </select>
        <select aria-label="Status" onChange={(event) => setStatus(event.target.value)} value={status}>
          <option value="">All Statuses</option>
          {statuses.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select aria-label="Funnel" onChange={(event) => setFunnel(event.target.value)} value={funnel}>
          <option value="">All Funnels</option>
          <option value="TOF">TOF</option>
          <option value="MOF">MOF</option>
          <option value="BOF">BOF</option>
        </select>
        <select aria-label="Angle" onChange={(event) => setAngle(event.target.value)} value={angle}>
          <option value="">All Angles</option>
          {angles.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select aria-label="Persona" onChange={(event) => setPersona(event.target.value)} value={persona}>
          <option value="">All Personas</option>
          {personas.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <button
          onClick={() => {
            setAngle("");
            setFunnel("");
            setKind("");
            setPersona("");
            setQuery("");
            setStatus("");
          }}
          type="button"
        >
          Clear
        </button>
      </div>
      <div className="next-creative-table" role="table" aria-label="Creative Tracker">
        <div className="next-creative-header" role="row">
          <span>Format</span>
          <span>Angle</span>
          <span>Persona</span>
          <span>Structure</span>
          <span>Hook</span>
          <span>Production</span>
          <span>Hypothesis</span>
          <span>Links</span>
          <span>Type</span>
          <span>Funnel</span>
          <span>Status</span>
          <span>Created</span>
          <span>Vars</span>
          <span>Actions</span>
        </div>
        {filteredRows.length === 0 ? (
          <div className="next-empty-state">No creatives match your filters</div>
        ) : (
          filteredRows.map((creative) => (
            <div className={`next-creative-row kind-${creative.kind}`} key={creative.id} role="row">
              <div className="next-creative-name">
                <strong>{creative.formatName}</strong>
                <span>{creative.id}</span>
              </div>
              <div>
                <select
                  aria-label={`Angle for ${creative.id}`}
                  onChange={(event) => onUpdateCreativeField(creative.id, "angle", event.target.value)}
                  value={creative.angle}
                >
                  <option value="">-</option>
                  {buildOptions(angles, creative.angle).map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <select
                  aria-label={`Persona for ${creative.id}`}
                  onChange={(event) => onUpdateCreativeField(creative.id, "persona", event.target.value)}
                  value={creative.persona}
                >
                  <option value="">-</option>
                  {buildOptions(personas, creative.persona).map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <select
                  aria-label={`Structure for ${creative.id}`}
                  onChange={(event) => onUpdateCreativeField(creative.id, "creativeStructure", event.target.value)}
                  value={creative.creativeStructure}
                >
                  <option value="">-</option>
                  {buildOptions(structures, creative.creativeStructure).map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <select
                  aria-label={`Hook for ${creative.id}`}
                  onChange={(event) => onUpdateCreativeField(creative.id, "hookType", event.target.value)}
                  value={creative.hookType}
                >
                  <option value="">-</option>
                  {buildOptions(hooks, creative.hookType).map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <select
                  aria-label={`Production style for ${creative.id}`}
                  onChange={(event) => onUpdateCreativeField(creative.id, "productionStyle", event.target.value)}
                  value={creative.productionStyle}
                >
                  <option value="">-</option>
                  {buildOptions(productionStyles, creative.productionStyle).map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div className="next-creative-hypothesis">
                <textarea
                  aria-label={`Hypothesis for ${creative.id}`}
                  defaultValue={creative.creativeHypothesis}
                  key={`${creative.id}-${creative.creativeHypothesis}`}
                  onBlur={(event) => {
                    if (event.target.value !== creative.creativeHypothesis) {
                      onUpdateCreativeField(creative.id, "creativeHypothesis", event.target.value);
                    }
                  }}
                  rows={2}
                />
              </div>
              <div className="next-creative-links">
                {creative.adLink ? (
                  <a href={creative.adLink} target="_blank" rel="noopener noreferrer">
                    Inspiration
                  </a>
                ) : null}
                {creative.driveLink ? (
                  <a href={creative.driveLink} target="_blank" rel="noopener noreferrer">
                    Drive
                  </a>
                ) : null}
                {!creative.adLink && !creative.driveLink ? <span>-</span> : null}
              </div>
              <div>
                <select
                  aria-label={`Ad type for ${creative.id}`}
                  onChange={(event) => onUpdateCreativeField(creative.id, "adType", event.target.value)}
                  value={creative.adType}
                >
                  <option value="">-</option>
                  {buildOptions(adTypeOptions, creative.adType).map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div>{creative.funnelStage || "-"}</div>
              <div>
                <select
                  aria-label={`Status for ${creative.id}`}
                  className={toneClass(creative.tone)}
                  onChange={(event) => onUpdateCreativeStatus(creative.id, event.target.value)}
                  value={creative.status}
                >
                  {buildOptions(statusOptions, creative.status).map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div className="next-creative-muted">{creative.dateCreated || "-"}</div>
              <div className="next-creative-muted">{formatNumber(creative.variationCount)}</div>
              <div className="next-creative-actions">
                <button onClick={() => openEditModal(creative.id)} type="button">
                  Edit
                </button>
                <button
                  className="danger"
                  onClick={() => {
                    const ok = window.confirm(`Delete creative ${creative.id}? This cannot be undone.`);
                    if (ok) onDeleteCreative(creative.id);
                  }}
                  type="button"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      {modal ? (
        <div className="next-modal-backdrop" role="presentation">
          <form className="next-creative-modal" onSubmit={handleModalSubmit}>
            <div className="next-modal-head">
              <div>
                <h2>{modal.mode === "add" ? "Add Creative" : `Edit Creative ${modal.creativeId}`}</h2>
              </div>
              <button aria-label="Close creative dialog" onClick={() => setModal(null)} type="button">
                x
              </button>
            </div>
            <div className="next-creative-modal-grid">
              <label>
                <span>Format Name</span>
                <input autoFocus defaultValue={modal.values.formatName} name="formatName" placeholder="Creative title" />
              </label>
              <label>
                <span>Status</span>
                <select defaultValue={modal.values.status} name="status">
                  {buildOptions(statusOptions, modal.values.status).map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Angle</span>
                <select defaultValue={modal.values.angle} name="angle">
                  <option value="">-</option>
                  {buildOptions(angles, modal.values.angle).map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Persona</span>
                <select defaultValue={modal.values.persona} name="persona">
                  <option value="">-</option>
                  {buildOptions(personas, modal.values.persona).map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Ad Type</span>
                <select defaultValue={modal.values.adType} name="adType">
                  {buildOptions(adTypeOptions, modal.values.adType).map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Funnel</span>
                <select defaultValue={modal.values.funnelStage} name="funnelStage">
                  {buildOptions(funnelOptions, modal.values.funnelStage).map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Structure</span>
                <select defaultValue={modal.values.creativeStructure} name="creativeStructure">
                  <option value="">-</option>
                  {buildOptions(structures, modal.values.creativeStructure).map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Hook</span>
                <select defaultValue={modal.values.hookType} name="hookType">
                  <option value="">-</option>
                  {buildOptions(hooks, modal.values.hookType).map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Production Style</span>
                <select defaultValue={modal.values.productionStyle} name="productionStyle">
                  <option value="">-</option>
                  {buildOptions(productionStyles, modal.values.productionStyle).map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Inspiration Link</span>
                <input defaultValue={modal.values.adLink} name="adLink" placeholder="https://..." />
              </label>
              <label>
                <span>Drive Link</span>
                <input defaultValue={modal.values.driveLink} name="driveLink" placeholder="https://drive.google.com/..." />
              </label>
              <label className="wide">
                <span>Hypothesis</span>
                <textarea defaultValue={modal.values.creativeHypothesis} name="creativeHypothesis" rows={3} />
              </label>
            </div>
            <div className="next-modal-actions">
              <button onClick={() => setModal(null)} type="button">
                Cancel
              </button>
              <button className="primary" type="submit">
                {modal.mode === "add" ? "Save Creative" : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
