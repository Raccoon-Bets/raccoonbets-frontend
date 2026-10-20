<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import ChevronDownIcon from '@primevue/icons/chevrondown'
import { Check, Copy as CopyIcon } from '@lucide/vue'
import InstructionText from '@/components/assistants/instructionText.vue'
import StickerCard from '@/components/sticker/stickerCard.vue'
import UserMenu from '@/components/userMenu.vue'
import { useAuthStore } from '@/stores/modules/auth'
import config from '@/config'

const { t } = useI18n()
const authStore = useAuthStore()
const serverURL = `${config.APIURL}/mcp`
const copiedText = ref<string | null>(null)
const copyFailed = ref(false)

/** A platform's translation key and the terminal command each step runs, by step number. */
interface Platform {
  key: string
  commands: Partial<Record<number, string>>
}

const platforms: Platform[] = [
  { key: 'claude', commands: {} },
  { key: 'chatgpt', commands: {} },
  {
    key: 'claudeCode',
    commands: { 1: `claude mcp add --transport http raccoon-bets ${serverURL}` },
  },
  {
    key: 'codex',
    commands: {
      1: `codex mcp add raccoon-bets --url ${serverURL}`,
      2: 'codex mcp login raccoon-bets',
    },
  },
]

async function copy(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    copiedText.value = text
    copyFailed.value = false
  } catch {
    copiedText.value = null
    copyFailed.value = true
  }
}

function selectAll(event: FocusEvent): void {
  if (event.target instanceof HTMLInputElement) event.target.select()
}
</script>

<template>
  <main id="main-content" class="auth-view">
    <user-menu />
    <h1>{{ t('assistants.title') }}</h1>
    <p>{{ t('assistants.intro') }}</p>

    <sticker-card class="detail-section">
      <label for="assistants-server-url" class="server-url-label">
        {{ t('assistants.serverURL') }}
      </label>
      <div class="server-url">
        <InputText
          id="assistants-server-url"
          :model-value="serverURL"
          readonly
          fluid
          @focus="selectAll"
        />
        <Button
          type="button"
          severity="secondary"
          :label="copiedText === serverURL ? t('assistants.copied') : t('assistants.copy')"
          @click="copy(serverURL)"
        />
      </div>
      <p v-if="copyFailed" role="alert" class="hint">{{ t('assistants.copyError') }}</p>
    </sticker-card>

    <sticker-card v-for="platform in platforms" :key="platform.key" class="detail-section platform">
      <details>
        <summary>
          <h2>{{ t(`assistants.${platform.key}.title`) }}</h2>
          <small>{{ t(`assistants.${platform.key}.kind`) }}</small>
          <chevron-down-icon class="chevron" aria-hidden="true" />
        </summary>
        <ol>
          <li v-for="step in 3" :key="step">
            <instruction-text :text="t(`assistants.${platform.key}.step${step}`)" />
            <div v-if="platform.commands[step]" class="command">
              <pre><code>{{ platform.commands[step] }}</code></pre>
              <button
                type="button"
                class="copy-command"
                :aria-label="
                  copiedText === platform.commands[step]
                    ? t('assistants.copiedCommand')
                    : t('assistants.copyCommand')
                "
                @click="copy(platform.commands[step])"
              >
                <check
                  v-if="copiedText === platform.commands[step]"
                  :size="16"
                  aria-hidden="true"
                />
                <copy-icon v-else :size="16" aria-hidden="true" />
              </button>
            </div>
          </li>
        </ol>
      </details>
    </sticker-card>

    <p><instruction-text :text="t('assistants.revoke')" /></p>
    <p class="hint">{{ t('assistants.privacy') }}</p>
    <router-link v-if="!authStore.loggedIn" :to="{ name: 'home' }">
      {{ t('assistants.home') }}
    </router-link>
  </main>
</template>

<style scoped lang="scss">
.server-url-label {
  font-family: var(--rb-font-display);
  font-weight: 800;
}

.server-url {
  display: flex;
  gap: var(--spacing-sm);
  align-items: center;
  min-width: 0;
  margin-top: var(--spacing-xs);
}

.hint {
  margin: var(--spacing-xs) 0 var(--spacing-md);
  font-size: 14px;
  color: var(--rb-muted);
}

.platform {
  padding: 0;

  summary {
    display: flex;
    gap: var(--spacing-sm);
    align-items: baseline;
    padding: var(--spacing-md);
    cursor: pointer;
    list-style: none;
    border-radius: var(--rb-radius-card);

    &::-webkit-details-marker {
      display: none;
    }

    &:focus-visible {
      outline: 3px solid var(--rb-focus-ring);
      outline-offset: 2px;
    }
  }

  h2 {
    margin: 0;
  }

  .chevron {
    align-self: center;
    margin-left: auto;
    transition: rotate 0.15s ease;
  }

  details[open] .chevron {
    rotate: 180deg;
  }

  ol {
    padding: 0 var(--spacing-md) var(--spacing-md) calc(var(--spacing-md) + 20px);
    margin: 0;
  }

  li + li {
    margin-top: var(--spacing-sm);
  }
}

.command {
  display: flex;
  align-items: center;
  margin-top: var(--spacing-xs);
  background: var(--rb-bg);
  border: var(--rb-border-width-control) solid var(--rb-ink);
  border-radius: var(--rb-radius-control);

  pre {
    flex: 1;
    min-width: 0;
    padding: var(--spacing-sm);
    margin: 0;
    overflow-x: auto;
    font-size: 13px;
    white-space: pre;
  }
}

.copy-command {
  display: flex;
  flex-shrink: 0;
  padding: 6px;
  margin-right: 6px;
  color: var(--rb-muted);
  cursor: pointer;
  background: var(--rb-bg);
  border: none;
  border-radius: 8px;

  &:hover {
    color: var(--rb-ink);
  }

  &:focus-visible {
    outline: 3px solid var(--rb-focus-ring);
    outline-offset: 1px;
  }
}
</style>
