"use client";

import { useMemo, useState } from "react";
import {
  getProductionSummary,
  type ActionPlanRow,
  type CommandCenterState,
  type ProductionColumn,
  type StatusTone
} from "@/lib/command-center";

type ProductionPanelProps = {
  onUpdateActionStatus: (id: string, status: string) => void;
  state: CommandCenterState;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function toneClass(tone: StatusTone) {
  return `next-status-badge ${tone}`;
}

function nextMoveLabel(columnId: ProductionColumn["id"]) {
  if (columnId === "queue") return "Start";
  if (columnId === "progress") return "Complete";
  return "Reopen";
}

function nextMoveStatus(columnId: ProductionColumn["id"]) {
  if (columnId === "queue") return "In Production";
  if (columnId === "progress") return "Complete";
  return "Untested";
}

function ProductionCard({
  columnId,
  onMove,
  row
}: {
  columnId: ProductionColumn["id"];
  onMove: (status: string) => void;
  row: ActionPlanRow;
}) {
  return (
    <article className="next-prod-card">
      <div className="next-prod-card-head">
        <strong>{row.title}</strong>
        <span className={toneClass(row.tone)}>{row.status}</span>
      </div>
      <div className="next-prod-taxonomy">
        <span>{row.angle || "-"}</span>
        <em>{row.persona || "-"}</em>
      </div>
      <div className="next-prod-tags">
        {row.funnelStage ? <span>{row.funnelStage}</span> : null}
        {row.adType ? <span>{row.adType}</span> : null}
        {row.hookType ? <span>{row.hookType}</span> : null}
      </div>
      <div className="next-prod-card-foot">
        <span>{row.dueDate ? `Due ${row.dueDate}` : "No due date"}</span>
        <button onClick={() => onMove(nextMoveStatus(columnId))} type="button">
          {nextMoveLabel(columnId)}
        </button>
      </div>
    </article>
  );
}

export function ProductionPanel({ onUpdateActionStatus, state }: ProductionPanelProps) {
  const [query, setQuery] = useState("");
  const summary = getProductionSummary(state);
  const filteredColumns = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return summary.columns;
    return summary.columns.map((column) => ({
      ...column,
      rows: column.rows.filter((row) =>
        [row.title, row.id, row.angle, row.persona, row.funnelStage, row.adType, row.hookType, row.status]
          .join(" ")
          .toLowerCase()
          .includes(needle)
      )
    }));
  }, [query, summary.columns]);
  const showing = filteredColumns.reduce((total, column) => total + column.rows.length, 0);
  const summaryItems = [
    ["Total", summary.total],
    ["Queue", summary.queue],
    ["In Production", summary.progress],
    ["Done", summary.done],
    ["Overdue", summary.overdue],
    ["Showing", showing]
  ];

  return (
    <section className="next-prod-panel" aria-label="Production Board">
      <div className="next-panel-head">
        <div>
          <h1>Production Board</h1>
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
      <div className="next-prod-tools">
        <input
          aria-label="Search production"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search production tasks"
          type="search"
          value={query}
        />
        {query ? (
          <button onClick={() => setQuery("")} type="button">
            Clear
          </button>
        ) : null}
      </div>
      <div className="next-prod-board">
        {filteredColumns.map((column) => (
          <section className={`next-prod-column ${column.id}`} key={column.id} aria-label={column.title}>
            <header>
              <div>
                <strong>{column.title}</strong>
                <span>{column.subtitle}</span>
              </div>
              <em>{column.rows.length}</em>
            </header>
            <div className="next-prod-list">
              {column.rows.length === 0 ? (
                <div className="next-prod-empty">No tasks here</div>
              ) : (
                column.rows.map((row) => (
                  <ProductionCard
                    columnId={column.id}
                    key={row.id}
                    onMove={(status) => onUpdateActionStatus(row.id, status)}
                    row={row}
                  />
                ))
              )}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
