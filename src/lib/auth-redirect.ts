const defaultPostAuthPath = '/runs';

export function safeRedirectPath(path: string | null | undefined, fallback = defaultPostAuthPath) {
	if (
		!path ||
		!path.startsWith('/') ||
		path.startsWith('//') ||
		path.startsWith('/\\') ||
		path.includes('://')
	) {
		return fallback;
	}
	return path;
}

export function readPostAuthRedirectUrl(
	searchParams: URLSearchParams,
	fallback = defaultPostAuthPath
) {
	const raw = searchParams.get('redirect_url') ?? searchParams.get('redirectUrl');
	return safeRedirectPath(raw, fallback);
}
