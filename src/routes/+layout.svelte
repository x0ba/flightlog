<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import SignedIn from 'clerk-sveltekit/client/SignedIn.svelte';
	import SignedOut from 'clerk-sveltekit/client/SignedOut.svelte';
	import UserButton from 'clerk-sveltekit/client/UserButton.svelte';
	import { resolve } from '$app/paths';

	let { children, data } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<div class="fixed top-3 right-3 z-50 flex items-center gap-2">
	<SignedIn>
		<UserButton afterSignOutUrl="/sign-in" />
	</SignedIn>
	<SignedOut>
		<a
			class="rounded-md border border-border bg-background px-3 py-1.5 font-mono text-xs text-foreground shadow-sm transition-colors hover:bg-secondary"
			href={resolve('/sign-in')}
		>
			Sign in
		</a>
	</SignedOut>
	{#if data.userId}
		<span class="sr-only">Signed in</span>
	{/if}
</div>
{@render children()}
