<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as Table from '$lib/components/ui/table';
	import { Separator } from '$lib/components/ui/separator';
	import { Activity, CircleCheck, CircleX, Play, Search, TriangleAlert } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	let { data } = $props();
	let prompt = $state('');
	let runName = $state('');
	let promptError = $state('');
	let creatingRun = $state(false);
	const emptyCurl = `curl -X POST http://localhost:5173/api/runs \\
  -H 'content-type: application/json' \\
  -d '{"goal":"Find product pricing without buying anything","name":"Pricing check"}'`;

	function formatDate(value: string | Date | null) {
		if (!value) return 'Open';
		return new Intl.DateTimeFormat('en', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		}).format(new Date(value));
	}

	async function startAgentRun() {
		promptError = '';
		if (!prompt.trim()) {
			promptError = 'Enter a prompt to start a run.';
			return;
		}
		creatingRun = true;
		try {
			const response = await fetch('/api/agent-runs', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					prompt: prompt.trim(),
					name: runName.trim() || undefined
				})
			});
			if (!response.ok) throw new Error(await response.text());
			const payload = (await response.json()) as { run: { id: string } };
			await goto(resolve(`/runs/${payload.run.id}`));
		} catch (cause) {
			promptError = cause instanceof Error ? cause.message : 'Could not start the agent run.';
		} finally {
			creatingRun = false;
		}
	}
</script>

<svelte:head><title>FlightLog Runs</title></svelte:head>

<main class="min-h-screen bg-background">
	<div class="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
		<header class="flex items-center justify-between gap-4">
			<div class="flex items-center gap-3">
				<div class="flex h-8 w-8 items-center justify-center border border-border bg-secondary">
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-primary">
						<path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>
					</svg>
				</div>
				<div>
					<h1 class="font-mono text-sm font-semibold tracking-wider uppercase">FlightLog</h1>
					<p class="text-xs text-muted-foreground">AgentOps Flight Recorder</p>
				</div>
			</div>
			<form
				class="flex items-center gap-2"
				method="get"
			>
				<div class="relative">
					<Search class="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
					<Input class="h-8 w-48 pl-8 font-mono text-xs" name="q" value={data.filters.q} placeholder="Search runs…" />
				</div>
				<select
					class="h-8 border border-input bg-background px-2 font-mono text-xs text-foreground"
					name="status"
					value={data.filters.status ?? ''}
				>
					<option value="">All</option>
					<option value="running">Running</option>
					<option value="success">Success</option>
					<option value="failed">Failed</option>
					<option value="cancelled">Cancelled</option>
				</select>
				<Button class="h-8 px-3 text-xs" type="submit">Filter</Button>
			</form>
		</header>

		<!-- Metrics bar -->
		<div class="grid grid-cols-2 gap-px overflow-hidden border border-border sm:grid-cols-4">
			<div class="flex items-center gap-3 bg-card px-4 py-3">
				<div class="h-8 w-0.5 bg-status-running"></div>
				<div>
					<p class="font-mono text-lg font-semibold">{data.metrics.running}</p>
					<p class="text-xs text-muted-foreground">Running</p>
				</div>
			</div>
			<div class="flex items-center gap-3 bg-card px-4 py-3">
				<div class="h-8 w-0.5 bg-status-success"></div>
				<div>
					<p class="font-mono text-lg font-semibold">{data.metrics.successRate}%</p>
					<p class="text-xs text-muted-foreground">Success Rate</p>
				</div>
			</div>
			<div class="flex items-center gap-3 bg-card px-4 py-3">
				<div class="h-8 w-0.5 bg-status-failed"></div>
				<div>
					<p class="font-mono text-lg font-semibold">{data.metrics.failed}</p>
					<p class="text-xs text-muted-foreground">Failed</p>
				</div>
			</div>
			<div class="flex items-center gap-3 bg-card px-4 py-3">
				<div class="h-8 w-0.5 bg-status-cancelled"></div>
				<div>
					<p class="font-mono text-lg font-semibold">{data.metrics.warnings}</p>
					<p class="text-xs text-muted-foreground">Eval Warnings</p>
				</div>
			</div>
		</div>

		<!-- New run prompt -->
		<div class="border border-border bg-card">
			<div class="flex items-center gap-2 border-b border-border px-4 py-2">
				<Play class="size-3.5 text-primary" />
				<span class="font-mono text-xs font-medium">New Run</span>
			</div>
			<form
				class="p-4"
				onsubmit={(event) => void (event.preventDefault(), startAgentRun())}
			>
				<div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_14rem]">
					<Textarea
						class="min-h-20 resize-none bg-background font-mono text-sm"
						bind:value={prompt}
						placeholder="Describe a browser task for the agent…"
					/>
					<div class="flex flex-col gap-2">
						<Input class="bg-background font-mono text-xs" bind:value={runName} placeholder="Run name (optional)" />
						<Button class="h-9 justify-center gap-2 font-mono text-xs" type="submit" disabled={creatingRun}>
							<Play class="size-3.5" />
							{creatingRun ? 'Starting…' : 'Start run'}
						</Button>
					</div>
				</div>
				{#if promptError}
					<p class="mt-2 text-xs text-destructive">{promptError}</p>
				{/if}
			</form>
		</div>

		<!-- Runs table -->
		<div class="border border-border bg-card">
			<div class="flex items-center justify-between border-b border-border px-4 py-2">
				<span class="font-mono text-xs font-medium">Runs</span>
				<span class="font-mono text-xs text-muted-foreground">{data.total} logged</span>
			</div>
			{#if data.runs.length}
				<Table.Root>
					<Table.Header>
						<Table.Row class="border-border hover:bg-transparent">
							<Table.Head class="font-mono text-xs text-muted-foreground">Run</Table.Head>
							<Table.Head class="font-mono text-xs text-muted-foreground">Status</Table.Head>
							<Table.Head class="font-mono text-xs text-muted-foreground">Agent</Table.Head>
							<Table.Head class="font-mono text-xs text-muted-foreground">Events</Table.Head>
							<Table.Head class="font-mono text-xs text-muted-foreground">Eval</Table.Head>
							<Table.Head class="font-mono text-xs text-muted-foreground">Started</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each data.runs as run (run.id)}
							<Table.Row class="group border-border transition-colors hover:bg-secondary/50">
								<Table.Cell>
									<a class="text-sm font-medium text-foreground transition-colors hover:text-primary" href={resolve(`/runs/${run.id}`)}>
										{run.name ?? 'Untitled run'}
									</a>
									<p class="line-clamp-1 max-w-md font-mono text-xs text-muted-foreground">{run.goal}</p>
								</Table.Cell>
								<Table.Cell>
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
								</Table.Cell>
								<Table.Cell class="font-mono text-xs text-muted-foreground">{run.agentName ?? '—'}</Table.Cell>
								<Table.Cell class="font-mono text-xs">{run.eventCount}</Table.Cell>
								<Table.Cell class="font-mono text-xs">
									{#if run.latestEvaluationScore === null}
										<span class="text-muted-foreground">—</span>
									{:else}
										{run.latestEvaluationScore}
									{/if}
								</Table.Cell>
								<Table.Cell class="font-mono text-xs text-muted-foreground">{formatDate(run.startedAt)}</Table.Cell>
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
			{:else}
				<div class="flex flex-col gap-4 p-6">
					<p class="font-mono text-xs text-muted-foreground">
						No runs yet. Create one with the ingest API:
					</p>
					<Separator />
					<pre class="overflow-auto border border-border bg-background p-4 font-mono text-xs text-muted-foreground">{emptyCurl}</pre>
				</div>
			{/if}
		</div>
	</div>
</main>
