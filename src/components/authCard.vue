<script setup lang="ts">
import RaccoonMascot from '@/components/mascot/raccoonMascot.vue'
import StickerCard from '@/components/sticker/stickerCard.vue'
</script>

<template>
  <sticker-card class="auth-card">
    <div class="mark">
      <raccoon-mascot pose="logo" :size="56" />
    </div>
    <slot />
  </sticker-card>
</template>

<style scoped lang="scss">
.auth-card {
  padding: var(--spacing-lg);

  .mark {
    margin-bottom: var(--spacing-sm);
    text-align: center;
  }
}
</style>
