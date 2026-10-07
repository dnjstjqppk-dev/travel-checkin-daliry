<script setup lang="ts">
import type { AdPlacement } from '~/stores/articles'

const props = defineProps<{ placementId: string }>()
const store = useArticlesStore()
const placement = ref<AdPlacement | undefined>()
const requestError = ref('')

await useAsyncData(`ad-placement-${props.placementId}`, async () => {
  try {
    const placements = await store.loadAdPlacements()
    placement.value = placements.find((item) => item.id === props.placementId)
    return placements
  } catch {
    requestError.value = '광고 설정을 불러오지 못했습니다.'
    return []
  }
})

const isConfigured = computed(() => Boolean(
  placement.value?.isActive
  && /^ca-pub-\d+$/.test(placement.value.adClientId)
  && /^\d+$/.test(placement.value.adSlotId),
))

onMounted(() => {
  if (!isConfigured.value) return
  const slot = placement.value!
  const scriptURL = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(slot.adClientId)}`
  if (!document.querySelector(`script[src="${scriptURL}"]`)) {
    const script = document.createElement('script')
    script.async = true
    script.crossOrigin = 'anonymous'
    script.src = scriptURL
    document.head.appendChild(script)
  }
  const adsWindow = window as Window & { adsbygoogle?: unknown[] }
  adsWindow.adsbygoogle = adsWindow.adsbygoogle || []
  adsWindow.adsbygoogle.push({})
})
</script>

<template>
  <div v-if="isConfigured" class="ad-slot" :class="`ad-slot-${placement?.format}`" :aria-label="placement?.name">
    <ins
      class="adsbygoogle"
      style="display:block"
      :data-ad-client="placement?.adClientId"
      :data-ad-slot="placement?.adSlotId"
      :data-ad-format="placement?.format || 'auto'"
      data-full-width-responsive="true"
    />
  </div>
  <div v-else-if="requestError" class="ad-slot ad-slot-placeholder" aria-label="광고">
    <span>{{ requestError }}</span>
  </div>
</template>
