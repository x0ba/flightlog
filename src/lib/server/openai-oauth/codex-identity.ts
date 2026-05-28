type CodexJwtPayload = {
	'https://api.openai.com/auth'?: {
		chatgpt_account_id?: unknown;
	};
};

function decodeJwtPayload(accessToken: string): CodexJwtPayload | undefined {
	const parts = accessToken.split('.');
	if (parts.length !== 3) return undefined;
	try {
		const decoded = Buffer.from(parts[1], 'base64url').toString('utf8');
		const parsed: unknown = JSON.parse(decoded);
		return parsed && typeof parsed === 'object' ? (parsed as CodexJwtPayload) : undefined;
	} catch {
		return undefined;
	}
}

export function chatgptAccountIdFromAccessToken(accessToken: string) {
	const accountId = decodeJwtPayload(accessToken)?.['https://api.openai.com/auth']
		?.chatgpt_account_id;
	return typeof accountId === 'string' && accountId.trim() ? accountId.trim() : undefined;
}
