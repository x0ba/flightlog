<script lang="ts">
	import { navigating } from '$app/state';
	import { browser } from '$app/environment';
	import DotMatrixLoader from '$lib/components/dotmatrix-loader.svelte';

	let { scope }: { scope: 'app' | 'root' } = $props();

	function isAppPath(pathname: string | undefined) {
		if (!pathname) return false;
		return (
			pathname === '/runs' || pathname.startsWith('/runs/') || pathname.startsWith('/regression')
		);
	}

	const active = $derived.by(() => {
		if (!browser || !navigating.to) return false;
		const fromApp = isAppPath(navigating.from?.url.pathname);
		const toApp = isAppPath(navigating.to.url.pathname);
		if (scope === 'app') return fromApp && toApp;
		return !fromApp || !toApp;
	});
</script>

{#if active}
	{#if scope === 'app'}
		<div
			class="absolute inset-0 z-10 flex items-center justify-center bg-background/78 backdrop-blur-[1px]"
			aria-hidden="true"
		>
			<DotMatrixLoader variant="content" />
		</div>
	{:else}
		<div class="fixed inset-0 z-50 bg-background" aria-hidden="true">
			<DotMatrixLoader variant="boot" />
		</div>
	{/if}
{/if}
