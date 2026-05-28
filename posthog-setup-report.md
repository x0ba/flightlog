<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into FlightLog, a SvelteKit agent observability platform. Here is a summary of all changes made:

**New files created:**
- `src/lib/server/posthog.ts` — server-side PostHog singleton using `posthog-node`
- `.env` — PostHog public token and host added

**Files modified:**
- `svelte.config.js` — added `paths.relative: false` (required for session replay with SSR)
- `src/hooks.client.ts` — added PostHog client init (`posthog.init`) with reverse proxy config, and `captureException` in the error handler
- `src/hooks.server.ts` — added `/ingest` reverse proxy handler (avoids ad blockers) and server-side `server_error` capture in `handleError`
- `src/routes/+layout.svelte` — added `posthog.identify(userId)` on sign-in and `posthog.reset()` on sign-out, keyed to the Clerk user ID from layout data
- `src/routes/runs/+page.svelte` — PostHog headers forwarded on `startAgentRun`, `saveCredential`, and `deleteCredential` fetches; `chatgpt_connect_started` captured in `connectChatGpt`
- `src/routes/runs/[id]/+page.svelte` — `run_viewed` captured on page load
- `src/routes/regression/+page.svelte` — PostHog headers forwarded on suite creation fetch
- `src/routes/regression/[id]/+page.svelte` — PostHog headers forwarded on case creation and run start fetches
- `src/routes/regression/runs/[id]/+page.svelte` — `regression_run_viewed` captured on page load
- `src/routes/api/agent-runs/+server.ts` — `agent_run_created` captured with run mode, provider, framework, model, and approval policy
- `src/routes/api/runs/+server.ts` — `api_run_created` captured for external API usage
- `src/routes/api/settings/providers/+server.ts` — `provider_key_saved` captured with provider type
- `src/routes/api/settings/providers/[id]/+server.ts` — `provider_key_deleted` captured
- `src/routes/api/regression/suites/+server.ts` — `regression_suite_created` captured with repository
- `src/routes/api/regression/suites/[id]/+server.ts` — `regression_case_added` captured with suite and min score
- `src/routes/api/regression/suites/[id]/runs/+server.ts` — `regression_run_started` captured with suite, SHA, and PR number

Server-side events pass `x-posthog-distinct-id` and `x-posthog-session-id` headers from the client, ensuring client and server events correlate to the same person and session.

## Events

| Event | Description | File |
|---|---|---|
| `agent_run_created` | User creates a new agent run from the dashboard UI | `src/routes/api/agent-runs/+server.ts` |
| `api_run_created` | A run is created via the public API endpoint | `src/routes/api/runs/+server.ts` |
| `provider_key_saved` | User saves a new provider API key | `src/routes/api/settings/providers/+server.ts` |
| `provider_key_deleted` | User deletes a saved provider credential | `src/routes/api/settings/providers/[id]/+server.ts` |
| `regression_suite_created` | User creates a new regression suite linked to a GitHub repository | `src/routes/api/regression/suites/+server.ts` |
| `regression_case_added` | User adds a new test case to a regression suite | `src/routes/api/regression/suites/[id]/+server.ts` |
| `regression_run_started` | A regression suite run is triggered | `src/routes/api/regression/suites/[id]/runs/+server.ts` |
| `run_viewed` | User opens the trace detail view for an agent run | `src/routes/runs/[id]/+page.svelte` |
| `regression_run_viewed` | User views the results of a regression run | `src/routes/regression/runs/[id]/+page.svelte` |
| `chatgpt_connect_started` | User initiates ChatGPT OAuth connection | `src/routes/runs/+page.svelte` |
| `server_error` | Unhandled server-side error (automatic) | `src/hooks.server.ts` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics dashboard](/dashboard/1641148)
- [Agent runs over time](/insights/sUCXXhwg) — Daily run creation trend
- [Provider → Run activation funnel](/insights/MNTsbs8S) — Conversion from saving a key to viewing a trace
- [Unique active users (weekly)](/insights/wNo9rbIP) — Weekly unique users creating runs
- [Regression suite adoption](/insights/VALu8iKM) — Suite creation vs regression runs started
- [Provider key churn](/insights/PBVpSvnz) — Keys saved vs deleted

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/integration-sveltekit/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
