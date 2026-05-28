<script lang="ts">
	import EventTimeline from '$lib/components/flightlog/event-timeline.svelte';
	import ReplayPanel from '$lib/components/flightlog/replay-panel.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Tabs from '$lib/components/ui/tabs';
	import { Check, X, LoaderCircle } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import PageHeader from '$lib/components/page-header.svelte';
	import Section from '$lib/components/section.svelte';
	import StatusPill from '$lib/components/status-pill.svelte';
	import posthog from 'posthog-js';
	import { browser } from '$app/environment';

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

	$effect(() => {
		if (browser) {
			posthog.capture('run_viewed', {
				run_id: initialData.run.publicId,
				run_status: initialData.run.status
			});
		}
	});

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

<svelte:head><title>{run.name ?? 'Run'} · FlightLog</title></svelte:head>

<div class="mx-auto w-full max-w-7xl px-6 py-10 lg:px-10">
	<PageHeader
		title={run.name ?? 'Untitled run'}
		description={run.goal}
		breadcrumbs={[{ label: 'Runs', href: '/runs' }, { label: run.name ?? 'Untitled run' }]}
	>
		{#snippet meta()}
			<div class="flex flex-wrap items-center gap-3 font-mono text-[11px] text-muted-foreground">
				<StatusPill status={run.status} size="md" />
				<span class="text-muted-foreground/40">·</span>
				<span class="inline-flex items-center gap-1.5">
					<span
						class="size-1.5 rounded-full"
						class:bg-status-success={connectionState === 'live'}
						class:bg-status-running={connectionState === 'reconnecting'}
						class:bg-muted-foreground={connectionState === 'idle' || connectionState === 'complete'}
						class:bg-status-failed={connectionState === 'failed'}
					></span>
					{connectionState}
				</span>
				<span class="text-muted-foreground/40">·</span>
				<span>{run.publicId}</span>
			</div>
		{/snippet}
		{#snippet actions()}
			<Button
				class="h-9 gap-2"
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
					Evaluate run
				{/if}
			</Button>
		{/snippet}
	</PageHeader>

	{#if pendingApproval}
		<div class="mb-6 overflow-hidden rounded-xl border border-status-running/60 bg-card">
			<div class="flex items-center gap-2 border-b border-border/60 bg-status-running/5 px-5 py-3">
				<span class="inline-block size-1.5 animate-pulse rounded-full bg-status-running"></span>
				<span class="text-sm font-semibold tracking-tight">Approval required</span>
			</div>
			<div class="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
				<div class="space-y-3">
					{#if approvalScreenshot()}
						<img
							class="max-h-64 w-full rounded-md border border-border/60 object-contain"
							src={approvalScreenshot()?.content ?? approvalScreenshot()?.url ?? ''}
							alt="Approval screenshot"
						/>
					{/if}
					{#if pendingApproval.safetyChecks.length}
						<div class="space-y-2">
							{#each pendingApproval.safetyChecks as check (check.id)}
								<div class="rounded-md border border-border/60 bg-background p-2.5">
									<p class="font-mono text-[11px] font-medium">{check.code}</p>
									<p class="mt-0.5 text-xs text-muted-foreground">{check.message}</p>
								</div>
							{/each}
						</div>
					{/if}
				</div>
				<div class="flex flex-col gap-3">
					<pre
						class="max-h-56 flex-1 overflow-auto rounded-md border border-border/60 bg-background p-3 font-mono text-[11px]">{displayJson(
							pendingApproval.action
						)}</pre>
					<div class="grid grid-cols-2 gap-2">
						<Button
							type="button"
							class="gap-2"
							disabled={approvalSubmitting}
							onclick={() => submitApproval('approved')}
						>
							<Check class="size-3.5" />
							Approve
						</Button>
						<Button
							type="button"
							variant="outline"
							class="gap-2"
							disabled={approvalSubmitting}
							onclick={() => submitApproval('rejected')}
						>
							<X class="size-3.5" />
							Reject
						</Button>
					</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- Compact metadata strip - replaces the four collapsibles -->
	<div class="mb-6 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
		{@render statCard(
			'Agent',
			`${run.agentName ?? 'Unknown'}${run.agentVersion ? ` ${run.agentVersion}` : ''}`,
			run.environment ?? 'Unspecified env'
		)}
		{@render statCard(
			'Model',
			agentMetadata.model ?? run.agentVersion ?? 'unknown',
			`${agentMetadata.provider ?? 'unknown'} · ${agentMetadata.framework ?? 'custom'}`
		)}
		{@render statCard(
			'Trace',
			`${events.length} events · ${spans.length} spans`,
			`${traceCounts.modelCalls} model · ${traceCounts.toolCalls} tools · ${traceCounts.browserActions} browser`
		)}
		{@render statCard(
			'Timing',
			formatDate(run.startedAt),
			run.endedAt ? `Ended ${formatDate(run.endedAt)}` : 'Still running'
		)}
	</div>

	{#snippet statCard(label: string, value: string, sub: string)}
		<div class="rounded-xl border border-border/60 bg-card px-4 py-3.5">
			<p class="text-[11px] text-muted-foreground">{label}</p>
			<p class="mt-1 truncate text-sm font-medium tracking-tight">{value}</p>
			<p class="mt-0.5 truncate font-mono text-[11px] text-muted-foreground/80">{sub}</p>
		</div>
	{/snippet}

	<div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
		<!-- Timeline -->
		<Section title="Timeline" padded={false}>
			{#snippet aside()}
				<span class="font-mono text-[11px] text-muted-foreground">
					{events.length} event{events.length === 1 ? '' : 's'}
				</span>
			{/snippet}
			<div class="px-5 py-4">
				{#if events.length}
					<EventTimeline {events} {artifactsByEvent} {selectedSequence} onSelect={selectEvent} />
				{:else}
					<p class="py-12 text-center text-xs text-muted-foreground">
						No events logged for this run.
					</p>
				{/if}
			</div>
		</Section>

		<!-- Right column: replay + inspector + evaluation -->
		<div class="flex min-w-0 flex-col gap-6">
			<Section title="Replay">
				<ReplayPanel {events} {artifacts} {selectedSequence} onSelect={selectEvent} />
			</Section>

			<Section title="Inspector">
				{#snippet aside()}
					<span class="font-mono text-[11px] text-muted-foreground">
						{selectedSpan?.kind ?? selectedEvent?.type ?? 'empty'}
					</span>
				{/snippet}
				<div class="space-y-3 text-sm">
					{#if selectedSpan}
						<div
							class="grid grid-cols-2 gap-3 rounded-md border border-border/60 bg-background px-3 py-2.5"
						>
							<div>
								<p class="text-[10px] text-muted-foreground">Span</p>
								<p class="truncate font-mono text-[11px]">{selectedSpan.publicId}</p>
							</div>
							<div>
								<p class="text-[10px] text-muted-foreground">Status</p>
								<p class="font-mono text-[11px]">{selectedSpan.status}</p>
							</div>
						</div>
						<p class="font-medium tracking-tight">{selectedSpan.name}</p>
						{#if selectedSpan.input}
							<pre
								class="max-h-44 overflow-auto rounded-md border border-border/60 bg-background p-3 font-mono text-[11px] text-muted-foreground">{displayJson(
									selectedSpan.input
								)}</pre>
						{/if}
						{#if selectedSpan.output}
							<pre
								class="max-h-44 overflow-auto rounded-md border border-border/60 bg-background p-3 font-mono text-[11px] text-muted-foreground">{displayJson(
									selectedSpan.output
								)}</pre>
						{/if}
					{:else if selectedEvent}
						<p class="font-medium tracking-tight">
							{selectedEvent.title ?? selectedEvent.message ?? selectedEvent.type}
						</p>
						<pre
							class="max-h-72 overflow-auto rounded-md border border-border/60 bg-background p-3 font-mono text-[11px] text-muted-foreground">{displayJson(
								selectedEvent.data
							)}</pre>
					{:else}
						<p class="text-xs text-muted-foreground">
							Select an event to inspect normalized trace data.
						</p>
					{/if}
				</div>
			</Section>

			<Section title="Evaluation">
				{#snippet aside()}
					<span class="font-mono text-[11px] text-muted-foreground">
						{evaluating ? 'running' : (evaluation?.status ?? 'not evaluated')}
					</span>
				{/snippet}
				{#if evaluating}
					<div
						class="flex items-center gap-3 rounded-md border border-status-running/60 bg-status-running/10 p-3"
					>
						<LoaderCircle class="size-4 shrink-0 animate-spin text-status-running" />
						<div class="min-w-0">
							<p class="text-xs font-medium">Evaluation running</p>
							<p class="text-xs text-muted-foreground">Scoring the run and checking constraints.</p>
						</div>
					</div>
				{:else if evaluation}
					<Tabs.Root value="summary">
						<Tabs.List>
							<Tabs.Trigger value="summary" class="text-xs">Summary</Tabs.Trigger>
							<Tabs.Trigger value="findings" class="text-xs">Findings</Tabs.Trigger>
						</Tabs.List>
						<Tabs.Content value="summary" class="space-y-3 pt-3">
							<div
								class="grid grid-cols-2 gap-3 rounded-md border border-border/60 bg-background px-3 py-2.5"
							>
								<div>
									<p class="text-[10px] text-muted-foreground">Score</p>
									<p class="font-mono text-base font-semibold tracking-tight">
										{evaluation.score ?? 'n/a'}
									</p>
								</div>
								<div>
									<p class="text-[10px] text-muted-foreground">Goal</p>
									<p class="text-sm font-semibold tracking-tight">
										{evaluation.goalCompleted ? 'Complete' : 'Open'}
									</p>
								</div>
							</div>
							<p class="text-sm leading-relaxed">{evaluation.summary}</p>
							<p class="text-xs text-muted-foreground">{evaluation.explanation}</p>
						</Tabs.Content>
						<Tabs.Content value="findings" class="space-y-2 pt-3">
							{#each findings as finding (finding.id)}
								<div class="rounded-md border border-border/60 bg-background p-3 text-sm">
									<div class="mb-1 flex items-center justify-between gap-2">
										<Badge variant={finding.severity === 'error' ? 'destructive' : 'outline'}>
											{finding.severity}
										</Badge>
										<span class="font-mono text-[10px] text-muted-foreground"
											>{finding.category}</span
										>
									</div>
									<p>{finding.message}</p>
								</div>
							{/each}
						</Tabs.Content>
					</Tabs.Root>
				{:else}
					<p class="text-xs text-muted-foreground">Run an evaluation to score this run.</p>
				{/if}
			</Section>
		</div>
	</div>
</div>
