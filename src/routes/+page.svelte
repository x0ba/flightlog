<script lang="ts">
	import { resolve } from '$app/paths';
	import { ArrowUpRight, GitBranch, Activity, ShieldCheck } from '@lucide/svelte';

	const sdkSnippet = `import { FlightLog } from '@flightlog/sdk';

const log = new FlightLog({ apiKey: process.env.FLIGHTLOG_KEY });

const run = log.run({ goal: 'Find product pricing without buying anything' });

run.plan('Open vendor site, locate pricing page');
run.tool('browser.goto', { url: 'https://acme.dev' });
run.observe({ dom: snapshot });
run.decide('Pricing visible in nav, follow link');
run.finish({ status: 'success' });`;

	const checkSnippet = `name: agent-regression
on: pull_request

jobs:
  flightlog:
    uses: flightlog/regression@v1
    with:
      suite: checkout-flow
      threshold: 0.85`;

	const capabilities = [
		{
			icon: Activity,
			title: 'Observability SDK',
			body: 'Log goals, plans, tool calls, observations, and decisions. Replay timelines with screenshots and DOM snapshots inline.'
		},
		{
			icon: ShieldCheck,
			title: 'Evaluations',
			body: 'Score every run on goal completion, constraint violations, redundant steps, and human-approval requests.'
		},
		{
			icon: GitBranch,
			title: 'CI Regression',
			body: 'Map suites to GitHub repos. PR webhooks execute cases and post aggregate + per-case Check Runs linked back to traces.'
		}
	] as const;
</script>

<svelte:head>
	<title>FlightLog — agent observability & CI regression</title>
	<meta
		name="description"
		content="Log, replay, evaluate, and regression-test browser and AI agents. GitHub Check Runs included."
	/>
</svelte:head>

<div class="min-h-screen bg-background text-foreground">
	<header class="border-b border-border/60">
		<div class="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
			<a href="/" class="flex items-center gap-2.5">
				<div
					class="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 ring-1 ring-primary/30"
				>
					<svg
						width="13"
						height="13"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.6"
						class="text-primary"
					>
						<path
							d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"
						/>
					</svg>
				</div>
				<span class="text-[15px] font-semibold tracking-tight">FlightLog</span>
			</a>
			<nav class="flex items-center gap-2">
				<a
					href="https://github.com/x0ba/flightlog"
					class="hidden rounded-md px-3 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
				>
					GitHub
				</a>
				<a
					href={resolve('/runs')}
					class="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
				>
					Dashboard
					<ArrowUpRight class="size-3.5" />
				</a>
			</nav>
		</div>
	</header>

	<main class="mx-auto max-w-6xl px-6">
		<section class="py-24 sm:py-32">
			<p
				class="mb-5 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-3 py-1 font-mono text-[11px] tracking-wider text-muted-foreground uppercase"
			>
				<span class="size-1.5 rounded-full bg-primary"></span>
				v0.1 · open source
			</p>
			<h1 class="max-w-3xl text-4xl leading-[1.05] font-semibold tracking-tight sm:text-6xl">
				Observability and CI regression for autonomous agents.
			</h1>
			<p class="mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
				FlightLog records what your browser and tool-calling agents did, scores it, and gates pull
				requests on regression suites — surfaced directly as GitHub Check Runs.
			</p>
			<div class="mt-8 flex flex-wrap items-center gap-3">
				<a
					href={resolve('/runs')}
					class="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
				>
					Open dashboard
					<ArrowUpRight class="size-4" />
				</a>
				<a
					href="#sdk"
					class="inline-flex items-center rounded-md border border-border bg-card px-4 py-2 font-mono text-xs text-foreground transition-colors hover:bg-secondary"
				>
					npm i @flightlog/sdk
				</a>
			</div>
		</section>

		<section class="border-t border-border/60 py-20">
			<div
				class="grid gap-px overflow-hidden rounded-lg border border-border/60 bg-border/60 sm:grid-cols-3"
			>
				{#each capabilities as cap (cap.title)}
					<div class="bg-card p-6">
						<cap.icon class="size-4 text-primary" />
						<h3 class="mt-4 text-[15px] font-semibold tracking-tight">{cap.title}</h3>
						<p class="mt-2 text-sm leading-relaxed text-muted-foreground">{cap.body}</p>
					</div>
				{/each}
			</div>
		</section>

		<section id="sdk" class="border-t border-border/60 py-20">
			<div class="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:items-start">
				<div>
					<p class="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
						01 — Instrument
					</p>
					<h2 class="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
						One SDK. Every step of the loop.
					</h2>
					<p class="mt-4 text-sm text-muted-foreground sm:text-base">
						Drop the SDK into any agent runtime — native, AI SDK, LangChain, or custom. Emit
						<code class="font-mono text-foreground">plan</code>,
						<code class="font-mono text-foreground">tool</code>,
						<code class="font-mono text-foreground">observe</code>, and
						<code class="font-mono text-foreground">decide</code> events. Traces render as a replayable
						timeline with screenshots and DOM snapshots aligned to each step.
					</p>
				</div>
				<pre
					class="overflow-x-auto rounded-lg border border-border/60 bg-card p-5 font-mono text-[12.5px] leading-relaxed text-foreground/90"><code
						>{sdkSnippet}</code
					></pre>
			</div>
		</section>

		<section class="border-t border-border/60 py-20">
			<div class="grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:items-start">
				<pre
					class="order-2 overflow-x-auto rounded-lg border border-border/60 bg-card p-5 font-mono text-[12.5px] leading-relaxed text-foreground/90 lg:order-1"><code
						>{checkSnippet}</code
					></pre>
				<div class="order-1 lg:order-2">
					<p class="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
						02 — Gate
					</p>
					<h2 class="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
						Block regressions before they merge.
					</h2>
					<p class="mt-4 text-sm text-muted-foreground sm:text-base">
						Define goal-based cases with score thresholds. PR webhooks execute the suite and report
						a GitHub Check Run with per-case results. Failed checks deep-link to the exact trace and
						the step that broke.
					</p>
				</div>
			</div>
		</section>

		<section class="border-t border-border/60 py-20">
			<dl
				class="grid gap-px overflow-hidden rounded-lg border border-border/60 bg-border/60 sm:grid-cols-4"
			>
				{#each [['Eval signals', '4', 'completion, constraints, repetition, approvals'], ['Runtimes', 'any', 'native, AI SDK, LangChain, custom'], ['CI surface', 'GitHub', 'Check Runs with deep links to traces'], ['License', 'MIT', 'self-host or use hosted']] as [label, value, sub]}
					<div class="bg-card p-6">
						<dt class="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
							{label}
						</dt>
						<dd class="mt-2 text-2xl font-semibold tracking-tight">{value}</dd>
						<p class="mt-1 text-xs text-muted-foreground">{sub}</p>
					</div>
				{/each}
			</dl>
		</section>
	</main>

	<footer class="border-t border-border/60">
		<div
			class="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-6 sm:flex-row sm:items-center sm:justify-between"
		>
			<p class="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
				FlightLog · agent observability
			</p>
			<div class="flex items-center gap-5 font-mono text-[11px] text-muted-foreground">
				<a href="https://github.com/x0ba/flightlog" class="hover:text-foreground">GitHub</a>
				<a href="/docs" class="hover:text-foreground">Docs</a>
				<a href={resolve('/runs')} class="hover:text-foreground">Dashboard</a>
			</div>
		</div>
	</footer>
</div>
