<script setup lang="ts">
import type { City, Country } from '~/stores/articles'

const props = defineProps<{
  category?: string
  countryCode?: string
  cityId?: string
}>()

const store = useArticlesStore()
const router = useRouter()
const countries = ref<Country[]>([])
const cities = ref<City[]>([])
const selectedCountry = ref(props.countryCode || '')
const selectedCity = ref(props.cityId || '')
const loadingCities = ref(false)
const error = ref('')

try {
  countries.value = await store.loadCountries()
} catch {
  error.value = '국가 목록을 불러오지 못했습니다.'
}

async function loadCities(code: string) {
  if (!code) {
    cities.value = []
    return
  }
  loadingCities.value = true
  error.value = ''
  try {
    cities.value = await store.loadCities(code)
  } catch {
    error.value = '도시 목록을 불러오지 못했습니다.'
    cities.value = []
  } finally {
    loadingCities.value = false
  }
}

watch(() => props.countryCode, async (code) => {
  selectedCountry.value = code || ''
  selectedCity.value = props.cityId || ''
  await loadCities(selectedCountry.value)
}, { immediate: true })

watch(() => props.cityId, (id) => {
  selectedCity.value = id || ''
})

async function onCountryChange() {
  selectedCity.value = ''
  await loadCities(selectedCountry.value)
  await navigateToSelection()
}

async function onCityChange() {
  await navigateToSelection()
}

async function navigateToSelection() {
  if (!selectedCountry.value) {
    await router.push(props.category ? `/news/${props.category}` : '/news')
    return
  }
  const path = props.category
    ? `/news/${props.category}/${selectedCountry.value}`
    : `/news/region/${selectedCountry.value}`
  await router.push(selectedCity.value ? `${path}/${selectedCity.value}` : path)
}
</script>

<template>
  <section class="region-filter">
    <p class="eyebrow">DESTINATION FILTER</p>
    <h3>국가에서 도시까지</h3>
    <label class="field">
      국가
      <select v-model="selectedCountry" @change="onCountryChange">
        <option value="">전체 국가</option>
        <option v-for="country in countries" :key="country.code" :value="country.code">
          {{ country.nameKo }} · {{ country.code }}
        </option>
      </select>
    </label>
    <label class="field">
      도시
      <select v-model="selectedCity" :disabled="!selectedCountry || loadingCities" @change="onCityChange">
        <option value="">{{ loadingCities ? '불러오는 중...' : '전체 도시' }}</option>
        <option v-for="city in cities" :key="city.id" :value="city.id">{{ city.nameKo }} · {{ city.nameEn }}</option>
      </select>
    </label>
    <p v-if="error" class="form-error">{{ error }}</p>
  </section>
</template>
