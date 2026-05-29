<script lang="ts">
	import { page } from '$app/state';
	import AuthWidgetLoading from '$lib/components/auth-widget-loading.svelte';
	import PostAuthRedirect from '$lib/components/post-auth-redirect.svelte';
	import ClerkLoaded from 'clerk-sveltekit/client/ClerkLoaded.svelte';
	import ClerkLoading from 'clerk-sveltekit/client/ClerkLoading.svelte';
	import SignIn from 'clerk-sveltekit/client/SignIn.svelte';
	import { safeRedirectPath } from '$lib/auth-redirect';

	const redirectUrl = $derived(
		safeRedirectPath(
			page.url.searchParams.get('redirect_url') ??
				page.url.searchParams.get('redirectUrl') ??
				page.url.searchParams.get('redirectAfterAuth')
		)
	);
</script>

<svelte:head><title>Sign in | FlightLog</title></svelte:head>

<main class="grid min-h-screen place-items-center bg-background px-4 py-12">
	<section class="flex w-full max-w-md flex-col items-center gap-6">
		<div class="text-center">
			<p class="font-mono text-xs tracking-wider text-muted-foreground uppercase">
				Agent Observability and CI Regression
			</p>
			<h1 class="mt-2 text-2xl font-semibold text-foreground">Sign in to FlightLog</h1>
		</div>
		<ClerkLoading>
			<AuthWidgetLoading />
		</ClerkLoading>
		<ClerkLoaded let:clerk>
			{#if clerk?.user}
				<PostAuthRedirect to={redirectUrl} />
				<AuthWidgetLoading />
			{:else}
				<SignIn {redirectUrl} signUpUrl="/sign-up" />
			{/if}
		</ClerkLoaded>
	</section>
</main>
