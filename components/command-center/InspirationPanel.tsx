"use client";

import { useMemo, useState } from "react";
import { getInspirationSummary, type CommandCenterState, type InspirationRow, type StatusTone } from "@/lib/command-center";

type InspirationPanelProps = {
  state: CommandCenterState;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function toneClass(tone: StatusTone) {
  return `next-status-badge ${tone}`;
}

function truncate(value: string, max = 120) {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 3)}...`;
}

function matchesRow(row: InspirationRow, query: string) {
  if (!query) return true;
  return [
    row.id,
    row.formatName,
    row.brand,
    row.angle,
    row.persona,
    row.creativeStructure,
    row.hookType,
    row.productionStyle,
    row.platform,
    row.status,
    row.hypothesis,
    row.notes
  ]
    .join(" ")
    .toLowerCase()
    .includes(query);
}

export function InspirationPanel({ state }: InspirationPanelProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [platform, setPlatform] = useState("");
  const summary = getInspirationSummary(state);
  const statuses = useMemo(() => Array.from(new Set(summary.rows.map((row) => row.status).filter(Boolean))).sort(), [summary.rows]);
  const platforms = useMemo(
    () => Array.from(new Set(summary.rows.map((row) => row.platform).filter(Boolean))).sort(),
    [summary.rows]
  );
  const filteredRows = summary.rows.filter((row) => {
    if (status && row.status !== status) return false;
    if (platform && row.platform !== platform) return false;
    return matchesRow(row, query.trim().toLowerCase());
  });
  const summaryItems = [
    ["Total", summary.total],
    ["Queued", summary.queued],
    ["Classified", summary.classified],
    ["Briefed", summary.briefed],
    ["Live", summary.live],
    ["Placed", summary.placed],
    ["Unused", summary.unused],
    ["Showing", filteredRows.length]
  ];

  return (
    <section className="next-inspiration-panel" aria-label="Inspiration">
      <div className="next-panel-head">
        <div>
          <h1>Inspiration</h1>
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
      <div className="next-inspiration-filters" aria-label="Inspiration filters">
        <input
          aria-label="Search inspirations"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search inspirations"
          type="search"
          value={query}
        />
        <select aria-label="Platform" onChange={(event) => setPlatform(event.target.value)} value={platform}>
          <option value="">All Platforms</option>
          {platforms.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select aria-label="Status" onChange={(event) => setStatus(event.target.value)} value={status}>
          <option value="">All Statuses</option>
          {statuses.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <button
          onClick={() => {
            setQuery("");
            setPlatform("");
            setStatus("");
          }}
          type="button"
        >
          Clear
        </button>
      </div>
      <div className="next-inspiration-table" role="table" aria-label="Inspirations">
        <div className="next-inspiration-header" role="row">
          <span>Inspiration</span>
          <span>Brand</span>
          <span>Angle / Persona</span>
          <span>Structure</span>
          <span>Hook</span>
          <span>Production</span>
          <span>Status</span>
          <span>Usage</span>
          <span>Source</span>
        </div>
        {filteredRows.length === 0 ? (
          <div className="next-inspiration-empty">No inspirations match the current filters.</div>
        ) : (
          filteredRows.map((row) => (
            <div className="next-inspiration-row" key={row.id} role="row">
              <div className="next-inspiration-main">
                <strong>{row.formatName}</strong>
                <span>{row.id}</span>
                {row.hypothesis || row.notes ? <p>{truncate(row.hypothesis || row.notes)}</p> : null}
              </div>
              <div>
                <strong>{row.brand || "-"}</strong>
                <span>{row.platform}</span>
              </div>
              <div>
                <strong>{row.angle || "-"}</strong>
                <span>{row.persona || "-"}</span>
              </div>
              <div>
                <strong>{row.creativeStructure || "-"}</strong>
                <span>{row.funnelStage || row.adType || ""}</span>
              </div>
              <div>
                <strong>{row.hookType || "-"}</strong>
              </div>
              <div>
                <strong>{row.productionStyle || "-"}</strong>
              </div>
              <div>
                <span className={toneClass(row.tone)}>{row.status}</span>
              </div>
              <div>
                <strong>{row.usageLabel}</strong>
                <span>{row.usageCount} task{row.usageCount === 1 ? "" : "s"}</span>
              </div>
              <div className="next-inspiration-links">
                {row.sourceUrl ? (
                  <a href={row.sourceUrl} rel="noreferrer" target="_blank">
                    Source
                  </a>
                ) : null}
                {row.briefUrl ? (
                  <a href={row.briefUrl} rel="noreferrer" target="_blank">
                    Brief
                  </a>
                ) : null}
                {!row.sourceUrl && !row.briefUrl ? <span>-</span> : null}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
