<script lang="ts">
	import AppShell from '$lib/components/app-shell.svelte';
	import RouteNavigationLoader from '$lib/components/route-navigation-loader.svelte';
	import posthog from 'posthog-js';
	import { browser } from '$app/environment';

	let { children, data } = $props();

	let previousUserId: string | null | undefined;

	$effect(() => {
		if (!browser) return;
		if (data.userId) {
			posthog.identify(data.userId);
		} else if (previousUserId) {
			posthog.reset();
		}
		previousUserId = data.userId;
	});
</script>

{#if data.userId}
	<span class="sr-only">Signed in</span>
{/if}
<AppShell userId={data.userId}>
	<div class="relative min-h-full">
		<RouteNavigationLoader scope="app" />
		{@render children()}
	</div>
</AppShell>
