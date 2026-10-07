<script setup lang="ts">
import NewsListing from '~/components/NewsListing.vue'

const route = useRoute()
</script>

<template><NewsListing :category="String(route.params.category)" :country-code="String(route.params.countryCode).toUpperCase()" :city-id="String(route.params.cityId)" /></template>
