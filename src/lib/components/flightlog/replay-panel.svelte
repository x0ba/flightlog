<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Pause, Play, SkipBack, SkipForward } from '@lucide/svelte';
	import ArtifactPreview from './artifact-preview.svelte';

	type EventRow = { sequence: number; title: string | null; message: string | null; type: string };
	type Artifact = {
		publicId: string;
		type: string;
		name: string | null;
		mimeType: string | null;
		url: string | null;
		content: string | null;
		eventId: number | null;
		eventSequence?: number | null;
	};

	let {
		events,
		artifacts,
		selectedSequence,
		onSelect
	}: {
		events: EventRow[];
		artifacts: Artifact[];
		selectedSequence: number;
		onSelect: (sequence: number) => void;
	} = $props();

	let playing = $state(false);
	let timer: ReturnType<typeof setInterval> | undefined;
	let selectedEvent = $derived(
		events.find((event) => event.sequence === selectedSequence) ?? events[0]
	);
	let selectedIndex = $derived(events.findIndex((event) => event.sequence === selectedSequence));
	let selectedArtifact = $derived(findArtifact());

	function findArtifact() {
		const direct = artifacts.find((artifact) => artifact.eventSequence === selectedSequence);
		if (direct) return direct;
		const previousScreenshots = artifacts.filter(
			(artifact) =>
				artifact.type === 'screenshot' &&
				artifact.eventSequence !== null &&
				artifact.eventSequence !== undefined &&
				artifact.eventSequence <= selectedSequence
		);
		return previousScreenshots.at(-1);
	}

	function move(delta: number) {
		if (!events.length) return;
		const nextIndex = Math.min(Math.max(selectedIndex + delta, 0), events.length - 1);
		onSelect(events[nextIndex].sequence);
	}

	function toggle() {
		playing = !playing;
		if (playing) {
			timer = setInterval(() => {
				const index = events.findIndex((event) => event.sequence === selectedSequence);
				if (index >= events.length - 1) {
					playing = false;
					if (timer) clearInterval(timer);
					return;
				}
				onSelect(events[index + 1].sequence);
			}, 800);
		} else if (timer) {
			clearInterval(timer);
		}
	}
</script>

<div class="flex flex-col gap-3">
	<div class="flex items-center justify-between gap-2">
		<div class="min-w-0">
			<p class="truncate text-sm font-medium">
				{selectedEvent?.title ?? selectedEvent?.message ?? 'No events'}
			</p>
			<p class="text-xs text-muted-foreground">{selectedEvent?.type ?? 'empty'}</p>
		</div>
		<div class="flex gap-1">
			<Button variant="outline" size="icon" onclick={() => move(-1)} aria-label="Previous event">
				<SkipBack class="size-4" />
			</Button>
			<Button variant="outline" size="icon" onclick={toggle} aria-label="Play replay">
				{#if playing}<Pause class="size-4" />{:else}<Play class="size-4" />{/if}
			</Button>
			<Button variant="outline" size="icon" onclick={() => move(1)} aria-label="Next event">
				<SkipForward class="size-4" />
			</Button>
		</div>
	</div>
	<ArtifactPreview artifact={selectedArtifact} />
</div>
