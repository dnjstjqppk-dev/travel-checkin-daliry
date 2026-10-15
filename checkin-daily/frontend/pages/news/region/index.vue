<script setup lang="ts">
import RegionHubView from '~/components/RegionHubView.vue'

const route = useRoute()
</script>

<template>
  <RegionHubView
    :initial-country-code="route.query.country ? String(route.query.country).toUpperCase() : undefined"
    :initial-city-id="route.query.city ? String(route.query.city) : undefined"
  />
</template>
