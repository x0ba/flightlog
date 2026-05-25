<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
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

	const statusTone = {
		running: 'secondary',
		success: 'default',
		failed: 'destructive',
		cancelled: 'outline'
	} as const;

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
	<div class="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
		<header class="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
			<div>
				<p class="text-sm font-medium text-muted-foreground">AgentOps Flight Recorder</p>
				<h1 class="text-3xl font-semibold tracking-normal">FlightLog</h1>
			</div>
			<form
				class="grid w-full grid-cols-1 items-center gap-2 sm:grid-cols-[minmax(16rem,1fr)_12rem_auto] md:max-w-xl"
				method="get"
			>
				<div class="relative min-w-0">
					<Search class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input class="h-10 pl-9" name="q" value={data.filters.q} placeholder="Search runs" />
				</div>
				<select
					class="h-10 w-full border border-input bg-background px-3 text-sm"
					name="status"
					value={data.filters.status ?? ''}
				>
					<option value="">All statuses</option>
					<option value="running">Running</option>
					<option value="success">Success</option>
					<option value="failed">Failed</option>
					<option value="cancelled">Cancelled</option>
				</select>
				<Button class="h-10" type="submit">Filter</Button>
			</form>
		</header>

		<Card.Root>
			<Card.Header>
				<Card.Title>Start an Agent Run</Card.Title>
				<Card.Description>Enter a browser task and watch the run stream live.</Card.Description>
			</Card.Header>
			<Card.Content>
				<form
					class="grid gap-3"
					onsubmit={(event) => void (event.preventDefault(), startAgentRun())}
				>
					<div class="grid gap-2 md:grid-cols-[minmax(0,1fr)_18rem]">
						<Textarea
							class="min-h-24 resize-none"
							bind:value={prompt}
							placeholder="Ask the agent to research a page, compare products, or complete a browser task"
						/>
						<div class="flex flex-col gap-2">
							<Input bind:value={runName} placeholder="Run name (optional)" />
							<Button class="h-10 justify-center gap-2" type="submit" disabled={creatingRun}>
								<Play class="size-4" />
								{creatingRun ? 'Starting...' : 'Start run'}
							</Button>
						</div>
					</div>
					{#if promptError}
						<p class="text-sm text-destructive">{promptError}</p>
					{/if}
				</form>
			</Card.Content>
		</Card.Root>

		<section class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
			<Card.Root>
				<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
					<Card.Title class="text-sm font-medium">Running</Card.Title>
					<Activity class="size-4 text-muted-foreground" />
				</Card.Header>
				<Card.Content><div class="text-2xl font-semibold">{data.metrics.running}</div></Card.Content
				>
			</Card.Root>
			<Card.Root>
				<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
					<Card.Title class="text-sm font-medium">Success Rate</Card.Title>
					<CircleCheck class="size-4 text-muted-foreground" />
				</Card.Header>
				<Card.Content
					><div class="text-2xl font-semibold">{data.metrics.successRate}%</div></Card.Content
				>
			</Card.Root>
			<Card.Root>
				<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
					<Card.Title class="text-sm font-medium">Failed</Card.Title>
					<CircleX class="size-4 text-muted-foreground" />
				</Card.Header>
				<Card.Content><div class="text-2xl font-semibold">{data.metrics.failed}</div></Card.Content>
			</Card.Root>
			<Card.Root>
				<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
					<Card.Title class="text-sm font-medium">Eval Warnings</Card.Title>
					<TriangleAlert class="size-4 text-muted-foreground" />
				</Card.Header>
				<Card.Content
					><div class="text-2xl font-semibold">{data.metrics.warnings}</div></Card.Content
				>
			</Card.Root>
		</section>

		<Card.Root>
			<Card.Header>
				<Card.Title>Runs</Card.Title>
				<Card.Description>{data.total} run{data.total === 1 ? '' : 's'} logged</Card.Description>
			</Card.Header>
			<Card.Content>
				{#if data.runs.length}
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.Head>Run</Table.Head>
								<Table.Head>Status</Table.Head>
								<Table.Head>Agent</Table.Head>
								<Table.Head>Events</Table.Head>
								<Table.Head>Eval</Table.Head>
								<Table.Head>Started</Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#each data.runs as run (run.id)}
								<Table.Row>
									<Table.Cell>
										<a class="font-medium hover:underline" href={resolve(`/runs/${run.id}`)}>
											{run.name ?? 'Untitled run'}
										</a>
										<p class="line-clamp-1 max-w-xl text-sm text-muted-foreground">{run.goal}</p>
									</Table.Cell>
									<Table.Cell>
										<Badge variant={statusTone[run.status]}>{run.status}</Badge>
									</Table.Cell>
									<Table.Cell>{run.agentName ?? 'Unknown'}</Table.Cell>
									<Table.Cell>{run.eventCount}</Table.Cell>
									<Table.Cell>
										{#if run.latestEvaluationScore === null}
											<span class="text-muted-foreground">None</span>
										{:else}
											{run.latestEvaluationScore}
										{/if}
									</Table.Cell>
									<Table.Cell>{formatDate(run.startedAt)}</Table.Cell>
								</Table.Row>
							{/each}
						</Table.Body>
					</Table.Root>
				{:else}
					<div class="flex flex-col gap-4 py-10">
						<p class="text-sm text-muted-foreground">
							No runs yet. Create one with the ingest API.
						</p>
						<Separator />
						<pre class="overflow-auto bg-muted p-4 text-xs">{emptyCurl}</pre>
					</div>
				{/if}
			</Card.Content>
		</Card.Root>
	</div>
</main>
