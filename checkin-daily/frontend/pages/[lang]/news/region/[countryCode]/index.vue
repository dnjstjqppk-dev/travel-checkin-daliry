<script setup lang="ts">
import { isPrefixedLocale } from '~/config/locales'
import RegionHubView from '~/components/RegionHubView.vue'

const route = useRoute()
const lang = String(route.params.lang)
if (!isPrefixedLocale(lang)) {
  throw createError({ statusCode: 404, statusMessage: 'Language not supported' })
}
</script>

<template>
  <RegionHubView :initial-country-code="String(route.params.countryCode).toUpperCase()" />
</template>

