<script lang="ts">
	import SignedIn from 'clerk-sveltekit/client/SignedIn.svelte';
	import SignedOut from 'clerk-sveltekit/client/SignedOut.svelte';
	import UserButton from 'clerk-sveltekit/client/UserButton.svelte';
	import { resolve } from '$app/paths';
</script>

<div class="flex shrink-0 items-center">
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
</div>
