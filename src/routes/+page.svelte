<script lang="ts">
	import { onMount } from 'svelte';
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
			body: 'Map suites to GitHub repos. PR webhooks execute cases and post aggregate + per-case Check Runs linked to traces.'
		}
	] as const;

	const stats = [
		['Eval signals', '4', 'completion, constraints, repetition, approvals'],
		['Runtimes', 'any', 'native, AI SDK, LangChain, custom'],
		['CI surface', 'GitHub', 'Check Runs with deep links to traces'],
		['License', 'MIT', 'self-host or use hosted']
	] as const;

	let scrolled = $state(false);

	onMount(() => {
		const onScroll = () => {
			scrolled = window.scrollY > 16;
		};
		onScroll();
		window.addEventListener('scroll', onScroll, { passive: true });
		return () => window.removeEventListener('scroll', onScroll);
	});
</script>

<svelte:head>
	<title>FlightLog — agent observability & CI regression</title>
	<meta
		name="description"
		content="Log, replay, evaluate, and regression-test browser and AI agents. GitHub Check Runs included."
	/>
</svelte:head>

<div class="page">
	<header class="nav-wrap" class:is-floating={scrolled}>
		<div class="nav" class:is-floating={scrolled}>
			<a href="/" class="brand">
				<span class="brand-mark">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
						<path
							d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"
						/>
					</svg>
				</span>
				<span>FlightLog</span>
			</a>

			<nav class="nav-links">
				<a href="#sdk">SDK</a>
				<a href="#ci">CI</a>
				<a href="#specs">Specs</a>
				<a href="https://github.com/x0ba/flightlog">GitHub</a>
			</nav>

			<a href={resolve('/runs')} class="nav-cta">
				Dashboard
				<ArrowUpRight class="size-3.5" />
			</a>
		</div>
	</header>

	<main>
		<section class="hero">
			<p class="eyebrow">
				<span class="dot"></span>
				v0.1 · open source
			</p>
			<h1>
				Observability and CI regression<br />for autonomous agents.
			</h1>
			<p class="lede">
				FlightLog records what your browser and tool-calling agents did, scores it, and gates pull
				requests on regression suites — surfaced directly as GitHub Check Runs.
			</p>
			<div class="cta-row">
				<a href={resolve('/runs')} class="btn-primary">
					Open dashboard
					<ArrowUpRight class="size-4" />
				</a>
				<a href="#sdk" class="btn-ghost">npm i @flightlog/sdk</a>
			</div>
		</section>

		<section class="caps">
			<div class="cap-grid">
				{#each capabilities as cap (cap.title)}
					<article class="cap">
						<cap.icon class="cap-icon" />
						<h3>{cap.title}</h3>
						<p>{cap.body}</p>
					</article>
				{/each}
			</div>
		</section>

		<section id="sdk" class="split">
			<div class="split-copy">
				<p class="kicker">01 — Instrument</p>
				<h2>One SDK. Every step of the loop.</h2>
				<p>
					Drop the SDK into any agent runtime — native, AI SDK, LangChain, or custom. Emit
					<code>plan</code>, <code>tool</code>, <code>observe</code>, and <code>decide</code> events.
					Traces render as a replayable timeline with screenshots and DOM snapshots aligned to each step.
				</p>
			</div>
			<pre><code>{sdkSnippet}</code></pre>
		</section>

		<section id="ci" class="split reverse">
			<pre><code>{checkSnippet}</code></pre>
			<div class="split-copy">
				<p class="kicker">02 — Gate</p>
				<h2>Block regressions before they merge.</h2>
				<p>
					Define goal-based cases with score thresholds. PR webhooks execute the suite and report a
					GitHub Check Run with per-case results. Failed checks deep-link to the exact trace and the
					step that broke.
				</p>
			</div>
		</section>

		<section id="specs" class="stats">
			<dl>
				{#each stats as [label, value, sub] (label)}
					<div>
						<dt>{label}</dt>
						<dd>{value}</dd>
						<p>{sub}</p>
					</div>
				{/each}
			</dl>
		</section>
	</main>

	<footer class="foot">
		<p>FlightLog · agent observability</p>
		<div>
			<a href="https://github.com/x0ba/flightlog">GitHub</a>
			<a href="/docs">Docs</a>
			<a href={resolve('/runs')}>Dashboard</a>
		</div>
	</footer>
</div>

<style>
	.page {
		--rule: color-mix(in oklch, var(--border) 80%, transparent);
		min-height: 100vh;
		background: var(--background);
		color: var(--foreground);
	}

	/* ───────────── nav ───────────── */
	.nav-wrap {
		position: sticky;
		top: 0;
		z-index: 40;
		background: color-mix(in oklch, var(--background) 75%, transparent);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		border-bottom: 1px solid var(--rule);
		transition:
			padding 360ms cubic-bezier(0.22, 1, 0.36, 1),
			background 360ms cubic-bezier(0.22, 1, 0.36, 1),
			border-color 360ms cubic-bezier(0.22, 1, 0.36, 1);
	}
	.nav-wrap.is-floating {
		padding: 12px 16px 0;
		background: transparent;
		border-bottom-color: transparent;
	}
	.nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 24px;
		max-width: 1120px;
		margin: 0 auto;
		padding: 14px 24px;
		transition:
			max-width 360ms cubic-bezier(0.22, 1, 0.36, 1),
			padding 360ms cubic-bezier(0.22, 1, 0.36, 1),
			border-radius 360ms cubic-bezier(0.22, 1, 0.36, 1),
			border-color 360ms cubic-bezier(0.22, 1, 0.36, 1),
			background 360ms cubic-bezier(0.22, 1, 0.36, 1),
			box-shadow 360ms cubic-bezier(0.22, 1, 0.36, 1);
	}
	.nav.is-floating {
		max-width: 820px;
		padding: 8px 10px 8px 18px;
		border-radius: 999px;
		border: 1px solid color-mix(in oklch, var(--foreground) 12%, transparent);
		background: color-mix(in oklch, var(--background) 80%, transparent);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		box-shadow: 0 10px 30px -16px rgba(0, 0, 0, 0.6);
	}
	.brand {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		font-size: 15px;
		font-weight: 600;
		letter-spacing: -0.01em;
	}
	.brand-mark {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		border-radius: 7px;
		color: var(--primary);
		background: color-mix(in oklch, var(--primary) 12%, transparent);
		box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--primary) 30%, transparent);
	}
	.brand-mark svg {
		width: 13px;
		height: 13px;
	}
	.nav-links {
		display: none;
		align-items: center;
		gap: 24px;
		font-size: 13px;
		color: var(--muted-foreground);
	}
	.nav-links a {
		transition: color 180ms;
	}
	.nav-links a:hover {
		color: var(--foreground);
	}
	@media (min-width: 720px) {
		.nav-links {
			display: inline-flex;
		}
	}
	.nav-cta {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 7px 14px;
		border-radius: 999px;
		font-size: 12.5px;
		font-weight: 500;
		color: var(--primary-foreground);
		background: var(--primary);
		transition:
			background 180ms,
			transform 180ms;
	}
	.nav-cta:hover {
		transform: translateY(-1px);
	}

	/* ───────────── layout ───────────── */
	main {
		max-width: 1120px;
		margin: 0 auto;
		padding: 0 24px;
	}

	/* ───────────── hero ───────────── */
	.hero {
		padding: 112px 0 96px;
	}
	@media (min-width: 720px) {
		.hero {
			padding: 144px 0 120px;
		}
	}
	.eyebrow {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 5px 12px;
		border: 1px solid var(--rule);
		border-radius: 999px;
		background: color-mix(in oklch, var(--card) 60%, transparent);
		font-family: var(--font-mono);
		font-size: 11px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted-foreground);
	}
	.eyebrow .dot {
		width: 6px;
		height: 6px;
		border-radius: 999px;
		background: var(--primary);
	}
	.hero h1 {
		margin: 28px 0 0;
		max-width: 22ch;
		font-size: clamp(38px, 5.6vw, 64px);
		line-height: 1.04;
		letter-spacing: -0.025em;
		font-weight: 500;
	}
	.lede {
		margin-top: 22px;
		max-width: 60ch;
		font-size: clamp(15px, 1.1vw, 17px);
		line-height: 1.55;
		color: var(--muted-foreground);
	}
	.cta-row {
		margin-top: 32px;
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}
	.btn-primary {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 10px 16px;
		border-radius: 8px;
		font-size: 13.5px;
		font-weight: 500;
		color: var(--primary-foreground);
		background: var(--primary);
		transition:
			background 180ms,
			transform 180ms;
	}
	.btn-primary:hover {
		transform: translateY(-1px);
	}
	.btn-ghost {
		display: inline-flex;
		align-items: center;
		padding: 10px 16px;
		border: 1px solid var(--rule);
		border-radius: 8px;
		background: var(--card);
		font-family: var(--font-mono);
		font-size: 12.5px;
		color: var(--foreground);
		transition:
			background 180ms,
			border-color 180ms;
	}
	.btn-ghost:hover {
		background: var(--secondary);
		border-color: color-mix(in oklch, var(--foreground) 18%, transparent);
	}

	/* ───────────── caps ───────────── */
	.caps {
		border-top: 1px solid var(--rule);
		padding: 64px 0;
	}
	.cap-grid {
		display: grid;
		gap: 1px;
		background: var(--rule);
		border: 1px solid var(--rule);
		border-radius: 12px;
		overflow: hidden;
	}
	@media (min-width: 820px) {
		.cap-grid {
			grid-template-columns: repeat(3, 1fr);
		}
	}
	.cap {
		padding: 28px 26px 32px;
		background: var(--card);
	}
	:global(.cap-icon) {
		width: 16px;
		height: 16px;
		color: var(--primary);
	}
	.cap h3 {
		margin: 18px 0 0;
		font-size: 15px;
		font-weight: 600;
		letter-spacing: -0.01em;
	}
	.cap p {
		margin: 8px 0 0;
		font-size: 14px;
		line-height: 1.55;
		color: var(--muted-foreground);
	}

	/* ───────────── split ───────────── */
	.split {
		display: grid;
		gap: 40px;
		align-items: start;
		border-top: 1px solid var(--rule);
		padding: 80px 0;
	}
	@media (min-width: 920px) {
		.split {
			grid-template-columns: 1fr 1.3fr;
			gap: 64px;
		}
		.split.reverse .split-copy {
			order: 2;
		}
		.split.reverse pre {
			order: 1;
		}
	}
	.kicker {
		font-family: var(--font-mono);
		font-size: 11px;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--muted-foreground);
		margin: 0;
	}
	.split-copy h2 {
		margin: 12px 0 0;
		font-size: clamp(22px, 2.4vw, 30px);
		line-height: 1.15;
		letter-spacing: -0.015em;
		font-weight: 500;
	}
	.split-copy p {
		margin: 16px 0 0;
		max-width: 48ch;
		font-size: 15px;
		line-height: 1.6;
		color: var(--muted-foreground);
	}
	.split-copy code {
		font-family: var(--font-mono);
		font-size: 0.88em;
		padding: 1px 5px;
		border-radius: 4px;
		color: var(--foreground);
		background: color-mix(in oklch, var(--foreground) 7%, transparent);
	}
	.split pre {
		margin: 0;
		padding: 22px;
		overflow-x: auto;
		border: 1px solid var(--rule);
		border-radius: 12px;
		background: var(--card);
		font-family: var(--font-mono);
		font-size: 12.5px;
		line-height: 1.65;
		color: color-mix(in oklch, var(--foreground) 92%, transparent);
	}

	/* ───────────── stats ───────────── */
	.stats {
		border-top: 1px solid var(--rule);
		padding: 64px 0 96px;
	}
	.stats dl {
		display: grid;
		gap: 1px;
		background: var(--rule);
		border: 1px solid var(--rule);
		border-radius: 12px;
		overflow: hidden;
	}
	@media (min-width: 720px) {
		.stats dl {
			grid-template-columns: repeat(4, 1fr);
		}
	}
	.stats dl > div {
		padding: 24px 22px 26px;
		background: var(--card);
	}
	.stats dt {
		font-family: var(--font-mono);
		font-size: 11px;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--muted-foreground);
	}
	.stats dd {
		margin: 10px 0 4px;
		font-size: 26px;
		font-weight: 600;
		letter-spacing: -0.015em;
	}
	.stats p {
		margin: 0;
		font-size: 12.5px;
		color: var(--muted-foreground);
	}

	/* ───────────── footer ───────────── */
	.foot {
		max-width: 1120px;
		margin: 0 auto;
		padding: 24px;
		border-top: 1px solid var(--rule);
		display: flex;
		flex-direction: column;
		gap: 12px;
		font-family: var(--font-mono);
		font-size: 11px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted-foreground);
	}
	.foot div {
		display: flex;
		gap: 20px;
	}
	.foot a {
		transition: color 180ms;
	}
	.foot a:hover {
		color: var(--foreground);
	}
	@media (min-width: 640px) {
		.foot {
			flex-direction: row;
			align-items: center;
			justify-content: space-between;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.nav,
		.nav-wrap,
		.nav-cta,
		.btn-primary {
			transition: none;
		}
	}
</style>
