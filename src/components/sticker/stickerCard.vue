<template>
  <div class="sticker-card">
    <slot />
  </div>
</template>

<style scoped lang="scss">
.sticker-card {
  position: relative;
  padding: var(--spacing-md);
  background: var(--rb-surface);
  border: var(--rb-border-width) solid var(--rb-ink);
  border-radius: var(--rb-radius-card);
  box-shadow: var(--rb-shadow-card);
}
</style>
