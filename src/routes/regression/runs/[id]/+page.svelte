<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import * as Table from '$lib/components/ui/table';
	import { resolve } from '$app/paths';
	import PageHeader from '$lib/components/page-header.svelte';
	import Section from '$lib/components/section.svelte';
	import StatusPill from '$lib/components/status-pill.svelte';

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

<svelte:head><title>Regression run · FlightLog</title></svelte:head>

<div class="mx-auto w-full max-w-6xl px-6 py-10 lg:px-10">
	<PageHeader
		title="Regression run"
		description={data.regressionRun.summary ?? 'Regression suite execution in progress.'}
		breadcrumbs={[
			{ label: 'Regression', href: '/regression' },
			{ label: data.suite.name, href: `/regression/${data.suite.publicId}` },
			{ label: 'Run' }
		]}
	/>

	<div class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
		<div class="rounded-xl border border-border/60 bg-card px-4 py-3.5">
			<p class="text-xs text-muted-foreground">Status</p>
			<div class="mt-1.5"><StatusPill status={data.regressionRun.status} size="md" /></div>
		</div>
		<div class="rounded-xl border border-border/60 bg-card px-4 py-3.5">
			<p class="text-xs text-muted-foreground">Result</p>
			<p
				class="mt-1.5 font-mono text-lg font-semibold tracking-tight"
				class:text-status-success={data.regressionRun.passed === true}
				class:text-status-failed={data.regressionRun.passed === false}
			>
				{data.regressionRun.passed === null ? '—' : data.regressionRun.passed ? 'pass' : 'fail'}
			</p>
		</div>
		<div class="rounded-xl border border-border/60 bg-card px-4 py-3.5">
			<p class="text-xs text-muted-foreground">Aggregate score</p>
			<p class="mt-1.5 font-mono text-lg font-semibold tracking-tight">
				{data.regressionRun.aggregateScore ?? '—'}
			</p>
		</div>
		<div class="rounded-xl border border-border/60 bg-card px-4 py-3.5">
			<p class="text-xs text-muted-foreground">Completed</p>
			<p class="mt-1.5 font-mono text-xs">{formatDate(data.regressionRun.completedAt)}</p>
		</div>
	</div>

	<Section title="Cases" padded={false}>
		<Table.Root>
			<Table.Header>
				<Table.Row class="border-border/60 hover:bg-transparent">
					<Table.Head class="pl-5 text-xs text-muted-foreground">Case</Table.Head>
					<Table.Head class="text-xs text-muted-foreground">Status</Table.Head>
					<Table.Head class="text-xs text-muted-foreground">Score</Table.Head>
					<Table.Head class="text-xs text-muted-foreground">Trace</Table.Head>
					<Table.Head class="pr-5 text-xs text-muted-foreground">Reason</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each data.caseRuns as caseRun (caseRun.publicId)}
					<Table.Row class="border-border/60">
						<Table.Cell class="pl-5 text-sm font-medium tracking-tight"
							>{caseRun.testCase.name}</Table.Cell
						>
						<Table.Cell><StatusPill status={caseRun.status} /></Table.Cell>
						<Table.Cell class="font-mono text-xs">{caseRun.score ?? '—'}</Table.Cell>
						<Table.Cell class="font-mono text-xs">
							{#if caseRun.runPublicId}
								<a
									class="hover:text-primary hover:underline"
									href={resolve(`/runs/${caseRun.runPublicId}`)}
								>
									Open trace →
								</a>
							{:else}
								<span class="text-muted-foreground">—</span>
							{/if}
						</Table.Cell>
						<Table.Cell class="pr-5 text-xs text-muted-foreground">
							{caseRun.failureReason ?? '—'}
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</Section>
</div>
