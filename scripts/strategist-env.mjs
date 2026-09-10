import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { parseEnv } from 'node:util';
import { homedir } from 'node:os';
import path from 'node:path';

export function readEnv(file) {
  if (!existsSync(file)) return {};
  const text = file.endsWith('.rtf')
    ? execFileSync('textutil', ['-convert', 'txt', '-stdout', file], { encoding: 'utf8' })
    : readFileSync(file, 'utf8');
  return parseEnv(text);
}

export function targetEnv() {
  const local = readEnv(path.resolve('.env.local'));
  const worker = readEnv(path.join(homedir(), '.classify-inspiration.env'));
  const saved = readEnv(path.resolve('.env.strategist.local'));
  const env = { ...local, ...saved, ...process.env };
  const url = env.SUPABASE_URL || local.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error('Immuvi SUPABASE_URL is missing');
  const ref = new URL(url).hostname.split('.')[0];
  const supplied = env.STRATEGIST_DATABASE_URL || env.SUPABASE_DB_URL || worker.SUPABASE_DB_URL;
  let database;
  if (supplied) {
    database = new URL(supplied);
    if (database.hostname !== `db.${ref}.supabase.co` && !decodeURIComponent(database.username).endsWith(`.${ref}`)) {
      throw new Error('Database connection does not belong to Immuvi SUPABASE_URL');
    }
  } else {
    const pooler = path.resolve('supabase/.temp/pooler-url');
    database = new URL(existsSync(pooler) ? readFileSync(pooler, 'utf8').trim() : `postgresql://postgres@db.${ref}.supabase.co:5432/postgres`);
    if (database.hostname !== `db.${ref}.supabase.co` && !decodeURIComponent(database.username).endsWith(`.${ref}`)) {
      throw new Error('Local pooler does not belong to Immuvi');
    }
  }
  if (!database.password) database.password = env.SUPABASE_DB_PASSWORD || worker.SUPABASE_DB_PASSWORD || '';
  if (!database.password) throw new Error('Immuvi database password is missing');
  database.searchParams.set('sslmode', 'require');
  const { APP_PASSWORD: _password, DATABASE_URL: _source, ...clean } = env;
  return {
    ...clean,
    SUPABASE_URL: url,
    SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY || local.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    STRATEGIST_DATABASE_URL: database.href,
  };
}

export function sourceEnv(file) {
  const env = readEnv(file);
  if (!env.DATABASE_URL || !env.SUPABASE_URL) throw new Error('Source database settings are missing');
  const { APP_PASSWORD: _password, ...clean } = env;
  return clean;
}
