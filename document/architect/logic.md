# 비즈니스 로직 설계 — 일정관리 앱 "오늘뭐해"

| 항목 | 값 |
| --- | --- |
| 문서 종류 | 비즈니스 로직 설계 (Logic) |
| 버전 | v1.5 |
| 상태 | 작성 완료 |
| 근거 | `document/planner/plan.md` v1.1, `document/architect/overview.md` v1.5, `document/architect/database.md` v1.0 |

## 변경 이력

| 버전 | 일자 | 변경 내용 |
| --- | --- | --- |
| v1.0 | 2026-09-04 | 최초 작성. 8개 서비스 처리 흐름 + 외부 연동 API 설계 + 보안 설계 |
| v1.1 | 2026-09-04 | §16 "클라이언트 셸 처리 흐름(RN App Shell)" 추가 — 조립 지점 리팩터, 네비게이션 그래프·딥링크, 화면↔서비스 바인딩, 앱 라이프사이클 부트스트랩, 네이티브 어댑터 계약, 셸 보안 노트. §14 일관성 점검·§15 미결정 갱신. 서비스 로직(1~13장)은 무변경 |
| v1.2 | 2026-09-04 | Bug Fix 동반 개정(overview v1.2). §16.5 `MigrationDb`·`ScheduleRepository` 행 주의에 op-sqlite 9.x `QueryResult.rows` 평면 배열(6.x `_array` 제거)·`execute()` Promise 반환 명시. §16.8 iOS 네이티브 빌드·시뮬레이터 실행을 "정식 검증"으로 이동(환경에 Xcode 26.2/CocoaPods 도입). §13.6 서드파티 버전 정책에 op-sqlite 9.x 핀 근거 주석. 처리 흐름·SQL·보안 설계 무변경 |
| v1.3 | 2026-09-04 | Bug Fix 동반 개정(overview v1.3, RENDER-003). op-sqlite 9.x 가 named 파라미터(`:name`/`$name`/`@name`)를 어떤 API 로도 지원하지 않음(positional `?` 배열 전용, 객체 전달 시 `TypeError: params?.map is not a function`)을 반영. §16.5 `ScheduleRepository` 등 6종 행에 "named 바인딩 유지 + `SqliteDb` 어댑터의 named→positional 변환 shim" 구현 노트 추가, `MigrationDb` 행에 바인딩 정책(`?` 또는 shim 경유 named) 명확화. §13.3 SQL Injection 항목에 shim 규칙 반영. §16.1 에 `SafeModeScreen` 사유 구분(`failedAt < 0` 부트스트랩 예외 vs 실제 마이그레이션 실패) 구현 권고 추가. §14 일관성 표 갱신. 포트 계약(`UnitOfWork`/`MigrationDb`/`Repository` 시그니처) 무변경 — shim 은 어댑터 내부 구현. 처리 흐름·DB 스키마·보안 위협 모델 무변경 |
| v1.5 | 2026-09-06 | 설계 델타(overview v1.5, F-16 앱 아이덴티티 UI). §16.2 탭 아이콘 설계 추가(tabBarIcon 렌더 방식, 활성/비활성 구분, E-16-1 폴백). §16.3 DashboardScreen 행에 헤더 로고·태그라인 렌더 규약 주석 추가. 신규 §16.3.2 "대시보드 헤더 로고·태그라인(F-16, AC-25)". §16.7 셸 보안 노트에 에셋 경로 고정 정책 추가. §14 일관성 표 갱신. 처리 흐름(1~13장)·DB·포트 계약 무변경 |
| v1.4 | 2026-09-04 | 설계 델타(overview v1.4, "일정 추가/수정 화면 연결"). `ScheduleEditorScreen` 이 `RootStack` 에 등록만 되고 호출부가 없어 도달 불가 + 폼이 스켈레톤. §16.2 에 진입 엣지(Dashboard/Calendar `headerRight`「+」→ `ScheduleEditor {}`, `ScheduleDetail`「편집」→ `ScheduleEditor { scheduleId }`) 추가. §16.3 화면↔서비스 바인딩 표에 진입 트리거 행 추가·`ScheduleEditorScreen` 행 확장(무효화 집합 3→4: `list`·`dashboard`·`search`·`categories`). 신규 §16.3.1 "일정 편집 화면 폼(F-01/F-03, AC-01~03)" — 필드 매트릭스(제목/시작·종료 일시/유형/우선순위/메모/반복)의 서비스 입력 키·코어 검증 오류 코드·인라인 `field`·기본값, 검증 오류 표시 규약, 날짜/시간 입력 방식 결정(네이티브 픽커 미도입 — 텍스트 입력 + `Clock` 기반 epoch 변환). §16.7 에 편집 입력 파싱 방어 1행. §14 일관성 표·§15 미결정(N-10) 갱신. **포트 계약(`ScheduleService.create/update/getById`, `CategoryService.list/create`) 무변경**. 처리 흐름(1~13장)·DB 스키마·보안 위협 모델 무변경 |

---

## 0. 공통 사항

### 0.1 포트(인터페이스) 목록 — DIP

| 포트 | 책임 | 주요 메서드(개념) |
| --- | --- | --- |
| `Clock` | 현재 시각/타임존, 날짜 경계 계산 | `now(): number`, `timeZone(): string`, `startOfLocalDay(ts, tz): number` |
| `ScheduleRepository` | SCHEDULE CRUD/조회 | `insert`, `update`, `softDelete`, `restore`, `findById`, `findInRange`, `findForDashboard`, `search` |
| `ReminderRepository` | REMINDER CRUD | `replaceForSchedule`, `findDue`, `markState`, `deleteForSchedule` |
| `CategoryRepository` | CATEGORY CRUD | `list`, `insert`, `rename`, `remove`, `systemDefaultId` |
| `SettingRepository` | APP_SETTING 키/값 | `get`, `set`, `getAll` |
| `NotificationGateway` | OS 로컬 알림 | `requestPermission`, `schedule(req)`, `cancel(osRequestId)`, `cancelAll` |
| `CalendarGateway` | OS 기본 캘린더 | `requestPermission`, `listCalendars`, `fetchEvents(range)`, `createEvent`, `updateEvent`, `deleteEvent` |
| `AuthGateway` | OAuth 2.0 + PKCE | `authorize()`, `refresh(refreshToken)`, `revoke(token)` |
| `TokenStore` | OS 보안 저장소 | `save(ref, tokens)`, `load(ref)`, `clear(ref)` |
| `Logger` | 구조적 로그(마스킹 적용) | `info`, `warn`, `error`, `metric` |

- 모든 서비스는 포트에만 의존하고 구체 어댑터는 조립 지점(app bootstrap)에서 주입한다.
- 시각 파라미터는 전부 epoch ms(정수). 표시 포맷은 UI 계층 책임.

### 0.2 공통 오류 코드 체계

| 코드 접두어 | 의미 | 예 |
| --- | --- | --- |
| `VALIDATION_*` | 입력 검증 실패(저장 전, 데이터 변경 없음) | `VALIDATION_TITLE_REQUIRED`, `VALIDATION_END_BEFORE_START`, `VALIDATION_REMINDER_LIMIT` |
| `POLICY_*` | 정책 위반 | `POLICY_SYSTEM_CATEGORY_DELETE` |
| `NOT_FOUND_*` | 대상 없음 | `NOT_FOUND_SCHEDULE` |
| `PERMISSION_*` | OS 권한 거부(기능 비활성, 도메인 영향 없음) | `PERMISSION_NOTIFICATION_DENIED`, `PERMISSION_CALENDAR_DENIED` |
| `GATEWAY_*` | 외부 연동 실패(격리, 재시도 안내) | `GATEWAY_AUTH_FAILED`, `GATEWAY_CALENDAR_UNAVAILABLE` |
| `STORAGE_*` | 저장소 오류(트랜잭션 롤백, 안전 모드) | `STORAGE_TX_FAILED`, `STORAGE_MIGRATION_FAILED` |

- 오류는 `{ code, message, field? }` 형태로 반환. UI는 `field`로 인라인 표시(AC-02/03).
- 실패 시 사용자 입력 데이터는 절대 폐기하지 않는다(폼 상태 유지).

---

## 1. ScheduleService.create (F-01, AC-01~03, AC-20, AC-22)

### 처리 흐름
- **목적**: 새 일정 + 알림 예약을 원자적으로 저장.
- **사전 조건**: 없음(로그인 불필요, P-13).
- **입력**: `{ title, memo?, categoryId?, priority?, startAt, endAt?, isAllDay?, recurrence?, notifyAtStart?, reminderOffsets?: number[] }`

```text
입력 → 입력검증 → 정책 기본값 적용 → TX{ schedule insert → reminder rows 생성 } → ReminderScheduler.sync(id) → store invalidate → 결과 반환
```

1. **입력 검증**(Domain, 순수 함수):
   - `title` 트림 후 길이 1..200 → 아니면 `VALIDATION_TITLE_REQUIRED` / `VALIDATION_TITLE_TOO_LONG` (E-01-1)
   - `startAt` 정수 필수 → `VALIDATION_START_REQUIRED` (E-01-2)
   - `endAt` 존재 시 `endAt >= startAt` → `VALIDATION_END_BEFORE_START` (E-01-3, AC-03)
   - `memo` 길이 0..5000 → `VALIDATION_MEMO_TOO_LONG`
   - `reminderOffsets`: 원소 `>= 0` 정수, 중복 제거, 개수 `<= 5` → `VALIDATION_REMINDER_LIMIT` (P-10)
   - `recurrence`: rule ∈ 허용값, `end`와 `count` 동시 지정 금지 → `VALIDATION_RECURRENCE_CONFLICT` (D-05)
2. **정책 기본값**:
   - `categoryId` 미지정/미존재 → `CategoryRepository.systemDefaultId()`("기타") (E-06-1)
   - `priority` 미지정 → `'NORMAL'` (E-07-1)
   - `notifyAtStart` 미지정 → `true`
   - `timeZone` = `Clock.timeZone()` (P-16)
3. **트랜잭션**(BEGIN IMMEDIATE):
   - `schedule` insert (`source='LOCAL'`, `created_at=updated_at=Clock.now()`)
   - 각 offset → `reminder` row(`kind='PRE'`, `offset_minutes=offset`, `trigger_at = startAt - offset*60000`, `state='PENDING'`)
   - `notifyAtStart` → `reminder` row(`kind='START'`, `offset_minutes=0`, `trigger_at=startAt`)
   - 실패 시 전체 롤백 → `STORAGE_TX_FAILED`
4. **알림 동기화**: `ReminderScheduler.sync(scheduleId)` (아래 6장). 트랜잭션 밖에서 수행, 실패해도 일정 저장은 유지(격리).
5. **후속**: 대시보드/캘린더/목록 store 무효화. 결과 `{ id }` 반환.

### 예외
- 과거 `trigger_at` → 해당 reminder `state='SKIPPED'`, OS 예약 안 함(E-01-4, E-08-2). 일정은 정상 저장.
- 알림 권한 없음 → 일정·reminder 행은 저장, `ReminderScheduler`가 `PERMISSION_NOTIFICATION_DENIED` 경고 반환(E-08-1, AC-07).

---

## 2. ScheduleService.update (F-03, AC-09)

- **입력**: `id` + 변경 필드. 낙관적 갱신 기준 `updatedAt`(불일치 시 `STORAGE_STALE_WRITE`, UI 재조회).
- 검증 규칙은 create와 동일.
- **상태 변화**: `is_done` 유지(P-05). `start_at`/`notify`/`reminderOffsets`/`recurrence` 변경 시 TX 안에서 `reminder` 행을 **replaceForSchedule**로 재생성(기존 행의 `os_request_id` 보관 → TX 후 취소 대상 목록).
- TX 후: 보관한 `os_request_id`들을 `NotificationGateway.cancel()` → `ReminderScheduler.sync(id)`로 재예약(AC-09).
- 이미 완료된 일정의 시간 변경 시 완료 상태·`done_at` 유지(P-05).

---

## 3. ScheduleService.softDelete / restore (F-04, AC-10, E-04-2, N-3)

- **softDelete(id)**: TX{ `schedule.deleted_at = now` ; `reminder.deleteForSchedule(id)` ; `calendar_link` CASCADE } → 보관된 `os_request_id` 전부 `NotificationGateway.cancel()` (AC-10). FTS는 update 트리거로 정리.
- **restore(id)**: Undo 유효 시간(제안: 5분 또는 세션 내, N-3 확정 대기) 안에서 `deleted_at = NULL` → `reminder` 행 재생성 + `ReminderScheduler.sync`.
- 만료된 soft-deleted 행은 백그라운드 잡이 물리 삭제.
- **캘린더 출처 일정 삭제**(E-04-1): `source='CALENDAR'`면 확인 문구에 "기기 캘린더에서도 삭제할까요?" 옵션. 기본은 앱에서만 숨김(`calendar_link.sync_state='EXTERNAL_DELETED'` 아님, 로컬 unlink). D-02(쓰기)=on이고 사용자가 선택하면 `CalendarGateway.deleteEvent()` 호출.

---

## 4. ScheduleService.toggleDone (F-05, AC-04, P-04~06)

- **입력**: `id`, `done: boolean`.
- 흐름: `findById` → 없으면 `NOT_FOUND_SCHEDULE` → `is_done = done`, `done_at = done ? now : null` (P-04) → 저장.
- 미래 일정도 허용(P-06, E-05-1). 저장 실패 시 이전 값 반환하여 UI 롤백(E-05-2).
- 후속: 대시보드 store 무효화(AC-04). 알림 예약은 변경하지 않음(완료해도 알림은 사용자가 끄지 않는 한 유지 — 기획 미정의, 안전값: 유지. 미결정 N-4로 기록).

---

## 5. ScheduleService.findInRange / CategoryService (F-02, F-06, F-07, AC-11, AC-12)

- **findInRange(fromTs, toTs, filter?)**: `WHERE deleted_at IS NULL AND start_at < toTs AND coalesce(end_at,start_at) >= fromTs` + 선택 필터(`categoryId`, `priority`, `isDone`) → 정렬 파라미터(`startAt` 기본 / `priority` = HIGH>NORMAL>LOW 후 `startAt`) (AC-12). 페이지네이션 50건 + cursor.
- 빈 결과 → 빈 배열(UI가 E-02-1 처리). 로드 실패 → `STORAGE_READ_FAILED`, UI는 마지막 캐시 표시(E-02-2).
- **CategoryService.remove(id)**: `is_system=1`이면 `POLICY_SYSTEM_CATEGORY_DELETE` (E-06-2 방어). 사용 중이면 TX{ `schedule.category_id`를 기본 카테고리로 UPDATE ; `category` DELETE }.
- 반복 일정: `recurrence_parent_id`로 가상 회차 확장은 조회 시점에 `RecurrenceExpander`(순수 함수)가 범위 내 발생만 계산해 병합. 개별 회차 수정 시 "이 일정만" → 예외 인스턴스 행 생성(`recurrence_parent_id` 설정), "이후 모두" → 원본 `recurrence_end_at` 조정 + 새 규칙 행(P-02).

---

## 6. ReminderScheduler (F-08, F-09, P-03, P-09, AC-05, AC-06, AC-08)

### 처리 흐름
- **목적**: 논리 예약(REMINDER 행)을 OS 예약과 일치시킨다.
- **트리거 시점**: 일정 생성/수정/삭제 후, 앱 콜드 스타트, 기기 부팅 완료(Android BootReceiver / iOS 앱 기동), 명시적 새로고침.
- **입력**: `scheduleId?`(없으면 전체), `horizonDays`(기본 60 — OS 동시 예약 상한 대비).

```text
sync():
  now = Clock.now()
  due = ReminderRepository.findDue(state IN (PENDING, SCHEDULED), trigger_at <= now + horizon)
  for r in due:
    if r.trigger_at <= now:
        markState(r, trigger_at 지남 & FIRED 아님 ? 'SKIPPED')      # E-08-2
        continue
    if NotificationGateway.permission != granted:
        return warn(PERMISSION_NOTIFICATION_DENIED)                  # E-08-1, AC-07
    if r.state == 'SCHEDULED' and r.os_request_id present: continue  # 이미 예약됨(멱등)
    osId = NotificationGateway.schedule({
             id: deterministicId(r.id),
             at: r.trigger_at,
             title: showTitle ? schedule.title : '일정 알림',        # P-10-1, 보안 설계
             body: formatBody(schedule, r.kind),
             data: { scheduleId: schedule.id }                       # payload는 정수 ID만
           })
    markState(r, 'SCHEDULED', osId, last_synced_at = now)
  # horizon 밖 reminder는 다음 sync에서 처리 (P-03)
```

- **재부팅 복원(P-09, AC-08)**: 부팅 이벤트 → `sync()` 전체 실행. `state='SCHEDULED'`지만 OS 예약이 사라졌으므로 `os_request_id`를 무시하고 재예약(`deterministicId`로 중복 방지).
- **발송 수신 처리**: OS가 알림 표시 → 앱이 delivered 콜백에서 `markState(r,'FIRED')`. 사용자가 알림 탭 → `data.scheduleId`로 `ScheduleRepository.findById` 재조회(위조 방지) → 상세 화면 이동.
- **정시 알림(F-09, AC-06)**: `kind='START'`, `offset=0`, body "지금 시작".
- **동시성**: `sync()`는 재진입 방지 뮤텍스(진행 중이면 다음 실행 큐잉). `deterministicId(reminderId)`로 OS 예약 멱등.
- **실패 처리**: `NotificationGateway.schedule` 개별 실패 → 해당 행 `state` 유지(PENDING), 다음 sync 재시도. 로그 `metric('reminder.schedule.fail')`.

### 예외
- 방해 금지/포커스 모드: OS 정책에 위임, 앱은 우회하지 않음(E-08-4).
- 오프셋 시각 과거: `SKIPPED` (E-08-2).

---

## 7. DashboardService (F-10, AC-04, AC-15, AC-16, P-07)

- **입력**: `dateTs`(기본 `Clock.now()`), `tz = Clock.timeZone()`.
- `dayStart = Clock.startOfLocalDay(dateTs, tz)`, `dayEnd = dayStart + 86400000` (P-17, AC-16).
- 단일 쿼리:
  ```sql
  SELECT
    count(*)                                   AS total,
    sum(is_done)                               AS done,
    count(*) - sum(is_done)                    AS not_done
  FROM schedule
  WHERE deleted_at IS NULL
    AND start_at >= :dayStart AND start_at < :dayEnd;
  ```
- `completionRate = total == 0 ? 0 : round(done / total * 100)` (P-07, AC-15).
- 유형별 분포: `GROUP BY category_id` 보조 쿼리. 다음 예정 일정: `start_at >= now AND is_done = 0 ORDER BY start_at LIMIT 1`.
- 빈 상태(`total=0`): `{ total:0, done:0, notDone:0, completionRate:0, empty:true }` (AC-15).
- 자정 경과: UI가 `Clock` 기준으로 `dateTs`를 재평가해 재호출(AC-16). 서비스는 상태를 갖지 않음.

---

## 8. SearchService (F-11, AC-13, AC-14, P-11, P-12)

- **입력**: `{ query: string, filter?: { categoryId?, priority?, isDone?, fromTs?, toTs? }, limit=50, cursor? }`.
- `q = query.trim()`; `q.length === 0` → 빈 결과(E-11-1).
- **분기**:
  - `q.length >= 2` → FTS5: `SELECT s.* FROM schedule_fts f JOIN schedule s ON s.id = f.rowid WHERE schedule_fts MATCH :ftsQuery AND s.deleted_at IS NULL` + 필터 + `ORDER BY rank`. `ftsQuery`는 사용자 입력을 **큰따옴표로 감싸고 내부 `"`는 이스케이프**하여 구문 주입 차단(보안 설계).
  - `q.length < 2` → `LIKE` 폴백: `WHERE (title LIKE :like OR memo LIKE :like OR EXISTS(SELECT 1 FROM category c WHERE c.id=s.category_id AND c.name LIKE :like)) AND deleted_at IS NULL LIMIT 50` + "검색어가 짧아 결과가 제한됩니다" 플래그(P-11, E-11-2). `:like = '%' + escapeLike(q) + '%'`.
- 필터는 SQL WHERE로만 적용(P-12): 완료/우선순위/기간은 검색어와 AND 결합(AC-14).
- 대상 필드: title, memo, category name (P-12).
- 정렬: FTS는 `rank`, 폴백은 `start_at DESC`.

---

## 9. AuthService (F-12, D-01=(c), AC-20, AC-21) + API 설계

### 처리 흐름
- **link()**: `AuthGateway.authorize()` (아래 API 설계) → 성공 시 `TokenStore.save('account.tokens', {access, refresh, expiresAt})` → `account_link` upsert(`state='LINKED'`, `provider`, `subject`, `display_name`, `token_ref='account.tokens'`, **토큰 값은 DB에 쓰지 않음**).
- **unlink()**: `AuthGateway.revoke(refresh)` (best effort) → `TokenStore.clear('account.tokens')` → `account_link` → `state='NONE'`, 식별 필드 NULL. **로컬 일정 데이터는 건드리지 않음**(P-14, AC-21).
- **ensureFreshToken()**: 만료 임박 시 `AuthGateway.refresh()` → 실패 시 `account_link.state='EXPIRED'` + `GATEWAY_AUTH_FAILED`, 앱은 로컬 모드로 계속(E-12-2, AC-20).
- D-01=(c): 연동은 이후 "캘린더 연동 활성화 힌트"로만 사용. 자체 서버 동기화 없음. (a) 확정 시 이 섹션에 동기화 API가 추가된다.

### API 설계 (외부 호출 only — 자체 제공 API 없음)

> 자체 백엔드가 없으므로 "제공 API"는 없다. 아래는 **외부 시스템 호출** 계약이다.

#### 9.1 OAuth 2.0 Authorization (호출 — `react-native-app-auth`)

| 항목 | 값 |
| --- | --- |
| 목적 | 계정 연동(F-12) |
| 방식 | Authorization Code + PKCE (S256) |
| Endpoint | IdP `authorization_endpoint`, `token_endpoint` (Discovery `/.well-known/openid-configuration`) |
| 요청(authorize) | `client_id`, `redirect_uri`(앱 스킴), `scope`(`openid profile` + 필요 최소), `code_challenge`, `state`, `nonce` |
| 응답 | `{ accessToken, accessTokenExpirationDate, refreshToken, idToken, tokenType }` |
| 검증 | `state` 일치, `idToken` 서명·`aud`·`iss`·`nonce`·`exp` 검증(라이브러리 위임 + 앱에서 `aud`/`iss` 확인) |
| 실패 처리 | 사용자 취소 → `GATEWAY_AUTH_CANCELLED`(무해, 로컬 모드). 네트워크/서버 오류 → `GATEWAY_AUTH_FAILED`, 재시도 버튼. Timeout 30s. Retry 0(사용자 트리거). |
| 장애 영향 | 없음 — 앱 전체 기능은 로그인 불필요(P-13) |

#### 9.2 Token Refresh (호출)

| 항목 | 값 |
| --- | --- |
| 목적 | 액세스 토큰 갱신 |
| 요청 | `grant_type=refresh_token`, `refresh_token`, `client_id` |
| 응답 | 새 `accessToken`(+ 회전된 `refreshToken` 가능) |
| Timeout / Retry | 15s / 지수백오프 2회(네트워크 오류에 한함) |
| 실패 처리 | `account_link.state='EXPIRED'`, 다음 상호작용에서 재인증 유도 |

#### 9.3 Token Revoke (호출, best-effort)

| 항목 | 값 |
| --- | --- |
| 요청 | `token`(refresh), `client_id` |
| 실패 처리 | 무시(로컬 정리는 그대로 진행). 로그만 남김 |

---

## 10. SettingService / ThemeStore (F-13, AC-17, P-10-1)

- `get/set` → `APP_SETTING`(JSON 값). 키: `theme.mode`(`"light"|"dark"|"system"`), `theme.accent`(`"#RRGGBB"`), `theme.fontScale`(number), `notif.showTitle`(bool, P-10-1), `calendar.pushEnabled`(bool, D-02), `calendar.conflictPolicy`(`"device"|"app"`, P-08-2).
- 변경 즉시 store 반영 + 영속. 앱 재시작 시 `getAll()`로 복원(AC-17).
- `theme.mode='system'`이면 OS 테마 변경 이벤트를 구독해 반영(E-13-1).
- `notif.showTitle=false`면 `ReminderScheduler`가 알림 title/body에서 일정 제목을 `'일정 알림'`으로 대체.

---

## 11. CalendarSyncService (F-14, P-08, AC-18, AC-19)

### 처리 흐름
- **사전 조건**: `CalendarGateway.requestPermission()` 허용. 거부 시 `PERMISSION_CALENDAR_DENIED`, 기능 비활성(E-14-1).
- **pull(range)**:
  1. `CalendarGateway.fetchEvents(range, selectedCalendarIds)` → 외부 이벤트 목록.
  2. 각 외부 이벤트에 대해:
     - `calendar_link`에 `(external_calendar_id, external_event_id)` 존재? → 매핑된 `schedule` 갱신 후보.
     - 없으면 휴리스틱: 동일 `title` + 동일 `start_at`(±60s) 인 `LOCAL` 일정 존재 → 링크 생성(병합), 사용자가 편집한 로컬 필드(memo, category, priority) **보존**(P-08, AC-19).
     - 둘 다 없으면 새 `schedule`(`source='CALENDAR'`) + `calendar_link` 생성.
  3. 외부에서 사라진 링크 → `sync_state='EXTERNAL_DELETED'` 표시(P-08-1), 다음 pull에서 제거.
  4. 충돌(양쪽 `updated_at` 모두 `last_synced_at` 이후): `sync_state='CONFLICT'`, 해결 정책(`calendar.conflictPolicy`, 기본 `device`) 적용(P-08-2, E-14-3).
- **push (D-02=on일 때만)**: `LOCAL` 일정 생성/수정 → `CalendarGateway.createEvent/updateEvent` → 반환 ID로 `calendar_link` 생성/갱신.
- 대량 이벤트(E-14-4): range를 월 단위로 청크, 백그라운드 태스크, 진행률 이벤트 emit.
- 표시(AC-18/19): `findInRange` 결과와 캘린더 뷰 병합은 `schedule` 테이블 단일 소스로 이미 통합되어 중복 없음.

### 예외
- 권한 거부 → 앱 자체 일정 정상(E-14-1).
- 중복 판정 실패로 이중 생성 → 사용자가 수동 병합 가능(UI), `calendar_link` 재지정.

---

## 12. 앱 부트스트랩 흐름 (F-15, AC-24, E-15-1)

```text
앱 시작
 → openDatabase (PRAGMA foreign_keys=ON, journal_mode=WAL, (옵션) key=<Keychain>)
 → MigrationRunner.run(): user_version < target 이면 001.., 순차 적용
     성공 → schema_migration 로그, user_version 갱신 (AC-24)
     실패 → 롤백 → 안전 모드(읽기 전용 + 안내) → STORAGE_MIGRATION_FAILED (E-15-1)
 → SettingService.getAll() → ThemeStore 초기화
 → ReminderScheduler.sync() 전체 (콜드 스타트 재예약, P-09)
 → AuthService.ensureFreshToken() (연동 상태면, 실패해도 진행)
 → UI 렌더 (대시보드)
```

---

## 13. 보안 설계 (STRIDE / OWASP — 관련 위협 중심)

### 13.1 신뢰 경계와 공격 표면

| 경계 | 표면 | 신뢰 수준 |
| --- | --- | --- |
| 사용자 입력 | 일정 제목/메모/검색어, 카테고리명, 설정 값 | 낮음 — 검증·바인딩 필수 |
| OS 기본 캘린더 | 외부 이벤트 필드(title/notes/시간/ID) | 낮음 — 외부 데이터, 검증 후 저장 |
| OAuth IdP / 네트워크 | authorize/token/revoke 응답, id_token | 중간 — 서명·클레임 검증 |
| OS 알림 payload / 딥링크 | 알림 탭 시 전달되는 data | 낮음 — 정수 ID만, 재조회로 검증 |
| 로컬 저장소(SQLite 파일, OS 백업) | 일정 제목/메모(민감), 계정 식별자 | 매체 탈취 위협 대상 |
| OS 보안 저장소(Keychain/Keystore) | 액세스/리프레시 토큰, DB 암호화 키 | 높음 — 여기에만 비밀 저장 |

### 13.2 인증 / 세션 / 권한 (Broken Access Control, Auth Failures)

- 앱은 단말 로컬 단일 사용자. 앱 내부 권한 계층 없음 → 수평/수직 권한 상승 표면이 작다.
- 계정 연동: OAuth 2.0 **Authorization Code + PKCE(S256)**, 시스템 브라우저/ASWebAuthenticationSession 사용(임베디드 WebView 금지 — 자격증명 탈취·스토어 정책).
- `state`/`nonce` 검증으로 CSRF/replay 방지. `id_token`의 `iss`, `aud`, `exp`, `nonce` 검증.
- 토큰 저장: `TokenStore`(Keychain `kSecAttrAccessibleWhenUnlockedThisDeviceOnly` / Keystore `setUserAuthenticationRequired(false)` + `StrongBox` 가능 시). **DB(`account_link`)에는 참조 키만**.
- 리프레시 실패 → `EXPIRED` 강등, 민감 동작 없이 로컬 유지. 로그아웃 시 토큰 revoke + clear.
- 잔여 위험: 루팅/탈옥 단말에서 Keychain 접근 가능성 → `residual risk`, 앱 무결성/루팅 탐지는 이번 범위 밖(N-2 후속).

### 13.3 입력 검증 / 출력 처리 (Injection, XSS, Data Integrity)

- **SQL Injection**: 모든 SQL은 파라미터 바인딩. 동적 식별자·문자열 연결 SQL 금지. 리포지토리 레이어는 named 바인딩(`:name`)을 사용하며 위치 바인딩(`?`)도 허용된다. op-sqlite 9.x 는 named 파라미터를 지원하지 않으므로(positional `?` 배열 전용) `SqliteDb` 어댑터(`OpSqliteDb.native.ts`)가 실행 직전에 `:name`/`$name`/`@name` → positional `?` 변환 shim 을 적용한다(§16.5). shim 은 `sqlSplit.ts` 의 문자열·주석 스킵 로직을 재사용해 리터럴/주석 안의 `:` 를 건드리지 않고, 같은 이름이 여러 번 나와도 SQLite 슬롯 규칙대로 슬롯 1개로 dedup(최초 등장 순서)한다. 이 변환은 SQL 구조를 바꾸지 않고 바인딩 슬롯만 재배치하므로 주입 표면을 새로 만들지 않는다.
- **FTS5 구문 주입**: 사용자 검색어는 `"` 이스케이프 후 phrase로 감싸 `MATCH`에 전달. 특수연산자(`NEAR`, `*`, `:`) 비활성.
- **LIKE 와일드카드 주입**: `escapeLike()`로 `%`,`_`,`\` 이스케이프 + `ESCAPE '\'`.
- **외부 캘린더 데이터**: title ≤ 200, notes ≤ 5000 트렁케이트, 제어문자 제거 후 저장. RN `<Text>` 렌더이므로 HTML/JS 실행 표면 없음(웹뷰 미사용). 딥링크/URL은 스킴 화이트리스트.
- **알림 payload 위조(Tampering)**: `data`에 `scheduleId`(정수)만. 수신 시 반드시 `ScheduleRepository.findById`로 재조회, 실패 시 무시.
- **정수 파싱**: 모든 `*_at`는 `Number.isInteger` 확인, NaN/Infinity 거부.

### 13.4 민감정보 식별과 보호 (Cryptographic Failures, Information Disclosure)

| 데이터 | 저장 | 전송 | 보호 |
| --- | --- | --- | --- |
| 일정 제목/메모 | SQLite | (D-01=(c)에서 미전송) | 선택적 SQLCipher 전체 암호화(D-03), 알림 제목 마스킹 토글(P-10-1, 기본 노출) |
| 계정 access/refresh token | Keychain/Keystore only | HTTPS(IdP) | 최소 scope, 회전, revoke on unlink |
| 계정 subject/display name | SQLite(`account_link`) | — | 식별자 최소 저장, unlink 시 제거 |
| DB 암호화 키 | Keychain/Keystore | — | 앱 최초 실행 시 CSPRNG 32B 생성, 절대 로그/백업 평문 금지 |

- **전송 보안**: 모든 외부 통신 HTTPS(TLS1.2+). ATS/cleartext 차단. 인증서 핀닝은 IdP 도메인에 한해 선택(운영 부담 고려, 미결정 N-5).
- **OS 백업**: 암호화 미선택 시 SQLite 파일이 클라우드 백업에 평문 포함될 수 있음 → Android `allowBackup=false` 또는 백업 규칙에서 DB 제외, iOS는 파일 보호 클래스 `NSFileProtectionComplete`. 암호화 선택 시에도 키는 백업 제외.
- **클립보드/스크린샷**: 민감 화면(일정 상세) 스크린샷 방지는 선택 기능(미결정 N-6).

### 13.5 비밀정보 취급 (설계 수준)

- 앱에 하드코딩 금지: `client_id`는 공개 값이라 허용, `client_secret`은 **모바일에서 사용하지 않음**(PKCE public client).
- 빌드 구성값(discovery URL, redirect scheme)은 빌드 환경 설정으로 주입, 리포지토리에 실제 운영값 커밋 금지.
- 로그·크래시 리포트에 토큰/키/제목/메모 금지(마스킹 유틸 통과 후 로깅).

### 13.6 의존성 / 구성 위험 (Vulnerable Components, Security Misconfiguration)

- 서드파티(op-sqlite, notifee, app-auth, keychain, calendar-events)는 major 고정 + `npm audit`/Dependabot 주기 점검. **op-sqlite는 9.x(9.3.x) 고정** — 6.x는 대상 Xcode(26.2) 툴체인에서 컴파일 불가(`cpp/types.h` 헤더 결함), 11.x+는 RN 0.75+ 타깃(현재 RN 0.74.5)이라 회피. 상향 시 RN peer(`>0.73.0`)·구아키텍처 지원·`QueryResult.rows` 형태를 재확인한다(overview v1.2 기술 스택 표).
- 릴리스 빌드: 디버그 로그 제거, `__DEV__` 분기, 소스맵 비공개.
- Android: `android:exported` 명시, 딥링크 intent-filter 최소화, `usesCleartextTraffic=false`.
- iOS: ATS 예외 없음, URL scheme 충돌 검토.

### 13.7 감사 / 로그 대상 보안 이벤트 (Logging/Monitoring Failures)

- 기록(로컬, 마스킹): 계정 link/unlink/refresh 실패, 캘린더 권한 부여/거부, 마이그레이션 성공·실패, 알림 권한 상태 변화, 안전 모드 진입, 대량 동기화 충돌 건수.
- 미기록: 일정 본문, 토큰, 검색어 원문(길이/결과수만).
- 원격 수집은 이번 범위 없음(N-2). Repudiation은 단일 사용자 로컬 앱이라 위험도 낮음.

### 13.8 위협→대응→잔여 위험 요약

| 위협 | STRIDE / OWASP | 대응 | 잔여 위험 |
| --- | --- | --- | --- |
| 단말 분실 → 일정 내용 열람 | Info Disclosure / Crypto Failures | SQLCipher(옵션), 파일 보호 클래스, 알림 제목 마스킹 | 잠금 미설정·루팅 단말, 암호화 미선택 시 백업 노출 → D-03 확정 필요 |
| 토큰 탈취로 계정 도용 | Spoofing / Auth Failures | PKCE, Keychain 저장, 최소 scope, revoke | 루팅 단말 Keychain 접근 |
| 검색어/제목으로 SQL·FTS 주입 | Tampering / Injection | 바인딩, FTS phrase 이스케이프, LIKE escape | 없음(설계상 제거) |
| 위조된 알림/딥링크로 잘못된 화면 유도 | Tampering | payload 정수 ID + 재조회 검증, 스킴 화이트리스트 | 낮음 |
| 외부 캘린더 오염 데이터 저장 | Data Integrity | 길이·타입·제어문자 검증, 로컬 편집 우선 병합 | 사용자 혼동(중복 표시) → 수동 병합 UI |
| 취약 서드파티 | Vulnerable Components | 버전 고정 + 주기 audit | 신규 CVE 대응 지연 |
| 로그에 민감정보 노출 | Info Disclosure / Logging Failures | 마스킹 유틸, 릴리스 로그 축소 | 서드파티 내부 로그 |

---

## 14. 문서 간 일관성 확인 결과 (Architect 자체 검증)

| 점검 | 결과 |
| --- | --- |
| Logic이 쓰는 필드가 database.md에 존재 | OK — SCHEDULE/REMINDER/CATEGORY/APP_SETTING/CALENDAR_LINK/ACCOUNT_LINK 전 필드 대응 |
| 상태 변화(예정↔완료, soft delete)와 DB 컬럼(`is_done`,`done_at`,`deleted_at`) 일치 | OK |
| 알림 재예약 흐름과 `reminder.os_request_id/state` 설계 일치 | OK |
| 인증 모델(로그인 불필요 + OAuth 선택)이 overview·logic 일관 | OK |
| 보안 설계의 신뢰 경계·검증 지점이 처리 흐름과 모순 없음 | OK (payload 재조회, 바인딩, Keychain 한정) |
| 용어(SCHEDULE/REMINDER/CATEGORY, epoch ms, tz) 문서 간 동일 | OK |
| overview 요약이 각 세부 문서와 일치 | OK — v1.1 overview "클라이언트 셸 아키텍처"와 본 §16 용어·모듈 배치·포트 매핑 동일 |
| API 설계(외부 호출만)와 D-01=(c) 일관 | OK — 자체 제공 API 없음 명시 |
| (v1.1) §16 셸 흐름이 코어 포트·서비스 시그니처와 일치 | OK — `buildApp` 옵션 확장은 후방 호환, 화면은 기존 서비스 메서드만 호출, 어댑터는 `src/core/ports` 인터페이스 그대로 구현 |
| (v1.1) §16 딥링크·알림 payload 검증이 §6/§13.3과 일관 | OK — payload 정수 ID + `findById` 재조회, 스킴 화이트리스트 |
| (v1.1) §16 부트스트랩이 §12와 일관 | OK — §12 순서를 RN 라이프사이클(index.js→App.tsx→migrate→settings→render→sync)로 실체화, 단계 누락 없음 |
| (v1.3) §16.5 named→positional shim 이 §13.3 SQL Injection 대응과 일관 | OK — shim 은 SQL 구조 불변·슬롯 재배치만 수행, 문자열/주석 내 `:` 스킵으로 `sqlSplit.ts` 규칙 재사용. 파라미터 바인딩 원칙 유지 |
| (v1.3) §16.5 shim 이 포트 계약(`UnitOfWork`/`MigrationDb`/`Repository`)에 영향 없음 | OK — shim 은 `OpSqliteDb.native.ts` 어댑터 내부 구현. 포트 인터페이스 시그니처·`database.md` DDL·바인딩 표기 무변경 |
| (v1.3) §16.1 `SafeModeScreen` 사유 구분 권고가 부트스트랩 계약과 일관 | OK — `failedAt` sentinel(`-1`) 의미(부트스트랩 예외)는 `bootstrapSequence` catch 정의와 일치, 에러 코드 `STORAGE_MIGRATION_FAILED` 유지 |
| (v1.4) §16.2 진입 엣지·§16.3.1 폼이 코어 서비스 계약과 일치 | OK — `ScheduleService.create/update/getById`·`CategoryService.list/create` 시그니처 무변경. 화면은 기존 입력 키(`title/startAt/endAt/categoryId/priority/memo/recurrence`)만 전달, 검증은 코어 `assertValidScheduleInput` 재사용 |
| (v1.4) §16.3.1 검증 오류 코드가 `errors.ts`·`validation.ts` 와 일치 | OK — `VALIDATION_TITLE_REQUIRED/TITLE_TOO_LONG/START_REQUIRED/END_BEFORE_START/END_INVALID/MEMO_TOO_LONG/RECURRENCE_*` 모두 `ErrorCodes` 에 존재하고 `field` 값 대응 |
| (v1.4) 반복(F-01 반복) 범위가 D-05 가정·코어 구현과 일치 | OK — 단순 반복(P-01: NONE/DAILY/WEEKLY/MONTHLY/YEARLY + 종료일\|횟수)만, 코어 `Recurrence` 타입·`expandOccurrences`·`validation.ts` 에 이미 구현. P-02 개별 회차 편집은 범위 밖(N-10)으로 명시 |
| (v1.4) 날짜/시간 입력이 P-16·DB 스키마와 일관 | OK — UI 에서 epoch ms(UTC)로 변환해 전달, `SCHEDULE.start_at/end_at` 저장 형식 무변경. 신규 네이티브 의존성 없음 |
| (v1.4) 저장 후 무효화 집합이 `bindings.ts`·스켈레톤과 일치 | OK — `list`·`dashboard`·`search`·`categories` 4개(기존 코드·`SCREEN_BINDINGS` 와 동일). §16.3 표기를 3→4개로 정정 |
| (v1.5) §16.2 탭 아이콘 에셋 경로가 P-21·실제 파일 위치와 일치 | OK — `src/assets/icons/`에 todo/goal/statistics/settings/logo.png 존재, `src/assets/images/`에 tagline.png 존재. §16.3.2 경로 규약과 일치 |
| (v1.5) 탭 아이콘 매핑이 F-16 기획과 일치 | OK — DashboardTab→todo.png, CalendarTab→goal.png, SearchTab→statistics.png, SettingsTab→settings.png. 기획 F-16 Action 목록과 동일 |
| (v1.5) §16.3.2 로고·태그라인 렌더가 P-20·E-16-1~3·AC-25/28과 일관 | OK — 화면 폭 60% 이하 제한(P-20), onError 폴백(E-16-1/AC-28), 원본 PNG 사용(E-16-2), RN 자동 스케일링 위임(E-16-3) |
| (v1.5) 에셋 관련 변경이 DB·포트·코어 서비스에 영향 없음 | OK — 순수 UI 렌더 변경. 상태 슬라이스·서비스 호출·DB 스키마 무변경 |
| (v1.5) §16.7 에셋 보안 노트가 §13.1 신뢰 경계와 일관 | OK — 빌드 타임 번들 포함, 런타임 주입 표면 없음. 추가 위협 없음 |

발견된 불일치: 없음. (구버전 설계의 FTS trigram 2자 이슈는 본 설계에서 "FTS + LIKE 폴백"으로 해소.)

---

## 15. 미결정 사항 (Logic 관점)

| ID | 내용 |
| --- | --- |
| N-3 | 삭제 Undo 유효 시간 (제안: 5분/세션 내) |
| N-4 | 완료 처리 시 남은 알림 취소 여부 (안전값: 유지) |
| N-5 | IdP 도메인 인증서 핀닝 채택 여부 |
| N-6 | 민감 화면 스크린샷 방지 채택 여부 |
| N-8 | RN 앱 셸 온디바이스 빌드·실행 검증(환경 외 후속) — overview N-8 |
| N-10 | (1) 일정 편집 날짜/시각 네이티브 픽커(`@react-native-community/datetimepicker` 8.x) 도입 — 빌드 호스트 디스크 여유 확보 후, 동일 UI 계약 뒤 교체. (2) 반복 일정 개별 회차 편집("이 일정만/이후 모두", P-02) — 코어 `ScheduleService.update` 확장 필요, 이번 사이클 범위 밖 |
| D-01~D-03 | overview.md의 게이트와 동일 |

---

## 16. 클라이언트 셸 처리 흐름 (RN App Shell) — v1.1

서비스 로직(1~13장)은 그대로 두고, React Native 클라이언트가 그 서비스를 **어떻게 조립·구동·표시**하는지 정의한다. 코어(`src/core/**`)는 무변경.

### 16.1 조립 지점 리팩터 (Composition Root seam)

- **목적**: `buildApp`이 인메모리/Fake 대신 네이티브 어댑터를 받을 수 있게 하되 기존 호출부(테스트·`npm run demo`)를 깨지 않는다.
- **입력**: `AppOptions` 확장.

```text
buildApp(options):
  clock        = options.clock        ?? new SystemClock()
  logger       = options.logger       ?? new ArrayLogger()
  uow          = options.uow          ?? new InMemoryDb()         # UnitOfWork
  repos        = options.repositories ?? InMemory*Repository(uow) # 6종 묶음
  notifications= options.notifications?? new FakeNotificationGateway('granted')
  calendar     = options.calendar     ?? new FakeCalendarGateway('granted')
  auth         = options.auth         ?? new FakeAuthGateway()
  tokenStore   = options.tokenStore   ?? new InMemoryTokenStore()
  → (미지정이면) seedDefaults(uow)                                 # 인메모리 경로만
  → 서비스 8종을 위 포트로 생성해 App 반환
```

- **제약**: 옵션 미지정 시 동작·반환 타입이 v1.0과 동일해야 한다(REGRESSION). `repositories`를 주입하면 `seedDefaults`(인메모리 시드)를 호출하지 않는다 — 네이티브 경로는 마이그레이션 001의 DML이 시드를 담당(database.md 7장).
- **정상 흐름(네이티브)**: `composeNative()` → `OpSqliteDb.open()` → `runMigrations(db, MIGRATIONS)` → 성공 시 `buildApp({ clock, logger: MaskingLogger, uow: db, repositories: sqliteRepos(db), notifications: NotifeeGateway, calendar: RNCalendarGateway, auth: AppAuthGateway, tokenStore: KeychainTokenStore })`.
- **실패 처리**: `runMigrations` 결과에 `failedAt`이 있으면 `App`을 조립하지 않고 **안전 모드 컨텍스트**(읽기 전용 안내 화면)만 렌더 → `STORAGE_MIGRATION_FAILED`(E-15-1, AC-24 역케이스).
- **구현 권고 (RENDER-003, 규약 변경 아님)**: `bootstrapSequence` 의 catch 블록은 db-open / user_version 조회 / assemble / load-settings 단계의 예외를 `failedAt = -1` sentinel 로 수렴한다 — 이는 마이그레이션 실패가 아니라 **부트스트랩 단계 예외**다. `SafeModeScreen` 은 사유를 구분해 문구를 분기한다: `failedAt < 0` 이면 부트스트랩 실패 계열 카피("데이터를 여는 중 문제가 발생했습니다 · 다시 시도"), `failedAt >= 0` 이면 기존 스키마 업데이트 실패 카피(`v{fromVersion} → 실패 지점 v{failedAt}`). trace 마지막 phase 를 보조 안내에 노출할 수 있다. UX 카피 분기 권고이며 부트스트랩 계약·에러 코드(`STORAGE_MIGRATION_FAILED`)는 그대로 둔다.

### 16.2 네비게이션 그래프 · 딥링크

- **구조**: Root = Bottom Tab 4개 + 상단 Native Stack.

```text
RootStack
├── Tabs
│   ├── DashboardTab   → DashboardScreen
│   ├── CalendarTab    → CalendarScreen (일/주/월 토글) ─┐
│   ├── SearchTab      → SearchScreen                    │ 공통: 항목 탭 → ScheduleDetail
│   └── SettingsTab    → SettingsScreen                  ┘
├── ScheduleDetail   { scheduleId: number }
├── ScheduleEditor   { scheduleId?: number }        # 없으면 신규
└── Onboarding/Permissions   (최초 실행 또는 설정에서 진입)
```

- **진입 엣지 (일정 추가/수정 도달 경로, v1.4)**:
  - `DashboardScreen` `headerRight`「+」및 빈 상태「일정 추가」버튼 → `navigate('ScheduleEditor', {})` (신규 작성, AC-15 · E-10-1 · 7.2)
  - `CalendarScreen` `headerRight`「+」 → `navigate('ScheduleEditor', {})` (신규 작성, 7.2)
  - `ScheduleDetailScreen` `headerRight`「편집」 → `navigate('ScheduleEditor', { scheduleId })` (수정, F-03 · 7.3)
  - `ScheduleEditorScreen` 저장 성공 → `navigation.goBack()` (기존 유지)
  - 진입점은 서비스를 호출하지 않는다(순수 네비게이션). `ScheduleEditor` 는 이미 `RootStack` 에 `Stack.Screen` 으로 등록되어 있고 `routes.ts` 의 `ScheduleEditor { scheduleId? }` 도 정의됨 — 누락된 것은 호출부(진입 버튼)뿐이다.
- **라우트 파라미터**는 `routes.ts`에 타입으로 고정. `scheduleId`는 항상 `number`.
- **딥링크 config (`linking.ts`)**: URL 스킴 화이트리스트(`todaywhat://`)만 허용. 경로 `todaywhat://schedule/:id` → `ScheduleDetail`. `:id`는 `Number.isInteger` 검증 실패 시 무시하고 대시보드로.
- **알림 탭 처리(logic 6장 재사용)**: notifee 이벤트 → `data.scheduleId`(정수) 추출 → **`ScheduleService`를 통해 `findById` 재조회**(위조 방지, 13.3) → 존재하면 `ScheduleDetail`로 네비게이트, 없으면 무시 + `metric('deeplink.stale')`.
- **콜드 스타트 시 알림 탭**: `getInitialNotification()`을 `bootstrapSequence` 완료 후 처리(레이스 방지).

#### 탭 아이콘 설계 (F-16, AC-26, AC-27, AC-28) — v1.5

- **에셋 경로 (P-21)**:

| 탭 | 에셋 파일 | require 경로 |
| --- | --- | --- |
| 오늘 (DashboardTab) | `todo.png` | `../../assets/icons/todo.png` |
| 캘린더 (CalendarTab) | `goal.png` | `../../assets/icons/goal.png` |
| 검색 (SearchTab) | `statistics.png` | `../../assets/icons/statistics.png` |
| 설정 (SettingsTab) | `settings.png` | `../../assets/icons/settings.png` |

- **렌더 방식**: `Tab.Navigator`의 `screenOptions` 또는 각 `Tab.Screen`의 `options.tabBarIcon` 콜백에서 `<Image source={icon} style={{ width: 24, height: 24, opacity: focused ? 1 : 0.4 }} />` 렌더 (P-19: 단일 파일, 투명도 기반 활성/비활성 구분).
  - 활성 탭: `opacity: 1`, 비활성 탭: `opacity: 0.4` (P-19, AC-27).
  - 탭 라벨(텍스트)과 아이콘을 함께 표시한다 — 아이콘 전용 모드 없음(P-18, AC-26).
- **에셋 로드 실패 처리 (E-16-1, AC-28)**: `<Image>` 의 `onError` 콜백으로 fallback 상태 플래그를 세팅하고, 아이콘 영역을 `<Text>` 라벨로 대체 렌더한다. 앱 크래시가 발생하지 않도록 `onError` 필수 처리.
- **다크 테마 (E-16-2)**: 원본 PNG를 그대로 사용. 별도 다크 변형 에셋 없음(이번 범위 외).
- **고해상도 기기 (E-16-3)**: RN `<Image>` 자동 스케일링에 위임. `@2x`/`@3x` 에셋 없음(이번 범위 외).
- **신뢰 경계 / 보안**: 에셋은 빌드 타임에 JS 번들에 포함(P-21). 런타임에 외부에서 에셋 경로를 변경하거나 주입하는 표면 없음.

### 16.3 화면 ↔ 서비스 바인딩 (상세)

| 화면 | 트리거 | 호출 | 상태 반영 / 무효화 | 예외 표시 |
| --- | --- | --- | --- | --- |
| DashboardScreen | 포커스, 자정 경과(AppState+Clock), pull-to-refresh | `DashboardService.getSummary(dateTs?)` | `dashboard` 슬라이스 교체 | 로드 실패 → 마지막 캐시 + 재시도(E-02-2) |
| DashboardScreen | `headerRight`「+」/ 빈 상태「일정 추가」 | 없음 — `navigate('ScheduleEditor', {})` | — | — (AC-15, E-10-1) |
| CalendarScreen / ListScreen | 기간 이동, 필터/정렬 변경, 무한 스크롤 | `ScheduleService.findInRange(from,to,filter,sort,50,cursor)` | `list` append(keyset), `nextCursor` 보관 | 빈 결과 → 빈 상태(E-02-1) |
| CalendarScreen / ListScreen | `headerRight`「+」 | 없음 — `navigate('ScheduleEditor', {})` | — | — |
| 목록 항목 체크박스 | 토글 | `ScheduleService.toggleDone(id, next)` — 낙관적 UI, 실패 시 롤백(E-05-2) | `list` 항목 교체 + `dashboard` invalidate(AC-04) | 실패 → 토스트, 상태 되돌림 |
| ScheduleEditorScreen | 진입(신규/수정) | 수정 모드면 `ScheduleService.getById(scheduleId)` 로 프리필; 신규면 빈 폼 | — | `getById`=null → "일정을 찾을 수 없습니다" 후 `goBack` |
| ScheduleEditorScreen | 카테고리 옵션 로드 | `CategoryService.list()` (마운트 1회) | `categories` 캐시 | 실패 → 유형 미선택으로 진행(코어가 "기타" 대체, E-06-1) |
| ScheduleEditorScreen | 저장 | 신규 `ScheduleService.create(input)` / 수정 `ScheduleService.update(id, input)` — 필드 매핑·검증은 §16.3.1 | 성공 시 `list`·`dashboard`·`search`·`categories` invalidate → `navigation.goBack()` | `ValidationError`/`AppError` → `err.field` 로 필드 인라인(AC-02/03), 다건이면 `errors[]` 각각 매핑, 폼 상태 유지(§0.2) |
| ScheduleEditorScreen | 유형 추가(옵션) | `CategoryService.create(name)` | `categories` invalidate | `VALIDATION_TITLE_REQUIRED`(이름 1~30자) → 인라인 |
| ScheduleDetailScreen | 진입 | `ScheduleService.getById(scheduleId)` (위조 방지 재조회) | — | `NOT_FOUND_SCHEDULE`/null → 목록으로 |
| ScheduleDetailScreen | `headerRight`「편집」 | 없음 — `navigate('ScheduleEditor', { scheduleId })` | — | — (F-03) |
| ScheduleDetailScreen | 삭제 / 되돌리기 | `softDelete(id)` → 스낵바 "실행취소"(N-3 제안 5분/세션) → `restore(id)` | `list`·`dashboard` invalidate(AC-10) | — |
| SearchScreen | 검색어(디바운스 250ms), 필터 | `SearchService.search({query, filter, limit:50, cursor})` | `search` 슬라이스; `q.length<2`면 "짧은 검색어" 배지(P-11, E-11-2) | 빈 결과 안내(E-11-1) |
| SettingsScreen | 토글/선택 | `SettingService.set(key, json)` — `theme.mode/accent/fontScale`, `notif.showTitle`(P-10-1), `calendar.pushEnabled`(D-02), `calendar.conflictPolicy`(P-08-2) | 즉시 `settings` 반영 + 테마 적용(AC-17) | 저장 실패 → 이전 값 |
| SettingsScreen | 계정 연동/해제 | `AuthService.link()` / `unlink()` | `account` 슬라이스; unlink 후에도 로컬 데이터 유지 확인(AC-21) | `GATEWAY_AUTH_*` → 재시도/무해 안내(E-12-1) |
| SettingsScreen | 캘린더 연동 | `CalendarGateway.requestPermission` → 허용 시 `CalendarSyncService.pull(range)` | 진행률 이벤트 표시(E-14-4) | `PERMISSION_CALENDAR_DENIED` → 기능 비활성 안내(E-14-1) |
| PermissionsScreen(온보딩) | 버튼 | `NotificationGateway.requestPermission()`, (선택) `CalendarGateway.requestPermission()` | `settings` 권한 상태 | 거부해도 진행(7.1), 이후 배너로 재요청 유도(E-08-1/AC-07) |

- **상태 스토어(Zustand)**: 슬라이스 = `dashboard | list | search | categories | settings | account`. 서비스 호출은 화면/훅에서 하고 스토어에는 결과 스냅샷만 둔다(서비스는 상태 비보유 — DashboardService 등과 일치). `invalidate(slice)` = 다음 포커스 시 재조회 플래그.

### 16.3.1 일정 편집 화면 폼 (F-01 / F-03, AC-01~03) — v1.4

- **목적**: `ScheduleEditorScreen` 을 F-01 입력 집합까지 확장하고 도달 경로를 연결한다. 코어 서비스·검증은 **재구현하지 않고** 그대로 호출한다.
- **모드 판별**: `route.params?.scheduleId` — 없으면 신규(`ScheduleService.create`), 있으면 수정(`ScheduleService.update`). 수정 모드는 마운트 시 `ScheduleService.getById(id)` 로 프리필, `null` 이면 안내 후 `goBack`.
- **필드 매핑** (검증은 코어 `assertValidScheduleInput` / 서비스가 수행 — 화면은 오류를 **표시만**):

| 필드 | 입력 UI | 서비스 입력 키 | 코어 검증(오류 코드) | 인라인 `field` | 기본값 / 비고 |
| --- | --- | --- | --- | --- | --- |
| 제목 | 단일 행 `TextInput` | `title` | `VALIDATION_TITLE_REQUIRED`(빈값·공백만, AC-02), `VALIDATION_TITLE_TOO_LONG`(>200) | `title` | 필수 |
| 시작 일시 | 날짜 `YYYY-MM-DD` + 시각 `HH:mm` 텍스트 + 증감 버튼 → UI가 `Clock.timeZone()` 로 epoch ms 변환 | `startAt` | `VALIDATION_START_REQUIRED`(미입력·파싱 실패, AC-02) | `startAt` | 필수. 기본 표시값은 임의 시드(예: 다음 정시) 허용 |
| 종료 일시 | 시작과 동일 형식, 비우면 `null` | `endAt` | `VALIDATION_END_BEFORE_START`(endAt<startAt, AC-03), `VALIDATION_END_INVALID` | `endAt` | 선택 |
| 유형(카테고리) | 피커 — 옵션 = `CategoryService.list()` (마운트 1회, `categories` 캐시) | `categoryId` | 없음 — 미지정/미존재 시 코어가 시스템 기본("기타")으로 대체(E-06-1) | — | 선택. "유형 추가" = `CategoryService.create(name)` |
| 우선순위 | 3-세그먼트 `HIGH / NORMAL / LOW` (D-04) | `priority` | 없음 — 미지정 시 코어 기본 `NORMAL`(E-07-1) | — | 기본 선택 표시 `NORMAL` |
| 메모 | 멀티라인 `TextInput` | `memo` | `VALIDATION_MEMO_TOO_LONG`(>5000) | `memo` | 선택. 비우면 `null` |
| 반복 | rule 세그먼트 `없음 / DAILY / WEEKLY / MONTHLY / YEARLY` + 종료조건 `없음 \| 종료일(date) \| 횟수(number)` | `recurrence` (`{ rule, endAt?, count? }` 또는 `null`) | `VALIDATION_RECURRENCE_RULE_INVALID`, `VALIDATION_RECURRENCE_CONFLICT`(endAt·count 동시), `VALIDATION_RECURRENCE_COUNT_INVALID`(≤0) | `recurrence` | **신규 생성 경로만**. "없음" → `null`/미전송. 범위 = P-01 단순 반복 |
| 사전 알림 오프셋 | (이번 사이클 전용 UI 없음) | `reminderOffsets` / `notifyAtStart` | `VALIDATION_REMINDER_LIMIT`(>5, P-10) | `reminderOffsets` | 신규: 기존 기본 `[10]` + `notifyAtStart:true` 유지. 수정: 미전송 → 기존 유지. 프리셋 다중선택 UI는 후속 |

- **검증·오류 표시 규약**: 저장 클릭 → `create`/`update` 호출 → `ValidationError`(또는 `AppError`) catch → `err.field` 로 해당 입력 하단 문구, `field` 없으면 폼 상단. `ValidationError.errors[]` 가 다건이면 첫 건만 쓰지 말고 각 `field` 별로 표시. 실패해도 입력값 폐기 금지(§0.2). 저장 이전 실패는 저장소 변경 없음.
- **저장 성공 후**: `invalidate('list', 'dashboard', 'search', 'categories')` → `navigation.goBack()`. (기존 스켈레톤·`src/app/state/bindings.ts` 와 동일한 4-슬라이스 집합.)
- **수정 모드의 반복**: `recurrence` 는 읽기 전용 표시. `update` 호출 시 `recurrence` 를 **미전송**하면 코어가 기존 규칙을 보존한다(`scheduleService.update` 의 `input.recurrence === undefined` 분기). 개별 회차의 "이 일정만 / 이후 모두"(P-02)는 이번 사이클 범위 밖 — 가상 회차는 자체 id가 없어 편집 진입이 성립하지 않고, 코어 `update` 는 베이스 행만 수정한다(§5). 후속 N-10.

#### 날짜/시간 입력 방식 결정 (이번 사이클)

- RN 코어에는 date/time 입력 컴포넌트가 없다. 표준 선택지 `@react-native-community/datetimepicker` 는 신규 CocoaPods 의존 + 네이티브 재빌드를 유발하며, 현재 빌드 호스트 여유 공간(약 1.8 GiB)이 `ios/build`(약 2.8 GB) 재생성에 부족하다(직전 파이프라인 종료가 디스크 고갈로 BLOCKED). → **이번 사이클에는 신규 네이티브 의존성을 도입하지 않는다.**
- 대신 `YYYY-MM-DD` / `HH:mm` 구조화 텍스트 입력 + 증감 버튼으로 받고, UI 계층에서 `Clock.timeZone()` 기준으로 epoch ms(P-16)로 변환한다. 변환은 순수 함수로 분리 — 권장 위치 `src/core/domain/time.ts` 의 신규 export `localWallToEpoch(year, month, day, hour, minute, tz): number` (기존 `timeZoneOffsetMs` DST 보정 재사용). 포트 인터페이스·기존 시그니처 무변경. UI 유틸에 두어도 무방하나 tz/DST 로직 중복을 피한다.
- AC-01~03 은 네이티브 스피너/캘린더 오버레이를 요구하지 않는다 — 시작 일시를 사람이 읽는 형식으로 입력하고, 검증(AC-02/03)되고, 저장·재조회 왕복(AC-01)되면 충족된다.
- **후속(N-10)**: 디스크 여유 확보 후 동일 UI 계약(내부 상태 `startAt: number`) 뒤에서 `@react-native-community/datetimepicker`(pin `8.x`)로 교체 가능 — 코어/로직/DB 변경 없음.

#### 화면 진입점 구현 노트

- `DashboardScreen` / `CalendarScreen` / `ScheduleDetailScreen` 은 `@react-navigation/native` 의 `useNavigation()`(이미 의존성 포함)으로 navigate 함수를 얻고 `navigation.setOptions({ headerRight })`(또는 `Tab.Screen`/`Stack.Screen` `options`)로 「+」/「편집」 버튼을 노출한다. Tab 화면의 헤더는 `Tab.Navigator`(이미 `headerShown: true`)에 렌더되며 `navigate('ScheduleEditor')` 는 부모 `RootStack` 으로 버블링된다.
- `DashboardScreen` 빈 상태 브랜치에 「일정 추가」버튼을 추가한다(AC-15 · E-10-1 — 동일한 navigate 호출).

#### 16.3.2 대시보드 헤더 로고·태그라인 (F-16, AC-25) — v1.5

- **목적**: 대시보드 진입 시 앱 아이덴티티를 표시한다(F-16, 7.1, AC-25).
- **에셋 경로 (P-21)**:
  - 로고: `src/assets/icons/logo.png` → `require('../../assets/icons/logo.png')`
  - 태그라인: `src/assets/images/tagline.png` → `require('../../assets/images/tagline.png')`
- **배치**: `DashboardScreen`의 `ScrollView` 최상단에 로고 → 태그라인 순서로 수직 배치. 대시보드 집계 영역보다 위.
- **크기 제한 (P-20)**: 이미지 너비는 화면 폭의 60% 이하. `useWindowDimensions().width * 0.6`으로 계산하고 `resizeMode='contain'`으로 비율 유지.
- **렌더링**:
  ```text
  <View style={{ alignItems: 'center', paddingTop: 16 }}>
    <Image source={require('logo')} style={{ width: screenWidth*0.6, height: auto, resizeMode:'contain' }} onError={onLogoError} />
    <Image source={require('tagline')} style={{ width: screenWidth*0.6, height: auto, resizeMode:'contain', marginTop: 8 }} onError={onTaglineError} />
  </View>
  ```
- **에셋 로드 실패 처리 (E-16-1, AC-28)**: 각 `<Image>`에 `onError` 콜백 설정. 실패 시 해당 이미지를 숨기거나(opacity: 0) 텍스트 대체("오늘뭐해" / "tagline text")를 렌더한다. 실패가 앱 크래시로 이어지지 않아야 한다.
- **서비스 호출 없음**: 로고·태그라인 렌더는 순수 UI — 서비스·상태 슬라이스에 영향 없음.
- **다크 테마 (E-16-2)**: 원본 PNG 그대로. tintColor 미적용. 이번 범위 외 별도 다크 에셋 없음.

### 16.4 앱 라이프사이클 → 부트스트랩 (logic §12의 RN 실체화)

```text
index.js: AppRegistry.registerComponent(App)
App.tsx mount:
  bootstrapSequence.run():
    1) OpSqliteDb.open({ name:'todaywhat.db', encryptionKey?: Keychain.get('db.key') })
         PRAGMA foreign_keys=ON; journal_mode=WAL; synchronous=NORMAL
    2) runMigrations(db, MIGRATIONS)   # 001_init (database.md 6장)
         failedAt 있으면 → SafeMode 렌더, 종료 (E-15-1, STORAGE_MIGRATION_FAILED)
    3) app = composeNative(db)          # 16.1
    4) settings = app.settings.getAll() → ThemeStore 초기화 (AC-17)
    5) 첫 화면 렌더 (대시보드)
  렌더 후 (InteractionManager.runAfterInteractions):
    6) app.scheduler.sync()            # 전체 재예약 (P-09, AC-08)
    7) app.auth.ensureFreshToken()     # 연동 상태면. 실패해도 로컬 진행 (E-12-2)
    8) getInitialNotification() 처리 → 있으면 ScheduleDetail (16.2)

AppState 'background'→'active':
  app.scheduler.sync()  (throttle: 마지막 sync 후 최소 30s)
  DashboardScreen 포커스면 getSummary 재호출 (자정 경과 반영, AC-16)

Android BOOT_COMPLETED broadcast:
  Notifee headless JS → 최소 조립(db open + migrate + scheduler) → scheduler.sync() → 종료
  (ReminderRepository.resetScheduledToPending 후 재예약, P-09)
```

- **동시성**: `bootstrapSequence.run()`은 1회만(모듈 스코프 Promise 캐시). `scheduler.sync()`는 코어가 이미 재진입 뮤텍스 보유(logic 6장) — 셸은 throttle만 추가.

### 16.5 네이티브 어댑터 계약 (포트별)

각 어댑터는 `src/core/ports`의 인터페이스를 **그대로** 구현한다. 아래는 매핑·오류 변환·주의점.

| 포트 | 라이브러리 매핑 | 오류 → `ErrorCodes` 변환 | 주의 |
| --- | --- | --- | --- |
| `UnitOfWork.transaction` | op-sqlite `db.transaction(tx => …)` (BEGIN IMMEDIATE) | 예외 전파 → 서비스가 `STORAGE_TX_FAILED` | 콜백 throw 시 op-sqlite 자동 롤백. 중첩은 코어처럼 바깥에 합류(savepoint 불필요 — 서비스가 단일 TX) |
| `MigrationDb` | `getUserVersion`=`PRAGMA user_version` 조회, `setUserVersion`=`PRAGMA user_version=N`(문자열 보간 불가 → 정수 검증 후), `exec`=`db.execute`(다중 문장은 `sqlSplit.ts` 로 분해), `transaction`=위와 동일 | 실패 → `runMigrations`가 `failedAt` 반환 | `PRAGMA`는 파라미터 바인딩 불가 → `Number.isInteger` 강제 후 리터럴. **op-sqlite 9.x**: `execute()`는 `Promise<QueryResult>`, 결과 행은 `res.rows`(평면 배열; 6.x의 `rows._array` 제거) → `getUserVersion`은 `res.rows?.[0]?.user_version`. **파라미터 바인딩 정책은 유효**: 마이그레이션 SQL 에 바인딩 값이 필요하면 위치 `?` 또는 `SqliteDb` shim 을 통한 named(`:name`)를 쓴다(§13.3, RENDER-003). 마이그레이션 001 은 바인딩 파라미터가 0개라 이 경로 영향 없음 |
| `ScheduleRepository` 등 6종 | prepared statement + named params. `findInRange`/`search`는 database.md 4장 인덱스 사용. keyset cursor = base64(`start_at,id`) | 읽기 실패 → `STORAGE_READ_FAILED`; stale write → `STORAGE_STALE_WRITE` | **모든 SQL 파라미터 바인딩**(13.3). 동적 식별자 금지. `search` FTS 질의는 phrase 이스케이프(13.3), 2자 미만은 서비스가 `mode='like'`로 넘김. **op-sqlite 9.x**: 행 접근은 `res.rows`(평면 배열, `?? []`), `insertId`/`rowsAffected`는 6.x와 동일. **op-sqlite 9.x named 파라미터 미지원(RENDER-003)**: 9.x `execute(sql, params)` 는 위치 기반 배열 전용이며 named 파라미터(`:name`/`$name`/`@name`)를 어떤 API 로도 바인딩하지 못한다(객체 전달 시 내부 `params.map` 호출 → `TypeError: params?.map is not a function`, 네이티브 바인더도 위치 인덱스 `ii+1` 전용). 리포지토리 SQL 은 가독성·재사용 파라미터(`(:x IS NULL OR ...)`, `:now` 다회 사용) 안전성을 위해 named 바인딩을 **유지**하고, `SqliteDb` 어댑터(`OpSqliteDb.native.ts`)가 `all()`/`run()` 실행 직전에 **named→positional 변환 shim** 을 적용한다. shim 규칙: (1) `sqlSplit.ts` 의 문자열/주석 스킵 로직을 재사용해 문자열 리터럴·주석 안의 `:` 는 플레이스홀더로 보지 않는다, (2) 플레이스홀더 이름을 등장 순서로 수집하되 같은 이름은 **SQLite 슬롯 규칙대로 슬롯 1개로 dedup**(최초 등장 순서), (3) 각 `:name` 을 `?` 로 치환하고 값 객체를 dedup 된 이름 순서의 유니크 위치 배열로 정렬해 `execute(sql, values[])` 호출. named 파라미터 규약 자체는 폐기하지 않는다 |
| `NotificationGateway` | `requestPermission`→`notifee.requestPermission()`; `schedule(req)`→`notifee.createTriggerNotification({id:req.id}, {type:TIMESTAMP, timestamp:req.at})` 반환 id; `cancel`→`cancelNotification(id)`; `cancelAll`→`cancelAllNotifications()` | 권한 거부 → 코어가 `PERMISSION_NOTIFICATION_DENIED`(E-08-1); 예약 실패는 개별 무시 후 다음 sync(logic 6장) | `req.id`가 결정적이므로 재예약 멱등. Android 채널 생성 1회. `req.data`는 `{scheduleId}` 정수만 |
| `CalendarGateway` | `RNCalendarEvents.requestPermissions/checkPermissions`, `findCalendars`, `fetchAllEvents(from,to,calendarIds)`, `saveEvent`, `removeEvent` | 권한 거부 → `PERMISSION_CALENDAR_DENIED`(E-14-1); 호출 실패 → `GATEWAY_CALENDAR_UNAVAILABLE` | 외부 이벤트 필드 정제: `title`≤200, `notes`≤5000 트렁케이트, 제어문자 제거(13.3) — 어댑터 책임 |
| `AuthGateway` | `authorize`→`appAuth.authorize(config)` (Auth Code + PKCE S256, 시스템 브라우저); `refresh`→`appAuth.refresh`; `revoke`→`appAuth.revoke` best-effort. 반환을 `TokenSet`(accessToken/refreshToken/accessTokenExpiresAt/provider/subject/displayName)로 매핑 | 사용자 취소 → `GATEWAY_AUTH_CANCELLED`; 그 외 → `GATEWAY_AUTH_FAILED`(E-12) | `client_secret` **미사용**(public client, 13.5). `id_token`의 `iss`/`aud` 앱에서도 확인. discovery URL·redirect scheme은 빌드 설정 주입 |
| `TokenStore` | `save`→`Keychain.setGenericPassword(ref, JSON, {accessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY, service: ref})`; `load`→`getGenericPassword({service:ref})`; `clear`→`resetGenericPassword({service:ref})` | 실패 → 로깅 후 `null`(로컬 모드 강등) | 토큰 값은 **DB에 절대 미기록**(V-14). `account_link.token_ref`만 저장 |
| `Clock` | `src/core/domain/clock.ts`의 `SystemClock` 재사용(`Date.now`, `Intl….timeZone`) | — | 추가 구현 없음 |
| `Logger` | `MaskingLogger`: `log(level,event,fields)` 전에 `title`/`memo`/`token`/`email`/`query` 키를 길이·해시프리픽스로 치환(nfr 5.1) | — | 릴리스 기본 레벨 `warn`. 링 버퍼(용량 제한) |
| 부팅 재예약 | Android: `notifee` + `BOOT_COMPLETED` receiver → headless; iOS: 앱 기동 시 `bootstrapSequence` 6)단계가 담당 | — | headless 경로는 UI 없이 `scheduler.sync()`만, 완료 후 즉시 종료 |

### 16.6 권한 흐름 (UI 상태)

```text
알림 권한:
  undetermined → 온보딩/최초 저장 시 requestPermission()
  granted      → 정상 예약
  denied       → 일정·reminder 행은 저장, 배너 "알림이 꺼져 있어요 · 설정 열기"(AC-07, E-08-1)
                 ReminderScheduler.sync() 는 warning 반환만, 도메인 영향 없음
캘린더 권한:
  denied       → 캘린더 연동 토글 비활성 + 안내, 앱 자체 일정은 정상(E-14-1)
```

### 16.7 셸 보안 노트 (13장 보완)

- **딥링크/알림 payload**: 스킴 화이트리스트(`todaywhat://`)만, payload는 `scheduleId` 정수만, 수신 시 `findById` 재조회 검증(13.3 재확인). `android:exported` 최소화, iOS URL scheme 충돌 점검.
- **비밀정보**: JS 번들·저장소에 `client_secret` 없음. `client_id`·discovery URL·redirect scheme은 빌드 환경 주입(리포지토리에 운영값 커밋 금지, 13.5).
- **WebView 미사용**: 모든 화면 `<Text>`/네이티브 컴포넌트 렌더 → HTML/JS 실행 표면 없음. OAuth는 시스템 브라우저(임베디드 WebView 금지).
- **로그**: 모든 화면·어댑터 로깅은 `MaskingLogger` 경유. 크래시 리포팅 미도입(N-2).
- **스크린샷 방지**(민감 화면): 미결정 N-6, 이번 셸에서는 미적용.
- **전송**: `usesCleartextTraffic=false`(Android), ATS 예외 없음(iOS) — 스캐폴드 설정에 반영.
- **일정 편집 입력(v1.4)**: 날짜/시각 텍스트 → 숫자 파싱 시 `Number.isInteger` 확인, `NaN`/`Infinity`/음수 거부 후 서비스 호출(심층 방어 — 코어 `assertValidScheduleInput` 도 `Number.isInteger(startAt)` 재검증, §13.3). 제목/메모는 코어 길이·제어문자 규칙(§13.3)에 위임하고 `<Text>` 렌더라 XSS 표면 없음. 신규 신뢰 경계·위협 없음.
- **에셋 경로 고정 (v1.5, P-21)**: 탭 아이콘·로고·태그라인 에셋 경로는 `src/assets/icons/`·`src/assets/images/`에 고정되며, 빌드 타임에 JS 번들에 포함된다. 런타임에 외부에서 경로를 변경하거나 주입하는 표면이 없으므로 에셋 경유 코드 실행 위협은 없다. 에셋 로드 실패는 UI 폴백으로 처리하며 예외가 크래시로 전파되지 않는다(E-16-1, AC-28).

### 16.8 셸 관점 미검증(환경 외 후속) 범위

overview "빌드 환경 제약과 파이프라인 검증 전략"(v1.2) 참조.

- **정식 검증(v1.2~)**: `ios/` `pod install` + `xcodebuild`(또는 `react-native run-ios`) 네이티브 빌드 성공, 시뮬레이터 앱 설치·실행·첫 화면(대시보드) 렌더. §16.1~16.4의 순수 로직과 §16.5 어댑터의 계약 준수(타입 + Fake 동치 테스트).
- **환경 외 후속(환경이 허용하지 않을 때만)**: `android/` Gradle 빌드, Metro 번들 프로덕션 최적화, 실제 온디바이스 알림 정확도(nfr 1.1)·`BOOT_COMPLETED` 실동작, 워치 타깃 연동.
