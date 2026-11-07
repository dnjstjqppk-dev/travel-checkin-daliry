<script setup lang="ts">
import { isPrefixedLocale } from '~/config/locales'
import NewsListing from '~/components/NewsListing.vue'

const route = useRoute()
const lang = String(route.params.lang)
if (!isPrefixedLocale(lang)) {
  throw createError({ statusCode: 404, statusMessage: 'Language not supported' })
}
</script>

<template>
  <NewsListing :category="String(route.params.category)" :country-code="String(route.params.countryCode).toUpperCase()" />
</template>

