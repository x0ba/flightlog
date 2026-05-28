<script lang="ts">
	import { DotmSquare4 } from '$lib/components/ui/dotmatrix';
	import { cn } from '$lib/utils';

	type Variant = 'page' | 'content' | 'panel' | 'inline';

	let {
		variant = 'page',
		label,
		ariaLabel = label ?? 'Loading',
		class: className
	}: {
		variant?: Variant;
		label?: string;
		ariaLabel?: string;
		class?: string;
	} = $props();

	const preset = {
		inline: { size: 16, dotSize: 2.5, boxSize: 16, speed: 1.5, bloom: false, halo: 0 },
		content: { size: 44, dotSize: 5.5, boxSize: 60, speed: 1.35, bloom: true, halo: 0.35 },
		page: { size: 48, dotSize: 6, boxSize: 64, speed: 1.35, bloom: true, halo: 0.4 },
		panel: { size: 40, dotSize: 5, boxSize: 56, speed: 1.35, bloom: true, halo: 0.35 }
	} as const;

	const config = $derived(preset[variant]);
</script>

{#if variant === 'inline'}
	<DotmSquare4
		className={cn('text-primary', className)}
		colorPreset="solid-theme"
		animated
		pattern="full"
		{ariaLabel}
		size={config.size}
		dotSize={config.dotSize}
		boxSize={config.boxSize}
		speed={config.speed}
		bloom={config.bloom}
		halo={config.halo}
	/>
{:else if variant === 'panel'}
	<div
		class={cn(
			'flex h-[28rem] w-full max-w-[25rem] flex-col items-center justify-center gap-3 rounded-lg border border-border/60 bg-card/40 px-6',
			className
		)}
	>
		<DotmSquare4
			className="text-primary"
			colorPreset="solid-theme"
			animated
			pattern="full"
			{ariaLabel}
			size={config.size}
			dotSize={config.dotSize}
			boxSize={config.boxSize}
			speed={config.speed}
			bloom={config.bloom}
			halo={config.halo}
		/>
		{#if label}
			<p class="font-mono text-xs tracking-wider text-muted-foreground uppercase">{label}</p>
		{/if}
	</div>
{:else if variant === 'content'}
	<div
		class={cn(
			'flex min-h-[min(60vh,32rem)] w-full flex-col items-center justify-center gap-3 py-16',
			className
		)}
	>
		<DotmSquare4
			className="text-primary"
			colorPreset="solid-theme"
			animated
			pattern="full"
			{ariaLabel}
			size={config.size}
			dotSize={config.dotSize}
			boxSize={config.boxSize}
			speed={config.speed}
			bloom={config.bloom}
			halo={config.halo}
		/>
		{#if label}
			<p class="font-mono text-xs tracking-wider text-muted-foreground uppercase">{label}</p>
		{/if}
	</div>
{:else}
	<div
		class={cn('grid min-h-screen w-full place-items-center bg-background px-4 py-12', className)}
	>
		<div class="flex flex-col items-center gap-3">
			<DotmSquare4
				className="text-primary"
				colorPreset="solid-theme"
				animated
				pattern="full"
				{ariaLabel}
				size={config.size}
				dotSize={config.dotSize}
				boxSize={config.boxSize}
				speed={config.speed}
				bloom={config.bloom}
				halo={config.halo}
			/>
			{#if label}
				<p class="font-mono text-xs tracking-wider text-muted-foreground uppercase">{label}</p>
			{/if}
		</div>
	</div>
{/if}
