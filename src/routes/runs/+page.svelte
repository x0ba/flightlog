<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as Table from '$lib/components/ui/table';
	import * as Select from '$lib/components/ui/select';
	import * as Sheet from '$lib/components/ui/sheet';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Tabs from '$lib/components/ui/tabs';
	import { Badge } from '$lib/components/ui/badge';
	import { Play, Search, Plus, KeyRound, Terminal, Trash2, ExternalLink } from '@lucide/svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import PageHeader from '$lib/components/page-header.svelte';
	import Section from '$lib/components/section.svelte';
	import StatusPill from '$lib/components/status-pill.svelte';

	let { data } = $props();
	const initialForm = readInitialFormState();
	let prompt = $state('');
	let runName = $state('');
	let runMode = $state<'tool_agent' | 'browser'>('tool_agent');
	let provider = $state<'openai' | 'anthropic'>('openai');
	let framework = $state<'native' | 'ai-sdk' | 'langchain' | 'custom'>('native');
	let model = $state<string>(initialForm.model);
	let customModel = $state('');
	let credentialId = $state('');
	let browserbaseCredentialId = $state('');
	let selectedTools = $state<string[]>(initialForm.tools);
	let approvalPolicy = $state<'risk_based' | 'always' | 'never'>('risk_based');
	let maxSteps = $state(12);
	let credentialProvider = $state<'openai' | 'anthropic' | 'browserbase'>('openai');
	let credentialLabel = $state('');
	let credentialKey = $state('');
	let credentialProjectId = $state('');
	let credentialError = $state('');
	let promptError = $state('');
	let creatingRun = $state(false);
	let credentials = $state(initialForm.credentials);
	let newRunOpen = $state(false);
	let keysOpen = $state(false);
	let addProviderTab = $state<'api_key' | 'chatgpt'>('api_key');
	let connectingChatGpt = $state(false);
	let chatgptConnectError = $state('');
	let connectNotice = $state('');
	let deviceModalOpen = $state(false);
	let deviceConnectHandledFromUrl = $state(false);
	let deviceAuth = $state<{
		deviceAuthId: string;
		userCode: string;
		verificationUri: string;
		pollIntervalMs: number;
	} | null>(null);
	let devicePollTimer: ReturnType<typeof setTimeout> | undefined;
	let devicePollInFlight = false;
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
					browserbaseCredentialId:
						runMode === 'browser' ? browserbaseCredentialId || undefined : undefined,
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
		if (!credentialKey.trim()) {
			credentialError = 'Enter an API key.';
			return;
		}
		const label =
			credentialLabel.trim() || `${credentialProviderLabel(credentialProvider)} API key`;
		if (credentialProvider === 'browserbase' && !credentialProjectId.trim()) {
			credentialError = 'Enter a Browserbase project ID.';
			return;
		}
		const response = await fetch('/api/settings/providers', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				provider: credentialProvider,
				label,
				apiKey: credentialKey.trim(),
				...(credentialProvider === 'browserbase' && credentialProjectId.trim()
					? { projectId: credentialProjectId.trim() }
					: {})
			})
		});
		if (!response.ok) {
			credentialError = await response.text();
			return;
		}
		const payload = (await response.json()) as { credential: (typeof data.credentials)[number] };
		credentials = [...credentials, payload.credential];
		if (payload.credential.provider === 'browserbase') {
			browserbaseCredentialId = payload.credential.id;
		} else if (payload.credential.provider === provider) {
			credentialId = payload.credential.id;
		}
		credentialLabel = '';
		credentialKey = '';
		credentialProjectId = '';
		connectNotice = `${payload.credential.label} saved.`;
	}

	async function deleteCredential(id: string) {
		const response = await fetch(`/api/settings/providers/${id}`, { method: 'DELETE' });
		if (!response.ok) return;
		credentials = credentials.filter((credential) => credential.id !== id);
		if (credentialId === id) {
			credentialId = credentials.find((c) => c.provider === provider && c.isEnabled)?.id ?? '';
		}
		if (browserbaseCredentialId === id) {
			browserbaseCredentialId =
				credentials.find((c) => c.provider === 'browserbase' && c.isEnabled)?.id ?? '';
		}
	}

	function credentialsForProvider(target: 'openai' | 'anthropic' | 'browserbase') {
		return credentials.filter(
			(credential) => credential.provider === target && credential.isEnabled
		);
	}

	function credentialProviderLabel(value: 'openai' | 'anthropic' | 'browserbase') {
		if (value === 'openai') return 'OpenAI';
		if (value === 'anthropic') return 'Anthropic';
		return 'Browserbase';
	}

	type SavedCredential = (typeof data.credentials)[number];

	function credentialSummary(credential: SavedCredential) {
		if (credential.authType === 'chatgpt_oauth') {
			const account = credential.accountEmail ?? credential.keyPreview;
			return `ChatGPT · ${account}`;
		}
		return `${credentialProviderLabel(credential.provider)} · ${credential.keyPreview}`;
	}

	function credentialAuthBadge(credential: SavedCredential) {
		if (credential.authType === 'chatgpt_oauth') return 'ChatGPT';
		return 'API key';
	}

	function connectChatGpt() {
		chatgptConnectError = '';
		if (data.chatgptOAuthUseDeviceFlow) {
			void startDeviceConnect();
			return;
		}
		const label = encodeURIComponent(credentialLabel.trim() || 'ChatGPT');
		window.location.href = `/api/auth/openai/connect?label=${label}`;
	}

	async function startDeviceConnect() {
		chatgptConnectError = '';
		connectingChatGpt = true;
		try {
			const response = await fetch('/api/auth/openai/device/start', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ label: credentialLabel.trim() || 'ChatGPT' })
			});
			if (!response.ok) {
				chatgptConnectError = await response.text();
				return;
			}
			const payload = (await response.json()) as {
				deviceAuthId: string;
				userCode: string;
				verificationUri: string;
				pollIntervalMs: number;
			};
			deviceAuth = payload;
			deviceModalOpen = true;
			clearChatgptDeviceUrlParam();
			scheduleDevicePoll();
		} catch {
			chatgptConnectError = 'Could not start device sign-in.';
		} finally {
			connectingChatGpt = false;
		}
	}

	function scheduleDevicePoll() {
		if (devicePollTimer) clearTimeout(devicePollTimer);
		if (!deviceAuth) return;
		devicePollTimer = setTimeout(() => {
			void pollDeviceStatus();
		}, deviceAuth.pollIntervalMs);
	}

	async function readDevicePollError(response: Response) {
		const text = await response.text();
		try {
			const body = JSON.parse(text) as { message?: string };
			return body.message ?? text;
		} catch {
			return text;
		}
	}

	function clearChatgptDeviceUrlParam() {
		const url = new URL(page.url);
		if (!url.searchParams.has('chatgpt')) return;
		url.searchParams.delete('chatgpt');
		void goto(url, { replaceState: true, keepFocus: true, noScroll: true });
	}

	async function recoverDeviceConnectAfterMissingSession() {
		await invalidateAll();
		const chatgptCredentials = data.credentials.filter(
			(credential) => credential.authType === 'chatgpt_oauth'
		);
		const knownIds = new Set(credentials.map((credential) => credential.id));
		const added = chatgptCredentials.find((credential) => !knownIds.has(credential.id));
		if (!added) return false;
		credentials = [...data.credentials];
		credentialId = added.id;
		connectNotice = `${added.label} connected.`;
		deviceModalOpen = false;
		deviceAuth = null;
		chatgptConnectError = '';
		return true;
	}

	async function pollDeviceStatus() {
		if (!deviceAuth || devicePollInFlight) return;
		devicePollInFlight = true;
		try {
			const response = await fetch(
				`/api/auth/openai/device/status?deviceAuthId=${encodeURIComponent(deviceAuth.deviceAuthId)}`
			);
			if (!response.ok) {
				const message = await readDevicePollError(response);
				if (response.status === 404 && (await recoverDeviceConnectAfterMissingSession())) {
					return;
				}
				if (response.status >= 500 || response.status === 429) {
					chatgptConnectError = message;
					scheduleDevicePoll();
					return;
				}
				chatgptConnectError = message;
				deviceModalOpen = false;
				deviceAuth = null;
				return;
			}
			const payload = (await response.json()) as
				| { status: 'pending'; pollIntervalMs: number }
				| { status: 'completed'; credential: SavedCredential };
			if (payload.status === 'pending') {
				if (deviceAuth) {
					deviceAuth = { ...deviceAuth, pollIntervalMs: payload.pollIntervalMs };
				}
				scheduleDevicePoll();
				return;
			}
			credentials = [...credentials, payload.credential];
			credentialId = payload.credential.id;
			connectNotice = `${payload.credential.label} connected.`;
			deviceModalOpen = false;
			deviceAuth = null;
		} catch {
			chatgptConnectError = 'Device sign-in failed. Retrying…';
			scheduleDevicePoll();
		} finally {
			devicePollInFlight = false;
		}
	}

	function closeDeviceModal() {
		deviceModalOpen = false;
		deviceAuth = null;
		if (devicePollTimer) clearTimeout(devicePollTimer);
	}

	function canStartRun() {
		if (runMode === 'browser') {
			return Boolean(credentialId && browserbaseCredentialId);
		}
		return Boolean(credentialId);
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
		const aiProvider = runMode === 'browser' ? 'openai' : provider;
		const matchingCredential = credentialsForProvider(aiProvider)[0];
		if (
			!credentials.some(
				(credential) => credential.id === credentialId && credential.provider === aiProvider
			)
		) {
			credentialId = matchingCredential?.id ?? '';
		}
		const matchingBrowserbase = credentialsForProvider('browserbase')[0];
		if (
			runMode === 'browser' &&
			!credentials.some(
				(credential) =>
					credential.id === browserbaseCredentialId && credential.provider === 'browserbase'
			)
		) {
			browserbaseCredentialId = matchingBrowserbase?.id ?? '';
		}
		if (runMode === 'browser') provider = 'openai';
	});

	$effect(() => {
		const params = page.url.searchParams;
		if (params.get('keys') === 'open') keysOpen = true;
		if (params.get('chatgpt') === 'device' && data.chatgptOAuthUseDeviceFlow) {
			addProviderTab = 'chatgpt';
			const label = params.get('label')?.trim();
			if (label) credentialLabel = label;
			if (!deviceConnectHandledFromUrl) {
				deviceConnectHandledFromUrl = true;
				void startDeviceConnect();
			}
		} else {
			deviceConnectHandledFromUrl = false;
		}
		if (params.get('connected') === '1') {
			const connectedId = params.get('credentialId');
			if (connectedId) credentialId = connectedId;
			connectNotice = 'Provider connected.';
			void invalidateAll();
		}
	});

	function readInitialFormState() {
		return {
			model: data.modelCatalog.openai[0],
			tools: [...data.tools],
			credentials: [...data.credentials]
		};
	}
</script>

<svelte:head><title>Runs · FlightLog</title></svelte:head>

<div class="mx-auto w-full max-w-6xl px-6 py-10 lg:px-10">
	<PageHeader
		eyebrow="Observability"
		title="Runs"
		description="Inspect agent traces, evaluations, and replays. Launch new runs from saved credentials."
	>
		{#snippet actions()}
			<Button variant="outline" class="h-9 gap-1.5" onclick={() => (keysOpen = true)} type="button">
				<KeyRound class="size-3.5" />
				Providers
				<span class="ml-1 font-mono text-[10px] text-muted-foreground">{credentials.length}</span>
			</Button>
			<Button class="h-9 gap-1.5" onclick={() => (newRunOpen = true)} type="button">
				<Plus class="size-3.5" />
				New run
			</Button>
		{/snippet}
	</PageHeader>

	<!-- Metric strip: airy, calm -->
	<div class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
		{@render metric('Running', data.metrics.running, 'running')}
		{@render metric('Success rate', `${data.metrics.successRate}%`, 'success')}
		{@render metric('Failed', data.metrics.failed, 'failed')}
		{@render metric('Eval warnings', data.metrics.warnings, 'cancelled')}
	</div>

	{#snippet metric(
		label: string,
		value: string | number,
		tone: 'running' | 'success' | 'failed' | 'cancelled'
	)}
		<div class="rounded-xl border border-border/60 bg-card px-4 py-3.5">
			<div class="flex items-center gap-2">
				<span
					class="inline-block size-1.5 rounded-full"
					class:bg-status-running={tone === 'running'}
					class:bg-status-success={tone === 'success'}
					class:bg-status-failed={tone === 'failed'}
					class:bg-status-cancelled={tone === 'cancelled'}
				></span>
				<p class="text-xs text-muted-foreground">{label}</p>
			</div>
			<p class="mt-1.5 font-mono text-xl font-semibold tracking-tight">{value}</p>
		</div>
	{/snippet}

	<Section padded={false}>
		{#snippet aside()}
			<form class="flex items-center gap-2" method="get">
				<div class="relative">
					<Search
						class="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
					/>
					<Input
						class="h-8 w-56 pl-8 text-xs"
						name="q"
						value={data.filters.q}
						placeholder="Search runs…"
					/>
				</div>
				<select
					class="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground hover:bg-secondary/50"
					name="status"
					value={data.filters.status ?? ''}
				>
					<option value="">All statuses</option>
					<option value="running">Running</option>
					<option value="success">Success</option>
					<option value="failed">Failed</option>
					<option value="cancelled">Cancelled</option>
				</select>
				<Button class="h-8 px-3 text-xs" type="submit" variant="secondary">Filter</Button>
			</form>
		{/snippet}
		{#if data.runs.length}
			<Table.Root>
				<Table.Header>
					<Table.Row class="border-border/60 hover:bg-transparent">
						<Table.Head class="pl-5 text-xs text-muted-foreground">Run</Table.Head>
						<Table.Head class="text-xs text-muted-foreground">Status</Table.Head>
						<Table.Head class="text-xs text-muted-foreground">Agent</Table.Head>
						<Table.Head class="text-xs text-muted-foreground">Events</Table.Head>
						<Table.Head class="text-xs text-muted-foreground">Eval</Table.Head>
						<Table.Head class="pr-5 text-xs text-muted-foreground">Started</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each data.runs as run (run.id)}
						<Table.Row class="border-border/60 transition-colors hover:bg-secondary/30">
							<Table.Cell class="py-3 pl-5">
								<a
									class="text-sm font-medium tracking-tight transition-colors hover:text-primary"
									href={resolve(`/runs/${run.id}`)}
								>
									{run.name ?? 'Untitled run'}
								</a>
								<p class="line-clamp-1 max-w-md text-xs text-muted-foreground">{run.goal}</p>
							</Table.Cell>
							<Table.Cell><StatusPill status={run.status} /></Table.Cell>
							<Table.Cell class="font-mono text-xs text-muted-foreground"
								>{run.agentName ?? '—'}</Table.Cell
							>
							<Table.Cell class="font-mono text-xs">{run.eventCount}</Table.Cell>
							<Table.Cell class="font-mono text-xs">
								{run.latestEvaluationScore === null ? '—' : run.latestEvaluationScore}
							</Table.Cell>
							<Table.Cell class="pr-5 font-mono text-xs text-muted-foreground"
								>{formatDate(run.startedAt)}</Table.Cell
							>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
			<div
				class="flex items-center justify-between border-t border-border/60 px-5 py-2.5 text-xs text-muted-foreground"
			>
				<span>{data.total} total</span>
			</div>
		{:else}
			<div class="flex flex-col items-center gap-4 px-6 py-16 text-center">
				<div class="flex size-12 items-center justify-center rounded-full bg-secondary/60">
					<Terminal class="size-5 text-muted-foreground" />
				</div>
				<div>
					<p class="text-sm font-semibold tracking-tight">No runs yet</p>
					<p class="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
						Log agent traces with the ingest API or launch a new run to get started.
					</p>
				</div>
				<pre
					class="mt-2 max-w-lg overflow-auto rounded-lg border border-border/60 bg-background p-4 text-left font-mono text-[11px] text-muted-foreground">{emptyCurl}</pre>
			</div>
		{/if}
	</Section>
</div>

<!-- New run sheet -->
<Sheet.Root bind:open={newRunOpen}>
	<Sheet.Content class="w-full overflow-y-auto sm:max-w-xl">
		<Sheet.Header class="px-6 pt-6">
			<Sheet.Title class="tracking-tight">New agent run</Sheet.Title>
			<Sheet.Description>
				Configure a tool-using or browser agent and launch it from a saved provider key.
			</Sheet.Description>
		</Sheet.Header>
		<form
			class="flex flex-col gap-5 px-6 pt-4 pb-6"
			onsubmit={(event) => void (event.preventDefault(), startAgentRun())}
		>
			<div class="grid grid-cols-2 gap-1 rounded-lg border border-border/60 bg-background p-1">
				<button
					type="button"
					class="rounded-md px-3 py-1.5 text-xs font-medium transition-colors {runMode ===
					'tool_agent'
						? 'bg-primary text-primary-foreground'
						: 'text-muted-foreground hover:text-foreground'}"
					onclick={() => (runMode = 'tool_agent')}>Tool agent</button
				>
				<button
					type="button"
					class="rounded-md px-3 py-1.5 text-xs font-medium transition-colors {runMode === 'browser'
						? 'bg-primary text-primary-foreground'
						: 'text-muted-foreground hover:text-foreground'}"
					onclick={() => {
						runMode = 'browser';
						provider = 'openai';
					}}>Browser</button
				>
			</div>

			<div class="grid gap-2">
				<Label class="text-xs">Prompt</Label>
				<Textarea
					class="min-h-28 resize-none bg-background text-sm"
					bind:value={prompt}
					placeholder="Describe the goal for the agent…"
				/>
			</div>

			<div class="grid grid-cols-2 gap-3">
				<div class="grid gap-2">
					<Label class="text-xs">Run name</Label>
					<Input class="text-xs" bind:value={runName} placeholder="Optional" />
				</div>
				<div class="grid gap-2">
					<Label class="text-xs">Max steps</Label>
					<Input class="text-xs" type="number" min="1" max="100" bind:value={maxSteps} />
				</div>
			</div>

			<div class="grid grid-cols-2 gap-3">
				<div class="grid gap-2">
					<Label class="text-xs">Provider</Label>
					<Select.Root
						type="single"
						value={provider}
						onValueChange={(v) => {
							if (v) provider = v as typeof provider;
						}}
						disabled={runMode === 'browser'}
					>
						<Select.Trigger class="w-full">
							{provider === 'openai' ? 'OpenAI' : 'Anthropic'}
						</Select.Trigger>
						<Select.Content>
							<Select.Item value="openai" label="OpenAI">OpenAI</Select.Item>
							<Select.Item value="anthropic" label="Anthropic">Anthropic</Select.Item>
						</Select.Content>
					</Select.Root>
				</div>
				<div class="grid gap-2">
					<Label class="text-xs">Framework</Label>
					<Select.Root
						type="single"
						value={framework}
						onValueChange={(v) => {
							if (v) framework = v as typeof framework;
						}}
					>
						<Select.Trigger class="w-full">
							{framework === 'native'
								? 'Native'
								: framework === 'ai-sdk'
									? 'AI SDK'
									: framework === 'langchain'
										? 'LangChain'
										: 'Custom'}
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
					<Label class="text-xs">Model</Label>
					<Select.Root
						type="single"
						value={model}
						onValueChange={(v) => {
							if (v) model = v;
						}}
					>
						<Select.Trigger class="w-full">{model || 'Select model'}</Select.Trigger>
						<Select.Content>
							{#each providerModels() as option (option)}
								<Select.Item value={option} label={option}>{option}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
				<div class="grid gap-2">
					<Label class="text-xs">Custom model</Label>
					<Input class="text-xs" bind:value={customModel} placeholder="Optional override" />
				</div>
			</div>

			{#if runMode === 'browser'}
				<div class="grid gap-2">
					<Label class="text-xs">OpenAI credential</Label>
					<Select.Root
						type="single"
						value={credentialId}
						onValueChange={(v) => {
							if (v) credentialId = v;
						}}
					>
						<Select.Trigger class="w-full">
							{#if credentialId}
								{@const cred = credentials.find((c) => c.id === credentialId)}
								{cred ? `${cred.label} · ${credentialSummary(cred)}` : 'Select OpenAI account'}
							{:else}
								Select OpenAI key
							{/if}
						</Select.Trigger>
						<Select.Content>
							{#each credentialsForProvider('openai') as credential (credential.id)}
								<Select.Item
									value={credential.id}
									label="{credential.label} · {credentialSummary(credential)}"
								>
									{credential.label} · {credentialSummary(credential)}
								</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
				<div class="grid gap-2">
					<Label class="text-xs">Browserbase credential</Label>
					<Select.Root
						type="single"
						value={browserbaseCredentialId}
						onValueChange={(v) => {
							if (v) browserbaseCredentialId = v;
						}}
					>
						<Select.Trigger class="w-full">
							{#if browserbaseCredentialId}
								{@const cred = credentials.find((c) => c.id === browserbaseCredentialId)}
								{cred ? `${cred.label} · ${cred.keyPreview}` : 'Select Browserbase key'}
							{:else}
								Select Browserbase key
							{/if}
						</Select.Trigger>
						<Select.Content>
							{#each credentialsForProvider('browserbase') as credential (credential.id)}
								<Select.Item
									value={credential.id}
									label="{credential.label} · {credentialSummary(credential)}"
								>
									{credential.label} · {credentialSummary(credential)}
								</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
			{:else}
				<div class="grid gap-2">
					<Label class="text-xs">Credential</Label>
					<Select.Root
						type="single"
						value={credentialId}
						onValueChange={(v) => {
							if (v) credentialId = v;
						}}
					>
						<Select.Trigger class="w-full">
							{#if credentialId}
								{@const cred = credentials.find((c) => c.id === credentialId)}
								{cred ? `${cred.label} · ${credentialSummary(cred)}` : 'Select a saved key'}
							{:else}
								Select a saved key
							{/if}
						</Select.Trigger>
						<Select.Content>
							{#each credentialsForProvider(provider) as credential (credential.id)}
								<Select.Item
									value={credential.id}
									label="{credential.label} · {credentialSummary(credential)}"
								>
									{credential.label} · {credentialSummary(credential)}
								</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
			{/if}

			{#if runMode === 'tool_agent'}
				<div class="grid gap-2">
					<Label class="text-xs">Tools</Label>
					<div class="grid grid-cols-2 gap-2">
						{#each data.tools as tool (tool)}
							<label
								class="flex items-center gap-2 rounded-md border border-border/60 bg-background px-2.5 py-2 font-mono text-xs transition-colors hover:bg-secondary/30"
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
				<Label class="text-xs">Approval policy</Label>
				<Select.Root
					type="single"
					value={approvalPolicy}
					onValueChange={(v) => {
						if (v) approvalPolicy = v as typeof approvalPolicy;
					}}
				>
					<Select.Trigger class="w-full">
						{approvalPolicy === 'risk_based'
							? 'Risk based'
							: approvalPolicy === 'always'
								? 'Always ask'
								: 'Never ask'}
					</Select.Trigger>
					<Select.Content>
						<Select.Item value="risk_based" label="Risk based">Risk based</Select.Item>
						<Select.Item value="always" label="Always ask">Always ask</Select.Item>
						<Select.Item value="never" label="Never ask">Never ask</Select.Item>
					</Select.Content>
				</Select.Root>
			</div>

			{#if promptError}
				<p class="text-xs text-destructive">{promptError}</p>
			{/if}

			<Button
				class="h-10 justify-center gap-2"
				type="submit"
				disabled={creatingRun || !canStartRun()}
			>
				<Play class="size-3.5" />
				{creatingRun ? 'Starting…' : 'Start run'}
			</Button>
		</form>
	</Sheet.Content>
</Sheet.Root>

<!-- Agent keys sheet -->
<Sheet.Root bind:open={keysOpen}>
	<Sheet.Content class="w-full overflow-y-auto sm:max-w-md">
		<Sheet.Header class="px-6 pt-6">
			<Sheet.Title class="tracking-tight">Providers</Sheet.Title>
			<Sheet.Description>
				Add platform API keys or sign in with ChatGPT. Secrets are encrypted at rest and only shown
				as masked previews.
			</Sheet.Description>
		</Sheet.Header>
		<div class="flex flex-col gap-5 px-6 pt-4 pb-6">
			{#if connectNotice}
				<p
					class="rounded-md border border-border/60 bg-secondary/30 px-3 py-2 text-xs text-foreground"
				>
					{connectNotice}
				</p>
			{/if}
			<div class="flex flex-col gap-2">
				{#if credentials.length}
					{#each credentials as credential (credential.id)}
						<div
							class="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background px-3 py-2.5"
						>
							<div class="min-w-0">
								<div class="flex items-center gap-2">
									<p class="truncate text-sm font-medium">{credential.label}</p>
									<Badge variant="secondary" class="h-5 px-1.5 text-[10px]">
										{credentialAuthBadge(credential)}
									</Badge>
								</div>
								<p class="font-mono text-[11px] text-muted-foreground">
									{credentialSummary(credential)}
									{#if credential.provider === 'browserbase' && credential.projectId}
										· project {credential.projectId}
									{/if}
								</p>
							</div>
							<Button
								variant="ghost"
								size="sm"
								type="button"
								class="text-muted-foreground hover:text-destructive"
								onclick={() => deleteCredential(credential.id)}
							>
								<Trash2 class="size-3.5" />
							</Button>
						</div>
					{/each}
				{:else}
					<div class="rounded-md border border-dashed border-border/60 bg-secondary/20 p-4">
						<p class="text-xs text-muted-foreground">
							No providers yet. Add an API key or ChatGPT account to launch dashboard runs.
						</p>
					</div>
				{/if}
			</div>

			<div class="flex flex-col gap-3 border-t border-border/60 pt-5">
				<Label class="text-xs">Add provider</Label>
				<Tabs.Root bind:value={addProviderTab} class="flex flex-col gap-3">
					<Tabs.List class="grid w-full grid-cols-2">
						<Tabs.Trigger value="api_key" class="text-xs">API key</Tabs.Trigger>
						<Tabs.Trigger value="chatgpt" class="text-xs">ChatGPT</Tabs.Trigger>
					</Tabs.List>
					<Tabs.Content value="api_key" class="mt-0 flex flex-col gap-2">
						<div class="grid grid-cols-2 gap-2">
							<Select.Root
								type="single"
								value={credentialProvider}
								onValueChange={(v) => {
									if (v) {
										credentialProvider = v as typeof credentialProvider;
										credentialProjectId = '';
									}
								}}
							>
								<Select.Trigger class="w-full">
									{credentialProviderLabel(credentialProvider)}
								</Select.Trigger>
								<Select.Content>
									<Select.Item value="openai" label="OpenAI">OpenAI</Select.Item>
									<Select.Item value="anthropic" label="Anthropic">Anthropic</Select.Item>
									<Select.Item value="browserbase" label="Browserbase">Browserbase</Select.Item>
								</Select.Content>
							</Select.Root>
							<Input class="text-xs" bind:value={credentialLabel} placeholder="Label (optional)" />
						</div>
						{#if credentialProvider === 'browserbase'}
							<Input
								class="text-xs"
								bind:value={credentialProjectId}
								placeholder="Project ID (required)"
								autocomplete="off"
							/>
						{/if}
						<Input
							class="text-xs"
							type="password"
							bind:value={credentialKey}
							placeholder="API key"
							autocomplete="off"
						/>
						<Button type="button" class="h-9" onclick={saveCredential}>Save API key</Button>
						{#if credentialError && addProviderTab === 'api_key'}
							<p class="text-xs text-destructive">{credentialError}</p>
						{/if}
					</Tabs.Content>
					<Tabs.Content value="chatgpt" class="mt-0 flex flex-col gap-2">
						<p class="text-xs text-muted-foreground">
							Use a ChatGPT subscription for OpenAI-backed runs. Sign-in opens OpenAI in a new tab
							and completes here with a one-time code.
						</p>
						<Input class="text-xs" bind:value={credentialLabel} placeholder="Label (optional)" />
						<Button type="button" class="h-9" disabled={connectingChatGpt} onclick={connectChatGpt}>
							{connectingChatGpt ? 'Connecting…' : 'Connect with ChatGPT'}
						</Button>
						{#if !data.chatgptOAuthUseDeviceFlow}
							<Button
								type="button"
								variant="outline"
								class="h-9"
								disabled={connectingChatGpt}
								onclick={startDeviceConnect}
							>
								Sign in with device code
							</Button>
						{/if}
						{#if chatgptConnectError && addProviderTab === 'chatgpt'}
							<p class="text-xs text-destructive">{chatgptConnectError}</p>
						{/if}
					</Tabs.Content>
				</Tabs.Root>
			</div>
		</div>
	</Sheet.Content>
</Sheet.Root>

<Dialog.Root bind:open={deviceModalOpen} onOpenChange={(open) => !open && closeDeviceModal()}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Sign in with device code</Dialog.Title>
			<Dialog.Description>
				Open the link below, sign in to ChatGPT, and enter the one-time code. This window will
				update when authorization completes.
			</Dialog.Description>
		</Dialog.Header>
		{#if deviceAuth}
			{@const activeDeviceAuth = deviceAuth}
			<div class="grid gap-3 py-2">
				<div class="rounded-md border border-border/60 bg-secondary/20 px-3 py-2">
					<p class="text-xs text-muted-foreground">Your code</p>
					<p class="font-mono text-2xl font-semibold tracking-widest">
						{activeDeviceAuth.userCode}
					</p>
				</div>
				<Button
					variant="outline"
					class="h-9 gap-2"
					type="button"
					onclick={() =>
						window.open(activeDeviceAuth.verificationUri, '_blank', 'noopener,noreferrer')}
				>
					<ExternalLink class="size-3.5" />
					Open verification page
				</Button>
				<p class="text-xs text-muted-foreground">Waiting for authorization…</p>
			</div>
		{/if}
		<Dialog.Footer>
			<Button variant="ghost" type="button" onclick={closeDeviceModal}>Cancel</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
