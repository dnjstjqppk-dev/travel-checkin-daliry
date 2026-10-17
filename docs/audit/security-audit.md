# CHECK-IN DAILY — 보안 및 거버넌스 감사 보고서
**문서 ID:** `AUDIT-DOC-11`  
**발행일:** 2026년 10월 17일  
**감사관:** Check-in Daily 보안 및 인프라 엔지니어링 팀

---

## 1. 인증 및 세션 보안 (Authentication & Session Security)
- **비밀번호 저장:** PBKDF2-SHA256 알고리즘(100,000회 반복 해싱, 솔트 적용)을 사용하여 데이터베이스 유출 시에도 원문 복호화가 불가능하도록 암호화되었습니다.
- **세션 쿠키:** `SameSite=Strict`, `HttpOnly`, `Secure` 플래그가 적용된 서명된 세션 토큰을 발급하며, TTL(기본 8시간) 만료 시 자동 파기됩니다.
- **브루트포스(무차별 대입) 방어:** 동일 IP 또는 계정에서 5회 연속 로그인 실패 시 `login_attempts` 테이블에 기록되며, 이후 15분간 로그인 시도가 원천 차단됩니다 (HTTP 429 Too Many Requests).

---

## 2. 서버 사이드 인젝션 및 웹 취약점 방어
- **SQL Injection 방어:** 모든 D1 데이터베이스 쿼리는 바인딩 파라미터(`?`)를 사용하는 준비된 구문(Prepared Statement)으로 작성되어 SQL 인젝션 공격이 원천적으로 불가능합니다.
- **SSRF (Server-Side Request Forgery) 방어:** 관리자가 입력한 뉴스 피드 엔드포인트 수집 시, `localhost`, `127.0.0.1`, 사설 IP 대역(`10.0.0.0/8`, `192.168.0.0/16`, `172.16.0.0/12`), 클라우드 메타데이터 IP(`169.254.169.254`)에 대한 모든 내부 요청을 사전에 검증 차단합니다.
- **XSS (Cross-Site Scripting) 방어:** 마크다운 렌더링 시 `DOMPurify` 위생화(Sanitization) 처리를 거치며, `nosniff`, `X-Frame-Options: DENY` 보안 헤더가 전역 강제됩니다.

---

## 3. 역할 기반 접근 제어 (RBAC) 및 최소 권한 원칙
- **Super Admin:** 시스템 인프라 및 DB 전체 권한
- **Editor-in-Chief:** 기사 최종 승인, 기사 정정 및 철회 승인
- **Editor:** 기사 초안 작성, 팩트체크 검토, 예약 발행
- **Reporter:** 기사 초안 작성 및 1차 출처 입력
- 모든 관리자 API(`/api/admin/*`)는 서버 사이드 세션 유효성을 필수로 검증하며 비인증 접근 시 HTTP 401을 반환합니다.

---

## 4. 불변 감사 로그 (Immutable Audit Logging)
기사 생성, 수정, 승인, 발행, 철회, 자동화 킬스위치 가동 등 관리자의 모든 핵심 활동은 `audit_logs` 테이블에 수행자 식별자, 행위 명칭, 대상 리소스, 변경 전후 JSON 스냅샷과 함께 영구 보존됩니다.

