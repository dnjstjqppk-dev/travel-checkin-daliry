<script setup lang="ts">
import type { AdPlacement } from '~/stores/articles'

const props = defineProps<{ placementId: string }>()
const store = useArticlesStore()

// Shared asyncData key across all ad slots on the page - eliminates duplicate network calls & guarantees hydration parity
const { data: placements, error } = await useAsyncData<AdPlacement[]>(
  'site-ad-placements',
  async () => {
    try {
      return await store.loadAdPlacements()
    } catch {
      return []
    }
  },
  { default: () => [] }
)

const placement = computed<AdPlacement | undefined>(() => {
  const list = placements.value || []
  return list.find((item) => item.id === props.placementId)
})

const isConfigured = computed(() => Boolean(
  placement.value?.isActive
  && /^ca-pub-\d+$/.test(placement.value.adClientId || '')
  && /^\d+$/.test(placement.value.adSlotId || '')
))

onMounted(() => {
  if (!isConfigured.value || !import.meta.client) return
  const slot = placement.value
  if (!slot) return

  const scriptURL = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(slot.adClientId)}`
  if (!document.querySelector(`script[src="${scriptURL}"]`)) {
    const script = document.createElement('script')
    script.async = true
    script.crossOrigin = 'anonymous'
    script.src = scriptURL
    script.onerror = () => {
      // AdBlocker or network failure handled gracefully
    }
    document.head.appendChild(script)
  }

  try {
    const adsWindow = window as Window & { adsbygoogle?: unknown[] }
    adsWindow.adsbygoogle = adsWindow.adsbygoogle || []
    adsWindow.adsbygoogle.push({})
  } catch {
    // Suppress ad-blocker push errors
  }
})
</script>

<template>
  <aside
    v-if="isConfigured"
    class="ad-slot"
    :class="`ad-slot-${placement?.format || 'auto'}`"
    :aria-label="placement?.name || '광고'"
  >
    <span class="ad-slot-label">광고</span>
    <ins
      class="adsbygoogle"
      style="display:block"
      :data-ad-client="placement?.adClientId"
      :data-ad-slot="placement?.adSlotId"
      :data-ad-format="placement?.format || 'auto'"
      data-full-width-responsive="true"
    />
  </aside>
  <!-- Non-configured slots render nothing to avoid intrusive empty placeholder boxes -->
</template>
