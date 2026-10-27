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

<style scoped>
.ad-slot {
  margin: 28px auto;
  max-width: 100%;
  text-align: center;
  min-height: 280px;
  background: rgba(248, 250, 252, 0.6);
  border: 1px dashed #CBD5E1;
  border-radius: 4px;
  padding: 12px;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.ad-slot-horizontal {
  min-height: 100px;
}
.ad-slot-rectangle {
  min-height: 280px;
}
.ad-slot-label {
  font-size: 10px;
  color: #94A3B8;
  letter-spacing: 0.1em;
  font-family: 'DM Mono', monospace;
  text-transform: uppercase;
  margin-bottom: 8px;
  display: block;
}
</style>
