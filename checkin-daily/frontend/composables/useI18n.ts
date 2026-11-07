import { LOCALE_PREFIX_PATTERN, type LocaleCode } from '~/config/locales'
import { uiMessages } from '~/locales/ui-messages'

export type Locale = LocaleCode

export interface LanguageMeta {
  code: Locale
  name: string
  nativeName: string
  flag: string
  hreflang: string
}

export const SUPPORTED_LOCALES: LanguageMeta[] = [
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷', hreflang: 'ko' },
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸', hreflang: 'en' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵', hreflang: 'ja' },
  { code: 'zh', name: 'Chinese', nativeName: '简体中文', flag: '🇨🇳', hreflang: 'zh-Hans' },
  { code: 'th', name: 'Thai', nativeName: 'ภาษาไทย', flag: '🇹🇭', hreflang: 'th' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', flag: '🇻🇳', hreflang: 'vi' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', hreflang: 'es' },
]

const INTL_LOCALES: Record<Locale, string> = { ko: 'ko-KR', en: 'en-US', ja: 'ja-JP', zh: 'zh-CN', th: 'th-TH', vi: 'vi-VN', es: 'es-ES' }

const translations: Record<string, Record<Locale, string>> = {
  home: {
    ko: '홈',
    en: 'Home',
    ja: 'ホーム',
    zh: '首页',
    th: 'หน้าแรก',
    vi: 'Trang chủ',
    es: 'Inicio',
  },
  places: {
    ko: '여행지',
    en: 'Places',
    ja: '旅行先',
    zh: '目的地',
    th: 'สถานที่',
    vi: 'Điểm đến',
    es: 'Destinos',
  },
  all_news: {
    ko: '전체 뉴스',
    en: 'All News',
    ja: 'すべてのニュース',
    zh: '全部新闻',
    th: 'ข่าวทั้งหมด',
    vi: 'Tất cả tin tức',
    es: 'Todas las noticias',
  },
  major: {
    ko: '주요 뉴스',
    en: 'Major Stories',
    ja: '主要ニュース',
    zh: '重点要闻',
    th: 'ข่าวเด่น',
    vi: 'Tin tiêu điểm',
    es: 'Noticias principales',
  },
  airline: {
    ko: '항공 & 마일리지',
    en: 'Airlines & Miles',
    ja: '航空・マイル',
    zh: '航空与里程',
    th: 'สายการบินและไมล์',
    vi: 'Hàng không & Dặm bay',
    es: 'Aerolíneas y millas',
  },
  hotel: {
    ko: '호텔 & 스테이',
    en: 'Hotels & Stay',
    ja: 'ホテル・宿泊',
    zh: '酒店与住宿',
    th: 'โรงแรมและที่พัก',
    vi: 'Khách sạn & Nghỉ dưỡng',
    es: 'Hoteles y estancias',
  },
  destination: {
    ko: '여행지 탐색',
    en: 'Destinations',
    ja: '旅行先',
    zh: '目的地探索',
    th: 'จุดหมายปลายทาง',
    vi: 'Điểm đến du lịch',
    es: 'Destinos de viaje',
  },
  realtime: {
    ko: '실시간 랭킹',
    en: 'Top Stories',
    ja: '人気ランキング',
    zh: '实时榜单',
    th: 'ยอดนิยมแบบเรียลไทม์',
    vi: 'Bảng xếp hạng nóng',
    es: 'Historias destacadas',
  },
  region: {
    ko: '국가/도시별',
    en: 'By Region',
    ja: '地域別',
    zh: '按地区',
    th: 'ตามภูมิภาค',
    vi: 'Theo khu vực',
    es: 'Por región',
  },
  saved: {
    ko: '스크랩북',
    en: 'Scrapbook',
    ja: '保存した記事',
    zh: '收藏夹',
    th: 'ข่าวที่บันทึก',
    vi: 'Tin đã lưu',
    es: 'Guardados',
  },
  search: {
    ko: '검색',
    en: 'SEARCH',
    ja: '検索',
    zh: '搜索',
    th: 'ค้นหา',
    vi: 'TÌM KIẾM',
    es: 'BUSCAR',
  },
  search_placeholder: {
    ko: '항공사, 호텔, 여행지 검색...',
    en: 'Search news, airlines, hotels...',
    ja: 'ニュース・航空会社・ホテルを検索',
    zh: '搜索航空公司、酒店、目的地...',
    th: 'ค้นหาสายการบิน โรงแรม จุดหมายปลายทาง...',
    vi: 'Tìm kiếm hãng bay, khách sạn, điểm đến...',
    es: 'Buscar aerolíneas, hoteles, destinos...',
  },
  read_more: {
    ko: '자세히 보기 →',
    en: 'READ MORE →',
    ja: '続きを読む →',
    zh: '查看更多 →',
    th: 'อ่านเพิ่มเติม →',
    vi: 'ĐỌC TIẾP →',
    es: 'LEER MÁS →',
  },
  related_stories: {
    ko: '관련 기사',
    en: 'RELATED STORIES',
    ja: '関連記事',
    zh: '相关报道',
    th: 'ข่าวที่เกี่ยวข้อง',
    vi: 'TIN LIÊN QUAN',
    es: 'NOTICIAS RELACIONADAS',
  },
  top_stories: {
    ko: '실시간 인기 뉴스',
    en: 'TOP STORIES',
    ja: '注目ニュース',
    zh: '实时热门新闻',
    th: 'ข่าวเด่นยอดนิยม',
    vi: 'TIN ĐỌC NHIỀU',
    es: 'MÁS LEÍDAS',
  },
  views: {
    ko: '조회',
    en: 'views',
    ja: '閲覧',
    zh: '次阅读',
    th: 'ครั้ง',
    vi: 'lượt xem',
    es: 'vistas',
  },
  published: {
    ko: '발행일',
    en: 'PUBLISHED',
    ja: '公開',
    zh: '发布时间',
    th: 'เผยแพร่',
    vi: 'NGÀY ĐĂNG',
    es: 'PUBLICADO',
  },
  writer: {
    ko: '취재 기자',
    en: 'WRITER',
    ja: '記者',
    zh: '特派记者',
    th: 'ผู้สื่อข่าว',
    vi: 'TÁC GIẢ',
    es: 'REDACTOR',
  },
  copy_link: {
    ko: '링크 복사',
    en: 'COPY LINK',
    ja: 'リンクをコピー',
    zh: '复制链接',
    th: 'คัดลอกลิงก์',
    vi: 'SAO CHÉP',
    es: 'COPIAR ENLACE',
  },
  copied: {
    ko: '복사 완료!',
    en: 'COPIED!',
    ja: 'コピーしました',
    zh: '已复制!',
    th: 'คัดลอกแล้ว!',
    vi: 'ĐÃ SAO CHÉP!',
    es: '¡COPIADO!',
  },
  save: {
    ko: '스크랩',
    en: 'SAVE',
    ja: '保存',
    zh: '收藏',
    th: 'บันทึก',
    vi: 'LƯU',
    es: 'GUARDAR',
  },
  saved_btn: {
    ko: '저장됨',
    en: 'SAVED',
    ja: '保存済み',
    zh: '已收藏',
    th: 'บันทึกแล้ว',
    vi: 'ĐÃ LƯU',
    es: 'GUARDADO',
  },
  back: {
    ko: '뒤로',
    en: 'Back',
    ja: '戻る',
    zh: '返回',
    th: 'ย้อนกลับ',
    vi: 'Trở về',
    es: 'Atrás',
  },
  font_size: {
    ko: '글자크기',
    en: 'Text Size',
    ja: '文字サイズ',
    zh: '字体大小',
    th: 'ขนาดอักษร',
    vi: 'Cỡ chữ',
    es: 'Tamaño texto',
  },
  light_mode: {
    ko: '☀ 밝은 화면',
    en: '☀ LIGHT',
    ja: '☀ ライト',
    zh: '☀ 浅色模式',
    th: '☀ โหมดสว่าง',
    vi: '☀ Sáng',
    es: '☀ Claro',
  },
  dark_mode: {
    ko: '◐ 어두운 화면',
    en: '◐ DARK',
    ja: '◐ ダーク',
    zh: '◐ 深色模式',
    th: '◐ โหมดมืด',
    vi: '◐ Tối',
    es: '◐ Oscuro',
  },
  sections: {
    ko: '뉴스 섹션',
    en: 'SECTIONS',
    ja: 'セクション',
    zh: '新闻板块',
    th: 'หมวดหมู่ข่าว',
    vi: 'CHUYÊN MỤC',
    es: 'SECCIONES',
  },
  my_services: {
    ko: '서비스',
    en: 'MY SERVICES',
    ja: 'マイサービス',
    zh: '便捷服务',
    th: 'บริการ',
    vi: 'DỊCH VỤ',
    es: 'SERVICIOS',
  },
  admin_login: {
    ko: '편집국 관리자 로그인',
    en: 'EDITORIAL DESK',
    ja: '編集局',
    zh: '编辑部登录',
    th: 'เข้าสู่ระบบกองบรรณาธิการ',
    vi: 'TÒA SOẠN',
    es: 'REDACCIÓN',
  },
  exchange_rates: {
    ko: 'TRAVEL FX (실시간 환율)',
    en: 'TRAVEL FX (LIVE RATES)',
    ja: '旅行者向け為替レート',
    zh: '旅游汇率 (实时牌价)',
    th: 'อัตราแลกเปลี่ยน (เรียลไทม์)',
    vi: 'TỶ GIÁ DU LỊCH (TRỰC TIẾP)',
    es: 'TIPO DE CAMBIO (EN VIVO)',
  },
  footer_tagline: {
    ko: '체크인데일리는 글로벌 항공, 호텔, 여행지 트렌드를 심층 취재하고 데이터 기반으로 보도하는 독립 여행 저널리즘 미디어입니다.',
    en: 'Check-in Daily is an independent travel journalism media providing in-depth investigative reporting and data analysis on airlines, hotels, and global destinations.',
    ja: 'Check-in Dailyは、航空・ホテル・世界の旅行先を取材し、データに基づいて報じる独立系トラベルジャーナリズムメディアです。',
    zh: 'Check-in Daily 是一家致力于深度报道全球航空、酒店及旅游目的地趋势的独立数据驱动型旅游新闻媒体。',
    th: 'Check-in Daily เป็นสื่อข่าวการท่องเที่ยวอิสระที่รายงานข่าวเชิงลึกและบทวิเคราะห์ข้อมูลเกี่ยวกับสายการบิน โรงแรม และจุดหมายปลายทางระดับโลก',
    vi: 'Check-in Daily là kênh báo chí du lịch độc lập chuyên đưa tin chuyên sâu và phân tích dữ liệu về hàng không, khách sạn và các điểm đến toàn cầu.',
    es: 'Check-in Daily es un medio independiente de periodismo de viajes que ofrece reportajes de investigación y análisis de datos sobre aerolíneas, hoteles y destinos globales.',
  },
}

export function useI18n() {
  const route = useRoute()
  const router = useRouter()

  const locale = computed<Locale>(() => {
    const match = route.path.match(LOCALE_PREFIX_PATTERN)
    return (match ? match[1] : 'ko') as Locale
  })

  function t(key: string, params?: Record<string, string | number>): string {
    const item = translations[key] ?? uiMessages[key]
    const template = item ? (item[locale.value] || item.en || item.ko) : key
    if (!params) return template
    return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match))
  }

  const intlLocale = computed(() => INTL_LOCALES[locale.value])

  /** Locale-aware date (and optional time) in Korea Standard Time, the newsroom's publishing zone. */
  function formatDate(value: string | null | undefined, withTime = false): string {
    if (!value) return ''
    const date = new Date(value)
    if (!Number.isFinite(date.getTime())) return ''
    return new Intl.DateTimeFormat(intlLocale.value, {
      year: 'numeric', month: 'short', day: 'numeric',
      ...(withTime ? { hour: '2-digit', minute: '2-digit', hour12: false, timeZoneName: 'short' } : {}),
      timeZone: 'Asia/Seoul',
    }).format(date)
  }

  function formatNumber(value: number | null | undefined): string {
    return new Intl.NumberFormat(intlLocale.value).format(value || 0)
  }

  function categoryLabel(slug: string): string {
    return translations[slug] ? t(slug) : slug
  }

  /** City / country display name: Korean for ko, English elsewhere. */
  function placeName(place: { nameKo?: string; nameEn?: string } | null | undefined): string {
    if (!place) return ''
    return (locale.value === 'ko' ? place.nameKo : place.nameEn) || place.nameEn || place.nameKo || ''
  }

  function getLocalizedUrl(targetLocale: Locale, pathOverride?: string): string {
    const currentPath = pathOverride || route.path
    const cleanPath = currentPath.replace(LOCALE_PREFIX_PATTERN, '') || '/news'
    if (targetLocale === 'ko') {
      return cleanPath
    }
    return `/${targetLocale}${cleanPath.startsWith('/') ? '' : '/'}${cleanPath}`
  }

  async function switchLocale(targetLocale: Locale) {
    if (import.meta.client) {
      localStorage.setItem('checkin-locale', targetLocale)
    }
    const targetUrl = getLocalizedUrl(targetLocale)
    await router.push({ path: targetUrl, query: route.query })
  }

  function locUrl(path: string): string {
    return getLocalizedUrl(locale.value, path)
  }

  return {
    locale,
    t,
    locUrl,
    formatDate,
    formatNumber,
    categoryLabel,
    placeName,
    getLocalizedUrl,
    switchLocale,
    supportedLocales: SUPPORTED_LOCALES,
  }
}
