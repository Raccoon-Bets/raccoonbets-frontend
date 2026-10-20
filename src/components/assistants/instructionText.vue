<script setup lang="ts">
import { computed } from 'vue'

/**
 * Renders an instruction, styling `[Label]` as an interface element to choose
 * and `` `text` `` as something to type.
 */
const props = defineProps<{ text: string }>()

interface Segment {
  kind: 'plain' | 'label' | 'typed'
  text: string
}

const MARKUP = /(\[[^\]]+\]|`[^`]+`)/

function toSegment(part: string): Segment {
  if (part.startsWith('[')) return { kind: 'label', text: part.slice(1, -1) }
  if (part.startsWith('`')) return { kind: 'typed', text: part.slice(1, -1) }
  return { kind: 'plain', text: part }
}

const segments = computed(() => props.text.split(MARKUP).filter(Boolean).map(toSegment))
</script>

<template>
  <template v-for="(segment, index) in segments" :key="index">
    <strong v-if="segment.kind === 'label'">{{ segment.text }}</strong>
    <code v-else-if="segment.kind === 'typed'" class="typed">{{ segment.text }}</code>
    <template v-else>{{ segment.text }}</template>
  </template>
</template>

<style scoped lang="scss">
.typed {
  padding: 0 6px;
  font-size: 0.9em;
  background: var(--rb-bg);
  border: 1.5px solid var(--rb-ink);
  border-radius: 6px;
}
</style>
