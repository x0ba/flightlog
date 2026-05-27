<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { ArrowUpRight, Radio, Repeat, ShieldCheck, GitPullRequest } from '@lucide/svelte';

	let { data } = $props();
	let userId = $derived(data.userId);

	// Live "telemetry" clock for the cockpit feel
	let utc = $state('— —:—:—');
	let tick = $state(0);

	onMount(() => {
		const update = () => {
			const d = new Date();
			const hh = String(d.getUTCHours()).padStart(2, '0');
			const mm = String(d.getUTCMinutes()).padStart(2, '0');
			const ss = String(d.getUTCSeconds()).padStart(2, '0');
			utc = `${hh}:${mm}:${ss}Z`;
			tick = (tick + 1) % 1000;
		};
		update();
		const id = setInterval(update, 1000);
		return () => clearInterval(id);
	});

	// Sample log strip — gives the hero a "live trace" element
	const strip = [
		{ t: '00:00.142', kind: 'GOAL', text: 'book SFO → JFK, depart Fri AM, aisle seat' },
		{ t: '00:00.318', kind: 'PLAN', text: 'open united.com → search flights → filter' },
		{ t: '00:01.044', kind: 'TOOL', text: 'browser.click("Search")' },
		{ t: '00:01.612', kind: 'OBS ', text: 'modal: "Verify you are human"' },
		{ t: '00:01.910', kind: 'DEC ', text: 'request human approval — captcha' },
		{ t: '00:04.221', kind: 'TOOL', text: 'browser.click(flight #1207)' },
		{ t: '00:05.880', kind: 'EVAL', text: 'goal met · constraints ok · no repeats' },
		{ t: '00:05.881', kind: 'PASS', text: 'score 0.94 — above threshold 0.80' }
	];
</script>

<svelte:head>
	<title>FlightLog — the black box for AI agents</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div class="landing relative min-h-screen overflow-x-hidden bg-background text-foreground">
	<!-- Background atmosphere: grid + radial glow + scanlines -->
	<div class="pointer-events-none absolute inset-0 z-0">
		<div class="bg-grid absolute inset-0"></div>
		<div class="absolute inset-0 bg-radial"></div>
		<div class="bg-scan absolute inset-0 opacity-[0.04]"></div>
		<div
			class="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent"
		></div>
	</div>

	<!-- Top nav -->
	<header
		class="relative z-10 mx-auto flex max-w-[1280px] items-center justify-between px-6 py-5 sm:px-10"
	>
		<a href={resolve('/')} class="flex items-center gap-2.5">
			<div
				class="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 ring-1 ring-primary/30"
			>
				<svg
					width="14"
					height="14"
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
			<div class="leading-tight">
				<p class="text-[15px] font-semibold tracking-tight">FlightLog</p>
				<p class="font-mono text-[9px] tracking-[0.2em] text-muted-foreground/70 uppercase">
					FL · OBS / EVAL / REG
				</p>
			</div>
		</a>

		<nav class="hidden items-center gap-7 md:flex">
			<a
				href="#what"
				class="font-mono text-xs tracking-wider text-muted-foreground uppercase hover:text-foreground"
				>What it sees</a
			>
			<a
				href="#regression"
				class="font-mono text-xs tracking-wider text-muted-foreground uppercase hover:text-foreground"
				>Regression</a
			>
			<a
				href="#sdk"
				class="font-mono text-xs tracking-wider text-muted-foreground uppercase hover:text-foreground"
				>SDK</a
			>
		</nav>

		<div class="flex items-center gap-2">
			<div
				class="hidden items-center gap-2 rounded-md border border-border/60 bg-card/60 px-2.5 py-1.5 font-mono text-[10px] tracking-wider text-muted-foreground sm:flex"
			>
				<span class="relative flex h-1.5 w-1.5">
					<span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60"
					></span>
					<span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary"></span>
				</span>
				<span class="uppercase">UTC {utc}</span>
			</div>
			{#if userId}
				<a
					href={resolve('/runs')}
					class="group inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-1.5 font-mono text-xs font-medium tracking-wider text-primary-foreground uppercase shadow-[0_0_30px_-8px_var(--primary)] transition hover:brightness-110"
				>
					Dashboard
					<ArrowUpRight
						class="size-3.5 transition-transform group-hover:translate-x-px group-hover:-translate-y-px"
					/>
				</a>
			{:else}
				<a
					href={resolve('/sign-in')}
					class="rounded-md border border-border/60 bg-card/60 px-3 py-1.5 font-mono text-xs tracking-wider text-muted-foreground uppercase transition hover:bg-secondary hover:text-foreground"
				>
					Sign in
				</a>
				<a
					href={resolve('/sign-up')}
					class="group inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-1.5 font-mono text-xs font-medium tracking-wider text-primary-foreground uppercase shadow-[0_0_30px_-8px_var(--primary)] transition hover:brightness-110"
				>
					Get access
					<ArrowUpRight
						class="size-3.5 transition-transform group-hover:translate-x-px group-hover:-translate-y-px"
					/>
				</a>
			{/if}
		</div>
	</header>

	<!-- Hero -->
	<section class="relative z-10 mx-auto max-w-[1280px] px-6 pt-10 pb-24 sm:px-10 sm:pt-16 sm:pb-32">
		<!-- Tactical readout strip above headline -->
		<div
			class="mb-10 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[10px] tracking-[0.22em] text-muted-foreground/70 uppercase"
		>
			<span class="flex items-center gap-2">
				<span class="inline-block h-1 w-1 rounded-full bg-primary"></span>
				FL-001 · transmission open
			</span>
			<span class="hidden sm:inline">CH 11 / observability + eval + regression</span>
			<span class="ml-auto hidden sm:inline">v0.1 · open source · MIT</span>
		</div>

		<div class="grid items-start gap-12 lg:grid-cols-[1.15fr_1fr]">
			<!-- Headline -->
			<div>
				<h1 class="display text-[clamp(2.6rem,7vw,5.6rem)] leading-[0.95] tracking-tight">
					The <span class="italic-serif">black box</span><br />
					for browser <br />and AI <span class="italic-serif">agents.</span>
				</h1>
				<p class="mt-7 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
					FlightLog records every goal, plan, tool call and decision your agent makes — then replays
					the flight, scores it, and reports regressions back to GitHub on every PR. Built for teams
					shipping agents to production.
				</p>

				<div class="mt-8 flex flex-wrap items-center gap-3">
					{#if userId}
						<a
							href={resolve('/runs')}
							class="group inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 font-mono text-xs font-medium tracking-[0.18em] text-primary-foreground uppercase shadow-[0_0_40px_-10px_var(--primary)] transition hover:brightness-110"
						>
							Open dashboard
							<ArrowUpRight
								class="size-4 transition-transform group-hover:translate-x-px group-hover:-translate-y-px"
							/>
						</a>
					{:else}
						<a
							href={resolve('/sign-up')}
							class="group inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 font-mono text-xs font-medium tracking-[0.18em] text-primary-foreground uppercase shadow-[0_0_40px_-10px_var(--primary)] transition hover:brightness-110"
						>
							Start logging
							<ArrowUpRight
								class="size-4 transition-transform group-hover:translate-x-px group-hover:-translate-y-px"
							/>
						</a>
					{/if}
					<a
						href="https://github.com"
						class="inline-flex items-center gap-2 rounded-md border border-border/60 bg-card/40 px-5 py-3 font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase transition hover:bg-secondary hover:text-foreground"
					>
						Read the source
					</a>
				</div>

				<!-- Three-metric instrument cluster -->
				<div
					class="mt-12 grid max-w-md grid-cols-3 gap-px overflow-hidden rounded-md border border-border/60 bg-border/60"
				>
					<div class="bg-card/70 px-4 py-3">
						<p class="font-mono text-[9px] tracking-[0.2em] text-muted-foreground/70 uppercase">
							Runs
						</p>
						<p class="display mt-1 text-2xl leading-none">12,408</p>
					</div>
					<div class="bg-card/70 px-4 py-3">
						<p class="font-mono text-[9px] tracking-[0.2em] text-muted-foreground/70 uppercase">
							Pass rate
						</p>
						<p class="display mt-1 text-2xl leading-none text-[var(--status-success)]">
							94.2<span class="text-base">%</span>
						</p>
					</div>
					<div class="bg-card/70 px-4 py-3">
						<p class="font-mono text-[9px] tracking-[0.2em] text-muted-foreground/70 uppercase">
							Mean dur.
						</p>
						<p class="display mt-1 text-2xl leading-none">8.3<span class="text-base">s</span></p>
					</div>
				</div>
			</div>

			<!-- Right: live flight-strip / boarding-pass visual -->
			<div class="relative">
				<div
					class="relative overflow-hidden rounded-lg border border-border/70 bg-card/70 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)] backdrop-blur"
				>
					<!-- Strip header -->
					<div
						class="flex items-center justify-between border-b border-border/60 bg-background/40 px-4 py-2.5"
					>
						<div
							class="flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase"
						>
							<span class="relative flex h-1.5 w-1.5">
								<span
									class="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--status-success)]/60"
								></span>
								<span
									class="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--status-success)]"
								></span>
							</span>
							Run · ag_7c1e
						</div>
						<div class="font-mono text-[10px] tracking-wider text-muted-foreground">
							PASS · 0.94
						</div>
					</div>

					<!-- Boarding-pass style metadata -->
					<div class="grid grid-cols-3 border-b border-dashed border-border/60 bg-background/20">
						<div class="px-4 py-3">
							<p class="font-mono text-[9px] tracking-[0.2em] text-muted-foreground/70 uppercase">
								Agent
							</p>
							<p class="display mt-1 text-xl leading-none">BRWSR-01</p>
						</div>
						<div class="border-x border-dashed border-border/60 px-4 py-3">
							<p class="font-mono text-[9px] tracking-[0.2em] text-muted-foreground/70 uppercase">
								Suite
							</p>
							<p class="display mt-1 text-xl leading-none">checkout</p>
						</div>
						<div class="px-4 py-3">
							<p class="font-mono text-[9px] tracking-[0.2em] text-muted-foreground/70 uppercase">
								PR
							</p>
							<p class="display mt-1 text-xl leading-none">#412</p>
						</div>
					</div>

					<!-- Trace strip -->
					<ol class="divide-y divide-border/40">
						{#each strip as row, i (i)}
							<li
								class="grid grid-cols-[auto_auto_1fr] items-center gap-3 px-4 py-2 font-mono text-[11px]"
								style="animation: stripIn 600ms {i * 90}ms both ease-out"
							>
								<span class="text-muted-foreground/60">{row.t}</span>
								<span
									class="rounded px-1.5 py-0.5 text-[9px] tracking-[0.15em] uppercase {row.kind ===
									'PASS'
										? 'bg-[var(--status-success)]/15 text-[var(--status-success)]'
										: row.kind === 'GOAL'
											? 'bg-primary/15 text-primary'
											: row.kind === 'EVAL'
												? 'bg-primary/10 text-primary/80'
												: 'bg-secondary text-muted-foreground'}"
								>
									{row.kind.trim()}
								</span>
								<span class="truncate text-foreground/85">{row.text}</span>
							</li>
						{/each}
					</ol>

					<div
						class="flex items-center justify-between border-t border-border/60 bg-background/40 px-4 py-2.5 font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase"
					>
						<span>replayable · 8 steps</span>
						<span class="flex items-center gap-1.5 text-foreground/80">
							<span class="h-1 w-6 bg-primary"></span>
							<span class="h-1 w-1 bg-primary/60"></span>
							<span class="h-1 w-1 bg-primary/40"></span>
						</span>
					</div>
				</div>

				<!-- Floating corner ticks -->
				<div
					class="pointer-events-none absolute -top-2 -right-2 font-mono text-[9px] tracking-[0.2em] text-muted-foreground/60 uppercase"
				>
					FL · 001
				</div>
				<div
					class="pointer-events-none absolute -bottom-2 -left-2 font-mono text-[9px] tracking-[0.2em] text-muted-foreground/60 uppercase"
				>
					{utc}
				</div>
			</div>
		</div>
	</section>

	<!-- WHAT IT SEES -->
	<section id="what" class="relative z-10 border-y border-border/40 bg-background/40">
		<div class="mx-auto max-w-[1280px] px-6 py-20 sm:px-10 sm:py-28">
			<div class="flex items-end justify-between gap-6 border-b border-border/40 pb-6">
				<div>
					<p class="font-mono text-[10px] tracking-[0.25em] text-muted-foreground/70 uppercase">
						§ 01 · observability
					</p>
					<h2 class="display mt-3 text-3xl leading-[1] tracking-tight sm:text-5xl">
						Everything the agent <span class="italic-serif">said,</span><br />
						saw, and <span class="italic-serif">decided.</span>
					</h2>
				</div>
				<p class="hidden max-w-xs text-sm leading-relaxed text-muted-foreground md:block">
					A drop-in SDK that captures the full flight record — replayable like a DVR, queryable like
					a log, scored like a test.
				</p>
			</div>

			<div
				class="mt-10 grid gap-px overflow-hidden rounded-lg border border-border/40 bg-border/40 sm:grid-cols-2 lg:grid-cols-4"
			>
				{#each [{ k: 'GOAL', t: 'Goal & plan', d: "The intent in the agent's own words, plus its plan tree." }, { k: 'TOOL', t: 'Tool & browser', d: 'Every click, type, fetch and shell call — with args.' }, { k: 'OBS ', t: 'Observation', d: 'DOM snapshots, screenshots and tool responses, time-aligned.' }, { k: 'DEC ', t: 'Decision', d: "The model's reasoning summary at each branching point." }] as f (f.k)}
					<div class="group relative bg-card/60 p-6 transition hover:bg-card">
						<div class="flex items-center justify-between">
							<span
								class="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] tracking-[0.18em] text-primary uppercase"
								>{f.k.trim()}</span
							>
							<span
								class="font-mono text-[9px] tracking-[0.18em] text-muted-foreground/50 uppercase"
								>FL · {f.k.trim().padEnd(4, '·')}</span
							>
						</div>
						<h3 class="display mt-6 text-xl leading-tight">{f.t}</h3>
						<p class="mt-2 text-sm leading-relaxed text-muted-foreground">{f.d}</p>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- EVAL + REGRESSION -->
	<section id="regression" class="relative z-10">
		<div class="mx-auto grid max-w-[1280px] gap-16 px-6 py-20 sm:px-10 sm:py-28 lg:grid-cols-2">
			<div>
				<p class="font-mono text-[10px] tracking-[0.25em] text-muted-foreground/70 uppercase">
					§ 02 · evaluation
				</p>
				<h2 class="display mt-3 text-3xl leading-[1] tracking-tight sm:text-5xl">
					Did it <span class="italic-serif">actually</span><br />get the job done?
				</h2>
				<ul class="mt-8 space-y-4">
					{#each [{ icon: ShieldCheck, t: 'Goal completion', d: "Was the user's task actually accomplished — or just *almost*." }, { icon: ShieldCheck, t: 'Constraint violations', d: "Did it touch what it shouldn't, or skip what it must." }, { icon: Repeat, t: 'Repetition & loops', d: 'Catch the agent stuck retrying the same broken click.' }, { icon: Radio, t: 'Human-in-loop handoffs', d: 'Track every time approval was needed and why.' }] as it, i (i)}
						<li
							class="flex items-start gap-4 border-l-2 border-border/60 pl-4 transition hover:border-primary"
						>
							<it.icon class="mt-1 size-4 text-primary/80" />
							<div>
								<p class="text-sm font-medium tracking-tight">{it.t}</p>
								<p class="mt-1 text-sm text-muted-foreground">{it.d}</p>
							</div>
						</li>
					{/each}
				</ul>
			</div>

			<div>
				<p class="font-mono text-[10px] tracking-[0.25em] text-muted-foreground/70 uppercase">
					§ 03 · regression
				</p>
				<h2 class="display mt-3 text-3xl leading-[1] tracking-tight sm:text-5xl">
					CI for agents,<br />on <span class="italic-serif">every</span> PR.
				</h2>
				<p class="mt-6 max-w-md text-sm leading-relaxed text-muted-foreground">
					Wire a regression suite to a GitHub repo. On every pull request, FlightLog runs your
					goal-based cases, scores them against your thresholds, and posts a GitHub Check with links
					straight back to the failing replay.
				</p>

				<!-- Mock GitHub check card -->
				<div
					class="mt-8 overflow-hidden rounded-md border border-border/60 bg-card/70 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.8)]"
				>
					<div
						class="flex items-center gap-2 border-b border-border/60 bg-background/40 px-4 py-2.5 font-mono text-[10px] tracking-wider text-muted-foreground uppercase"
					>
						<GitPullRequest class="size-3.5 text-[var(--status-success)]" />
						<span class="text-foreground">checks · pr #412</span>
						<span class="ml-auto text-[var(--status-success)]">all passed</span>
					</div>
					{#each [{ name: 'checkout · happy path', score: '0.96', state: 'pass' }, { name: 'checkout · captcha fallback', score: '0.88', state: 'pass' }, { name: 'login · oauth google', score: '0.74', state: 'fail' }, { name: 'search · filter + sort', score: '0.91', state: 'pass' }] as row, i (i)}
						<div
							class="flex items-center justify-between border-b border-border/40 px-4 py-2.5 font-mono text-[11px] last:border-0"
						>
							<div class="flex items-center gap-3">
								<span
									class="h-1.5 w-1.5 rounded-full {row.state === 'pass'
										? 'bg-[var(--status-success)]'
										: 'bg-[var(--status-failed)]'}"
								></span>
								<span class="text-foreground/90">{row.name}</span>
							</div>
							<div class="flex items-center gap-3 text-muted-foreground">
								<span>{row.score}</span>
								<span class="text-foreground/50">›</span>
							</div>
						</div>
					{/each}
				</div>
			</div>
		</div>
	</section>

	<!-- SDK / CODE -->
	<section id="sdk" class="relative z-10 border-y border-border/40 bg-background/40">
		<div
			class="mx-auto grid max-w-[1280px] gap-12 px-6 py-20 sm:px-10 sm:py-28 lg:grid-cols-[1fr_1.2fr] lg:items-center"
		>
			<div>
				<p class="font-mono text-[10px] tracking-[0.25em] text-muted-foreground/70 uppercase">
					§ 04 · sdk
				</p>
				<h2 class="display mt-3 text-3xl leading-[1] tracking-tight sm:text-5xl">
					Four lines to <span class="italic-serif">strap in.</span>
				</h2>
				<p class="mt-6 max-w-md text-sm leading-relaxed text-muted-foreground">
					Wrap your agent loop. We capture the goal, the actions, and the reasoning. No proprietary
					runtime — bring your own framework.
				</p>
			</div>
			<div
				class="relative overflow-hidden rounded-md border border-border/60 bg-card/80 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)]"
			>
				<div
					class="flex items-center justify-between border-b border-border/60 bg-background/40 px-4 py-2 font-mono text-[10px] tracking-wider text-muted-foreground uppercase"
				>
					<span>agent.ts</span>
					<span class="flex items-center gap-1.5">
						<span class="h-2 w-2 rounded-full bg-[var(--status-failed)]/70"></span>
						<span class="h-2 w-2 rounded-full bg-primary/70"></span>
						<span class="h-2 w-2 rounded-full bg-[var(--status-success)]/70"></span>
					</span>
				</div>
				<pre class="overflow-x-auto px-5 py-5 font-mono text-[12.5px] leading-[1.7]"><code
						><span class="text-muted-foreground/70">// observe an entire agent run</span>
<span class="text-primary">import</span> &#123; flightlog &#125; <span class="text-primary"
							>from</span
						> <span class="text-[var(--status-success)]">'@flightlog/sdk'</span>;

<span class="text-primary">const</span> run <span class="text-muted-foreground">=</span
						> flightlog.start(&#123;
  goal: <span class="text-[var(--status-success)]">'book SFO→JFK aisle seat'</span>,
  agent: <span class="text-[var(--status-success)]">'brwsr-01'</span>
&#125;);

<span class="text-primary">await</span> agent.runWith(run.trace);
<span class="text-primary">await</span> run.finish();</code
					></pre>
			</div>
		</div>
	</section>

	<!-- CTA / footer -->
	<section class="relative z-10 mx-auto max-w-[1280px] px-6 py-24 sm:px-10 sm:py-32">
		<div class="grid items-center gap-10 lg:grid-cols-[1.4fr_1fr]">
			<h2 class="display text-4xl leading-[0.95] tracking-tight sm:text-6xl">
				Stop shipping <span class="italic-serif">blind.</span><br />
				Start flying with a <span class="italic-serif">black box.</span>
			</h2>
			<div class="flex flex-col items-start gap-4">
				{#if userId}
					<a
						href={resolve('/runs')}
						class="group inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3.5 font-mono text-xs font-medium tracking-[0.2em] text-primary-foreground uppercase shadow-[0_0_50px_-12px_var(--primary)] transition hover:brightness-110"
					>
						Open dashboard
						<ArrowUpRight class="size-4" />
					</a>
				{:else}
					<a
						href={resolve('/sign-up')}
						class="group inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3.5 font-mono text-xs font-medium tracking-[0.2em] text-primary-foreground uppercase shadow-[0_0_50px_-12px_var(--primary)] transition hover:brightness-110"
					>
						Get access
						<ArrowUpRight class="size-4" />
					</a>
				{/if}
				<p class="font-mono text-[10px] tracking-[0.22em] text-muted-foreground/70 uppercase">
					Free for OSS · self-host friendly
				</p>
			</div>
		</div>
	</section>

	<footer class="relative z-10 border-t border-border/40">
		<div
			class="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-3 px-6 py-6 font-mono text-[10px] tracking-[0.2em] text-muted-foreground/70 uppercase sm:px-10"
		>
			<span>FlightLog © 2026 · transmission ends</span>
			<span class="flex items-center gap-4">
				<span>FL · 001</span>
				<span>UTC {utc}</span>
				<span class="hidden sm:inline">— end of strip —</span>
			</span>
		</div>
	</footer>
</div>

<style>
	.display {
		font-family: 'Geist', ui-sans-serif, system-ui, sans-serif;
		font-weight: 500;
		letter-spacing: -0.025em;
	}
	.italic-serif {
		font-family: 'Instrument Serif', 'Times New Roman', serif;
		font-style: italic;
		font-weight: 400;
		letter-spacing: -0.01em;
	}

	.bg-grid {
		background-image:
			linear-gradient(to right, oklch(0.24 0.005 285 / 0.35) 1px, transparent 1px),
			linear-gradient(to bottom, oklch(0.24 0.005 285 / 0.35) 1px, transparent 1px);
		background-size: 56px 56px;
		mask-image: radial-gradient(ellipse 80% 60% at 50% 0%, black, transparent 75%);
		-webkit-mask-image: radial-gradient(ellipse 80% 60% at 50% 0%, black, transparent 75%);
	}
	.bg-radial {
		background:
			radial-gradient(circle at 80% 0%, oklch(0.78 0.12 75 / 0.18), transparent 45%),
			radial-gradient(circle at 10% 10%, oklch(0.78 0.12 75 / 0.08), transparent 50%);
	}
	.bg-scan {
		background-image: repeating-linear-gradient(
			to bottom,
			oklch(0.93 0.005 80 / 0.5) 0px,
			oklch(0.93 0.005 80 / 0.5) 1px,
			transparent 1px,
			transparent 3px
		);
	}

	@keyframes stripIn {
		from {
			opacity: 0;
			transform: translateY(4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	:global(.landing) ::selection {
		background: oklch(0.78 0.12 75 / 0.3);
	}
</style>
