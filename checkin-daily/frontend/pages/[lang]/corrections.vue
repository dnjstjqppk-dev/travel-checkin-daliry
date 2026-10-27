<script setup lang="ts">
const route = useRoute()
const lang = String(route.params.lang)
if (!['en', 'zh', 'th', 'vi', 'es'].includes(lang)) {
  throw createError({ statusCode: 404, statusMessage: 'Language not supported' })
}
</script>

<template>
  <CorrectionsView />
</template>

