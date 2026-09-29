import styles from '../../command-center.module.css';

export function TaxonomyPopupStatus({ value }: { value: string }) {
  const tone = ['Winner','Mild Winner','Scale','Complete'].includes(value) ? 'winner'
    : ['Loser','Killed'].includes(value) ? 'loser'
    : ['Testing','Ready to Launch'].includes(value) ? 'testing'
    : ['In Production','Approved','Assigned'].includes(value) ? 'production' : 'neutral';
  return <span className={styles.personaStatus} data-tone={tone}>{value}</span>;
}
