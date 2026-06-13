<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import config from '@/config'

const { t } = useI18n()

// The OmniAuth request phase is a top-level POST (OmniAuth 2 disables GET), so
// each provider is a real form submission rather than an XHR. The handshake is
// brokered on the apex — even from a group subdomain — so the OmniAuth `state`
// cookie is set and read first-party to the apex and survives privacy browsers
// that drop cookies set in a cross-site context, and so the providers see a
// single, pre-registered redirect_uri. The `origin` query tells the backend
// which frontend host to return the browser to once the OAuth dance completes.
function providerAction(provider: 'google' | 'apple'): string {
  const { protocol, port } = window.location
  const apexOrigin = `${protocol}//${config.apexDomain}${port ? `:${port}` : ''}`
  return `${apexOrigin}/auth/${provider}?origin=${encodeURIComponent(window.location.origin)}`
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
