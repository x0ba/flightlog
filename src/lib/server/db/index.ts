import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';
import { isLocalDatabaseUrl } from './url';
import { env } from '$env/dynamic/private';

if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

const databaseUrl = env.DATABASE_URL;

export type AppDatabase = NodePgDatabase<typeof schema>;

export const db: AppDatabase = isLocalDatabaseUrl(databaseUrl)
	? ((await import('./local')).createLocalDatabase(databaseUrl) as AppDatabase)
	: (await import('./neon')).createNeonDatabase(databaseUrl);
