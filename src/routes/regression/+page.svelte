<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as Table from '$lib/components/ui/table';
	import * as Sheet from '$lib/components/ui/sheet';
	import { GitBranch, Plus, ShieldCheck } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import PageHeader from '$lib/components/page-header.svelte';
	import Section from '$lib/components/section.svelte';
	import StatusPill from '$lib/components/status-pill.svelte';

	let { data } = $props();
	let name = $state('');
	let description = $state('');
	let repositoryOwner = $state('');
	let repositoryName = $state('');
	let creating = $state(false);
	let error = $state('');
	let createOpen = $state(false);

	async function createSuite() {
		error = '';
		if (!name.trim() || !repositoryOwner.trim() || !repositoryName.trim()) {
			error = 'Name, repository owner, and repository name are required.';
			return;
		}
		creating = true;
		try {
			const response = await fetch('/api/regression/suites', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					name: name.trim(),
					description: description.trim() || undefined,
					repositoryOwner: repositoryOwner.trim(),
					repositoryName: repositoryName.trim()
				})
			});
			if (!response.ok) throw new Error(await response.text());
			const payload = (await response.json()) as { suite: { id: string } };
			await goto(resolve(`/regression/${payload.suite.id}`));
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Could not create regression suite.';
		} finally {
			creating = false;
		}
	}
</script>

<svelte:head><title>Regression · FlightLog</title></svelte:head>

<div class="mx-auto w-full max-w-6xl px-6 py-10 lg:px-10">
	<PageHeader
		eyebrow="CI gating"
		title="Regression suites"
		description="Goal-based agent tests that run on PRs and report scores back to GitHub Checks."
	>
		{#snippet actions()}
			<Button class="h-9 gap-1.5" onclick={() => (createOpen = true)} type="button">
				<Plus class="size-3.5" />
				New suite
			</Button>
		{/snippet}
	</PageHeader>

	<Section padded={false}>
		{#if data.suites.length}
			<Table.Root>
				<Table.Header>
					<Table.Row class="border-border/60 hover:bg-transparent">
						<Table.Head class="pl-5 text-xs text-muted-foreground">Suite</Table.Head>
						<Table.Head class="text-xs text-muted-foreground">Repository</Table.Head>
						<Table.Head class="text-xs text-muted-foreground">Cases</Table.Head>
						<Table.Head class="text-xs text-muted-foreground">Latest run</Table.Head>
						<Table.Head class="pr-5 text-xs text-muted-foreground">Score</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each data.suites as suite (suite.publicId)}
						<Table.Row class="border-border/60 transition-colors hover:bg-secondary/30">
							<Table.Cell class="py-3 pl-5">
								<a
									class="text-sm font-medium tracking-tight hover:text-primary"
									href={resolve(`/regression/${suite.publicId}`)}
								>
									{suite.name}
								</a>
							</Table.Cell>
							<Table.Cell class="font-mono text-xs text-muted-foreground">
								{suite.repositoryOwner}/{suite.repositoryName}
							</Table.Cell>
							<Table.Cell class="font-mono text-xs">{suite.caseCount}</Table.Cell>
							<Table.Cell>
								{#if suite.latestRun}
									<a
										class="hover:underline"
										href={resolve(`/regression/runs/${suite.latestRun.id}`)}
									>
										<StatusPill status={suite.latestRun.status} />
									</a>
								{:else}
									<span class="text-xs text-muted-foreground">—</span>
								{/if}
							</Table.Cell>
							<Table.Cell class="pr-5 font-mono text-xs">
								{suite.latestRun?.aggregateScore ?? '—'}
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		{:else}
			<div class="flex flex-col items-center gap-4 px-6 py-16 text-center">
				<div class="flex size-12 items-center justify-center rounded-full bg-secondary/60">
					<ShieldCheck class="size-5 text-muted-foreground" />
				</div>
				<div>
					<p class="text-sm font-semibold tracking-tight">No regression suites yet</p>
					<p class="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
						Create a suite for a GitHub repository, add goal-based cases, and FlightLog will
						evaluate agent runs and report scores to GitHub Checks.
					</p>
				</div>
				<Button class="mt-2 h-8 gap-1.5" onclick={() => (createOpen = true)}>
					<Plus class="size-3.5" />
					New suite
				</Button>
			</div>
		{/if}
	</Section>
</div>

<Sheet.Root bind:open={createOpen}>
	<Sheet.Content class="w-full overflow-y-auto sm:max-w-md">
		<Sheet.Header class="px-6 pt-6">
			<Sheet.Title class="tracking-tight">New regression suite</Sheet.Title>
			<Sheet.Description>
				Bind agent regression cases to a GitHub repository. Cases are added on the next step.
			</Sheet.Description>
		</Sheet.Header>
		<div class="flex flex-col gap-4 px-6 pt-4 pb-6">
			<div class="grid gap-2">
				<Label class="text-xs">Name</Label>
				<Input bind:value={name} placeholder="PR smoke tests" />
			</div>
			<div class="grid gap-2">
				<Label class="text-xs">Description</Label>
				<Textarea
					bind:value={description}
					class="min-h-20 text-sm"
					placeholder="Runs core agent goals on every PR."
				/>
			</div>
			<div class="grid grid-cols-2 gap-2">
				<div class="grid gap-2">
					<Label class="text-xs">Owner</Label>
					<Input bind:value={repositoryOwner} placeholder="acme" />
				</div>
				<div class="grid gap-2">
					<Label class="text-xs">Repo</Label>
					<Input bind:value={repositoryName} placeholder="support-agent" />
				</div>
			</div>
			{#if error}
				<p class="text-xs text-destructive">{error}</p>
			{/if}
			<Button class="mt-1 gap-1.5" disabled={creating} onclick={createSuite}>
				<GitBranch class="size-3.5" />
				{creating ? 'Creating…' : 'Create suite'}
			</Button>
		</div>
	</Sheet.Content>
</Sheet.Root>
