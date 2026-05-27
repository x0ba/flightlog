<script lang="ts">
	import SignedIn from 'clerk-sveltekit/client/SignedIn.svelte';
	import SignedOut from 'clerk-sveltekit/client/SignedOut.svelte';
	import UserButton from 'clerk-sveltekit/client/UserButton.svelte';
	import ClerkLoaded from 'clerk-sveltekit/client/ClerkLoaded.svelte';
	import ClerkLoading from 'clerk-sveltekit/client/ClerkLoading.svelte';
	import { resolve } from '$app/paths';

	let { userId = null }: { userId?: string | null } = $props();

	const loadingSkeletonClass = $derived(
		userId
			? 'h-8 w-8 animate-pulse rounded-md bg-muted ring-1 ring-border'
			: 'h-8 w-16 animate-pulse rounded-md bg-muted'
	);
	const loadingLabel = $derived(userId ? 'Loading account' : 'Loading sign in status');
</script>

<div class="flex shrink-0 items-center">
	<ClerkLoading>
		<div class={loadingSkeletonClass} aria-hidden="true"></div>
		<span class="sr-only">{loadingLabel}</span>
	</ClerkLoading>
	<ClerkLoaded>
		<SignedIn>
			<UserButton
				afterSignOutUrl="/sign-in"
				appearance={{
					elements: {
						rootBox: 'flex items-center',
						avatarBox: 'h-8 w-8 rounded-md ring-1 ring-border'
					}
				}}
			/>
		</SignedIn>
		<SignedOut>
			<a
				class="rounded-md border border-border bg-card px-3 py-1.5 font-mono text-xs text-foreground transition-colors hover:bg-secondary"
				href={resolve('/sign-in')}
			>
				Sign in
			</a>
		</SignedOut>
	</ClerkLoaded>
</div>
