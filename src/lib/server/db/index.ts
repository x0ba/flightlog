import { neon } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { isLocalDatabaseUrl } from './url';
import { env } from '$env/dynamic/private';

if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

const databaseUrl = env.DATABASE_URL;

export type AppDatabase = NodePgDatabase<typeof schema>;

function createDatabase(url: string): AppDatabase {
	if (isLocalDatabaseUrl(url)) {
		return drizzlePg(new Pool({ connectionString: url }), { schema });
	}
	return drizzleNeon(neon(url), { schema }) as unknown as AppDatabase;
}

export const db = createDatabase(databaseUrl);
