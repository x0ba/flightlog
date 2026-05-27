<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import AppShell from '$lib/components/app-shell.svelte';
	import { page } from '$app/state';

	let { children, data } = $props();

	let useShell = $derived(
		!page.url.pathname.startsWith('/sign-in') && !page.url.pathname.startsWith('/sign-up')
	);
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{#if data.userId}
	<span class="sr-only">Signed in</span>
{/if}
{#if useShell}
	<AppShell userId={data.userId}>
		{@render children()}
	</AppShell>
{:else}
	{@render children()}
{/if}
