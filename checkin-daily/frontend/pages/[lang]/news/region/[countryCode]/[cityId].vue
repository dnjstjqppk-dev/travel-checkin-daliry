<script setup lang="ts">
import RegionHubView from '~/components/RegionHubView.vue'

const route = useRoute()
const lang = String(route.params.lang)
if (!['en', 'zh', 'th', 'vi', 'es'].includes(lang)) {
  throw createError({ statusCode: 404, statusMessage: 'Language not supported' })
}
</script>

<template>
  <RegionHubView
    :initial-country-code="String(route.params.countryCode).toUpperCase()"
    :initial-city-id="String(route.params.cityId)"
  />
</template>

