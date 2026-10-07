<script setup lang="ts">
import type { City, Country } from '~/stores/articles'

const props = withDefaults(defineProps<{
  modelValue: string[]
  initialCountryCodes?: string[]
}>(), {
  initialCountryCodes: () => [],
})

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const store = useArticlesStore()
const countries = ref<Country[]>([])
const countryLoadError = ref('')
const selectedCountries = ref<string[]>([...props.initialCountryCodes])
const citiesByCountry = reactive<Record<string, City[]>>({})
const loadingCountries = reactive<Record<string, boolean>>({})
const loadErrors = reactive<Record<string, string>>({})

try {
  countries.value = await store.loadCountries()
} catch {
  countryLoadError.value = '국가 목록을 불러오지 못했습니다.'
}
for (const code of selectedCountries.value) {
  await loadCountryCities(code)
}

async function loadCountryCities(code: string) {
  if (citiesByCountry[code] || loadingCountries[code]) return
  loadingCountries[code] = true
  delete loadErrors[code]
  try {
    citiesByCountry[code] = await store.loadCities(code)
  } catch {
    loadErrors[code] = '도시 목록을 불러오지 못했습니다.'
  } finally {
    loadingCountries[code] = false
  }
}

async function toggleCountry(event: Event, code: string) {
  const checked = (event.target as HTMLInputElement).checked
  if (checked) {
    selectedCountries.value = [...selectedCountries.value, code]
    await loadCountryCities(code)
    return
  }
  selectedCountries.value = selectedCountries.value.filter((item) => item !== code)
  const remaining = new Set((citiesByCountry[code] || []).map((city) => city.id))
  emit('update:modelValue', props.modelValue.filter((id) => !remaining.has(id)))
}

function toggleCity(event: Event, cityId: string) {
  const checked = (event.target as HTMLInputElement).checked
  const next = new Set(props.modelValue)
  if (checked) next.add(cityId)
  else next.delete(cityId)
  emit('update:modelValue', [...next])
}
</script>

<template>
  <fieldset class="location-picker">
    <legend>관련 국가 및 도시</legend>
    <p class="picker-hint">국가를 펼쳐 도시를 여러 개 선택하세요. 기사에는 선택한 도시가 태그됩니다.</p>
    <p v-if="countryLoadError" class="form-error">{{ countryLoadError }}</p>
    <details v-for="country in countries" :key="country.code" class="country-picker" :open="selectedCountries.includes(country.code)">
      <summary>
        <label class="country-picker-label">
          <input
            type="checkbox"
            :checked="selectedCountries.includes(country.code)"
            @click.stop
            @change="toggleCountry($event, country.code)"
          >
          <span>{{ country.nameKo }} <small>{{ country.code }}</small></span>
        </label>
      </summary>
      <p v-if="loadingCountries[country.code]" class="picker-hint">도시 목록을 불러오는 중...</p>
      <p v-else-if="loadErrors[country.code]" class="form-error">{{ loadErrors[country.code] }}</p>
      <div v-else-if="citiesByCountry[country.code]?.length" class="city-check-list">
        <label v-for="city in citiesByCountry[country.code]" :key="city.id">
          <input
            type="checkbox"
            :checked="modelValue.includes(city.id)"
            @change="toggleCity($event, city.id)"
          >
          {{ city.nameKo }} <small>{{ city.nameEn }}</small>
        </label>
      </div>
      <p v-else class="picker-hint">등록된 도시가 없습니다.</p>
    </details>
  </fieldset>
</template>
