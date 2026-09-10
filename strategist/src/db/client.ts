import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'
import { AsyncLocalStorage } from 'node:async_hooks'
import { sql } from 'drizzle-orm'

const requestDb = new AsyncLocalStorage<ReturnType<typeof drizzle<typeof schema>>>()

const globalForDb = globalThis as unknown as {
  __strategistSql?: ReturnType<typeof postgres>
  __strategistDb?: ReturnType<typeof drizzle>
}

function getDb() {
  if (globalForDb.__strategistDb) return globalForDb.__strategistDb

  const connectionString = process.env.STRATEGIST_DATABASE_URL
  if (!connectionString) throw new Error('STRATEGIST_DATABASE_URL is not set')
  const connection = new URL(connectionString)
  const project = new URL(process.env.SUPABASE_URL || '').hostname.split('.')[0]
  if (connection.hostname !== `db.${project}.supabase.co` && !decodeURIComponent(connection.username).endsWith(`.${project}`)) {
    throw new Error('Strategist database must belong to the Immuvi Supabase project')
  }

  const client =
    globalForDb.__strategistSql ??
    postgres(connectionString, {
      prepare: false,
      max: Number(process.env.PG_POOL_MAX ?? 3),
      idle_timeout: 20,
      max_lifetime: 60 * 30,
      connect_timeout: 15,
    })

  globalForDb.__strategistSql = client

  const db = drizzle(client, { schema })
  globalForDb.__strategistDb = db
  return db
}

export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop) {
    return ((requestDb.getStore() || getDb()) as never)[prop as never]
  },
})
export { schema }

export async function withUser<T>(userId: string, callback: () => Promise<T>): Promise<T> {
  return getDb().transaction(async tx => {
    await tx.execute(sql`select set_config('request.jwt.claims', ${JSON.stringify({ sub: userId, role: 'authenticated' })}, true)`)
    await tx.execute(sql`set local role authenticated`)
    return requestDb.run(tx as unknown as ReturnType<typeof drizzle<typeof schema>>, callback)
  })
}
