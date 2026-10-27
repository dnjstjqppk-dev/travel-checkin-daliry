<script setup lang="ts">
const route = useRoute()
const lang = String(route.params.lang)
if (!['en', 'zh', 'th', 'vi', 'es'].includes(lang)) {
  throw createError({ statusCode: 404, statusMessage: 'Language not supported' })
}
await navigateTo(`/${lang}/news`, { redirectCode: 301, replace: true })
</script>

<template>
  <div />
</template>

