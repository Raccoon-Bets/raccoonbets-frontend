<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import RaccoonMascot from '@/components/mascot/raccoonMascot.vue'
import StickerButton from '@/components/sticker/stickerButton.vue'
import UserMenu from '@/components/userMenu.vue'
import { useAuthStore } from '@/stores/modules/auth'

const { t } = useI18n()
const authStore = useAuthStore()
</script>

<template>
  <main id="main-content" class="auth-view landing">
    <user-menu />
    <div class="hero">
      <raccoon-mascot pose="coin" :size="140" />
      <h1>{{ t('landing.title') }}</h1>
      <p class="tagline">{{ t('landing.tagline') }}</p>
      <p>{{ t('landing.pitch') }}</p>
    </div>

    <nav v-if="authStore.loggedIn" class="cta-row">
      <sticker-button :to="{ name: 'groups' }" variant="primary" data-testid="landing-groups-link">
        {{ t('landing.groupsLink') }}
      </sticker-button>
      <router-link :to="{ name: 'account' }" class="quiet-link">
        {{ t('landing.accountLink') }}
      </router-link>
    </nav>
    <nav v-else class="cta-row">
      <sticker-button :to="{ name: 'signUp' }" variant="primary">
        {{ t('landing.ctaSignUp') }}
      </sticker-button>
      <router-link :to="{ name: 'logIn' }" class="quiet-link">
        {{ t('landing.logInLink') }}
      </router-link>
    </nav>
  </main>
</template>

<style scoped lang="scss">
.landing {
  text-align: center;
}

.hero {
  margin: var(--spacing-lg) 0;

  .tagline {
    font-family: var(--rb-font-display);
    font-size: 19px;
    font-weight: 700;
  }
}

.cta-row {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  align-items: center;
}

.quiet-link {
  font-weight: 700;
  color: var(--rb-muted);

  &:hover {
    color: var(--rb-ink);
  }
}
</style>
