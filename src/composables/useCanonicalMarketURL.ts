import { watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { marketPath } from '@/utils/marketURL'

/**
 * Keeps a market page's address bar on its canonical `{id}-{slug}` form.
 *
 * Any URL whose `:marketId` begins with the market's numeric id is accepted (`42`,
 * `42-stale-title`, …); once the market loads, the URL is replaced with the live
 * `{id}-{slug}`, so renames and bare-id links self-correct. Uses `router.replace`
 * (not `push`) so the non-canonical URL never enters history — the SPA analogue
 * of a 301. Stays on the current route (detail or resolve) and preserves any
 * query/hash. No-ops when the URL is already canonical or the market is absent.
 *
 * @param market A getter for the loaded market (its id and title), or null while loading.
 */
export default function useCanonicalMarketURL(
  market: () => { id: number; title: string } | null,
): void {
  const route = useRoute()
  const router = useRouter()

  watch(
    market,
    (loaded) => {
      if (loaded === null) return
      const canonical = marketPath(loaded)
      if (route.params.marketId === canonical) return
      void router.replace({
        name: route.name,
        params: { ...route.params, marketId: canonical },
        query: route.query,
        hash: route.hash,
      })
    },
    { immediate: true },
  )
}
