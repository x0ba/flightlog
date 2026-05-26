<script lang="ts">
	import EventTimeline from '$lib/components/flightlog/event-timeline.svelte';
	import ReplayPanel from '$lib/components/flightlog/replay-panel.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import * as Tabs from '$lib/components/ui/tabs';
	import * as Collapsible from '$lib/components/ui/collapsible';
	import { Check, X, ChevronDown, LoaderCircle } from '@lucide/svelte';
	import { resolve } from '$app/paths';

	let { data } = $props();
	const initialData = readInitialData();
	let run = $state(initialData.run);
	let spans = $state([...initialData.spans]);
	let events = $state([...initialData.events]);
	let artifacts = $state([...initialData.artifacts]);
	let evaluation = $state(initialData.evaluation);
	let findings = $state([...initialData.findings]);
	let selectedSequence = $state(0);
	let userSelectedEvent = $state(false);
	let connectionState = $state<'idle' | 'live' | 'reconnecting' | 'complete' | 'failed'>('idle');
	let pendingApproval = $state<PendingApproval | undefined>(
		readPendingApproval(initialData.run.metadata)
	);
	let approvalSubmitting = $state(false);
	let evaluating = $state(false);
	let infoOpen = $state(true);
	let configOpen = $state(true);
	let timingOpen = $state(false);
	let traceOpen = $state(true);

	$effect(() => {
		if (selectedSequence === 0) selectedSequence = events[0]?.sequence ?? 0;
	});

	$effect(() => {
		if (!userSelectedEvent && run.status === 'running') {
			selectedSequence = events.at(-1)?.sequence ?? selectedSequence;
		}
	});

	$effect(() => {
		if (run.status !== 'running') {
			connectionState = 'complete';
			return;
		}
		const source = new EventSource(resolve(`/api/runs/${run.publicId}/stream`));
		connectionState = 'live';

		source.addEventListener('snapshot', (event) => {
			const snapshot = parseEventData<{
				run: typeof initialData.run;
				events: typeof initialData.events;
				spans: typeof initialData.spans;
				artifacts: typeof initialData.artifacts;
				evaluation: typeof initialData.evaluation;
				findings: typeof initialData.findings;
			}>(event);
			if (!snapshot) return;
			run = snapshot.run;
			spans = snapshot.spans;
			events = snapshot.events;
			artifacts = snapshot.artifacts;
			evaluation = snapshot.evaluation;
			findings = snapshot.findings;
			pendingApproval = readPendingApproval(snapshot.run.metadata);
		});
		source.addEventListener('run', (event) => {
			const nextRun = parseEventData<typeof initialData.run>(event);
			if (!nextRun) return;
			run = nextRun;
			pendingApproval = readPendingApproval(nextRun.metadata);
		});
		source.addEventListener('event', (event) => {
			const nextEvent = parseEventData<(typeof initialData.events)[number]>(event);
			if (!nextEvent) return;
			events = mergeByPublicId(events, nextEvent).sort((a, b) => a.sequence - b.sequence);
		});
		source.addEventListener('span', (event) => {
			const nextSpan = parseEventData<(typeof initialData.spans)[number]>(event);
			if (!nextSpan) return;
			spans = mergeByPublicId(spans, nextSpan);
		});
		source.addEventListener('artifact', (event) => {
			const artifact = parseEventData<(typeof initialData.artifacts)[number]>(event);
			if (!artifact) return;
			artifacts = mergeByPublicId(artifacts, artifact);
		});
		source.addEventListener('approval_required', (event) => {
			const approval = parseEventData<PendingApproval>(event);
			if (approval) pendingApproval = approval;
		});
		source.addEventListener('done', (event) => {
			const payload = parseEventData<{ run: typeof initialData.run }>(event);
			if (payload) run = payload.run;
			connectionState = 'complete';
			source.close();
		});
		source.addEventListener('error', () => {
			connectionState = source.readyState === EventSource.CLOSED ? 'failed' : 'reconnecting';
		});

		return () => source.close();
	});

	let artifactsByEvent = $derived(
		Object.fromEntries(
			events.map((event) => [
				event.sequence,
				artifacts.filter((artifact) => artifact.eventSequence === event.sequence)
			])
		)
	);
	let selectedEvent = $derived(
		events.find((event) => event.sequence === selectedSequence) ?? events[0]
	);
	let selectedSpan = $derived(
		selectedEvent?.spanId ? spans.find((span) => span.id === selectedEvent.spanId) : undefined
	);
	let traceCounts = $derived({
		modelCalls: spans.filter((span) => span.kind === 'model_call').length,
		toolCalls: spans.filter((span) => span.kind === 'tool_call').length,
		browserActions:
			spans.filter((span) => span.kind === 'browser_action').length ||
			events.filter((event) => event.type === 'browser_action').length,
		approvals:
			spans.filter((span) => span.kind === 'approval').length ||
			events.filter(
				(event) => event.type === 'human_approval' || event.type.startsWith('approval.')
			).length
	});
	let agentMetadata = $derived(readAgentMetadata(run.metadata));

	async function evaluateRun() {
		if (evaluating) return;
		evaluating = true;
		try {
			await fetch(`/api/runs/${run.publicId}/evaluate`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ constraints: [] })
			});
			location.reload();
		} finally {
			evaluating = false;
		}
	}

	function formatDate(value: string | Date | null) {
		if (!value) return 'Open';
		return new Intl.DateTimeFormat('en', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		}).format(new Date(value));
	}

	function selectEvent(sequence: number) {
		userSelectedEvent = true;
		selectedSequence = sequence;
	}

	async function submitApproval(decision: 'approved' | 'rejected') {
		if (!pendingApproval) return;
		approvalSubmitting = true;
		try {
			await fetch(`/api/runs/${run.publicId}/approvals`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ approvalId: pendingApproval.id, decision })
			});
			pendingApproval = undefined;
		} finally {
			approvalSubmitting = false;
		}
	}

	function parseEventData<T>(event: Event) {
		if (!(event instanceof MessageEvent) || typeof event.data !== 'string') return undefined;
		try {
			return JSON.parse(event.data) as T;
		} catch {
			return undefined;
		}
	}

	function mergeByPublicId<T extends { publicId: string }>(items: T[], item: T) {
		if (items.some((existing) => existing.publicId === item.publicId)) {
			return items.map((existing) => (existing.publicId === item.publicId ? item : existing));
		}
		return [...items, item];
	}

	type PendingApproval = {
		id: string;
		callId: string;
		safetyChecks: Array<{ id: string; code: string; message: string }>;
		action: unknown;
		screenshotArtifactId?: string;
		createdAt: string;
	};

	type Metadata = {
		agentRequest?: {
			pendingApproval?: PendingApproval;
			provider?: string;
			model?: string;
			framework?: string;
			runMode?: string;
		};
	};

	function readPendingApproval(metadata: unknown) {
		if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return undefined;
		return (metadata as Metadata).agentRequest?.pendingApproval;
	}

	function readAgentMetadata(metadata: unknown) {
		if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {};
		return (metadata as Metadata).agentRequest ?? {};
	}

	function approvalScreenshot() {
		if (!pendingApproval?.screenshotArtifactId) return undefined;
		return artifacts.find(
			(artifact) => artifact.publicId === pendingApproval?.screenshotArtifactId
		);
	}

	function displayJson(value: unknown) {
		return JSON.stringify(value, null, 2);
	}

	function readInitialData() {
		return data;
	}
</script>

<svelte:head><title>{run.name ?? 'Run'} | FlightLog</title></svelte:head>

<main class="min-h-screen bg-background">
	<div class="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
		<header class="flex items-center justify-between gap-4">
			<div class="flex min-w-0 items-center gap-3">
				<a
					class="font-mono text-xs text-muted-foreground transition-colors hover:text-primary"
					href={resolve('/runs')}>← runs</a
				>
				<Separator orientation="vertical" class="!h-4" />
				<h1 class="truncate text-sm font-semibold">{run.name ?? 'Untitled run'}</h1>
			</div>
			<div class="flex items-center gap-3">
				<span class="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
					<span
						class="inline-block size-1.5 rounded-full"
						class:bg-status-success={connectionState === 'live'}
						class:bg-status-running={connectionState === 'reconnecting'}
						class:bg-muted-foreground={connectionState === 'idle' || connectionState === 'complete'}
						class:bg-status-failed={connectionState === 'failed'}
					></span>
					{connectionState}
				</span>
				<span class="inline-flex items-center gap-1.5 font-mono text-xs">
					<span
						class="inline-block size-1.5 rounded-full"
						class:bg-status-running={run.status === 'running'}
						class:bg-status-success={run.status === 'success'}
						class:bg-status-failed={run.status === 'failed'}
						class:bg-status-cancelled={run.status === 'cancelled'}
					></span>
					{run.status}
				</span>
			</div>
		</header>

		<div class="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)_360px]">
			<!-- Left sidebar -->
			<aside class="flex flex-col gap-3">
				<!-- Run Info -->
				<Collapsible.Root bind:open={infoOpen}>
					<div class="overflow-hidden rounded-lg border border-border bg-card">
						<Collapsible.Trigger
							class="flex w-full cursor-pointer items-center gap-2 px-3 py-2 transition-colors hover:bg-secondary/30"
						>
							<span class="font-mono text-[10px] font-medium tracking-wider uppercase"
								>Run Info</span
							>
							<ChevronDown
								class="ml-auto size-3 text-muted-foreground transition-transform duration-200 {infoOpen
									? 'rotate-180'
									: ''}"
							/>
						</Collapsible.Trigger>
						<Collapsible.Content>
							<div class="flex flex-col gap-px border-t border-border bg-border/50">
								<div class="bg-card px-3 py-2.5">
									<p
										class="font-mono text-[10px] tracking-wider text-muted-foreground/70 uppercase"
									>
										Trace ID
									</p>
									<p class="font-mono text-xs text-foreground">{run.publicId}</p>
								</div>
								<div class="bg-card px-3 py-2.5">
									<p
										class="font-mono text-[10px] tracking-wider text-muted-foreground/70 uppercase"
									>
										Schema
									</p>
									<p class="font-mono text-xs text-foreground">{run.schemaVersion}</p>
								</div>
								<div class="bg-card px-3 py-2.5">
									<p
										class="font-mono text-[10px] tracking-wider text-muted-foreground/70 uppercase"
									>
										Goal
									</p>
									<p class="text-sm leading-snug text-foreground">{run.goal}</p>
								</div>
								<div class="bg-card px-3 py-2.5">
									<p
										class="font-mono text-[10px] tracking-wider text-muted-foreground/70 uppercase"
									>
										Agent
									</p>
									<p class="text-sm text-foreground">
										{run.agentName ?? 'Unknown'}
										{run.agentVersion ?? ''}
									</p>
								</div>
								<div class="bg-card px-3 py-2.5">
									<p
										class="font-mono text-[10px] tracking-wider text-muted-foreground/70 uppercase"
									>
										Environment
									</p>
									<p class="text-sm text-foreground">{run.environment ?? 'Unspecified'}</p>
								</div>
							</div>
						</Collapsible.Content>
					</div>
				</Collapsible.Root>

				<!-- Configuration -->
				<Collapsible.Root bind:open={configOpen}>
					<div class="overflow-hidden rounded-lg border border-border bg-card">
						<Collapsible.Trigger
							class="flex w-full cursor-pointer items-center gap-2 px-3 py-2 transition-colors hover:bg-secondary/30"
						>
							<span class="font-mono text-[10px] font-medium tracking-wider uppercase"
								>Configuration</span
							>
							<ChevronDown
								class="ml-auto size-3 text-muted-foreground transition-transform duration-200 {configOpen
									? 'rotate-180'
									: ''}"
							/>
						</Collapsible.Trigger>
						<Collapsible.Content>
							<div class="grid grid-cols-2 gap-px border-t border-border bg-border/50">
								<div class="bg-card px-3 py-2.5">
									<p
										class="font-mono text-[10px] tracking-wider text-muted-foreground/70 uppercase"
									>
										Provider
									</p>
									<p class="font-mono text-xs text-foreground">
										{agentMetadata.provider ?? 'unknown'}
									</p>
								</div>
								<div class="bg-card px-3 py-2.5">
									<p
										class="font-mono text-[10px] tracking-wider text-muted-foreground/70 uppercase"
									>
										Model
									</p>
									<p class="truncate font-mono text-xs text-foreground">
										{agentMetadata.model ?? run.agentVersion ?? 'unknown'}
									</p>
								</div>
								<div class="bg-card px-3 py-2.5">
									<p
										class="font-mono text-[10px] tracking-wider text-muted-foreground/70 uppercase"
									>
										Framework
									</p>
									<p class="font-mono text-xs text-foreground">
										{agentMetadata.framework ?? 'custom'}
									</p>
								</div>
								<div class="bg-card px-3 py-2.5">
									<p
										class="font-mono text-[10px] tracking-wider text-muted-foreground/70 uppercase"
									>
										Mode
									</p>
									<p class="font-mono text-xs text-foreground">
										{agentMetadata.runMode ?? 'external'}
									</p>
								</div>
							</div>
						</Collapsible.Content>
					</div>
				</Collapsible.Root>

				<!-- Timing -->
				<Collapsible.Root bind:open={timingOpen}>
					<div class="overflow-hidden rounded-lg border border-border bg-card">
						<Collapsible.Trigger
							class="flex w-full cursor-pointer items-center gap-2 px-3 py-2 transition-colors hover:bg-secondary/30"
						>
							<span class="font-mono text-[10px] font-medium tracking-wider uppercase">Timing</span>
							<ChevronDown
								class="ml-auto size-3 text-muted-foreground transition-transform duration-200 {timingOpen
									? 'rotate-180'
									: ''}"
							/>
						</Collapsible.Trigger>
						<Collapsible.Content>
							<div class="grid grid-cols-2 gap-px border-t border-border bg-border/50">
								<div class="bg-card px-3 py-2.5">
									<p
										class="font-mono text-[10px] tracking-wider text-muted-foreground/70 uppercase"
									>
										Started
									</p>
									<p class="font-mono text-xs text-foreground">{formatDate(run.startedAt)}</p>
								</div>
								<div class="bg-card px-3 py-2.5">
									<p
										class="font-mono text-[10px] tracking-wider text-muted-foreground/70 uppercase"
									>
										Ended
									</p>
									<p class="font-mono text-xs text-foreground">{formatDate(run.endedAt)}</p>
								</div>
							</div>
						</Collapsible.Content>
					</div>
				</Collapsible.Root>

				<!-- Trace Summary -->
				<Collapsible.Root bind:open={traceOpen}>
					<div class="overflow-hidden rounded-lg border border-border bg-card">
						<Collapsible.Trigger
							class="flex w-full cursor-pointer items-center gap-2 px-3 py-2 transition-colors hover:bg-secondary/30"
						>
							<span class="font-mono text-[10px] font-medium tracking-wider uppercase"
								>Trace Summary</span
							>
							<ChevronDown
								class="ml-auto size-3 text-muted-foreground transition-transform duration-200 {traceOpen
									? 'rotate-180'
									: ''}"
							/>
						</Collapsible.Trigger>
						<Collapsible.Content>
							<div class="grid grid-cols-2 gap-px border-t border-border bg-border/50">
								<div class="bg-card px-3 py-2.5">
									<p
										class="font-mono text-[10px] tracking-wider text-muted-foreground/70 uppercase"
									>
										Model
									</p>
									<p class="font-mono text-xs text-foreground">{traceCounts.modelCalls}</p>
								</div>
								<div class="bg-card px-3 py-2.5">
									<p
										class="font-mono text-[10px] tracking-wider text-muted-foreground/70 uppercase"
									>
										Tools
									</p>
									<p class="font-mono text-xs text-foreground">{traceCounts.toolCalls}</p>
								</div>
								<div class="bg-card px-3 py-2.5">
									<p
										class="font-mono text-[10px] tracking-wider text-muted-foreground/70 uppercase"
									>
										Browser
									</p>
									<p class="font-mono text-xs text-foreground">{traceCounts.browserActions}</p>
								</div>
								<div class="bg-card px-3 py-2.5">
									<p
										class="font-mono text-[10px] tracking-wider text-muted-foreground/70 uppercase"
									>
										Approvals
									</p>
									<p class="font-mono text-xs text-foreground">{traceCounts.approvals}</p>
								</div>
							</div>
						</Collapsible.Content>
					</div>
				</Collapsible.Root>

				<Button
					class="w-full gap-2 font-mono text-xs"
					variant="outline"
					type="button"
					disabled={evaluating}
					aria-busy={evaluating}
					onclick={evaluateRun}
				>
					{#if evaluating}
						<LoaderCircle class="size-3.5 animate-spin" />
						Evaluating
					{:else}
						Evaluate
					{/if}
				</Button>
			</aside>

			{#if pendingApproval}
				<!-- Approval card overlays before the timeline on small screens -->
				<div
					class="overflow-hidden rounded-lg border border-status-running bg-card lg:col-start-1 lg:row-start-2"
				>
					<div class="flex items-center gap-2 border-b border-border px-4 py-2">
						<span class="inline-block size-1.5 animate-pulse rounded-full bg-status-running"></span>
						<span class="font-mono text-xs font-medium">Approval Required</span>
					</div>
					<div class="flex flex-col gap-3 p-4 text-sm">
						{#if approvalScreenshot()}
							<img
								class="max-h-48 w-full rounded-md border border-border object-contain"
								src={approvalScreenshot()?.content ?? approvalScreenshot()?.url ?? ''}
								alt="Approval screenshot"
							/>
						{/if}
						{#if pendingApproval.safetyChecks.length}
							<div class="space-y-2">
								{#each pendingApproval.safetyChecks as check (check.id)}
									<div class="rounded-md border border-border bg-background p-2">
										<p class="font-mono text-xs font-medium">{check.code}</p>
										<p class="text-xs text-muted-foreground">{check.message}</p>
									</div>
								{/each}
							</div>
						{/if}
						<pre
							class="max-h-40 overflow-auto rounded-md border border-border bg-background p-2 font-mono text-xs">{displayJson(
								pendingApproval.action
							)}</pre>
						<div class="grid grid-cols-2 gap-2">
							<Button
								type="button"
								class="gap-2 font-mono text-xs"
								disabled={approvalSubmitting}
								onclick={() => submitApproval('approved')}
							>
								<Check class="size-3.5" />
								Approve
							</Button>
							<Button
								type="button"
								variant="outline"
								class="gap-2 font-mono text-xs"
								disabled={approvalSubmitting}
								onclick={() => submitApproval('rejected')}
							>
								<X class="size-3.5" />
								Reject
							</Button>
						</div>
					</div>
				</div>
			{/if}

			<!-- Center: Timeline -->
			<section class="min-w-0">
				<div class="overflow-hidden rounded-lg border border-border bg-card">
					<div class="flex items-center justify-between border-b border-border px-4 py-2.5">
						<span class="font-mono text-xs font-medium">Timeline</span>
						<span class="font-mono text-xs text-muted-foreground"
							>{events.length} event{events.length === 1 ? '' : 's'} · {spans.length} span{spans.length ===
							1
								? ''
								: 's'}</span
						>
					</div>
					<div class="p-4">
						{#if events.length}
							<EventTimeline
								{events}
								{artifactsByEvent}
								{selectedSequence}
								onSelect={selectEvent}
							/>
						{:else}
							<p class="py-10 text-center font-mono text-xs text-muted-foreground">
								No events logged for this run.
							</p>
						{/if}
					</div>
				</div>
			</section>

			<!-- Right sidebar -->
			<aside class="flex min-w-0 flex-col gap-3">
				<!-- Replay -->
				<div class="overflow-hidden rounded-lg border border-border bg-card">
					<div class="border-b border-border px-4 py-2.5">
						<span class="font-mono text-xs font-medium">Replay</span>
					</div>
					<div class="p-4">
						<ReplayPanel {events} {artifacts} {selectedSequence} onSelect={selectEvent} />
					</div>
				</div>

				<!-- Inspector -->
				<div class="overflow-hidden rounded-lg border border-border bg-card">
					<div class="flex items-center justify-between border-b border-border px-4 py-2.5">
						<span class="font-mono text-xs font-medium">Inspector</span>
						<span class="font-mono text-[10px] text-muted-foreground"
							>{selectedSpan?.kind ?? selectedEvent?.type ?? 'empty'}</span
						>
					</div>
					<div class="space-y-3 p-4 text-sm">
						{#if selectedSpan}
							<div
								class="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border/50"
							>
								<div class="bg-background px-3 py-2">
									<p
										class="font-mono text-[10px] tracking-wider text-muted-foreground/70 uppercase"
									>
										Span
									</p>
									<p class="truncate font-mono text-xs">{selectedSpan.publicId}</p>
								</div>
								<div class="bg-background px-3 py-2">
									<p
										class="font-mono text-[10px] tracking-wider text-muted-foreground/70 uppercase"
									>
										Status
									</p>
									<p class="font-mono text-xs">{selectedSpan.status}</p>
								</div>
							</div>
							<p class="font-medium">{selectedSpan.name}</p>
							{#if selectedSpan.input}
								<pre
									class="max-h-44 overflow-auto rounded-md border border-border bg-background p-3 font-mono text-xs text-muted-foreground">{displayJson(
										selectedSpan.input
									)}</pre>
							{/if}
							{#if selectedSpan.output}
								<pre
									class="max-h-44 overflow-auto rounded-md border border-border bg-background p-3 font-mono text-xs text-muted-foreground">{displayJson(
										selectedSpan.output
									)}</pre>
							{/if}
						{:else if selectedEvent}
							<p class="font-medium">
								{selectedEvent.title ?? selectedEvent.message ?? selectedEvent.type}
							</p>
							<pre
								class="max-h-72 overflow-auto rounded-md border border-border bg-background p-3 font-mono text-xs text-muted-foreground">{displayJson(
									selectedEvent.data
								)}</pre>
						{:else}
							<p class="font-mono text-xs text-muted-foreground">
								Select an event to inspect normalized trace data.
							</p>
						{/if}
					</div>
				</div>

				<!-- Evaluation -->
				<div class="overflow-hidden rounded-lg border border-border bg-card">
					<div class="flex items-center justify-between border-b border-border px-4 py-2.5">
						<span class="font-mono text-xs font-medium">Evaluation</span>
						<span class="font-mono text-[10px] text-muted-foreground"
							>{evaluating ? 'running' : (evaluation?.status ?? 'not evaluated')}</span
						>
					</div>
					<div class="p-4">
						{#if evaluating}
							<div
								class="flex items-center gap-3 rounded-md border border-status-running/60 bg-status-running/10 p-3"
							>
								<LoaderCircle class="size-4 shrink-0 animate-spin text-status-running" />
								<div class="min-w-0">
									<p class="font-mono text-xs font-medium">Evaluation running</p>
									<p class="text-xs text-muted-foreground">
										Scoring the run and checking constraints.
									</p>
								</div>
							</div>
						{:else if evaluation}
							<Tabs.Root value="summary">
								<Tabs.List>
									<Tabs.Trigger value="summary" class="font-mono text-xs">Summary</Tabs.Trigger>
									<Tabs.Trigger value="findings" class="font-mono text-xs">Findings</Tabs.Trigger>
								</Tabs.List>
								<Tabs.Content value="summary" class="space-y-3 pt-3 text-sm">
									<div
										class="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border/50"
									>
										<div class="bg-background px-3 py-2">
											<p
												class="font-mono text-[10px] tracking-wider text-muted-foreground/70 uppercase"
											>
												Score
											</p>
											<p class="font-mono text-sm font-semibold">
												{evaluation.score ?? 'n/a'}
											</p>
										</div>
										<div class="bg-background px-3 py-2">
											<p
												class="font-mono text-[10px] tracking-wider text-muted-foreground/70 uppercase"
											>
												Goal
											</p>
											<p class="font-mono text-sm font-semibold">
												{evaluation.goalCompleted ? 'Complete' : 'Open'}
											</p>
										</div>
									</div>
									<p class="text-sm">{evaluation.summary}</p>
									<p class="text-xs text-muted-foreground">{evaluation.explanation}</p>
								</Tabs.Content>
								<Tabs.Content value="findings" class="space-y-2 pt-3">
									{#each findings as finding (finding.id)}
										<div class="rounded-md border border-border bg-background p-3 text-sm">
											<div class="mb-1 flex items-center justify-between gap-2">
												<Badge variant={finding.severity === 'error' ? 'destructive' : 'outline'}>
													{finding.severity}
												</Badge>
												<span class="font-mono text-[10px] text-muted-foreground"
													>{finding.category}</span
												>
											</div>
											<p class="text-sm">{finding.message}</p>
										</div>
									{/each}
								</Tabs.Content>
							</Tabs.Root>
						{:else}
							<p class="font-mono text-xs text-muted-foreground">
								Run an evaluation to score this run.
							</p>
						{/if}
					</div>
				</div>
			</aside>
		</div>
	</div>
</main>
