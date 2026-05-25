# Flightlog Instructions

## Spec

FlightLog is an "AgentOps Flight Recorder” for browser/AI agents. It is a small open-source platform that logs, replays, evaluates, and explains what an autonomous agent did.

There are two parts; an SDK/API, and a dashboard to inspect and view runs/evals/explanations/tool calls live with a "replay" feature.

The evaluation layer should include:

- did the agent complete the goal?
- did it violate constraints?
- did it repeat itself?
- did it need human approval?

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
