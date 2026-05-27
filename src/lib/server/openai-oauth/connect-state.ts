import { eq, lt } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { oauthConnectStates } from '$lib/server/db/schema';
import { DEVICE_CODE_MAX_WAIT_MS, OAUTH_CONNECT_TTL_MS } from './constants';
import { generateOAuthState } from './pkce';

export async function createRedirectConnectState(input: {
	ownerUserId: string;
	label: string;
	codeVerifier: string;
}) {
	const state = generateOAuthState();
	const expiresAt = new Date(Date.now() + OAUTH_CONNECT_TTL_MS);
	await db.insert(oauthConnectStates).values({
		state,
		ownerUserId: input.ownerUserId,
		codeVerifier: input.codeVerifier,
		label: input.label,
		expiresAt
	});
	return { state, expiresAt };
}

export async function createDeviceConnectState(input: {
	ownerUserId: string;
	label: string;
	deviceAuthId: string;
	userCode: string;
	pollIntervalMs: number;
}) {
	const state = `device:${input.deviceAuthId}`;
	const expiresAt = new Date(Date.now() + DEVICE_CODE_MAX_WAIT_MS);
	await db.insert(oauthConnectStates).values({
		state,
		ownerUserId: input.ownerUserId,
		label: input.label,
		deviceAuthId: input.deviceAuthId,
		userCode: input.userCode,
		pollIntervalMs: input.pollIntervalMs,
		expiresAt
	});
	return { state, expiresAt };
}

export async function readConnectState(state: string) {
	const [row] = await db
		.select()
		.from(oauthConnectStates)
		.where(eq(oauthConnectStates.state, state))
		.limit(1);
	if (!row) return undefined;
	if (row.expiresAt.getTime() < Date.now()) {
		await deleteConnectState(state);
		return undefined;
	}
	return row;
}

export async function readDeviceConnectState(deviceAuthId: string) {
	const [row] = await db
		.select()
		.from(oauthConnectStates)
		.where(eq(oauthConnectStates.deviceAuthId, deviceAuthId))
		.limit(1);
	if (!row) return undefined;
	if (row.expiresAt.getTime() < Date.now()) {
		await deleteConnectState(row.state);
		return undefined;
	}
	return row;
}

export async function deleteConnectState(state: string) {
	await db.delete(oauthConnectStates).where(eq(oauthConnectStates.state, state));
}

export async function purgeExpiredConnectStates() {
	await db.delete(oauthConnectStates).where(lt(oauthConnectStates.expiresAt, new Date()));
}
