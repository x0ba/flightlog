<script lang="ts">
	import SignedIn from 'clerk-sveltekit/client/SignedIn.svelte';
	import SignedOut from 'clerk-sveltekit/client/SignedOut.svelte';
	import UserButton from 'clerk-sveltekit/client/UserButton.svelte';
	import ClerkLoaded from 'clerk-sveltekit/client/ClerkLoaded.svelte';
	import ClerkLoading from 'clerk-sveltekit/client/ClerkLoading.svelte';
	import { resolve } from '$app/paths';

	let { userId = null }: { userId?: string | null } = $props();
</script>

<div class="flex shrink-0 items-center">
	{#if userId}
		<ClerkLoading>
			<div
				class="h-8 w-8 animate-pulse rounded-md bg-muted ring-1 ring-border"
				aria-hidden="true"
			></div>
			<span class="sr-only">Loading account</span>
		</ClerkLoading>
		<ClerkLoaded>
			<UserButton
				afterSignOutUrl="/sign-in"
				appearance={{
					elements: {
						rootBox: 'flex items-center',
						avatarBox: 'h-8 w-8 rounded-md ring-1 ring-border'
					}
				}}
			/>
		</ClerkLoaded>
	{:else}
		<ClerkLoading>
			<div class="h-8 w-16 animate-pulse rounded-md bg-muted" aria-hidden="true"></div>
			<span class="sr-only">Loading sign in status</span>
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
	{/if}
</div>
