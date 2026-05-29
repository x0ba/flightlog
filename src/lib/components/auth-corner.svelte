<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		DropdownMenu,
		DropdownMenuContent,
		DropdownMenuItem,
		DropdownMenuLabel,
		DropdownMenuSeparator,
		DropdownMenuTrigger
	} from '$lib/components/ui/dropdown-menu';

	let { userId = null, email = null }: { userId?: string | null; email?: string | null } = $props();

	const initials = $derived.by(() => {
		if (email) {
			const local = email.split('@')[0] ?? '';
			return local.slice(0, 2).toUpperCase() || '?';
		}
		if (userId) return userId.slice(-2).toUpperCase();
		return '?';
	});
</script>

<div class="flex shrink-0 items-center">
	{#if userId}
		<DropdownMenu>
			<DropdownMenuTrigger
				class="flex size-8 items-center justify-center rounded-md bg-primary/10 font-mono text-[11px] font-semibold text-primary ring-1 ring-primary/30 outline-none hover:bg-primary/15 focus-visible:ring-2 focus-visible:ring-ring"
				aria-label="Account menu"
			>
				{initials}
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" class="w-56">
				{#if email}
					<DropdownMenuLabel class="truncate font-normal">{email}</DropdownMenuLabel>
					<DropdownMenuSeparator />
				{/if}
				<DropdownMenuItem class="p-0 focus:bg-transparent">
					<form method="POST" action={resolve('/sign-out')} class="w-full">
						<button
							type="submit"
							class="w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground"
						>
							Sign out
						</button>
					</form>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	{:else}
		<a
			class="rounded-md border border-border bg-card px-3 py-1.5 font-mono text-xs text-foreground transition-colors hover:bg-secondary"
			href={resolve('/sign-in')}
		>
			Sign in
		</a>
	{/if}
</div>
