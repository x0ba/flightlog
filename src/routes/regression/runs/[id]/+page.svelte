<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import * as Table from '$lib/components/ui/table';
	import { resolve } from '$app/paths';

	let { data } = $props();
	let isActiveRun = $derived(['pending', 'running'].includes(data.regressionRun.status));

	$effect(() => {
		if (!isActiveRun) return;
		const interval = window.setInterval(() => void invalidateAll(), 3000);
		return () => window.clearInterval(interval);
	});

	function formatDate(value: string | Date | null) {
		if (!value) return '—';
		return new Intl.DateTimeFormat('en', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		}).format(new Date(value));
	}
</script>

<svelte:head><title>Regression Run | FlightLog</title></svelte:head>

<main class="min-h-screen bg-background">
	<div class="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
		<header>
			<a
				class="font-mono text-xs text-muted-foreground hover:underline"
				href={resolve(`/regression/${data.suite.publicId}`)}
			>
				{data.suite.name}
			</a>
			<h1 class="mt-1 font-mono text-sm font-semibold tracking-wider uppercase">Regression Run</h1>
			<p class="mt-1 text-xs text-muted-foreground">
				{data.regressionRun.summary ?? 'Regression suite execution in progress.'}
			</p>
		</header>

		<div
			class="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border sm:grid-cols-4"
		>
			<div class="bg-card px-4 py-3">
				<p class="font-mono text-lg font-semibold">{data.regressionRun.status}</p>
				<p class="text-xs text-muted-foreground">Status</p>
			</div>
			<div class="bg-card px-4 py-3">
				<p class="font-mono text-lg font-semibold">
					{data.regressionRun.passed === null ? '—' : data.regressionRun.passed ? 'pass' : 'fail'}
				</p>
				<p class="text-xs text-muted-foreground">Result</p>
			</div>
			<div class="bg-card px-4 py-3">
				<p class="font-mono text-lg font-semibold">{data.regressionRun.aggregateScore ?? '—'}</p>
				<p class="text-xs text-muted-foreground">Aggregate Score</p>
			</div>
			<div class="bg-card px-4 py-3">
				<p class="font-mono text-lg font-semibold">{formatDate(data.regressionRun.completedAt)}</p>
				<p class="text-xs text-muted-foreground">Completed</p>
			</div>
		</div>

		<div class="overflow-hidden rounded-lg border border-border bg-card">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head class="font-mono text-xs">Case</Table.Head>
						<Table.Head class="font-mono text-xs">Status</Table.Head>
						<Table.Head class="font-mono text-xs">Score</Table.Head>
						<Table.Head class="font-mono text-xs">Trace</Table.Head>
						<Table.Head class="font-mono text-xs">Reason</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each data.caseRuns as caseRun (caseRun.publicId)}
						<Table.Row>
							<Table.Cell class="font-mono text-xs">{caseRun.testCase.name}</Table.Cell>
							<Table.Cell class="font-mono text-xs">{caseRun.status}</Table.Cell>
							<Table.Cell class="font-mono text-xs">{caseRun.score ?? '—'}</Table.Cell>
							<Table.Cell class="font-mono text-xs">
								{#if caseRun.runPublicId}
									<a class="hover:underline" href={resolve(`/runs/${caseRun.runPublicId}`)}>
										Open trace
									</a>
								{:else}
									<span class="text-muted-foreground">—</span>
								{/if}
							</Table.Cell>
							<Table.Cell class="text-xs text-muted-foreground">
								{caseRun.failureReason ?? '—'}
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</div>
	</div>
</main>
