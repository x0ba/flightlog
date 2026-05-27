<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as Table from '$lib/components/ui/table';
	import * as Sheet from '$lib/components/ui/sheet';
	import { Play, Plus } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import PageHeader from '$lib/components/page-header.svelte';
	import Section from '$lib/components/section.svelte';
	import StatusPill from '$lib/components/status-pill.svelte';

	let { data } = $props();
	let caseName = $state('');
	let goal = $state('');
	let constraints = $state('');
	let minScore = $state(70);
	let creatingCase = $state(false);
	let startingRun = $state(false);
	let error = $state('');
	let addCaseOpen = $state(false);

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
			caseName = '';
			goal = '';
			constraints = '';
			minScore = 70;
			addCaseOpen = false;
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

<svelte:head><title>{data.suite.name} · FlightLog</title></svelte:head>

<div class="mx-auto w-full max-w-6xl px-6 py-10 lg:px-10">
	<PageHeader
		title={data.suite.name}
		description={data.suite.description ?? undefined}
		breadcrumbs={[{ label: 'Regression', href: '/regression' }, { label: data.suite.name }]}
	>
		{#snippet meta()}
			<div class="flex flex-wrap items-center gap-3 font-mono text-[11px] text-muted-foreground">
				<span class="inline-flex items-center gap-1.5">
					<span class="size-1 rounded-full bg-muted-foreground/60"></span>
					{data.suite.repositoryOwner}/{data.suite.repositoryName}
				</span>
				<span class="text-muted-foreground/40">·</span>
				<span>{data.suite.cases.length} case{data.suite.cases.length === 1 ? '' : 's'}</span>
			</div>
		{/snippet}
		{#snippet actions()}
			<Button
				variant="outline"
				class="h-9 gap-1.5"
				onclick={() => (addCaseOpen = true)}
				type="button"
			>
				<Plus class="size-3.5" />
				Add case
			</Button>
			<Button
				class="h-9 gap-1.5"
				disabled={startingRun || !data.suite.cases.length}
				onclick={startRun}
			>
				<Play class="size-3.5" />
				{startingRun ? 'Starting…' : 'Run suite'}
			</Button>
		{/snippet}
	</PageHeader>

	<div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
		<Section title="Cases" padded={false}>
			{#snippet children()}
				{#if data.suite.cases.length}
					<Table.Root>
						<Table.Header>
							<Table.Row class="border-border/60 hover:bg-transparent">
								<Table.Head class="pl-5 text-xs text-muted-foreground">Name</Table.Head>
								<Table.Head class="text-xs text-muted-foreground">Goal</Table.Head>
								<Table.Head class="pr-5 text-xs text-muted-foreground">Min score</Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#each data.suite.cases as testCase (testCase.publicId)}
								<Table.Row class="border-border/60">
									<Table.Cell class="pl-5 text-sm font-medium tracking-tight"
										>{testCase.name}</Table.Cell
									>
									<Table.Cell class="max-w-md truncate text-xs text-muted-foreground">
										{testCase.goal}
									</Table.Cell>
									<Table.Cell class="pr-5 font-mono text-xs">{testCase.minScore}</Table.Cell>
								</Table.Row>
							{/each}
						</Table.Body>
					</Table.Root>
				{:else}
					<div class="px-6 py-12 text-center">
						<p class="text-sm font-medium tracking-tight">No cases yet</p>
						<p class="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
							Add at least one goal-based case before running this suite.
						</p>
						<Button class="mt-4 h-8 gap-1.5" onclick={() => (addCaseOpen = true)}>
							<Plus class="size-3.5" />
							Add case
						</Button>
					</div>
				{/if}
			{/snippet}
		</Section>

		<Section title="Recent runs">
			{#snippet children()}
				<div class="flex flex-col gap-1.5">
					{#each data.runs as run (run.publicId)}
						<a
							class="flex items-center justify-between rounded-md border border-border/60 bg-background px-3 py-2.5 transition-colors hover:bg-secondary/40"
							href={resolve(`/regression/runs/${run.publicId}`)}
						>
							<StatusPill status={run.status} />
							<span class="font-mono text-xs text-muted-foreground"
								>{run.aggregateScore ?? '—'}</span
							>
						</a>
					{:else}
						<p class="text-xs text-muted-foreground">No runs yet.</p>
					{/each}
				</div>
			{/snippet}
		</Section>
	</div>
</div>

<Sheet.Root bind:open={addCaseOpen}>
	<Sheet.Content class="w-full overflow-y-auto sm:max-w-md">
		<Sheet.Header class="px-6 pt-6">
			<Sheet.Title class="tracking-tight">Add regression case</Sheet.Title>
			<Sheet.Description>
				A goal the agent should accomplish, with optional constraints and a minimum score.
			</Sheet.Description>
		</Sheet.Header>
		<div class="flex flex-col gap-4 px-6 pt-4 pb-6">
			<div class="grid gap-2">
				<Label class="text-xs">Name</Label>
				<Input bind:value={caseName} placeholder="Find pricing without checkout" />
			</div>
			<div class="grid gap-2">
				<Label class="text-xs">Goal</Label>
				<Textarea bind:value={goal} class="min-h-24 text-sm" />
			</div>
			<div class="grid gap-2">
				<Label class="text-xs">Constraints (one per line)</Label>
				<Textarea bind:value={constraints} class="min-h-20 text-sm" />
			</div>
			<div class="grid gap-2">
				<Label class="text-xs">Minimum score</Label>
				<Input bind:value={minScore} type="number" min="0" max="100" />
			</div>
			{#if error}
				<p class="text-xs text-destructive">{error}</p>
			{/if}
			<Button class="mt-1" disabled={creatingCase} onclick={addCase}>
				{creatingCase ? 'Adding…' : 'Add case'}
			</Button>
		</div>
	</Sheet.Content>
</Sheet.Root>
