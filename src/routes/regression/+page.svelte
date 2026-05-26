<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as Table from '$lib/components/ui/table';
	import { GitBranch, Plus, ShieldCheck } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	let { data } = $props();
	let name = $state('');
	let description = $state('');
	let repositoryOwner = $state('');
	let repositoryName = $state('');
	let creating = $state(false);
	let error = $state('');

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

<svelte:head><title>Regression Suites | FlightLog</title></svelte:head>

<main class="min-h-screen bg-background">
	<div class="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
		<header class="flex flex-wrap items-center justify-between gap-4">
			<div>
				<p class="font-mono text-xs tracking-wider text-muted-foreground uppercase">
					Agent Observability and CI
				</p>
				<h1 class="font-mono text-sm font-semibold tracking-wider uppercase">Regression Suites</h1>
				<p class="mt-1 text-xs text-muted-foreground">
					Define goal-based agent tests, evaluate traces, and gate PRs with GitHub Checks.
				</p>
			</div>
			<div class="flex items-center gap-2">
				<a
					class="rounded-md border border-border px-3 py-1.5 font-mono text-xs transition-colors hover:bg-secondary"
					href={resolve('/runs')}
				>
					Traces
				</a>
			</div>
		</header>

		<div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
			<div class="overflow-hidden rounded-lg border border-border bg-card">
				{#if data.suites.length}
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.Head class="font-mono text-xs">Suite</Table.Head>
								<Table.Head class="font-mono text-xs">Repository</Table.Head>
								<Table.Head class="font-mono text-xs">Cases</Table.Head>
								<Table.Head class="font-mono text-xs">Latest Run</Table.Head>
								<Table.Head class="font-mono text-xs">Score</Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#each data.suites as suite (suite.publicId)}
								<Table.Row>
									<Table.Cell>
										<a
											class="font-mono text-xs font-medium hover:underline"
											href={resolve(`/regression/${suite.publicId}`)}
										>
											{suite.name}
										</a>
									</Table.Cell>
									<Table.Cell class="font-mono text-xs text-muted-foreground">
										{suite.repositoryOwner}/{suite.repositoryName}
									</Table.Cell>
									<Table.Cell class="font-mono text-xs">{suite.caseCount}</Table.Cell>
									<Table.Cell class="font-mono text-xs">
										{#if suite.latestRun}
											<a
												class="hover:underline"
												href={resolve(`/regression/runs/${suite.latestRun.id}`)}
											>
												{suite.latestRun.status}
											</a>
										{:else}
											<span class="text-muted-foreground">—</span>
										{/if}
									</Table.Cell>
									<Table.Cell class="font-mono text-xs">
										{suite.latestRun?.aggregateScore ?? '—'}
									</Table.Cell>
								</Table.Row>
							{/each}
						</Table.Body>
					</Table.Root>
				{:else}
					<div class="flex flex-col items-center gap-3 p-10 text-center">
						<ShieldCheck class="size-8 text-muted-foreground" />
						<p class="text-sm font-medium">No regression suites yet</p>
						<p class="max-w-md text-xs text-muted-foreground">
							Create a suite for a GitHub repository, add goal-based cases, and FlightLog will
							evaluate agent runs and report scores to GitHub Checks.
						</p>
					</div>
				{/if}
			</div>

			<div class="rounded-lg border border-border bg-card p-4">
				<div class="mb-4 flex items-center gap-2">
					<Plus class="size-3.5 text-primary" />
					<h2 class="font-mono text-xs font-medium">New Regression Suite</h2>
				</div>
				<div class="space-y-3">
					<div class="space-y-1.5">
						<Label class="font-mono text-xs">Name</Label>
						<Input bind:value={name} class="h-8 font-mono text-xs" placeholder="PR smoke tests" />
					</div>
					<div class="space-y-1.5">
						<Label class="font-mono text-xs">Description</Label>
						<Textarea
							bind:value={description}
							class="min-h-16 font-mono text-xs"
							placeholder="Runs core agent goals on every PR."
						/>
					</div>
					<div class="grid grid-cols-2 gap-2">
						<div class="space-y-1.5">
							<Label class="font-mono text-xs">Owner</Label>
							<Input
								bind:value={repositoryOwner}
								class="h-8 font-mono text-xs"
								placeholder="acme"
							/>
						</div>
						<div class="space-y-1.5">
							<Label class="font-mono text-xs">Repo</Label>
							<Input
								bind:value={repositoryName}
								class="h-8 font-mono text-xs"
								placeholder="support-agent"
							/>
						</div>
					</div>
					{#if error}
						<p class="font-mono text-xs text-destructive">{error}</p>
					{/if}
					<Button class="h-8 w-full text-xs" disabled={creating} onclick={createSuite}>
						<GitBranch class="mr-1.5 size-3.5" />
						{creating ? 'Creating…' : 'Create suite'}
					</Button>
				</div>
			</div>
		</div>
	</div>
</main>
