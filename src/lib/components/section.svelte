<script lang="ts">
	let {
		title,
		description,
		aside,
		children,
		padded = true,
		class: className = ''
	}: {
		title?: string;
		description?: string;
		aside?: import('svelte').Snippet;
		children: import('svelte').Snippet;
		padded?: boolean;
		class?: string;
	} = $props();
</script>

<section class="overflow-hidden rounded-xl border border-border/60 bg-card {className}">
	{#if title || aside || description}
		<div class="flex items-start justify-between gap-3 border-b border-border/60 px-5 py-3.5">
			<div class="min-w-0">
				{#if title}
					<h2 class="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
				{/if}
				{#if description}
					<p class="mt-0.5 text-xs text-muted-foreground">{description}</p>
				{/if}
			</div>
			{#if aside}
				<div class="flex shrink-0 items-center gap-2">{@render aside()}</div>
			{/if}
		</div>
	{/if}
	<div class={padded ? 'p-5' : ''}>
		{@render children()}
	</div>
</section>
