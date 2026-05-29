const defaultPostAuthPath: `/${string}` = '/runs';

export function safeRedirectPath(
	path: string | null | undefined,
	fallback: `/${string}` = defaultPostAuthPath
): `/${string}` {
	if (
		!path ||
		!path.startsWith('/') ||
		path.startsWith('//') ||
		path.startsWith('/\\') ||
		path.includes('://')
	) {
		return fallback;
	}
	return path as `/${string}`;
}

export function readPostAuthRedirectUrl(
	searchParams: URLSearchParams,
	fallback: `/${string}` = defaultPostAuthPath
) {
	const raw =
		searchParams.get('redirect_url') ??
		searchParams.get('redirectUrl') ??
		searchParams.get('redirectAfterAuth');
	return safeRedirectPath(raw, fallback);
}
