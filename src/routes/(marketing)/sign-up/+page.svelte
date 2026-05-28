<script lang="ts">
	import AuthWidgetLoading from '$lib/components/auth-widget-loading.svelte';
	import ClerkLoaded from 'clerk-sveltekit/client/ClerkLoaded.svelte';
	import ClerkLoading from 'clerk-sveltekit/client/ClerkLoading.svelte';
	import SignUp from 'clerk-sveltekit/client/SignUp.svelte';
</script>

<svelte:head><title>Sign up | FlightLog</title></svelte:head>

<main class="grid min-h-screen place-items-center bg-background px-4 py-12">
	<section class="flex w-full max-w-md flex-col items-center gap-6">
		<div class="text-center">
			<p class="font-mono text-xs tracking-wider text-muted-foreground uppercase">
				Agent Observability and CI Regression
			</p>
			<h1 class="mt-2 text-2xl font-semibold text-foreground">Create your FlightLog account</h1>
		</div>
		<ClerkLoading>
			<AuthWidgetLoading />
		</ClerkLoading>
		<ClerkLoaded>
			<SignUp redirectUrl="/runs" signInUrl="/sign-in" />
		</ClerkLoaded>
	</section>
</main>
