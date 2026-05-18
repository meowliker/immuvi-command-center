"use client";

import { useMemo, useState } from "react";
import { getActionPlanSummary, type ActionPlanRow, type CommandCenterState, type StatusTone } from "@/lib/command-center";

type ActionPlanPanelProps = {
  onDeleteAction: (id: string) => void;
  onUpdateActionDueDate: (id: string, dueDate: string) => void;
  onUpdateActionStatus: (id: string, status: string) => void;
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

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function toneClass(tone: StatusTone) {
  return `next-status-badge ${tone}`;
}

function sourceClass(kind: ActionPlanRow["sourceKind"]) {
  return `next-ap-source ${kind}`;
}

function truncate(value: string, max = 150) {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 3)}...`;
}

export function ActionPlanPanel({ onDeleteAction, onUpdateActionDueDate, onUpdateActionStatus, state }: ActionPlanPanelProps) {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("");
  const [status, setStatus] = useState("");
  const summary = getActionPlanSummary(state);
  const sources = useMemo(
    () => Array.from(new Set(summary.rows.map((row) => row.sourceKind).filter(Boolean))).sort(),
    [summary.rows]
  );
  const statuses = useMemo(
    () => Array.from(new Set(summary.rows.map((row) => row.status).filter(Boolean))).sort(),
    [summary.rows]
  );
  const filteredRows = summary.rows.filter((row) => {
    const text = [
      row.title,
      row.id,
      row.angle,
      row.persona,
      row.funnelStage,
      row.adType,
      row.hookType,
      row.sourceLabel,
      row.status,
      row.notes
    ]
      .join(" ")
      .toLowerCase();

    if (query.trim() && !text.includes(query.trim().toLowerCase())) return false;
    if (status && row.status !== status) return false;
    if (source && row.sourceKind !== source) return false;
    return true;
  });
  const summaryItems = [
    ["Total", summary.total],
    ["Active", summary.active],
    ["Complete", summary.complete],
    ["Due This Week", summary.dueThisWeek],
    ["Overdue", summary.overdue],
    ["Unlinked", summary.unlinked],
    ["Showing", filteredRows.length]
  ];

  return (
    <section className="next-ap-panel" aria-label="Action Plan">
      <div className="next-panel-head">
        <div>
          <h1>Action Plan</h1>
        </div>
      </div>
      <div className="next-tracker-summary">
        {summaryItems.map(([label, value]) => (
          <div className={`next-tracker-summary-stat ${label === "Showing" ? "active" : ""}`} key={label}>
            <span>{label}</span>
            <strong>{formatNumber(Number(value))}</strong>
          </div>
        ))}
      </div>
      <div className="next-ap-filters" aria-label="Action Plan filters">
        <input
          aria-label="Search action plan"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search actions"
          type="search"
          value={query}
        />
        <select aria-label="Status" onChange={(event) => setStatus(event.target.value)} value={status}>
          <option value="">All Statuses</option>
          {statuses.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select aria-label="Source" onChange={(event) => setSource(event.target.value)} value={source}>
          <option value="">All Sources</option>
          {sources.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <button
          onClick={() => {
            setQuery("");
            setSource("");
            setStatus("");
          }}
          type="button"
        >
          Clear
        </button>
      </div>
      <div className="next-ap-table" role="table" aria-label="Action Plan tasks">
        <div className="next-ap-header" role="row">
          <span>Task</span>
          <span>Source</span>
          <span>Angle / Persona</span>
          <span>Funnel</span>
          <span>Status</span>
          <span>Due</span>
          <span>ClickUp</span>
          <span>Actions</span>
        </div>
        {filteredRows.length === 0 ? (
          <div className="next-ap-empty">No Action Plan tasks match the current filters.</div>
        ) : (
          filteredRows.map((row) => (
            <div className="next-ap-row" key={row.id} role="row">
              <div className="next-ap-task">
                <strong>{row.title}</strong>
                <span>{row.id}</span>
                {row.notes ? <p>{truncate(row.notes)}</p> : null}
              </div>
              <div>
                <span className={sourceClass(row.sourceKind)}>{row.sourceLabel}</span>
              </div>
              <div className="next-ap-taxonomy">
                <strong>{row.angle || "-"}</strong>
                <span>{row.persona || "-"}</span>
              </div>
              <div className="next-ap-meta">
                <strong>{row.funnelStage || "-"}</strong>
                <span>{row.adType || row.hookType || ""}</span>
              </div>
              <div>
                <select
                  aria-label={`Status for ${row.title}`}
                  className={toneClass(row.tone)}
                  onChange={(event) => onUpdateActionStatus(row.id, event.target.value)}
                  value={row.status}
                >
                  {Array.from(new Set([...statusOptions, row.status].filter(Boolean))).map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <input
                  aria-label={`Due date for ${row.title}`}
                  className="next-ap-date"
                  onChange={(event) => onUpdateActionDueDate(row.id, event.target.value)}
                  type="date"
                  value={row.dueDate}
                />
              </div>
              <div>
                {row.clickupUrl ? (
                  <a className="next-ap-link" href={row.clickupUrl} rel="noreferrer" target="_blank">
                    Open
                  </a>
                ) : (
                  <span className="next-ap-muted">Not linked</span>
                )}
              </div>
              <div>
                <button
                  className="next-ap-delete"
                  onClick={() => {
                    const ok = window.confirm(`Remove "${row.title}" from the Action Plan?`);
                    if (ok) onDeleteAction(row.id);
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
    </section>
  );
}
