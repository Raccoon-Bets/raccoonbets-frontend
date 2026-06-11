<script setup lang="ts">
// Renders only its slot (typically a glyph), so callers must supply an
// aria-label for the accessible name.
</script>

<template>
  <button type="button" class="sticker-fab">
    <slot />
  </button>
</template>

<style scoped lang="scss">
.sticker-fab {
  position: fixed;
  right: var(--spacing-lg);
  bottom: var(--spacing-lg);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  font-family: var(--rb-font-display);
  font-size: 28px;
  font-weight: 800;
  color: var(--rb-primary-ink);
  cursor: pointer;
  background: var(--rb-primary);
  border: var(--rb-border-width) solid var(--rb-ink);
  border-radius: var(--rb-radius-card);
  box-shadow: var(--rb-shadow-control);
  transition:
    translate 0.12s ease,
    box-shadow 0.12s ease;

  &:active {
    translate: 3px 3px;
    box-shadow: 0 0 0 var(--rb-shadow-color);
  }

  &:focus-visible {
    outline: 3px solid var(--rb-focus-ring);
    outline-offset: 3px;
  }
}
</style>
