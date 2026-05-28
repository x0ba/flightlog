<script lang="ts">
	import { cn } from '$lib/utils.js';
	import './dotmatrix-loader.css';
	import {
		MATRIX_SIZE,
		clamp01Dmx,
		distanceFromCenter,
		dmxBloomHaloSpreadClass,
		dmxBloomRootActive,
		dmxDotBloomParts,
		getMatrix5Layout,
		getPatternIndexes,
		indexToCoord,
		manhattanDistance,
		normalizedRadius,
		polarAngle,
		remapOpacityToTriplet,
		resolveDmxBoxOuterDim,
		resolveDmxColorTokens,
		dotStyle,
		type DotAnimationResolver,
		type DotMatrixCommonProps,
		type DotMatrixPhase,
		type DotStyle
	} from './dotmatrix-core.js';

	type Props = DotMatrixCommonProps & {
		class?: string;
		phase: DotMatrixPhase;
		reducedMotion?: boolean;
		onmouseenter?: () => void;
		onmouseleave?: () => void;
		animationResolver?: DotAnimationResolver;
	};

	let {
		size = 24,
		dotSize = 3,
		color = 'currentColor',
		colorPreset,
		speed = 1,
		ariaLabel = 'Loading',
		class: className,
		pattern = 'diamond',
		dotShape = 'circle',
		muted = false,
		bloom = false,
		halo = 0,
		dotClassName,
		phase,
		reducedMotion = false,
		onmouseenter,
		onmouseleave,
		animationResolver,
		opacityBase,
		opacityMid,
		opacityPeak,
		cellPadding,
		boxSize,
		minSize
	}: Props = $props();

	const patternIndexes = $derived(new Set(getPatternIndexes(pattern)));
	const safeSpeed = $derived(speed > 0 ? speed : 1);
	const speedScale = $derived(1 / safeSpeed);
	const layout = $derived(getMatrix5Layout(size, dotSize, cellPadding));
	const boxLayout = $derived(resolveDmxBoxOuterDim({ boxSize, minSize }));
	const scale = $derived(
		boxLayout.useWrapper && layout.matrixSpan > 0 ? boxLayout.outerDim / layout.matrixSpan : 1
	);
	const center = Math.floor(MATRIX_SIZE / 2);
	const ob = $derived(clamp01Dmx(opacityBase));
	const om = $derived(clamp01Dmx(opacityMid));
	const op = $derived(clamp01Dmx(opacityPeak));
	const unit = $derived(dotSize + layout.gap);
	const colorTokens = $derived(resolveDmxColorTokens(color, colorPreset));

	const dmxVarStyle = $derived.by(() => {
		const style: DotStyle = {
			width: layout.matrixSpan,
			height: layout.matrixSpan,
			'--dmx-speed': speedScale,
			'--dmx-dot-size': `${dotSize}px`,
			'--dmx-halo-level': halo,
			'--dmx-dot-fill': colorTokens.dotFill,
			color: colorTokens.resolvedColor
		};

		if (ob !== undefined) style['--dmx-opacity-base'] = ob;
		if (om !== undefined) style['--dmx-opacity-mid'] = om;
		if (op !== undefined) style['--dmx-opacity-peak'] = op;

		if (boxLayout.useWrapper) {
			style.transform = `scale(${scale})`;
			style.transformOrigin = 'center center';
		} else {
			if (minSize !== undefined) {
				style.minWidth = minSize;
				style.minHeight = minSize;
			}
		}

		return style;
	});

	type DotRender = {
		index: number;
		class: string;
		style: DotStyle;
	};

	const dots = $derived.by((): DotRender[] => {
		return Array.from({ length: MATRIX_SIZE * MATRIX_SIZE }, (_, index) => {
			const { row, col } = indexToCoord(index);
			const isActive = patternIndexes.has(index);
			const distance = distanceFromCenter(index);
			const angle = polarAngle(index);
			const radiusNormalizedValue = normalizedRadius(index);
			const manhattan = manhattanDistance(index);
			const deltaX = (col - center) * unit;
			const deltaY = (row - center) * unit;

			const animationState = animationResolver
				? animationResolver({
						index,
						row,
						col,
						distanceFromCenter: distance,
						angleFromCenter: angle,
						radiusNormalized: radiusNormalizedValue,
						manhattanDistance: manhattan,
						phase,
						isActive,
						reducedMotion
					})
				: {};

			const resolvedAnimationStyle = animationState.style ? { ...animationState.style } : undefined;
			let isBloomDot = false;
			let stylePatch: DotStyle | undefined = resolvedAnimationStyle;

			if (isActive) {
				const rawOpacity = stylePatch?.opacity;
				if (stylePatch != null && typeof rawOpacity === 'number') {
					const remappedOpacity = remapOpacityToTriplet(rawOpacity, ob, om, op);
					stylePatch = { ...stylePatch, opacity: remappedOpacity };
					const parts = dmxDotBloomParts(true, rawOpacity, bloom, halo, ob, om, op);
					stylePatch['--dmx-bloom-level'] = parts.level;
					isBloomDot = parts.bloomDot;
				} else {
					const parts = dmxDotBloomParts(true, 0, bloom, halo, ob, om, op);
					if (parts.level > 0) {
						stylePatch = {
							...(stylePatch ?? {}),
							'--dmx-bloom-level': parts.level
						};
					}
					isBloomDot = parts.bloomDot;
				}
			}

			const dotStyle: DotStyle = {
				width: dotSize,
				height: dotSize,
				'--dmx-distance': distance,
				'--dmx-row': row,
				'--dmx-col': col,
				'--dmx-x': `${deltaX}px`,
				'--dmx-y': `${deltaY}px`,
				'--dmx-angle': angle,
				'--dmx-radius': radiusNormalizedValue,
				'--dmx-manhattan': manhattan,
				...stylePatch,
				...(!isActive
					? {
							opacity: 0,
							visibility: 'hidden',
							pointerEvents: 'none',
							animation: 'none'
						}
					: {})
			};

			return {
				index,
				class: cn(
					'dmx-dot',
					!isActive && 'dmx-inactive',
					isBloomDot && 'dmx-bloom-dot',
					dotClassName,
					animationState.className
				),
				style: dotStyle
			};
		});
	});

	const rootClass = $derived(
		cn(
			'dmx-root',
			`dmx-dot-shape-${dotShape}`,
			muted && 'dmx-muted',
			dmxBloomRootActive(bloom, halo) && 'dmx-bloom',
			dmxBloomHaloSpreadClass(halo),
			!boxLayout.useWrapper && className
		)
	);
</script>

{#if boxLayout.useWrapper}
	<div
		role="status"
		aria-live="polite"
		aria-label={ariaLabel}
		class={className}
		style:display="inline-flex"
		style:align-items="center"
		style:justify-content="center"
		style:width="{boxLayout.outerDim}px"
		style:height="{boxLayout.outerDim}px"
		style:min-width={minSize !== undefined ? `${minSize}px` : undefined}
		style:min-height={minSize !== undefined ? `${minSize}px` : undefined}
		style:overflow="hidden"
		{onmouseenter}
		{onmouseleave}
	>
		<div class={rootClass} style={dotStyle(dmxVarStyle)}>
			<div class="dmx-grid" style:gap="{layout.gap}px">
				{#each dots as dot (dot.index)}
					<span aria-hidden="true" class={dot.class} style={dotStyle(dot.style)}></span>
				{/each}
			</div>
		</div>
	</div>
{:else}
	<div
		role="status"
		aria-live="polite"
		aria-label={ariaLabel}
		class={rootClass}
		style={dotStyle(dmxVarStyle)}
		{onmouseenter}
		{onmouseleave}
	>
		<div class="dmx-grid" style:gap="{layout.gap}px">
			{#each dots as dot (dot.index)}
				<span aria-hidden="true" class={dot.class} style={dotStyle(dot.style)}></span>
			{/each}
		</div>
	</div>
{/if}
