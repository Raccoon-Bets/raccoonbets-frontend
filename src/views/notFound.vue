<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { usePreferredReducedMotion } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import RaccoonMascot from '@/components/mascot/raccoonMascot.vue'
import OutcomeRow from '@/components/sticker/outcomeRow.vue'
import StickerButton from '@/components/sticker/stickerButton.vue'
import StickerCard from '@/components/sticker/stickerCard.vue'

const { t, locale } = useI18n()

/** Where "Yes" opens: hopeful, and wrong. */
const OPENING_PERCENT = 37

/** How many price ticks the market trades for before it resolves. */
const TICKS = 32

/** Milliseconds between ticks. */
const TICK_MS = 90

/** The tick interval as a CSS duration, bound onto the book as its fills' transition time. */
const tickDuration = `${String(TICK_MS)}ms`

const TAPE_WIDTH = 240
const TAPE_HEIGHT = 64
const TAPE_PADDING = 3

/** Top of the tape's y axis in percentage points, leaving headroom above the open. */
const TAPE_CEILING = 40

const baselineY = TAPE_HEIGHT - TAPE_PADDING

function easeInOutCubic(progress: number): number {
  return progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2
}

/**
 * The "Yes" price at a given tick: a fixed ease from the open down to zero, with a fading wobble
 * so the tape looks traded rather than drawn. Deterministic, so every visit sees the same market.
 */
function yesPriceAt(tick: number): number {
  if (tick >= TICKS) return 0
  const progress = tick / TICKS
  const slide = OPENING_PERCENT * (1 - easeInOutCubic(progress))
  const chatter = 2.4 * Math.sin(progress * 17) * (1 - progress)
  return Math.max(0, Math.round(slide + chatter))
}

// Visitors who ask for less motion get the settled book straight away.
const tick = ref(usePreferredReducedMotion().value === 'reduce' ? TICKS : 0)

let ticker: number | null = null

function stopTicker(): void {
  if (ticker !== null) {
    clearInterval(ticker)
    ticker = null
  }
}

if (tick.value < TICKS) {
  ticker = window.setInterval(() => {
    tick.value += 1
    if (tick.value >= TICKS) stopTicker()
  }, TICK_MS)
}

onUnmounted(stopTicker)

const isSettled = computed(() => tick.value >= TICKS)
const yesPercent = computed(() => yesPriceAt(tick.value))
const noPercent = computed(() => 100 - yesPercent.value)

/** Every "Yes" print so far, as polyline coordinates in the tape's viewBox. */
const tapePoints = computed(() =>
  Array.from({ length: tick.value + 1 }, (_, print) => {
    const x = (print / TICKS) * TAPE_WIDTH
    const plotted = (yesPriceAt(print) / TAPE_CEILING) * (TAPE_HEIGHT - 2 * TAPE_PADDING)
    return `${x.toFixed(1)},${(baselineY - plotted).toFixed(1)}`
  }).join(' '),
)

function formatPercent(percent: number): string {
  return new Intl.NumberFormat(locale.value, { style: 'percent' }).format(percent / 100)
}
</script>

<template>
  <main id="main-content">
    <raccoon-mascot pose="lost" :size="120" />
    <h1 class="headline">
      <span class="ticker">404</span>
      <span>{{ t('notFound.title') }}</span>
    </h1>
    <p class="lede">{{ t('notFound.body') }}</p>

    <sticker-card class="market">
      <h2 class="question">{{ t('notFound.market.question') }}</h2>

      <div class="book" :style="{ '--tick-duration': tickDuration }" aria-hidden="true">
        <span class="fill yes" :style="{ width: `${yesPercent}%` }"></span>
        <span class="fill no" :style="{ width: `${noPercent}%` }"></span>
      </div>

      <outcome-row
        :label="t('notFound.market.yes')"
        :amount="formatPercent(yesPercent)"
        :multiplier="null"
        :index="0"
        :dimmed="isSettled"
      />
      <outcome-row
        :label="t('notFound.market.no')"
        :amount="formatPercent(noPercent)"
        :multiplier="null"
        :index="1"
      />

      <div class="tape">
        <svg
          class="chart"
          :viewBox="`0 0 ${TAPE_WIDTH} ${TAPE_HEIGHT}`"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <line
            class="baseline"
            x1="0"
            :y1="baselineY"
            :x2="TAPE_WIDTH"
            :y2="baselineY"
            stroke-dasharray="4 4"
          />
          <polyline class="print" :points="tapePoints" vector-effect="non-scaling-stroke" />
        </svg>
        <span v-if="isSettled" class="stamp">{{ t('notFound.market.resolved') }}</span>
      </div>
    </sticker-card>

    <sticker-button to="/">{{ t('notFound.homeLink') }}</sticker-button>
  </main>
</template>

<style scoped lang="scss">
main {
  max-width: 640px;
  padding: var(--spacing-lg);
  margin: 0 auto;
  text-align: center;
}

.headline {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
  align-items: center;
  justify-content: center;
  margin: var(--spacing-sm) 0;
}

.ticker {
  padding: 0 10px;
  font-size: 30px;
  letter-spacing: 1px;
  color: var(--rb-primary-ink);
  background: var(--rb-primary);
  border: var(--rb-border-width) solid var(--rb-ink);
  border-radius: var(--rb-radius-control);
  box-shadow: var(--rb-shadow-control);
  rotate: -3deg;
}

.lede {
  color: var(--rb-muted);
}

.market {
  // The falling-price line reads as a loss in both schemes.
  --rb-tape-print: #d1385f;

  max-width: 420px;
  margin: var(--spacing-lg) auto;
  text-align: left;
}

@media (prefers-color-scheme: dark) {
  .market {
    --rb-tape-print: #ff9ecb;
  }
}

.question {
  margin: 0 0 var(--spacing-md);
}

.book {
  display: flex;
  height: 14px;
  margin-bottom: var(--spacing-md);
  overflow: hidden;
  border: var(--rb-border-width-control) solid var(--rb-ink);
  border-radius: var(--rb-radius-pill);
}

.fill {
  // Bound to the script's tick interval, so the book slides instead of stepping.
  transition: width var(--tick-duration) linear;

  &.yes {
    background: var(--rb-positive-bg);
  }

  &.no {
    background: var(--rb-negative-bg);
  }
}

.tape {
  position: relative;
}

.chart {
  display: block;
  width: 100%;
  height: 64px;
  background-color: var(--rb-surface);
  background-image: radial-gradient(var(--rb-bg-dot) 1px, transparent 1px);
  background-size: 12px 12px;
  border: var(--rb-border-width-control) solid var(--rb-ink);
  border-radius: var(--rb-radius-control);
}

.baseline {
  stroke: var(--rb-muted);
  stroke-width: 1;
}

.print {
  fill: none;
  stroke: var(--rb-tape-print);
  stroke-width: 2.5;
  stroke-linejoin: round;
}

.stamp {
  position: absolute;
  top: 50%;
  left: 50%;
  padding: 2px 14px;
  font-family: var(--rb-font-display);
  font-size: 15px;
  font-weight: 800;
  letter-spacing: 1px;
  color: var(--rb-negative-ink);
  text-transform: uppercase;
  background: var(--rb-negative-bg);
  border: var(--rb-border-width) dashed var(--rb-ink);
  border-radius: var(--rb-radius-control);
  rotate: -7deg;
  translate: -50% -50%;
  animation: stamp-down 0.26s ease-out;
}

@keyframes stamp-down {
  from {
    opacity: 0;
    scale: 1.7;
  }
}

@media (prefers-reduced-motion: reduce) {
  .fill {
    transition: none;
  }

  .stamp {
    opacity: 1;
    scale: 1;
    animation: none;
  }
}

@media (width <= 700px) {
  .market {
    margin: var(--spacing-md) auto;
  }

  .ticker {
    font-size: 26px;
  }
}
</style>
