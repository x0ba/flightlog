<script lang="ts">
	let {
		status,
		label,
		size = 'sm'
	}: {
		status: 'running' | 'success' | 'failed' | 'cancelled' | 'pending' | string;
		label?: string;
		size?: 'sm' | 'md';
	} = $props();

	const colorClass = $derived(
		status === 'success'
			? 'bg-status-success'
			: status === 'failed'
				? 'bg-status-failed'
				: status === 'running' || status === 'pending'
					? 'bg-status-running'
					: 'bg-status-cancelled'
	);
</script>

<span
	class="inline-flex items-center gap-1.5 font-mono {size === 'md'
		? 'text-xs'
		: 'text-[11px]'} text-foreground/90"
>
	<span
		class="inline-block size-1.5 rounded-full {colorClass} {status === 'running' ||
		status === 'pending'
			? 'animate-pulse'
			: ''}"
	></span>
	{label ?? status}
</span>
