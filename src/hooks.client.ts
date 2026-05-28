import * as Sentry from '@sentry/sveltekit';
import { env } from '$env/dynamic/public';
import { initializeClerkClient } from 'clerk-sveltekit/client';

// If you don't want to use Session Replay, remove the `Replay` integration,
// `replaysSessionSampleRate` and `replaysOnErrorSampleRate` options.
Sentry.init({
	dsn: 'https://d175e8ebecfe9328d468d75e969b412b@o4510406524403712.ingest.us.sentry.io/4511465122955264',
	tracesSampleRate: 1,
	replaysSessionSampleRate: 0.1,
	replaysOnErrorSampleRate: 1,
	integrations: [Sentry.replayIntegration()],
	enableLogs: true,
	sendDefaultPii: true
});

initializeClerkClient(env.PUBLIC_CLERK_PUBLISHABLE_KEY ?? '', {
	afterSignInUrl: '/runs',
	afterSignUpUrl: '/runs',
	signInUrl: '/sign-in',
	signUpUrl: '/sign-up'
});
export const handleError = Sentry.handleErrorWithSentry();
