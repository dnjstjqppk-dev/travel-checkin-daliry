<script setup lang="ts">
import { isPrefixedLocale } from '~/config/locales'
import NewsListing from '~/components/NewsListing.vue'
import RegionHubView from '~/components/RegionHubView.vue'

const route = useRoute()
const lang = String(route.params.lang)
if (!isPrefixedLocale(lang)) {
  throw createError({ statusCode: 404, statusMessage: 'Language not supported' })
}
const category = computed(() => String(route.params.category))
</script>

<template>
  <RegionHubView
    v-if="category === 'region'"
    :initial-country-code="route.query.country ? String(route.query.country).toUpperCase() : undefined"
    :initial-city-id="route.query.city ? String(route.query.city) : undefined"
  />
  <NewsListing v-else :category="category" />
</template>
