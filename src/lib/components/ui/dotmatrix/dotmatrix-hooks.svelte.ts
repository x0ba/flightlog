import type { DotMatrixPhase } from './dotmatrix-core.js';

export function usePrefersReducedMotion() {
	let prefersReducedMotion = $state(false);

	$effect(() => {
		const query = window.matchMedia('(prefers-reduced-motion: reduce)');

		const update = () => {
			prefersReducedMotion = query.matches;
		};

		update();
		query.addEventListener('change', update);

		return () => {
			query.removeEventListener('change', update);
		};
	});

	return {
		get current() {
			return prefersReducedMotion;
		}
	};
}

interface UseDotMatrixPhasesOptions {
	animated?: boolean;
	hoverAnimated?: boolean;
	speed?: number;
}

type OptionsInput = UseDotMatrixPhasesOptions | (() => UseDotMatrixPhasesOptions);

function resolveOptions(input: OptionsInput): UseDotMatrixPhasesOptions {
	return typeof input === 'function' ? input() : input;
}

export function useDotMatrixPhases(input: OptionsInput = {}) {
	const safeSpeed = $derived.by(() => {
		const speed = resolveOptions(input).speed ?? 1;
		return speed > 0 ? speed : 1;
	});

	const autoRun = $derived.by(() => {
		const { animated = false, hoverAnimated = false } = resolveOptions(input);
		return Boolean(animated && !hoverAnimated);
	});

	const hoverAnimated = $derived.by(() => resolveOptions(input).hoverAnimated ?? false);

	let hoverPhase = $state<DotMatrixPhase>('idle');
	let hoverGen = 0;
	const timeouts: number[] = [];

	const clearTimers = () => {
		for (const id of timeouts) {
			window.clearTimeout(id);
		}
		timeouts.length = 0;
	};

	$effect(() => {
		void autoRun;
		void hoverAnimated;
		hoverGen += 1;
		clearTimers();
		return clearTimers;
	});

	const onMouseEnter = () => {
		if (!hoverAnimated || autoRun) {
			return;
		}
		clearTimers();
		const gen = ++hoverGen;
		hoverPhase = 'collapse';
		const collapseMs = Math.max(1, Math.round(300 / safeSpeed));
		const id = window.setTimeout(() => {
			if (hoverGen !== gen) {
				return;
			}
			hoverPhase = 'hoverRipple';
		}, collapseMs);
		timeouts.push(id);
	};

	const onMouseLeave = () => {
		if (!hoverAnimated || autoRun) {
			return;
		}
		hoverGen += 1;
		clearTimers();
		hoverPhase = 'idle';
	};

	const phase = $derived.by((): DotMatrixPhase => {
		if (autoRun) {
			return 'loadingRipple';
		}
		return hoverAnimated ? hoverPhase : 'idle';
	});

	return {
		get phase() {
			return phase;
		},
		onMouseEnter,
		onMouseLeave
	};
}
