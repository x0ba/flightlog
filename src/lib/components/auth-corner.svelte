<script lang="ts">
	import { resolve } from '$app/paths';

	let { userId = null, email = null }: { userId?: string | null; email?: string | null } = $props();
</script>

<div class="flex shrink-0 items-center">
	{#if userId}
		<div class="flex min-w-0 flex-col items-end gap-1.5">
			{#if email}
				<span class="max-w-full truncate font-mono text-[10px] text-muted-foreground">{email}</span>
			{/if}
			<form method="POST" action={resolve('/sign-out')}>
				<button
					type="submit"
					class="rounded-md border border-border bg-card px-3 py-1.5 font-mono text-xs text-foreground transition-colors hover:bg-secondary"
				>
					Sign out
				</button>
			</form>
		</div>
	{:else}
		<a
			class="rounded-md border border-border bg-card px-3 py-1.5 font-mono text-xs text-foreground transition-colors hover:bg-secondary"
			href={resolve('/sign-in')}
		>
			Sign in
		</a>
	{/if}
</div>
