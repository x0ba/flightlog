<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Activity, GitBranch, Menu, X } from '@lucide/svelte';
	import AuthCorner from '$lib/components/auth-corner.svelte';

	let { children, userId = null }: { children: import('svelte').Snippet; userId?: string | null } =
		$props();
	let mobileOpen = $state(false);

	const nav = [
		{
			href: '/runs' as const,
			label: 'Runs',
			icon: Activity,
			match: (p: string) => p === '/runs' || p.startsWith('/runs/')
		},
		{
			href: '/regression' as const,
			label: 'Regression',
			icon: GitBranch,
			match: (p: string) => p.startsWith('/regression')
		}
	] as const;

	let pathname = $derived(page.url.pathname);
</script>

<div class="flex min-h-screen bg-background">
	<!-- Sidebar -->
	<aside
		class="fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-border/60 bg-sidebar transition-transform lg:static lg:translate-x-0 {mobileOpen
			? 'translate-x-0'
			: '-translate-x-full'}"
	>
		<div class="flex items-center gap-2.5 px-5 pt-5 pb-6">
			<div
				class="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 ring-1 ring-primary/30"
			>
				<svg
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.6"
					class="text-primary"
				>
					<path
						d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"
					/>
				</svg>
			</div>
			<div class="leading-tight">
				<p class="text-[15px] font-semibold tracking-tight">FlightLog</p>
				<p class="font-mono text-[10px] tracking-wider text-muted-foreground/80 uppercase">
					Agent observability
				</p>
			</div>
			<button
				class="ml-auto rounded-md p-1.5 text-muted-foreground hover:bg-secondary lg:hidden"
				onclick={() => (mobileOpen = false)}
				aria-label="Close navigation"
			>
				<X class="size-4" />
			</button>
		</div>

		<nav class="flex flex-col gap-0.5 px-3">
			{#each nav as item (item.href)}
				{@const active = item.match(pathname)}
				<a
					href={resolve(item.href)}
					onclick={() => (mobileOpen = false)}
					class="group flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors {active
						? 'bg-accent text-foreground'
						: 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'}"
				>
					<item.icon
						class="size-4 transition-colors {active
							? 'text-primary'
							: 'text-muted-foreground/70 group-hover:text-foreground'}"
					/>
					<span class="font-medium tracking-tight">{item.label}</span>
				</a>
			{/each}
		</nav>

		<div class="mt-auto border-t border-border/60 px-4 py-3">
			<AuthCorner {userId} />
		</div>
	</aside>

	{#if mobileOpen}
		<button
			class="fixed inset-0 z-30 bg-background/70 backdrop-blur-sm lg:hidden"
			onclick={() => (mobileOpen = false)}
			aria-label="Close navigation overlay"
		></button>
	{/if}

	<!-- Main column -->
	<div class="flex min-w-0 flex-1 flex-col">
		<div
			class="sticky top-0 z-20 flex items-center gap-3 border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur lg:hidden"
		>
			<button
				class="rounded-md p-1.5 text-muted-foreground hover:bg-secondary"
				onclick={() => (mobileOpen = true)}
				aria-label="Open navigation"
			>
				<Menu class="size-4" />
			</button>
			<span class="text-sm font-semibold tracking-tight">FlightLog</span>
		</div>
		<main class="min-w-0 flex-1">
			{@render children()}
		</main>
	</div>
</div>
