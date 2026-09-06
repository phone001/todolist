# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

# 하네스 적용 프로젝트

하네스 엔지니어링 기법을 사용하는 일정 관리 앱 프로젝트

프로젝트 기본 요구사항은 `알림앱.md`(일정관리 앱 "오늘뭐해", RN/TS, SQLite)를 참조한다.
설계 산출물은 `document/` 아래의 Markdown 문서(기획서, 설계서)이며, 저장소의 본체는
`.Codex/`에 정의된 멀티 에이전트 파이프라인 그 자체다. 여기서 "작업"이란 이 파이프라인을
따라 문서를 생성·검증·개정하고, 그 설계를 코드로 구현·검증하는 것을 뜻한다.

## 규칙

- 산출물 문서는 document 디렉터리에 저장한다.
- 에이전트는 `.Codex/agents/`에 정의한다.
- 스킬은 `.Codex/skills`에 정의한다.

## 작업 원칙

### orchestrator 우선 (필수)

- `작업요청:`으로 시작하는 모든 사용자 요청은 어떤 작업을 시작하기 전에 반드시 `Agent` 툴로 `orchestrator`를 먼저 호출한다.
- orchestrator 호출 전에는 어떤 도구도 사용하지 않는다. 파일 읽기·검색·디렉터리 목록 조회를 포함한 모든 도구 사용은 orchestrator 호출 이후에만 수행한다.
- 후속 작업은 orchestrator가 반환한 작업 유형 판단과 다음 실행 Agent 결정에만 따른다. 스스로 작업 유형을 분류해 바로 진행하지 않는다.
- 기획·설계·구현·검증(코드 리뷰·보안 점검 포함)을 직접 수행하지 않는다. 각 단계는 orchestrator가 지정한 담당 Agent에게 위임한다.
- 요청이 사소해 보이거나 이미 답을 안다고 판단되더라도 orchestrator를 건너뛰지 않는다.

---

# 빌드 / 린트 / 테스트

- **빌드**: `npm run build` (`tsc`). `package.json` / `tsconfig.json`이 있고,
  현재 소스는 `src/index.ts` 스캐폴드뿐이다.
- **린트**: 아직 없다.
- **테스트**: 실행 가능한 테스트 스위트와 러너가 아직 없다. Developer/Tester가
  구현을 진행하면서 프로젝트에 맞는 테스트 수단을 도입한다.
- Orchestrator 워크플로의 "Tester" 단계는 **기능 테스트 + 코드 리뷰 + 보안 점검**을
  함께 수행한다. 테스트 러너가 없으면 설계·규칙 기반 정적 검증으로 대체하고,
  코드 리뷰와 보안 점검은 실제 구현 코드를 대상으로 수행한다.
- Orchestrator는 Agent를 디스패치할 때마다 `log/agent-execute.log`에 한 줄씩
  append 한다 (형식: `YYYY-MM-DD HH:MM:SS [orchestrator] STEP... ...`).

---

# 아키텍처 (큰 그림)

## Orchestrator 주도 파이프라인

모든 작업은 `.Codex/agents/Orchestrator.md`에 정의된 상태 기계를 따른다.
Orchestrator는 직접 기획·설계·구현·검증을 하지 않고, 요청을 네 흐름 중 하나로
라우팅한 뒤 각 단계를 담당 Agent에게 위임하고 검증 결과(PASS/FAIL/BLOCKED)로 다음 단계를 결정한다.

- **Feature**: Planner → Architect → Developer → Tester → Complete
- **Bug Fix**: Bug Analyzer(`general-purpose`) → Developer → Tester (설계 변경 필요 시 Architect 경유)
- **Documentation**: 문서 작성(`general-purpose`) → 문서 검수(`general-purpose`) → Complete
- **Analysis / Inspection**: 조사 → 결과 보고 → Complete

별도 Reviewer Agent는 없다. 검증은 각 단계 안에서 이뤄진다:

- **기획 검증** — Architect가 설계 착수 전 `plan.md`가 설계 가능한 수준인지 검증한다.
  미달이면 반려 사유와 함께 Planner로 되돌린다.
- **설계 정합성** — Architect가 문서 간 일관성을 자체 검증한다. 구현 중 설계 충돌이
  드러나면 Developer가 `BLOCKED(DESIGN_CONFLICT)`로 보고한다.
- **코드 리뷰 + 보안 점검** — Tester가 기능 테스트와 함께 수행하며,
  `status: PASS | FAIL | BLOCKED` + `issues:`(category·cause 포함)를 반환한다.

Orchestrator는 검증 결과를 임의로 뒤집지 않는다. 동일 문제가 반복되면(기본 2회) 중단하고 사용자에게 보고한다.

## Agent 계층 (`.Codex/agents/`)

- `Orchestrator.md` — 워크플로 관리자 (라우팅·위임·전이·로그)
- `worker/` — 산출물을 만드는 Agent: `Planner`, `Architect`, `Developer`, `Tester`
  - Worker는 자기 결과를 스스로 PASS 처리하거나 다음 단계를 결정하지 않는다.
- 대응하는 subagent 타입: `planner`, `architect`, `developer`, `tester`.
  (`Bug Analyzer`, 문서 작성/검수는 Agent 정의 파일이 없다 — `general-purpose` subagent로 수행한다.)
- 이전에 있던 `viewer/`(Planning/Design/Code Reviewer, Secure-engineer)는 제거되었고,
  그 책임은 Architect(기획 검증)와 Tester(코드 리뷰·보안 점검)로 흡수되었다.
  `log/agent-execute.log`에는 제거 전 Reviewer 단계 이력이 남아 있다.

## Skill이 절차를 정의한다 (`.Codex/skills/<Role>/SKILL.md`)

각 Agent는 "무엇을/왜"만 정하고, "어떻게"는 같은 이름의 Skill에 위임한다.
디렉터리 이름과 `SKILL.md` frontmatter의 `name:`은 모두 역할명(PascalCase)이다:

- `skills/Planner/SKILL.md` → `name: Planner` (요구사항 분석 절차, Who/When/What/Action/Result/Exception, 기획서 1개 산출)
- `skills/Architect/SKILL.md` → `name: Architect` (`plan.md` 검증 + overview/logic/database/nfr 4종 설계 + 문서 간 정합성 검증)
- `skills/Developer/SKILL.md` → `name: Developer`
- `skills/Tester/SKILL.md` → `name: Tester` (기능 테스트 + 코드 리뷰 + 보안 점검)
- `skills/_shared/conventions.md` — SKILL이 아닌 공유 규약 (SOLID / 계층 / Naming / Severity / Failure 분류 / STRIDE·OWASP).

## 산출물 규약

| 단계 | 입력 | 출력 위치 |
| --- | --- | --- |
| Planner | 사용자 요청, 기존 기획서 | `document/planner/plan.md` — **파일 1개** |
| Architect | `document/planner/plan.md` | `document/architect/{overview,logic,database,nfr}.md` — **4종 한정** |
| Developer | 위 두 문서 | 소스 코드 (`src/`) + 테스트 |
| Tester | 위 문서 + 구현 코드 | 검증 결과(테스트+코드리뷰+보안), 필요 시 `document/test/test-result.md` |

- 기획은 여러 문서로 분할하지 않고 `plan.md` 하나에 담는다.
- 설계는 `overview.md`(항상) + `logic.md` / `database.md` / `nfr.md`(해당 영역 변경 시)로 한정한다.
  별도 `api.md` / `frontend.md` / `integration.md` / `infrastructure.md`를 만들지 않는다.
  **API 설계**는 필요할 때만 `logic.md`의 「API 설계」 섹션에, **보안 설계**는 `logic.md`의 「보안 설계」 섹션에 쓴다.
- 문서는 버전과 상태를 헤더에 명시하고 변경 이력 표를 유지한다.
- 현재 활성 요구사항은 `알림앱.md`(일정관리 앱 "오늘뭐해")다. `document/planner/`·`document/architect/`·
  `document/security/`에 남아 있는 다중 문서는 **규칙 변경 이전(멀티 기획서 / 7종 설계 / 별도 보안)** 에
  생성된 것이므로, 파이프라인 재실행 시 새 규약(1 기획서 / 4종 설계 / 보안은 logic 편입)으로 재정리한다.

## 알려진 경로 불일치

이전 문서가 언급하던 `.codex/` · `.agents/` · `AGENTS.md`, `docs/requirements|design|review/*.md`,
`viewer/` Reviewer 문서는 더 이상 존재하지 않는다. 문서 작성·탐색은 항상 `document/planner/`,
`document/architect/`(및 필요 시 `document/test/`)를 사용한다.
