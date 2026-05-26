# Flightlog Instructions

## Spec

FlightLog is an agent observability and CI regression layer for browser/AI agents. It is a small
open-source platform that logs, replays, evaluates, and explains what an autonomous agent did, then
reports scored regression results to GitHub Checks.

There are two parts: an SDK/API observability layer, and a dashboard to inspect runs, evaluations,
tool calls, and replay timelines.

The evaluation layer should include:

- did the agent complete the goal?
- did it violate constraints?
- did it repeat itself?
- did it need human approval?

The regression layer should include:

- regression suites mapped to GitHub repositories
- goal-based regression cases with score thresholds
- suite execution on PR webhooks
- GitHub Check Runs with aggregate and per-case results
- links from failed checks back to trace replay in the dashboard

The SDK/API layer should let the agent log:

- goal
- planned action
- tool/browser action
- observation
- decision reasoning summary
- success/failure
- screenshots or DOM snapshots if relevant

## When Coding

Whenever making new UI, use shadcn components by adding them using `bunx shadcn-svelte@latest add <component>`.
