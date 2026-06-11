<script setup lang="ts">
import celebrateUrl from '@/assets/mascot/celebrate.svg'
import coinUrl from '@/assets/mascot/coin.svg'
import ledgerUrl from '@/assets/mascot/ledger.svg'
import logoUrl from '@/assets/mascot/logo.svg'
import lostUrl from '@/assets/mascot/lost.svg'
import shrugUrl from '@/assets/mascot/shrug.svg'

export type MascotPose = 'logo' | 'coin' | 'celebrate' | 'shrug' | 'ledger' | 'lost'

const POSE_SOURCES: Record<MascotPose, string> = {
  logo: logoUrl,
  coin: coinUrl,
  celebrate: celebrateUrl,
  shrug: shrugUrl,
  ledger: ledgerUrl,
  lost: lostUrl,
}

interface Props {
  /** Which raccoon pose to draw. The image is always decorative (aria-hidden); when a pose is the only visual identity in a region, the wrapping element must carry the accessible name. */
  pose: MascotPose

  /** Rendered size in CSS pixels (square). */
  size?: number
}

withDefaults(defineProps<Props>(), { size: 96 })
</script>

<template>
  <img
    class="raccoon-mascot"
    :src="POSE_SOURCES[pose]"
    :width="size"
    :height="size"
    alt=""
    aria-hidden="true"
  />
</template>

<style scoped lang="scss">
.raccoon-mascot {
  display: inline-block;
  object-fit: contain;
}
</style>
