<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import StickerBadge from '@/components/sticker/stickerBadge.vue'

const { t } = useI18n()
</script>

<template>
  <router-link :to="{ name: 'assistants' }" class="assistant-banner" data-testid="assistant-banner">
    <sticker-badge :tilt="-4">{{ t('assistants.banner.badge') }}</sticker-badge>
    <span>{{ t('assistants.banner.message') }}</span>
    <span class="action">{{ t('assistants.banner.action') }}</span>
  </router-link>
</template>

<style scoped lang="scss">
.assistant-banner {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs) var(--spacing-sm);
  align-items: center;
  justify-content: center;
  width: fit-content;
  max-width: 100%;
  padding: 6px 18px 6px 10px;
  margin: 0 auto var(--spacing-lg);
  font-size: 14px;
  line-height: 1.4;
  text-align: center;
  text-decoration: none;
  background: var(--rb-surface);
  border: var(--rb-border-width-control) solid var(--rb-ink);
  border-radius: var(--rb-radius-card);
  box-shadow: var(--rb-shadow-control);
  transition:
    translate 0.12s ease,
    box-shadow 0.12s ease;

  &:active {
    translate: 2px 2px;
    box-shadow: none;
  }

  &:focus-visible {
    outline: 3px solid var(--rb-focus-ring);
    outline-offset: 3px;
  }
}

.action {
  font-family: var(--rb-font-display);
  font-weight: 800;

  .assistant-banner:hover & {
    text-decoration: underline;
  }
}
</style>
