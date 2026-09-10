import { spawnSync } from 'node:child_process';
import { sourceEnv, targetEnv } from './strategist-env.mjs';

const source = sourceEnv(process.argv[2]);
const target = targetEnv();
for (const [name, url] of [['source', source.DATABASE_URL], ['target', target.STRATEGIST_DATABASE_URL]]) {
  const conn = new URL(url);
  const result = spawnSync('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-At', '-c', `select json_build_object('tables', (select json_agg(tablename) from pg_tables where schemaname='public'), 'database', current_database());`], {
    env: { ...process.env, PGHOST: conn.hostname, PGPORT: conn.port || '5432', PGUSER: decodeURIComponent(conn.username), PGPASSWORD: decodeURIComponent(conn.password), PGDATABASE: conn.pathname.slice(1), PGSSLMODE: 'require', PGCONNECT_TIMEOUT: '15' }, encoding: 'utf8', timeout: 30000,
  });
  console.log(name, result.status === 0 ? result.stdout.trim() : `connection failed (${result.error?.code || result.status}): ${(result.stderr || '').replaceAll(decodeURIComponent(conn.password), '[redacted]')}`);
}
