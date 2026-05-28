<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { browser } from '$app/environment';
	import RouteNavigationLoader from '$lib/components/route-navigation-loader.svelte';

	let { children } = $props();

	$effect(() => {
		if (!browser) return;
		document.documentElement.classList.add('app-ready');
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<RouteNavigationLoader scope="root" />
{@render children()}
