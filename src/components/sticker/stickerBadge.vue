<script setup lang="ts">
interface Props {
  /** The badge color. */
  tone?: 'primary' | 'positive' | 'negative' | 'info' | 'muted' | 'warning' | 'alert'

  /** Rotation in degrees (stickers sit slightly tilted). */
  tilt?: number

  /** Whether the badge overlaps its parent's top-right corner. The parent must be positioned (stickerCard already is). */
  overlap?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  tone: 'primary',
  tilt: 4,
  overlap: false,
})
</script>

<template>
  <span class="sticker-badge" :class="[tone, { overlap }]" :style="{ rotate: `${props.tilt}deg` }">
    <slot />
  </span>
</template>

<style scoped lang="scss">
.sticker-badge {
  display: inline-block;
  padding: 1px 12px;
  font-family: var(--rb-font-display);
  font-size: 12px;
  font-weight: 800;
  border: var(--rb-border-width-control) solid var(--rb-ink);
  border-radius: var(--rb-radius-pill);
  box-shadow: 2px 2px 0 var(--rb-shadow-color);

  &.primary {
    color: var(--rb-primary-ink);
    background: var(--rb-primary);
  }

  &.positive {
    color: var(--rb-positive-ink);
    background: var(--rb-positive-bg);
  }

  &.negative {
    color: var(--rb-negative-ink);
    background: var(--rb-negative-bg);
  }

  &.warning {
    color: var(--rb-warning-ink);
    background: var(--rb-warning-bg);
  }

  &.alert {
    color: var(--rb-alert-ink);
    background: var(--rb-alert-bg);
  }

  &.info {
    color: var(--rb-info-ink);
    background: var(--rb-info-bg);
  }

  &.muted {
    color: var(--rb-muted);
    background: var(--rb-surface);
  }

  &.overlap {
    position: absolute;
    top: -14px;
    right: 14px;
  }

  @media (prefers-reduced-motion: no-preference) {
    &.overlap {
      animation: slap 0.18s ease-out;
    }
  }
}

@keyframes slap {
  from {
    scale: 1.25;
    rotate: 0deg;
  }
}
</style>
