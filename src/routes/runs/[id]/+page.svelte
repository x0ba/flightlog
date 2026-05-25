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
	<div class="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
		<header class="flex items-center justify-between gap-4">
			<div class="min-w-0">
				<a class="text-sm text-muted-foreground hover:underline" href={resolve('/runs')}>Runs</a>
				<h1 class="truncate text-2xl font-semibold">{run.name ?? 'Untitled run'}</h1>
			</div>
			<div class="flex items-center gap-2">
				<Badge variant="outline" class="gap-1">
					<Radio class="size-3" />
					{connectionState}
				</Badge>
				<Badge variant={statusTone[run.status]}>{run.status}</Badge>
			</div>
		</header>

		<div class="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)_380px]">
			<aside class="flex flex-col gap-4">
				<Card.Root>
					<Card.Header>
						<Card.Title>Run</Card.Title>
						<Card.Description>{run.publicId}</Card.Description>
					</Card.Header>
					<Card.Content class="flex flex-col gap-3 text-sm">
						<div>
							<p class="font-medium">Goal</p>
							<p class="text-muted-foreground">{run.goal}</p>
						</div>
						<Separator />
						<div>
							<p class="font-medium">Agent</p>
							<p class="text-muted-foreground">
								{run.agentName ?? 'Unknown'}
								{run.agentVersion ?? ''}
							</p>
						</div>
						<div>
							<p class="font-medium">Environment</p>
							<p class="text-muted-foreground">{run.environment ?? 'Unspecified'}</p>
						</div>
						<div>
							<p class="font-medium">Started</p>
							<p class="text-muted-foreground">{formatDate(run.startedAt)}</p>
						</div>
						<div>
							<p class="font-medium">Ended</p>
							<p class="text-muted-foreground">{formatDate(run.endedAt)}</p>
						</div>
						<Button class="w-full" type="button" onclick={evaluateRun}>Evaluate</Button>
					</Card.Content>
				</Card.Root>

				{#if pendingApproval}
					<Card.Root>
						<Card.Header>
							<Card.Title>Approval Required</Card.Title>
							<Card.Description>Review the next browser action.</Card.Description>
						</Card.Header>
						<Card.Content class="flex flex-col gap-3 text-sm">
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
										<div class="border border-border p-2">
											<p class="font-medium">{check.code}</p>
											<p class="text-muted-foreground">{check.message}</p>
										</div>
									{/each}
								</div>
							{/if}
							<pre class="max-h-40 overflow-auto bg-muted p-2 text-xs">{displayJson(
									pendingApproval.action
								)}</pre>
							<div class="grid grid-cols-2 gap-2">
								<Button
									type="button"
									class="gap-2"
									disabled={approvalSubmitting}
									onclick={() => submitApproval('approved')}
								>
									<Check class="size-4" />
									Approve
								</Button>
								<Button
									type="button"
									variant="outline"
									class="gap-2"
									disabled={approvalSubmitting}
									onclick={() => submitApproval('rejected')}
								>
									<X class="size-4" />
									Reject
								</Button>
							</div>
						</Card.Content>
					</Card.Root>
				{/if}
			</aside>

			<section class="min-w-0">
				<Card.Root>
					<Card.Header>
						<Card.Title>Timeline</Card.Title>
						<Card.Description
							>{events.length} event{events.length === 1 ? '' : 's'}</Card.Description
						>
					</Card.Header>
					<Card.Content>
						{#if events.length}
							<EventTimeline
								{events}
								{artifactsByEvent}
								{selectedSequence}
								onSelect={selectEvent}
							/>
						{:else}
							<p class="py-10 text-sm text-muted-foreground">No events logged for this run.</p>
						{/if}
					</Card.Content>
				</Card.Root>
			</section>

			<aside class="flex min-w-0 flex-col gap-4">
				<Card.Root>
					<Card.Header>
						<Card.Title>Replay</Card.Title>
						<Card.Description>Step through event artifacts</Card.Description>
					</Card.Header>
					<Card.Content>
						<ReplayPanel {events} {artifacts} {selectedSequence} onSelect={selectEvent} />
					</Card.Content>
				</Card.Root>

				<Card.Root>
					<Card.Header>
						<Card.Title>Evaluation</Card.Title>
						<Card.Description>{evaluation?.status ?? 'Not evaluated'}</Card.Description>
					</Card.Header>
					<Card.Content>
						{#if evaluation}
							<Tabs.Root value="summary">
								<Tabs.List>
									<Tabs.Trigger value="summary">Summary</Tabs.Trigger>
									<Tabs.Trigger value="findings">Findings</Tabs.Trigger>
								</Tabs.List>
								<Tabs.Content value="summary" class="space-y-3 text-sm">
									<div class="grid grid-cols-2 gap-2">
										<div class="border border-border p-2">
											<p class="text-xs text-muted-foreground">Score</p>
											<p class="font-semibold">{evaluation.score ?? 'n/a'}</p>
										</div>
										<div class="border border-border p-2">
											<p class="text-xs text-muted-foreground">Goal</p>
											<p class="font-semibold">
												{evaluation.goalCompleted ? 'Complete' : 'Open'}
											</p>
										</div>
									</div>
									<p>{evaluation.summary}</p>
									<p class="text-muted-foreground">{evaluation.explanation}</p>
								</Tabs.Content>
								<Tabs.Content value="findings" class="space-y-2">
									{#each findings as finding (finding.id)}
										<div class="border border-border p-3 text-sm">
											<div class="mb-1 flex items-center justify-between gap-2">
												<Badge variant={finding.severity === 'error' ? 'destructive' : 'outline'}>
													{finding.severity}
												</Badge>
												<span class="text-xs text-muted-foreground">{finding.category}</span>
											</div>
											<p>{finding.message}</p>
										</div>
									{/each}
								</Tabs.Content>
							</Tabs.Root>
						{:else}
							<p class="text-sm text-muted-foreground">Run an evaluation to score this run.</p>
						{/if}
					</Card.Content>
				</Card.Root>
			</aside>
		</div>
	</div>
</main>
