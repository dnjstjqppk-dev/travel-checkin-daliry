<script setup lang="ts">
import RegionHubView from '~/components/RegionHubView.vue'

const route = useRoute()
</script>

<template>
  <RegionHubView
    :initial-country-code="String(route.params.countryCode).toUpperCase()"
    :initial-city-id="String(route.params.cityId)"
  />
</template>
