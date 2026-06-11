<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

interface Props {
  /** The route to link to; omit to render a button instead. */
  to?: RouteLocationRaw

  /** The visual weight: `primary` (butter/violet), `ghost`, or `danger`. */
  variant?: 'primary' | 'ghost' | 'danger'
}

withDefaults(defineProps<Props>(), { to: undefined, variant: 'primary' })
</script>

<template>
  <router-link v-if="to" :to="to" class="sticker-button" :class="variant">
    <slot />
  </router-link>
  <button v-else type="button" class="sticker-button" :class="variant">
    <slot />
  </button>
</template>

<style scoped lang="scss">
.sticker-button {
  display: inline-block;
  padding: 6px 16px;
  font-family: var(--rb-font-display);
  font-size: 15px;
  font-weight: 800;
  color: var(--rb-ink);
  text-decoration: none;
  cursor: pointer;
  border: var(--rb-border-width) solid var(--rb-ink);
  border-radius: var(--rb-radius-control);
  box-shadow: var(--rb-shadow-control);
  transition:
    translate 0.12s ease,
    box-shadow 0.12s ease;

  &.primary {
    color: var(--rb-primary-ink);
    background: var(--rb-primary);
  }

  &.ghost {
    background: var(--rb-surface);
  }

  &.danger {
    color: var(--rb-negative-ink);
    background: var(--rb-negative-bg);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  &:focus-visible {
    outline: 3px solid var(--rb-focus-ring);
    outline-offset: 3px;
  }

  &:active:not(:disabled) {
    translate: 3px 3px;
    box-shadow: 0 0 0 var(--rb-shadow-color);
  }
}
</style>
