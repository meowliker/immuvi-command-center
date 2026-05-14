"use client";

import {
  getCommandHqCoverageCards,
  getCommandHqGaps,
  getCommandHqMetrics,
  type CommandCenterState
} from "@/lib/command-center";

type CommandHqSummaryProps = {
  state: CommandCenterState;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatRate(value: number) {
  return `${value.toFixed(1)}%`;
}

export function CommandHqSummary({ state }: CommandHqSummaryProps) {
  const metrics = getCommandHqMetrics(state);
  const coverageCards = getCommandHqCoverageCards(state);
  const gaps = getCommandHqGaps(state);
  const items = [
    { label: "Total Creatives", value: formatNumber(metrics.total) },
    { label: "Winners", value: formatNumber(metrics.winners), tone: "win" },
    { label: "Testing", value: formatNumber(metrics.testing), tone: "test" },
    { label: "Ready to Launch", value: formatNumber(metrics.ready), tone: "ready" },
    { label: "Untested", value: formatNumber(metrics.notStarted), tone: "untested" },
    { label: "Win Rate", value: formatRate(metrics.winRate), tone: "rate" },
    { label: "Angles", value: formatNumber(metrics.angles) },
    { label: "Personas", value: formatNumber(metrics.personas) }
  ];

  return (
    <section className="next-hq-summary" aria-label="Command HQ summary">
      <div className="next-kpi-strip">
        {items.map((item) => (
          <div className="next-kpi-item" key={item.label}>
            <div className={item.tone ? `next-kpi-val ${item.tone}` : "next-kpi-val"}>{item.value}</div>
            <div className="next-kpi-lbl">{item.label}</div>
          </div>
        ))}
      </div>
      <div className="next-coverage-grid" aria-label="Coverage intelligence">
        {coverageCards.map((card) => (
          <article className="next-cov-card" key={card.title}>
            <div className="next-cov-card-title">{card.title}</div>
            <div className="next-cov-bar-wrap">
              <div className="next-cov-bar" style={{ width: `${card.percent}%` }} />
            </div>
            <div className="next-cov-pct">
              {card.percent}% coverage ({card.covered}/{card.total})
            </div>
            <div className="next-cov-list">
              {card.items.map((item) => (
                <div className="next-cov-item" key={item.name}>
                  <span className={item.count > 0 ? "next-cov-dot active" : "next-cov-dot"} />
                  <span className="next-cov-name">{item.name}</span>
                  <span className="next-cov-count">{formatNumber(item.count)}</span>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
      <div className="next-gap-box" aria-label="Gap intelligence">
        {gaps.length === 0 ? (
          <div className="next-gap-ok">All gaps covered. Great work!</div>
        ) : (
          <ul className="next-gap-list">
            {gaps.map((gap) => (
              <li key={gap}>{gap}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
