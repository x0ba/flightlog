<script lang="ts">
	import * as Tabs from '$lib/components/ui/tabs';
	import { ImageOff } from '@lucide/svelte';

	type Artifact = {
		publicId: string;
		type: string;
		name: string | null;
		mimeType: string | null;
		url: string | null;
		content: string | null;
	};

	let { artifact }: { artifact: Artifact | undefined } = $props();

	function displayContent(value: string | null) {
		if (!value) return '';
		try {
			return JSON.stringify(JSON.parse(value), null, 2);
		} catch {
			return value;
		}
	}
</script>

{#key artifact?.publicId}
{#if artifact}
	<div class="flex min-h-56 flex-col border border-border">
		<div class="flex items-center justify-between border-b border-border px-3 py-1.5">
			<p class="font-mono text-xs font-medium">{artifact.name ?? artifact.type}</p>
			<p class="font-mono text-[10px] text-muted-foreground">
				{artifact.mimeType ?? artifact.publicId}
			</p>
		</div>
		{#if artifact.type === 'screenshot' && (artifact.content || artifact.url)}
			<img
				class="max-h-[400px] w-full object-contain"
				src={artifact.content ?? artifact.url ?? ''}
				alt={artifact.name ?? 'Run screenshot'}
			/>
		{:else}
			<Tabs.Root value="content" class="flex min-h-0 flex-1 flex-col">
				<Tabs.List class="m-2 w-fit">
					<Tabs.Trigger value="content" class="font-mono text-xs">Content</Tabs.Trigger>
					<Tabs.Trigger value="url" class="font-mono text-xs">URL</Tabs.Trigger>
				</Tabs.List>
				<Tabs.Content value="content" class="m-0 min-h-0 flex-1">
					<pre
						class="max-h-[400px] overflow-auto p-3 font-mono text-xs text-muted-foreground">{displayContent(
							artifact.content
						)}</pre>
				</Tabs.Content>
				<Tabs.Content value="url" class="m-0 p-3 font-mono text-xs">
					{#if artifact.url}<span class="break-all">{artifact.url}</span>{:else}No URL{/if}
				</Tabs.Content>
			</Tabs.Root>
		{/if}
	</div>
{:else}
	<div
		class="flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg bg-secondary/30 p-6"
	>
		<ImageOff class="size-5 text-muted-foreground/50" />
		<p class="font-mono text-xs text-muted-foreground/70">No artifact for this event</p>
	</div>
{/if}
{/key}
