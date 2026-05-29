<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';

	let { to }: { to: `/${string}` } = $props();

	onMount(() => {
		window.location.replace(`${base}${to}`);
	});
</script>
