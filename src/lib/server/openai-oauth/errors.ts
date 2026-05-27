export class OpenAIOAuthError extends Error {
	constructor(
		message: string,
		readonly code: string,
		readonly description?: string
	) {
		super(description ? `${message}: ${description}` : message);
		this.name = 'OpenAIOAuthError';
	}
}

export class OAuthRefreshFailedError extends OpenAIOAuthError {
	constructor(code: string, description?: string) {
		super('OAuth refresh failed', code, description);
		this.name = 'OAuthRefreshFailedError';
	}
}

export class OAuthTokenExchangeFailedError extends OpenAIOAuthError {
	constructor(code: string, description?: string) {
		super('OAuth token exchange failed', code, description);
		this.name = 'OAuthTokenExchangeFailedError';
	}
}

export class OAuthAuthorizationError extends OpenAIOAuthError {
	constructor(code: string, description?: string) {
		super('OAuth authorization failed', code, description);
		this.name = 'OAuthAuthorizationError';
	}
}
