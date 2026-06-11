<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import config from '@/config'

const { t } = useI18n()

// The OmniAuth request phase is a top-level POST (OmniAuth 2 disables GET), so
// each provider is a real form submission rather than an XHR. The `origin`
// query tells the backend which frontend host — the apex or a group subdomain —
// to return the browser to once the OAuth dance completes.
function providerAction(provider: 'google' | 'apple'): string {
  return `${config.APIURL}/auth/${provider}?origin=${encodeURIComponent(window.location.origin)}`
}
</script>

<template>
  <div class="oauth-buttons">
    <div class="oauth-divider" role="separator">
      <span>{{ t('auth.oauth.dividerLabel') }}</span>
    </div>

    <form method="post" :action="providerAction('google')">
      <Button
        type="submit"
        severity="secondary"
        outlined
        class="oauth-button"
        :label="t('auth.oauth.google')"
        data-testid="oauth-google"
      />
    </form>

    <form method="post" :action="providerAction('apple')">
      <Button
        type="submit"
        severity="secondary"
        outlined
        class="oauth-button"
        :label="t('auth.oauth.apple')"
        data-testid="oauth-apple"
      />
    </form>
  </div>
</template>

<style scoped lang="scss">
.oauth-buttons {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);

  form {
    margin: 0;
  }
}

.oauth-button {
  width: 100%;
}

.oauth-divider {
  display: flex;
  align-items: center;
  margin: var(--spacing-sm) 0;
  font-size: 0.875rem;
  color: var(--p-text-muted-color);

  &::before,
  &::after {
    flex: 1;
    height: 1px;
    content: '';
    background: var(--p-content-border-color);
  }

  span {
    padding: 0 var(--spacing-sm);
  }
}
</style>
