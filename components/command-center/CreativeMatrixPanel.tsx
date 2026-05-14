"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { getCreativeMatrixSummary, type CommandCenterState, type MatrixCellSummary, type StatusTone } from "@/lib/command-center";

type CreativeMatrixPanelProps = {
  state: CommandCenterState;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function toneClass(tone: StatusTone) {
  return `next-matrix-cell tone-${tone}`;
}

function cellKey(cell: MatrixCellSummary) {
  return `${cell.angle}||${cell.persona}`;
}

export function CreativeMatrixPanel({ state }: CreativeMatrixPanelProps) {
  const [expandedCell, setExpandedCell] = useState("");
  const [query, setQuery] = useState("");
  const [showAllPersonas, setShowAllPersonas] = useState(false);
  const summary = getCreativeMatrixSummary(state);
  const visiblePersonas = showAllPersonas ? summary.allPersonas : summary.activePersonas;
  const filteredRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return summary.rows
      .map((row) => ({
        ...row,
        cells: row.cells.filter((cell) => visiblePersonas.includes(cell.persona))
      }))
      .filter((row) => {
        if (!needle) return true;
        if (row.angle.toLowerCase().includes(needle)) return true;
        return row.cells.some((cell) => {
          if (cell.persona.toLowerCase().includes(needle)) return true;
          return cell.creatives.some((creative) => `${creative.name} ${creative.id} ${creative.status}`.toLowerCase().includes(needle));
        });
      });
  }, [query, summary.rows, visiblePersonas]);
  const summaryItems = [
    ["Coverage", `${summary.coveragePercent}%`],
    ["Filled", `${formatNumber(summary.filledCells)} / ${formatNumber(summary.totalCells)}`],
    ["Winning Cells", summary.winningCells],
    ["Replicate Next", summary.replicateNext],
    ["Test Next", summary.testNext],
    ["Kill List", summary.killList]
  ];

  return (
    <section className="next-matrix-panel" aria-label="Creative Matrix">
      <div className="next-panel-head">
        <div>
          <h1>Creative Matrix</h1>
        </div>
        <button className="next-panel-action" onClick={() => setShowAllPersonas((value) => !value)} type="button">
          {showAllPersonas ? "Active Personas" : "Show All Personas"}
        </button>
      </div>
      <div className="next-tracker-summary">
        {summaryItems.map(([label, value]) => (
          <div className="next-tracker-summary-stat" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="next-matrix-tools">
        <input
          aria-label="Search matrix"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search angles, personas, creatives"
          type="search"
          value={query}
        />
      </div>
      <div className="next-matrix-scroll">
        <div className="next-matrix-grid" style={{ "--matrix-persona-count": visiblePersonas.length } as CSSProperties}>
          <div className="next-matrix-corner">Angle / Persona</div>
          {visiblePersonas.map((persona) => (
            <div className="next-matrix-persona" key={persona} title={persona}>
              {persona}
            </div>
          ))}
          {filteredRows.map((row) => (
            <div className="next-matrix-row" key={row.angle}>
              <div className="next-matrix-angle">
                <strong>{row.angle}</strong>
                <span>
                  {row.filled}/{row.total} cells · {row.statusLabel}
                </span>
              </div>
              {row.cells.map((cell) => {
                const key = cellKey(cell);
                const isExpanded = expandedCell === key;
                return (
                  <button
                    aria-expanded={isExpanded}
                    className={`${toneClass(cell.tone)} ${cell.isFilled ? "filled" : ""} ${cell.isAssigned ? "assigned" : ""}`}
                    key={key}
                    onClick={() => setExpandedCell(isExpanded ? "" : key)}
                    type="button"
                  >
                    <span className="next-matrix-cell-top">
                      <strong>{cell.isFilled ? `${cell.total} creative${cell.total === 1 ? "" : "s"}` : cell.isAssigned ? "Assigned" : "Untested"}</strong>
                      <em>{cell.statusLabel}</em>
                    </span>
                    {cell.creatives.length > 0 ? (
                      <span className="next-matrix-chip-list">
                        {cell.creatives.slice(0, 3).map((creative) => (
                          <span className={`next-matrix-chip tone-${creative.tone}`} key={creative.id}>
                            {creative.funnelStage || creative.status}
                          </span>
                        ))}
                      </span>
                    ) : null}
                    {isExpanded ? (
                      <span className="next-matrix-detail">
                        {cell.creatives.length === 0 ? (
                          <span>No creatives in this cell yet.</span>
                        ) : (
                          cell.creatives.slice(0, 5).map((creative) => (
                            <span className="next-matrix-detail-row" key={creative.id}>
                              <strong>{creative.name}</strong>
                              <em>{creative.status}</em>
                            </span>
                          ))
                        )}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
