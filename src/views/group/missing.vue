<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import RaccoonMascot from '@/components/mascot/raccoonMascot.vue'
import config from '@/config'
import { groupSlug } from '@/config/tenant'

const { t } = useI18n()
const apexURL = `${window.location.protocol}//${config.apexDomain}${window.location.port ? `:${window.location.port}` : ''}/`
</script>

<template>
  <main id="main-content" class="auth-view">
    <raccoon-mascot pose="lost" :size="120" />
    <h1>{{ t('groupMissing.title') }}</h1>
    <p>{{ t('groupMissing.body', { group: groupSlug }) }}</p>
    <a :href="apexURL">{{ t('groupMissing.apexLink') }}</a>
  </main>
</template>

<style scoped lang="scss">
.auth-view {
  text-align: center;
}
</style>
