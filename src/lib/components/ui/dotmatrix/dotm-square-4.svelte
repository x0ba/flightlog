<script lang="ts">
	import DotMatrixBase from './dotmatrix-base.svelte';
	import {
		middleRingAntiClockwiseNormFromIndex,
		middleRingAntiClockwiseOrderValue,
		outerRingClockwiseNormFromIndex,
		outerRingClockwiseOrderValue,
		type DotAnimationResolver,
		type DotMatrixCommonProps,
		type DotStyle
	} from './dotmatrix-core.js';
	import { useDotMatrixPhases, usePrefersReducedMotion } from './dotmatrix-hooks.svelte.js';

	export type DotmSquare4Props = DotMatrixCommonProps;

	const animationResolver: DotAnimationResolver = ({
		isActive,
		index,
		row,
		col,
		reducedMotion,
		phase
	}) => {
		if (!isActive) {
			return { className: 'dmx-inactive' };
		}

		const isCenter = row === 2 && col === 2;
		if (isCenter) {
			return { className: 'dmx-inactive' };
		}

		const outerOrder = outerRingClockwiseOrderValue(index);
		if (outerOrder >= 0) {
			const outerNorm = outerRingClockwiseNormFromIndex(index);
			const style: DotStyle = { '--dmx-outer-order': outerOrder };
			if (reducedMotion || phase === 'idle') {
				return {
					style: {
						...style,
						opacity: 0.2 + outerNorm * 0.72
					}
				};
			}
			return { className: 'dmx-outer-snake', style };
		}

		const middleOrder = middleRingAntiClockwiseOrderValue(index);
		const middleNorm = middleRingAntiClockwiseNormFromIndex(index);
		const style: DotStyle = { '--dmx-middle-order': middleOrder };
		if (reducedMotion || phase === 'idle') {
			return {
				style: {
					...style,
					opacity: 0.2 + middleNorm * 0.72
				}
			};
		}

		return { className: 'dmx-middle-snake', style };
	};

	let {
		speed = 1.35,
		pattern = 'full',
		animated = true,
		hoverAnimated = false,
		size = 36,
		dotSize = 5,
		...rest
	}: DotmSquare4Props = $props();

	const reducedMotion = usePrefersReducedMotion();
	const phases = useDotMatrixPhases(() => ({
		animated: Boolean(animated && !reducedMotion.current),
		hoverAnimated: Boolean(hoverAnimated && !reducedMotion.current),
		speed
	}));
</script>

<DotMatrixBase
	{...rest}
	{size}
	{dotSize}
	{speed}
	{pattern}
	{animated}
	phase={phases.phase}
	onmouseenter={phases.onMouseEnter}
	onmouseleave={phases.onMouseLeave}
	reducedMotion={reducedMotion.current}
	{animationResolver}
/>
