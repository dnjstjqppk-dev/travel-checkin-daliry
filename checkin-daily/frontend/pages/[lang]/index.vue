<script setup lang="ts">
import { isPrefixedLocale } from '~/config/locales'
const route = useRoute()
const lang = String(route.params.lang)
if (!isPrefixedLocale(lang)) {
  throw createError({ statusCode: 404, statusMessage: 'Language not supported' })
}
await navigateTo(`/${lang}/news`, { redirectCode: 301, replace: true })
</script>

<template>
  <div />
</template>

