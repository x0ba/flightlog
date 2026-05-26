# FlightLog

FlightLog is an AgentOps flight recorder for browser and AI agents. It logs traces, model calls,
tool calls, browser actions, observations, artifacts, replay timelines, and evaluations so you can
inspect what an autonomous agent did across model providers and agent frameworks.

## Setup

```sh
bun install
bun run db:push
bun run check
bun run lint
```

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

`FLIGHTLOG_KEYS_SECRET` is required when saving or using dashboard-entered provider API keys. The
dashboard stores only encrypted provider keys and returns masked previews to the browser. Clerk is
required for dashboard access and API ingestion. Existing unowned local runs and provider
credentials are claimed by the first signed-in Clerk user.

If `OPENAI_API_KEY` is missing, evaluations still run with deterministic rule checks. Browser-mode
UI agent runs require `OPENAI_API_KEY` and `BROWSERBASE_API_KEY` because they use OpenAI computer use
through the Responses API against Browserbase cloud browsers. Tool-agent dashboard runs use the
encrypted OpenAI or Anthropic credential selected in the UI.

## UI Agent Runs

Sign in with Clerk, open `/runs`, save an OpenAI or Anthropic provider key, choose a run mode,
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
