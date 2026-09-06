# 공통 규약 (Shared Conventions)

여러 Skill이 공유하는 정의를 한곳에 모은다.
Planner / Architect / Developer / Tester Skill은 아래 항목을 재정의하지 않고 이 문서를 참조한다.
특히 Architect는 「위협 열거 (STRIDE / OWASP)」를 보안 설계에,
Tester는 코드 리뷰(SOLID / 계층 / Naming / Severity)와 보안 점검(STRIDE / OWASP)에 사용한다.

이 디렉터리에는 `SKILL.md`가 없으므로 독립 Skill로 등록되지 않는다.
참조가 필요한 Agent는 이 파일을 직접 읽는다.

---

## SOLID 원칙

소프트웨어 설계 5원칙. 구현·설계·검수에서 공통 기준으로 사용한다.

- **SRP (Single Responsibility)** — 하나의 클래스/모듈은 하나의 명확한 책임을 가진다.
  서로 다른 변경 이유를 한 곳에 모으지 않는다.
- **OCP (Open-Closed)** — 기존 핵심 코드를 반복 수정하지 않고 확장으로 새 동작을 추가할 수 있어야 한다.
- **LSP (Liskov Substitution)** — 상위 타입 자리에 하위 타입을 넣어도 기존 동작 계약이 깨지지 않아야 한다.
- **ISP (Interface Segregation)** — 사용하지 않는 기능에 의존을 강제하는 비대한 Interface를 만들지 않는다.
- **DIP (Dependency Inversion)** — 상위 로직이 구체 구현에 직접 의존하지 않고 추상화에 의존하며,
  구체 구현은 외부에서 주입한다.

원칙 위반 여부는 형식이 아니라 실제 유지보수성·변경 영향과 함께 판단한다.

---

## 계층 아키텍처 규칙 (MVC를 대표 사례로)

승인된 설계가 계층 구조를 정의한 경우 각 계층의 책임을 분리한다.
MVC는 그 대표 사례이며, 설계가 다른 계층 구조를 쓰면 그 구조의 책임 경계를 따른다.

- **Controller** — 요청 수신, 입력 전달, Service 호출, 응답 반환에 집중한다.
  핵심 비즈니스 로직을 직접 구현하지 않는다.
- **Service** — 비즈니스 로직과 주요 처리 흐름, 필요한 Model/Repository 조합을 담당한다.
  UI/HTTP 책임을 포함하지 않는다.
- **Model** — 데이터 구조와 도메인 상태를 표현한다. 다른 계층의 책임을 흡수하지 않는다.

한 계층에 책임이 과도하게 집중되지 않도록 한다.
프로젝트 구조에 따라 Repository, Adapter 등 구성요소를 추가할 수 있다.

---

## Interface First

교체 가능성, 테스트 용이성, 의존성 분리가 필요한 영역에서는
구현체보다 Interface(역할과 계약)를 먼저 정의하고 구현체가 그 계약을 따르게 한다.
모든 클래스에 Interface가 필요하다고 보지 않으며, 의미 없는 추상화를 만들지 않는다.

---

## Naming Convention

식별자 이름은 기본적으로 camelCase를 사용한다.
클래스·Interface 등 해당 언어에서 PascalCase가 표준인 요소는 그 언어 관례를 따른다.

이름 기준:

- 의미가 명확하고 직관적인가
- 역할과 책임이 이름에서 드러나는가
- 불필요한 축약어가 없는가
- 지나치게 짧거나 포괄적(모호)이지 않은가

| Bad | Good |
|-----|------|
| `data`, `obj`, `tmp`, `proc` | 구체적 대상명 (`userProfile`, `paymentRequest`) |
| `usrSvc` | `userService` |
| `getData` | `getUserProfile` |
| `proc` | `processPayment` |

---

## Severity 4단계

Issue 심각도 공통 분류. 도메인별로 필요하면 세부 예시를 확장할 수 있다.

- **Critical** — 심각한 보안 문제, 데이터 손실, 시스템 전체 장애, 핵심 요구사항 완전 위반
- **High** — 주요 기능 오동작, 요구사항 누락, 중요한 설계 위반, 높은 회귀 가능성
- **Medium** — 구조적 문제, SOLID 위반, 유지보수성 저하, 중요한 테스트 누락, 예외 흐름 누락
- **Low** — Naming, 가독성, 경미한 중복, 코드/문서 스타일

판정 규칙: Critical 또는 High가 하나라도 있으면 FAIL로 판단한다.
Medium/Low만 있으면 프로젝트 품질 기준과 영향도를 함께 고려한다.

---

## Failure 원인 분류

테스트 실패 또는 구현 차단의 원인을 다음 중 하나로 분류한다.
근거가 부족하면 원인을 확정하지 않는다.

- **IMPLEMENTATION_ERROR** — 구현이 요구사항/설계와 다르게 동작 → Developer 재작업
- **REQUIREMENT_MISMATCH** — 요구사항 자체가 불완전/충돌 → 기획 검토 필요
- **DESIGN_CONFLICT** — 설계 간 충돌 또는 설계와 요구사항 불일치 → 설계 검토 필요
- **TEST_ERROR** — 테스트 코드/기대값이 잘못됨
- **ENVIRONMENT_ERROR** — 실행 환경, 외부 의존성 등으로 검증 자체가 불가

---

## 위협 열거 (STRIDE / OWASP)

위협 분석 시 참고하는 표준 목록. 기계적으로 전부 적용하지 않고
현재 시스템과 관련된 위협을 중심으로 검토한다.

**STRIDE** — Spoofing(위장), Tampering(무단 변경), Repudiation(행위 추적 불가),
Information Disclosure(민감정보 노출), Denial of Service(서비스 방해),
Elevation of Privilege(권한 상승).

**OWASP 지향 위험 유형** — Broken Access Control, Cryptographic Failures, Injection,
Insecure Design, Security Misconfiguration, Vulnerable Components,
Authentication Failures, Data Integrity Failures, Logging/Monitoring Failures, SSRF.
