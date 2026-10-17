<script setup lang="ts">
definePageMeta({ layout: 'admin' })

const mediaStandards = [
  {
    type: 'Unsplash Editorial License',
    allowed: '허용 (보도 참고용)',
    rule: '반드시 이미지 하단에 [자료 사진: Unsplash 에디토리얼 라이선스 / 기사 보도 참고용] 캡션을 명시해야 합니다.',
    status: 'VERIFIED',
  },
  {
    type: '공식 보도자료 배포 사진 (TAT, AOT, 항공사)',
    allowed: '허용 (출처 명시)',
    rule: '보도자료에 첨부된 공식 홍보 이미지는 배포 주체(예: 태국관광청 제공)를 필수 표기합니다.',
    status: 'VERIFIED',
  },
  {
    type: '타 언론사 취재 사진 무단 전재',
    allowed: '절대 불가 (금지)',
    rule: '타사 워터마크가 있는 사진, 인스타그램/블로그 무단 캡처 사진은 저작권 침해로 자동 발행이 차단됩니다.',
    status: 'STRICTLY_BLOCKED',
  },
]
</script>

<template>
  <section class="admin-wrap">
    <div class="admin-page-heading">
      <div>
        <p class="admin-overline">COPYRIGHT & ASSET MANAGEMENT / MEDIA</p>
        <h1>미디어 저작권 및 이미지 이용 권한 관리</h1>
        <p class="admin-heading-copy">상업적 보도 라이선스가 확인된 안전한 미디어 자산만을 사용하며 저작권 분쟁을 사전 차단합니다.</p>
      </div>
    </div>

    <div class="media-standards-panel">
      <h2>뉴스룸 이미지 사용 허가 표준 (Image Licensing Standards)</h2>
      <table class="admin-table">
        <thead>
          <tr>
            <th>미디어 자산 유형</th>
            <th>보도 사용 가능 여부</th>
            <th>필수 표기 및 준수 규칙</th>
            <th>가드레일 상태</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in mediaStandards" :key="item.type">
            <td><strong>{{ item.type }}</strong></td>
            <td>{{ item.allowed }}</td>
            <td><small>{{ item.rule }}</small></td>
            <td>
              <span class="badge" :class="item.status === 'VERIFIED' ? 'badge-success' : 'badge-danger'">
                {{ item.status }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="media-guidelines-box">
      <h3>💡 편집국 이미지 가이드라인</h3>
      <ul>
        <li>모든 기사의 대표 이미지(`cover_image`)는 유효한 HTTPS 프로토콜의 고해상도 URL이어야 합니다.</li>
        <li>이미지가 없는 경우 플랫폼의 기본 Fallback 뉴스룸 일러스트레이션이 자동으로 적용됩니다.</li>
        <li>이미지 파일의 ALT 속성(대체 텍스트)에는 기사 헤드라인이 자동 주입되어 시각 장애인 접근성 및 Google 이미지 검색 SEO를 최적화합니다.</li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.media-standards-panel {
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  border-radius: 6px;
  padding: 24px;
  margin-bottom: 24px;
}
.media-standards-panel h2 {
  font-size: 16px;
  font-weight: 800;
  color: #111827;
  margin: 0 0 16px;
}
.media-guidelines-box {
  background: #F9FAFB;
  border: 1px solid #E5E7EB;
  border-radius: 6px;
  padding: 20px 24px;
}
.media-guidelines-box h3 {
  font-size: 15px;
  font-weight: 800;
  margin: 0 0 10px;
  color: #111827;
}
.media-guidelines-box ul {
  margin: 0;
  padding-left: 20px;
  font-size: 13px;
  color: #4B5563;
  line-height: 1.8;
}
.badge {
  font-size: 10px;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'DM Mono', monospace;
}
.badge-success { background: #DCFCE7; color: #16A34A; }
.badge-danger { background: #FEE2E2; color: #DC2626; }
</style>

