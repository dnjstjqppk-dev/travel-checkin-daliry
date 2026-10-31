<script setup lang="ts">
definePageMeta({ layout: 'admin' })

interface ArticleTranslationStatus {
  id: number
  title: string
  category: string
  status: string
  published_at: string | null
  translated_langs: string | null
}

const { data, refresh } = await useFetch<{ articles: ArticleTranslationStatus[] }>('/api/admin/translations')

const languages = [
  { code: 'ko', label: '한국어 (원문)' },
  { code: 'en', label: 'English' },
  { code: 'zh', label: '中文 (简体)' },
  { code: 'th', label: 'ไทย' },
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'es', label: 'Español' },
]

function hasLang(langsStr: string | null, code: string) {
  if (code === 'ko') return true
  if (!langsStr) return false
  return langsStr.split(',').map((s) => s.trim()).includes(code)
}
</script>

<template>
  <section class="admin-wrap">
    <div class="admin-page-heading">
      <div>
        <p class="admin-overline">GLOBAL REACH / MULTILINGUAL COVERAGE</p>
        <h1>글로벌 6개 국어 다국어 번역 현황</h1>
        <p class="admin-heading-copy">한국어 원문 기사에 대한 글로벌 5개 언어 번역 탑재 여부 및 커버리지를 전수 점검합니다.</p>
      </div>
      <button type="button" class="button" @click="() => refresh()">새로고침 ↻</button>
    </div>

    <div class="admin-content-panel">
      <div class="admin-table-scroll">
        <table class="admin-table">
          <thead>
            <tr>
              <th>기사 ID</th>
              <th>한국어 원문 제목</th>
              <th>카테고리</th>
              <th v-for="lang in languages" :key="lang.code">{{ lang.label }}</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="article in data?.articles || []" :key="article.id">
              <td class="text-mono">#{{ article.id }}</td>
              <td class="title-cell">
                <NuxtLink :to="`/admin/articles/${article.id}`" class="table-link">
                  {{ article.title }}
                </NuxtLink>
              </td>
              <td><span class="tag-cat">{{ article.category }}</span></td>
              <td v-for="lang in languages" :key="lang.code" class="text-center">
                <span class="lang-check" :class="{ ok: hasLang(article.translated_langs, lang.code) }">
                  {{ hasLang(article.translated_langs, lang.code) ? '✓' : '—' }}
                </span>
              </td>
              <td>
                <NuxtLink :to="`/admin/articles/${article.id}`" class="btn-sub-edit">편집</NuxtLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>

<style scoped>
.text-mono {
  font-family: 'DM Mono', monospace;
  font-size: 11px;
}
.title-cell {
  max-width: 300px;
}
.table-link {
  font-weight: 700;
  color: var(--admin-heading);
  text-decoration: none;
}
.table-link:hover {
  color: var(--accent);
  text-decoration: underline;
}
.tag-cat {
  font-size: 11px;
  background: var(--admin-surface);
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'DM Mono', monospace;
}
.text-center {
  text-align: center;
}
.lang-check {
  display: inline-block;
  font-size: 12px;
  font-weight: 800;
  color: #D1D5DB;
  font-family: 'DM Mono', monospace;
}
.lang-check.ok {
  color: #10b981;
  background: rgba(16, 185, 129, 0.15);
  width: 20px;
  height: 20px;
  line-height: 20px;
  border-radius: 50%;
}
.btn-sub-edit {
  font-size: 11px;
  font-weight: 700;
  color: var(--accent);
  text-decoration: none;
  padding: 3px 6px;
  border: 1px solid var(--admin-border);
  border-radius: 3px;
}
</style>

