<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import {
		Brain,
		Eye,
		Flag,
		ListChecks,
		MousePointerClick,
		Target,
		TriangleAlert,
		UserCheck,
		Wrench,
		ChevronDown
	} from '@lucide/svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { slide } from 'svelte/transition';

	type EventRow = {
		publicId: string;
		sequence: number;
		type: string;
		title: string | null;
		message: string | null;
		status: string | null;
		data: unknown;
		occurredAt: string | Date;
	};
	type Artifact = { publicId: string; eventId: number | null; type: string; name: string | null };

	let {
		events,
		artifactsByEvent,
		selectedSequence,
		onSelect
	}: {
		events: EventRow[];
		artifactsByEvent: Record<number, Artifact[]>;
		selectedSequence: number;
		onSelect: (sequence: number) => void;
	} = $props();

	let expandedEvents = new SvelteSet<string>();

	function iconFor(type: string) {
		if (type === 'goal' || type === 'goal.set') return Target;
		if (type === 'browser_action' || type.startsWith('browser_action.')) return MousePointerClick;
		if (type === 'observation' || type === 'observation.created') return Eye;
		if (type === 'reasoning_summary' || type === 'reasoning_summary.created') return Brain;
		if (type === 'human_approval' || type.startsWith('approval.')) return UserCheck;
		if (type === 'error' || type.endsWith('.failed')) return TriangleAlert;
		if (type === 'final_result' || type.startsWith('trace.')) return Flag;
		if (type === 'tool_call' || type === 'tool_result' || type.startsWith('tool_call.'))
			return Wrench;
		if (type.startsWith('model_call.')) return Brain;
		return ListChecks;
	}

	function asJson(value: unknown) {
		return value == null ? '' : JSON.stringify(value, null, 2);
	}

	function toggleExpand(publicId: string) {
		if (expandedEvents.has(publicId)) expandedEvents.delete(publicId);
		else expandedEvents.add(publicId);
	}
</script>

<div class="relative flex flex-col">
	<!-- Vertical line -->
	<div class="absolute top-0 bottom-0 left-[11px] w-px bg-border/50"></div>

	{#each events as event (event.publicId)}
		{@const Icon = iconFor(event.type)}
		{@const isSelected = selectedSequence === event.sequence}
		{@const isExpanded = expandedEvents.has(event.publicId)}
		<div
			class="group relative flex gap-3 py-1 pl-0 transition-colors duration-150 hover:bg-secondary/20 {isSelected
				? 'bg-secondary/30'
				: ''}"
		>
			<!-- Dot / icon on the line -->
			<div
				class="relative z-10 flex size-[23px] shrink-0 items-center justify-center bg-background"
			>
				<div
					class="flex size-[23px] items-center justify-center border transition-all duration-150 {isSelected
						? 'border-primary bg-primary/10'
						: 'border-border'}"
				>
					<Icon class="size-3 {isSelected ? 'text-primary' : 'text-muted-foreground'}" />
				</div>
			</div>

			<!-- Content -->
			<div class="min-w-0 flex-1 pb-1">
				<button
					type="button"
					class="flex w-full items-center gap-2 text-left"
					onclick={() => {
						onSelect(event.sequence);
						toggleExpand(event.publicId);
					}}
				>
					<span class="w-7 shrink-0 font-mono text-[10px] text-muted-foreground"
						>{event.sequence}</span
					>
					<span class="min-w-0 flex-1 truncate text-sm" class:font-medium={isSelected}
						>{event.title ?? event.message ?? event.type}</span
					>
					<span class="font-mono text-[10px] text-muted-foreground">{event.type}</span>
					{#if event.status}<Badge variant="outline" class="ml-1 text-[10px]">{event.status}</Badge
						>{/if}
					<ChevronDown
						class="size-3 shrink-0 text-muted-foreground transition-transform {isExpanded
							? 'rotate-180'
							: ''}"
					/>
				</button>

				{#if isExpanded}
					<div class="mt-2 flex flex-col gap-2 text-sm" transition:slide={{ duration: 150 }}>
						{#if event.message}<p class="text-xs text-muted-foreground">{event.message}</p>{/if}
						{#if artifactsByEvent[event.sequence]?.length}
							<div class="flex flex-wrap gap-1">
								{#each artifactsByEvent[event.sequence] as artifact (artifact.publicId)}
									<Badge variant="secondary" class="font-mono text-[10px]"
										>{artifact.name ?? artifact.type}</Badge
									>
								{/each}
							</div>
						{/if}
						{#if event.data}
							<pre
								class="max-h-60 overflow-auto border border-border bg-background p-3 font-mono text-xs text-muted-foreground">{asJson(
									event.data
								)}</pre>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	{/each}
</div>
