<script setup lang="ts">
import { isPrefixedLocale } from '~/config/locales'
const route = useRoute()
const lang = String(route.params.lang)
if (!isPrefixedLocale(lang)) {
  throw createError({ statusCode: 404, statusMessage: 'Language not supported' })
}
</script>

<template>
  <AboutView />
</template>

