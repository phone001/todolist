# 비즈니스 로직 설계 — 일정관리 앱 "오늘뭐해"

| 항목 | 값 |
| --- | --- |
| 문서 종류 | 비즈니스 로직 설계 (Logic) |
| 버전 | v1.9 |
| 상태 | 작성 완료 |
| 근거 | `document/planner/plan.md` v1.4, `document/architect/overview.md` v1.9, `document/architect/database.md` v1.2 |

## 변경 이력

| 버전 | 일자 | 변경 내용 |
| --- | --- | --- |
| v1.9 | 2026-09-08 | 설계 델타(overview v1.9, plan v1.4 — F-19 애플워치(watchOS) 워치 타깃 착수, NFR-10 승격). **신규 §17 "애플워치 워치 동기화(F-19)"** — 17.1 타깃 구성·경계(네이티브 WatchKit + 공유 *계약*), 17.2 WatchConnectivity 어댑터 계약(전송 메커니즘 선택 근거: applicationContext/transferUserInfo/sendMessage / activation·reachability), 17.3 페이로드 빌더(`buildWatchSnapshot` 순수, 오늘 + 다음 1건, 필드 최소화 P-40, epoch ms + IANA tz P-39), 17.4 완료 토글 역전파(op 스키마·`WatchSyncService.applyIncomingToggle`·dedup 원장), 17.5 보류 큐·재시도(E-19-1, "동기화 대기" 배지 D-11), 17.6 LWW 충돌 해소(E-19-3/P-38 — `UPDATED_AT` 기준·잔여 부정확), 17.7 전역 알림 게이트와 워치 관계(P-41 — `ReminderScheduler` 접점, 워치 무예약), 17.8 컴플리케이션(D-10 **조건부 설계 섹션**), 17.9 예외 매핑(E-19-1~7), 17.10 AC 매핑(AC-23·47~56). **신규 §13.9 "워치 동기화(WatchConnectivity) 보안"** + §13.1 신뢰 경계·§13.7 감사 로그·§13.8 위협표 행 추가. **§0.1 포트 목록**에 `WatchSyncGateway` 추가. §0.2 오류 코드에 `GATEWAY_WATCH_UNAVAILABLE`. §14 일관성 표·§15 미결정(D-09/D-10/D-11/N-11/N-12) 갱신. **DB 스키마·`ScheduleService`/`DashboardService`/`ReminderScheduler`/`CategoryService`/`SettingService` 로직·기존 셸 화면·`bindings.ts` `SCREEN_BINDINGS` 무변경** — 신규 순수 모듈(`src/core/watchSync/**`) + `WatchSyncService` + iOS 어댑터만 추가. 「API 설계」 섹션 미신설(WatchConnectivity 는 OS 프레임워크 IPC, 외부 API 아님) |
| v1.8 | 2026-09-07 | 설계 델타(overview v1.8, plan v1.3 재설계분 정식화 — F-06 유형 관리 / F-10 상호작용형 대시보드 / F-18 앱 설정). **§5.1 신설** "CategoryService 유형 관리 계약(F-06, P-34, AC-39~41)" — `rename` 계약(기본 유형 보호·중복 이름 검증), `create` 중복 검증, ID 참조 기반 rename 전파. **§6 개정** — `syncOnce()` 앞단에 전역 알림 게이트(`settings.notificationsEnabled()` false 면 예약 억제·기존 SCHEDULED 취소), 신규 `applyGlobalNotificationsToggle(enabled)`(D-07 (a) 일괄 취소 / on 복귀 무회귀). **§7 개정** — 대시보드 데이터 소스 = `DashboardService.getSummary`(요약 표시요소) + `ScheduleService.findInRange`(오늘 목록 행) 병행 확정(T-02). **§10 개정** — 설정 키 표에 `notif.enabled`·`schedule.defaultPriority`·`schedule.defaultCategoryId` 정식 편입 + `newScheduleDefaults()` 헬퍼. **§16.3 표 개정** + **§16.3.3 신설**(상호작용형 대시보드 레이아웃·브랜드/요약/목록/FAB — T-01/T-06), **§16.3.4 신설**(유형 관리 화면), **§16.3.5 신설**(목록 조회 페이지네이션 설계값 — T-05), **§16.3.6 신설**(설정 화면 F-18). **§16.10 신설**(SwipeableRow 공통 컴포넌트 — 신규 의존성 없음). **§16.11 신설**(표시 계층 시각도 Clock 포트 경유 — T-04). §0.2 오류 코드에 `VALIDATION_CATEGORY_NAME_REQUIRED`/`VALIDATION_CATEGORY_NAME_DUPLICATE`/`POLICY_SYSTEM_CATEGORY_RENAME` 추가. §14 일관성 표·§15 미결정(D-07/D-08) 갱신. **DB 스키마·포트 시그니처·보안 위협 모델 무변경** |
| v1.7 | 2026-09-07 | 설계 델타(overview v1.7, F-17 브랜드 오리 로딩 인디케이터). **신규 §16.9** "브랜드 로딩 인디케이터(F-17)" — 렌더 수단 결정(§16.9.1 A/B/C/D 비교 → `react-native-svg` 15.x + RN `Animated`), 컴포넌트 배치·props 계약(§16.9.2), 표시 상태 순수 FSM·임계값(§16.9.3), 활동 순환(§16.9.4), 3단계 폴백 체인(§16.9.5), 저사양·절전 강등(§16.9.6), 접근성(§16.9.7), 소비 지점(§16.9.8), 리소스 해제(§16.9.9), AC 매핑(§16.9.10). §16.7 셸 보안 노트에 SVG 렌더 표면 1항 추가. §14 일관성 표·§15 미결정(D-06) 갱신. **처리 흐름(1~13장)·DB 스키마·보안 위협 모델·포트 계약·`bindings.ts` 무변경** — 순수 프레젠테이션 UI 계층 추가 |
| v1.0 | 2026-09-04 | 최초 작성. 8개 서비스 처리 흐름 + 외부 연동 API 설계 + 보안 설계 |
| v1.1 | 2026-09-04 | §16 "클라이언트 셸 처리 흐름(RN App Shell)" 추가 — 조립 지점 리팩터, 네비게이션 그래프·딥링크, 화면↔서비스 바인딩, 앱 라이프사이클 부트스트랩, 네이티브 어댑터 계약, 셸 보안 노트. §14 일관성 점검·§15 미결정 갱신. 서비스 로직(1~13장)은 무변경 |
| v1.2 | 2026-09-04 | Bug Fix 동반 개정(overview v1.2). §16.5 `MigrationDb`·`ScheduleRepository` 행 주의에 op-sqlite 9.x `QueryResult.rows` 평면 배열(6.x `_array` 제거)·`execute()` Promise 반환 명시. §16.8 iOS 네이티브 빌드·시뮬레이터 실행을 "정식 검증"으로 이동(환경에 Xcode 26.2/CocoaPods 도입). §13.6 서드파티 버전 정책에 op-sqlite 9.x 핀 근거 주석. 처리 흐름·SQL·보안 설계 무변경 |
| v1.3 | 2026-09-04 | Bug Fix 동반 개정(overview v1.3, RENDER-003). op-sqlite 9.x 가 named 파라미터(`:name`/`$name`/`@name`)를 어떤 API 로도 지원하지 않음(positional `?` 배열 전용, 객체 전달 시 `TypeError: params?.map is not a function`)을 반영. §16.5 `ScheduleRepository` 등 6종 행에 "named 바인딩 유지 + `SqliteDb` 어댑터의 named→positional 변환 shim" 구현 노트 추가, `MigrationDb` 행에 바인딩 정책(`?` 또는 shim 경유 named) 명확화. §13.3 SQL Injection 항목에 shim 규칙 반영. §16.1 에 `SafeModeScreen` 사유 구분(`failedAt < 0` 부트스트랩 예외 vs 실제 마이그레이션 실패) 구현 권고 추가. §14 일관성 표 갱신. 포트 계약(`UnitOfWork`/`MigrationDb`/`Repository` 시그니처) 무변경 — shim 은 어댑터 내부 구현. 처리 흐름·DB 스키마·보안 위협 모델 무변경 |
| v1.6 | 2026-09-06 | 설계 델타(overview v1.6, N-10 해소 — 날짜/시각 네이티브 DateTimePicker 도입). §16.3.1 필드 매핑 표 `시작 일시`·`종료 일시` 행 교체: 텍스트 입력 → `DateTimePickerModal` (mode='date'+'time' 2단계, iOS inline/Android dialog). 「날짜/시간 입력 방식 결정」 섹션 전면 개정: `@react-native-community/datetimepicker` 8.6.0 pin, iOS/Android UX 차이, `localWallToEpoch` 폐지 방향, epoch 직접 추출 방식, E-01-2 기본값 정책. §16.7 보안 노트 갱신(DateTimePicker OS 위임 신뢰 경계). §14 일관성 표 갱신. N-10 (1) 해소. 포트 계약(ScheduleService.create/update, startAt:number 계약) 무변경. 처리 흐름(1~13장)·DB 스키마·보안 위협 모델 무변경 |
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
| `WatchSyncGateway` (신규 v1.9, F-19) | 폰↔워치 채널(iOS WatchConnectivity; Android no-op) | `isSupported(): boolean`, `activate(): Promise<void>`, `sendSnapshot(snapshot): Promise<void>` (updateApplicationContext + 도달 시 sendMessage), `onIncomingToggle(cb: (op: WatchToggleOp) => void): void`, `ack(opId, result): Promise<void>` |
| `Logger` | 구조적 로그(마스킹 적용) | `info`, `warn`, `error`, `metric` |

- 모든 서비스는 포트에만 의존하고 구체 어댑터는 조립 지점(app bootstrap)에서 주입한다.
- 시각 파라미터는 전부 epoch ms(정수). 표시 포맷은 UI 계층 책임.

### 0.2 공통 오류 코드 체계

| 코드 접두어 | 의미 | 예 |
| --- | --- | --- |
| `VALIDATION_*` | 입력 검증 실패(저장 전, 데이터 변경 없음) | `VALIDATION_TITLE_REQUIRED`, `VALIDATION_END_BEFORE_START`, `VALIDATION_REMINDER_LIMIT`, `VALIDATION_CATEGORY_NAME_REQUIRED`(E-06-3), `VALIDATION_CATEGORY_NAME_DUPLICATE`(E-06-4) |
| `POLICY_*` | 정책 위반 | `POLICY_SYSTEM_CATEGORY_DELETE`(E-06-5 삭제), `POLICY_SYSTEM_CATEGORY_RENAME`(E-06-5 이름변경, P-34) |
| `NOT_FOUND_*` | 대상 없음 | `NOT_FOUND_SCHEDULE` |
| `PERMISSION_*` | OS 권한 거부(기능 비활성, 도메인 영향 없음) | `PERMISSION_NOTIFICATION_DENIED`, `PERMISSION_CALENDAR_DENIED` |
| `GATEWAY_*` | 외부 연동 실패(격리, 재시도 안내) | `GATEWAY_AUTH_FAILED`, `GATEWAY_CALENDAR_UNAVAILABLE`, `GATEWAY_WATCH_UNAVAILABLE`(F-19 — 워치 채널 비활성/미도달, 폰 기능 무영향) |
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
- **CategoryService.remove(id)**: `is_system=1`이면 `POLICY_SYSTEM_CATEGORY_DELETE` (E-06-2 방어). 사용 중이면 TX{ `schedule.category_id`를 기본 카테고리로 UPDATE ; `category` DELETE }. (이미 구현됨 — `categoryService.ts` `remove`.)
- 반복 일정: `recurrence_parent_id`로 가상 회차 확장은 조회 시점에 `RecurrenceExpander`(순수 함수)가 범위 내 발생만 계산해 병합. 개별 회차 수정 시 "이 일정만" → 예외 인스턴스 행 생성(`recurrence_parent_id` 설정), "이후 모두" → 원본 `recurrence_end_at` 조정 + 새 규칙 행(P-02).

---

## 5.1 CategoryService 유형 관리 계약 (F-06, P-34, AC-39~41) — v1.8

전용 "유형 관리" 화면(`CategoryManagerScreen`, §16.3.4)이 호출하는 계약. 일정→유형은 **`SCHEDULE.CATEGORY_ID` FK(ID 참조)** 이므로 이름변경은 참조를 그대로 두고 `CATEGORY.NAME` 만 바꾼다 → 그 유형을 쓰는 모든 일정의 표시 라벨이 재조회 시 자동 갱신(AC-39). 색상·아이콘 사용자 편집은 범위 밖(D-08).

### 이름 정규화 규칙 (P-34)

- `norm(name) = name.trim()` 저장. 표시·검증 모두 트림된 값 기준.
- 유일성 비교 = `a.trim().toLowerCase() === b.trim().toLowerCase()` (앞뒤 공백 제거 + 대소문자 무시). 한국어는 대소문자 개념이 없어 실질적으로 트림 + ASCII 케이스 폴딩. DB `category.name UNIQUE` 는 바이너리 백스톱(스키마 무변경 — `database.md` §9).
- 길이 1..30 (기존 `create` 규칙 유지).

### `create(name)` (E-06-3, E-06-4)

1. `trimmed = name.trim()`. `trimmed.length === 0` → `VALIDATION_CATEGORY_NAME_REQUIRED` (field `name`).
2. `trimmed.length > 30` → `VALIDATION_TITLE_TOO_LONG` (field `name`).
3. `list()` 조회 → `norm` 비교로 중복 존재 → `VALIDATION_CATEGORY_NAME_DUPLICATE` (field `name`).
4. `categories.insert({ name: trimmed, color: 기본, icon: null, isSystem: false, sortOrder: 0, createdAt/updatedAt: now })`.

> 현재 코어 `categoryService.create` 는 1·2만 검증하고 `VALIDATION_TITLE_REQUIRED` 를 재사용한다. v1.8에서 3(중복) 추가 + 오류 코드를 카테고리 전용으로 교체.

### `rename(id, name)` (E-06-3, E-06-4, E-06-5, AC-39, AC-40)

1. `categories.findById(id)` → 없으면 `NOT_FOUND_CATEGORY`.
2. `category.isSystem === true` → `POLICY_SYSTEM_CATEGORY_RENAME` (P-34, E-06-5). UI 는 해당 컨트롤을 비활성화하지만 서비스도 방어한다.
3. `trimmed = name.trim()`; 길이 0 → `VALIDATION_CATEGORY_NAME_REQUIRED`; 길이 > 30 → `VALIDATION_TITLE_TOO_LONG`.
4. `list()` 에서 **자기 자신을 제외**하고 `norm` 중복 → `VALIDATION_CATEGORY_NAME_DUPLICATE`.
5. `categories.rename(id, trimmed, now)` (포트 이미 존재).
6. 후속: 호출 화면이 `invalidate('categories', 'list', 'dashboard')` → 목록·대시보드·검색 라벨 재조회로 즉시 반영(AC-39). 별도 마이그레이션·일정 행 UPDATE 없음(참조 유지).

> 현재 코어 `categoryService.rename` 은 `categories.rename` 로 그대로 위임한다. v1.8에서 1~4 검증을 추가.

### `remove(id)` (E-06-2, E-06-6)

- 변경 없음(§5). `isSystem` → `POLICY_SYSTEM_CATEGORY_DELETE`. 사용 중이면 TX{ `reassignCategory(id, systemDefaultId)` ; `categories.remove(id)` } — 삭제 실패 시 재지정도 롤백(E-06-6, V-17).

### 신규 오류 코드

| 코드 | 의미 | 대응 |
| --- | --- | --- |
| `VALIDATION_CATEGORY_NAME_REQUIRED` | 유형 이름이 빈 값/공백만 | E-06-3 — 저장 불가, `name` 인라인 |
| `VALIDATION_CATEGORY_NAME_DUPLICATE` | 정규화 비교 시 기존 유형과 중복 | E-06-4 — 저장 불가, `name` 인라인 |
| `POLICY_SYSTEM_CATEGORY_RENAME` | 기본 유형("기타") 이름변경 시도 | E-06-5 / P-34 — 거부, 안내 |

---

## 6. ReminderScheduler (F-08, F-09, P-03, P-09, P-32, AC-05, AC-06, AC-08, AC-42)

### 처리 흐름
- **목적**: 논리 예약(REMINDER 행)을 OS 예약과 일치시킨다.
- **트리거 시점**: 일정 생성/수정/삭제 후, 앱 콜드 스타트, 기기 부팅 완료(Android BootReceiver / iOS 앱 기동), 명시적 새로고침.
- **입력**: `scheduleId?`(없으면 전체), `horizonDays`(기본 60 — OS 동시 예약 상한 대비).

```text
sync():
  now = Clock.now()

  # --- 전역 알림 게이트 (P-32, F-18, AC-42) ---------------------------------
  if not SettingService.notificationsEnabled():          # 기본 true
      due = ReminderRepository.findDue(now, horizon, scheduleId?)
      for r in due where r.state == 'SCHEDULED' and r.os_request_id:
          NotificationGateway.cancel(r.os_request_id)
          markState(r, 'CANCELLED')                      # replaceForSchedule 전까지 비활성
      return { scheduled: 0, skipped: 0, suppressed: n } # 신규 예약 없음
  # -----------------------------------------------------------------------

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

### 전역 알림 사용 토글 (F-18, P-32, D-07, AC-42) — v1.8

- **게이트 지점 = `syncOnce()` 단일 지점** (위 의사코드). 모든 예약 경로가 여기로 수렴한다: `ScheduleService.create/update/restore` → `syncRemindersSafely` → `sync(id)`, 콜드 스타트 부트스트랩(§12/§16.4), `AppState 'active'`, Android `BOOT_COMPLETED`. 따라서 `notif.enabled=false` 동안에는 어떤 경로로도 OS 예약이 생기지 않는다(F-08 E-08-5, F-09).
- **개별 일정 저장/수정 시(off 상태)**: `ScheduleService.create/update` 는 REMINDER 행을 평소대로 기록한다(P-32 — 일정의 알림 설정값은 보존, 예약 실행만 억제). 이어지는 `sync(id)` 가 게이트에 걸려 해당 행을 `CANCELLED` 로 두거나 그대로 둔다(신규 행은 PENDING 이며 게이트가 예약을 건너뜀).
- **off 전환 시 일괄 취소 — 신규 메서드**:

  ```text
  ReminderScheduler.applyGlobalNotificationsToggle(enabled: boolean):
    if enabled == false:                                   # D-07 (a)
      now = Clock.now()
      active = ReminderRepository.findDue(now, Number.MAX_SAFE_INTEGER - now)  # PENDING/SCHEDULED 전부
      for r in active:
        if r.state == 'SCHEDULED' and r.os_request_id: NotificationGateway.cancel(r.os_request_id)
        markState(r, 'CANCELLED')
      Logger.metric('reminder.globalDisable.cancelled', active.length)
    else:                                                  # on 복귀
      # 회귀(기존 전체 일정 자동 일괄 재예약) 없음 — D-07 (a), OI-9.
      # 이후 저장·수정되는 일정부터 replaceForSchedule → syncOnce 가 재생성한다.
      no-op (로그만)
  ```

  - `findDue` 를 최대 horizon 으로 재사용하므로 **`ReminderRepository` 포트 시그니처 무변경**.
  - `CANCELLED` 는 `REMINDER.STATE` CHECK 제약에 **이미 존재**(`database.md` 3.3). `findDue` 는 PENDING/SCHEDULED 만 반환하므로 CANCELLED 행은 다음 `sync()`·`resetScheduledToPending`(P-09) 에서 되살아나지 않는다 → on 복귀만으로 재예약되지 않음(D-07).
  - on 복귀 후 그 일정을 수정하면 `ScheduleService.update` 의 `replaceForSchedule` 가 기존 행(취소 포함)을 지우고 새 PENDING 행을 만들어 `sync(id)` 가 정상 예약한다(AC-42 후반).
- **SettingsScreen 호출 순서(§16.3.6)**: `SettingService.set('notif.enabled', v)` → `ReminderScheduler.applyGlobalNotificationsToggle(v)`. 저장 실패 시 이전 값 롤백(E-18-3), 토글 미적용.
- **권한 거부 + on(E-18-1)**: 설정값은 `true` 로 저장되고, 실제 예약은 `syncOnce()` 의 기존 권한 분기(`PERMISSION_NOTIFICATION_DENIED` 경고)로 처리. 권한 허용 시 이후 저장·수정 건부터 동작.

### 예외
- 방해 금지/포커스 모드: OS 정책에 위임, 앱은 우회하지 않음(E-08-4).
- 오프셋 시각 과거: `SKIPPED` (E-08-2).
- 전역 알림 off(P-32): 예약하지 않음. 일정의 알림 설정값은 보존(E-08-5). 기존 SCHEDULED 는 `CANCELLED`.

---

## 7. DashboardService (F-10, AC-04, AC-15, AC-16, AC-44, AC-46, P-07, P-35)

### 데이터 소스 정합화 (v1.8, T-02)

상호작용형 대시보드(F-10, §16.3.3)는 **두 경로**를 병행한다. 재설계 코드가 요약 표시요소까지 `findInRange` 파생 계산으로 바꾼 것을 되돌린다.

| 영역 | 소스 | 이유 |
| --- | --- | --- |
| 요약 표시요소(총계·완료·미완료·완료율·유형별 분포·다음 예정) | **`DashboardService.getSummary(dateTs?)`** | 단일 집계 쿼리(`findForDashboard` + `GROUP BY`) — 1만 건에서 O(당일 행). "다음 예정"은 당일 범위를 벗어날 수 있어 `findInRange(now, +∞, {isDone:false}, 'startAt', 1)` 별도 조회가 필요하며 `getSummary` 가 이미 수행(코어 구현·V-1/V-2 테스트 존재). P-07 완료율(`total==0 → 0%`)도 여기서 계산 |
| 오늘 일정 목록(행 데이터 — 인라인 완료 토글·스와이프 삭제 대상) | **`ScheduleService.findInRange(dayStart, dayEnd, undefined, 'startAt', DASHBOARD_PAGE_SIZE, cursor)`** | F-05 `toggleDone`·F-04 `softDelete` 는 실제 `Schedule` 행이 필요. §16.3.5 페이지네이션 |

- 인라인 완료 토글/스와이프 삭제 후 화면이 `invalidate('dashboard','list')` → 다음 포커스에 `getSummary` 재호출로 요약 실시간 갱신(AC-44). 삭제는 `invalidate('search')` 도 포함.
- `dayStart`/`dayEnd` 는 `Clock.startOfLocalDay(Clock.now(), tz)` 기준(§16.11, P-17). 화면이 `new Date()` 로 계산하지 않는다(T-04).
- 요약 영역과 목록 영역은 항상 한 화면에 함께 렌더한다(P-35, AC-46) — 축소 금지.

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

## 10. SettingService / ThemeStore (F-13, F-18, AC-17, P-10-1, P-32, P-33)

### 설정 키 표 (APP_SETTING, JSON 직렬화 값) — v1.8 정식화

`plan.md` §5.13 설정 인벤토리와 1:1 대응. 저장 키는 설계 확정 사항이며 `src/app/state/bindings.ts` `SETTING_KEYS` 와 `src/core/services/settingService.ts` `SettingKeys` 가 **동일 문자열**을 공유해야 한다(§14 일관성).

| 설정 항목 | 키 | 값(JSON) | 기본값(미저장 시 fallback) | 관련 |
| --- | --- | --- | --- | --- |
| 테마 모드 | `theme.mode` | `"light"\|"dark"\|"system"` | `"system"` | F-13, E-13-1 |
| 강조 색상 | `theme.accent` | `"#RRGGBB"` | `"#0A84FF"` | F-13 |
| 글자 크기 | `theme.fontScale` | number | `1` | F-13(가정) |
| 알림 본문 제목 노출 | `notif.showTitle` | bool | `true` | P-10-1 |
| **전역 알림 사용** | `notif.enabled` | bool | **`true`** | F-18, P-32, D-07 |
| **새 일정 기본 중요도** | `schedule.defaultPriority` | `"HIGH"\|"NORMAL"\|"LOW"\|null` | `null` → 코어가 `"NORMAL"` (E-07-1) | F-18, P-33 |
| **새 일정 기본 유형** | `schedule.defaultCategoryId` | number\|null | `null` → 코어가 시스템 "기타" (E-06-1) | F-18, P-33 |
| 캘린더 쓰기 | `calendar.pushEnabled` | bool | `false` | D-02 |
| 캘린더 충돌 정책 | `calendar.conflictPolicy` | `"device"\|"app"` | `"device"` | P-08-2 |
| 유형 관리 진입점 | — (키 없음, 네비게이션) | — | — | F-06 → §16.3.4 |

### 계약

- **범용 접근(UI 편의)**: `get(key): Promise<string|null>` (저장된 원본 JSON 문자열), `set(key, jsonValue): Promise<void>` (`jsonValue` 는 호출부가 `JSON.stringify` 한 문자열). — 이미 구현. `SettingsScreen` 이 `notif.enabled`/`schedule.default*` 를 이 경로로 읽고 쓴다.
- **타입 헬퍼**: `notificationsEnabled(): Promise<boolean>` (기본 true), `setNotificationsEnabled(enabled)` — 이미 구현. `showNotificationTitle()`, `getTheme()/setTheme()`, `calendarPushEnabled()`, `calendarConflictPolicy()` — 이미 구현.
- **신규 헬퍼(v1.8)**: `newScheduleDefaults(): Promise<{ priority: Priority | null; categoryId: number | null }>` — `schedule.defaultPriority` / `schedule.defaultCategoryId` 를 읽어 반환. `ScheduleEditorScreen` 신규 모드 프리필(§16.3.6) 및 검증 없음(초기 선택값만, P-33).
- `SettingService.SettingKeys` 상수에 `NOTIF_ENABLED`, `SCHEDULE_DEFAULT_PRIORITY`, `SCHEDULE_DEFAULT_CATEGORY_ID` 추가.
- 변경 즉시 store 반영 + 영속. 앱 재시작 시 `getAll()`로 복원(AC-17).
- `theme.mode='system'`이면 OS 테마 변경 이벤트를 구독해 반영(E-13-1).
- `notif.showTitle=false`면 `ReminderScheduler`가 알림 title/body에서 일정 제목을 `'일정 알림'`으로 대체. **P-32(`notif.enabled`)와 독립** — 전역 알림 off면 알림 자체가 없어 P-10-1은 적용 대상 없음.
- **`notif.enabled` 쓰기 경로**: §16.3.6 / §6 — `set` 후 `ReminderScheduler.applyGlobalNotificationsToggle(v)` 를 호출해야 D-07 (a) 일괄 취소가 실행된다. `SettingService` 자체는 알림 예약을 알지 못한다(관심사 분리).
- **DB seed 불요**: `APP_SETTING` 은 키/값이며 미저장 키는 위 fallback 으로 처리. `database.md` §7 DML 확장 없음.

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
| **WatchConnectivity 채널 (F-19)** | 폰→워치 스냅샷(오늘 일정 제목/시각/유형), 워치→폰 완료 토글 op | 중간 — OS 페어링·암호화 채널이나 op 는 신뢰 경계 밖 입력으로 취급(재조회·dedup·LWW 검증) |
| **워치 로컬 스냅샷/보류 큐 파일 (F-19)** | 오늘 일정 제목/시각, 대기 중 완료 토글 op | 매체 탈취 위협 대상 — 워치 데이터 보호 클래스 적용 |
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
- **워치(F-19, 마스킹)**: `watch.snapshot.sent`(건수·페이로드 바이트, 제목 미기록), `watch.toggle.received` / `.applied` / `.rejected` / `.lww.phoneWins`(scheduleId·opId·결과만), `watch.session.activated` / `.unreachable`. 제목·메모는 마스킹.
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
| 워치로 일정 제목 노출면 확대 (F-19) | Info Disclosure | 페이로드 최소화(오늘 + 다음 1건, 제목·시각·유형·완료상태만 — 메모·이력·토큰·알림·계정 미포함, P-40), OS 암호화 채널, 워치 스냅샷 파일 데이터 보호 | 잠금 해제된 분실 워치에서 오늘 제목 열람 → §13.9 residual |
| 위조·재생된 워치 완료 토글 op (F-19) | Tampering / Elevation | op = `{opId, scheduleId(정수), done(bool), watchChangedAt, baseUpdatedAt}` 만; `scheduleId` 재조회 + `opId` dedup 원장 + LWW; `toggleDone` 외 경로 없음(P-43); WCSession 은 동일 team ID 페어드 확장으로 OS 제한 | 낮음(§13.9) |
| 워치 op 폭주로 폰 처리 부하 (F-19) | DoS | 수신 처리 상한(배치·순차), dedup 원장 링버퍼(최근 50), `updateApplicationContext` 병합으로 스냅샷 재전송 코알레싱 | 낮음 |

---

## 13.9 워치 동기화 (WatchConnectivity) 보안 (F-19) — v1.9

- **신뢰 경계**: 페어링된 iPhone ↔ Apple Watch 간 `WCSession` IPC. Apple 이 전송을 암호화하고 채널을 동일 App ID(팀)의 페어드 워치 확장으로 제한한다. 제3자 앱은 이 세션에 붙을 수 없다. 그러나 워치에서 오는 완료 토글 op 은 **신뢰 경계 밖 입력**으로 취급한다.
- **인증/권한**: 앱 내부 권한 계층 없음(단일 사용자). 워치는 폰 데이터의 축소 뷰이며, 허용 쓰기는 **완료/미완료 토글 1종**(P-43). `WatchSyncService.applyIncomingToggle` 은 오직 `ScheduleService.toggleDone(scheduleId, done)` 만 호출한다 — 생성·수정·삭제·설정·유형 관리 경로가 코드상 존재하지 않는다(Broken Access Control 표면 제거).
- **입력 검증(수신 op)**: `opId`(문자열, UUID 형식), `scheduleId`(`Number.isInteger`, 양수), `done`(엄격 boolean 강제), `watchChangedAt`/`baseUpdatedAt`(`Number.isInteger`, NaN/Infinity 거부). `scheduleId` 는 `ScheduleRepository.findById` 로 재조회(없거나 soft-deleted → `REJECT_NOT_FOUND`, ack 후 워치가 큐에서 제거). 동적 SQL 없음 — 기존 바인딩 규칙(§13.3) 그대로.
- **재생(replay)/중복 적용 방지**: `APP_SETTING` `watch.appliedOps` = 최근 50개 `{opId, ts}` 링버퍼. 이미 있는 `opId` → 재적용 없이 ack. `transferUserInfo` 재전송·앱 재시작 후 중복 전달을 흡수.
- **민감정보**: 폰→워치 페이로드에 **메모·전체 이력·검색 인덱스·유형 전체 정의·계정 식별자·토큰·알림 내부 상태 미포함**(P-40). 제목·시작시각·유형 라벨/색·완료상태만. 워치 로컬 스냅샷/보류 큐 파일은 워치 데이터 보호(파일 보호 클래스)로 저장. 비밀정보(OAuth 토큰, DB 암호화 키)는 **워치로 전송하지 않는다**.
- **알림 제목 마스킹 토글(P-10-1)과 관계**: P-10-1 은 *알림 본문* 노출 여부 정책이며, 워치 **앱 화면**의 제목 표시는 폰 앱 화면과 동일하게 원제목을 보인다(별개 관심사). 워치 앱은 알림을 표시·예약하지 않으므로 P-10-1 의 적용 대상이 아니다.
- **비밀정보 취급**: 해당 없음 — 워치 채널로 오가는 값에 키/토큰/자격증명이 없다.
- **의존성**: `react-native-watch-connectivity` 1.x major 고정 + 주기 `npm audit`(§13.6 정책 동일 적용). watchOS 앱(Swift)은 시스템 프레임워크(`WatchConnectivity`, `SwiftUI`, 선택 `WidgetKit`)만 사용.
- **감사 로그**: §13.7 워치 항목(마스킹).
- **위협→대응→잔여 위험**:

| 위협 | STRIDE | 대응 | 잔여 위험 |
| --- | --- | --- | --- |
| 분실·잠금 해제된 워치에서 오늘 일정 제목 열람 | Info Disclosure | 페이로드 최소화, 워치 손목 감지/패스코드, 스냅샷 파일 데이터 보호 | 사용자가 워치 잠금 미설정 시 노출 — residual, 문서화 |
| 위조/재생된 완료 토글 op 로 상태 오염 | Tampering | scheduleId 재조회 + opId dedup + LWW + toggleDone 한정 | 정상 페어드 워치에서의 오조작은 폰에서 되돌리기 가능(정상 기능) |
| 워치 채널 장애로 폰 기능 저해 | DoS(가용성) | 베스트-에포트 격리 — `GATEWAY_WATCH_UNAVAILABLE` 로깅 후 폰 흐름 계속(NFR-12) | 없음(설계상 제거) |
| LWW 근사로 워치 토글 유실 | Tampering/Integrity | §17.6 `baseUpdatedAt` 비교, 유실 시 다음 스냅샷에서 폰 상태로 수렴(사용자 재토글 가능) | 완료 무관 폰 편집이 워치 토글보다 뒤일 때 드롭 — N-12 residual |

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
| (v1.6) §16.3.1 DateTimePicker가 포트 계약(`startAt: number` epoch ms)과 일관 | OK — OS `Date.getTime()` → epoch ms 직접 추출. ScheduleService.create/update 시그니처 무변경 |
| (v1.6) DateTimePicker 기본값 정책이 E-01-2(시작 일시 미선택)와 일관 | OK — 마운트 시 자동 초기화(`+1시간 정각`), 미선택 시나리오가 실질적으로 존재하지 않음. 코어 `VALIDATION_START_REQUIRED` 방어는 유지 |
| (v1.6) `localWallToEpoch` 존속이 V-26 테스트·`epochToWall` 초기값 표시와 일관 | OK — 저장 경로에서 DateTimePicker로 대체되지만 역방향 표시 초기값(`epochToWall` → DateTimePicker initialValue) 및 V-26 단위 테스트 유지용으로 함수 존속. 저장 경로 불사용 명시 |
| (v1.6) §16.7 보안 노트 갱신이 §13.3 신뢰 경계와 일관 | OK — 텍스트 파싱 표면 제거, OS 위임 입력, Number.isInteger 방어 유지. 추가 위협 없음 |
| (v1.7) §16.9 로딩 인디케이터가 코어 포트·서비스·`bindings.ts` 와 일관 | OK — 컴포넌트는 `src/core/**` 미import, 서비스 호출 없음, `bindings.ts`(서비스↔화면 맵) 무관. 화면은 로컬 `useState` boolean 만 전달. `SCREEN_BINDINGS`·상태 슬라이스 무변경 |
| (v1.7) §16.9 폴백 체인이 F-17 E-17-1/2/5·P-22 와 일관 | OK — 애니메이션→정적(DuckScene 정지컷 또는 `logo.png`)→OS 스피너 3단계. Reduce Motion·프레임 저하·렌더 실패 각각의 예외를 단계에 매핑(§16.9.5 표). 크래시 없음(AC-34) |
| (v1.7) §16.9.3 임계값이 P-24~P-28 가정 범위 내 | OK — 200ms∈[150,300], 2500ms∈[2000,4000], 600ms∈[500,800], 10000ms≥10s. D-06(2) 확정값이 overview "D-06 설계 확정값" 표와 동일 |
| (v1.7) §16.9.6 저사양 판정이 NFR-11·nfr §13 과 일관 | OK — rAF 프레임 저하 휴리스틱 + Reduce Motion. 신규 의존성 0. `nfr.md` §13 강등 트리거 수치(평균 28ms / 연속 5프레임 50ms)와 동일 표기 |
| (v1.7) §16.9 소비 지점이 F-17 노출 위치 5종·AC-36 과 일관 | OK — 부트스트랩=fullscreen(App.tsx), Dashboard/Calendar/Search=inline, 대량 동기화=미사용. 화면별 loading 소스 명시, 헤더/컨트롤 유지 규칙 반영 |
| (v1.7) §16.9.7 접근성이 P-30·AC-37 과 일관 | OK — 단일 `accessibilityLabel`, 활동 캡션 SR 숨김으로 활동 전환 반복 안내 없음 |
| (v1.7) §16.9 SVG 보안 노트가 §13.1 신뢰 경계·§16.7 WebView 금지와 일관 | OK — 정적 앱 작성 도형만 렌더, 동적 SVG 문자열/`SvgFromXml`/WebView 미사용. 새 신뢰 경계 없음. 의존성은 §13.6 정책 적용 |
| (v1.7) DB 스키마 영향 | 없음 — `database.md` v1.0 유지. F-17 은 영속 데이터 없음 |
| (v1.8) §5.1 `rename`/`create` 검증이 `ErrorCodes`·포트와 일치 | OK — 신규 코드 3종(`VALIDATION_CATEGORY_NAME_REQUIRED/_DUPLICATE`, `POLICY_SYSTEM_CATEGORY_RENAME`)은 `errors.ts` 확장. `CategoryRepository.rename`/`findById`/`list` 포트 이미 존재 — 시그니처 무변경. ID 참조 rename 전파는 `SCHEDULE.CATEGORY_ID` FK 로 자동(DDL 무변경) |
| (v1.8) §6 전역 알림 게이트가 예약 경로·포트와 일치 | OK — 모든 예약이 `syncOnce()` 수렴(create/update/restore/bootstrap/AppState/boot). `applyGlobalNotificationsToggle` 는 `ReminderRepository.findDue`(max horizon) 재사용 — 포트 무변경. `REMINDER.STATE='CANCELLED'` CHECK 제약에 이미 존재(`database.md` 3.3). `findDue`/`resetScheduledToPending` 이 CANCELLED 를 되살리지 않아 D-07 (a) on-복귀 무회귀 |
| (v1.8) §7 대시보드 2-소스가 `bindings.ts`·§16.3 표와 일치 | OK — `DashboardScreen.reads` = `dashboard.getSummary` + `schedules.findInRange` 2개. 요약 표시요소는 `DashboardSummary`(코어) 필드 그대로. 인라인 `toggleDone`/`softDelete` 는 §4/§3 재사용, 새 규칙 없음(P-35) |
| (v1.8) §10 설정 키가 `bindings.ts` `SETTING_KEYS`·`SettingService.SettingKeys`·plan §5.13 과 일치 | OK — `notif.enabled`/`schedule.defaultPriority`/`schedule.defaultCategoryId` 세 파일 동일 문자열. `bindings.ts` 에는 이미 존재, `settingService.SettingKeys` 상수에 추가 필요(v1.8 지시). `APP_SETTING` k/v 스키마 무변경 |
| (v1.8) §16.3.5 페이지네이션 값이 `nfr.md` §1.2·코어 계약과 일치 | OK — cursor `(start_at,id)` keyset 유지. 코어 `findInRange` 기본 limit=50 계약 무변경(호출부가 크기 명시). `idx_schedule_start` 인덱스가 keyset 지원(`database.md` 4장) |
| (v1.8) §16.10 SwipeableRow 신규 의존성 판정이 overview 기술 스택 표와 일치 | OK — 신규 의존성 0. `react-native-gesture-handler` 폐기. `package.json` 변경 없음(RN 내장 `PanResponder`/`Animated`) |
| (v1.8) §16.11 Clock 규칙이 §0.1 포트·V-3 와 일치 | OK — `Clock` 포트(`now`/`timeZone`/`startOfLocalDay`) 이미 정의. `SystemClock` 어댑터 이미 존재. 표시 계층 배선(AppContext 노출)만 셸 변경 — 코어 무변경 |
| (v1.8) DB 스키마 영향 | 없음 — `database.md` v1.1 (검토 §9 추가, DDL·인덱스·시드 무변경). F-06 rename·F-18 토글 모두 기존 컬럼/제약으로 충족 |
| (v1.8) 보안 위협 모델 영향 | 없음 — 유형 이름은 `<Text>` 렌더(XSS 표면 없음) + 코어 길이 검증(§13.3). 설정 키/값은 JSON 직렬화·바인딩 저장(§13.3). 새 신뢰 경계·비밀정보 없음 |
| (v1.9) §17 워치 동기화가 코어 포트·서비스와 일치 | OK — 신규 `WatchSyncGateway` 포트(§0.1) + 신규 `WatchSyncService` + 순수 `src/core/watchSync/**`. 기존 `ScheduleService`/`DashboardService`/`ReminderScheduler`/`CategoryService`/`SettingService` 시그니처·로직 무변경. `applyIncomingToggle` 은 `ScheduleService.toggleDone` + `ScheduleRepository.findById` 만 호출 |
| (v1.9) §17.3 페이로드 빌더가 `DashboardService` 파생 규칙·P-39/P-40 과 일치 | OK — `buildWatchSnapshot` 은 `startOfLocalDay`(P-17)·`findForDashboard(dayStart,dayEnd)`·`findInRange(now,MAX,{isDone:false},'startAt',1)`(다음 예정 1건) 재사용 — `DashboardService.getSummary` 와 동일 소스. 시각 = epoch ms + `timeZone`(IANA) 그대로 전달(P-39). 필드 = 제목/시작/유형라벨·색/`isHighPriority`/`isDone`/`updatedAt` + 요약 카운트(P-40) |
| (v1.9) §17.4/§17.6 LWW 가 DB 스키마와 일치 | OK — `SCHEDULE.UPDATED_AT`(기존 컬럼, `toggleDone` 이 이미 갱신) + op `baseUpdatedAt` 비교. **신규 컬럼 없음**(`database.md` §10). dedup 원장 = `APP_SETTING` `watch.appliedOps`(k/v 스키마 무변경). 잔여 부정확은 N-12 residual |
| (v1.9) §17.7 이 §6 `ReminderScheduler` 와 일치 | OK — 워치 페이로드에 알림 데이터 없음, 워치는 알림 무예약(P-41). `ReminderScheduler`/`syncOnce()` 무접촉. 전역 알림 off(P-32) → 폰이 예약 취소 → 미러링 없음 → 워치도 알림 없음(E-19-7) — 기존 §6 게이트만으로 성립, 추가 코드 없음 |
| (v1.9) §17.8 컴플리케이션 조건부 섹션이 D-10 과 일치 | OK — D-10 "포함" 가정 시 WidgetKit/ClockKit 단일 컴플리케이션("오늘 남은 일정 수"), 미결 시 타깃 제외·코드 없음(AC-56 검증 종속). 폰 로직 영향 없음 — 스냅샷의 `summary.notDone` 재사용 |
| (v1.9) §13.9 워치 보안이 §13.1/§13.3/§13.7/§13.8 과 일관 | OK — 신뢰 경계·수신 op 검증(재조회·dedup·정수 검증)·감사 로그·위협표 행 모두 반영. `toggleDone` 한정으로 Broken Access Control 표면 없음. 비밀정보 워치 미전송 |
| (v1.9) DB 스키마 영향 | 없음 — `database.md` v1.2 (§10 검토 추가, DDL·인덱스·트리거·시드 무변경). LWW=`UPDATED_AT`, dedup=`APP_SETTING`, 워치 로컬 저장은 공유 SQLite 아님 |
| (v1.9) 「API 설계」 섹션 | 미신설 — WatchConnectivity 는 OS 프레임워크 IPC(외부 제공/호출 API 아님). 자체 백엔드 없음 유지(§9) |

발견된 불일치: 없음. (구버전 설계의 FTS trigram 2자 이슈는 본 설계에서 "FTS + LIKE 폴백"으로 해소.)

---

## 15. 미결정 사항 (Logic 관점)

| ID | 내용 |
| --- | --- |
| N-3 | 삭제 Undo 유효 시간 (제안: 5분/세션 내). OI-10 대시보드 스와이프 삭제 Undo 일관 적용도 함께 |
| N-4 | 완료 처리 시 남은 알림 취소 여부 (안전값: 유지) |
| N-5 | IdP 도메인 인증서 핀닝 채택 여부 |
| N-6 | 민감 화면 스크린샷 방지 채택 여부 |
| N-8 | RN 앱 셸 온디바이스 빌드·실행 검증(환경 외 후속) — overview N-8 |
| N-10 | (1) **해소(v1.6)** — `@react-native-community/datetimepicker` 8.6.0 도입 완료(§16.3.1 개정, overview v1.6 기술 스택 표 갱신). (2) 반복 일정 개별 회차 편집("이 일정만/이후 모두", P-02) — 코어 `ScheduleService.update` 확장 필요, 이번 사이클 범위 밖 |
| D-06 | 오리 로딩 인디케이터 세부 정책 5건 — v1.7에서 설계값 확정(§16.9, overview "D-06 설계 확정값" 표). 기술/UX 튜닝 결정으로 기획이 Architect 위임 → 가정값=설계값. 게이트는 형식상 OPEN 유지(이해관계자 추인 대기), 설계·구현 비차단 |
| D-01~D-03 | overview.md의 게이트와 동일 |
| D-07 | 전역 알림 off 전환 시 기존 예약 처리 — **(a) 즉시 전체 취소** 채택(plan v1.3). §6 `applyGlobalNotificationsToggle(false)` 로 구현. on 복귀 시 자동 일괄 재예약 없음(OI-9). 게이트 형식상 OPEN(이해관계자 추인 대기), 비차단 |
| D-08 | 유형 속성 편집 범위 — **"이름만"** 채택(plan v1.3). 색상·아이콘 시스템 자동 배정(`CATEGORY.COLOR` 기본값/`ICON` NULL). `CategoryManagerScreen` 은 이름 추가·변경·삭제만(§16.3.4). 후속 OI-8. 게이트 형식상 OPEN, 비차단 |
| D-09 | 워치 갱신 트리거 (F-19) — **(b)** 채택(plan v1.4). `updateApplicationContext` + 도달 시 `sendMessage`(§17.2). 주기 폴링 미도입(OI-13). 게이트 형식상 OPEN, 비차단 |
| D-10 | 워치 컴플리케이션 이번 범위 포함 (F-19) — "1종 포함" 가정으로 §17.8 **조건부 설계 섹션** 작성. 미결 시 워치 타깃에서 확장 제외(코드 없음), AC-56 검증 제외. 산출물 범위 영향 → 착수 초기 이해관계자 확인 권장. 비차단 |
| D-11 | 워치 역전파 지연/실패 노출 수준 (F-19) — **(b) "동기화 대기" 배지** 채택(plan v1.4). 보류 큐 비어있지 않은 동안 워치 목록 배지(§17.5). 폰 배지·안내 미도입. 비차단 |
| N-11 | watchOS 앱 타깃 온디바이스 검증 (F-19) — 워치 시뮬레이터/기기 부재. `src/core/watchSync/**` + `WatchSyncService` + `WatchConnectivityGateway` 계약만 `npm test`/`typecheck`. WCSession 실왕복·컴플리케이션 타임라인은 후속(`nfr.md` §11.2) |
| N-12 | 워치 LWW 정밀도 (F-19) — `SCHEDULE.UPDATED_AT` 기반 근사(스키마 무변경). 완료 무관 폰 편집이 워치 토글보다 나중일 때 워치 토글 드롭 가능(§17.6 residual). 필드 수준 정밀 LWW(전용 `DONE_CHANGED_AT`)는 스키마 변경 수반 → 후속 |

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
| DashboardScreen | 포커스, 자정 경과(AppState+Clock), pull-to-refresh | **요약**: `DashboardService.getSummary(dateTs?)` / **오늘 목록**: `ScheduleService.findInRange(dayStart, dayEnd, undefined, 'startAt', DASHBOARD_PAGE_SIZE, cursor)` cursor 루프 (§7, §16.3.5) | `dashboard` + `list` 슬라이스 교체 | 요약·브랜드 유지, 목록 영역만 재시도(E-10-6, E-02-2) |
| DashboardScreen | 목록 항목 체크박스 탭 | `ScheduleService.toggleDone(id, next)` — 낙관적, 실패 시 롤백(E-10-3/E-05-2) | `list` 항목 교체 + `invalidate('dashboard','list')`(AC-04/AC-44) | 실패 → 토스트, 상태 되돌림 |
| DashboardScreen | 목록 항목 스와이프(SwipeableRow) → 삭제 | 소비 화면 확인 다이얼로그(E-10-4 취소=원상복구) → `ScheduleService.softDelete(id)` (E-10-5: `source==='CALENDAR'` 면 확인 문구에 기기 캘린더 삭제 옵션, §3/P-08) | `invalidate('list','dashboard','search')`, 목록·요약에서 제거(AC-45) | 실패 → "삭제 실패" 안내, 목록 원복 |
| DashboardScreen | `headerRight`「+」/ 빈 상태「일정 추가」/ 상시 FAB | 없음 — `navigate('ScheduleEditor', {})` | — | 빈 상태 = 빈 상태 버튼 **+** FAB 병존(AC-15, E-10-1, T-06) |
| CalendarScreen | 월 이동, 피커, 포커스 복귀 | `ScheduleService.findInRange(monthStart, monthEnd, undefined, 'startAt', CALENDAR_MONTH_PAGE_SIZE, cursor)` — `nextCursor` 루프(월당 최대 10페이지, §16.3.5) | `monthItems` 누적 교체, `list` stale 소비 | 빈 결과 → "일정 없음"(E-02-1) / 로드 실패 → 재시도(E-02-2) |
| ListScreen | 기간 이동, 필터/정렬 변경, 무한 스크롤 | `ScheduleService.findInRange(from,to,filter,sort,50,cursor)` | `list` append(keyset), `nextCursor` 보관 | 빈 결과 → 빈 상태(E-02-1) |
| CategoryManagerScreen | 진입 / 포커스 | `CategoryService.list()` | `categories` 캐시 | 실패 → 재시도 |
| CategoryManagerScreen | 추가 / 이름변경 / 삭제 | `CategoryService.create(name)` / `rename(id, name)` / `remove(id)` (§5.1) | 성공 시 `invalidate('categories','list','dashboard')` | `VALIDATION_CATEGORY_NAME_REQUIRED`/`_DUPLICATE`/`POLICY_SYSTEM_CATEGORY_RENAME`/`POLICY_SYSTEM_CATEGORY_DELETE` → `err.message` 인라인(E-06-3~5, AC-40/41). 시스템 행("기타") 컨트롤 비활성 |
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
| SettingsScreen | 토글/선택 | `SettingService.set(key, json)` — `theme.*`, `notif.showTitle`(P-10-1), `calendar.*`(D-02/P-08-2), `schedule.defaultPriority`/`schedule.defaultCategoryId`(P-33) | 즉시 `settings` 반영 + 테마 적용(AC-17) | 저장 실패 → 이전 값(E-18-3) |
| SettingsScreen | "알림 사용" 토글 | `SettingService.set('notif.enabled', v)` → **`ReminderScheduler.applyGlobalNotificationsToggle(v)`** (§6, §16.3.6) | `settings` 반영. off = 기존 예약 일괄 취소(AC-42) | 저장 실패 → 롤백, 토글 미적용. 권한 거부 + on → 안내(E-18-1) |
| SettingsScreen | "유형 관리" 행 | 없음 — `navigate('CategoryManager')` | — | — (F-06) |
| SettingsScreen | 삭제된 기본 유형 정합성 | `categories.list()` 결과에 `schedule.defaultCategoryId` 없으면 `set('schedule.defaultCategoryId', null)` | `settings` 반영 | E-18-2 / P-33 — "기타"로 자동 복귀 |
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
| 시작 일시 | `DateTimePickerModal` (mode='date' 선택 후 mode='time' 2단계, 또는 단일 'datetime') — 선택된 `Date` 객체의 `.getTime()` 으로 epoch ms 직접 추출(P-16). 날짜·시각 버튼을 각각 표시하고 탭 시 피커 열림 | `startAt` | `VALIDATION_START_REQUIRED`(미선택 시 기본값 "현재 시각 + 1시간 정각" 자동 적용하므로 실질적 미선택 없음. `Number.isInteger(startAt)` 방어 검증 유지 — AC-02) | `startAt` | 필수. 기본값 = 다음 정시(`Date.now() + 3600000`, 분/초/ms 0으로 정규화). E-01-2: 피커는 항상 유효한 Date를 반환하므로 파싱 실패 없음; 기본값이 있으므로 미선택도 없음 |
| 종료 일시 | 시작과 동일 DateTimePicker. 비우려면 "종료 없음" 토글(Switch) — OFF 시 `null` 전송 | `endAt` | `VALIDATION_END_BEFORE_START`(endAt<startAt, AC-03), `VALIDATION_END_INVALID` | `endAt` | 선택. 기본 OFF(null) |
| 유형(카테고리) | 피커 — 옵션 = `CategoryService.list()` (마운트 1회, `categories` 캐시) | `categoryId` | 없음 — 미지정/미존재 시 코어가 시스템 기본("기타")으로 대체(E-06-1) | — | 선택. "유형 추가" = `CategoryService.create(name)` |
| 우선순위 | 3-세그먼트 `HIGH / NORMAL / LOW` (D-04) | `priority` | 없음 — 미지정 시 코어 기본 `NORMAL`(E-07-1) | — | 기본 선택 표시 `NORMAL` |
| 메모 | 멀티라인 `TextInput` | `memo` | `VALIDATION_MEMO_TOO_LONG`(>5000) | `memo` | 선택. 비우면 `null` |
| 반복 | rule 세그먼트 `없음 / DAILY / WEEKLY / MONTHLY / YEARLY` + 종료조건 `없음 \| 종료일(date) \| 횟수(number)` | `recurrence` (`{ rule, endAt?, count? }` 또는 `null`) | `VALIDATION_RECURRENCE_RULE_INVALID`, `VALIDATION_RECURRENCE_CONFLICT`(endAt·count 동시), `VALIDATION_RECURRENCE_COUNT_INVALID`(≤0) | `recurrence` | **신규 생성 경로만**. "없음" → `null`/미전송. 범위 = P-01 단순 반복 |
| 사전 알림 오프셋 | (이번 사이클 전용 UI 없음) | `reminderOffsets` / `notifyAtStart` | `VALIDATION_REMINDER_LIMIT`(>5, P-10) | `reminderOffsets` | 신규: 기존 기본 `[10]` + `notifyAtStart:true` 유지. 수정: 미전송 → 기존 유지. 프리셋 다중선택 UI는 후속 |

- **검증·오류 표시 규약**: 저장 클릭 → `create`/`update` 호출 → `ValidationError`(또는 `AppError`) catch → `err.field` 로 해당 입력 하단 문구, `field` 없으면 폼 상단. `ValidationError.errors[]` 가 다건이면 첫 건만 쓰지 말고 각 `field` 별로 표시. 실패해도 입력값 폐기 금지(§0.2). 저장 이전 실패는 저장소 변경 없음.
- **저장 성공 후**: `invalidate('list', 'dashboard', 'search', 'categories')` → `navigation.goBack()`. (기존 스켈레톤·`src/app/state/bindings.ts` 와 동일한 4-슬라이스 집합.)
- **수정 모드의 반복**: `recurrence` 는 읽기 전용 표시. `update` 호출 시 `recurrence` 를 **미전송**하면 코어가 기존 규칙을 보존한다(`scheduleService.update` 의 `input.recurrence === undefined` 분기). 개별 회차의 "이 일정만 / 이후 모두"(P-02)는 이번 사이클 범위 밖 — 가상 회차는 자체 id가 없어 편집 진입이 성립하지 않고, 코어 `update` 는 베이스 행만 수정한다(§5). 후속 N-10.

#### 날짜/시간 입력 방식 결정 (v1.6 — N-10 해소)

- **도입 라이브러리**: `@react-native-community/datetimepicker` **8.6.0** (pin). RN 0.74.x 완전 호환(`react-native: '*'` peer), iOS / Android 모두 지원. Old Architecture(`newArchEnabled=false`) 지원 확인.
  - **버전 핀 근거**: N-10 계획 당시 "8.x"로 명시했으며, 8.6.0이 8.x의 최신 안정 패치. 9.x는 최신이지만 8.x와 동일 peer 조건이며 N-10 계획의 연속성·안정성 선호로 8.x 유지. 10.x 이상 전환 시 별도 사이클.
- **UI 패턴 (플랫폼 차이)**:
  - **iOS**: `display='inline'`(달력 인라인) 또는 `display='spinner'`. 피커가 화면 내 항상 노출되어 별도 열기/닫기 불필요. 날짜 + 시각을 2단계 독립 피커로 구성하거나, `display='compact'`(iOS 14+) 사용 가능.
  - **Android**: `display='default'`(OS 다이얼로그). 버튼 탭 → 다이얼로그 팝업 → 확인/취소. 날짜 확인 후 시각 다이얼로그를 별도로 연다(2단계).
  - **구현 전략**: 날짜 선택 버튼 + 시각 선택 버튼을 각각 표시. 탭 시 해당 mode(`'date'`/`'time'`)의 피커 노출. iOS에서는 피커를 Modal 또는 인라인으로, Android에서는 OS 다이얼로그로 처리한다. 단일 `DateTimePicker` 컴포넌트를 `mode` 교체로 재사용 가능.
- **epoch ms 추출**: 피커가 `onChange(event, selectedDate: Date | undefined)` 콜백으로 `Date` 객체를 전달한다. `selectedDate.getTime()` → epoch ms(UTC) 직접 추출. **`localWallToEpoch` 변환이 불필요**해진다.
  - `localWallToEpoch` 함수(`src/core/domain/time.ts`)는 기존 테스트(V-26) 및 `epochToWall` 역방향 표시 초기값에 계속 사용되므로 삭제하지 않고 유지한다. 단, 저장 경로에서는 사용하지 않는다.
- **기본값 정책**: 컴포넌트 마운트 시 내부 상태 `startAt`의 초기값을 `Date.now() + 3600000`(현재 시각 + 1시간)으로 설정하고 분/초/ms를 0으로 정규화. 피커는 이 값을 초기 선택으로 표시 — 사용자가 확인 없이 저장해도 유효한 epoch이 전달된다(E-01-2 미선택 시나리오 제거).
- **E-01-3 검증 유지**: `endAt`이 활성화된 경우 `endAt < startAt` → `VALIDATION_END_BEFORE_START`. 코어 `assertValidScheduleInput`이 수행.
- **보안 노트**: DateTimePicker는 OS 네이티브 UI에 완전 위임 — 외부 입력 표면 없음. 피커 반환 `Date.getTime()`은 `Number.isInteger` 검증 유지(심층 방어).
- **pod 재설치**: 신규 네이티브 의존성 추가로 `cd ios && pod install` 필요. 빌드 호스트 디스크 765 Gi 여유 충분 — 이전 이연 사유 해소됨.

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

### 16.3.3 상호작용형 대시보드 레이아웃 (F-10, P-35, AC-15, AC-44~46, T-01/T-02/T-06) — v1.8

`DashboardScreen` 은 아래 4영역을 **한 화면에 수직으로 공존**시킨다(요약만·목록만 화면으로 축소 금지 — P-35).

| # | 영역 | 내용 | 소스 | 회귀 방지 |
| --- | --- | --- | --- | --- |
| 1 | 상단 브랜드 | `logo.png` → `tagline.png` 수직 배치. 화면 폭 60% 이하(P-20), `resizeMode='contain'`, 각 `<Image>` `onError` 폴백(E-16-1/AC-28) | 정적 에셋(§16.3.2 규약 재사용) | **T-01 — 재설계 코드에서 제거된 렌더 복원**. AC-25/AC-46 |
| 2 | 요약 | 총계 / 완료 / 미완료 / 완료율(%) / 유형별 분포 / 다음 예정 일정 | `DashboardService.getSummary(dateTs?)` (§7) | **T-02 — `findInRange` 파생 계산 되돌림**. AC-46, P-07 |
| 3 | 오늘 일정 목록 | 금일 일정 시간순. 각 행 = 체크박스(탭 → `toggleDone`, F-05) + 시각 + 제목(탭 → `ScheduleDetail`). `SwipeableRow`(§16.10) → 삭제(F-04) | `ScheduleService.findInRange(dayStart, dayEnd, …, DASHBOARD_PAGE_SIZE, cursor)` (§16.3.5) | AC-44(인라인 토글·요약 갱신), AC-45(스와이프 삭제) |
| 4 | 일정 추가 진입점 | 상시 FAB(우하단 원형) + **빈 상태(`summary.empty`)일 때 목록 영역에 명시적 「일정 추가」 버튼** | `navigate('ScheduleEditor', {})` | **T-06 — FAB + 빈 상태 버튼 병존**(AC-15 확정) |

- **빈 상태(E-10-1)**: 요약 영역 0/0/0%, 목록 영역 "오늘 일정이 없습니다" + 「일정 추가」 버튼, FAB 유지. 브랜드·요약 영역은 그대로 표시.
- **인라인 완료 토글(E-10-3)**: 낙관적 갱신 → 실패 시 체크 상태 롤백 + 재시도 안내. 성공 시 `invalidate('dashboard','list')` → 포커스 시 `getSummary` 재조회로 완료 수·완료율·유형별 분포 갱신(AC-44).
- **스와이프 삭제(E-10-4/E-10-5)**: `SwipeableRow` 는 제스처·스냅만. 삭제 확인 다이얼로그와 `source==='CALENDAR'` 분기는 `DashboardScreen` 의 `confirmDelete` 가 담당(§3, §16.10). 확인 취소 = 목록 원상복구, 아무 호출 없음.
- **목록 로드 실패(E-10-6)**: 브랜드·요약 영역 유지, 목록 영역만 재시도 안내(기존 E-02-2 준용). F-17 인라인 로딩 인디케이터는 §16.9.8 #2 그대로.
- **자정 경과(E-10-2/AC-16)**: `AppState 'active'` + `Clock` 재평가로 `dateTs` 갱신(§16.11). 서비스는 무상태.

### 16.3.4 유형 관리 화면 (F-06, P-34, D-08, AC-39~41) — v1.8

`CategoryManagerScreen` — 설정 화면 "유형 관리" 행에서 `navigate('CategoryManager')` 진입(§7.8).

- **목록**: `CategoryService.list()`. 각 행 = 유형 이름 + (비시스템) 이름변경·삭제 컨트롤 / (시스템 "기타") "기본 유형" 표기 + 컨트롤 비활성(AC-40).
- **추가**: 이름 입력 → `CategoryService.create(name)` (§5.1). 성공 시 입력 초기화 + `invalidate('categories','list','dashboard')` + 목록 재조회.
- **이름변경(신규 UI — 현재 재설계 코드에 없음)**: 비시스템 행의 이름을 인라인 편집 또는 프롬프트로 입력 → `CategoryService.rename(id, newName)`. 성공 시 `invalidate('categories','list','dashboard')` → 그 유형을 쓰는 일정의 표시 라벨이 목록·대시보드·검색에서 재조회 시 새 이름으로 갱신(AC-39, ID 참조 유지 — §5.1).
- **삭제**: 확인 다이얼로그("이 유형의 일정은 '기타'로 이동합니다") → `CategoryService.remove(id)` (E-06-2). 성공 시 `invalidate('categories','list','dashboard')`.
- **오류 표시**: `create`/`rename` 의 `AppError.code` → 사용자 안내. `VALIDATION_CATEGORY_NAME_REQUIRED`(빈 이름) / `VALIDATION_CATEGORY_NAME_DUPLICATE`(중복) / `POLICY_SYSTEM_CATEGORY_RENAME`(기본 유형) / `POLICY_SYSTEM_CATEGORY_DELETE` / `NOT_FOUND_CATEGORY` (E-06-3~6, AC-41).
- **색상·아이콘(D-08)**: 사용자 편집 UI 없음. `create` 는 `CATEGORY.COLOR` 기본값 + `ICON=null`. 후속 OI-8.
- **`bindings.ts`**: `CategoryManagerScreen.writes` 에 `{ service: 'categories', method: 'rename' }` 추가(현재 `create`/`remove` 만).

### 16.3.5 목록 조회 페이지네이션 설계값 (F-02, T-05) — v1.8

하드코딩된 페이지 크기(재설계 코드: Dashboard 200 / Calendar 500, 단일 페이지·cursor 미사용)를 **설계 상수 + keyset cursor 루프**로 승격한다. cursor = base64(`start_at,id`) — `nfr.md` §1.2 유지. 코어 `ScheduleService.findInRange` 기본 limit=50 계약 무변경(호출부가 명시적으로 크기를 넘긴다).

| 상수 | 값 | 적용 | 동작 |
| --- | --- | --- | --- |
| `DASHBOARD_PAGE_SIZE` | 100 | `DashboardScreen` 오늘 목록 | `findInRange(dayStart, dayEnd, …, 100, cursor)` → `nextCursor` 있으면 반복 append, 없을 때까지(당일 범위라 사실상 1~2페이지) |
| `CALENDAR_MONTH_PAGE_SIZE` | 200 | `CalendarScreen` 월 그리드 | `findInRange(monthStart, monthEnd, …, 200, cursor)` 루프. **월당 최대 10페이지(2000행) 안전 상한** 후 중단 + `metric('calendar.month.truncated')` |
| `SEARCH_PAGE_SIZE` | 50 | `SearchScreen` | `SearchService.search({query, filter, limit: 50, cursor})` + `onEndReached` 시 다음 cursor 페이지 append |

- **CalendarScreen 은 "무한 스크롤"이 아니라 월 단위 조회**다(그리드가 월의 전체 일정 점·선택일 목록을 필요로 함). "기간 이동"(이전/다음 달)이 페이지 경계. 단일 500 페이지 상한을 없애 대량 데이터(캘린더 동기화 등) 시 조용한 누락을 방지.
- **선택일 목록**은 `monthItems` 인메모리 파생 — 별도 페이지네이션 없음.
- **ListScreen(평면 목록, 사용 시)**: keyset 무한 스크롤 50건(§16.3 표, 기존).
- 상수 위치는 Developer 재량(`src/app/config` 등). 값은 본 절이 고정.

### 16.3.6 설정 화면 — 전역 알림 토글 / 새 일정 기본값 (F-18, P-32, P-33, D-07, AC-42, AC-43) — v1.8

`SettingsScreen` — §7.9 흐름. §10 키 표 참조.

- **전역 알림 사용 스위치**(`notif.enabled`, 기본 on):
  - on→off: `SettingService.set('notif.enabled', false)` → `ReminderScheduler.applyGlobalNotificationsToggle(false)` (§6) → 기존 예약 일괄 취소(AC-42 전반). 이후 저장·수정 일정은 `syncOnce()` 게이트로 미예약.
  - off→on: `set('notif.enabled', true)` → `applyGlobalNotificationsToggle(true)` (no-op). 기존 전체 일정 자동 재예약 없음(D-07 (a), OI-9). 이후 저장·수정 건부터 재예약(AC-42 후반).
  - 저장 실패 → 스위치 이전 값 롤백, 토글 미적용(E-18-3).
  - "알림에 일정 제목 표시"(`notif.showTitle`)는 `notif.enabled` off 시 UI 비활성(무효 — P-10-1 적용 대상 없음). 값 자체는 보존.
  - 권한 거부 + on(E-18-1): 설정값 `true` 저장, 실제 예약은 권한 허용 후 이후 건부터. 안내·설정 이동 유도(AC-07 준용).
- **새 일정 기본 중요도**(`schedule.defaultPriority`) / **새 일정 기본 유형**(`schedule.defaultCategoryId`):
  - 세그먼트/칩 선택 → `set(key, value)`. 미지정(`null`) 선택지 제공.
  - `ScheduleEditorScreen` **신규 모드만** 마운트 시 `SettingService.newScheduleDefaults()` 로 `priority`·`categoryId` 초기 선택값 프리필(P-33). 수정 모드는 적용 안 함(기존 저장값 표시, §16.3.1). 저장 검증·저장 규칙 불변(E-07-1/E-06-1) — 기본값이 채워져 있어 "미선택" 상황이 실질 없음(AC-43).
  - 기본 유형으로 지정한 유형이 삭제되면(E-18-2/P-33): `SettingsScreen` 이 포커스 복귀 시 `categories.list()` 에 `defaultCategoryId` 부재를 감지해 `set('schedule.defaultCategoryId', null)` 로 되돌림. `ScheduleEditorScreen` 도 프리필 시 미존재 categoryId 는 코어가 "기타"로 대체(E-06-1).
- **유형 관리 진입점**: "유형 관리" 행 탭 → `navigate('CategoryManager')` (§16.3.4).
- **`bindings.ts`**: `SettingsScreen.writes` 에 `{ service: 'scheduler', method: 'applyGlobalNotificationsToggle' }` 추가.

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
- **일정 편집 입력(v1.6 — DateTimePicker)**: DateTimePicker는 OS 네이티브 UI에 완전 위임하므로 사용자가 임의 문자열을 입력하는 표면이 없다. `onChange` 콜백으로 전달된 `Date` 객체에서 `.getTime()`을 추출하고, `Number.isInteger` 방어 검증 후 서비스 호출(심층 방어 — 코어 `assertValidScheduleInput` 도 `Number.isInteger(startAt)` 재검증, §13.3). 이전 버전의 텍스트 파싱 경로(`localWallToEpoch` 저장 경로 사용)가 제거되어 파싱 실패·NaN 공격 표면이 축소된다. 제목/메모는 코어 길이·제어문자 규칙(§13.3)에 위임하고 `<Text>` 렌더라 XSS 표면 없음. 신규 신뢰 경계·위협 없음.
- **에셋 경로 고정 (v1.5, P-21)**: 탭 아이콘·로고·태그라인 에셋 경로는 `src/assets/icons/`·`src/assets/images/`에 고정되며, 빌드 타임에 JS 번들에 포함된다. 런타임에 외부에서 경로를 변경하거나 주입하는 표면이 없으므로 에셋 경유 코드 실행 위협은 없다. 에셋 로드 실패는 UI 폴백으로 처리하며 예외가 크래시로 전파되지 않는다(E-16-1, AC-28).
- **브랜드 로딩 인디케이터 SVG (v1.7, F-17)**: `react-native-svg` 로 렌더하는 도형은 **앱이 코드로 작성한 정적 path/상수**(`duck/duckGeometry.ts`)뿐이다. 사용자·네트워크·외부 캘린더에서 온 SVG 문자열을 렌더하지 않으며 `SvgUri`/`SvgFromXml` 에 동적 입력을 넘기지 않는다 → SVG/XXE 파싱 표면 없음. WebView 미사용(§16.7 상단 원칙 유지). `BrandLoadingIndicator` 는 boolean/enum/문자열 상수/콜백만 props 로 받는 순수 프레젠테이션 컴포넌트로, DB·토큰·알림·캘린더·인증 어느 것도 접근하지 않아 §13 위협 모델에 새 신뢰 경계를 추가하지 않는다. 정적 폴백은 빌드 번들 `logo.png` 재사용(P-21). SVG 렌더 예외는 `SvgErrorBoundary` 로 포획해 크래시로 전파되지 않는다(E-17-2, AC-34). 의존성 위험은 §13.6 정책(major 고정 + 주기 `npm audit`)을 `react-native-svg` 15.x 에 동일 적용.

### 16.8 셸 관점 미검증(환경 외 후속) 범위

overview "빌드 환경 제약과 파이프라인 검증 전략"(v1.2) 참조.

- **정식 검증(v1.2~)**: `ios/` `pod install` + `xcodebuild`(또는 `react-native run-ios`) 네이티브 빌드 성공, 시뮬레이터 앱 설치·실행·첫 화면(대시보드) 렌더. §16.1~16.4의 순수 로직과 §16.5 어댑터의 계약 준수(타입 + Fake 동치 테스트).
- **환경 외 후속(환경이 허용하지 않을 때만)**: `android/` Gradle 빌드, Metro 번들 프로덕션 최적화, 실제 온디바이스 알림 정확도(nfr 1.1)·`BOOT_COMPLETED` 실동작, 워치 타깃 연동.

### 16.9 브랜드 로딩 인디케이터 (F-17, AC-29~38, P-22~P-31, NFR-11, D-06) — v1.7

로고 오리 캐릭터가 도메인 활동(일정 확인·달력·알림 종·완료 체크·검색)을 순환하는 벡터 애니메이션을 로딩 대기 표시로 사용한다. **코어(`src/core/**`)·서비스·포트·DB·`bindings.ts` 무변경** — `src/app/components/` 에 순수 프레젠테이션 계층만 추가한다. 화면(.tsx)은 자기 로딩 상태(boolean)를 이 컴포넌트에 넘길 뿐, 코어 계약이 바뀌지 않는다.

#### 16.9.1 렌더 수단 결정 (D-06(5))

| 안 | 내용 | 판정 | 사유 |
| --- | --- | --- | --- |
| **A** | `react-native-svg` 15.x 신규 도입 + RN 내장 `Animated`(`useNativeDriver: true`) 루프 | **채택** | (a) 기획이 "벡터(SVG) 기반"(P-22, NFR-11) 명시 — 코드로 작성한 SVG path 로 로고 오리 형태·색 유지(P-23) 충실. (b) 애니메이션은 opacity/transform(translateY 바운스·rotate·scene 크로스페이드)만 → `Animated` + `useNativeDriver` 로 UI 스레드 구동, JS 브리지 프레임 비용 0(NFR-11). (c) reanimated/lottie 불필요 — 단순 타이머 루프. (d) 정적 폴백·에러 경계와 조합해 3단계 강등 용이. 비용: 네이티브 모듈 1개(`pod install`, ABI 당 수백 KB) — 프로젝트가 이미 op-sqlite/notifee/datetimepicker 로 `pod install` 수행 중이라 한계비용 작음 |
| B | RN 내장 `Animated` + `View`/`Text`(borderRadius 도형·이모지)로 오리 구성, 신규 의존성 0 | 폐기 | 신규 의존성 0은 장점이나, `View` 조합으로 "로고 오리의 형태·색 유지"(P-23) 재현이 어렵고 장면(활동)별 소품(클립보드/달력/종/체크박스/돋보기)까지 도형으로 만들면 레이아웃 코드가 과다. 브랜드 아이덴티티 목적(F-17)에 미달 |
| C | 정적 이미지 시퀀스 / 단일 PNG + `Animated` transform | 폐기(주 렌더로는) | 래스터 = "벡터 기반 경량 리소스"(NFR-11) 위배, 에셋 제작 부담, 스케일 열화. 단 **정적 폴백 단계**에서는 기존 `logo.png` 재사용(§16.9.5) |
| D | 인라인 SVG 문자열을 자체 파서/`SvgFromXml`/WebView 로 처리 | 폐기 | WebView 는 §16.7 에서 금지(HTML/JS 실행 표면). 외부/동적 SVG 문자열 파싱은 불필요한 공격 표면. `SvgUri`/`SvgFromXml` 에 동적 입력 사용 금지 |

- **고정 버전**: `react-native-svg` 15.x (15.11.x). RN 0.74 peer 호환, New/Old Architecture 모두 지원. 10.x↓·16.x↑ 는 별도 사이클.
- **애니메이션 라이브러리 추가 금지**: `react-native-reanimated`, `lottie-react-native` 미도입(overview 기술 스택 표 폐기안).

#### 16.9.2 컴포넌트 배치 및 계약

- 위치: `src/app/components/`(신규). **계층 규칙**: `react` / `react-native` / `react-native-svg` / app 훅만 import. `src/core/**`(도메인·서비스·포트)·`bindings.ts`·`stores.native.ts` 를 import 하지 않는다. 모든 입력은 props.

| 파일 | 책임 | React 의존 | 검증 |
| --- | --- | --- | --- |
| `BrandLoadingIndicator.tsx` | 공개 컴포넌트. 폴백 트리 + 접근성 컨테이너 + SVG 서브트리 마운트 | O | 정적 리뷰 + 렌더 스냅샷(후속 RN 환경) |
| `loadingIndicatorMachine.ts` | 표시 여부·모드·타임아웃 힌트 판정 **순수 FSM** | X | `node:test` (V-27) |
| `useLoadingIndicator.ts` | FSM + `setTimeout`(지연/최소표시/타임아웃) + `AccessibilityInfo` + rAF 프레임 샘플러 배선 | O(hook) | 정적 리뷰 + 타이머 로직은 FSM 로 위임해 단위 검증 |
| `duck/duckGeometry.ts` | 로고 오리 SVG `path` d 문자열·색상 상수(형태·색 단일 출처) | X | `node:test` 로 상수 존재/형식 (V-28 보조) |
| `duck/activities.ts` | 순환 활동 목록·순서·기본 타이밍, `activitySequence(startActivity?)` | X | `node:test` (V-28) |
| `duck/DuckScene.tsx` | 활동 1컷 = 오리(공유 geometry) + 활동 소품 SVG. `activity` prop 만 받음 | O | 정적 리뷰 |
| `SvgErrorBoundary.tsx` | SVG 서브트리 렌더 예외 포획 → `onFail()` 호출(크래시 차단, E-17-2) | O | 정적 리뷰 |

**props 계약 (`BrandLoadingIndicator`)**:

```ts
type ActivityId = 'checkList' | 'flipCalendar' | 'ringBell' | 'checkDone' | 'search';

interface BrandLoadingIndicatorProps {
  /** 화면이 자기 로딩 상태를 그대로 전달. 컴포넌트가 지연/최소표시 게이트를 적용해 실제 visible 을 도출한다. */
  loading: boolean;
  /** 로딩 종료 사유. 'error' 면 최소 표시 시간을 적용하지 않고 즉시 사라진다(E-17-7, AC-38). 기본 'success'. */
  endReason?: 'success' | 'error';
  /** 배치. 기본 'inline'. */
  variant?: 'fullscreen' | 'inline';
  /** 순환 시작 활동. Search 화면은 'search'. 미지정 시 기본 순서 첫 활동('checkList'). */
  startActivity?: ActivityId;
  /** 활동 순서 override. 미지정 시 기본 4활동 순환(§16.9.4). 길이는 3~5로 clamp(P-23). */
  sequence?: ActivityId[];
  /** P-28 타임아웃 초과 시 노출할 보조 문구/슬롯. 미지정 시 기본 문구("계속 불러오는 중이에요"). */
  timeoutHint?: React.ReactNode;
  /** 타임아웃 이후 노출되는 재시도/취소 핸들러(E-17-4). 없으면 버튼 미표시. */
  onRetry?: () => void;
  onCancel?: () => void;
  /** 접근성 라벨. 기본 "불러오는 중"(P-30, AC-37). */
  accessibilityLabel?: string;
  testID?: string;
}
```

- **화면은 로딩 "원인"을 알리지 않는다.** boolean 만 전달. 컴포넌트/훅이 지연(P-24)·최소표시(P-26)·타임아웃(P-28)·모드 판정을 전담한다.
- **중첩 로딩(E-17-8)**: 한 화면에서 인디케이터 인스턴스는 **1개만** 렌더한다. 여러 하위 로딩이 있으면 화면이 boolean 을 OR 로 합쳐 하나만 전달한다. (설계 규칙 — Developer 준수)

#### 16.9.3 표시 상태 머신 — 지연/최소표시/타임아웃 (D-06(2), AC-31·AC-32)

`loadingIndicatorMachine.ts` = React 비의존 순수 함수. 입력 스냅샷 → 출력.

```text
입력:  { loadingStartedAt: number|null, loadingEndedAt: number|null, endReason: 'success'|'error',
        now: number, reduceMotion: boolean, degraded: boolean, renderFailed: boolean,
        shownAt: number|null }   // shownAt = 인디케이터가 처음 visible 된 시각(훅이 보관)
출력:  { visible: boolean, mode: 'animation'|'static'|'spinner', showTimeoutHint: boolean, markShownNow: boolean }
```

| 규칙 | 값 | 근거 |
| --- | --- | --- |
| 표시 지연(delay) | `now - loadingStartedAt < 200ms` → `visible=false` | P-24(150~300ms), AC-32 |
| 로딩이 지연 임계 내 종료 | `loadingEndedAt != null && (loadingEndedAt - loadingStartedAt) < 200ms` → 한 번도 `visible` 안 됨 | E-17-3, AC-32 |
| 최소 표시(min-display) | 이미 `shownAt != null` 이고 `endReason='success'` 면 `now - shownAt < 600ms` 동안 `visible` 유지 | P-26(500~800ms), AC-31 |
| 에러 종료 | `endReason='error'` 면 최소표시 무시, `loadingEndedAt` 즉시 `visible=false` | E-17-7, AC-38 |
| 타임아웃 보조안내 | `visible && now - shownAt >= 10000ms` → `showTimeoutHint=true` (애니메이션은 유지) | P-28(≥10s), E-17-4 |
| 모드 우선순위 | `renderFailed` → `spinner`; else `reduceMotion || degraded` → `static`; else `animation` | E-17-1/2/5, P-22 |

- 훅(`useLoadingIndicator`)이 `setTimeout` 으로 위 경계 시점에 재평가를 트리거하고, `visible` 상승 에지에서 `shownAt = now` 를 기록한다.
- 활동 노출/전환 타이밍(애니메이션 내부): 활동당 **2500ms** 노출, 다음 활동으로 **300ms 크로스페이드**(겹침 — "급격한 점프 없이", R-17-3, P-25). 4활동 1루프 = 10s.

#### 16.9.4 활동 순환 (D-06(1), AC-30)

`duck/activities.ts`:

| id | 활동 | 소품(SVG) | 기본 순서 |
| --- | --- | --- | --- |
| `checkList` | 일정 확인 | 클립보드 + 체크 라인 | 1 |
| `flipCalendar` | 달력 넘기기 | 벽걸이 달력, 넘어가는 장 | 2 |
| `ringBell` | 알림 종 울리기 | 손종 + 음파 호 | 3 |
| `checkDone` | 완료 체크 | 체크박스 + 그려지는 체크 | 4 |
| `search` | 검색하기(선택) | 돋보기 | (기본 순환 제외, Search 화면 전용) |

- **기본 순환** = `[checkList, flipCalendar, ringBell, checkDone]` (4개 — P-23 범위 3~5 충족). 무한 loop.
- **인라인에서도 전체 순환**한다(대표 1개 반복 아님 — D-06(1) 확정, AC-30 은 노출 위치를 구분하지 않음).
- **Search 인라인**: `sequence = [search, checkList, flipCalendar, ringBell, checkDone]` (5개), `startActivity='search'` — 활동 5를 첫 활동으로(F-17 노출 위치 #4).
- 모든 활동의 오리 도상은 `duckGeometry.ts` 단일 출처를 공유한다(새 캐릭터 생성 금지 — F-17 비범위).
- `sequence` 길이는 3 미만이면 기본값, 5 초과면 앞 5개로 clamp(P-23).

#### 16.9.5 3단계 폴백 체인 (E-17-1·E-17-2·E-17-5, P-22, AC-33·AC-34)

```text
mode='animation'  : SvgErrorBoundary( DuckScene + Animated 루프 )
   │  Reduce Motion(E-17-1) / 프레임 저하·절전(E-17-5)  → mode='static'
   ▼
mode='static'     : SvgErrorBoundary( DuckScene 정지 1컷 = 활동 'checkList' 포즈 ) + "불러오는 중…" Text
   │  SVG 렌더 예외(E-17-2)  → onFail() → renderFailed=true
   ▼
renderFailed      : <Image source={require('../assets/icons/logo.png')} onError={...}/> + "불러오는 중…" Text
   │  logo.png 로드 실패(onError)
   ▼
mode='spinner'    : <ActivityIndicator/>  (OS 표준)
```

- 어떤 단계든 예외가 상위로 전파되지 않는다(`SvgErrorBoundary` + `<Image> onError` + 방어적 기본값) → **크래시 없음**(E-17-2, AC-34).
- 정적 폴백은 `logo.png`(기존 번들 에셋, P-21) 재사용 — **신규 에셋 없음**. `mode='static'` 은 SVG 가 정상일 때 DuckScene 정지컷을 우선 쓰고, SVG 자체가 실패하면 `renderFailed` 경로로 내려가 `logo.png` 를 쓴다.
- E-17-6(스마트워치): 워치 타깃은 이 컴포넌트를 사용하지 않는다(워치 표준 로딩). 워치 타깃 코드는 현재 리포지토리에 없음 — no-op.

#### 16.9.6 저사양·절전 강등 (E-17-5, P-29, NFR-11, D-06(3))

**신규 의존성 없이** 다음 두 신호로 `degraded`(앱 세션 스코프 in-memory 플래그, 모듈 변수)를 결정한다.

1. **프레임 저하 휴리스틱** — 애니메이션 시작 후 `requestAnimationFrame` 콜백에서 프레임 간격을 롤링 수집(최근 1s 창):
   - 창 평균 간격 > **28ms**(≈ 지속 < 36fps) **또는** 연속 **5프레임** > **50ms** → `degraded = true` → 즉시 `mode='static'` 전환, 이번 세션 동안 유지.
   - 샘플러는 인디케이터가 visible 인 동안만 동작, 언마운트 시 `cancelAnimationFrame`.
2. **Reduce Motion** — `AccessibilityInfo.isReduceMotionEnabled()`(마운트 시) + `AccessibilityInfo.addEventListener('reduceMotionChanged', …)`. true → `mode='static'`(E-17-1, AC-33).

- **배터리 절약 모드 직접 감지 안 함**: RN 코어에 배터리 API 없음. `react-native-device-info` 도입 대신 **실제 관심사(프레임 잔김)를 직접 측정**하는 위 휴리스틱으로 대체 — 절전 모드가 프레임을 떨어뜨리면 (1)이 잡는다. (대안 `react-native-device-info` 검토했으나 단일 목적 네이티브 표면 추가 대비 이득 작아 폐기.)
- 강등은 단방향(세션 내 복구 없음) — 깜빡임 방지.

#### 16.9.7 접근성 (AC-37, P-30, NFR-08)

- 인디케이터 루트 `View`: `accessibilityRole="progressbar"`, `accessibilityLabel`(기본 "불러오는 중"), `accessibilityLiveRegion="polite"`(Android) / iOS 는 라벨만.
- **활동 캡션은 스크린리더에서 숨긴다**: 활동별 텍스트/장면에 `importantForAccessibility="no-hide-descendants"`(Android) · `accessibilityElementsHidden`(iOS). → 활동이 바뀔 때마다 반복 안내되지 않음(P-30, AC-37).
- 정적 폴백의 "불러오는 중…" 시각 텍스트는 라벨 컨테이너 내부에 두어 SR 은 라벨 1회만 읽는다.
- 타임아웃 보조 문구/버튼(`onRetry`/`onCancel`)은 접근성 노출(별도 포커스 대상).

#### 16.9.8 소비 지점 (D-06(4), AC-36, F-17 노출 위치)

| # | 위치 | 파일 | variant | loading 소스 | 비고 |
| --- | --- | --- | --- | --- | --- |
| 1 | 앱 부트스트랩 | `App.tsx` | `fullscreen` | `result === null` (bootstrap 대기) | 현 `<ActivityIndicator/>` 대체. 네이티브 스플래시 종료 후 별도 인디케이터(D-06(4)). 하드 실패는 기존 `SafeModeScreen` 경로 유지 → `onRetry` 미지정 |
| 2 | Dashboard 금일 집계 로딩 | `DashboardScreen.tsx` | `inline` | 최초 `load()` 진행 중(`initialLoading` state — 새로고침/RefreshControl 에는 미사용) | 브랜드·요약·FAB 는 유지, 오늘 목록 영역만 대체(F-17 위치 #2, §16.3.3). `loadError` 시 `endReason='error'` |
| 3 | Calendar 월/기간 전환 로딩 | `CalendarScreen.tsx` | `inline` | `loadingMonth` 신규 state (`load()` 래핑) | 그리드 영역 오버레이. 월 헤더·이동 컨트롤·피커는 계속 조작 가능(F-17 위치 #3) |
| 4 | Search 결과 로딩 | `SearchScreen.tsx` | `inline` | `searching` 신규 state (`search.search()` 래핑) | `startActivity="search"`. 디바운스(250ms) + 지연 게이트(200ms)로 빠른 질의 깜빡임 방지(E-17-3, AC-32) |
| 5 | 대량 캘린더 동기화 | `SettingsScreen.tsx` | — | — | **사용 안 함**(F-17 위치 #5). 기존 진행률 표시 유지 — 본 인디케이터로 진행률 대체 금지 |

- 화면은 `try/finally` 로 loading 플래그를 내리고, 실패 시 `endReason="error"` 전달 → 인디케이터 즉시 제거 후 해당 화면의 에러/재시도 UI 표시(E-17-7, AC-38, 기존 E-02-2 규칙과 결합).
- `onRetry` = 해당 화면 `load()`/`runSearch()` 재호출. `onCancel` = 대기 중단하고 마지막 캐시/빈 상태 표시.
- 서비스 호출·상태 슬라이스·`bindings.ts` 무변경 — 로딩 플래그는 화면 로컬 `useState`.

#### 16.9.9 리소스 해제 (P-31, NFR-11, E-17-2)

- `loading` 이 false 가 되거나 컴포넌트가 언마운트되면 `useEffect` cleanup 에서:
  - 모든 `Animated.loop(...)` 핸들 `.stop()`, `Animated.Value` 참조 해제.
  - `setTimeout`(지연/최소표시/타임아웃) 전부 `clearTimeout`.
  - rAF 프레임 샘플러 `cancelAnimationFrame`.
- 무한 loop 애니메이션이 로딩 종료(성공/실패) 후 계속 도는 상태를 금지(P-31). `degraded` 세션 플래그만 유지.

#### 16.9.10 AC 매핑

| AC | 구현 지점 |
| --- | --- |
| AC-29 브랜드 인디케이터 표시 | §16.9.3 지연 게이트 통과 후 `mode='animation'` — OS 스피너 아님 |
| AC-30 활동 순환 | §16.9.4 `activities.ts` 기본 4활동 순서 loop(인라인 포함) |
| AC-31 최소 표시(깜빡임 방지) | §16.9.3 min-display 600ms(success) |
| AC-32 빠른 로딩 시 미표시 | §16.9.3 delay 200ms + 지연 임계 내 종료 규칙 |
| AC-33 Reduce Motion 정적 폴백 | §16.9.6 `isReduceMotionEnabled` → `mode='static'` + "불러오는 중…" |
| AC-34 렌더 실패 폴백·무크래시 | §16.9.5 `SvgErrorBoundary` → `logo.png` → `ActivityIndicator` |
| AC-35 로딩 종료 시 콘텐츠 표시 | §16.9.3 success + min-display 충족 → `visible=false`, 화면이 콘텐츠 렌더 |
| AC-36 노출 위치 구분 | §16.9.8 `App.tsx` = `fullscreen`, 화면 = `inline` |
| AC-37 접근성 라벨 | §16.9.7 단일 `accessibilityLabel`, 활동 캡션 SR 숨김 |
| AC-38 에러 종료 시 즉시 제거 | §16.9.3 `endReason='error'` → 최소표시 무시 즉시 제거, 화면 에러 UI |

---

### 16.10 SwipeableRow 공통 컴포넌트 (F-04, F-10, E-10-4, E-10-5) — v1.8

`src/app/components/SwipeableRow.tsx`(현재 `screens/` 아래 → `components/` 로 이동 권장 — §16.9.2 계층 규칙: `react`/`react-native` 만 import, `src/core/**`·`bindings.ts` 무의존, 데이터는 props).

- **구현 수단**: RN 내장 `PanResponder` + `Animated`(`useNativeDriver: true`). **신규 의존성 없음**.
  - `react-native-gesture-handler` 검토·**폐기**: (a) 단일 축 수평 팬 + 액션 노출은 `PanResponder` 로 충분, (b) `GestureHandlerRootView` 래핑·`pod install`·Android `MainActivity` 변경·New Arch(N-9) 고려가 한 행 상호작용에 과함, (c) 프로젝트 "네이티브 모듈 최소화" 방침(§16.9.1 reanimated/lottie 폐기와 동일 논리). `overview.md` 기술 스택 표·`nfr.md` 영향 없음.
- **props 계약**: `{ children: ReactNode; onEdit?: () => void; onDelete: () => void }`. F-10 스와이프의 1차 동작은 **삭제**(`onDelete` 필수), 수정은 선택.
- **책임 경계**:
  - SwipeableRow: 팬 제스처 감지, 액션 패널 노출/스냅, 열린 상태에서 본문 탭 시 닫기. `onDelete()`/`onEdit()` 호출 후 스냅 닫기.
  - **삭제 확인(E-10-4)**: 소비 화면이 담당한다. `onDelete` 핸들러가 `Alert.alert` 확인 다이얼로그를 띄우고 — 취소 시 아무 것도 하지 않음(목록 원상복구는 스냅 닫기로 자연 처리) / 승인 시 `ScheduleService.softDelete(id)`.
  - **캘린더 연동 일정(E-10-5, P-08)**: 소비 화면의 `confirmDelete` 가 `schedule.source === 'CALENDAR'` 이면 확인 문구에 "기기 캘린더에서도 삭제할까요?" 옵션을 노출(§3). SwipeableRow 는 출처를 알 필요 없음.
- **접근성(NFR-08)**: 팬 제스처의 대체 경로를 제공한다 — 행에 `accessibilityActions=[{name:'delete'},{name:'edit'}]` + `onAccessibilityAction` 매핑, 또는 상세 화면의 삭제 버튼으로 대체 가능함을 보장(스크린리더 사용자가 스와이프 없이 삭제 가능).
- **소비처**: `DashboardScreen`(F-10 오늘 목록). `CalendarScreen` 선택일 목록은 현재 스와이프 미적용(탭 → 상세에서 삭제) — 확장 시 동일 컴포넌트 재사용.

---

### 16.11 표시 계층의 시각 취급 — Clock 포트 경유 (P-16, P-17, T-04) — v1.8

**규칙**: "현재 시각"과 "로컬 자정(날짜 경계)"은 **모든 계층에서 `Clock` 포트를 경유**한다. 표시 계층(화면 컴포넌트)도 예외가 아니다.

| 허용 | 금지 |
| --- | --- |
| `clock.now()` 로 현재 epoch ms 취득 | `Date.now()` / `new Date()` 로 현재 시각 취득(화면·훅) |
| `clock.startOfLocalDay(clock.now(), clock.timeZone())` 로 오늘 자정 | 화면에서 `d.setHours(0,0,0,0)` 로 로컬 자정 직접 계산 |
| `new Date(ts)` 로 **이미 알고 있는** epoch ms 를 "HH:mm"/달력 셀로 **포맷팅** | — (포맷 전용 사용은 허용) |
| `SystemClock`(어댑터) 내부에서 `Date`/`Intl` 사용 | — |

- **근거**: (a) P-16 시간대 변경·P-17 자정 경계의 결정적 처리, (b) `Clock` 목으로 자정 전후·타임존 케이스 테스트(V-3), (c) `DashboardService`/`ReminderScheduler` 등 코어가 이미 `Clock` 사용 — 표시와 도메인이 같은 "현재"를 공유.
- **배선**: `composeNative`/`buildApp` 이 만든 `SystemClock` 을 `AppContext` 서비스 번들에 포함하고 `useServices().clock` 또는 `useClock()` 훅으로 노출. (코어 무변경 — `Clock` 포트·`SystemClock` 이미 존재.)
- **적용 대상(재설계 코드 정합화)**:
  - `DashboardScreen.todayRange()` → `clock.startOfLocalDay(clock.now(), clock.timeZone())` + `DAY_MS` (`DashboardService` 와 동일 계산).
  - `CalendarScreen` 의 `today = new Date()` → `clock.now()` 파생. 월 그리드 셀 렌더용 `new Date(view.y, view.m, …)` 는 특정 연·월 값 구성이므로 유지(포맷/구성 전용).
  - `ScheduleDetailScreen` 등에서 "지금 기준" 상대 표시가 있으면 `clock.now()` 사용.
- **Tester 관점(T-04)**: 화면 `.tsx`·훅에서 `Date.now()`/`new Date()`(무인자) 직접 호출이 없어야 한다(어댑터·포맷 유틸·`SystemClock` 제외). 정적 grep + 리뷰.

---

## 17. 애플워치 워치 동기화 (F-19, AC-23·AC-47~AC-56, P-36~P-44, NFR-10·NFR-12) — v1.9

로고 오리 로딩(§16.9)과 달리 워치는 **별도 네이티브 타깃**이다. 폰(RN/TS) 측이 스냅샷을 파생·전송하고 워치의 완료 토글을 수신·조정한다. **코어 도메인/서비스(아래 신규분 제외)·DB 스키마·기존 셸 화면·`ReminderScheduler` 무변경.**

### 17.1 타깃 구성 및 경계 (D-09 배경, plan §3.3 A-5, F-19 비범위 "기술 선택")

| 항목 | 결정 | 근거 |
| --- | --- | --- |
| RN 의 watchOS 지원 | RN 은 watchOS UI 를 렌더하지 않음. `react-native-watch-connectivity` 는 **iOS 쪽 `WCSession` 브리지만** 제공(워치에 JS 런타임 없음) | 커뮤니티 현황. Hermes-on-watchOS 임베드는 비표준·중량 → 폐기 |
| `src/core` 재사용 | watchOS 확장에서 순수 TS 실행 불가 → **코드 공유 아님**. 워치 앱은 Swift 로 축소 읽기 모델 재구현 | watchOS 런타임 제약 |
| 공유 자산 | (1) 페이로드 스키마(§17.3), (2) 시각 표현 `epoch ms + IANA tz`(P-39), (3) 상태 표시 규칙(§7.6 — 지남/미완료 구분) | NFR-10 "스키마·동기화 규약을 코어 계층에서 공유" = 계약 수준으로 충족 |
| 워치 앱 구현 | `ios/TodayWhatWatch` (WatchKit App, SwiftUI, watchOS 10+): 오늘 목록·완료 토글·요약 헤더·다음 예정 1건·빈 상태(E-19-5)·"최신 아님"(E-19-1)·"동기화 대기"(D-11) 배지 / `WCSessionDelegate` / 로컬 스냅샷·보류 큐 파일 / LWW(§17.6) | F-19 표시 요소·상호작용 |
| 워치 상호작용 범위 | (a) 오늘 목록 조회, (b) 개별 최소 상세, (c) 완료/미완료 토글, (d) 수동 새로고침 **4종만**(P-43). 생성·수정·삭제·스누즈·검색·유형 관리·설정/테마/캘린더 변경 진입점 없음 — 있으면 "폰에서 계속" 안내만(§17.9 E-19-2) | P-43, AC-51 |
| 번들링/브리지 경계 | 폰: `src/core/watchSync/**`(순수) + `WatchSyncService`(폰측 조정) + `WatchSyncGateway` 포트 ↔ `WatchConnectivityGateway`(iOS 어댑터) ↔ **WCSession** ↔ 워치 Swift 앱. `src/core/watchSync` 는 `react-native` 미import(테스트는 `node:test`) | §16.9.2 계층 규칙과 동일 원칙 |

### 17.2 WatchConnectivity 어댑터 계약 (`WatchSyncGateway` / `WatchConnectivityGateway`)

**전송 메커니즘 선택** — WCSession 3종 API 를 용도별로 사용한다:

| API | 특성 | 본 설계 용도 |
| --- | --- | --- |
| `updateApplicationContext(_:)` | 최신 1건만 유지(이전 것 덮어씀), 상대가 깨어날 때 기회적 전달, 큐잉 없음 | **폰 → 워치 "오늘 스냅샷"** 주 전송. 항상 최신 상태만 필요(P-37 "실시간 스트리밍 불요")하므로 코알레싱이 이점. D-09 (b) 의 "폰 백그라운드 전송" |
| `sendMessage(_:replyHandler:)` | 상대가 **지금 도달 가능**해야 함, 즉시, 응답(ack) 가능 | (1) 워치 포그라운드 진입·수동 새로고침 시 **워치 → 폰 "스냅샷 주세요"** + 폰이 reply 로 최신 스냅샷 (D-09 (b) 즉시 경로). (2) 워치 → 폰 **완료 토글 op** 즉시 전달 + ack |
| `transferUserInfo(_:)` | FIFO 큐, **보장 전달**(앱 재시작·백그라운드에도 유지) | 워치 → 폰 완료 토글 op 의 **폴백**(상대 미도달 시). op 유실 금지(E-19-1) |

- **activation**: 양측 앱 시작 시 `WCSession.default.activate()`. 폰 어댑터는 `activate()` 완료 + `activationState == .activated` 전에는 어떤 전송도 하지 않고 큐에 보관. Android 는 `isSupported()=false`, 모든 메서드 no-op(`GATEWAY_WATCH_UNAVAILABLE` 없이 조용히 skip).
- **reachability**: 폰 어댑터가 `session.isReachable` 관찰. 스냅샷은 항상 `updateApplicationContext`(+도달 시 `sendMessage` 병행). 워치 op 은 `isReachable` 이면 `sendMessage`, 아니면 `transferUserInfo`.
- **폰 측 포트 계약**:
  - `sendSnapshot(snapshot: WatchSnapshot): Promise<void>` — 직렬화 후 `updateApplicationContext`. 실패 → `Logger.warn('watch.snapshot.sent.fail')`, throw 안 함(격리, NFR-12).
  - `onIncomingToggle(cb)` — `didReceiveMessage`/`didReceiveUserInfo` 에서 op 파싱 → `cb(op)`. 파싱 실패한 payload 는 drop + `metric('watch.toggle.malformed')`.
  - `ack(opId, result)` — `sendMessage` 경로면 `replyHandler` 로, `transferUserInfo` 경로면 다음 `updateApplicationContext` 에 `ackedOpIds: string[]` 필드를 실어 전달(워치가 큐에서 제거).
- **폰 측 배선(§16.4 부트스트랩)**: 렌더 후 단계에서 `gateway.activate()` + `gateway.onIncomingToggle(op => watchSyncService.applyIncomingToggle(op))`. 폰 데이터 변경(`create`/`update`/`toggleDone`/`softDelete`/`restore`/캘린더 pull) 후 `dashboard` store 무효화 지점에서 `watchSyncService.pushSnapshot()` 을 **디바운스(예: 500ms)** 호출. `AppState 'active'` 전이 시에도 push.

### 17.3 페이로드 빌더 (`src/core/watchSync/snapshot.ts`, 순수) — P-39, P-40, R-19-4, E-19-6

```ts
interface WatchScheduleItem {
  id: number;
  title: string;            // 원제목 (워치 앱 화면 표시 — P-10-1 알림 마스킹과 무관, §13.9)
  startAt: number;          // epoch ms (UTC) — P-39
  timeZone: string;         // IANA tz (예: 'Asia/Seoul') — P-39, 워치가 표시 시점에만 로컬 변환
  categoryLabel: string;    // 표시 라벨 (삭제된 유형이면 '기타' — E-19-4)
  categoryColor: string;    // '#RRGGBB'
  isHighPriority: boolean;  // 중요도는 "높음"만 표식 (F-19 표시 요소)
  isDone: boolean;
  doneAt: number | null;
  updatedAt: number;        // SCHEDULE.UPDATED_AT — 워치가 op.baseUpdatedAt 로 되돌려 보냄 (§17.6)
}

interface WatchSnapshot {
  builtAt: number;                       // epoch ms — 워치 "최신 아님" 판정·표시
  dayStart: number; dayEnd: number;      // 로컬 자정 경계 (P-17)
  today: WatchScheduleItem[];            // 시작 시각 오름차순, 최대 200건 (초과 시 절단 + truncated=true)
  truncated: boolean;
  nextUpcoming: { id: number; title: string; startAt: number; timeZone: string } | null;  // 다음 예정 1건 (당일 밖 가능)
  summary: { done: number; notDone: number };   // 목록 헤더 카운트 (컴플리케이션 D-10 도 이 값 사용)
  ackedOpIds: string[];                  // 폰이 처리 완료한 op (transferUserInfo 경로 ack)
}
```

- **분리**: `buildWatchSnapshot(todaySchedules, nextUpcomingSchedule, categories, clock)` 는 **순수 매핑 함수**(저장소 미접근, `node:test`). 데이터 fetch 는 `WatchSyncService.pushSnapshot()` 가 수행한 뒤 이 함수에 넘긴다.
- **`WatchSyncService.pushSnapshot()` fetch 규칙(= `DashboardService.getSummary` 와 동일 소스)**:
  - `dayStart = startOfLocalDay(clock.now(), clock.timeZone())`, `dayEnd = dayStart + DAY_MS` (P-17).
  - `todaySchedules` = `ScheduleRepository.findForDashboard(dayStart, dayEnd)`.
  - `nextUpcomingSchedule` = `ScheduleRepository.findInRange(clock.now(), MAX, { isDone:false }, 'startAt', 1)` 의 첫 항목(당일 범위 밖일 수 있음 — P-40 "다음 예정 1건") 또는 null.
  - `categories` = `CategoryRepository.list()`.
  - > `WatchSyncService` 의존성 = `ScheduleRepository` + `CategoryRepository` + `SettingRepository`(dedup 원장) + `Clock` + `ScheduleService`(`toggleDone` 전용) + `WatchSyncGateway` + `Logger`. `DashboardService` 와 동일하게 저장소에 직접 의존한다(읽기), 쓰기만 `ScheduleService` 경유.
- **`buildWatchSnapshot` 매핑 규칙(순수)**:
  - `today` = `todaySchedules` → `WatchScheduleItem` 매핑 + `startAt` 오름차순 정렬. `categoryLabel/Color` 는 `categories` 조인(삭제·미존재 유형 → 시스템 "기타" 라벨·색, E-19-4).
  - `summary.done/notDone` = `today` 에서 계산(`DashboardSummary` 와 일치).
  - `today.length > 200` → 앞 200건 + `truncated=true` + (`WatchSyncService` 가) `metric('watch.snapshot.truncated')`.
- **범위 제한(P-40, E-19-6)**: 오늘 + 다음 1건만. 과거 전체 이력·검색 인덱스·전체 유형 정의 미러링 안 함. `today` 200건 초과 시 앞 200건 + `truncated=true` + `metric('watch.snapshot.truncated')`.
- **알림 데이터 미포함**(P-41, §17.7): REMINDER 관련 필드 없음.
- **크기**: 항목당 ~120B → 200건 ≈ 24KB. `updateApplicationContext` 실무 상한(수십 KB) 내. 초과 위험 시 `title` 을 120자로 절단.

### 17.4 완료 토글 역전파 (`WatchSyncService.applyIncomingToggle`) — AC-23 확장, AC-48, P-36

**워치 → 폰 op 스키마**:

```ts
interface WatchToggleOp {
  opId: string;          // 워치가 생성한 UUID (멱등키)
  scheduleId: number;
  done: boolean;
  watchChangedAt: number;   // 워치에서 토글한 시각 (epoch ms) — LWW 비교값
  baseUpdatedAt: number;    // 워치가 받은 스냅샷 항목의 updatedAt — LWW 기준선 (§17.6)
}
```

**처리 흐름**:

```text
applyIncomingToggle(op):
  1. 입력 검증: opId 문자열(UUID 형식), scheduleId Number.isInteger>0, done 엄격 boolean,
     watchChangedAt/baseUpdatedAt Number.isInteger(유한). 실패 → metric('watch.toggle.malformed'), ack(opId,'REJECTED'), 반환
  2. dedup: appliedOps 원장(APP_SETTING 'watch.appliedOps', 최근 50 {opId,ts})에 opId 존재 → ack(opId,'DUPLICATE'), 반환
  3. schedule = ScheduleRepository.findById(op.scheduleId)
     없음 || deletedAt != null → ack(opId,'NOT_FOUND'), metric('watch.toggle.rejected'), 반환   # E-19-4 준용은 표시 계층, 여기선 거부
  4. decision = resolveToggleLWW(op, schedule)   # src/core/watchSync/reconcile.ts, §17.6
       'APPLY'            → ScheduleService.toggleDone(op.scheduleId, op.done)   # F-05 규칙: done_at 기록, updatedAt 갱신, 집계 반영
       'SKIP_PHONE_WINS'  → 아무 것도 안 함, metric('watch.toggle.lww.phoneWins')
       'REJECT_NOT_FOUND' → 3단계에서 이미 처리
  5. 원장에 {opId, ts: clock.now()} push (링버퍼 50)
  6. ack(opId, decision==='APPLY' ? 'APPLIED' : 'RESOLVED')
  7. watchSyncService.pushSnapshot()   # 워치가 최종 상태로 수렴 (R-19-2/R-19-3)
```

- **`ScheduleService.toggleDone` 재사용** — 완료 시각 기록·즉시 저장·집계 반영은 F-05 규칙 그대로. 폰 대시보드는 `dashboard` store 무효화로 갱신(AC-23/AC-48).
- **원장 저장**: `SettingRepository.set('watch.appliedOps', JSON.stringify(ring))`. `APP_SETTING` k/v 재사용 — **스키마 무변경**(`database.md` §10).
- **폰 → 워치 정상 방향(R-19-3)**: 폰에서 일정 추가·수정·삭제·완료되면 §17.2 배선이 `pushSnapshot()` → 워치는 다음 `applicationContext` 수신 시 목록 갱신(P-37).

### 17.5 보류 큐 · 재시도 (워치 측) — E-19-1, P-38, D-11

- 워치가 완료 토글 → **즉시 워치 화면 카운트 갱신**(낙관적) + 보류 큐(로컬 파일)에 `WatchToggleOp` 추가.
- 전송: `isReachable` → `sendMessage(op, replyHandler)`; 아니면 `transferUserInfo(op)`. `WCSession` 이 재연결 시 자동 flush(transferUserInfo) 하거나, 워치 앱이 포그라운드/`activationDidComplete` 시 큐를 재전송.
- **ack 수신**(replyHandler 또는 `applicationContext.ackedOpIds`) → 해당 `opId` 를 보류 큐에서 제거.
- **"동기화 대기" 배지(D-11 (b))**: 보류 큐가 비어있지 않은 동안 워치 목록 상단에 배지. 큐가 비면 제거. 폰 측 배지·안내는 두지 않음.
- **"최신 아님" 표시(E-19-1)**: `session.activationState != .activated` 또는 마지막 `applicationContext` 수신이 오래됨(임계 [제안] 폰 미도달 상태로 판단) → 목록을 조회 전용처럼 흐리게 + "최신 아님" 라벨. 이 상태에서도 완료 토글은 허용(보류 큐로).
- 워치 앱 미설정/폰 초기화(E-19-2): 폰이 보낸 스냅샷이 없거나 `session` 페어링만 되고 폰 앱이 컨텍스트를 보낸 적 없음 → 워치는 "폰 앱에서 설정을 완료해 주세요" 안내만.

### 17.6 LWW 충돌 해소 (`src/core/watchSync/reconcile.ts`, 순수) — E-19-3, P-38, AC-50, N-12

```ts
function resolveToggleLWW(op: WatchToggleOp, schedule: Schedule):
  'APPLY' | 'SKIP_PHONE_WINS' | 'REJECT_NOT_FOUND' {
  if (schedule.deletedAt != null) return 'REJECT_NOT_FOUND';
  // 폰이 스냅샷 이후 이 일정을 건드리지 않았으면 워치 변경을 그대로 적용
  if (schedule.updatedAt <= op.baseUpdatedAt) return 'APPLY';
  // 폰이 이후 변경함 → 더 나중 타임스탬프가 이김 (P-38 Last-Write-Wins)
  return op.watchChangedAt > schedule.updatedAt ? 'APPLY' : 'SKIP_PHONE_WINS';
}
```

- **타임스탬프 기준**: 기존 `SCHEDULE.UPDATED_AT`(epoch ms, `toggleDone`·`update` 가 이미 매 변경 시 `clock.now()` 로 갱신) + op 의 `baseUpdatedAt`(워치가 받은 스냅샷 항목의 `updatedAt`). **신규 컬럼 없음**(N-12, `database.md` §10).
- **정밀도**: epoch ms. 동시(=같은 ms)면 폰 우선(`SKIP_PHONE_WINS`) — 결정적.
- **AC-50 충족**: 양쪽이 각각 완료 상태를 바꾼 경우 둘 다 `updatedAt`/`watchChangedAt` 를 남기므로 더 나중 값이 최종. 워치가 오프라인에서 먼저 토글하고 폰이 나중에 토글 → `watchChangedAt < schedule.updatedAt` → 폰 승 → 최종값은 더 나중 변경(폰). 반대면 워치 승.
- **잔여 부정확(N-12, residual risk)**: 폰이 스냅샷 이후 *완료와 무관한* 필드(제목 등)를 편집하면 `updatedAt` 이 올라가고, 그 시각이 `watchChangedAt` 보다 나중이면 워치의 완료 토글이 `SKIP_PHONE_WINS` 로 드롭된다. 이 경우 다음 `pushSnapshot()` 이 폰 상태를 워치에 반영하므로 데이터 정합은 유지되나 사용자의 워치 토글이 반영 안 될 수 있다. 베스트-에포트(NFR-12) 허용 범위로 보고 필드 수준 정밀 LWW(전용 `DONE_CHANGED_AT` 컬럼, 스키마 변경)는 후속으로 미룬다.

### 17.7 전역 알림 게이트와 워치의 관계 — P-41, E-19-7, AC-52

- **알림 예약·발송 주체 = 폰**(`ReminderScheduler`, §6). 워치 앱은 알림을 **독립 예약하지 않는다** — 워치 스냅샷 페이로드에 REMINDER 데이터가 없다(§17.3).
- 페어드 워치의 알림 노출은 **iOS 기본 미러링**에 위임. 앱은 이를 우회·중복 생성하지 않는다.
- **전역 "알림 사용" off(P-32)** → §6 게이트가 폰에서 OS 예약을 만들지 않음/기존분 `CANCELLED` → 미러링할 알림이 없음 → **워치에도 알림 없음**(E-19-7). **추가 코드 없음** — 기존 §6 동작만으로 성립.
- `ReminderScheduler`/`syncOnce()`/`applyGlobalNotificationsToggle` **무변경**. 워치 동기화는 알림 경로와 완전히 분리된 채널이다.

### 17.8 컴플리케이션 — 조건부 설계 섹션 (D-10) — AC-56, P-42, OI-12

> **이 섹션은 D-10 = "포함" 으로 확정된 경우에만 구현한다.** 미결/후속이면 워치 타깃에서 컴플리케이션 확장을 제외하고(코드 없음) AC-56 을 검증 대상에서 뺀다.

- **범위**: **"오늘 남은(미완료) 일정 수" 1종**만. 다종·커스터마이즈 없음(P-42, OI-12 후속).
- **구현**: `ios/TodayWhatWatch Complication/` — WidgetKit(권장, watchOS 9+) 또는 ClockKit. 데이터 소스 = 워치 로컬에 저장된 마지막 `WatchSnapshot.summary.notDone`. 별도 폰 로직·페이로드 필드 추가 없음(이미 §17.3 `summary` 에 포함).
- **갱신**: 워치가 `applicationContext` 수신 시 `WidgetCenter.shared.reloadAllTimelines()`. 스냅샷 없으면 "—" 표시.
- **상호작용**: 탭 → 워치 앱 실행만. 그 외 동작 없음(P-42).
- **폰 영향**: 없음. 스냅샷 빌더·전송 경로 재사용.

### 17.9 예외 매핑 (E-19-1 ~ E-19-7)

| 예외 | 처리 |
| --- | --- |
| E-19-1 폰 연결 불가 | 워치: 마지막 `applicationContext` 스냅샷을 "최신 아님" 배지와 함께 조회 전용처럼 표시. 완료 토글은 보류 큐로(§17.5) → 재연결 시 `transferUserInfo` flush |
| E-19-2 폰 앱 미설치/로그아웃/초기화 | 워치: 폰이 스냅샷을 보낸 적 없음 → "폰 앱에서 설정을 완료해 주세요" 안내만. 목록·토글 UI 미표시 |
| E-19-3 워치 보류 변경 ↔ 폰 최신 상태 충돌 | `resolveToggleLWW`(§17.6) — 더 나중 타임스탬프 승(LWW). 폰이 이후 변경 & 워치가 더 나중 → APPLY, 아니면 SKIP_PHONE_WINS |
| E-19-4 워치 참조 유형이 폰에서 삭제됨 | `buildWatchSnapshot` 이 `categoryLabel='기타'`·시스템 색으로 매핑(E-06-2 준용). op 처리에는 영향 없음(유형은 토글 대상 아님) |
| E-19-5 오늘 일정 0건 | 스냅샷 `today=[]` → 워치 "오늘 일정이 없습니다" 빈 상태. **일정 추가 버튼 없음**(생성 폰 전용) |
| E-19-6 동기화 대상 과다 | `today` 200건 절단 + `truncated=true` + `metric('watch.snapshot.truncated')`. 과거 이력·검색 인덱스·전체 유형 미러링 안 함(P-40) |
| E-19-7 워치 알림 표시 | §17.7 — 폰이 예약, iOS 미러링. 전역 알림 off 면 워치에도 없음 |

### 17.10 AC 매핑

| AC | 구현 지점 |
| --- | --- |
| AC-23 / AC-48 워치 완료 토글이 폰 대시보드 집계에 반영 | §17.4 `applyIncomingToggle` → `ScheduleService.toggleDone` → `dashboard` store 무효화 |
| AC-47 워치 오늘 목록 표시(시각순·최소 상세·헤더 카운트) | §17.3 `buildWatchSnapshot.today`(정렬·필드)·`summary` |
| AC-49 오프라인 조회 + 보류 큐 | §17.5 "최신 아님" 표시 + 보류 큐 + 재연결 flush |
| AC-50 오프라인 충돌 LWW | §17.6 `resolveToggleLWW` |
| AC-51 워치 비범위 동작 차단 | §17.1 — 4종 상호작용만, 그 외 진입점 없음/"폰에서 계속" |
| AC-52 알림 예약 주체 = 폰 | §17.7 — 워치 무예약, iOS 미러링, off 시 없음 |
| AC-53 워치 페이로드 범위 | §17.3 오늘 + 다음 1건, 과거/검색 미전송 |
| AC-54 워치 빈 상태 | §17.9 E-19-5 — 안내만, 추가 버튼 없음 |
| AC-55 Wear OS 제외 | Android 어댑터 no-op, Wear 모듈 미생성(P-44). overview 영향 범위 |
| AC-56 워치 컴플리케이션(D-10 결정 시) | §17.8 조건부 섹션 — "포함" 시 "오늘 남은 일정 수" 1종, 탭 시 앱 실행 |
