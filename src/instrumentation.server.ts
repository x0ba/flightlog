import * as Sentry from '@sentry/sveltekit';

Sentry.init({
	dsn: 'https://d175e8ebecfe9328d468d75e969b412b@o4510406524403712.ingest.us.sentry.io/4511465122955264',

	tracesSampleRate: import.meta.env.PROD ? 0.1 : 1,

	// Enable logs to be sent to Sentry
	enableLogs: true

	// uncomment the line below to enable Spotlight (https://spotlightjs.com)
	// spotlight: import.meta.env.DEV,
});
