<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as Table from '$lib/components/ui/table';
	import * as Select from '$lib/components/ui/select';
	import * as Collapsible from '$lib/components/ui/collapsible';
	import { Separator } from '$lib/components/ui/separator';
	import { Play, Search, ChevronDown, Plus, KeyRound, Terminal } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	let { data } = $props();
	let prompt = $state('');
	let runName = $state('');
	let runMode = $state<'tool_agent' | 'browser'>('tool_agent');
	let provider = $state<'openai' | 'anthropic'>('openai');
	let framework = $state<'native' | 'ai-sdk' | 'langchain' | 'custom'>('native');
	let model = $state<string>(data.modelCatalog.openai[0]);
	let customModel = $state('');
	let credentialId = $state(data.credentials[0]?.id ?? '');
	let selectedTools = $state<string[]>([...data.tools]);
	let approvalPolicy = $state<'risk_based' | 'always' | 'never'>('risk_based');
	let maxSteps = $state(12);
	let credentialProvider = $state<'openai' | 'anthropic'>('openai');
	let credentialLabel = $state('');
	let credentialKey = $state('');
	let credentialError = $state('');
	let promptError = $state('');
	let creatingRun = $state(false);
	let credentials = $state([...data.credentials]);
	let newRunOpen = $state(false);
	let keysOpen = $state(false);
	const emptyCurl = `curl -X POST http://localhost:5173/api/runs \\
  -H 'content-type: application/json' \\
  -d '{"goal":"Find product pricing without buying anything","name":"Pricing check"}'`;

	function formatDate(value: string | Date | null) {
		if (!value) return 'Open';
		return new Intl.DateTimeFormat('en', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		}).format(new Date(value));
	}

	async function startAgentRun() {
		promptError = '';
		if (!prompt.trim()) {
			promptError = 'Enter a prompt to start a run.';
			return;
		}
		creatingRun = true;
		try {
			const response = await fetch('/api/agent-runs', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					prompt: prompt.trim(),
					name: runName.trim() || undefined,
					runMode,
					provider,
					framework,
					model: customModel.trim() || model,
					credentialId,
					tools: runMode === 'tool_agent' ? selectedTools : [],
					approvalPolicy,
					maxSteps
				})
			});
			if (!response.ok) throw new Error(await response.text());
			const payload = (await response.json()) as { run: { id: string } };
			await goto(resolve(`/runs/${payload.run.id}`));
		} catch (cause) {
			promptError = cause instanceof Error ? cause.message : 'Could not start the agent run.';
		} finally {
			creatingRun = false;
		}
	}

	async function saveCredential() {
		credentialError = '';
		if (!credentialLabel.trim() || !credentialKey.trim()) {
			credentialError = 'Enter a label and API key.';
			return;
		}
		const response = await fetch('/api/settings/providers', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				provider: credentialProvider,
				label: credentialLabel.trim(),
				apiKey: credentialKey.trim()
			})
		});
		if (!response.ok) {
			credentialError = await response.text();
			return;
		}
		const payload = (await response.json()) as { credential: (typeof data.credentials)[number] };
		credentials = [...credentials, payload.credential];
		credentialId = payload.credential.id;
		credentialLabel = '';
		credentialKey = '';
	}

	async function deleteCredential(id: string) {
		const response = await fetch(`/api/settings/providers/${id}`, { method: 'DELETE' });
		if (!response.ok) return;
		credentials = credentials.filter((credential) => credential.id !== id);
		if (credentialId === id) credentialId = credentials[0]?.id ?? '';
	}

	function toggleTool(tool: string, checked: boolean) {
		selectedTools = checked
			? [...new Set([...selectedTools, tool])]
			: selectedTools.filter((selected) => selected !== tool);
	}

	function providerModels(): string[] {
		return [...(data.modelCatalog[provider] ?? [])];
	}

	$effect(() => {
		const models = providerModels();
		if (!models.includes(model)) model = models[0] ?? '';
		const matchingCredential = credentials.find(
			(credential) => credential.provider === provider && credential.isEnabled
		);
		if (
			!credentials.some(
				(credential) => credential.id === credentialId && credential.provider === provider
			)
		) {
			credentialId = matchingCredential?.id ?? '';
		}
		if (runMode === 'browser') provider = 'openai';
	});
</script>

<svelte:head><title>FlightLog Runs</title></svelte:head>

<main class="min-h-screen bg-background">
	<div class="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
		<header class="flex items-center justify-between gap-4">
			<div class="flex items-center gap-3">
				<div
					class="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-secondary transition-colors hover:bg-secondary/80"
				>
					<svg
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
						class="text-primary"
					>
						<path
							d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"
						/>
					</svg>
				</div>
				<div>
					<h1 class="font-mono text-sm font-semibold tracking-wider uppercase">FlightLog</h1>
					<p class="text-xs text-muted-foreground">AgentOps Flight Recorder</p>
				</div>
			</div>
			<form class="flex items-center gap-2" method="get">
				<div class="relative">
					<Search
						class="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
					/>
					<Input
						class="h-8 w-48 pl-8 font-mono text-xs"
						name="q"
						value={data.filters.q}
						placeholder="Search runs…"
					/>
				</div>
				<select
					class="h-8 rounded-md border border-input bg-background px-2 font-mono text-xs text-foreground transition-colors hover:bg-secondary/50"
					name="status"
					value={data.filters.status ?? ''}
				>
					<option value="">All</option>
					<option value="running">Running</option>
					<option value="success">Success</option>
					<option value="failed">Failed</option>
					<option value="cancelled">Cancelled</option>
				</select>
				<Button class="h-8 px-3 text-xs" type="submit">Filter</Button>
			</form>
		</header>

		<!-- Metrics bar -->
		<div class="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border sm:grid-cols-4">
			<div class="flex items-center gap-3 bg-card px-4 py-3 transition-colors hover:bg-card/80">
				<div class="h-8 w-0.5 rounded-full bg-status-running"></div>
				<div>
					<p class="font-mono text-lg font-semibold">{data.metrics.running}</p>
					<p class="text-xs text-muted-foreground">Running</p>
				</div>
			</div>
			<div class="flex items-center gap-3 bg-card px-4 py-3 transition-colors hover:bg-card/80">
				<div class="h-8 w-0.5 rounded-full bg-status-success"></div>
				<div>
					<p class="font-mono text-lg font-semibold">{data.metrics.successRate}%</p>
					<p class="text-xs text-muted-foreground">Success Rate</p>
				</div>
			</div>
			<div class="flex items-center gap-3 bg-card px-4 py-3 transition-colors hover:bg-card/80">
				<div class="h-8 w-0.5 rounded-full bg-status-failed"></div>
				<div>
					<p class="font-mono text-lg font-semibold">{data.metrics.failed}</p>
					<p class="text-xs text-muted-foreground">Failed</p>
				</div>
			</div>
			<div class="flex items-center gap-3 bg-card px-4 py-3 transition-colors hover:bg-card/80">
				<div class="h-8 w-0.5 rounded-full bg-status-cancelled"></div>
				<div>
					<p class="font-mono text-lg font-semibold">{data.metrics.warnings}</p>
					<p class="text-xs text-muted-foreground">Eval Warnings</p>
				</div>
			</div>
		</div>

		<!-- Collapsible: New run prompt -->
		<Collapsible.Root bind:open={newRunOpen}>
			<div class="overflow-hidden rounded-lg border border-border bg-card">
				<Collapsible.Trigger
					class="flex w-full cursor-pointer items-center gap-2 px-4 py-2.5 transition-colors hover:bg-secondary/30"
				>
					<Plus class="size-3.5 text-primary" />
					<span class="font-mono text-xs font-medium">New Agent Run</span>
					<ChevronDown
						class="ml-auto size-3.5 text-muted-foreground transition-transform duration-200 {newRunOpen
							? 'rotate-180'
							: ''}"
					/>
				</Collapsible.Trigger>
				<Collapsible.Content>
					<div class="border-t border-border">
						<form
							class="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_28rem]"
							onsubmit={(event) => void (event.preventDefault(), startAgentRun())}
						>
							<div class="flex flex-col gap-3">
								<div class="grid gap-2">
									<Label class="font-mono text-xs">Prompt</Label>
									<Textarea
										class="min-h-28 resize-none bg-background font-mono text-sm"
										bind:value={prompt}
										placeholder="Describe the goal for a tool-using or browser agent…"
									/>
								</div>
								<div class="grid gap-3 md:grid-cols-2">
									<div class="grid gap-2">
										<Label class="font-mono text-xs">Run name</Label>
										<Input
											class="bg-background font-mono text-xs"
											bind:value={runName}
											placeholder="Optional"
										/>
									</div>
									<div class="grid gap-2">
										<Label class="font-mono text-xs">Max steps</Label>
										<Input
											class="bg-background font-mono text-xs"
											type="number"
											min="1"
											max="100"
											bind:value={maxSteps}
										/>
									</div>
								</div>
								{#if promptError}
									<p class="text-xs text-destructive">{promptError}</p>
								{/if}
							</div>

							<div class="grid gap-3">
								<div class="grid grid-cols-2 gap-1 rounded-lg border border-border bg-background p-1">
									<button
										type="button"
										class="rounded-md px-3 py-2 font-mono text-xs transition-colors {runMode ===
										'tool_agent'
											? 'bg-primary text-primary-foreground'
											: 'text-muted-foreground hover:text-foreground'}"
										onclick={() => (runMode = 'tool_agent')}>Tool agent</button
									>
									<button
										type="button"
										class="rounded-md px-3 py-2 font-mono text-xs transition-colors {runMode ===
										'browser'
											? 'bg-primary text-primary-foreground'
											: 'text-muted-foreground hover:text-foreground'}"
										onclick={() => {
											runMode = 'browser';
											provider = 'openai';
										}}>Browser</button
									>
								</div>

								<div class="grid grid-cols-2 gap-3">
									<div class="grid gap-2">
										<Label class="font-mono text-xs">Provider</Label>
										<Select.Root
											type="single"
											value={provider}
											onValueChange={(v) => { if (v) provider = v as typeof provider; }}
											disabled={runMode === 'browser'}
										>
											<Select.Trigger class="w-full font-mono">
												{provider === 'openai' ? 'OpenAI' : 'Anthropic'}
											</Select.Trigger>
											<Select.Content>
												<Select.Item value="openai" label="OpenAI">OpenAI</Select.Item>
												<Select.Item value="anthropic" label="Anthropic">Anthropic</Select.Item>
											</Select.Content>
										</Select.Root>
									</div>
									<div class="grid gap-2">
										<Label class="font-mono text-xs">Framework</Label>
										<Select.Root
											type="single"
											value={framework}
											onValueChange={(v) => { if (v) framework = v as typeof framework; }}
										>
											<Select.Trigger class="w-full font-mono">
												{framework === 'native' ? 'Native' : framework === 'ai-sdk' ? 'AI SDK' : framework === 'langchain' ? 'LangChain' : 'Custom'}
											</Select.Trigger>
											<Select.Content>
												<Select.Item value="native" label="Native">Native</Select.Item>
												<Select.Item value="ai-sdk" label="AI SDK">AI SDK</Select.Item>
												<Select.Item value="langchain" label="LangChain">LangChain</Select.Item>
												<Select.Item value="custom" label="Custom">Custom</Select.Item>
											</Select.Content>
										</Select.Root>
									</div>
									<div class="grid gap-2">
										<Label class="font-mono text-xs">Model</Label>
										<Select.Root
											type="single"
											value={model}
											onValueChange={(v) => { if (v) model = v; }}
										>
											<Select.Trigger class="w-full font-mono">
												{model || 'Select model'}
											</Select.Trigger>
											<Select.Content>
												{#each providerModels() as option (option)}
													<Select.Item value={option} label={option}>{option}</Select.Item>
												{/each}
											</Select.Content>
										</Select.Root>
									</div>
									<div class="grid gap-2">
										<Label class="font-mono text-xs">Custom model</Label>
										<Input
											class="bg-background font-mono text-xs"
											bind:value={customModel}
											placeholder="Optional override"
										/>
									</div>
								</div>

								<div class="grid gap-2">
									<Label class="font-mono text-xs">Credential</Label>
									<Select.Root
										type="single"
										value={credentialId}
										onValueChange={(v) => { if (v) credentialId = v; }}
									>
										<Select.Trigger class="w-full font-mono">
											{#if credentialId}
												{@const cred = credentials.find((c) => c.id === credentialId)}
												{cred ? `${cred.label} · ${cred.keyPreview}` : 'Select a saved key'}
											{:else}
												Select a saved key
											{/if}
										</Select.Trigger>
										<Select.Content>
											{#each credentials.filter((credential) => credential.provider === provider && credential.isEnabled) as credential (credential.id)}
												<Select.Item value={credential.id} label="{credential.label} · {credential.keyPreview}">
													{credential.label} · {credential.keyPreview}
												</Select.Item>
											{/each}
										</Select.Content>
									</Select.Root>
								</div>

								{#if runMode === 'tool_agent'}
									<div class="grid gap-2">
										<Label class="font-mono text-xs">Tools</Label>
										<div class="grid grid-cols-2 gap-2">
											{#each data.tools as tool (tool)}
												<label
													class="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-2 font-mono text-xs transition-colors hover:bg-secondary/30"
												>
													<Checkbox
														checked={selectedTools.includes(tool)}
														onclick={() => toggleTool(tool, !selectedTools.includes(tool))}
													/>
													<span class="truncate">{tool}</span>
												</label>
											{/each}
										</div>
									</div>
								{/if}

								<div class="grid gap-2">
									<Label class="font-mono text-xs">Approval policy</Label>
									<Select.Root
										type="single"
										value={approvalPolicy}
										onValueChange={(v) => { if (v) approvalPolicy = v as typeof approvalPolicy; }}
									>
										<Select.Trigger class="w-full font-mono">
											{approvalPolicy === 'risk_based' ? 'Risk based' : approvalPolicy === 'always' ? 'Always ask' : 'Never ask'}
										</Select.Trigger>
										<Select.Content>
											<Select.Item value="risk_based" label="Risk based">Risk based</Select.Item>
											<Select.Item value="always" label="Always ask">Always ask</Select.Item>
											<Select.Item value="never" label="Never ask">Never ask</Select.Item>
										</Select.Content>
									</Select.Root>
								</div>

								<Button
									class="h-9 justify-center gap-2 font-mono text-xs"
									type="submit"
									disabled={creatingRun || !credentialId}
								>
									<Play class="size-3.5" />
									{creatingRun ? 'Starting…' : 'Start run'}
								</Button>
							</div>
						</form>
					</div>
				</Collapsible.Content>
			</div>
		</Collapsible.Root>

		<!-- Collapsible: Provider Keys -->
		<Collapsible.Root bind:open={keysOpen}>
			<div class="overflow-hidden rounded-lg border border-border bg-card">
				<Collapsible.Trigger
					class="flex w-full cursor-pointer items-center gap-2 px-4 py-2.5 transition-colors hover:bg-secondary/30"
				>
					<KeyRound class="size-3.5 text-primary" />
					<span class="font-mono text-xs font-medium">Provider Keys</span>
					<span class="ml-1 font-mono text-xs text-muted-foreground"
						>· {credentials.length} saved</span
					>
					<ChevronDown
						class="ml-auto size-3.5 text-muted-foreground transition-transform duration-200 {keysOpen
							? 'rotate-180'
							: ''}"
					/>
				</Collapsible.Trigger>
				<Collapsible.Content>
					<div class="border-t border-border">
						<div class="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
							<div class="grid gap-2">
								{#if credentials.length}
									{#each credentials as credential (credential.id)}
										<div
											class="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2 transition-colors hover:bg-secondary/20"
										>
											<div class="min-w-0">
												<p class="truncate text-sm">{credential.label}</p>
												<p class="font-mono text-xs text-muted-foreground">
													{credential.provider} · {credential.keyPreview}
												</p>
											</div>
											<Button
												variant="ghost"
												size="sm"
												type="button"
												onclick={() => deleteCredential(credential.id)}>Delete</Button
											>
										</div>
									{/each}
								{:else}
									<div
										class="flex items-center gap-3 rounded-md bg-secondary/30 p-3"
									>
										<KeyRound class="size-4 shrink-0 text-muted-foreground/50" />
										<p class="font-mono text-xs text-muted-foreground">
											Add an OpenAI or Anthropic key to launch dashboard-run agents.
										</p>
									</div>
								{/if}
							</div>
							<div class="grid gap-2">
								<div class="grid grid-cols-2 gap-2">
									<Select.Root
										type="single"
										value={credentialProvider}
										onValueChange={(v) => { if (v) credentialProvider = v as typeof credentialProvider; }}
									>
										<Select.Trigger class="w-full font-mono">
											{credentialProvider === 'openai' ? 'OpenAI' : 'Anthropic'}
										</Select.Trigger>
										<Select.Content>
											<Select.Item value="openai" label="OpenAI">OpenAI</Select.Item>
											<Select.Item value="anthropic" label="Anthropic">Anthropic</Select.Item>
										</Select.Content>
									</Select.Root>
									<Input
										class="bg-background font-mono text-xs"
										bind:value={credentialLabel}
										placeholder="Label"
									/>
								</div>
								<Input
									class="bg-background font-mono text-xs"
									type="password"
									bind:value={credentialKey}
									placeholder="API key"
								/>
								<Button class="font-mono text-xs" type="button" onclick={saveCredential}
									>Save encrypted key</Button
								>
								{#if credentialError}
									<p class="text-xs text-destructive">{credentialError}</p>
								{/if}
							</div>
						</div>
					</div>
				</Collapsible.Content>
			</div>
		</Collapsible.Root>

		<!-- Runs table -->
		<div class="overflow-hidden rounded-lg border border-border bg-card">
			<div class="flex items-center justify-between border-b border-border px-4 py-2.5">
				<span class="font-mono text-xs font-medium">Runs</span>
				<span class="font-mono text-xs text-muted-foreground">{data.total} logged</span>
			</div>
			{#if data.runs.length}
				<Table.Root>
					<Table.Header>
						<Table.Row class="border-border hover:bg-transparent">
							<Table.Head class="font-mono text-xs text-muted-foreground">Run</Table.Head>
							<Table.Head class="font-mono text-xs text-muted-foreground">Status</Table.Head>
							<Table.Head class="font-mono text-xs text-muted-foreground">Agent</Table.Head>
							<Table.Head class="font-mono text-xs text-muted-foreground">Events</Table.Head>
							<Table.Head class="font-mono text-xs text-muted-foreground">Eval</Table.Head>
							<Table.Head class="font-mono text-xs text-muted-foreground">Started</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each data.runs as run (run.id)}
							<Table.Row class="group border-border transition-colors duration-150 hover:bg-secondary/40">
								<Table.Cell>
									<a
										class="text-sm font-medium text-foreground transition-colors hover:text-primary"
										href={resolve(`/runs/${run.id}`)}
									>
										{run.name ?? 'Untitled run'}
									</a>
									<p class="line-clamp-1 max-w-md font-mono text-xs text-muted-foreground">
										{run.goal}
									</p>
								</Table.Cell>
								<Table.Cell>
									<span class="inline-flex items-center gap-1.5 font-mono text-xs">
										<span
											class="inline-block size-1.5 rounded-full"
											class:bg-status-running={run.status === 'running'}
											class:bg-status-success={run.status === 'success'}
											class:bg-status-failed={run.status === 'failed'}
											class:bg-status-cancelled={run.status === 'cancelled'}
										></span>
										{run.status}
									</span>
								</Table.Cell>
								<Table.Cell class="font-mono text-xs text-muted-foreground"
									>{run.agentName ?? '—'}</Table.Cell
								>
								<Table.Cell class="font-mono text-xs">{run.eventCount}</Table.Cell>
								<Table.Cell class="font-mono text-xs">
									{#if run.latestEvaluationScore === null}
										<span class="text-muted-foreground">—</span>
									{:else}
										{run.latestEvaluationScore}
									{/if}
								</Table.Cell>
								<Table.Cell class="font-mono text-xs text-muted-foreground"
									>{formatDate(run.startedAt)}</Table.Cell
								>
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
			{:else}
				<div class="flex flex-col items-center gap-4 p-10">
					<div class="flex size-12 items-center justify-center rounded-full bg-secondary/50">
						<Terminal class="size-5 text-muted-foreground" />
					</div>
					<div class="text-center">
						<p class="text-sm font-medium">No runs yet</p>
						<p class="mt-1 font-mono text-xs text-muted-foreground">
							Create one with the ingest API or start a new agent run above.
						</p>
					</div>
					<Separator class="max-w-sm" />
					<pre
						class="max-w-lg overflow-auto rounded-lg border border-border bg-background p-4 font-mono text-xs text-muted-foreground">{emptyCurl}</pre>
				</div>
			{/if}
		</div>
	</div>
</main>
