import { drizzle } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export function createLocalDatabase(url: string) {
	return drizzle(new Pool({ connectionString: url }), { schema });
}

export type LocalDatabase = NodePgDatabase<typeof schema>;
