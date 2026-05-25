<script lang="ts">
	import * as Tabs from '$lib/components/ui/tabs';

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

{#if artifact}
	<div class="flex min-h-64 flex-col border border-border">
		<div class="border-b border-border px-3 py-2">
			<p class="text-sm font-medium">{artifact.name ?? artifact.type}</p>
			<p class="text-xs text-muted-foreground">{artifact.mimeType ?? artifact.publicId}</p>
		</div>
		{#if artifact.type === 'screenshot' && (artifact.content || artifact.url)}
			<img
				class="max-h-[420px] w-full object-contain"
				src={artifact.content ?? artifact.url ?? ''}
				alt={artifact.name ?? 'Run screenshot'}
			/>
		{:else}
			<Tabs.Root value="content" class="flex min-h-0 flex-1 flex-col">
				<Tabs.List class="m-2 w-fit">
					<Tabs.Trigger value="content">Content</Tabs.Trigger>
					<Tabs.Trigger value="url">URL</Tabs.Trigger>
				</Tabs.List>
				<Tabs.Content value="content" class="m-0 min-h-0 flex-1">
					<pre class="max-h-[420px] overflow-auto p-3 text-xs">{displayContent(
							artifact.content
						)}</pre>
				</Tabs.Content>
				<Tabs.Content value="url" class="m-0 p-3 text-sm">
					{#if artifact.url}<span class="break-all">{artifact.url}</span>{:else}No URL{/if}
				</Tabs.Content>
			</Tabs.Root>
		{/if}
	</div>
{:else}
	<div
		class="flex min-h-64 items-center justify-center border border-dashed border-border p-6 text-sm text-muted-foreground"
	>
		No artifact selected
	</div>
{/if}
