# CHECK-IN DAILY — 사실 검증 규정 및 팩트체크 프로토콜
**문서 ID:** `AUDIT-DOC-06`  
**발행일:** 2026년 10월 17일  
**적용 대상:** AI 기사 생성 엔진, 수집 파이프라인, 편집국 데스크

---

## 1. 팩트체크 기본 원칙 (Cardinal Rules)
1. **1차 공식 출처 원칙:** 모든 수치, 일정, 규정 변경 보도는 당사자(항공사, 호텔 체인, 공항 공사) 또는 정부 기관의 1차 공식 발표 자료만을 근거로 삼아야 합니다.
2. **환각(Hallucination) 배제:** 원문에 존재하지 않는 추측성 수치나 가상의 인용문을 사실처럼 기술하는 것을 엄격히 금지합니다.
3. **독자 검증 투명성:** 기사 본문 상단에 1차 출처 링크와 검증 배너를 상시 게재하여 독자가 직접 원문을 확인할 수 있도록 합니다.

---

## 2. 자동 발행 전면 금지 고위험 주제 (Strict Review-Gate)
다음 10대 고위험 주제가 감지된 기사는 알고리즘에 의한 자동 발행이 시스템적으로 100% 차단되며, 반드시 편집국장 또는 전담 에디터의 수동 검토를 거쳐야 합니다.
- 항공기 추락, 비상착륙 및 기체 결함 사고
- 공항 및 관광지 테러, 폭발물 의혹, 안보 위협
- 인명 사망, 중상 및 전염병 확산
- 전쟁, 군사 분쟁 및 영공 폐쇄
- 정부 비상사태 선포 및 대규모 여행자 긴급 대피령
- 비자(Visa) 및 국가별 출입국 거부 정책의 급작스러운 변경
- 대규모 운항 전면 중단(파업, 시스템 셧다운)
- 외교부 공식 여행 경보(철수 권고 등) 발령
- 여행 기업의 파산, 법적 분쟁 및 사기 의혹
- 특정 개인/기업에 대한 중대한 명예훼손성 논란

---

## 3. 구조화된 사실 검증 데이터 저장 스키마
각 기사는 `article_fact_checks` 테이블에 다음 형식으로 검증 기록을 보존합니다.
```sql
CREATE TABLE article_fact_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL REFERENCES articles(id),
  claim TEXT NOT NULL,                  -- 검증 대상 주장 (수치, 취항일 등)
  verification_status TEXT NOT NULL,    -- verified, unverified, disputed
  evidence_url TEXT NOT NULL,           -- 원문 증빙 URL
  checked_by TEXT NOT NULL,             -- 검증 주체 (AI Engine v2 / Editor Name)
  checked_at TEXT NOT NULL,
  notes TEXT NOT NULL
);
```

---

## 4. 기사 정정 및 독자 이의신청 처리 절차
독자가 `/corrections` 페이지를 통해 사실 오류 수정을 요청하면:
1. `article_corrections` 테이블에 즉시 기록됩니다.
2. 해당 기사의 상태가 `review_status = 'correction_required'`로 전환되어 편집국 관리자 대시보드에 긴급 알림이 표시됩니다.
3. 편집국 데스크가 24시간 이내에 증빙을 재대조하고, 승인 시 본문 수정과 함께 '⚠️ 기사 정정 고지' 배너가 공개 페이지에 영구 표시됩니다.
