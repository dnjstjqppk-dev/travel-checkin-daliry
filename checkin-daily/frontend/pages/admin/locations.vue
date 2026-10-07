<script setup lang="ts">
import type { City, Country } from '~/stores/articles'

const store = useArticlesStore()
const countries = ref(await store.loadCountries())
const selectedCode = ref(countries.value[0]?.code || '')
const cities = ref<City[]>([])
const countryForm = reactive<Country>({ code: '', nameKo: '', nameEn: '', continent: '', sortOrder: 0 })
const cityForm = reactive({ id: '', nameKo: '', nameEn: '' })
const editingCountryCode = ref('')
const editingCityId = ref('')
const saving = ref(false)
const error = ref('')

async function loadCities(code = selectedCode.value) {
  if (!code) {
    cities.value = []
    return
  }
  try {
    cities.value = await store.loadCities(code, true)
  } catch {
    error.value = '도시 목록을 불러오지 못했습니다.'
    cities.value = []
  }
}

watch(selectedCode, (code) => loadCities(code), { immediate: true })

function editCountry(country: Country) {
  editingCountryCode.value = country.code
  Object.assign(countryForm, country)
}

function resetCountryForm() {
  editingCountryCode.value = ''
  Object.assign(countryForm, { code: '', nameKo: '', nameEn: '', continent: '', sortOrder: 0 })
}

async function saveCountry() {
  saving.value = true
  error.value = ''
  try {
    const country = await store.saveCountry({ ...countryForm }, editingCountryCode.value || undefined)
    const existingIndex = countries.value.findIndex((item) => item.code === country.code)
    if (existingIndex < 0) countries.value.push(country)
    else countries.value[existingIndex] = country
    selectedCode.value = country.code
    resetCountryForm()
  } catch {
    error.value = '국가를 저장하지 못했습니다. 국가 코드는 고유한 ISO 2자리 코드여야 합니다.'
  } finally {
    saving.value = false
  }
}

async function removeCountry(code: string) {
  if (!window.confirm(`${code} 국가와 등록 도시를 삭제할까요? 기사에서 선택된 지역 태그도 함께 해제됩니다.`)) return
  error.value = ''
  try {
    await store.removeCountry(code)
    countries.value = countries.value.filter((country) => country.code !== code)
    if (selectedCode.value === code) selectedCode.value = countries.value[0]?.code || ''
  } catch {
    error.value = '국가를 삭제하지 못했습니다.'
  }
}

function editCity(city: City) {
  editingCityId.value = city.id
  Object.assign(cityForm, { id: city.id, nameKo: city.nameKo, nameEn: city.nameEn })
}

function resetCityForm() {
  editingCityId.value = ''
  Object.assign(cityForm, { id: '', nameKo: '', nameEn: '' })
}

async function saveCity() {
  if (!selectedCode.value) return
  saving.value = true
  error.value = ''
  try {
    await store.saveCity(selectedCode.value, { ...cityForm }, editingCityId.value || undefined)
    await loadCities()
    resetCityForm()
  } catch {
    error.value = '도시를 저장하지 못했습니다. 고유한 도시 ID와 도시명을 확인해 주세요.'
  } finally {
    saving.value = false
  }
}

async function removeCity(id: string) {
  if (!window.confirm(`${id} 도시를 삭제할까요? 기사에서 연결된 도시 태그도 해제됩니다.`)) return
  error.value = ''
  try {
    await store.removeCity(id)
    cities.value = cities.value.filter((city) => city.id !== id)
    if (editingCityId.value === id) resetCityForm()
  } catch {
    error.value = '도시를 삭제하지 못했습니다.'
  }
}
</script>

<template>
  <section class="admin-wrap">
    <div class="admin-top"><div><p class="eyebrow">EDITOR ROOM / DESTINATIONS</p><h1>국가 및 도시 관리</h1></div><NuxtLink class="button" to="/admin/dashboard">기사 목록</NuxtLink></div>
    <p v-if="error" class="form-error">{{ error }}</p>
    <div class="location-admin-grid">
      <section class="news-section-box">
        <div class="box-title"><h2>국가</h2></div>
        <form class="stacked-form" @submit.prevent="saveCountry">
          <label class="field">국가 코드<input v-model="countryForm.code" required maxlength="2" :disabled="Boolean(editingCountryCode)" placeholder="JP"></label>
          <label class="field">국가명 (한국어)<input v-model="countryForm.nameKo" required maxlength="100"></label>
          <label class="field">Country name<input v-model="countryForm.nameEn" required maxlength="100"></label>
          <label class="field">대륙<input v-model="countryForm.continent" maxlength="50"></label>
          <label class="field">정렬 순서<input v-model.number="countryForm.sortOrder" type="number"></label>
          <div class="form-actions"><button v-if="editingCountryCode" class="button" type="button" @click="resetCountryForm">취소</button><button class="button button-primary" :disabled="saving">{{ editingCountryCode ? '국가 수정' : '국가 추가' }}</button></div>
        </form>
        <ul class="location-admin-list">
          <li v-for="country in countries" :key="country.code" :class="{ selected: selectedCode === country.code }">
            <button class="location-select" type="button" @click="selectedCode = country.code"><strong>{{ country.nameKo }}</strong><small>{{ country.code }} · {{ country.nameEn }}</small></button>
            <span class="location-actions"><button class="button" type="button" @click="editCountry(country)">수정</button><button class="button button-danger" type="button" @click="removeCountry(country.code)">삭제</button></span>
          </li>
        </ul>
      </section>

      <section class="news-section-box">
        <div class="box-title"><h2>도시 <small>{{ selectedCode || '국가를 선택하세요' }}</small></h2></div>
        <form v-if="selectedCode" class="stacked-form" @submit.prevent="saveCity">
          <label class="field">도시 ID<input v-model="cityForm.id" required maxlength="50" :disabled="Boolean(editingCityId)" placeholder="tyo"></label>
          <label class="field">도시명 (한국어)<input v-model="cityForm.nameKo" required maxlength="100"></label>
          <label class="field">City name<input v-model="cityForm.nameEn" required maxlength="100"></label>
          <div class="form-actions"><button v-if="editingCityId" class="button" type="button" @click="resetCityForm">취소</button><button class="button button-primary" :disabled="saving">{{ editingCityId ? '도시 수정' : '도시 추가' }}</button></div>
        </form>
        <p v-else class="empty-state">도시를 등록할 국가를 추가하거나 선택하세요.</p>
        <ul class="location-admin-list city-admin-list">
          <li v-for="city in cities" :key="city.id">
            <span class="location-select"><strong>{{ city.nameKo }}</strong><small>{{ city.id }} · {{ city.nameEn }}</small></span>
            <span class="location-actions"><button class="button" type="button" @click="editCity(city)">수정</button><button class="button button-danger" type="button" @click="removeCity(city.id)">삭제</button></span>
          </li>
        </ul>
      </section>
    </div>
  </section>
</template>
