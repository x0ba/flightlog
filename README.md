# FlightLog

FlightLog is an AgentOps flight recorder for browser and AI agents. It logs runs, tool calls, observations, artifacts, replay timelines, and evaluations so you can inspect what an autonomous agent did.

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

If `OPENAI_API_KEY` is missing, evaluations still run with deterministic rule checks. UI-triggered
agent runs require `OPENAI_API_KEY` and `BROWSERBASE_API_KEY` because they use OpenAI computer use
through the Responses API against Browserbase cloud browsers.

## UI Agent Runs

Open `/runs`, enter a browser task in the prompt composer, and start a run. FlightLog creates a run,
opens the run detail page, and streams events live over Server-Sent Events while a headless
Browserbase Chromium session is controlled by OpenAI computer use through Playwright CDP.

During a live run, FlightLog logs:

- the user goal
- browser actions requested by the model
- concise reasoning summaries when provided
- observations and screenshots after browser actions
- approval decisions
- final result or failure details

Screenshots are stored as screenshot artifacts and shown in the replay panel as they arrive.

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
  -d '{"goal":"Find product pricing without buying anything","name":"Pricing check"}'
```

Append an event:

```sh
curl -X POST http://localhost:5173/api/runs/run_id/events \
  -H 'content-type: application/json' \
  -d '{"type":"tool_call","message":"Search pricing page","data":{"tool":"browser.search","input":{"query":"pricing"}}}'
```

Attach an artifact:

```sh
curl -X POST http://localhost:5173/api/runs/run_id/artifacts \
  -H 'content-type: application/json' \
  -d '{"type":"text","name":"observation","content":"Pricing page loaded"}'
```

Finish and evaluate:

```sh
curl -X PATCH http://localhost:5173/api/runs/run_id \
  -H 'content-type: application/json' \
  -d '{"status":"success"}'

curl -X POST http://localhost:5173/api/runs/run_id/evaluate \
  -H 'content-type: application/json' \
  -d '{"constraints":["Do not place a real order"]}'
```

## SDK Example

```ts
import { FlightLogClient } from '$lib/sdk/client';

const flightlog = new FlightLogClient({ endpoint: 'http://localhost:5173' });
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

## MVP Limitations

- No auth or API keys.
- No organizations or projects.
- Artifacts are stored in Postgres as text, URLs, or data URLs.
- Replay is timeline-based, not a true browser session replay.
- LLM evaluation is optional.
- UI-triggered agent runs use an in-process runner. Production multi-instance deployments should
  move this to a durable queue/worker.
