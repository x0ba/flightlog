# FlightLog

FlightLog is an agent observability and CI regression layer for browser and AI agents. It logs
traces, model calls, tool calls, browser actions, observations, artifacts, replay timelines, and
evaluations so you can inspect what an autonomous agent did and gate changes with scored regression
tests in GitHub Checks.

## Setup

```sh
bun install
bun run db:up
bun run db:push
bun run check
bun run lint
bun run test
```

### Database (local vs production)

Use Docker Postgres locally and Neon in production. Both use the same `DATABASE_URL` variable; the app picks the driver from the hostname.

1. Start local Postgres: `bun run db:up` (or `docker compose up -d postgres`).
2. Set `DATABASE_URL` in `.env` to the local URL (see `.env.example`).
3. Apply schema: `bun run db:push`.
4. On Vercel (or other production), set `DATABASE_URL` to your Neon connection string.

`drizzle-kit` uses the `pg` driver when `pg` is installed (required for local `db:push`). The Neon serverless driver is only used at runtime when the URL is not localhost. Schema changes belong in `src/lib/server/db/schema.ts`; apply them with `bun run db:push`.

Required environment:

```sh
DATABASE_URL=
FLIGHTLOG_KEYS_SECRET=
PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
```

Optional LLM evaluation environment:

```sh
OPENAI_API_KEY=
OPENAI_AGENT_MODEL=computer-use-preview
OPENAI_EVAL_MODEL=
BROWSERBASE_API_KEY=
BROWSERBASE_PROJECT_ID=
FLIGHTLOG_AGENT_MAX_STEPS=20
FLIGHTLOG_AGENT_APPROVAL_TIMEOUT_SECONDS=300
```

Optional ChatGPT subscription OAuth (dashboard agent runs):

```sh
# Defaults to the public Codex CLI client.
OPENAI_OAUTH_CLIENT_ID=
# Set only when registered with OpenAI; enables browser redirect sign-in.
# Without this, ChatGPT sign-in uses the device-code flow (Codex public client).
OPENAI_OAUTH_REDIRECT_URI=
# auto | on | off — auto uses device flow unless OPENAI_OAUTH_REDIRECT_URI is set
OPENAI_OAUTH_DEVICE_AUTH=auto
```

Optional GitHub App environment for PR regression checks:

```sh
GITHUB_APP_ID=
GITHUB_APP_PRIVATE_KEY=
GITHUB_WEBHOOK_SECRET=
PUBLIC_APP_URL=http://localhost:5173
```

`FLIGHTLOG_KEYS_SECRET` is required when saving or using dashboard-entered provider API keys. The
dashboard stores only encrypted provider keys and returns masked previews to the browser. Clerk is
required for dashboard access and API ingestion. Existing unowned local runs and provider
credentials remain unowned until they are assigned through an explicit backfill.

If `OPENAI_API_KEY` is missing, evaluations still run with deterministic rule checks. Browser-mode
UI agent runs use a saved OpenAI credential (ChatGPT subscription or platform API key) plus a
Browserbase credential. Tool-agent dashboard runs use the encrypted OpenAI or Anthropic credential
selected in the UI.

## UI Agent Runs

Sign in with Clerk, open `/runs`, connect ChatGPT (subscription) or save a platform API key for
OpenAI/Anthropic, choose a run mode,
provider, framework, model, and tools, then start a run. FlightLog creates a user-owned run, opens
the run detail page, and streams events and spans live over Server-Sent Events.

Tool-agent runs use a curated local tool registry:

- `calculator.evaluate`
- `web.fetchText`
- `web.searchMock`
- `time.now`

Browser runs still use OpenAI computer use through Playwright CDP against a Browserbase Chromium
session.

During a live run, FlightLog logs:

- the user goal
- browser actions requested by the model
- concise reasoning summaries when provided
- observations and screenshots after browser actions
- approval decisions
- final result or failure details

Screenshots are stored as screenshot artifacts and shown in the replay panel as they arrive.

Tool-agent runs log:

- model call spans
- tool call spans
- tool inputs, outputs, and failures
- final result text
- provider, framework, model, and run mode metadata

### Approvals

The runner pauses when OpenAI returns pending safety checks or when FlightLog detects selected risky
actions. The run detail page shows an approval panel with the latest screenshot, action payload, and
Approve/Reject controls. Approving resumes the run with acknowledged safety checks. Rejecting marks
the run cancelled.

## API Example

Create a run:

```sh
curl -X POST http://localhost:5173/api/runs \
  -H 'content-type: application/json' \
  -H 'authorization: Bearer CLERK_TOKEN' \
  -d '{"goal":"Find product pricing without buying anything","name":"Pricing check"}'
```

Append an event:

```sh
curl -X POST http://localhost:5173/api/runs/run_id/events \
  -H 'content-type: application/json' \
  -H 'authorization: Bearer CLERK_TOKEN' \
  -d '{"type":"tool_call","message":"Search pricing page","data":{"tool":"browser.search","input":{"query":"pricing"}}}'
```

Attach an artifact:

```sh
curl -X POST http://localhost:5173/api/runs/run_id/artifacts \
  -H 'content-type: application/json' \
  -H 'authorization: Bearer CLERK_TOKEN' \
  -d '{"type":"text","name":"observation","content":"Pricing page loaded"}'
```

Finish and evaluate:

```sh
curl -X PATCH http://localhost:5173/api/runs/run_id \
  -H 'content-type: application/json' \
  -H 'authorization: Bearer CLERK_TOKEN' \
  -d '{"status":"success"}'

curl -X POST http://localhost:5173/api/runs/run_id/evaluate \
  -H 'content-type: application/json' \
  -H 'authorization: Bearer CLERK_TOKEN' \
  -d '{"constraints":["Do not place a real order"]}'
```

## SDK Example

```ts
import { FlightLogClient } from '$lib/sdk/client';

const flightlog = new FlightLogClient({
	endpoint: 'http://localhost:5173',
	apiKey: clerkToken
});
const run = await flightlog.startRun({
	goal: 'Find product pricing without buying anything',
	name: 'Pricing check',
	agentName: 'browser-agent'
});

await run.logPlan('Open the pricing page and inspect visible prices.');
await run.logToolCall({ tool: 'browser.search', input: { query: 'pricing' } });
await run.logObservation('Pricing page loaded.');
await run.finish({ status: 'success' });
await run.evaluate({ constraints: ['Do not place a real order'] });
```

## Trace API Example

The versioned trace API is the model/framework-agnostic surface. It keeps browser actions
first-class for replay, but represents model calls and tool calls as spans with lifecycle events.

```ts
import { FlightLogClient, openAIAttributes } from '$lib';

const flightlog = new FlightLogClient({
	endpoint: 'http://localhost:5173',
	apiKey: clerkToken
});
const trace = await flightlog.startTrace({
	goal: 'Look up the customer and draft a refund response',
	name: 'Refund agent',
	agentName: 'support-agent',
	metadata: { framework: 'custom-loop' }
});

const model = await trace.logModelCall({
	name: 'plan next action',
	input: { messages: [{ role: 'user', content: 'Refund request' }] },
	attributes: openAIAttributes({ model: 'gpt-4.1' })
});
await model.complete({ tool: 'crm.lookupCustomer' });

const tool = await trace.logToolCall({
	name: 'crm.lookupCustomer',
	input: { email: 'customer@example.com' }
});
await tool.complete({ customerId: 'cus_123' });

await trace.finish({ status: 'success' });
await trace.evaluate({ constraints: ['Do not refund more than the order total'] });
```

## Regression Testing and GitHub Checks

FlightLog can run goal-based regression suites against agents, evaluate each run with rules plus an
optional LLM judge, and report pass/fail results as GitHub Check Runs.

1. Create a regression suite mapped to a GitHub repository.
2. Add cases with goals, constraints, and minimum score thresholds.
3. Install the FlightLog GitHub App on that repository.
4. Open or update a pull request; FlightLog receives the webhook, runs the suite, and updates the
   check with aggregate score and per-case findings.
5. Inspect traces and evaluator output in the dashboard at `/regression` and `/runs`.

Create a suite:

```sh
curl -X POST http://localhost:5173/api/regression/suites \
  -H 'content-type: application/json' \
  -H 'authorization: Bearer CLERK_TOKEN' \
  -d '{"name":"PR smoke tests","repositoryOwner":"acme","repositoryName":"support-agent"}'
```

Add a case:

```sh
curl -X POST http://localhost:5173/api/regression/suites/suite_id \
  -H 'content-type: application/json' \
  -H 'authorization: Bearer CLERK_TOKEN' \
  -d '{"name":"Lookup customer","goal":"Find the customer record for support@example.com","constraints":["Do not delete records"],"minScore":80}'
```

Run a suite manually:

```sh
curl -X POST http://localhost:5173/api/regression/suites/suite_id/runs \
  -H 'content-type: application/json' \
  -H 'authorization: Bearer CLERK_TOKEN' \
  -d '{}'
```

GitHub App webhook endpoint:

```sh
POST /api/github/webhook
```

## SDK Regression Example

```ts
import { FlightLogClient } from '$lib/sdk/client';

const flightlog = new FlightLogClient({
	endpoint: 'http://localhost:5173',
	apiKey: clerkToken
});

const suite = await flightlog.createRegressionSuite({
	name: 'PR smoke tests',
	repositoryOwner: 'acme',
	repositoryName: 'support-agent'
});

await flightlog.addRegressionCase(suite.id, {
	name: 'Lookup customer',
	goal: 'Find the customer record for support@example.com',
	constraints: ['Do not delete records'],
	minScore: 80
});

const run = await flightlog.startRegressionRun(suite.id);
console.log(run.pageUrl);
```

### Framework Metadata Helpers

```ts
import {
	aiSdkAttributes,
	anthropicAttributes,
	instrumentModelCall,
	langChainAttributes
} from '$lib';

await instrumentModelCall({
	trace,
	name: 'anthropic planning call',
	metadata: anthropicAttributes({ model: 'claude-sonnet-4-5' }),
	call: async () => {
		// Call Anthropic from your app. FlightLog observes metadata/results only.
		return { text: 'Use the CRM lookup tool.' };
	}
});

await trace.logModelCall({
	name: 'ai sdk generateText',
	attributes: aiSdkAttributes({ provider: 'openai', model: 'gpt-4.1-mini' })
});

await trace.logModelCall({
	name: 'langchain runnable',
	attributes: langChainAttributes({ provider: 'anthropic', model: 'claude-haiku-4-5' })
});
```

## MVP Limitations

- No organizations or projects; isolation is per Clerk user.
- Artifacts are stored in Postgres as text, URLs, or data URLs.
- Replay is timeline-based, not a true browser session replay.
- LLM evaluation is optional.
- UI-triggered agent runs use an in-process runner. Production multi-instance deployments should
  move this to a durable queue/worker.
- Regression suite execution uses the same in-process runner and requires configured provider
  credentials for tool-agent cases unless cases are completed externally through the regression API.
- Golden trace comparison, PR annotations, and durable GitHub check workers are not implemented yet.
