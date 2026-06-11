<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import requireAuth from '@/composables/requireAuth'
import AccountForm from '@/components/account/form.vue'
import AccountPasskeys from '@/components/account/passkeys.vue'
import AccountNotifications from '@/components/account/notifications.vue'
import UserMenu from '@/components/userMenu.vue'
import StickerCard from '@/components/sticker/stickerCard.vue'

const { t } = useI18n()
requireAuth()
</script>

<template>
  <main id="main-content" class="auth-view">
    <user-menu />
    <h1>{{ t('account.title') }}</h1>
    <sticker-card class="detail-section">
      <account-form />
    </sticker-card>
    <sticker-card class="detail-section">
      <account-passkeys />
    </sticker-card>
    <sticker-card class="detail-section">
      <account-notifications />
    </sticker-card>
  </main>
</template>
