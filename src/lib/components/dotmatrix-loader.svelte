<script lang="ts">
	import { DotmSquare4 } from '$lib/components/ui/dotmatrix';
	import { cn } from '$lib/utils';

	type Variant = 'page' | 'boot' | 'content' | 'panel' | 'inline';

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
		boot: { size: 48, dotSize: 6, boxSize: 64, speed: 1.35, bloom: true, halo: 0.4 },
		content: { size: 44, dotSize: 5.5, boxSize: 60, speed: 1.35, bloom: true, halo: 0.35 },
		page: { size: 48, dotSize: 6, boxSize: 64, speed: 1.35, bloom: true, halo: 0.4 },
		panel: { size: 40, dotSize: 5, boxSize: 56, speed: 1.35, bloom: true, halo: 0.35 }
	} as const;

	const bootDelays = Array.from({ length: 25 }, (_, index) => `${index * 90}ms`);
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
{:else if variant === 'boot'}
	<div class={cn('grid min-h-screen w-full place-items-center bg-[#100f12] px-4 py-12', className)}>
		<div class="boot-dmx" aria-label={ariaLabel} role="status">
			{#each bootDelays as delay (delay)}
				<span style:animation-delay={delay}></span>
			{/each}
		</div>
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

<style>
	.boot-dmx {
		display: grid;
		grid-template-columns: repeat(5, 6px);
		grid-template-rows: repeat(5, 6px);
		gap: 3px;
	}

	.boot-dmx span {
		width: 6px;
		height: 6px;
		border-radius: 999px;
		background: oklch(0.78 0.12 75);
		opacity: 0.2;
		animation: boot-dmx-pulse 1.35s ease-in-out infinite;
	}

	@keyframes boot-dmx-pulse {
		0%,
		100% {
			opacity: 0.18;
			transform: scale(0.92);
		}
		50% {
			opacity: 1;
			transform: scale(1);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.boot-dmx span {
			animation: none;
			opacity: 0.55;
		}
	}
</style>
