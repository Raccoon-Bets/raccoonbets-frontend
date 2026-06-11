<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import RaccoonMascot from '@/components/mascot/raccoonMascot.vue'

const { t } = useI18n()
</script>

<template>
  <main id="main-content">
    <raccoon-mascot pose="lost" :size="120" />
    <h1>{{ t('notFound.title') }}</h1>
    <p>{{ t('notFound.body') }}</p>
    <router-link to="/">{{ t('notFound.homeLink') }}</router-link>
  </main>
</template>

<style scoped lang="scss">
main {
  max-width: 640px;
  padding: var(--spacing-lg);
  margin: 0 auto;
  text-align: center;
}
</style>
