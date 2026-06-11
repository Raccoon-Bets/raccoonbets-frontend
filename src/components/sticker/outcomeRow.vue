<script setup lang="ts">
import { computed } from 'vue'

const ACCENTS = ['positive', 'negative', 'info'] as const

interface Props {
  /** The outcome name. */
  label: string

  /** The formatted pool amount (e.g. `$9.00`). */
  amount: string

  /** The formatted payout multiplier (e.g. `1.6×`), if the pool is nonempty. */
  multiplier: string | null

  /** The outcome's position, used to cycle accent colors. */
  index: number

  /**
   * Render as a selectable radio row instead of a static row. Interactive rows render a native
   * radio input; parents group them by passing the same `name` and wrapping the rows in an
   * element with `role="radiogroup"` and an aria-label. Arrow-key navigation comes from the
   * native radios. The full-row radio overlay captures clicks, so interactive rows must not
   * receive interactive slot content.
   */
  interactive?: boolean

  /** The radio group name (required when interactive). */
  name?: string

  /** Whether this outcome's radio is checked. Parents must mark at most one row per group as selected. */
  selected?: boolean

  /** Whether to mute the row (losing outcomes on resolved markets). */
  dimmed?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  interactive: false,
  name: undefined,
  selected: false,
  dimmed: false,
})

const emit = defineEmits<{
  /** Fires when the user selects this outcome. */
  select: []
}>()

const accent = computed(() => ACCENTS[props.index % ACCENTS.length])
</script>

<template>
  <label v-if="interactive" class="outcome-row interactive" :class="[accent, { selected, dimmed }]">
    <input
      type="radio"
      class="row-radio"
      :name="name"
      :checked="selected"
      :aria-label="label"
      @change="emit('select')"
    />
    <span class="label">{{ label }}</span>
    <span class="figures">
      <span class="amount">{{ amount }}</span>
      <span v-if="multiplier" class="multiplier">· {{ multiplier }}</span>
    </span>
    <slot />
  </label>
  <div v-else class="outcome-row" :class="[accent, { dimmed }]">
    <span class="label">{{ label }}</span>
    <span class="figures">
      <span class="amount">{{ amount }}</span>
      <span v-if="multiplier" class="multiplier">· {{ multiplier }}</span>
    </span>
    <slot />
  </div>
</template>

<style scoped lang="scss">
.outcome-row {
  position: relative;
  display: flex;
  gap: var(--spacing-sm);
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 8px 14px;
  margin-bottom: 9px;
  font-family: var(--rb-font-display);
  font-size: 14px;
  font-weight: 700;
  text-align: left;
  border: var(--rb-border-width-control) solid var(--rb-ink);
  border-radius: var(--rb-radius-control);
  box-shadow: var(--rb-shadow-control);

  &.positive {
    color: var(--rb-positive-ink);
    background: var(--rb-positive-bg);
  }

  &.negative {
    color: var(--rb-negative-ink);
    background: var(--rb-negative-bg);
  }

  &.info {
    color: var(--rb-info-ink);
    background: var(--rb-info-bg);
  }

  &.interactive {
    cursor: pointer;
    transition:
      translate 0.12s ease,
      box-shadow 0.12s ease;

    &:active {
      translate: 3px 3px;
      box-shadow: 0 0 0 var(--rb-shadow-color);
    }
  }

  &:has(.row-radio:focus-visible) {
    outline: 3px solid var(--rb-focus-ring);
    outline-offset: 3px;
  }

  &.selected {
    outline: 3px solid var(--rb-ink);
    outline-offset: 2px;
  }

  &.dimmed {
    color: var(--rb-muted);
    background: var(--rb-surface);
    box-shadow: none;
    opacity: 0.7;
  }

  .figures {
    flex-shrink: 0;
  }
}

.row-radio {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  cursor: pointer;
  opacity: 0;
}
</style>
