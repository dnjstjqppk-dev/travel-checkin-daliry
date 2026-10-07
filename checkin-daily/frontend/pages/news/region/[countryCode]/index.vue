<script setup lang="ts">
import NewsListing from '~/components/NewsListing.vue'

const route = useRoute()
</script>

<template><NewsListing :country-code="String(route.params.countryCode).toUpperCase()" /></template>
