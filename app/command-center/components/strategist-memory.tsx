import styles from '../../command-center.module.css';
import { objectRecord, textValue } from '../helpers/values';

export function MarkdownLite({ markdown }: { markdown: string }) {
  const blocks = markdown
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  if (!blocks.length) return <div className={styles.emptyState}>No narrative yet.</div>;
  return (
    <div className={styles.markdownLite}>
      {blocks.map((block, index) => {
        if (block.startsWith('### ')) return <h3 key={index}>{block.slice(4)}</h3>;
        if (block.startsWith('## ')) return <h2 key={index}>{block.slice(3)}</h2>;
        if (block.startsWith('# ')) return <h2 key={index}>{block.slice(2)}</h2>;
        if (/^[-*]\s/m.test(block)) {
          return (
            <ul key={index}>
              {block.split('\n').filter(Boolean).map((line) => <li key={line}>{line.replace(/^[-*]\s+/, '')}</li>)}
            </ul>
          );
        }
        return <p key={index}>{block}</p>;
      })}
    </div>
  );
}

export function StrategistStructured({ json }: { json: Record<string, unknown> }) {
  const sections = [
    ['Strategy', objectRecord(json.strategy_layer)],
    ['Creative direction', objectRecord(json.creative_direction_layer)],
    ['Copy', objectRecord(json.copy_layer)],
    ['Winning combinations', { combinations_that_win: json.combinations_that_win }],
    ['Losing combinations', { combinations_that_die: json.combinations_that_die }],
  ].filter(([, value]) => Object.keys(value as Record<string, unknown>).length);
  if (!sections.length) return <div className={styles.emptyState}>No structured strategist data yet.</div>;
  return (
    <div className={styles.structuredMemory}>
      {sections.map(([title, raw]) => {
        const record = raw as Record<string, unknown>;
        return (
          <article key={title as string}>
            <h3>{title as string}</h3>
            <div>
              {Object.entries(record).map(([key, value]) => (
                <section key={key}>
                  <strong>{key.replaceAll('_', ' ')}</strong>
                  <StructuredValue value={value} />
                </section>
              ))}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function StructuredValue({ value }: { value: unknown }) {
  if (Array.isArray(value)) {
    if (!value.length) return <span>-</span>;
    return (
      <ul>
        {value.slice(0, 8).map((item, index) => (
          <li key={index}>{structuredText(item)}</li>
        ))}
      </ul>
    );
  }
  return <span>{structuredText(value)}</span>;
}

function structuredText(value: unknown) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  const record = objectRecord(value);
  if (record.name) return textValue(record.name);
  if (record.phrase) return textValue(record.phrase);
  if (record.angle || record.persona || record.creative_structure || record.hook_type) {
    return [record.angle, record.persona, record.creative_structure, record.hook_type].map(textValue).filter(Boolean).join(' / ') || '-';
  }
  return JSON.stringify(value);
}
