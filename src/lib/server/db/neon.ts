import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

export function createNeonDatabase(url: string) {
	return drizzle(neon(url), { schema }) as unknown as NodePgDatabase<typeof schema>;
}
