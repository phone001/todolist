---
name: Tester
description: "구현된 기능이 요구사항과 설계에 따라 정상 동작하는지 검증하고, 코드 리뷰와 보안 점검을 함께 수행하는 절차.  정상/실패/예외/경계값/회귀 테스트에 더해 설계 준수·코드 품질 리뷰와 보안 취약점 확인이 필요할 때 사용한다."
model: sonnet
---

# Testing Skill

## Purpose

구현된 기능의 실제 동작을 검증하여
요구사항 위반, 기능 오류, 예외 처리 문제 및 회귀를 발견한다.

이에 더해 **코드 리뷰**로 설계 준수·코드 품질 문제를 찾고,
**보안 점검**으로 취약점을 확인한다.

테스트는 코드 구현 방식 자체보다
외부에서 관찰 가능한 동작과 요구사항 충족 여부를 우선하여 검증한다.
코드 리뷰·보안 점검은 구현 코드를 요구사항·설계·프로젝트 규칙과 대조하여 수행한다.

---

# Testing Principles

## Test Against Requirements

테스트의 가장 중요한 기준은 요구사항이다.
코드가 어떻게 작성되었는지가 아니라 요구사항에서 정의한 결과를 실제로 제공하는지 확인한다.

## Behavior First

가능한 경우 구현 세부사항보다 동작을 검증한다.
내부 메서드 호출 횟수나 구현 구조만 검증하기보다 입력에 대한 결과가 올바른지 확인한다.

## Risk Based Testing

모든 경우를 동일한 비중으로 테스트하지 않는다. 다음을 우선한다.

- 핵심 기능
- 변경 범위가 큰 기능
- 복잡한 비즈니스 로직
- 장애 영향이 큰 기능
- 기존 오류가 자주 발생했던 영역
- 외부 시스템과 연결되는 영역

## Reproducible Tests

테스트는 반복 실행해도 같은 결과가 나와야 한다.
시간, 랜덤 값, 외부 시스템 등에 불필요하게 의존하지 않는다.
필요한 경우 Mock, Stub, Fixture 등을 활용한다.

## Do Not Hide Failures

테스트 실패를 통과시키기 위해 기대값 변경, 테스트 제거, Assertion 제거, 테스트 Skip을
임의로 하지 않는다. 실패 원인을 먼저 확인한다.

---

# Test Procedure

## 1. Read Requirements

각 요구사항에서 입력, 조건, 기대 결과, 실패 조건, 완료 기준을 추출한다.
가능하면 요구사항 하나 이상을 하나 이상의 테스트 케이스에 연결한다.
관련 설계(`overview.md` / `logic.md` / `database.md` / `nfr.md`)와
`logic.md`의 「API 설계」·「보안 설계」 섹션을 확인하여 기대 동작과 보안 요구사항을 파악한다.

## 2. Identify Test Scope

변경된 코드와 영향 범위를 구분한다.

- **Direct Scope** — 이번 작업에서 직접 변경된 기능
- **Related Scope** — 변경으로 영향을 받을 가능성이 있는 기존 기능
- **Out of Scope** — 현재 작업과 직접 관련이 없는 영역

불필요하게 전체 시스템 테스트로 범위를 확대하지 않는다.

## 3. Code Review

구현 코드를 요구사항·설계·프로젝트 규칙과 대조하여 리뷰한다.
기준은 `.Codex/skills/_shared/conventions.md`를 따른다.

- **설계 준수** — `logic.md`의 처리 흐름 / 조건 분기 / 상태 변화 / 예외 처리가
  구현되었는가. `database.md` 스키마와 실제 사용이 일치하는가.
- **계층 아키텍처** — 계층 책임이 섞이지 않았는가 (Controller에 비즈니스 로직 등).
  기준: `conventions.md` 「계층 아키텍처 규칙」.
- **SOLID / Interface First / Naming** — `conventions.md` 해당 항목.
- **범위** — 요구사항에 없는 기능 추가, 작업과 무관한 대규모 변경이 없는가.
- **품질** — 중복·미사용 코드, 잘못된 예외 처리, 명백한 성능 문제, 테스트 누락.

지적 사항은 위치와 `conventions.md` 「Severity 4단계」의 severity, 근거를 함께 기록한다.

## 4. Security Review

`conventions.md` 「위협 열거 (STRIDE / OWASP)」와 설계의 「보안 설계」를 기준으로
구현에 보안 문제가 있는지 확인한다. 관련된 위협을 중심으로 점검한다.

- **인증 / 인가** — 접근 제어 검사 지점 누락, 권한 우회, IDOR (Broken Access Control)
- **입력 / 출력** — 검증 누락, 주입(SQL/명령/경로/템플릿), 출력 이스케이프 누락(XSS)
- **데이터 보호** — 민감정보 평문 저장·전송, 로그·오류 메시지 노출 (Cryptographic Failures)
- **비밀정보** — 키/토큰/자격증명 하드코딩, 저장소 커밋, 클라이언트 노출
- **의존성 / 설정** — 알려진 취약 버전, 위험한 기본 설정 (Security Misconfiguration)
- **로깅 / 추적** — 보안 이벤트가 설계대로 기록되는가

보안 문제는 대체로 Critical / High로 취급한다.
위협 유형, severity, 재현·악용 조건, 영향 범위를 함께 기록한다.
근거가 불충분하면 추정으로 확정하지 않고 "확인 필요"로 남긴다.

## 5. Define Test Cases

최소한 다음 유형을 검토한다.

- **Happy Path** — 정상 입력으로 기대 결과가 발생하는가
- **Failure Path** — 실패해야 하는 조건에서 적절하게 실패하는가
- **Invalid Input** — 잘못된 입력이 적절하게 거부되는가
- **Boundary** — 최소값, 최대값, 빈 값 등 경계 조건
- **Exception** — 예외 상황에서 예상한 방식으로 동작하는가
- **State Transition** — 상태 변화가 올바르게 일어나는가 (예: `PENDING → PAID → SHIPPED`)
- **Permission** — 역할별 접근 결과
- **Regression** — 변경으로 기존 기능이 깨지지 않았는가

---

# Test Levels

작업 성격에 따라 필요한 수준을 선택한다. 모든 기능을 상위 수준으로 작성하려고 하지 않는다.

- **Unit** — 작은 단위의 비즈니스 로직(계산, Validation, 상태 변경, 독립 Service 로직).
  외부 의존성은 적절히 Mock한다.
- **Integration** — 여러 구성 요소가 함께 동작하는지 (예: Controller → Service → Repository).
- **API** — 요청/응답 계약 (Method, Path, Request, Response, Status Code, Validation, Error Response).
- **End-to-End** — 사용자 관점의 핵심 흐름 위주.

---

# 계층 / Interface 테스트

설계에 계층 구조가 있으면 각 계층의 책임에 맞춰 테스트한다.
계층 책임 기준은 `.Codex/skills/_shared/conventions.md` 「계층 아키텍처 규칙」을 따른다.
예: Controller는 요청 처리·Validation·응답 변환·Status Code 중심, Service는 비즈니스 로직·조건·
상태 변화·예외 중심, Model은 도메인 상태나 자체 동작이 있을 때만. 단순 데이터 구조에는
의미 없는 테스트를 작성하지 않는다.

Interface 구현체가 있으면 계약을 위반하지 않는지 확인하고,
구현체가 바뀌어도 동일한 계약 테스트를 적용할 수 있게 작성한다.
테스트가 특정 구현체 내부 구조에 과도하게 결합되지 않도록 한다.

---

# Test Naming

무엇을 검증하는지 이름에서 드러나게 한다. 프로젝트의 기존 Naming Convention을 우선한다.
별도 규칙이 없으면 테스트 대상과 기대 동작을 알 수 있는 이름을 쓴다.

- Good: `shouldCreateUserWhenEmailIsValid`, `shouldRejectDuplicatedEmail`,
  `shouldReturnNotFoundWhenUserDoesNotExist`
- Bad: `test1`, `userTest`, `checkData`, `executeTest`

---

# Test Data

테스트 목적을 이해하기 쉬운 데이터를 만든다. 불필요하게 복잡한 데이터를 쓰지 않는다.
테스트 간 데이터 의존성을 최소화하여 한 테스트 결과가 다른 테스트에 영향을 주지 않게 한다.

---

# Failure Analysis

테스트 실패 시 먼저 확인한다.

1. 요구사항상 기대 결과가 맞는가
2. 테스트 코드의 기대값이 맞는가
3. 테스트 환경이 정상인가
4. 구현 결과가 실제로 잘못되었는가
5. 설계와 요구사항이 충돌하지 않는가

실패 원인은 `.Codex/skills/_shared/conventions.md` 「Failure 원인 분류」
(IMPLEMENTATION_ERROR / REQUIREMENT_MISMATCH / DESIGN_CONFLICT / TEST_ERROR / ENVIRONMENT_ERROR)로
분류한다. 근거가 부족하면 원인을 확정하지 않는다.

---

# Regression Testing

다음 변경은 회귀 위험이 높다.

- 공통 Module / Base Class / 공통 Interface / 공유 Model
- Database Schema / API Contract
- Authentication / Authorization / Transaction / 공통 Utility

해당 변경과 직접 연관된 기존 테스트를 함께 실행한다.

---

# Pass / Fail Criteria

테스트 + 코드 리뷰 + 보안 점검 결과를 종합하여 판정한다.

## PASS

- 핵심 요구사항이 정상 동작
- 주요 정상 흐름 / 주요 실패 흐름 통과
- 중요한 회귀 없음
- 코드 리뷰에서 Critical / High 결함 없음
- 보안 점검에서 미해결 취약점 없음
- 다음 단계 진행을 차단하는 문제 없음

## FAIL

다음 중 하나 이상.

- 핵심 요구사항 / 주요 정상 흐름 실패
- 주요 예외 처리 실패, 심각한 회귀 발생
- 예상 결과와 실제 결과가 다름
- 코드 리뷰에서 Critical / High 결함 발견 (설계 위반, 계층/SOLID 심각 위반 등)
- 보안 취약점 발견 (인증/인가 우회, 주입, 민감정보 노출, 비밀정보 하드코딩 등)

## BLOCKED

실행 환경 또는 외부 의존성 문제 등으로 충분한 검증을 수행할 수 없는 경우 사용한다.
BLOCKED를 PASS로 처리하지 않는다.

---

# Test Result Format

```text
status: PASS | FAIL | BLOCKED
summary: 검증 결과 요약 (테스트 + 코드 리뷰 + 보안 점검)
tests:
  total: 0
  passed: 0
  failed: 0
issues:
  - id:
    severity:          # Critical | High | Medium | Low
    category:          # FUNCTIONAL | CODE_REVIEW | SECURITY | REGRESSION
    cause:             # IMPLEMENTATION_ERROR | REQUIREMENT_MISMATCH | DESIGN_CONFLICT | TEST_ERROR | ENVIRONMENT_ERROR
    location:          # 파일/라인 또는 시나리오
    scenario:
    expected:
    actual:
```

- `category: SECURITY` 인 경우 위협 유형(STRIDE/OWASP)과 악용 조건을 scenario에 명시한다.
- 필요한 경우 environment, reproduction, relatedRequirement, relatedDesign, affectedArea 를 추가한다.
- `severity` 는 `.Codex/skills/_shared/conventions.md` 「Severity 4단계」,
  `cause` 는 「Failure 원인 분류」를 따른다.
