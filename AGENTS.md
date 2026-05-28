# Flightlog Instructions

## Spec

FlightLog is an agent observability and CI regression layer for browser/AI agents. It is a small
open-source platform that logs, replays, evaluates, and explains what an autonomous agent did, then
reports scored regression results to GitHub Checks.

There are two parts: an SDK/API/CI AI observability layer and regression tester, and a dashboard to inspect runs, evaluations,
tool calls, and replay timelines.

## When Coding

- Whenever making new UI, use shadcn components by adding them using `bunx shadcn-svelte@latest add <component>`.
- When editing the shape of the data: prefer changing the schema.ts file over writing SQL migration files.
- ChatGPT subscription auth uses the Codex OAuth flow in `src/lib/server/openai-oauth/`; tokens are
 encrypted in `provider_credentials` and refreshed automatically before agent runs. Tool-agent runs
 with a ChatGPT credential call `POST chatgpt.com/backend-api/codex/responses` (stream-only SSE).
