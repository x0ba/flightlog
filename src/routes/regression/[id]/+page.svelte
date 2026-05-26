<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as Table from '$lib/components/ui/table';
	import { Play, Plus } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	let { data } = $props();
	let caseName = $state('');
	let goal = $state('');
	let constraints = $state('');
	let minScore = $state(70);
	let creatingCase = $state(false);
	let startingRun = $state(false);
	let error = $state('');

	async function addCase() {
		error = '';
		if (!caseName.trim() || !goal.trim()) {
			error = 'Case name and goal are required.';
			return;
		}
		creatingCase = true;
		try {
			const response = await fetch(`/api/regression/suites/${data.suite.publicId}`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					name: caseName.trim(),
					goal: goal.trim(),
					constraints: constraints
						.split('\n')
						.map((line) => line.trim())
						.filter(Boolean),
					minScore
				})
			});
			if (!response.ok) throw new Error(await response.text());
			await goto(resolve(`/regression/${data.suite.publicId}`), { invalidateAll: true });
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Could not add regression case.';
		} finally {
			creatingCase = false;
		}
	}

	async function startRun() {
		startingRun = true;
		error = '';
		try {
			const response = await fetch(`/api/regression/suites/${data.suite.publicId}/runs`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({})
			});
			if (!response.ok) throw new Error(await response.text());
			const payload = (await response.json()) as { run: { id: string } };
			await goto(resolve(`/regression/runs/${payload.run.id}`));
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Could not start regression run.';
		} finally {
			startingRun = false;
		}
	}
</script>

<svelte:head><title>{data.suite.name} | FlightLog</title></svelte:head>

<main class="min-h-screen bg-background">
	<div class="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
		<header class="flex flex-wrap items-start justify-between gap-4">
			<div>
				<a
					class="font-mono text-xs text-muted-foreground hover:underline"
					href={resolve('/regression')}
				>
					Regression Suites
				</a>
				<h1 class="mt-1 font-mono text-sm font-semibold tracking-wider uppercase">
					{data.suite.name}
				</h1>
				<p class="mt-1 font-mono text-xs text-muted-foreground">
					{data.suite.repositoryOwner}/{data.suite.repositoryName}
				</p>
				{#if data.suite.description}
					<p class="mt-2 text-xs text-muted-foreground">{data.suite.description}</p>
				{/if}
			</div>
			<Button
				class="h-8 text-xs"
				disabled={startingRun || !data.suite.cases.length}
				onclick={startRun}
			>
				<Play class="mr-1.5 size-3.5" />
				{startingRun ? 'Starting…' : 'Run suite now'}
			</Button>
		</header>

		<div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
			<div class="overflow-hidden rounded-lg border border-border bg-card">
				<div class="border-b border-border px-4 py-2.5">
					<h2 class="font-mono text-xs font-medium">Cases</h2>
				</div>
				{#if data.suite.cases.length}
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.Head class="font-mono text-xs">Name</Table.Head>
								<Table.Head class="font-mono text-xs">Goal</Table.Head>
								<Table.Head class="font-mono text-xs">Min Score</Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#each data.suite.cases as testCase (testCase.publicId)}
								<Table.Row>
									<Table.Cell class="font-mono text-xs">{testCase.name}</Table.Cell>
									<Table.Cell class="max-w-md truncate text-xs text-muted-foreground">
										{testCase.goal}
									</Table.Cell>
									<Table.Cell class="font-mono text-xs">{testCase.minScore}</Table.Cell>
								</Table.Row>
							{/each}
						</Table.Body>
					</Table.Root>
				{:else}
					<p class="p-6 text-xs text-muted-foreground">Add at least one case to run this suite.</p>
				{/if}
			</div>

			<div class="space-y-4">
				<div class="rounded-lg border border-border bg-card p-4">
					<div class="mb-4 flex items-center gap-2">
						<Plus class="size-3.5 text-primary" />
						<h2 class="font-mono text-xs font-medium">Add Case</h2>
					</div>
					<div class="space-y-3">
						<div class="space-y-1.5">
							<Label class="font-mono text-xs">Name</Label>
							<Input bind:value={caseName} class="h-8 font-mono text-xs" />
						</div>
						<div class="space-y-1.5">
							<Label class="font-mono text-xs">Goal</Label>
							<Textarea bind:value={goal} class="min-h-20 font-mono text-xs" />
						</div>
						<div class="space-y-1.5">
							<Label class="font-mono text-xs">Constraints (one per line)</Label>
							<Textarea bind:value={constraints} class="min-h-16 font-mono text-xs" />
						</div>
						<div class="space-y-1.5">
							<Label class="font-mono text-xs">Minimum score</Label>
							<Input
								bind:value={minScore}
								class="h-8 font-mono text-xs"
								type="number"
								min="0"
								max="100"
							/>
						</div>
						{#if error}
							<p class="font-mono text-xs text-destructive">{error}</p>
						{/if}
						<Button class="h-8 w-full text-xs" disabled={creatingCase} onclick={addCase}>
							{creatingCase ? 'Adding…' : 'Add case'}
						</Button>
					</div>
				</div>

				<div class="rounded-lg border border-border bg-card p-4">
					<h2 class="font-mono text-xs font-medium">Recent Runs</h2>
					<div class="mt-3 space-y-2">
						{#each data.runs as run (run.publicId)}
							<a
								class="flex items-center justify-between rounded-md border border-border px-3 py-2 font-mono text-xs transition-colors hover:bg-secondary/40"
								href={resolve(`/regression/runs/${run.publicId}`)}
							>
								<span>{run.status}</span>
								<span class="text-muted-foreground">{run.aggregateScore ?? '—'}</span>
							</a>
						{:else}
							<p class="text-xs text-muted-foreground">No runs yet.</p>
						{/each}
					</div>
				</div>
			</div>
		</div>
	</div>
</main>
