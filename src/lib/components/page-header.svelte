<script lang="ts">
	import { ChevronRight } from '@lucide/svelte';

	type Crumb = { label: string; href?: string };

	let {
		eyebrow,
		title,
		description,
		breadcrumbs = [] as Crumb[],
		actions,
		meta
	}: {
		eyebrow?: string;
		title: string;
		description?: string;
		breadcrumbs?: Crumb[];
		actions?: import('svelte').Snippet;
		meta?: import('svelte').Snippet;
	} = $props();
</script>

<header class="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 pb-6">
	<div class="min-w-0">
		{#if breadcrumbs.length}
			<nav
				class="mb-2 flex flex-wrap items-center gap-1 font-mono text-[11px] text-muted-foreground"
			>
				{#each breadcrumbs as crumb, i (crumb.label)}
					{#if crumb.href}
						<a class="transition-colors hover:text-foreground" href={crumb.href}>
							{crumb.label}
						</a>
					{:else}
						<span>{crumb.label}</span>
					{/if}
					{#if i < breadcrumbs.length - 1}
						<ChevronRight class="size-3 text-muted-foreground/50" />
					{/if}
				{/each}
			</nav>
		{:else if eyebrow}
			<p class="mb-1.5 font-mono text-[11px] tracking-[0.14em] text-muted-foreground/80 uppercase">
				{eyebrow}
			</p>
		{/if}
		<h1 class="text-2xl leading-tight font-semibold tracking-tight text-foreground">
			{title}
		</h1>
		{#if description}
			<p class="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
		{/if}
		{#if meta}
			<div class="mt-3">{@render meta()}</div>
		{/if}
	</div>
	{#if actions}
		<div class="flex flex-wrap items-center gap-2">{@render actions()}</div>
	{/if}
</header>
