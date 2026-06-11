<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

interface Props {
  /** The route to link to; omit to render a button instead. */
  to?: RouteLocationRaw

  /** Whether the pill is the active one in its row. */
  active?: boolean
}

withDefaults(defineProps<Props>(), { to: undefined, active: false })
</script>

<template>
  <router-link v-if="to" :to="to" class="sticker-pill" :class="{ active }">
    <slot />
  </router-link>
  <button v-else type="button" class="sticker-pill" :class="{ active }">
    <slot />
  </button>
</template>

<style scoped lang="scss">
.sticker-pill {
  display: inline-block;
  padding: 2px 14px;
  font-family: var(--rb-font-display);
  font-size: 14px;
  font-weight: 700;
  color: var(--rb-ink);
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
  background: var(--rb-surface);
  border: var(--rb-border-width-control) solid var(--rb-ink);
  border-radius: var(--rb-radius-pill);

  &.active {
    color: var(--rb-primary-ink);
    background: var(--rb-primary);
    box-shadow: 2px 2px 0 var(--rb-shadow-color);
  }

  &:focus-visible {
    outline: 3px solid var(--rb-focus-ring);
    outline-offset: 2px;
  }
}
</style>
