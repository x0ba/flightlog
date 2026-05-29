<script lang="ts">
	import { onMount } from 'svelte';
	import AuthWidgetLoading from '$lib/components/auth-widget-loading.svelte';

	let { data }: { data: { signUpUrl: string } } = $props();

	onMount(() => {
		window.location.href = data.signUpUrl;
	});
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
		<AuthWidgetLoading />
	</section>
</main>
