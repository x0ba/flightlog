<script lang="ts">
	import * as Accordion from '$lib/components/ui/accordion';
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
		Wrench
	} from '@lucide/svelte';

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

	function iconFor(type: string) {
		if (type === 'goal') return Target;
		if (type === 'browser_action') return MousePointerClick;
		if (type === 'observation') return Eye;
		if (type === 'reasoning_summary') return Brain;
		if (type === 'human_approval') return UserCheck;
		if (type === 'error') return TriangleAlert;
		if (type === 'final_result') return Flag;
		if (type === 'tool_call' || type === 'tool_result') return Wrench;
		return ListChecks;
	}

	function asJson(value: unknown) {
		return value == null ? '' : JSON.stringify(value, null, 2);
	}
</script>

<Accordion.Root type="multiple" class="flex flex-col gap-2">
	{#each events as event (event.publicId)}
		{@const Icon = iconFor(event.type)}
		<Accordion.Item
			value={event.publicId}
			class={`border border-border px-3 ${selectedSequence === event.sequence ? 'bg-muted' : ''}`}
		>
			<Accordion.Trigger onclick={() => onSelect(event.sequence)} class="hover:no-underline">
				<div class="flex min-w-0 flex-1 items-center gap-3 text-left">
					<Icon class="size-4 shrink-0 text-muted-foreground" />
					<span class="w-10 shrink-0 text-xs text-muted-foreground">#{event.sequence}</span>
					<div class="min-w-0 flex-1">
						<p class="truncate text-sm font-medium">{event.title ?? event.message ?? event.type}</p>
						<p class="truncate text-xs text-muted-foreground">{event.type}</p>
					</div>
					{#if event.status}<Badge variant="outline">{event.status}</Badge>{/if}
				</div>
			</Accordion.Trigger>
			<Accordion.Content>
				<div class="flex flex-col gap-3 pb-3 text-sm">
					{#if event.message}<p>{event.message}</p>{/if}
					{#if artifactsByEvent[event.sequence]?.length}
						<div class="flex flex-wrap gap-2">
							{#each artifactsByEvent[event.sequence] as artifact (artifact.publicId)}
								<Badge variant="secondary">{artifact.name ?? artifact.type}</Badge>
							{/each}
						</div>
					{/if}
					{#if event.data}
						<pre class="max-h-72 overflow-auto bg-background p-3 text-xs">{asJson(event.data)}</pre>
					{/if}
				</div>
			</Accordion.Content>
		</Accordion.Item>
	{/each}
</Accordion.Root>
