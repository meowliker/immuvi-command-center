"use client";

import { getStrategistSummary, type CommandCenterState, type StatusTone } from "@/lib/command-center";

type StrategistPanelProps = {
  state: CommandCenterState;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function toneClass(tone: StatusTone) {
  return `next-status-badge ${tone}`;
}

export function StrategistPanel({ state }: StrategistPanelProps) {
  const summary = getStrategistSummary(state);
  const summaryItems = [
    ["Creatives", summary.totalCreatives],
    ["Winners", summary.winners],
    ["Testing", summary.testing],
    ["Losers", summary.losers],
    ["Inspirations", summary.activeInspirations]
  ];

  return (
    <section className="next-strategy-panel" aria-label="Strategist">
      <div className="next-panel-head">
        <div>
          <h1>Strategist</h1>
        </div>
      </div>
      <div className="next-tracker-summary">
        {summaryItems.map(([label, value]) => (
          <div className={`next-tracker-summary-stat ${label === "Winners" ? "active" : ""}`} key={label}>
            <span>{label}</span>
            <strong>{formatNumber(Number(value))}</strong>
          </div>
        ))}
      </div>
      <div className="next-strategy-grid">
        <section className="next-strategy-signals" aria-label="Strategic signals">
          {summary.signals.map((signal) => (
            <article className="next-strategy-signal" key={signal.label}>
              <span className={toneClass(signal.tone)}>{signal.label}</span>
              <strong>{signal.value}</strong>
              <p>{signal.detail}</p>
            </article>
          ))}
        </section>
        <section className="next-strategy-list" aria-label="Winning creative memory">
          <header>
            <strong>Winning Memory</strong>
            <span>{summary.winnerRows.length} shown</span>
          </header>
          {summary.winnerRows.length === 0 ? (
            <div className="next-strategy-empty">No winners yet.</div>
          ) : (
            summary.winnerRows.map((winner) => (
              <article className="next-strategy-winner" key={winner.id}>
                <div>
                  <strong>{winner.title}</strong>
                  <span>{winner.id}</span>
                </div>
                <div>
                  <em>{winner.angle || "-"}</em>
                  <span>{winner.persona || "-"}</span>
                </div>
                <span className={toneClass(winner.tone)}>{winner.status}</span>
              </article>
            ))
          )}
        </section>
        <section className="next-strategy-gaps" aria-label="Open strategic gaps">
          <header>
            <strong>Open Gaps</strong>
            <span>{summary.coverageGaps.length}</span>
          </header>
          {summary.coverageGaps.length === 0 ? (
            <div className="next-strategy-empty">No major gaps detected.</div>
          ) : (
            summary.coverageGaps.map((gap) => <p key={gap}>{gap}</p>)
          )}
        </section>
      </div>
    </section>
  );
}
