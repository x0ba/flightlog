<script lang="ts">
	import EventTimeline from '$lib/components/flightlog/event-timeline.svelte';
	import ReplayPanel from '$lib/components/flightlog/replay-panel.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Separator } from '$lib/components/ui/separator';
	import * as Tabs from '$lib/components/ui/tabs';
	import { Check, Radio, X } from '@lucide/svelte';
	import { resolve } from '$app/paths';

	let { data } = $props();
	let run = $state(data.run);
	let events = $state([...data.events]);
	let artifacts = $state([...data.artifacts]);
	let evaluation = $state(data.evaluation);
	let findings = $state([...data.findings]);
	let selectedSequence = $state(0);
	let userSelectedEvent = $state(false);
	let connectionState = $state<'idle' | 'live' | 'reconnecting' | 'complete' | 'failed'>('idle');
	let pendingApproval = $state<PendingApproval | undefined>(readPendingApproval(run.metadata));
	let approvalSubmitting = $state(false);

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
				run: typeof data.run;
				events: typeof data.events;
				artifacts: typeof data.artifacts;
				evaluation: typeof data.evaluation;
				findings: typeof data.findings;
			}>(event);
			if (!snapshot) return;
			run = snapshot.run;
			events = snapshot.events;
			artifacts = snapshot.artifacts;
			evaluation = snapshot.evaluation;
			findings = snapshot.findings;
			pendingApproval = readPendingApproval(snapshot.run.metadata);
		});
		source.addEventListener('run', (event) => {
			const nextRun = parseEventData<typeof data.run>(event);
			if (!nextRun) return;
			run = nextRun;
			pendingApproval = readPendingApproval(nextRun.metadata);
		});
		source.addEventListener('event', (event) => {
			const nextEvent = parseEventData<(typeof data.events)[number]>(event);
			if (!nextEvent) return;
			events = mergeByPublicId(events, nextEvent).sort((a, b) => a.sequence - b.sequence);
		});
		source.addEventListener('artifact', (event) => {
			const artifact = parseEventData<(typeof data.artifacts)[number]>(event);
			if (!artifact) return;
			artifacts = mergeByPublicId(artifacts, artifact);
		});
		source.addEventListener('approval_required', (event) => {
			const approval = parseEventData<PendingApproval>(event);
			if (approval) pendingApproval = approval;
		});
		source.addEventListener('done', (event) => {
			const payload = parseEventData<{ run: typeof data.run }>(event);
			if (payload) run = payload.run;
			connectionState = 'complete';
			source.close();
		});
		source.addEventListener('error', () => {
			connectionState = source.readyState === EventSource.CLOSED ? 'failed' : 'reconnecting';
		});

		return () => source.close();
	});

	const statusTone = {
		running: 'secondary',
		success: 'default',
		failed: 'destructive',
		cancelled: 'outline'
	} as const;

	let artifactsByEvent = $derived(
		Object.fromEntries(
			events.map((event) => [
				event.sequence,
				artifacts.filter((artifact) => artifact.eventSequence === event.sequence)
			])
		)
	);

	async function evaluateRun() {
		await fetch(`/api/runs/${run.publicId}/evaluate`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ constraints: [] })
		});
		location.reload();
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
		};
	};

	function readPendingApproval(metadata: unknown) {
		if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return undefined;
		return (metadata as Metadata).agentRequest?.pendingApproval;
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
</script>

<svelte:head><title>{run.name ?? 'Run'} | FlightLog</title></svelte:head>

<main class="min-h-screen bg-background">
	<div class="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
		<header class="flex items-center justify-between gap-4">
			<div class="flex items-center gap-3 min-w-0">
				<a class="font-mono text-xs text-muted-foreground transition-colors hover:text-primary" href={resolve('/runs')}>← runs</a>
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
						class="inline-block size-1.5"
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
			<aside class="flex flex-col gap-px overflow-hidden border border-border bg-border">
				<div class="bg-card px-4 py-3">
					<p class="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Run ID</p>
					<p class="font-mono text-xs text-foreground">{run.publicId}</p>
				</div>
				<div class="bg-card px-4 py-3">
					<p class="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Goal</p>
					<p class="text-sm text-foreground">{run.goal}</p>
				</div>
				<div class="bg-card px-4 py-3">
					<p class="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Agent</p>
					<p class="text-sm text-foreground">{run.agentName ?? 'Unknown'} {run.agentVersion ?? ''}</p>
				</div>
				<div class="bg-card px-4 py-3">
					<p class="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Environment</p>
					<p class="text-sm text-foreground">{run.environment ?? 'Unspecified'}</p>
				</div>
				<div class="grid grid-cols-2 gap-px bg-border">
					<div class="bg-card px-4 py-3">
						<p class="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Started</p>
						<p class="font-mono text-xs text-foreground">{formatDate(run.startedAt)}</p>
					</div>
					<div class="bg-card px-4 py-3">
						<p class="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Ended</p>
						<p class="font-mono text-xs text-foreground">{formatDate(run.endedAt)}</p>
					</div>
				</div>
				<div class="bg-card px-4 py-3">
					<Button class="w-full font-mono text-xs" type="button" onclick={evaluateRun}>Evaluate</Button>
				</div>
			</aside>

			{#if pendingApproval}
				<!-- Approval card overlays before the timeline on small screens -->
				<div class="border border-status-running bg-card lg:col-start-1 lg:row-start-2">
					<div class="flex items-center gap-2 border-b border-border px-4 py-2">
						<span class="inline-block size-1.5 animate-pulse bg-status-running"></span>
						<span class="font-mono text-xs font-medium">Approval Required</span>
					</div>
					<div class="flex flex-col gap-3 p-4 text-sm">
						{#if approvalScreenshot()}
							<img
								class="max-h-48 w-full border border-border object-contain"
								src={approvalScreenshot()?.content ?? approvalScreenshot()?.url ?? ''}
								alt="Approval screenshot"
							/>
						{/if}
						{#if pendingApproval.safetyChecks.length}
							<div class="space-y-2">
								{#each pendingApproval.safetyChecks as check (check.id)}
									<div class="border border-border bg-background p-2">
										<p class="font-mono text-xs font-medium">{check.code}</p>
										<p class="text-xs text-muted-foreground">{check.message}</p>
									</div>
								{/each}
							</div>
						{/if}
						<pre class="max-h-40 overflow-auto border border-border bg-background p-2 font-mono text-xs">{displayJson(pendingApproval.action)}</pre>
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
				<div class="border border-border bg-card">
					<div class="flex items-center justify-between border-b border-border px-4 py-2">
						<span class="font-mono text-xs font-medium">Timeline</span>
						<span class="font-mono text-xs text-muted-foreground">{events.length} event{events.length === 1 ? '' : 's'}</span>
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
							<p class="py-10 text-center font-mono text-xs text-muted-foreground">No events logged for this run.</p>
						{/if}
					</div>
				</div>
			</section>

			<!-- Right sidebar -->
			<aside class="flex min-w-0 flex-col gap-4">
				<!-- Replay -->
				<div class="border border-border bg-card">
					<div class="border-b border-border px-4 py-2">
						<span class="font-mono text-xs font-medium">Replay</span>
					</div>
					<div class="p-4">
						<ReplayPanel {events} {artifacts} {selectedSequence} onSelect={selectEvent} />
					</div>
				</div>

				<!-- Evaluation -->
				<div class="border border-border bg-card">
					<div class="flex items-center justify-between border-b border-border px-4 py-2">
						<span class="font-mono text-xs font-medium">Evaluation</span>
						<span class="font-mono text-[10px] text-muted-foreground">{evaluation?.status ?? 'not evaluated'}</span>
					</div>
					<div class="p-4">
						{#if evaluation}
							<Tabs.Root value="summary">
								<Tabs.List>
									<Tabs.Trigger value="summary" class="font-mono text-xs">Summary</Tabs.Trigger>
									<Tabs.Trigger value="findings" class="font-mono text-xs">Findings</Tabs.Trigger>
								</Tabs.List>
								<Tabs.Content value="summary" class="space-y-3 pt-3 text-sm">
									<div class="grid grid-cols-2 gap-px overflow-hidden border border-border bg-border">
										<div class="bg-background px-3 py-2">
											<p class="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Score</p>
											<p class="font-mono text-sm font-semibold">{evaluation.score ?? 'n/a'}</p>
										</div>
										<div class="bg-background px-3 py-2">
											<p class="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Goal</p>
											<p class="font-mono text-sm font-semibold">{evaluation.goalCompleted ? 'Complete' : 'Open'}</p>
										</div>
									</div>
									<p class="text-sm">{evaluation.summary}</p>
									<p class="text-xs text-muted-foreground">{evaluation.explanation}</p>
								</Tabs.Content>
								<Tabs.Content value="findings" class="space-y-2 pt-3">
									{#each findings as finding (finding.id)}
										<div class="border border-border bg-background p-3 text-sm">
											<div class="mb-1 flex items-center justify-between gap-2">
												<Badge variant={finding.severity === 'error' ? 'destructive' : 'outline'}>
													{finding.severity}
												</Badge>
												<span class="font-mono text-[10px] text-muted-foreground">{finding.category}</span>
											</div>
											<p class="text-sm">{finding.message}</p>
										</div>
									{/each}
								</Tabs.Content>
							</Tabs.Root>
						{:else}
							<p class="font-mono text-xs text-muted-foreground">Run an evaluation to score this run.</p>
						{/if}
					</div>
				</div>
			</aside>
		</div>
	</div>
</main>
