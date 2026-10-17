# CHECK-IN DAILY — 뉴스 출처 및 수집 파이프라인 감사 보고서
**문서 ID:** `AUDIT-DOC-03`  
**감사 대상:** 공식 뉴스 출처 적법성, 피드 라이선스, 수집 스케줄, 중복 제거 알고리즘, SSRF 방어  
**발행일:** 2026년 10월 17일

---

## 1. 뉴스 수집 기본 원칙 및 적법성 기준
Check-in Daily는 무단 웹 크롤링이나 유료 월(Paywall) 우회를 엄격히 금지하며, 다음의 3대 합법적 채널만을 통해 원문을 수집합니다.
1. **공식 1차 기관 RSS / Atom 피드:** 정부 관광청, 국영 공항 공사, 국제 항공 협회 등 공식 배포 채널
2. **공식 보도자료 언론 배포실 (Press Room):** 언론 보도를 목적으로 공개 배포된 공식 보도자료
3. **공식 Open API:** 인증된 공공 데이터 및 파트너 와이어

---

## 2. 등록된 공식 출처 인벤토리 (Verified News Sources)

| 출처 ID | 공식 기관명 | 엔드포인트 URL | 수집 주기 | 허용 라이선스 |
|---|---|---|---|---|
| `tat_news` | Tourism Authority of Thailand (TAT) | `https://www.tatnews.org/feed/` | 30분 | Official Government PR / Fair Citation |
| `aot_press` | Airports of Thailand (AOT) | `https://www.mot.go.th/` | 15분 | Official State Enterprise PR |
| `pha_phuket` | Phuket Hotels Association | `https://www.phukethotelsassociation.com/` | 60분 | Industry Association Report |
| `srt_railway` | State Railway of Thailand (SRT) | `https://www.railway.co.th/` | 120분 | Official Transportation Release |
| `iata_pr` | International Air Transport Assoc. (IATA) | `https://www.iata.org/en/pressroom/pr/` | 60분 | Global Aviation Industry Stats |

---

## 3. 지능형 중복 제거 (Deduplication Engine)
동일한 뉴스가 시간차를 두고 재배포되거나 여러 URL로 인입되는 경우를 방지하기 위해 3단계 중복 필터링을 강제합니다.
1. **GUID / Canonical URL 대조:** 피드 제공자의 고유 식별자 일치 여부 확인
2. **SHA-256 복합 해시 검증:**
   ```ts
   const norm = `${title.toLowerCase().trim()}|${link.toLowerCase().trim()}`
   const hash = crypto.subtle.digest('SHA-256', new TextEncoder().encode(norm))
   ```
   `feed_ingestion_items` 테이블의 `content_hash` 인덱스를 조회하여 중복 인입 차단.
3. **후속 보도 업데이트 구분:** 본문 해시가 변경된 중요 업데이트의 경우 기존 기사의 개정 이력(`article_revisions`)으로 분기 처리.

---

## 4. 수집 보안 (SSRF 방어 체계)
관리자가 신규 출처를 등록하거나 크롤러가 엔드포인트를 호출할 때 사설망(Private IP), 로컬호스트(`127.0.0.1`, `localhost`), 내부 클라우드 메타데이터 IP(`169.254.169.254`)에 대한 요청을 사전에 검증 차단하는 SSRF 가드레일이 구현되어 있습니다.

---

## 5. 수집 이력 및 장애 추적
모든 수집 시도는 `ingestion_runs` 테이블에 고유 `run_id`와 함께 시작 시각, 완료 시각, 수집 건수, 중복 건수, 오류 메시지가 불변 기록으로 기록되며, `/admin/dashboard` 및 `/admin/sources`에서 실시간 모니터링됩니다.

