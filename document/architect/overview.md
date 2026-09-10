# 설계 개요 — 일정관리 앱 "오늘뭐해"

| 항목 | 값 |
| --- | --- |
| 문서 종류 | 설계 총괄 (Overview) |
| 버전 | v1.14 |
| 상태 | 작성 완료 (Developer 착수 가능) |
| 근거 기획서 | `document/planner/plan.md` v1.7 |
| 작성 주체 | Architect |

## 변경 이력

| 버전 | 일자 | 변경 내용 |
| --- | --- | --- |
| v1.14 | 2026-09-10 | **설계 델타 — F-19 watchOS 네이티브 앱 타깃 `TodayWhatWatch` 구현 착수** (사용자 요청: "앱 내용을 Apple Watch(watchOS)에서도 표시 + 시뮬레이터로 워치 화면 확인"). 기획 재검증 **PASS** — F-19·R-19-1~7·E-19-1~7·P-36~P-44·AC-47~AC-56·D-09~D-11 이 plan v1.7 에 확정되어 있고, plan §F-19 비범위가 "워치 타깃 구성 방식·RN watchOS 지원·브리지/WCSession 전송·번들링 = 전부 Architect 설계 범위"로 명시 → 워치 앱 자체를 구현 수준으로 설계 가능(신규 제품 요구사항 0). 폰 측(`src/core/watchSync/**` + `WatchSyncService` + `src/app/adapters/watch/**` + `composeNative` 배선)과 공유 페이로드 계약은 v1.9 에서 이미 설계·구현·검증 완료 — 이번 델타는 **누락돼 있던 watchOS 앱 본체**(`ios/TodayWhatWatch/` 부재, `TodayWhat.xcodeproj` 에 워치 타깃·스킴 0)에 한정. 결정: (1) **타깃 구성** — 이름 `TodayWhatWatch`(기존 문서 참조와 일치), **단일 타깃 watchOS 앱**(SwiftUI `App` 라이프사이클 + `WKApplicationDelegateAdaptor`; 레거시 WatchKit App+Extension 폐기 — Xcode 14+ 표준), 번들 ID `kr.purpledog.todaywhat.watchkitapp` + `WKCompanionAppBundleIdentifier=kr.purpledog.todaywhat`, 배포 타깃 **watchOS 10.0**(설치된 watchOS 26.2 시뮬레이터가 전부 초과), Info.plist 최소 키, iOS 앱에 "Embed Watch Content" 임베드 + 타깃 의존성, 시뮬레이터 코드사이닝 생략(`CODE_SIGNING_ALLOWED=NO`), 공유 스킴 `TodayWhatWatch`. (2) **pbxproj** — 손편집 금지, `xcodeproj` Ruby gem 스크립트(멱등) 또는 Xcode GUI 1회 후 커밋. 워치 타깃은 **Podfile 밖**(RN Pod 미링크 — watchOS 링크 불가), 시스템 프레임워크만(`WatchConnectivity`/`SwiftUI`/`Foundation`, D-10 시 `WidgetKit`). 기존 `TodayWhat.xcworkspace` 공유. (3) **Swift 레이아웃** `ios/TodayWhatWatch/**` — 엔트리·`WCSessionDelegate`·`Codable` 모델(=`src/core/watchSync/types.ts` 미러)·로컬 스냅샷/보류 큐 JSON(`FileProtectionType.complete`)·LWW Swift 미러·뷰(오늘 목록·요약 헤더·다음 예정·빈 상태 E-19-5·"최신 아님" E-19-1·"동기화 대기" D-11 배지·pull-to-refresh). (4) **검증(이번 릴리스)** — `xcodebuild -scheme TodayWhatWatch` + 페어드 시뮬레이터 설치·실행·실제 WCSession 라운드트립·`xcrun simctl io screenshot`. Metro cwd-patch 는 iOS JS 전용 — 순수 네이티브 워치 앱 무관. `logic.md` v1.14(§17.11 신설·§17.1 표·§13.9 보안 델타·§14 정합성·§15 N-11 축소) / `nfr.md` v1.12(§11.1 로 watchOS 앱 빌드·시뮬레이터 설치/실행/라운드트립 이동·§11.2/N-11 실기기 잔여만·§14 갱신) / `database.md` v1.6(§10 말미 "구현 착수 확인" — **스키마 무변경**) 동반 개정. **`src/core/**`·`src/app/**`(TS)·공유 계약·DB DDL·포트·`bindings.ts`·기존 폰 화면 무변경** — 산출물은 `ios/` 네이티브 타깃 + Swift 소스뿐. 「API 설계」 섹션 미신설 |
| v1.13 | 2026-09-10 | **설계 델타 — 통계 화면(F-23) 하단 "유형별 월별 할 일 건수" 그래프를 막대(bar) → 선(line) 그래프로 교체** (사용자 요청). plan v1.7 §F-23(line 604/784)이 "그래프의 구체 형태(막대/누적/그룹/**꺾은선** 등)"를 Architect 설계 위임으로 규정하고 불변 3요건(① 유형별 구분 ② x축 1~12월 ③ 선택 1개 연도)만 요구 → **plan 델타 없음, 기획 재검증 PASS**. **프레젠테이션 한정 델타**: (1) 「주요 기술 결정」 #9 — "정적 12-버킷 막대(순수 `<View>` 높이 비율)" → "정적 선 그래프(기보유 `react-native-svg` 15.x `Polyline` 계열당 1개 + 비영 점 `Circle` 마커 + `<Line>` 축)". **신규 npm 의존성 0** 유지(react-native-svg 는 F-17 도입분). 순수 `<View>` 회전 세그먼트로는 다중 계열 대각 선분의 서브픽셀 이음새·가독성 확보가 어려워 `Polyline` 채택. (2) F-23 집계 계약 전면 불변 — `statisticsViewModel.ts`(`aggregateTotals`/`aggregateYear`/`monthBoundaries`/`monthIndexOf`/`statisticsEmptyState` …) 시그니처·`YearAggregate` 반환 형태·§7.2 데이터 소스·`start_at` 월 버킷·삭제 유형→"기타"(E-23-5)·rename(R-23-4)·빈 상태(E-23-1~4) 그대로. y축 스케일값(`seriesPointMax`)은 `YearAggregate` 로부터 화면이 순수 파생(뷰모델 필드 미추가). (3) 변경 파일 = `src/app/screens/StatisticsScreen.tsx` 렌더 계층만(필요 시 `statisticsViewModel.ts` 에 기존 export 를 건드리지 않는 신규 순수 헬퍼 1개). `src/core/**`·DB·포트·`bindings.ts`·네비게이션·기존 단위 테스트 무변경. `logic.md` v1.13(§7.2.2/§7.2.7 y스케일 주석·§16.3.8 하단 그래프 렌더 재작성·접근성·§13.3/§13.8 보안·§14 정합성) / `nfr.md` v1.11(§16.2 차트 렌더 비용 재작성·§16.3 접근성·§16.6 검증 포인트) 동반 개정. **`database.md` 무변경(v1.5 유지)** — 쿼리·인덱스 동일, 시각화는 DDL 무관. 「API 설계」 섹션 미신설 |
| v1.12 | 2026-09-10 | **설계 델타 — 세 번째 탭 "검색" → "통계" 교체 + 통계 화면(F-23) 신규** (plan.md v1.7, F-23·P-54~P-58·R-23-1~4·E-23-1~5·AC-69~AC-76·D-20~D-23·§5.16·§7.12). **기획 검증 PASS** — D-20~D-23 은 plan §8 이 "가정값으로 설계·구현 진행 가능"으로 규정한 **비차단** 게이트. 채택 가정값: **D-20**(a) 캘린더 화면 헤더 검색 아이콘을 F-11 전역 검색 진입점으로 이전(F-11 로직·필터·AC-13/14 무변경, P-54) / **D-21**(a) 상단 카드 = 전체 기간 누적·하단 그래프 연도와 비연동(삭제분 제외, P-55) / **D-22**(a) 반복 카운트 = 개별 인스턴스(F-10 대시보드·F-02 캘린더와 동일 조회 경로 → 자동 일치, P-58) / **D-23**(a) 월 버킷 기준일 = 일정 시작일(`start_at`), 로컬 자정 경계(P-56). 주요 결정: (1) **탭 네비게이션** — Bottom Tab 3번째 `SearchTab` → `StatisticsTab`(라벨 "통계", 아이콘 `statistics.png` 매핑 유지 — F-16/AC-26). `SearchScreen` 은 삭제하지 않고 **Stack 화면으로 이전**, `CalendarScreen` 헤더 검색 아이콘에서 진입(D-20(a)). (2) **F-23 집계 = 순수 뷰모델** — `src/app/screens/statisticsViewModel.ts`(신규, `dashboardViewModel.ts` 패턴) 가 기존 `ScheduleService.findInRange` 결과(저장 행, soft-deleted 제외)를 인메모리 집계. 상단 카드 = `findInRange(0, Number.MAX_SAFE_INTEGER, …)` cursor 루프 전건 count / 완료 count. 하단 그래프 = `findInRange(yearStartTs, yearEndTs, …)` cursor 루프 + `start_at` 로컬 월 버킷(코어 순수 `time.ts` `localWallToEpoch` 재사용) + `categoryId` 그룹. 유형 라벨·색 = `CategoryService.list()`(현재 참조 상태 — 삭제 유형은 이미 "기타" 재지정 E-06-2/E-23-5, rename 은 ID 참조로 자동 반영 R-23-4). (3) **차트 수단 = 신규 npm 의존성 없음** — 정적 12-버킷 막대는 순수 RN `<View>` 높이 비율(ProgressLine 기법)로 구현, 축·눈금 필요 시 **이미 보유한 `react-native-svg` 15.x** 재사용. 애니메이션·인터랙션 없음(OI-23 범위 밖). (4) **`src/core/**` 무변경** — 포트·서비스·도메인·DB DDL 무변경. 집계는 전부 `src/app` 계층. (5) **선택 연도 = `StatisticsScreen` 로컬 state**(기본 = 올해, 비영속 — `APP_SETTING` 키 없음). 포커스 시 재조회(R-23-3). **신규 의존성 없음**. `logic.md` v1.12(§7.2 신설·§8 진입점 이전·§16.2 탭/스택·§16.3 바인딩·§16.3.8 신설·§16.9.8 #6·§13.3/§13.8 보안·§14/§15) / `database.md` v1.5(§12 신설 — 스키마 무변경) / `nfr.md` v1.10(§16 신설 — 차트 렌더·대량 집계·접근성·Reduce Motion, V-46~V-49) 동반 개정. 「API 설계」 섹션 미신설(신규/외부 API 없음). OI-22(카드 완료율 병기)=설계 결정 "미병기(카드 2장만)"로 확정 / OI-26(F-17 노출 위치)=통계 화면 인라인 소형 추가 |
| v1.11 | 2026-09-09 | **설계 델타 — 대시보드("오늘" 탭) 개선 재확정 방향** (plan.md v1.6). 조정자가 방향을 재확정하여 Planner 가 plan 을 v1.6 으로 개정: **F-20** 날짜 네비게이션에 "시각적으로 작게(컴팩트)" 요건 추가(규칙 유지), **F-21** 개수 카드 2장 → **진행률 한 줄**("M / N 완료" 텍스트 + 얇은 progress bar 1개, 채움 = 완료율 P-07; 미래 날짜는 bar·완료 수 숨기고 총 개수만 — P-52 / D-19(a)), **F-22** 상시 인라인 입력창 → **접이식 검색**(검색 아이콘 탭 → 펼침, 기본 접힘; 화면 로컬 state `searchExpanded` 기본 false — P-53; 접으면 검색어 초기화 + 필터 해제 — D-18(a); "오늘로" 복귀·탭 이탈·앱 재시작 시 접힘 + 검색어 초기화). 신규 AC-67(검색 토글)/AC-68(미래 날짜 진행률), AC-60/61 재작성, AC-62~66 접이식 개정, E-21-4/E-22-6/E-22-7 신규. **기획 검증 PASS** — D-18/D-19 는 Planner 가 비차단·가정값(초기화 / 총 개수만)으로 규정한 게이트, 가정값으로 설계 진행. D-14(개수 카드 구성)는 plan v1.6 에서 (d) "진행률 한 줄"로 **CLOSED**. **델타는 전부 UI 계층 한정** — 코어 도메인/서비스/포트/DB DDL/`ReminderScheduler`/`DashboardService.getSummary(referenceDate)`/`ScheduleService.findInRange` 무변경. 검색은 로드된 배열 대상 순수 표시 필터. 진행률 한 줄도 `getSummary` 의 `total`/`done` 재사용 — 새 집계·쿼리 없음. Developer 변경분: `DashboardScreen.tsx` + `ProgressLine.tsx`(구 `CountCards.tsx` 대체) + `dashboardViewModel.ts` 순수 헬퍼(`isFutureDate`, `stepReferenceDate` DASH-01 정정 반영). `bindings.ts`·`routes.ts`(`presetDate?` 유지) 무변경. **DASH-01 문서 정정(직전 Tester 캐리오버, Low)**: `logic.md §16.3.7` 날짜 스텝 예시식 `+ dir*HALF_DAY`(dir=-1 에서 그저께로 이동) → **방향 무관 `+ HALF_DAY`**, 예시가 `clock.startOfLocalDay()` 를 부르던 서술을 `Clock` 포트(now/timeZone만)에 맞춰 순수 `src/core/domain/time.ts` `startOfLocalDay` 직접 사용으로 정정. `logic.md` v1.11 / `nfr.md` v1.9(§15 "개수 카드"→"진행률 한 줄", 접이식 토글 접근성) / `database.md` v1.4(§11 무변경 재검토). 「API 설계」 섹션 미신설. 캐리오버 DASH-02(AC-46 렌더 잔여 — F-17 별도 트랙)·DASH-03(`findInRange` cursor 루프 미적용 — 기존부터 존재)은 범위 밖으로 미결/후속에 명시만 |
| v1.10 | 2026-09-09 | **설계 델타 — 대시보드("오늘" 탭) 개선: F-20 날짜 탐색 / F-21 개수 카드 / F-22 날짜별 인라인 검색** (plan.md v1.5, P-45~P-51, AC-57~AC-66). 기획 검증 **PASS**(D-12~D-17 은 기획이 가정값을 지정한 비차단 게이트 — 가정값으로 설계 진행, 게이트 형식상 OPEN). 주요 결정: (1) **상태 소유권** — 대시보드 `referenceDate`(기준 날짜, 로컬 자정 epoch)와 `inlineQuery`(인라인 검색어)는 `DashboardScreen` 로컬 React state. 영구 저장·Zustand 슬라이스·`APP_SETTING` 키 없음(P-45/P-50). (2) **서비스/셀렉터 시그니처 무변경** — `DashboardService.getSummary(dateTs?)` 는 이미 기준일 파라미터를 받고, `ScheduleService.findInRange(from,to,…)` 는 이미 임의 범위를 받는다 → 대시보드가 `today` 고정 대신 `referenceDate` 를 인자로 넘기는 것만으로 일반화 완료. **코어 도메인/서비스 무변경**. (3) **개수 카드(F-21)** = `getSummary(referenceDate)` 결과의 `total`/`done` 재사용 — 새 집계 규칙·추가 쿼리 없음(P-47). 완료율·유형별 분포·다음 예정은 요약 상세 영역에 존치(AC-46 회귀 방지). (4) **인라인 검색(F-22)** = 이미 로드된 `items`(≤ `DASHBOARD_PAGE_SIZE`) 배열에 대한 **표시 계층 순수 필터**(제목+메모, 트림+소문자, D-15). 개수 카드/요약 셀렉터 미적용(P-49/D-16). 완료 토글·삭제·자동 갱신 후 파생 재계산으로 검색어 자동 재적용(E-22-3). SQL·서비스 호출 없음 → 주입 표면 없음. (5) **F-11 경계**: 인라인 검색 상태는 `DashboardScreen` 로컬, `SearchScreen` 은 `search` 슬라이스 — 전파 없음(P-51). (6) **자정 롤오버(P-46)**: `AppState 'active'`·포커스 시 이전 `todayStart` 대비 판별해 "오늘을 보고 있었으면 새 오늘로 이동, 아니면 유지" — 기존 E-10-2 로직 통합. (7) **신규 API/DB 변경 없음** — `logic.md` v1.10(§7.1 신설·§16.3.7 신설·§16.3.3 레이아웃 갱신·§13.3 인라인 검색 보안 노트·§14/§15 갱신). `database.md` v1.3(§11 무변경 검토). `nfr.md` v1.6(§15 신설·V-41~V-43). **코어(`src/core/**`)·DB DDL·포트 계약·`ReminderScheduler`/`DashboardService`/`ScheduleService` 로직 무변경**, `bindings.ts` `DashboardScreen.reads` 에 `dashboard.getSummary` 명시 추가(logic v1.8 지시 반영). 「API 설계」 섹션 미신설 |
| v1.9 | 2026-09-08 | **설계 델타 — F-19 애플워치(watchOS) 워치 타깃 착수** (plan.md v1.4, NFR-10 승격). 기획 검증 PASS(D-09/D-10/D-11 은 기획이 가정값을 지정한 비차단 게이트 — 가정값으로 설계 진행, 게이트 형식상 OPEN). 주요 결정: (1) **워치 타깃 구성 = 네이티브 WatchKit(SwiftUI) 독립 앱 타깃 신규 + "공유 도메인 *계약*"(코드 공유 아님)**. RN 은 watchOS UI 를 렌더하지 않고 `src/core` 순수 TS 는 watchOS 확장에서 실행 불가 → 워치 앱은 Swift 로 축소 읽기 모델(오늘 목록 렌더·LWW·보류 큐)을 재구현하되, **페이로드 스키마·시각 표현(epoch ms + IANA tz, P-39)·상태 규칙(§7.6)** 을 폰과 공유한다. 폰(RN/TS) 측은 `src/core/watchSync/`(순수 스냅샷 빌더 + 역전파 조정) + iOS 네이티브 WatchConnectivity 브리지 모듈을 추가한다. (2) **전송 메커니즘**: 폰→워치 스냅샷 = `updateApplicationContext`(최신 1건만 유지·병합) + 도달 가능 시 `sendMessage` 즉시 갱신(D-09 (b)); 워치→폰 완료 토글 = `sendMessage`(도달 시 즉시·ack) → 실패/미도달 시 `transferUserInfo`(FIFO 보장 전달) + 워치 보류 큐 유지. (3) **LWW(E-19-3/P-38)** = 기존 `SCHEDULE.UPDATED_AT` + 스냅샷 `baseUpdatedAt` 기준 비교 — **공유 스키마 무변경**. 중복 적용 방지 원장은 `APP_SETTING` k/v(`watch.appliedOps` 링버퍼) 재사용. (4) **컴플리케이션(D-10)** = `logic.md` §17.8 조건부 설계 섹션("오늘 남은 일정 수" 1종)으로 분리. (5) **알림(P-41)**: 워치 독립 예약 없음 — `ReminderScheduler` 무변경, 워치 페이로드에 알림 데이터 미포함, iOS 기본 미러링에 위임. (6) **신규 npm 의존성**: `react-native-watch-connectivity` 1.x(iOS WC 브리지) — Android 미지원이므로 iOS 전용 부분 채택, 필요 시 커스텀 네이티브 모듈로 대체 가능. `logic.md` v1.9(§0.1 포트·§17 신설·§13.9 보안)·`database.md` v1.2(§10 스키마 영향 검토)·`nfr.md` v1.7(§14 워치 동기화·V-36~V-40) 동반 개정. **코어 도메인/서비스/포트(watchSync 외)·DB DDL·기존 셸 화면 무변경** |
| v1.8 | 2026-09-07 | **설계 델타 — v1.3 재설계분 정식화(F-06 유형 관리 / F-10 상호작용형 대시보드 / F-18 앱 설정)** (plan.md v1.3). 기획 검증 PASS(D-07·D-08은 사용자가 방향 (B) 확정하며 기본안 채택 — 비차단, 이해관계자 추인만 대기). 주요 결정: (1) **대시보드 데이터 소스 = 요약 서비스 병행 유지** — `DashboardService.getSummary`(요약 표시요소) + `ScheduleService.findInRange`(오늘 목록 행) 두 경로. 재설계 코드가 요약까지 `findInRange` 파생으로 바꾼 것을 되돌려 정합화(T-02). (2) **로고·태그라인 회귀 복구**(T-01) — §16.3.2 렌더 규약을 상호작용형 대시보드 레이아웃(브랜드 / 요약 / 오늘 목록 / 상시 FAB)에 명시. (3) **유형 스키마 = ID 참조 확정**(이미 그러함), 이름 유일성(트림 + 대소문자 무시)·기본 유형("기타") 보호·rename 계약을 `CategoryService`에 추가 — **DB 스키마 무변경**(`IS_SYSTEM` 기존, `CANCELLED` state 기존, `APP_SETTING` k/v). `database.md` v1.1(스키마 무변경 검토 섹션 추가). (4) **전역 알림 토글 게이트 = `ReminderScheduler.syncOnce()` 단일 지점** + 신규 `applyGlobalNotificationsToggle(enabled)`(off 전환 시 기존 예약 일괄 취소 — D-07 (a); on 복귀 시 무회귀). (5) **페이지네이션 설계값 승격** — 하드코딩 200/500 → `DASHBOARD_PAGE_SIZE=100` / `CALENDAR_MONTH_PAGE_SIZE=200`(+월당 최대 10페이지) / `SEARCH_PAGE_SIZE=50`, keyset cursor `(start_at,id)` 유지(T-05). (6) **표시 계층 시각도 Clock 포트 경유** 규칙 명시(T-04, P-16/P-17). (7) **신규 의존성 없음** — `SwipeableRow`는 RN 내장 `PanResponder`+`Animated` 유지, `react-native-gesture-handler` 도입 안 함. `logic.md` v1.8(§5.1 유형 관리 계약·§6 알림 게이트·§7 대시보드·§10 설정 키·§16.3 바인딩·§16.3.3~16.3.5 신설·§16.10 SwipeableRow·§16.11 표시 시각)·`nfr.md` v1.6·`database.md` v1.1 동반 개정 |
| v1.7 | 2026-09-07 | **설계 델타 — F-17 브랜드 오리 로딩 인디케이터** (plan.md v1.2). 기획 검증 PASS(D-06 5건은 정책 미결이 아니라 기술/UX 튜닝값 — 기획이 Architect 위임, 가정값 확정으로 설계 진행, D-03~D-05와 동일 취급). 렌더 수단 결정: **A안 `react-native-svg` 15.x 신규 도입 + RN 내장 `Animated`(useNativeDriver) 루프** (B/C/D 폐기 — 근거 `logic.md` §16.9.1). 기술 스택 표에 `react-native-svg` 15.x 추가, 「주요 기술 결정」 #7 추가. D-06 세부 설계값 확정: 표시 지연 200ms / 활동 노출 2500ms·전환 300ms / 최소 표시 600ms / 타임아웃 보조안내 10s / 인라인 72dp·풀스크린 160dp / 인라인도 전체 활동 순환 / 부트스트랩은 네이티브 스플래시 후 별도 풀스크린 인디케이터(스플래시 미연장). 저사양·절전 판정 = 신규 의존성 없이 rAF 프레임 저하 휴리스틱 + `AccessibilityInfo` Reduce Motion. `logic.md` v1.7(§16.9 신설, §16.7 보안 노트)·`nfr.md` v1.5(§13 로딩 애니메이션 성능, V-27~V-30) 동반 개정. **코어(`src/core/**`)·DB 스키마·포트 계약·`bindings.ts` 무변경** — `database.md` v1.0 유지. |
| v1.0 | 2026-09-04 | 신규 규약(overview/logic/database/nfr 4종)에 따른 최초 설계. 2026-09-02 구버전(7종 + 별도 보안 문서)은 폐기하고 재작성 |
| v1.6 | 2026-09-06 | **설계 델타 — N-10 해소: 날짜/시각 네이티브 DateTimePicker 도입** (plan.md v1.1 F-01). 기술 스택 표에 `@react-native-community/datetimepicker` 8.6.0 추가. 「주요 기술 결정」 #6 개정(텍스트 입력 → DateTimePicker). 영향 범위 신규 §v1.6 추가. 미결정 N-10 (1) 해소. `logic.md` v1.6(§16.3.1 날짜/시각 입력 방식·필드 매핑·보안 노트) 동반 개정. `nfr.md` v1.4(§7 국제화·§9 V-26·§12 N-10) 동반 개정. DB 스키마·포트 계약·코어 서비스 무변경. 기획 검증 PASS |
| v1.5 | 2026-09-06 | **설계 델타 — F-16 앱 아이덴티티 UI** (plan.md v1.1). 탭 바 아이콘(todo/goal/statistics/settings.png) 및 대시보드 헤더 로고(logo.png)·태그라인(tagline.png) 적용. `logic.md` §16.2 탭 아이콘 설계·§16.3 DashboardScreen 헤더 설계·§16.3.2 로고/태그라인 렌더링 규약 추가. 코어·DB·포트 계약 무변경. 기획 검증 PASS |
| v1.4 | 2026-09-04 | **설계 델타 — "일정 추가/수정 화면 연결"(Feature)**. 기존 `ScheduleEditorScreen` 이 `RootStack` 에 등록만 되고 호출부가 없어 도달 불가 + 폼이 스켈레톤(제목 + raw epoch). 델타: (1) `logic.md` §16.2 진입 엣지(Dashboard/Calendar `headerRight`「+」→ `ScheduleEditor {}`, `ScheduleDetail`「편집」→ `ScheduleEditor { scheduleId }`), (2) `logic.md` §16.3 표 확장 + 신규 §16.3.1(F-01 필드 매트릭스: 제목/시작·종료 일시/유형/우선순위/메모/반복 — 서비스 매핑·코어 검증 코드·인라인 `field`·저장 후 4-슬라이스 무효화+`goBack`), (3) **날짜/시간 입력**: RN 코어에 date 컴포넌트 없음 + 빌드 호스트 디스크 고갈로 네이티브 픽커(`@react-native-community/datetimepicker`) **미도입** — `YYYY-MM-DD`/`HH:mm` 텍스트 입력 + `Clock.timeZone()` 기반 epoch ms 변환(순수 함수)으로 AC-01~03 충족, 픽커 교체는 후속 N-10. **포트 계약(`ScheduleService.create/update/getById`, `CategoryService.list/create`) 무변경**, `database.md` v1.0 유지(스키마 무변경), `routes.ts`/`bindings.ts` 는 이미 계약 반영. `logic.md` v1.4·`nfr.md` v1.3 동반 개정. 기획 재검증 PASS(F-01/F-03/AC-01~03 내 UI 연결, 신규 제품 요구사항 없음; D-05 반복 게이트는 단순 반복 가정값으로 진행 — 비차단) |
| v1.1 | 2026-09-04 | 코어 계층(`src/core/**`) 구현·검증 완료 반영. **React Native 앱 셸 + 코어 포트용 네이티브 어댑터 설계 델타** 추가(신규 §"클라이언트 셸 아키텍처", "빌드 환경 제약과 파이프라인 검증 전략"). `database.md`는 스키마 무변경으로 v1.0 유지. 기획 재검증 결과 PASS(신규 제품 요구사항 없음) |
| v1.3 | 2026-09-04 | **Bug Fix 설계 델타 (RENDER-003)** — iOS 앱이 대시보드에 도달하지 못하고 Safe Mode 에 안착하는 버그. 확정 원인: op-sqlite 9.x `execute(sql, params)` 가 **positional `?` 배열 전용**이며 named 파라미터(`:name`/`$name`/`@name`)를 어떤 API 로도 지원하지 않음 → 리포지토리 헬퍼가 named 파라미터 객체를 넘기면 내부 `params.map` 호출에서 `TypeError: params?.map is not a function`, 첫 실패 지점은 부트스트랩 `load-settings`(`SqliteSettingRepository.get()`). 구현 방식(Orchestrator 확정): `OpSqliteDb.native.ts` 어댑터에 named→positional 변환 shim 추가 — 리포지토리 SQL 은 named 바인딩 유지, 어댑터가 실행 직전 `:name` → `?` 치환 + 값 객체를 위치 배열로 정렬(이름당 슬롯 1개 dedup·최초 등장 순서, 문자열/주석 내 `:` 스킵). "코어 포트 → 네이티브 어댑터 매핑" 각주에 1줄 추가. **포트 계약(`UnitOfWork`/`MigrationDb`/`Repository` 시그니처) 무변경** — shim 은 어댑터 내부 구현. `database.md` v1.0 유지(바인딩 표기 무언급 → 개정 불요). `logic.md` v1.3(§13.3/§16.5/§16.1/§14) 동반 개정. 부수: `SafeModeScreen` 이 `failedAt < 0`(부트스트랩 예외)와 실제 마이그레이션 실패를 구분해 문구를 분기하도록 `logic.md` §16.1 에 구현 권고 기록. 기획 재검증 PASS(기확정 요구사항 F-01~F-15 내 버그 수정, 신규 제품 요구사항 없음) |
| v1.2 | 2026-09-04 | **Bug Fix 설계 델타** — `@op-engineering/op-sqlite` 버전 핀을 `6.x` → `9.x`(9.3.x)로 상향. 근거: 실제 온디바이스 iOS 빌드 검증 환경(Xcode 26.2 / clang) 도입 결과 op-sqlite 6.2.x `cpp/types.h`가 `<vector>` 미include로 컴파일 불가(전이 include 불허). 9.x에서 헤더 정합 수정 + RN 0.74 peer 호환(`react-native: >0.73.0`) + 구아키텍처(`newArchEnabled=false`) 지원 유지. 설계 의도(SQLite 로컬 저장소, sync/async·prepared statement·SQLCipher 옵션) 불변. 부수: 9.x JS 래퍼가 `QueryResult.rows`를 평면 배열로 반환(6.x는 `{_array}`) — §"코어 포트 → 네이티브 어댑터 매핑" 각주에 반영. 포트 계약(`UnitOfWork`/`MigrationDb`/`Repository`) 무변경. 기획 재검증 PASS(신규 제품 요구사항 없음). `logic.md` v1.2(§16.5/§13.6/§16.8)·`nfr.md` v1.2(§11 iOS 빌드·실행을 정식 검증으로 이동) 동반 개정, `database.md`는 v1.0 유지(스키마 무변경) |

---

## 설계 개요

- **기능 목적**: 개인이 일정을 등록·분류·완료 관리하고, 일정 전/정시에 로컬 알림을 받으며, 금일 현황을 대시보드로 파악하고, 검색·테마·계정 연동·기본 캘린더 연동을 사용하는 오프라인 우선 모바일 앱.
- **설계 대상**: 신규 시스템 전체. 클라이언트(React Native) + 로컬 저장소(SQLite) + OS 연동(로컬 알림 / 기본 캘린더 / OAuth).
- **변경 범위**: 저장소는 현재 `src/index.ts` 스캐폴드뿐이므로 신규 구축. 서버 컴포넌트는 이번 범위 없음(기획 게이트 D-01 = (c) 가정).

---

## 기획 검증 결과

### v1.14 재검증 (plan.md v1.7 — F-19 watchOS 네이티브 앱 타깃 `TodayWhatWatch` 구현 착수)

**결과: PASS (설계 가능, Planner 재작업 불필요 — plan 델타 없음)**

| 검증 항목 | 판정 | 비고 |
| --- | --- | --- |
| 원본 사용자 요청 반영 | OK | "앱 내용을 Apple Watch(watchOS)에서도 표시" + "시뮬레이터로 워치 화면 확인" → F-19(축소 읽기 클라이언트 + 완료 토글) + AC-47/AC-23/AC-48 검증. plan §10 매핑에 F-19·P-36~P-44·NFR-10(착수)·NFR-12·E-19-1~7·AC-47~56·D-09~D-11·§7.10 등재(plan v1.4~). 워치 화면 표시 요소·상호작용 4종·진입 형태 모두 F-19 에 확정 |
| 워치 앱 자체가 구현 수준으로 설계 가능한가 | OK | plan §F-19 "비범위 — 기술 선택: 워치 타깃 구성 방식·RN watchOS 지원 여부·브리지/WCSession 전송 방식·코어 로직 번들링 = **전부 Architect 설계 범위이며 본 기획에서 확정하지 않는다**". 즉 타깃 형태·배포 타깃·번들 ID·pbxproj 편집·Swift 레이아웃은 설계 재량. 표시 요소(제목/시작시각/유형/완료상태/중요도 표식/헤더 카운트/다음 예정 1건)·상호작용(조회·최소 상세·완료 토글·수동 새로고침)·빈 상태(E-19-5)·배지(E-19-1/D-11)는 기획이 확정 → 화면을 그릴 수 있음 |
| 폰 측 계약 존재 여부 | OK | `src/core/watchSync/{types,snapshot,reconcile}.ts` + `WatchSyncService` + `src/app/adapters/watch/{watchMessage,WatchConnectivityGateway.native}.ts` + `composeNative` 배선이 v1.9 설계로 이미 구현·검증(V-36~V-40). 이번 델타는 이 계약을 소비하는 watchOS 앱 본체만 — 신규 폰 로직·계약 변경 0 |
| 입력·출력·상태변화·예외 | OK | R-19-1~4·E-19-1~7·P-36~P-44 전부 §17(§17.1~§17.10)에 설계 완료. §17.11 은 그 위에 타깃·파일·바인딩·빌드 절차만 얹음 |
| 비기능 요구사항 | OK | NFR-10(착수)·NFR-12(베스트-에포트·격리·오프라인 보류 큐) — `nfr.md` §14 기존. §11.1 로 watchOS 앱 빌드·시뮬레이터 설치/실행/라운드트립/스크린샷 이동(환경에 watchOS 26.2 시뮬레이터 + Xcode 확보) |
| 요구사항 충돌 | 없음 | P-41(알림 예약=폰) ↔ 워치 무예약 정합(§17.7). E-17-6(워치는 오리 로딩 미사용) ↔ 워치 표준 로딩. A-2(워치 독립 저장소 없음) ↔ 워치 로컬은 "캐시"(마지막 스냅샷) + 보류 큐뿐, SoT 는 폰 |
| 가정/확정 구분 | OK | D-09(b)/D-10("1종 포함" 가정, §17.8 조건부 — 이번 스크린샷 검증엔 불필요)/D-11(b) 전부 plan 이 가정값 지정한 비차단 게이트. 이번 델타는 D-10 을 "선택"으로 두고 워치 앱 본체만 구현 |
| Acceptance Criteria 검증 가능성 | OK | AC-47(오늘 목록)·AC-23/AC-48(토글 역전파)·AC-49~AC-51·AC-54·AC-55 = 시뮬레이터 페어 + `xcrun simctl` 로 검증 가능. AC-56 은 D-10 결정 시에만 |
| 미결정 게이트 영향 | **비차단** | D-09/D-10/D-11 게이트 형식상 OPEN, 전부 가정값으로 설계·구현 진행. N-11 은 v1.14 에서 "앱 타깃 빌드 + 시뮬레이터 설치/실행/라운드트립"을 이번 릴리스 검증으로 승격, 실기기 엣지만 잔여 |

### v1.13 재검증 (plan.md v1.7 — F-23 하단 그래프 막대 → 선 시각화 변경)

**결과: PASS (설계 가능, Planner 재작업 불필요 — plan 델타 없음)**

| 검증 항목 | 판정 | 비고 |
| --- | --- | --- |
| 그래프 형태가 Architect 설계 위임인가 | OK | plan v1.7 §F-23 line 604 "**그래프의 구체 형태(막대 / 누적 막대 / 그룹 막대 / 꺾은선 등)** … 는 Architect 설계에 위임한다" + line 784 "그래프의 구체 형태 … 는 **Architect 설계에서 확정**한다" + line 629/959 "구체 차트 유형 … — Architect 설계 범위". "꺾은선(line)" 이 위임 예시로 명시되어 있어 막대→선 변경은 설계 재량 범위. |
| 불변 3요건이 선 그래프로 충족되는가 | OK | ① 유형별 구분 = 계열(유형)당 색상 있는 `Polyline` + 범례(텍스트+스와치), ② x축 1~12월 = 12눈금 고정, ③ 선택 1개 연도 = `selectedYear` 기준 `aggregateYear`. 세 요건 모두 유지. |
| 요구사항 델타 여부 | 없음 | 상단 카드·연도 선택·집계 모수(D-21)·월 버킷(D-23)·반복 카운트(D-22)·빈 상태(E-23-1~5)·rename(R-23-4)·AC-69~AC-76 문언 변화 없음. AC-71 은 이미 "그래프의 구체 형태는 설계"로 명시. |
| 미결정/정책 신설 여부 | 없음 | 신규 게이트·SLO·정책 없음. OI-23(인터랙션·애니메이션 범위 밖) 그대로 준수. |

### v1.12 재검증 (plan.md v1.7 — 세 번째 탭 "검색"→"통계" 교체 + 통계 화면 F-23)

**결과: PASS (설계 가능, Planner 재작업 불필요)**

| 검증 항목 | 판정 | 비고 |
| --- | --- | --- |
| 원본 사용자 요청 반영 | OK | 사용자 원문("세 번째 메뉴 '검색'을 '통계'로 변경 … 상단 총/완료 건수 카드 2장 … 하단 특정 연도의 유형별 할 일 건수를 월별 그래프")이 F-23 목적·표시 요소·Action·Result 로 구체화. plan §10 매핑에 F-23·P-54~P-58·R-23-1~4·E-23-1~5·AC-69~AC-76·D-20~D-23·§5.16·§7.12 등재. F-16 탭 매핑/AC-26 정정, F-11 "v1.7 처리 방침" 항목 추가는 개정 지시 범위 내 |
| 기능 목적/범위/시나리오 | OK | F-23 상단 카드 2장(총/완료, 전체 기간 누적) + 하단 선택 연도 유형별 월별 그래프(x축 1~12월, 유형별 구분, 1개 연도). 연도 선택 UI(기본 올해). §7.12 9단계 시나리오. F-11 진입점 이전(캘린더 헤더, D-20 가정) |
| 입력·출력·상태변화·예외 | OK | R-23-1~4(진입 표시·연도 전환 시 카드 불변·데이터 변경 후 갱신·rename 반영), E-23-1(0건)/E-23-2(유형 없음)/E-23-3(선택 연도 0건 — 카드 유지)/E-23-4(로드 실패)/E-23-5(삭제 유형 → "기타", E-06-2 준용). 그래프 구체 형태·색·축·인터랙션은 기획이 Architect 위임 |
| 비기능 요구사항 | OK | 신규 정량 SLO 없음. 차트 렌더·대량 일정 집계 비용·접근성(그래프 대체 텍스트/스크린리더)·Reduce Motion 은 `nfr.md` §16 으로 구체화 |
| 요구사항 충돌 | 없음 | 상단 카드(전체 누적, D-21) ↔ 하단 그래프(선택 연도) = 역할 분리, 연동 안 함(P-55/R-23-2). 삭제 유형(E-23-5) ↔ 유형 이름변경(R-23-4) = 둘 다 "현재 유형 참조 상태" 반영(P-57)으로 일관. F-11 유보(P-54) ↔ 검색 탭 제거 = 진입점만 이전, 로직·AC-13/14 무변경 |
| 가정/확정 구분 | OK | F-23 "확정". D-20~D-23 은 plan §8 이 "본 기획의 가정값으로 설계·구현을 진행할 수 있다"고 규정한 **비차단** 게이트(각 (a) 가정값 명시). D-20 은 네비게이션 구조·AC-13/14/76 검증 대상 여부에 영향 → 착수 초기 이해관계자 확인 권장(BLOCK 아님) |
| Acceptance Criteria 검증 가능성 | OK | AC-69~AC-76 Given/When/Then. AC-70(연도 바꿔도 카드 10/4 유지)·AC-73(빈 상태/선택 연도 0건 문구 구분)·AC-74(삭제 유형 "기타" 합산)·AC-75(rename 계열 라벨)·AC-76(캘린더 헤더에서 F-11 진입, D-20 확정 종속) 검증 가능 |
| 미결정 게이트 영향 | **비차단** | **D-20~D-23** 전부 가정값으로 설계 진행. D-20(전역 검색 진입점/완전 제거 여부)은 AC-13/14/76 의 이번 릴리스 검증 대상 여부를 좌우 → 착수 초기 확인 권장. D-21(카드 집계 범위)·D-23(월 버킷 기준일)은 통계 수치 의미를 좌우 → 착수 초기 확인 권장. BLOCK 아님 |

**D-20~D-23 게이트 미결정 — 가정값 채택 (게이트 형식상 OPEN, 이해관계자 추인 대기)**:

| 게이트 | 채택 가정값 (plan v1.7) | 설계 반영 |
| --- | --- | --- |
| D-20 세 번째 탭 교체 후 F-11 전역 검색 진입점 위치 | (a) 캘린더 화면(F-02) 헤더 검색 아이콘 | `CalendarScreen` `headerRight` 에 검색 아이콘 → `navigate('Search')`(Stack). `SearchScreen` 은 Tab → Stack 화면으로 이전, F-11 로직·필터·정렬·E-11-1/2·P-11/P-12·AC-13/AC-14 **무변경**(P-54). `logic.md` §8/§16.2. (d)"완전 제거" 확정 시 Stack 등록·캘린더 아이콘 제거 + AC-13/14/76 이번 릴리스 검증 제외 |
| D-21 상단 요약 카드 집계 범위 | (a) 전체 기간 누적, 하단 그래프 연도와 비연동 (삭제분 제외) | 카드 = `ScheduleService.findInRange(0, Number.MAX_SAFE_INTEGER, …)` cursor 루프 전건. "총" = 전건 count, "완료" = `isDone` count. 연도 선택은 하단 그래프만 재조회(R-23-2/AC-70/AC-72). `logic.md` §7.2 |
| D-22 통계 건수의 반복 일정 카운트 단위 | (a) 개별 인스턴스(반복 회차 포함), 대시보드/캘린더와 동일 | 통계는 F-10 대시보드·F-02 캘린더와 **동일한 `ScheduleService.findInRange` 저장 행**을 센다 → 반복 카운트 단위가 자동으로 일치(P-58). 현 구현은 반복 마스터 1행 = 1건(범위 조회가 회차를 확장하지 않음); 향후 범위 조회에 회차 확장이 추가되면 통계도 같은 경로로 자동 승계. `logic.md` §7.2 |
| D-23 하단 그래프 월 버킷 판정 기준일 | (a) 일정 시작 일시(`start_at`), 로컬 자정 경계 | 월 버킷 = `start_at` 이 속한 로컬 달. 뷰모델이 선택 연도의 13개 월 경계 epoch 를 순수 `localWallToEpoch(year, m, 1, 0, 0, clock.timeZone())`(`src/core/domain/time.ts`, 이미 공개·app 계층 사용 중)로 계산 후 각 행을 버킷팅. 생성일·완료 시각 아님(P-56). `logic.md` §7.2 |

### v1.11 재검증 (plan.md v1.6 — 대시보드 개선 재확정 방향: F-20 컴팩트 / F-21 진행률 한 줄 / F-22 접이식 검색)

**결과: PASS (설계 가능, Planner 재작업 불필요)**

| 검증 항목 | 판정 | 비고 |
| --- | --- | --- |
| 원본 사용자 요청 반영 | OK | v1.5 요청("화살표로 어제·내일" / "총·완료 개수 카드형식" / "오늘 일정에서 검색")을 조정자가 재확정한 방향으로 개정. F-20 "작게" 요건, F-21 "진행률 한 줄", F-22 "접이식(아이콘 토글)". plan §10 매핑에 F-20~F-22·P-45~P-53·E-20-1~5·E-21-1~4·E-22-1~7·AC-57~AC-68·D-12~D-19·OI-15~OI-21·§5.15·§7.11 등재 |
| 기능 목적/범위/시나리오 | OK | F-20(±1일 + "오늘로", 컴팩트 배치), F-21("M / N 완료" + progress bar 1개; 미래 날짜는 총 개수만 — P-52), F-22(검색 아이콘 탭 펼침, 기본 접힘 — `searchExpanded` 로컬 state P-53; 접힘 시 검색어 초기화 + 필터 해제 — D-18). §7.11 8단계 흐름 재작성. F-10 화면 구조 = 브랜드 → 날짜 네비(작게) → 진행률 한 줄 → 접이식 검색 → 요약 상세 → 리스트 → FAB |
| 입력·출력·상태변화·예외 | OK | E-21-4(미래 날짜 진행률 표시)·E-22-6(검색창 접힘 시 초기화)·E-22-7(펼친 채 탭 이탈/재시작) 신규. 기존 E-20-x/E-21-1~3/E-22-1~5 유지·문구 정정. AC-60/61 재작성(카드→진행률 한 줄), AC-62~66 접이식 개정, AC-67(토글)/AC-68(미래 날짜) 신규 — 전부 Given/When/Then |
| 비기능 요구사항 | OK | 신규 정량 NFR 없음. 데이터 소스 동일(`getSummary`/`findInRange` 재사용) → 성능 영향 낮음. 접이식 토글 관련 모션·접근성(포커스 이동, progress bar 접근성 레이블)은 `nfr.md` §15 로 구체화. 날짜 라벨 로캘 = NFR-09 |
| 요구사항 충돌 | 없음 | 진행률 한 줄 ↔ 요약 상세 = 공존(완료율은 요약 상세 존치, P-47/AC-46). 접이식 검색(F-22) ↔ 전역 검색(F-11) = 독립(P-51/AC-66). 진행률 한 줄 ↔ 접이식 검색 = 검색어가 수치·bar 를 바꾸지 않음(P-49/D-16/E-21-3). 미래 날짜 완료 체크(F-05/P-06)와 P-52 = "진행률 한 줄에는 미반영, 요약 상세 완료율은 기존대로"로 명시 분리(OI-21) |
| 가정/확정 구분 | OK | F-20~F-22 "확정". D-18(접힘 시 검색어 처리)·D-19(미래 날짜 진행률)는 plan §8 이 "본 기획의 가정값으로 설계·구현을 진행할 수 있다"고 규정한 **비차단** 게이트(D-18(a) 초기화+필터 해제 / D-19(a) 총 개수만). D-14 는 v1.6 에서 (d) 진행률 한 줄로 CLOSED |
| Acceptance Criteria 검증 가능성 | OK | AC-57~AC-68 Given/When/Then. AC-67(아이콘 탭 ↔ 접힘 토글·포커스 이동)·AC-68(미래 날짜 "일정 N건"만, 오늘·과거 복귀 시 복원) 검증 가능 |
| 미결정 게이트 영향 | **비차단** | **D-18·D-19** 가정값으로 설계 진행 가능. D-12(상태 지속 범위)·D-18·D-19 는 레이아웃·상태 관리·지표 의미에 직접 영향 → 착수 초기 이해관계자 확인 권장. BLOCK 아님 |

**D-14 (CLOSED) / D-18·D-19 (가정값 채택, 게이트 형식상 OPEN — 이해관계자 추인 대기)**:

| 게이트 | 상태 / 채택값 | 설계 반영 |
| --- | --- | --- |
| D-14 개수 카드 구성 | **CLOSED (plan v1.6)** — (d) "진행률 한 줄"(텍스트 + progress bar 1개) | `CountCards.tsx` → `ProgressLine.tsx`(`logic.md` §7.1.2 / §16.3.7). 카드 2장 폐기. 완료율은 요약 상세 존치(P-47/AC-46) |
| D-18 접이식 검색창 접을 때 검색어·필터 | (a) 접으면 검색어 초기화 + 필터 해제 (가정값) | `toggleSearch()` 가 `searchExpanded=false` 시 `setInlineQuery('')` (`logic.md` §7.1.3 / §16.3.7, E-22-6). (b) "유지" 확정 시 접힘 시 보존·재펼침 복원으로 화면 로직만 조정 |
| D-19 미래 기준 날짜의 진행률 한 줄 표시 | (a) 총 일정 수만 표시(완료율·progress bar 숨김) (가정값) | `isFutureDate(referenceDate, todayStart)` 순수 표시 조건 → `<ProgressLine isFuture>` "일정 N건" (`logic.md` §7.1.2, P-52, E-21-4, AC-68). `getSummary` 집계 경로 무변경 |

**캐리오버(이번 v1.11 범위 밖, 미결/후속에 명시)**:

- **DASH-01 (직전 Tester, Low)** — `logic.md §16.3.7` 날짜 스텝 예시식이 `dir=-1` 에서 목표일을 하루 더 지나침(그저께 이동). 구현은 이미 방향 무관 `+ HALF_DAY` 쿠션으로 교정되어 4개 tz + 봄/가을 DST 왕복 테스트 통과. → **이번 v1.11 에서 예시식·서술을 정정**(방향 무관 `+ HALF_DAY`, 순수 `time.ts` `startOfLocalDay` 직접 사용). **해소**.
- **DASH-02 (직전 Tester, Low)** — 재설계 코드의 AC-46 브랜드·유형별 분포·다음 예정 렌더 잔여 정합은 F-17 별도 트랙 — 이번 범위 밖, `logic.md` §15 / §16.3.3 표에 명시만.
- **DASH-03** — `DashboardScreen` 의 `findInRange` cursor 루프 미적용(현 구현 단일 페이지 `DASHBOARD_LIST_LIMIT=200`)은 v1.10 이전부터 존재. §16.3.5 설계값(`DASHBOARD_PAGE_SIZE=100` + cursor 루프)과 불일치 — 별도 후속. 이번 범위 밖, `logic.md` §15 에 명시만.

### v1.10 재검증 (plan.md v1.5 — 대시보드 F-20 날짜 탐색 / F-21 개수 카드 / F-22 날짜별 인라인 검색)

**결과: PASS (설계 가능, Planner 재작업 불필요)**

| 검증 항목 | 판정 | 비고 |
| --- | --- | --- |
| 원본 사용자 요청 반영 | OK | "오늘 메뉴에서 화살표로 어제·내일" → F-20 / "총 일정·완료 일정 개수 카드형식" → F-21 / "검색 기능으로 오늘 일정에서 검색" → F-22. plan §10 커버리지 매핑에 F-20~F-22·P-45~P-51·E-20-1~5·E-21-1~3·E-22-1~5·AC-57~AC-66·D-12~D-17·OI-15~OI-19·§5.15·§7.11 등재 |
| 기능 목적/범위/시나리오 | OK | F-20(좌/우 화살표 ±1일 + "오늘로" 복귀), F-21(기준 날짜 총·완료 카드), F-22(기준 날짜 목록 내 제목·메모 실시간 필터). §7.11 8단계 사용자 흐름. F-10 화면 구조에 4개 신규 영역 위치 명시(브랜드→날짜 탐색→개수 카드→인라인 검색→요약 상세→목록→FAB) |
| 입력·출력·상태변화·예외 | OK | E-20-1(이동 범위 D-13)·E-20-2(로드 실패)·E-20-3(자정 경과)·E-20-4(연속 탭)·E-20-5(탭 재진입/재시작 리셋), E-21-1~3(0건·로드 실패·검색 무관), E-22-1~5(0건 문구 구분·날짜 이동 시 검색어 유지·목록 변동 재적용·공백만·0건 입력창 처리) |
| 비기능 요구사항 | OK | 신규 NFR 없음. 날짜 라벨 로캘 = NFR-09. 원거리 날짜 조회 = `idx_schedule_start` 범위 쿼리(CalendarScreen 월 조회와 동형, NFR-04). 실시간 필터 = ≤ `DASHBOARD_PAGE_SIZE` 인메모리 필터. `nfr.md` §15 로 구체화 |
| 요구사항 충돌 | 없음 | 개수 카드 ↔ 요약 상세 = 공존 확정(P-47/AC-46). 인라인 검색(F-22) ↔ 전역 검색(F-11) = 독립 명시(P-51/AC-66). 자정(P-46) ↔ 기존 E-10-2 = 통합 정의. 인라인 검색 ↔ 개수 카드/요약 = 미반영 확정(P-49/D-16) |
| 가정/확정 구분 | OK | F-20~F-22 "확정". D-12~D-17 은 기획이 가정값을 명시하고 "본 기획의 가정값으로 설계·구현을 진행할 수 있다"(plan §8 주석)고 규정한 **비차단** 게이트 |
| Acceptance Criteria 검증 가능성 | OK | AC-57~AC-66 Given/When/Then. AC-59(자정+다른 날짜)·AC-65(날짜 이동 시 검색어 유지) 포함 |
| 미결정 게이트 영향 | **비차단** | **D-12~D-17** 모두 가정값으로 설계 진행 가능. D-14(카드 구성)·D-12(기준 날짜 지속 범위)는 레이아웃·상태 관리에 직접 영향 → 착수 초기 이해관계자 확인 권장. BLOCK 아님 |

**D-12~D-17 게이트 미결정 — 가정값 채택(게이트 형식상 OPEN, 이해관계자 추인 대기)**:

| 게이트 | 채택 가정값 (plan) | 설계 반영 |
| --- | --- | --- |
| D-12 기준 날짜 상태 지속 범위 | (a) 탭 이탈·앱 재시작 시 항상 오늘로 리셋 | `referenceDate`/`inlineQuery` = `DashboardScreen` 로컬 state. 마운트 시 `startOfLocalDay(now)`, 탭 이탈→재진입·앱 재시작 시 리셋(`resetDashboardView()`). ScheduleDetail/Editor 로의 Stack push·복귀는 리셋 아님(같은 탭 흐름). `logic.md` §16.3.7 |
| D-13 날짜 이동 범위 제한 | 무제한 | 화살표 항상 활성. 원거리 날짜 = `findInRange` 인덱스 범위 쿼리(성능 우려 낮음, `nfr.md` §15). 제한 도입 시 경계에서 해당 방향 화살표 비활성(E-20-1) |
| D-14 개수 카드 구성 | (a) 카드 2장(총 일정 / 완료) | 개수 카드 = `getSummary(referenceDate).total` / `.done` 2장. 완료율(%)·유형별 분포·다음 예정은 요약 상세 영역 존치(P-47/AC-46). `logic.md` §16.3.7 |
| D-15 인라인 검색 대상 필드 | 제목 + 메모 (유형명 미포함) | 필터 술어 = `norm(title).includes(q) \|\| norm(memo??'').includes(q)`, `norm(s)=s.trim().toLowerCase()`. 유형명은 F-11(P-12)·유형 필터가 담당. `logic.md` §16.3.7 / §7.1 |
| D-16 인라인 검색의 카드·요약 반영 | 반영 안 함(카드 = 날짜 전체) | 인라인 필터는 "오늘 일정 목록" 렌더에만 적용. `getSummary` 재호출·카드 수치·요약 상세는 검색어 무관(P-49). `logic.md` §7.1 |
| D-17 날짜 이동 시 검색어 처리 | 유지 후 재적용 | 좌/우 화살표 이동 = `inlineQuery` 보존, 새 `items` 에 파생 재적용(E-22-2/AC-65). "오늘로" 복귀·탭 이탈·앱 재시작 시 초기화(P-50). `logic.md` §16.3.7 |

**미결 게이트에 딸린 소규모 설계 판단(비차단, Planner 가시화용)**:

- **"다음 예정 일정"(요약 상세)의 기준일 스코프**: `DashboardService.getSummary` 는 `total`/`done`/`completionRate`/`byCategory` 를 `dateTs`(=`referenceDate`) 로 스코프하지만 `nextScheduleId`("다음 예정")는 기존 코어 구현대로 **현재 시각(`clock.now()`) 기준의 실제 다음 예정**을 반환한다. "다음 예정"은 특정 날짜 지표가 아니라 전방 참조 도우미이므로 기준일이 과거/미래여도 "지금 이후의 다음 예정"을 그대로 보여준다. 기준일 스코프 "다음 예정"이 필요하면 코어 `getSummary` 확장(스키마 무변경, 후속) — 이번 사이클은 코어 무변경 유지. AC-16/AC-46 회귀 없음.
- **OI-19 (과거/미래 기준일에서 FAB 추가 시 시작 일시 프리필)**: `referenceDate !== todayStart` 인 상태에서 FAB/"일정 추가" → `navigate('ScheduleEditor', { presetDate: referenceDate })`. 신규 모드 기본 시작 일시 = `referenceDate + 9h`(해당 날짜 09:00 로컬), 그 외엔 기존 `now + 1h`. `routes.ts` 의 `ScheduleEditor` 파라미터에 `presetDate?: number` 추가(선택). `logic.md` §16.3.1 기본값 규칙 각주. 저장·검증 규칙 무변경.

### v1.9 재검증 (plan.md v1.4 — F-19 애플워치(watchOS) 워치 타깃)

**결과: PASS (설계 가능, Planner 재작업 불필요)**

| 검증 항목 | 판정 | 비고 |
| --- | --- | --- |
| 원본 사용자 요청 반영 | OK | "애플워치(watchOS) 워치 타깃 추가" → F-19(축소 읽기 클라이언트 + 완료 토글). plan §10 커버리지 매핑에 F-19·P-36~P-44·NFR-10(개정)·NFR-12·E-19-1~7·AC-23·AC-47~56·D-09~D-11·§7.10 등재 |
| 기능 목적/범위/시나리오 | OK | F-19 표시 요소(오늘 목록 + 다음 예정 1건, 최소 상세)·상호작용(조회·완료 토글·수동 새로고침 4종, P-43)·진입 형태(워치 앱 본체 + D-10 컴플리케이션 유보)·§7.10 사용자 흐름 |
| 입력·출력·상태변화·예외 | OK | R-19-1~4(스냅샷 표시·역전파·폰 변경 반영·시각 표현), E-19-1~7(연결 불가·폰 미설정·충돌 LWW·유형 삭제·0건·대량·알림), P-36(방향)·P-37(갱신 시점)·P-38(오프라인·LWW)·P-39(시각)·P-40(페이로드 범위)·P-41(알림 주체) |
| 비기능 요구사항 | OK | NFR-10 "후속 가정"→"이번 릴리스 착수" 승격, NFR-12(베스트-에포트·연결 실패가 폰 저해 안 함·오프라인 조회·보류 큐) 신규. `nfr.md` §14·§3·§8·§11.2 연계 |
| 요구사항 충돌 | 없음 | P-41(알림 예약 주체=폰) ↔ 기존 `ReminderScheduler` 설계 = 접점만, 워치 무예약으로 정합. E-17-6(워치는 오리 로딩 미사용) ↔ 워치 표준 로딩. 워치 쓰기 = 완료 토글 1종(P-43) ↔ 폰 SoT(A-2) |
| 가정/확정 구분 | OK | A-2(독립 저장소 없음)·A-5(WatchConnectivity 주 대상) 확정. D-09(갱신 트리거 (b))·D-10(컴플리케이션 "1종 포함")·D-11(역전파 지연 노출 (b) "동기화 대기") 는 기획이 가정값 지정한 **비차단** 게이트 |
| Acceptance Criteria 검증 가능성 | OK | AC-23(확장)·AC-47~AC-56 Given/When/Then. AC-56 은 D-10 결정 시에만 검증 대상 |
| 미결정 게이트 영향 | **비차단** | **D-09/D-10/D-11** 모두 기획서가 가정값을 명시했고 "본 기획의 가정값으로 설계·구현을 진행할 수 있다"(plan §8 주석)고 규정. 전송 메커니즘·컴플리케이션 범위·오프라인 UX 노출 수준은 기술/UX 결정으로 Architect 위임. D-10 은 산출물 범위에 영향 → `logic.md` §17.8 조건부 섹션으로 분리하고 착수 초기 이해관계자 확인 권장. BLOCK 아님 |

**F-19 관련 미확정(반려 아님, 가정값으로 설계 진행)**:

| 게이트 | 가정값(plan) | 설계 반영 |
| --- | --- | --- |
| D-09 워치 갱신 트리거 조합 | (b) 포그라운드 진입 + 수동 새로고침 + 폰 백그라운드 전송 수신 | `logic.md` §17.2 — `updateApplicationContext`(폰 백그라운드 전송) + `sendMessage`(포그라운드·수동). 주기 폴링 미도입(OI-13) |
| D-10 컴플리케이션 이번 범위 포함 | "1종 포함"("오늘 남은 일정 수") | `logic.md` §17.8 **조건부 설계 섹션** — 포함 시 ClockKit/WidgetKit 단일 컴플리케이션, 미결 시 워치 타깃 멤버십에서 제외(코드 없음). AC-56 검증 대상 여부는 D-10 확정에 종속 |
| D-11 역전파 지연/실패 노출 수준 | (b) 워치에 "동기화 대기" 표시 | `logic.md` §17.5 — 보류 큐 비어있지 않은 동안 워치 목록에 "동기화 대기" 배지. 폰 배지·안내는 미도입 |

### v1.8 재검증 (plan.md v1.3 — 작업트리 재설계분 정식화)

**결과: PASS (설계 가능, Planner 재작업 불필요)**

| 검증 항목 | 판정 | 비고 |
| --- | --- | --- |
| 원본 사용자 요청 반영 | OK | 파이프라인 미경유 재설계분(Dashboard/Calendar/Settings/CategoryManager/SwipeableRow)을 요구사항으로 승격. plan §10 커버리지 매핑에 F-06 재정의·F-18·§5.13 등재 |
| 기능 목적/범위/시나리오 | OK | F-06(지정 + 전용 관리 화면: 추가/이름변경/삭제), F-10(브랜드 / 요약 / 오늘 목록 / 상시 FAB — 상호작용형), F-18(전역 알림 토글 + 새 일정 기본값). §7.8/§7.9 사용자 흐름 |
| 입력·출력·상태변화·예외 | OK | E-06-3~E-06-6(빈 이름/중복 이름/기본 유형 보호/삭제 실패 복구), E-10-1~E-10-6(빈 상태·자정·토글 실패·삭제 취소·캘린더 일정·로드 실패), E-18-1~E-18-3(권한 거부·삭제된 기본 유형·저장 실패) |
| 비기능 요구사항 | OK | 기존 NFR-01~11 유지. 페이지네이션·프레임·마스킹 목표에 신규 요구 없음 (설계값만 구체화) |
| 요구사항 충돌 | 없음 | AC-15 "FAB + 빈 상태 버튼 병존" 확정(T-06 해소). P-32(알림 on/off)와 P-10-1(제목 노출)은 독립으로 명시 |
| 가정/확정 구분 | OK | F-06/F-10/F-18 "(가정)"→"확정". D-07·D-08은 기본안 채택하되 게이트 상태 OPEN(이해관계자 추인 대기)로 유지 |
| Acceptance Criteria 검증 가능성 | OK | AC-15 정정 + AC-39~AC-46 Given/When/Then |
| 미결정 게이트 영향 | **비차단** | **D-07**(전역 알림 off 전환 시 기존 예약 처리) = (a) 즉시 전체 취소 채택. **D-08**(유형 속성 편집 범위) = "이름만" 채택, 색상·아이콘 시스템 자동 배정. 둘 다 사용자가 방향 (B) 정식화 확정 시 기본안 채택 — 설계·구현 진행. BLOCK 아님 |

**Tester 지적(T-01~T-06) 설계 반영 요약**:

| # | 지적 | 설계 반영 |
| --- | --- | --- |
| T-01 | DashboardScreen 로고·태그라인 렌더 회귀 | `logic.md` §16.3.2 렌더 규약을 §16.3.3 상호작용형 대시보드 레이아웃(브랜드 최상단)에 편입 — 복원 명시 |
| T-02 | Dashboard `getSummary`→`findInRange` 전환 | 요약 서비스 **병행 유지** 확정. `logic.md` §7/§16.3 개정: 요약 표시요소는 `DashboardService.getSummary`, 오늘 목록 행은 `ScheduleService.findInRange`. `bindings.ts` Dashboard reads 2개로 정정 |
| T-03 | 미승인 기능(전역 알림 토글·새 일정 기본값·rename) | `logic.md` §10 설정 키 표에 `notif.enabled`/`schedule.defaultPriority`/`schedule.defaultCategoryId` 정식 편입. §5.1 `CategoryService.rename` 계약 신설(중복·기본 유형 보호 검증) |
| T-04 | Clock 포트 우회(`new Date()`/`Date.now()` 표시 경로) | `logic.md` §16.11 신설 — 표시 계층 포함 모든 "현재 시각"·"로컬 자정"은 `Clock` 포트 경유(P-16/P-17). `useServices()`에 `clock` 노출 |
| T-05 | 하드코딩 페이지 크기(200/500)·keyset cursor | `logic.md` §16.3.5 신설 — `DASHBOARD_PAGE_SIZE`/`CALENDAR_MONTH_PAGE_SIZE`/`SEARCH_PAGE_SIZE` 설계 상수 + cursor 루프. `nfr.md` §1.2 반영 |
| T-06 | AC-15 빈 상태 "일정 추가" 버튼이 FAB로 대체됨 | plan v1.3 = "FAB + 빈 상태 버튼 병존". `logic.md` §16.3.3에 빈 상태 브랜치 명시 반영 |

### v1.7 재검증 (F-17 브랜드 오리 로딩 인디케이터 요청)

**결과: PASS (설계 가능, Planner 재작업 불필요)**

| 검증 항목 | 판정 | 비고 |
| --- | --- | --- |
| 원본 사용자 요청 반영 | OK | "로고의 오리가 여러 일을 하는 SVG를 로딩 표시로" → F-17 목적·순환 활동 목록·노출 위치로 구체화. plan.md 10장 커버리지 매핑에 등재 |
| 기능 목적/범위/시나리오 | OK | F-17(목적·기본 정의·순환 활동 4+1·노출 위치 5종·정적 폴백), 7.7 로딩 대기 사용자 흐름 |
| 입력·출력·상태변화·예외 | OK | R-17-1~5 결과, E-17-1~8 예외(Reduce Motion·렌더 실패·빠른 종료·타임아웃·저사양·워치·에러 종료·중첩), 정적 폴백 요구 |
| 비기능 요구사항 | OK | NFR-11(벡터 경량·프레임 저해 금지·저사양 강등·리소스 해제), P-27 크기 제한, P-31 리소스 해제 |
| 요구사항 충돌 | 없음 | "벡터(SVG) 기반"(P-22/NFR-11) ↔ 정적 폴백 이미지 = 폴백 단계로 분리되어 모순 아님 |
| 가정/확정 구분 | OK | 활동 수 3~5(P-23), 임계값 가정 범위(P-24 150~300ms / P-25 2~4s / P-26 500~800ms / P-28 ≥10s) 명시 |
| Acceptance Criteria 검증 가능성 | OK | AC-29~38 Given/When/Then |
| 미결정 게이트 영향 | **비차단** | **D-06(오리 로딩 세부 정책 5건)** = OPEN. 5건 모두 (1) 인라인 순환 방식, (2) 임계 수치, (3) 저사양·절전 판정, (4) 스플래시 관계, (5) 구현 수단으로, **서비스·비즈니스 정책이 아니라 기술/UX 튜닝 결정**이며 기획이 명시적으로 Architect에 위임("기술 선택 — Architect 설계 범위", D-06 상태란). 기획이 제시한 가정값을 설계값으로 확정하여 진행한다(D-03~D-05와 동일 취급). BLOCK 아님 |

**D-06 설계 확정값 (게이트는 형식상 OPEN 유지, 이해관계자 추인 대기 — 비차단)**:

| D-06 항목 | 확정 설계값 | 근거 |
| --- | --- | --- |
| (1) 인라인 활동 표현 | 인라인에서도 **전체 활동 순환**(대표 1개 반복 아님). Search 인라인은 활동 5(검색하기)를 첫 활동으로 | 기획 가정 (1), AC-30이 노출 위치 구분 없이 "3~5개 순환" 요구 |
| (2) 임계 수치 | 표시 지연 **200ms** / 활동당 노출 **2500ms**(전환 크로스페이드 **300ms**, 겹침) / 최소 표시 **600ms** / 타임아웃 보조안내 **10000ms** | P-24~P-26·P-28 가정 범위 내 중앙값. 4활동 × 2500ms = 1루프 10s → 타임아웃 임계와 정합 |
| (2) 크기 (P-27) | 인라인 오리 캔버스 **72×72dp**(화면 폭 40% 이하), 풀스크린 **160×160dp**(화면 폭 60% 이하) | P-27 |
| (3) 저사양·절전 판정 | **신규 의존성 없이**: ① rAF 프레임 간격 롤링 샘플러(1s 창 평균 > 28ms 또는 연속 5프레임 > 50ms → 강등) ② `AccessibilityInfo.isReduceMotionEnabled()`. 강등 = 앱 세션 동안 정적 폴백 고정 | E-17-5·P-29. `react-native-device-info`류 배터리 API 도입 대신 실제 관심사(잔김)를 직접 측정 — `logic.md` §16.9.6 |
| (4) 부트스트랩 ↔ 스플래시 | **네이티브 스플래시 종료 후 별도 풀스크린 인디케이터**(현 `App.tsx`의 `<ActivityIndicator/>` 대체). 스플래시 연장·`react-native-bootsplash` 도입 안 함. 스플래시 이미지 교체는 비범위 | 기획 가정 (4), F-17 노출 위치 #1 비고 |
| (5) 구현 수단 | `react-native-svg` 15.x + RN 내장 `Animated` | `logic.md` §16.9.1 A/B/C/D 비교 |

### v1.6 재검증 (N-10 — 날짜/시각 DateTimePicker 도입 요청)

**결과: PASS (설계 가능, Planner 재작업 불필요)**

| 검증 항목 | 판정 | 비고 |
| --- | --- | --- |
| 신규 제품 요구사항 유무 | 없음 | F-01(일정 등록 시 일시 입력) 이미 확정. UI 구현 방식(텍스트→피커) 교체이며 기능 자체는 기확정 |
| 라이브러리 RN 호환성 | OK | `@react-native-community/datetimepicker` 8.6.0: `react-native: '*'` peer. RN 0.74.5 완전 호환 |
| E-01-2(시작 일시 미선택) 처리 | OK | DateTimePicker는 항상 유효한 Date 반환 + 기본값 자동 적용. 미선택 시나리오 실질 제거 |
| AC-01~03 충족 가능성 | OK | epoch ms 직접 추출 → 동일 검증(assertValidScheduleInput) 경유, AC-02/03 유지 |
| 미결정 게이트 영향 | 비차단 | D-01~D-05 모두 DateTimePicker 도입과 무관 |
| 빌드 환경 적합성 | OK | 디스크 여유 765 Gi (이전 이연 사유 해소). `pod install` 비용 감당 가능 |

### v1.5 재검증 (F-16 앱 아이덴티티 UI 요청)

**결과: PASS (설계 가능, Planner 재작업 불필요)**

| 검증 항목 | 판정 | 비고 |
| --- | --- | --- |
| 신규 제품 요구사항 유무 | OK | F-16(앱 아이덴티티 UI)·P-18~P-21·AC-25~28 기획서에 명시됨. 코어/DB/포트 변경 없음 — UI 계층 단독 변경 |
| 에셋 존재 여부 | OK | `src/assets/icons/`(logo.png, todo.png, goal.png, statistics.png, settings.png), `src/assets/images/`(tagline.png) 확인 완료 |
| 탭 매핑 명확성 | OK | F-16: 오늘탭→todo.png, 캘린더탭→goal.png, 검색탭→statistics.png, 설정탭→settings.png |
| 에셋 로드 실패 정책 | OK | E-16-1: 빈 공간 또는 텍스트 라벨 대체, 앱 크래시 없음 (AC-28) |
| 다크 테마 / 고해상도 정책 | OK | E-16-2: 원본 PNG 그대로 사용. E-16-3: RN `Image` 자동 스케일링 위임. 이번 범위 외 명시 |
| 미결정 게이트 영향 | 비차단 | D-01~D-05 모두 F-16과 무관 |

### v1.4 재검증 ("일정 추가/수정 화면 연결" 요청)

**결과: PASS (설계 가능, Planner 재작업 불필요)**

| 검증 항목 | 판정 | 비고 |
| --- | --- | --- |
| 신규 제품 요구사항 유무 | 없음 | F-01(일정 등록)·F-03(일정 수정)·AC-01~03 이 이미 명세. 요청은 기확정 기능의 **UI 연결·폼 완성** |
| 화면/흐름 근거 | OK | `plan.md` 7.1("일정 추가 유도"), 7.2("대시보드/캘린더에서 '+' → 일정 작성 화면 … 제목·일시·유형·우선순위·메모 입력"), 7.3(검색 결과 → 수정), AC-15/E-10-1(빈 대시보드에 일정 추가 진입점) |
| 입력·검증 명세 | OK | F-01 Action, E-01-1~4, AC-02(필수값), AC-03(종료<시작). 코어 `validation.ts` 에 대응 오류 코드 존재 |
| 미결정 게이트 영향 | 비차단 | **D-05(반복 범위)** = OPEN("단순 반복 가정"). 단순 반복(P-01: NONE/DAILY/WEEKLY/MONTHLY/YEARLY + 종료일 또는 횟수)은 가정값으로 설계 가능하며 코어(`Recurrence` 타입·`expandOccurrences`·검증)·DB 스키마에 이미 구현되어 **이번 사이클 착수를 BLOCK 하지 않는다**. 개별 회차 편집("이 일정만/이후 모두", P-02)만 범위 제외(N-10). D-04(우선순위 3단계)도 가정값으로 이미 구현 |

**이번 사이클 반복(F-01 반복) 범위**: 신규 생성 화면에서 **단순 반복 rule + 종료조건(없음/종료일/횟수)** 입력을 `ScheduleService.create({ recurrence })` 로 그대로 전달(코어가 검증·저장). 수정 화면에서는 기존 반복 규칙을 **읽기 전용** 표시하고 미전송으로 보존. 개별 회차 편집(P-02)은 이번 사이클 제외.

### v1.1 재검증 (RN 앱 셸 요청)

**결과: PASS (설계 가능, Planner 재작업 불필요)**

| 검증 항목 | 판정 | 비고 |
| --- | --- | --- |
| 신규 제품 요구사항 유무 | 없음 | "RN 앱 셸"은 기확정 기능(F-01~F-15)의 **클라이언트 계층 구현**이다. 신규 화면·정책·데이터가 추가되지 않음 |
| 화면/흐름 근거 존재 | OK | `plan.md` 7장(7.1 최초 실행, 7.2 등록→알림→완료, 7.3 검색, 7.4 캘린더, 7.5 계정, 7.6 상태 전이)이 셸 화면·네비게이션 근거 |
| 플랫폼/스택 근거 | OK | NFR-01(모바일+워치), NFR-02(RN+TS+git+SQLite 확정), NFR-08 접근성, NFR-09 국제화 |
| 권한 흐름 근거 | OK | 7.1 알림/캘린더 권한 요청, E-08-1/E-14-1 거부 시 기능 비활성 |
| 미결정 게이트 영향 | 영향 없음 | D-01~D-05는 셸 착수를 BLOCK하지 않음(어댑터 인터페이스는 게이트와 무관, 가정값 유지) |

→ Planner 반려 없음. 본 개정은 **설계 델타**만 추가한다(overview/logic/nfr). `database.md`는 스키마 변경이 없으므로 v1.0 그대로 사용하며 RN SQLite 어댑터가 v1.0 DDL을 그대로 구현한다.

### v1.0 최초 검증

**결과: PASS (설계 가능)**

| 검증 항목 | 판정 | 비고 |
| --- | --- | --- |
| 원본 요구사항 반영 | OK | `plan.md` 10장 커버리지 매핑으로 `알림앱.md` 전 항목 대응 확인 |
| 기능 목적/범위/흐름/정책 명확성 | OK | F-01~F-15, P-01~P-17, 7장 사용자 흐름, 6절 NFR 초안 |
| 입출력/상태변화/예외 정의 | OK | 각 기능에 Exception, 7.6 상태 전이도 |
| 비기능 요구사항 기술 | 부분 | 6절이 초안 수준 → 본 설계 `nfr.md`에서 구체화 (기획에 없는 SLO는 신설하지 않고 미결정으로 표기) |
| 요구사항 충돌 | 없음 | |
| 가정/확정 구분 | OK | "확정/가정" 라벨, 8절 게이트 D-01~D-05 |
| Acceptance Criteria 검증 가능성 | OK | AC-01~AC-24 Given/When/Then |

**미결정(반려 아님, 가정값으로 설계 진행)**: D-01(계정 연동 의미) = (c), D-02(캘린더 쓰기) = 읽기 필수·쓰기 옵션, D-03(DB 암호화) = 본 설계에서 "민감필드 보호 + 선택적 전체 암호화(SQLCipher)" 제안, D-04(우선순위 단계) = 3단계, D-05(반복 범위) = 단순 반복. 게이트가 확정되면 관련 섹션을 개정한다. 어느 것도 설계를 BLOCK하지 않는다.

---

## 요구사항 요약 (설계 근거)

| 근거 | 설계 반영 |
| --- | --- |
| F-01~F-07 일정 CRUD/완료/유형/우선순위 | `SCHEDULE`, `CATEGORY` 테이블 + ScheduleService (logic 3.1~3.5) |
| F-06 유형(카테고리) 관리 — 추가/이름변경/삭제 전용 화면, P-34 이름 규칙·기본 유형 보호 | `CategoryService.list/create/rename/remove` (logic §5, §5.1) + `CategoryManagerScreen` (logic §16.3, §16.3.4). 일정→유형은 **ID 참조**이므로 rename은 참조 유지·표시 라벨만 갱신(AC-39). DB 스키마 무변경 |
| F-08/F-09 사전·정시 알림, P-09 재부팅 복원, P-10 오프셋 최대 5 | `REMINDER` 테이블 + ReminderScheduler + OS 트리거 어댑터 (logic 3.6) |
| F-10 대시보드(상호작용형), P-07 완료율, P-35 브랜드·요약·목록 공존 | 요약 = `DashboardService.getSummary` 집계 쿼리 (logic 3.7) / 오늘 목록 행 = `ScheduleService.findInRange` + 인라인 `toggleDone`(F-05)·스와이프 `softDelete`(F-04). 레이아웃: 브랜드(logo/tagline) / 요약 / 오늘 목록 / 상시 FAB (logic §16.3.3) |
| F-20 날짜 네비게이션(컴팩트) / F-21 진행률 한 줄 / F-22 접이식 검색 (P-45~P-53, AC-57~AC-68, D-12~D-19) | `DashboardScreen` 로컬 state `referenceDate`(로컬 자정 epoch)·`inlineQuery`·`searchExpanded`(기본 false) — 저장 없음(P-45/P-50/P-53). 요약·진행률 한 줄 = `DashboardService.getSummary(referenceDate)` 재사용(신규 집계 없음, P-47) — 진행률 한 줄 = `total`/`done` + progress bar(채움 = 완료율 P-07); `isFutureDate(referenceDate, todayStart)` 순수 표시 조건이면 총 개수만(P-52/D-19). 기준 날짜 목록 = `ScheduleService.findInRange(referenceDate, referenceDate+DAY_MS, …)` / 접이식 검색(`searchExpanded` 펼침 시) = `items` 표시 계층 순수 필터(제목+메모, D-15) — 진행률 한 줄·요약 미적용(P-49/D-16), F-11 과 독립(P-51); 접힘 시 검색어 초기화(D-18). 자정 롤오버 = 이전 `todayStart` 대비 판별(P-46, E-10-2 통합). "오늘로"·탭 blur·콜드 스타트 시 `searchExpanded=false` + 검색어 초기화(P-50/P-53). 신규 순수 컴포넌트 `ProgressLine.tsx`(구 `CountCards.tsx` 대체), 순수 헬퍼 `isFutureDate`·`stepReferenceDate`(DASH-01 정정: 방향 무관 `+ HALF_DAY`, 순수 `time.ts` `startOfLocalDay`). **코어·DB·포트·API 무변경** (logic §7.1/§16.3.7, database §11, nfr §15) |
| F-18 앱 설정 — 전역 알림 토글(P-32, D-07), 새 일정 기본값(P-33) | `APP_SETTING` 키 `notif.enabled` / `schedule.defaultPriority` / `schedule.defaultCategoryId` + `SettingService` (logic §10). 토글 off 전환 = `ReminderScheduler.applyGlobalNotificationsToggle(false)` 일괄 취소; 예약 게이트는 `syncOnce()` 단일 지점 (logic §6) |
| F-11 검색, P-11/P-12 | SearchService + FTS 인덱스 (logic 3.8, database 5). **v1.7**: 세 번째 탭 "검색" 제거에 따라 `SearchScreen` 을 Tab → Stack 화면으로 이전하고 `CalendarScreen` 헤더 검색 아이콘에서 진입(D-20(a) 가정). 검색 로직·필터·정렬·예외·정책·AC-13/AC-14 는 **무변경**(P-54). (logic §8, §16.2) |
| F-23 통계 화면 — 상단 총/완료 건수 카드 2장(전체 기간 누적, 삭제분 제외 — P-55/D-21) + 하단 선택 연도의 유형별 월별 건수 그래프(x축 1~12월, 월 버킷 = `start_at` 로컬 달 — P-56/D-23), P-54~P-58, R-23-1~4, E-23-1~5, AC-69~AC-76 | 순수 뷰모델 `statisticsViewModel.ts` 가 기존 `ScheduleService.findInRange`(저장 행, soft-deleted 제외) 결과를 인메모리 집계 + `CategoryService.list()` 로 유형 라벨·색. 상단 = `findInRange(0, MAX_SAFE_INTEGER, …)` cursor 루프 전건/완료 count. 하단 = `findInRange(yearStartTs, yearEndTs, …)` cursor 루프 + `localWallToEpoch` 월 경계 버킷 + `categoryId` 그룹. 반복 카운트는 대시보드/캘린더와 동일 조회 경로라 자동 일치(P-58/D-22). 삭제 유형은 이미 "기타" 재지정(E-06-2) → "기타" 합산(E-23-5), rename 은 ID 참조로 자동 반영(R-23-4). 선택 연도 = 화면 로컬 state(기본 올해, 비영속). 차트 = 순수 RN `<View>` 높이 비율(신규 의존성 없음). **코어·DB·포트·API 무변경** (logic §7.2/§16.3.8, database §12, nfr §16) |
| F-12 계정 연동, D-01=(c) | AuthService + OAuth(app-auth) + Keychain 토큰 저장 (logic 3.9, 보안 설계) |
| F-13 테마 | `APP_SETTING` 키/값 + ThemeStore (logic 3.10) |
| F-14 캘린더 연동, P-08 중복판정 | CalendarSyncService + `CALENDAR_LINK` 매핑 (logic 3.11) |
| F-15 영속화, NFR-06 마이그레이션 | SQLite + user_version 마이그레이션 러너 (database 6) |
| NFR-01/10 모바일+워치 | 코어 도메인 계층을 플랫폼 비의존 TS로 분리, 워치는 동일 스키마 보조 클라이언트 |
| F-19 애플워치 워치 앱 — 오늘 목록 조회 + 완료 토글 역전파, P-36~P-44, NFR-10(착수)·NFR-12, E-19-1~7 | 네이티브 SwiftUI **단일 타깃** watchOS 앱 `TodayWhatWatch`(watchOS 10.0, v1.14 구현 착수 — logic §17.11) + `src/core/watchSync/`(순수 스냅샷 빌더 `buildWatchSnapshot` + `WatchSyncService.applyIncomingToggle` LWW) + iOS WatchConnectivity 브리지 어댑터(`WatchSyncGateway` 포트). 폰 SoT, 워치 쓰기 = `toggleDone` 1종. 페이로드 = 오늘 + 다음 예정 1건(P-40). DB 스키마 무변경(LWW=`UPDATED_AT` 기준, dedup=`APP_SETTING`). `logic.md` §17·§17.11, `nfr.md` §14·§11.1 |
| F-17 브랜드 로딩 인디케이터, P-22~P-31, NFR-11, D-06 | `src/app/components/BrandLoadingIndicator` (`react-native-svg` + `Animated`) + 순수 표시 FSM. 코어/DB/포트/`bindings.ts` 무변경 (logic §16.9, nfr §13) |

---

## 기존 시스템

- 현재 저장소(v1.1 시점):
  - `package.json`(TS 5.5, `type: module`, `engines.node >= 22.7`, 스크립트 `build`/`typecheck`/`test`/`demo`), `tsconfig.json`(strict, `nodenext`, `allowImportingTsExtensions`), 의존성 0.
  - **`src/core/**` — 플랫폼 비의존 코어 계층 구현·검증 완료**: `domain/`(clock, errors, recurrence, reminders, search, time, types, validation), `ports/`(repositories, gateways), `services/`(schedule, reminderScheduler, dashboard, search, category, setting, auth, calendarSync), `infra/memory/`(InMemoryDb=UnitOfWork + 6 repository), `infra/fakes/`(Fake Notification/Calendar/Auth Gateway, InMemoryTokenStore, ArrayLogger), `migration/runner.ts`(엔진 비의존 `MigrationDb` + `runMigrations`).
  - `src/core/app.ts` — 조립 지점(Composition Root). 현재는 인메모리/Fake 어댑터를 하드코딩해 `buildApp(options)` 반환.
  - `src/index.ts` — `npm run demo` 스모크(코어를 인메모리로 조립해 핵심 흐름 실행).
  - `tests/**` — `node:test` 러너 기반 12개 스펙(81 assertion 통과, `document/test/test-result.md`). 린트는 아직 없음.
- 재사용: TypeScript strict 설정, git, `node:test` 러너, 코어 계층 전체(포트·서비스·도메인·인메모리 어댑터·마이그레이션 러너)를 **무변경**으로 재사용. RN 앱 셸은 이 위에 UI·네비게이션·상태 스토어·네이티브 어댑터를 얹는다.
- 아직 없는 것 → 본 개정의 설계 대상: **React Native 앱 셸**(엔트리/네비게이션/화면/상태 스토어/RN용 조립 지점) + **코어 포트를 구현하는 네이티브 어댑터**(op-sqlite / notifee / react-native-calendar-events / react-native-app-auth / react-native-keychain / SystemClock·부팅 수신), `android/`·`ios/`·워치 타깃, `metro.config.js` 등 RN 툴링 파일.

### 빌드 환경 제약과 파이프라인 검증 전략

- **제약 (v1.0~v1.1 기준, v1.2에서 부분 해소)**: 최초 셸 설계 시 실행 환경에 RN 툴체인·Xcode/iOS SDK·Android SDK·CocoaPods가 없어 네이티브 빌드·온디바이스 실행을 검증할 수 없었다.
- **v1.2 갱신**: 검증 환경에 **Xcode 26.2 + CocoaPods 1.16.2 + RN CLI**가 도입되어 **iOS 네이티브 빌드(`xcodebuild` / `react-native run-ios`)와 시뮬레이터 설치·실행이 이 파이프라인에서 검증 가능**하다. op-sqlite 버전 핀 관련 빌드 결함은 정식 검증 대상이며 "환경 외 후속"으로 미루지 않는다. Android Gradle 빌드는 여전히 환경 제약(ANDROID_HOME 등)일 수 있으며 그 경우에만 후속으로 분리한다.
- **전략** — 셸을 두 층으로 나눠 "검증 가능 최대치"를 이 파이프라인에서 확보한다:
  1. **플랫폼 비의존 셸 로직 (검증 대상)**: 조립 지점 리팩터(어댑터 주입 seam), 네비게이션 그래프 정의(순수 데이터), 딥링크 파서, 화면↔서비스 바인딩 맵, 앱 부트스트랩 오케스트레이터(logic §12를 RN 라이프사이클에 매핑한 순수 함수), 각 네이티브 어댑터의 **계약 준수 테스트**(포트 인터페이스에 대한 타입 체크 + Fake 대역과의 행위 동치성). → `npm run typecheck` + `npm test`로 검증.
  2. **네이티브 바인딩**: 실제 `NativeModules` 호출부, `AndroidManifest.xml`/`Info.plist`, Gradle/Pod 설정, Metro/Babel 설정. → **v1.2부터 iOS는** `pod install` + `xcodebuild` + 시뮬레이터 설치·실행·첫 화면 렌더까지 정식 검증한다. Android Gradle 빌드와 온디바이스 알림 정확도(BOOT_COMPLETED, 워치 연동)는 환경이 허용하지 않을 때에 한해 "환경 외 후속 검증"으로 분리한다.
- Tester는 (1)을 기능/리뷰/보안 정식 검증하고, (2) 중 iOS 빌드·시뮬레이터 실행은 정식 검증하며, 나머지 미검증 항목만 `test-result.md`에 BLOCKED(ENVIRONMENT)가 아닌 "환경 외 후속 검증"으로 분리 기록한다.

---

## 전체 구조 및 처리 흐름

계층형 구조. 의존 방향은 항상 UI → Application → Domain ← Infrastructure(어댑터가 Domain 포트를 구현).

```text
┌───────────────────────────────────────────────────────────────┐
│ UI (React Native / React Navigation)                           │
│  - Tab: Dashboard / Calendar / Statistics(F-23) / Settings     │
│  - Stack: ScheduleDetail / ScheduleEditor / Search(F-11) /     │
│           CategoryManager / Permissions                        │
│  (Apple Watch 앱은 RN 아님 — 아래 별도 네이티브 타깃 TodayWhatWatch, F-19) │
├───────────────────────────────────────────────────────────────┤
│ Application (services / use-cases, 플랫폼 비의존 TS)            │
│  ScheduleService · ReminderScheduler · DashboardService ·      │
│  SearchService · CategoryService · SettingService ·            │
│  AuthService · CalendarSyncService · WatchSyncService (신규)   │
├───────────────────────────────────────────────────────────────┤
│ Domain (엔티티 · 값객체 · 정책 · 포트 인터페이스)               │
│  Schedule, Category, Reminder, Priority, RecurrenceRule,       │
│  DateRange … / Ports: ScheduleRepository, ReminderRepository,  │
│  NotificationGateway, CalendarGateway, AuthGateway, Clock,     │
│  WatchSyncGateway (신규) / watchSync.buildWatchSnapshot (순수) │
├───────────────────────────────────────────────────────────────┤
│ Infrastructure (어댑터 — 포트 구현)                             │
│  SqliteScheduleRepository (op-sqlite) · NotifeeNotification    │
│  Gateway · RNCalendarEventsGateway · AppAuthGateway ·          │
│  KeychainTokenStore · SystemClock · MigrationRunner ·          │
│  WatchConnectivityGateway (iOS, react-native-watch-connectivity)│
└───────────────────────────────────────────────────────────────┘
                         │
   SQLite(암호화 옵션) · OS 로컬 알림 · OS 기본 캘린더 · OAuth Provider
                         │  WatchConnectivity (iOS ↔ watchOS, OS 페어링 채널)
                         ▼
┌───────────────────────────────────────────────────────────────┐
│ Apple Watch 앱 (네이티브 SwiftUI 단일 타깃 TodayWhatWatch, F-19)│
│  공유: 페이로드 계약(types.ts/watchMessage.ts) · epoch ms +    │
│        IANA tz(P-39) · 상태 규칙(§7.6)                          │
│  Swift 구현: 오늘 목록 렌더 · 완료 토글 · LWW · 보류 큐 ·       │
│    로컬 스냅샷/큐 JSON (FileProtectionType.complete, SQLite 아님)│
│  (선택) WidgetKit 컴플리케이션 — D-10                           │
└───────────────────────────────────────────────────────────────┘
```

대표 흐름 (워치에서 완료 토글 → 폰 반영):

```text
Watch: 오늘 목록 스냅샷(applicationContext) 표시
 → 완료 컨트롤 탭 → 워치 카운트 즉시 갱신 + 보류 큐에 op 저장
 → 도달 가능? sendMessage(op)[즉시·ack] : 미도달 → transferUserInfo(op)[보장·FIFO]
iPhone: WatchConnectivityGateway 수신
 → WatchSyncService.applyIncomingToggle(op): opId dedup → ScheduleRepository.findById 재조회
   → LWW(op.baseUpdatedAt vs schedule.updatedAt, op.watchChangedAt) → ScheduleService.toggleDone
 → 최신 스냅샷 재빌드 → updateApplicationContext(폰→워치) → 대시보드 store 무효화 (AC-23/AC-48)
Watch: ack 수신 → 보류 큐에서 op 제거 → 새 스냅샷으로 화면 갱신
```

대표 흐름 (일정 등록 → 알림):

```text
ScheduleEditor 입력
 → ScheduleService.create(dto)
 → 입력검증(Domain: 제목/일시/종료>=시작) → 정책검증(카테고리 기본값, 우선순위 기본값, 오프셋<=5)
 → TX{ ScheduleRepository.insert(SCHEDULE) ; ReminderRepository.replaceForSchedule(REMINDER[]) }
 → ReminderScheduler.sync(scheduleId): 과거 오프셋 skip, 미래분만 NotificationGateway.schedule()
 → 대시보드/캘린더 뷰 무효화(store invalidate)
 → 결과 반환
```

---

## 클라이언트 셸 아키텍처 (RN App Shell) — v1.1

코어 계층(`src/core/**`) 위에 얹는 React Native 클라이언트의 구조. **코어는 무변경**이며, 셸은 (a) 포트를 구현하는 네이티브 어댑터, (b) RN용 조립 지점, (c) 네비게이션·화면·상태 스토어, (d) 앱 라이프사이클 오케스트레이터로 구성된다.

### 모듈 배치

```text
src/
├── core/**                      # 기존, 무변경 — 단 v1.9에서 watchSync/ 서브트리 추가
│   ├── ports/gateways.ts        #   + WatchSyncGateway 인터페이스 (F-19)
│   ├── watchSync/snapshot.ts    #   신규 순수: buildWatchSnapshot(todaySchedules, nextUpcoming, categories, clock) — 페이로드 매핑 (P-39/P-40). fetch 는 WatchSyncService
│   ├── watchSync/reconcile.ts   #   신규 순수: resolveToggleLWW(op, schedule) — E-19-3 LWW
│   └── services/watchSyncService.ts  # 신규: applyIncomingToggle(op) / pushSnapshot() — 폰측 조정 (toggleDone 만 호출)
├── index.ts                     # 기존 Node 데모 (무변경)
└── app/                         # 신규 — React Native 앱 셸 (플랫폼 비의존 로직 + 네이티브 바인딩)
    ├── bootstrap/
    │   ├── composeNative.ts      # RN용 Composition Root: 네이티브 어댑터를 buildApp 에 주입
    │   ├── bootstrapSequence.ts  # logic §12 부트스트랩을 순수 오케스트레이터로 (DB open→migrate→settings→sync)
    │   └── AppContext.tsx        # 조립된 App(서비스 묶음)을 React 트리에 제공 (Context)
    ├── navigation/
    │   ├── routes.ts             # 라우트 이름·파라미터 타입 (순수 데이터). v1.12: TAB `SearchTab`→`StatisticsTab`, STACK `Search` 신설
    │   ├── linking.ts            # 딥링크 config + 알림 payload 파서 (scheduleId 정수만)
    │   └── RootNavigator.tsx     # Tab(대시보드/캘린더/통계/설정) + Stack(상세/편집/검색/유형관리/권한). v1.12: 3번째 탭 = StatisticsScreen, 검색은 Calendar 헤더 → Stack
    ├── screens/
    │   ├── DashboardScreen.tsx   Calendar / ScheduleListScreen.tsx
    │   ├── ScheduleEditorScreen.tsx / ScheduleDetailScreen.tsx
    │   ├── StatisticsScreen.tsx (신규 v1.12, F-23) / statisticsViewModel.ts (신규 v1.12, 순수 집계 — react/react-native 미import)
    │   ├── SearchScreen.tsx (v1.12: Stack 화면으로 이전, 로직 무변경) / SettingsScreen.tsx
    │   └── onboarding/PermissionsScreen.tsx
    ├── state/
    │   └── stores.ts             # Zustand 슬라이스 (dashboard/list/search/settings/account) + invalidate 훅
    ├── adapters/                 # 코어 포트를 구현하는 네이티브 어댑터 (검증: 계약 테스트 / 온디바이스는 후속)
    │   ├── sqlite/OpSqliteDb.ts           # UnitOfWork + MigrationDb (op-sqlite)
    │   ├── sqlite/SqliteScheduleRepository.ts … (6개 저장소)
    │   ├── notifications/NotifeeNotificationGateway.ts
    │   ├── calendar/RNCalendarEventsGateway.ts
    │   ├── auth/AppAuthGateway.ts
    │   ├── secure/KeychainTokenStore.ts
    │   ├── clock/SystemClock.ts (core 재noop 또는 재사용) + boot/BootReschedule.ts
    │   ├── watch/WatchConnectivityGateway.native.ts  # 신규(v1.9) — WatchSyncGateway 구현 (iOS; Android no-op)
    │   └── logging/MaskingLogger.ts       # nfr 5.1 마스킹 규칙 구현
    ├── ui/                       # 공용 컴포넌트·테마 (theme.mode/accent/fontScale 반영)
    └── components/               # 신규(v1.7) — 순수 프레젠테이션 컴포넌트. core/서비스/bindings 무의존, props 로만 데이터 수신
        ├── BrandLoadingIndicator.tsx   # F-17 로딩 인디케이터 (variant: fullscreen | inline)
        ├── loadingIndicatorMachine.ts  # 표시/모드 판정 순수 FSM (React 비의존, node:test)
        ├── useLoadingIndicator.ts      # FSM + 타이머 + AccessibilityInfo + rAF 샘플러 배선 훅
        └── duck/                       # duckGeometry.ts(SVG 상수) · activities.ts(순환 목록) · DuckScene.tsx · SvgErrorBoundary.tsx
```

> v1.1에서 예고한 `ui/`(공용 컴포넌트) 중 F-17 로딩 인디케이터 계열은 `components/` 하위로 realize 한다. 두 폴더 모두 app 계층 프레젠테이션이며 `src/core/**` 를 import 하지 않는다.

RN 프로젝트 파일: `index.js`(AppRegistry), `App.tsx`, `app.json`, `metro.config.js`, `babel.config.js`, `react-native.config.js`, `.eslintrc`(`@react-native/eslint-config`), `android/`, `ios/` 는 스캐폴드로 생성하되 온디바이스 빌드는 후속 환경에서 검증.

**워치 타깃 (v1.9 설계 / v1.14 구현 착수, F-19)** — Xcode 프로젝트(`ios/TodayWhat.xcodeproj`)에 **watchOS 앱 타깃을 신규 추가**한다. v1.14 에서 실제 타깃·Swift 소스를 산출하며 상세 설계는 `logic.md` §17.11:

- `ios/TodayWhatWatch/` — **단일 타깃 watchOS 앱**(SwiftUI `App` 라이프사이클 + `WKApplicationDelegateAdaptor`, watchOS 10.0+). 레거시 "WatchKit App + WatchKit Extension" 2-타깃 구조는 채택하지 않는다(Xcode 14+ 표준). SwiftUI 뷰(오늘 목록·완료 토글·요약 헤더·다음 예정 1건·빈 상태 E-19-5·"최신 아님" E-19-1·"동기화 대기" D-11 배지·pull-to-refresh), `WCSessionDelegate`, 로컬 스냅샷/보류 큐 JSON 영속화(앱 컨테이너, `FileProtectionType.complete`), LWW·상태 규칙(§7.6)을 Swift 로 재구현. **`src/core` 코드를 링크하지 않는다** — 공유 자산은 페이로드 계약(`src/core/watchSync/types.ts`·`src/app/adapters/watch/watchMessage.ts`)·시각 규약(P-39)뿐이다.
- **번들 ID** `kr.purpledog.todaywhat.watchkitapp`(iOS 앱 `kr.purpledog.todaywhat` 하위), Info.plist 에 `WKCompanionAppBundleIdentifier = kr.purpledog.todaywhat` · `WKApplication = true`. iOS 앱 타깃에 "Embed Watch Content" 복사 페이즈 + 타깃 의존성 추가.
- **pbxproj 편집** = `xcodeproj` Ruby gem 스크립트(멱등, `ios/scripts/add_watch_target.rb`) 또는 Xcode GUI 1회 후 결과 커밋 — **손편집 금지**. **CocoaPods**: 워치 타깃을 Podfile 에 넣지 않는다(RN Pod 은 iOS 전용, watchOS 링크 불가). 워치는 시스템 프레임워크(`WatchConnectivity`/`SwiftUI`/`Foundation`, D-10 시 `WidgetKit`)만. 워크스페이스는 기존 `TodayWhat.xcworkspace` 공유.
- **공유 스킴** `TodayWhatWatch`(`xcshareddata/xcschemes/`) — `xcodebuild -scheme TodayWhatWatch -destination 'platform=watchOS Simulator,…'` 로 워치 앱(+컨테이너 iOS 앱) 빌드.
- (D-10 포함 시) `ios/TodayWhatWatchComplication/` — WidgetKit 확장. 미결이면 타깃 미생성(이번 스크린샷 검증에 불필요).
- iOS 앱 타깃에는 `react-native-watch-connectivity` 가 autolink 하는 `WatchConnectivity.framework` 브리지가 추가된다(폰 측만).
- `android/` Wear OS 모듈은 이번 릴리스 **비범위**(P-44 / OI-11) — 스캐폴드도 생성하지 않는다.
- **검증(v1.14, 이번 릴리스)**: `npm test`/`typecheck` = `src/core/watchSync/**` + `WatchSyncService` + `WatchConnectivityGateway` 계약(기존). **추가**: `xcodebuild -scheme TodayWhatWatch` 빌드 성공 + 페어드 iPhone+Watch 시뮬레이터(watchOS 26.2) 설치·실행·실제 WCSession 라운드트립·`xcrun simctl io … screenshot` 로 워치 오늘 목록 렌더 확인(`nfr.md` §11.1, `logic.md` §17.11.5). 실기기 WCSession 엣지·BOOT·배터리만 후속(N-11).

### 코어 포트 → 네이티브 어댑터 매핑

| 코어 포트 (`src/core/ports`) | 네이티브 어댑터 | 라이브러리 (버전 고정: overview 기술 스택 표) | 검증 방식(본 파이프라인) |
| --- | --- | --- | --- |
| `UnitOfWork` + `MigrationDb` | `OpSqliteDb` | `@op-engineering/op-sqlite` 9.x (+ 선택 SQLCipher) | 계약 테스트(트랜잭션 커밋/롤백, user_version 순차 적용) — SQLite in-proc 불가 시 인터페이스·SQL 문자열 정적 리뷰 |
| `ScheduleRepository` 외 5개 | `SqliteXxxRepository` | op-sqlite prepared statement | 포트 타입 준수 + SQL 바인딩 정적 점검 + (가능 시) better-sqlite 대역으로 행위 동치 |

> **op-sqlite 9.x API 주의 (v1.2)**: 9.x JS 래퍼는 `execute()`가 `Promise<QueryResult>`(6.x는 동기)이며, `QueryResult.rows`가 **평면 배열**(`Array<Record<string, …>>`)이다. 6.x의 `rows._array` / `rows.item()` 접근자는 제거되었다. 어댑터(`OpSqliteDb.native.ts`, `SqliteRepositories.native.ts`)는 결과 행을 `res.rows`(`?? []`)로 읽는다. `open()`·`insertId`·`rowsAffected`·`close()` 시그니처는 6.x와 동일하다. 포트 계약(`UnitOfWork`/`MigrationDb`/`Repository` 인터페이스)은 변경되지 않는다.
>
> **op-sqlite 9.x named 파라미터 미지원 (v1.3, RENDER-003)**: 9.x `execute(sql, params)` 는 **positional 배열 전용**이며 named 파라미터(`:name`/`$name`/`@name`)를 어떤 API 로도 바인딩하지 못한다(객체 전달 시 내부 `params.map` → `TypeError: params?.map is not a function`). `OpSqliteDb.native.ts` 어댑터가 실행 직전 **named→positional 변환 shim** 을 적용하고(문자열/주석 내 `:` 스킵, 이름당 슬롯 1개 dedup·최초 등장 순서로 유니크 값 배열 생성), 리포지토리 SQL 은 named 바인딩(`:name`)을 유지한다. shim 은 어댑터 내부 구현이며 포트 계약(`UnitOfWork`/`MigrationDb`/`Repository`)은 변경되지 않는다. 상세는 `logic.md` §13.3 / §16.5.
| `NotificationGateway` | `NotifeeNotificationGateway` | `@notifee/react-native` 9.x (`TimestampTrigger`) | `ReminderScheduler`가 기대하는 계약(schedule→osId 반환, cancel 멱등)에 대한 Fake 동치 테스트 |
| `CalendarGateway` | `RNCalendarEventsGateway` | `react-native-calendar-events` 2.x | 외부 데이터 정제(길이/제어문자, logic 13.3) 단위 테스트 |
| `AuthGateway` | `AppAuthGateway` | `react-native-app-auth` 7.x (Auth Code + PKCE) | 토큰셋 매핑·만료 계산 단위 테스트, `client_secret` 미사용 정적 확인 |
| `TokenStore` | `KeychainTokenStore` | `react-native-keychain` 8.x (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`) | `AuthService`와의 계약 동치 테스트, DB 미저장 정적 확인(V-14) |
| `Clock` | `SystemClock` | RN 런타임 `Date`/`Intl` | 이미 core 에 존재, 재사용 |
| `Logger` | `MaskingLogger` | 자체 | 마스킹 규칙 테스트(V-15) |
| 부팅 재예약 | `BootReschedule` (Android `BootReceiver` headless JS / iOS 앱 기동 시) | `@notifee/react-native` + Android receiver | `bootstrapSequence`가 `ReminderScheduler.sync()` 호출함을 테스트(AC-08) |
| `WatchSyncGateway` (신규, F-19) | `WatchConnectivityGateway` (iOS 전용; Android no-op) | `react-native-watch-connectivity` 1.x | `WatchSyncService`와의 계약 동치 테스트(스냅샷 전송·op 수신 콜백·ack). WCSession 실제 왕복은 워치 기기 후속(N-11). watchOS 앱 코드(Swift)는 이 파이프라인 정적 리뷰만 |

### 조립 지점 리팩터 (seam)

- 현 `buildApp(options)`는 인메모리/Fake를 하드코딩한다. **후방 호환**을 유지하며 어댑터 오버라이드 주입 파라미터를 추가한다:
  `buildApp({ clock?, logger?, uow?, repositories?, notifications?, calendar?, auth?, tokenStore? })` — 미지정 항목은 현재의 인메모리/Fake 기본값. 코어 테스트·`npm run demo`는 무변경 동작.
- `composeNative.ts`는 `OpSqliteDb`로 열고 `runMigrations` 적용 후, 위 표의 네이티브 어댑터로 `buildApp`을 호출해 `App`을 만든다. `AppContext`가 이를 React 트리에 제공한다.

### 화면 ↔ 서비스 바인딩 (요약; 상세는 logic §16.3)

| 화면 | 사용 서비스/메서드 | 상태 슬라이스 |
| --- | --- | --- |
| Dashboard | `DashboardService.getSummary(referenceDate)`(요약·진행률 한 줄) + `ScheduleService.findInRange(dayStart, dayEnd, …)`(기준 날짜 목록, `DASHBOARD_PAGE_SIZE=100` cursor 루프), 인라인 `toggleDone`(F-05)·스와이프 `softDelete`(F-04). 기준 날짜(F-20)·검색어·`searchExpanded`(F-22)는 화면 로컬 state — 서비스 인자로만 전달, 저장 없음. 미래 날짜 진행률(P-52)은 `isFutureDate` 순수 표시 조건 | `dashboard`, `list` |
| Calendar / List | `ScheduleService.findInRange` (Calendar=월 단위 `CALENDAR_MONTH_PAGE_SIZE=200` cursor 루프 / List=keyset 무한 스크롤 50), `toggleDone` | `list` |
| ScheduleEditor | `ScheduleService.create/update/getById`, `CategoryService.list/create`, `SettingService`(새 일정 기본값 프리필 — 신규 모드만) | 저장 후 `list`·`dashboard`·`search`·`categories` invalidate → `goBack` (상세 §16.3.1) |
| CategoryManager | `CategoryService.list/create/rename/remove` | `categories`·`list`·`dashboard` invalidate (rename/삭제가 일정 표시 라벨에 영향) |
| ScheduleDetail | `ScheduleService`(findById 경유 조회), `softDelete/restore` | `list` invalidate |
| Search (v1.12: Stack 화면, Calendar 헤더에서 진입 — D-20(a)) | `SearchService.search` (2자↑ FTS / 미만 LIKE, `SEARCH_PAGE_SIZE=50` cursor 추가 로드) — 로직 무변경(P-54) | `search` |
| Statistics (신규 v1.12, F-23, 읽기 전용) | 상단 카드: `ScheduleService.findInRange(0, MAX_SAFE_INTEGER, undefined, 'startAt', STATISTICS_PAGE_SIZE, cursor)` cursor 루프 전건/완료 count / 하단 그래프: `ScheduleService.findInRange(yearStartTs, yearEndTs, undefined, 'startAt', STATISTICS_PAGE_SIZE, cursor)` cursor 루프 + `CategoryService.list()`. 선택 연도는 화면 로컬 state(기본 올해, 비영속). 포커스 시 재조회(R-23-3). 집계는 순수 `statisticsViewModel.ts` | 화면 로컬 state(신규 슬라이스 없음) |
| Settings | `SettingService.get/set` (theme.*, notif.enabled, notif.showTitle, schedule.default*, calendar.*), `AuthService.link/unlink`, 전역 알림 토글 시 `ReminderScheduler.applyGlobalNotificationsToggle` | `settings`, `account` |
| Permissions(온보딩) | `NotificationGateway.requestPermission`, `CalendarGateway.requestPermission` | `settings` |

### 앱 라이프사이클 → 부트스트랩

`index.js` → `App.tsx` 마운트 → `bootstrapSequence.run()`:
`OpSqliteDb.open`(PRAGMA foreign_keys/WAL, 옵션 key) → `runMigrations`(실패 시 안전 모드 UI, E-15-1) → `SettingService.getAll` → `ThemeStore` 초기화 → 첫 화면 렌더 → 렌더 후 비동기 `ReminderScheduler.sync()` 전체(P-09) → 연동 상태면 `AuthService.ensureFreshToken()`.
`AppState`가 `active` 전이 시 `sync()` 재호출. Android 부팅 완료 브로드캐스트 → headless JS → `sync()`. (logic §16.4)

**워치 동기화 배선(v1.9, F-19, iOS)**: `bootstrapSequence` 렌더 후 단계에서 `WatchSyncGateway.activate()` + 수신 콜백 등록(`onIncomingToggle → WatchSyncService.applyIncomingToggle`). 폰 데이터 변경(create/update/toggleDone/softDelete/restore/캘린더 pull) 후 `dashboard` store 무효화 시점에 `WatchSyncService.pushSnapshot()`(디바운스)로 최신 스냅샷을 `updateApplicationContext` 전송. `AppState 'active'` 전이·워치 `sendMessage` 수신 시에도 push. Android 는 no-op. (logic §17.2)

---

## 인증 / 권한 및 오류 처리 요약

- **인증**: 앱 자체 인증 없음(단말 로컬 앱). 계정 연동은 **OAuth 2.0 + PKCE**(외부 IdP)로 위임하며, 액세스/리프레시 토큰은 OS 보안 저장소(Keychain/Keystore)에 저장. 세부는 `logic.md` 「보안 설계」.
- **권한(앱 내)**: 단일 사용자, 역할 구분 없음. 모든 로컬 데이터는 단말 소유자만 접근. OS 권한(알림, 캘린더)은 런타임 요청하며 거부 시 해당 기능만 비활성(E-08-1, E-14-1).
- **시각 취급 규칙(v1.8, P-16/P-17 / v1.11 표기 정정)**: "현재 시각"은 **표시 계층을 포함한 모든 계층에서 `Clock` 포트(`now()`/`timeZone()`)를 경유**한다. 화면 컴포넌트는 `Date.now()` / 무인자 `new Date()` 로 현재 시각을 얻지 않는다. "로컬 자정(날짜 경계)"은 `Clock` 포트 메서드가 아니라 순수 함수 `startOfLocalDay(clock.now(), clock.timeZone())`(`src/core/domain/time.ts` — `DashboardService` 내부와 동일)로 계산한다(DASH-01). 이미 알고 있는 epoch ms 를 `new Date(ts)` 로 포맷팅하는 것은 허용(포맷 전용). 상세 `logic.md` §16.11 / §0.1.
- **오류 처리 방침**:
  - 입력 검증 실패는 저장 이전에 필드 단위 오류로 반환(AC-02/03), 데이터 변경 없음.
  - 쓰기 작업은 단일 SQLite 트랜잭션. 실패 시 전체 롤백, UI 상태 롤백(E-05-2).
  - OS 게이트웨이(알림/캘린더/OAuth/WatchConnectivity) 실패는 도메인 데이터에 영향 주지 않음(부분 실패 격리). 사용자 안내 + 재시도 경로 제공.
  - **워치 동기화(v1.9, F-19)**: 베스트-에포트(NFR-12). 워치 연결 실패/미설치는 폰 기능을 저해하지 않는다 — 폰은 `WatchSyncGateway` 실패를 로깅 후 무시하고 계속. 워치는 마지막 스냅샷으로 조회 + 보류 큐로 완료 토글 지속(E-19-1). 워치→폰 완료 토글 op 은 수신 시 `scheduleId` 재조회·`opId` 중복 제거·LWW(§17.4) 검증 후 `ScheduleService.toggleDone` 로만 반영 — 그 외 필드/동작은 워치에서 수용하지 않는다(P-43).
  - 상세 예외 흐름과 에러 코드 체계는 `logic.md` 참조.

---

## 보안 요약

`logic.md` 「보안 설계」의 핵심만 요약:

| 위협(STRIDE/OWASP) | 대응 |
| --- | --- |
| 단말 분실 시 로컬 일정(제목/메모) 유출 — Information Disclosure | 민감필드 취급 정책 + 선택적 SQLCipher 전체 암호화(키는 Keychain/Keystore), 알림 본문 제목 마스킹 토글(P-10-1) |
| OAuth 토큰 탈취 — Spoofing/Elevation | Authorization Code + PKCE, 토큰은 Keychain(`ACCESSIBLE_WHEN_UNLOCKED_THIS_DEVICE_ONLY`), 리프레시 실패 시 로컬 모드 강등 |
| SQL Injection (검색어/제목) — Injection | 모든 쿼리 파라미터 바인딩, FTS 쿼리 이스케이프, 동적 SQL 금지 |
| 캘린더 데이터 역주입 / 과신 — Tampering | 외부 캘린더 필드는 신뢰 경계 밖 입력으로 취급, 길이/타입 검증 후 저장, 로컬 편집 필드 우선 병합 |
| 딥링크/알림 페이로드 위조 — Tampering | 알림 payload는 scheduleId(정수)만, 수신 시 저장소 재조회로 검증 |
| 민감정보 로그 노출 — Information Disclosure | 로그에서 제목/메모/토큰/좌표 마스킹, 릴리스 빌드 로그 레벨 축소 |
| 워치로 일정 제목 노출면 확대 — Information Disclosure (F-19) | 페이로드 최소화(오늘 + 다음 1건, 제목/시작시각/유형라벨·색/완료상태만 — 메모·이력·토큰·알림·계정 미포함, P-40), WatchConnectivity 는 OS 페어링·암호화 채널, 워치 로컬 스냅샷 파일에 데이터 보호 적용. 상세 `logic.md` §13.9 |
| 워치→폰 완료 토글 op 위조/재생 — Tampering (F-19) | op = `{opId, scheduleId(정수), done(bool), watchChangedAt, baseUpdatedAt}` 만; 수신 시 `scheduleId` 재조회 + `opId` 중복 제거 원장 + LWW; `toggleDone` 외 경로 없음(P-43). WCSession 은 동일 team ID 페어드 확장으로 OS 제한 |
| 대시보드 접이식 검색(F-22) 입력 — Injection (v1.10 / v1.11) | 접이식 검색은 이미 로드된 `items` 배열의 표시 계층 순수 필터(`String.includes`) — SQL·FTS·`SearchService` 미경유, 동적 쿼리 표면 없음. 결과는 `<Text>` 렌더. `referenceDate`/`inlineQuery`/`searchExpanded` 는 화면 로컬 state — 저장소·로그 미기록(P-45/P-50/P-53). v1.11 `searchExpanded` 토글은 UI 표시 상태일 뿐 새 입력·저장 표면 없음. 신뢰 경계·비밀정보 변화 없음(표면 축소). 상세 `logic.md` §13.3 |

잔여 위험: 루팅/탈옥 단말, OS 백업에 포함되는 평문(암호화 미선택 시), 디바이스 잠금 미설정 사용자, 잠금 해제된 분실 워치에서 오늘 일정 제목 열람 — `nfr.md`/`logic.md`에 residual risk로 기록. (대시보드 진행률 한 줄·접이식 검색(v1.11)은 새 저장·전송·주입 표면을 만들지 않는다 — 표면 축소.)

---

## 설계 문서

| 문서 | 목적 |
| --- | --- |
| `overview.md` | 전체 구조, 기술 스택 결정, 설계 간 관계, **클라이언트 셸 아키텍처(v1.1)**, 미결정 사항 (본 문서) |
| `logic.md` | 서비스의 처리 흐름 + 상태 변화 + 예외, 「API 설계」(외부 OAuth/캘린더 연동 계약 — 워치는 외부 API 아님·해당 없음), 「보안 설계」, **§16 클라이언트 셸 처리 흐름(v1.1)**, **§16.9 브랜드 로딩 인디케이터(v1.7, F-17)**, **§5.1 유형 관리 계약 / §6 전역 알림 게이트 / §7 대시보드 데이터 소스 / §16.3.3~16.3.5 / §16.10 SwipeableRow / §16.11 표시 시각(v1.8)**, **§17 애플워치 워치 동기화 + §13.9 워치 보안(v1.9, F-19) + §17.11 watchOS 앱 타깃 구성·Swift 레이아웃·페이로드 바인딩·빌드/스크린샷 검증 절차(v1.14 구현 착수)**, **§7.1 대시보드 기준 날짜·진행률 한 줄·접이식 검색 + §16.3.7 화면 레이아웃/상태(v1.10 신설 / v1.11 재작성, F-20/F-21/F-22)**, **§7.2 통계 화면 집계 + §16.3.8 통계 화면 레이아웃/상태(v1.12 신설, F-23) + §8/§16.2 F-11 진입점 이전(v1.12)**, **§16.3.8 하단 그래프 렌더 막대 → 선(line) 교체(v1.13, 집계 계약 불변)** |
| `database.md` | SQLite 스키마(테이블·인덱스·FTS·제약), 마이그레이션 러너, 초기 데이터. **v1.6 — 스키마 무변경**(§9 v1.3 재설계분 + §10 F-19 워치(+ v1.6 "구현 착수 확인" 문단 — watchOS 앱 타깃·Swift 소스·워치 로컬 JSON 은 공유 SQLite 밖) + §11 대시보드 개선 + §12 F-23 통계 재검토). 신규 테이블·컬럼·인덱스·트리거·`APP_SETTING` 키 없음. **v1.13(막대→선 시각화)·v1.14(watchOS 앱 타깃 구현 착수) 모두 DB 무영향** |
| `nfr.md` | 성능/용량/가용성/관측성 목표의 기술적 구체화, Tester 검증 관점, **§11 셸 검증 관점(v1.1)**, **§13 로딩 애니메이션 성능(v1.5, NFR-11)**, **§14 워치 동기화(v1.7, F-19 / NFR-10·NFR-12) + §11.1 로 watchOS 앱 타깃 빌드·시뮬레이터 설치/실행/WCSession 라운드트립/스크린샷 이동(v1.12, N-11 축소)**, **§15 대시보드 날짜 네비게이션·진행률 한 줄·접이식 검색(v1.8 신설 / v1.9 재확정 방향, F-20~F-22)**, **§16 통계 화면(v1.10 신설 / v1.11 막대→선 갱신 — 차트 렌더(§16.2 `react-native-svg` `Polyline`)·대량 집계 비용·접근성/스크린리더 대체 텍스트·Reduce Motion·i18n, F-23 / NFR-04·NFR-08·NFR-09, V-46~V-49)** |

---

## 영향 범위

### v1.14 (F-19 watchOS 네이티브 앱 타깃 `TodayWhatWatch` 구현 착수)

- **구현 예정(Developer) — `ios/` 네이티브만**:
  - `ios/TodayWhat.xcodeproj/project.pbxproj`: watchOS 앱 네이티브 타깃 `TodayWhatWatch` 추가(Sources/Resources/Frameworks 빌드 페이즈), iOS 앱 타깃에 "Embed Watch Content" `PBXCopyFilesBuildPhase`(dst=`Watch`) + `PBXTargetDependency`. 빌드 설정: `SDKROOT=watchos`, `WATCHOS_DEPLOYMENT_TARGET=10.0`, `TARGETED_DEVICE_FAMILY=4`, `PRODUCT_BUNDLE_IDENTIFIER=kr.purpledog.todaywhat.watchkitapp`, `SWIFT_VERSION=5.0`+, `CODE_SIGNING_ALLOWED=NO`(시뮬레이터). **편집 방식**: `xcodeproj` Ruby gem 스크립트 `ios/scripts/add_watch_target.rb`(멱등) 또는 Xcode GUI 1회 후 커밋 — 손편집 금지.
  - `ios/TodayWhat.xcodeproj/xcshareddata/xcschemes/TodayWhatWatch.xcscheme`(신규, 공유): Build=워치 타깃, Run/Test=워치 앱.
  - `ios/TodayWhatWatch/Info.plist`(신규): `WKApplication=true`, `WKCompanionAppBundleIdentifier=kr.purpledog.todaywhat`, `WKRunsIndependentlyOfCompanionApp=false`, `CFBundleDisplayName=오늘뭐해`. 네트워크 미사용 → ATS·권한 설명 없음.
  - `ios/TodayWhatWatch/**` Swift 소스(신규): `TodayWhatWatchApp.swift`(엔트리), `AppDelegate.swift`(`WKApplicationDelegate`), `WatchConnectivityService.swift`(`WCSessionDelegate`+`ObservableObject`), `Models.swift`(`Codable` — `src/core/watchSync/types.ts` 필드 1:1 미러 + 봉투), `SnapshotStore.swift`/`PendingQueue.swift`(JSON 파일, `.completeFileProtection`), `LWW.swift`(§17.6 Swift 미러), `TodayView.swift`/`ScheduleRow.swift`/`NotConfiguredView.swift`(뷰), `Assets.xcassets`(워치 앱 아이콘·AccentColor). 상세 `logic.md` §17.11.3.
  - (선택) `ios/scripts/add_watch_target.rb` + `#if DEBUG` 스크린샷용 시드 헬퍼(배포물 아님).
- **무변경**: `src/core/**`(도메인/포트/서비스/infra/migration/`watchSync/**`), `src/app/**`(TS — `WatchConnectivityGateway.native.ts`·`watchMessage.ts`·`composeNative` 배선 이미 완비), 공유 페이로드 계약(`types.ts`), DB DDL/인덱스/트리거/시드(`database.md` v1.6 — 스키마 무변경), `bindings.ts`, 기존 폰 화면, `ios/Podfile`/`Podfile.lock`(워치 타깃은 Pod 밖), `android/`.
- **신규 의존성**: **없음**. 워치 타깃은 시스템 프레임워크(`WatchConnectivity`/`SwiftUI`/`Foundation`, D-10 시 `WidgetKit`)만. npm/CocoaPods 추가 0. `react-native-watch-connectivity` 1.x 는 iOS 앱 타깃에만(v1.9 도입분).
- **재검증 필요 AC (Developer 구현 후 Tester)**: **AC-47**(워치 오늘 목록 시각순·최소 상세·헤더 카운트 — 시뮬레이터 스크린샷), **AC-23/AC-48**(워치 완료 토글 → 폰 대시보드 집계 반영 — 실제 WCSession 라운드트립), **AC-49**(오프라인 조회 + 보류 큐 + "동기화 대기" 배지), **AC-50**(LWW), **AC-51**(비범위 동작 차단 — 워치에 생성/편집/검색/설정 진입점 없음), **AC-54**(빈 상태 E-19-5 — 추가 버튼 없음), **AC-55**(Wear OS 미포함). 회귀: V-36~V-40(폰 측 순수/서비스 로직 — Swift 재구현이 계약을 바꾸지 않음).
- **회귀 위험**: 낮음. 폰 코드(TS)·공유 계약·DB·포트 무접촉. 산출물이 `ios/` 네이티브 타깃 + Swift 소스로 격리됨. iOS 앱 빌드에 Embed Watch Content 페이즈가 추가되므로 기존 `xcodebuild`(iOS 스킴) 빌드 시간이 소폭 증가 — 기능 회귀 아님. pbxproj 편집 오류만 주의(멱등 스크립트 권장).

### v1.12 (세 번째 탭 "검색"→"통계" 교체 + 통계 화면 F-23)

- **구현 예정(Developer) — 셸(`src/app`)만**:
  - `src/app/navigation/routes.ts`: `TAB_ROUTES.Search`(`'SearchTab'`) → `Statistics`(`'StatisticsTab'`). `STACK_ROUTES` 에 `Search: 'Search'` 추가. `TabParamList` `SearchTab` → `StatisticsTab: undefined`. `RootStackParamList` 에 `Search: { initialQuery?: string } | undefined` 추가(기존 `TabParamList.SearchTab` 의 `initialQuery` 를 이관). `NavigationTarget` 무변경(검색 딥링크 없음).
  - `src/app/navigation/RootNavigator.tsx`: 3번째 `<Tab.Screen>` → `component={StatisticsScreen}` `options={{ title: '통계' }}`. `TAB_ICONS`/`TAB_FALLBACK_LABELS` 의 3번째 항목 키를 `Statistics` 로(아이콘 `statistics.png` 그대로 — F-16/AC-26), 폴백 라벨 `'검색'` → `'통계'`. `<Stack.Screen name={STACK_ROUTES.Search} component={SearchScreen} options={{ title: '검색' }} />` 추가. `CalendarScreen` 헤더(`headerRight`)에 검색 아이콘 버튼 → `navigation.navigate('Search')`(D-20(a)).
  - `src/app/screens/StatisticsScreen.tsx`(신규): 상단 카드 2장 + 하단 유형별 월별 그래프(v1.12 막대 → **v1.13 선(line) 그래프로 교체 — 아래 v1.13 절**) + 연도 선택 컨트롤(prev/next, 기본 올해). 화면 로컬 state `selectedYear`(비영속). `useFocusEffect` 로 진입·복귀 시 `load()` 재조회(R-23-3) + pull-to-refresh. `load()` = `statisticsViewModel` 순수 함수 조합으로 `ScheduleService.findInRange` 2회(전체 기간 / 선택 연도) cursor 루프 + `CategoryService.list()`. 빈 상태(E-23-1~4)·삭제 유형("기타" 합산, E-23-5)·로드 실패(E-23-4) 분기. F-17 인라인 로딩 인디케이터(§16.9.8 #6).
  - `src/app/screens/statisticsViewModel.ts`(신규, 순수 — `react`/`react-native` 미import, `dashboardViewModel.ts` 패턴): `currentYear(nowTs, tz)`, `yearRangeEpochs(year, tz)`, `monthBoundaries(year, tz)`(13개, `localWallToEpoch` 재사용), `monthIndexOf(startAtTs, boundaries)`, `aggregateTotals(rows)` → `{ total, done }`, `aggregateYear(rows, categories, boundaries)` → 12개 월 버킷 × 유형별 count, `statisticsEmptyState(...)`. `src/core/domain/time.ts` 의 `localWallToEpoch`/`DAY_MS` import(이미 공개·`dashboardViewModel` 도 `time.ts` import).
  - `src/app/components/`(선택): 순수 프레젠테이션 `StatBar`/`YearPicker` 등 분리 가능(Developer 재량, `src/core`·서비스·`bindings.ts` 무의존).
  - `src/app/state/bindings.ts`: `SearchScreen` 바인딩 유지(스택 화면으로도 유효). `StatisticsScreen` 항목 추가 — `reads: [{schedules, findInRange}, {categories, list}]`, `writes: []`, `invalidates: []`.
  - `src/app/state/stores.native.ts`: 신규 슬라이스 없음(통계는 화면 로컬 state). `search` 슬라이스 무변경.
- **무변경**: `src/core/**`(도메인/포트/서비스/infra/migration) — `ScheduleService.findInRange`·`CategoryService.list`·`DashboardService`·`ReminderScheduler` 시그니처·로직 그대로 재사용. `src/core/domain/time.ts` 는 기존 공개 함수만 사용(추가 없음). DB DDL/인덱스/트리거/시드(`database.md` §12), 기존 코어 테스트·`npm run demo`, `SearchScreen` 내부 로직·`SearchService`·`SCHEDULE_FTS`(P-54), `linking.ts`, 다른 셸 화면(Dashboard/Calendar 헤더 외/Settings/…), F-19 워치·F-17 로딩 인디케이터 코어.
- **신규 의존성**: **없음**. (v1.12 계획은 순수 RN `<View>` 높이 비율 막대 — v1.13 에서 기보유 `react-native-svg` 15.x `Polyline` 로 교체, 여전히 신규 pin 없음.) 차트 라이브러리(victory-native / react-native-chart-kit / gifted-charts) **도입하지 않음** — 정적 12점·인터랙션 없음(OI-23)·단일 사용자 로컬·"네이티브 모듈 최소화" 방침(§16.9.1 / SwipeableRow 와 동일 논리).
- **재검증 필요 AC (Developer 구현 후 Tester)**: **AC-69**(3번째 탭 "통계" 라벨·아이콘·"검색" 탭 부재), **AC-70**(상단 카드 총/완료 = 저장 전건/완료, 연도 바꿔도 불변), **AC-71**(기본 연도 = 올해 그래프, 3월/7월 버킷 유형별 구분), **AC-72**(연도 전환 시 그래프만 갱신·카드 불변), **AC-73**(0건 → 카드 0/0 + "표시할 데이터가 없습니다" / 선택 연도 0건 → 그래프만 "해당 연도에 일정이 없습니다"·카드 유지), **AC-74**(삭제 유형 → "기타" 합산·"운동" 계열 없음), **AC-75**(rename → 계열 라벨 새 이름·참조 유지), **AC-76**(D-20 가정: 캘린더 헤더 검색 아이콘 → F-11 진입, AC-13/AC-14 동작 동일). 회귀: AC-26(탭 아이콘 매핑), AC-13/AC-14(F-11 검색·필터 — 진입점만 이전), F-16 탭 바.
- **회귀 위험**: 낮음. 코어·DB·서비스·포트 무영향. 신규 화면 1개 + 순수 뷰모델 1개 + 네비게이션 배선. `SearchScreen` 은 내부 코드 무변경(등록 위치만 Tab→Stack). F-11 검색 로직·`SearchService`·FTS 무접촉이므로 AC-13/AC-14 회귀는 진입 경로 확인만.

### v1.13 (F-23 하단 그래프 막대 → 선(line) 시각화 교체)

- **구현 예정(Developer) — `src/app` 렌더 계층만**:
  - `src/app/screens/StatisticsScreen.tsx`: `'ok'` 분기의 하단 그래프 렌더를 순수 `<View>` 높이 비율 막대(현행 `chart`/`col`/`barArea` 스타일 + 세그먼트 `<View>`)에서 **`react-native-svg`** 구성으로 교체. `<Svg>` 안에 유형(계열)당 `<Polyline points stroke={colorOf(cid)} strokeWidth≈2 fill="none" strokeLinejoin="round" />` 1개(12점 = `yearAgg.months[m-1].byCategory[cid] ?? 0`), 건수 > 0 점마다 `<Circle r≈3 fill={colorOf(cid)} />`, x축/베이스라인/(선택) 수평 그리드 `<Line>`. 월 숫자 레이블은 기존 `<Text>` 행 유지. 좌표: `x(m)=padLeft+(m-1)/11*plotW`, `y(v)=padTop+(1 - v/yMax)*plotH`, `yMax=max(1, seriesPointMax)`.
  - `seriesPointMax` = `yearAgg` 로부터 `useMemo` 로 순수 계산(`max over m,cid of byCategory[cid]`). 원하면 `statisticsViewModel.ts` 에 **기존 export 를 건드리지 않는** 신규 순수 함수로 분리 가능(예: `seriesPointMax(agg): number`).
  - 범례(`legend`/`legendItem`/`swatch`/`legendText`)·연도 컨트롤·카드·빈 상태 분기(`emptyState` 5값)·`load()`/`loadYear()`/`useFocusEffect`/pull-to-refresh/F-17 인디케이터·`buildGraphSummary`(그래프 영역 데이터 요약 `<Text>`)는 **그대로 유지**. `import` 에 `react-native-svg` 심볼 추가, 불필요해진 막대 전용 스타일 정리.
  - (선택) 순수 프레젠테이션 `LineChart` 컴포넌트로 분리 가능(Developer 재량, `src/core`·서비스·`bindings.ts` 무의존, props 로 `YearAggregate`+색·라벨 함수 주입).
- **변경 금지**: `src/core/**` 전체, DB DDL/인덱스/트리거/시드, `src/app/state/bindings.ts`(`StatisticsScreen` 바인딩 유지), `src/app/navigation/**`, `src/app/screens/statisticsViewModel.ts` 의 기존 export 시그니처·`YearAggregate` 반환 형태, `tests/app/statisticsViewModel.test.ts`. `package.json` 의존성(react-native-svg 는 이미 존재 — 추가 금지). 집계·데이터 소스·월 버킷·삭제 유형/rename/빈 상태 로직.
- **신규 의존성**: **없음**. `react-native-svg` 15.11.x 는 F-17 로 이미 설치·pod link 완료.
- **재검증 필요 AC (Developer 구현 후 Tester)**: **AC-71**(기본 연도 그래프에 3월 업무 2·취미 1, 7월 업무 1 이 유형별로 구분 표시 — 이제 선/색/범례로), **AC-72**(연도 전환 시 그래프만 갱신), **AC-73**(선택 연도 0건 → 그래프 영역만 안내), **AC-74**(삭제 유형 "기타" 계열), **AC-75**(rename 계열 라벨). 회귀: AC-69/AC-70(탭·카드 — 그래프 무관하게 불변), 그래프 영역 데이터 요약 `<Text>` 접근성(NFR-08).
- **테스트 영향**: 기존 `statisticsViewModel` 단위 테스트 무변경(뷰모델 불변). 신규 `seriesPointMax` 헬퍼를 만들면 그 순수 함수 단위 테스트만 추가. 선 polyline 좌표·`Circle` 실렌더는 온디바이스 후속(`nfr.md` §16.6, §11).
- **회귀 위험**: 낮음. 단일 화면의 `'ok'` 분기 렌더만 교체. 집계·상태·네비·DB·보안 무영향.

### v1.11 (대시보드 재확정 방향 — F-20 컴팩트 / F-21 진행률 한 줄 / F-22 접이식 검색 / DASH-01 정정)

- **구현 예정(Developer) — 셸(`src/app`)만, v1.5(=설계 v1.10) 구현 대비 변경분**:
  - **F-21 진행률 한 줄 교체**: `src/app/components/CountCards.tsx` → `src/app/components/ProgressLine.tsx` 로 대체(파일 rename + 재작성). props `{ total: number; done: number; isFuture: boolean; testID? }`. 과거·오늘 = "M / N 완료" 텍스트 + 얇은 progress bar 1개(채움 = `total===0 ? 0 : done/total`, P-07). 미래(`isFuture`) = "일정 N건"만(bar·완료 수·완료율 숨김, P-52). 순수 프레젠테이션(`src/core`·서비스·`bindings.ts` 무의존). `accessibilityRole="progressbar"` + 인접 텍스트로 색 비의존 진척 전달(NFR-08).
  - **`DashboardScreen.tsx`**:
    - `<CountCards total done />` → `<ProgressLine total={summary?.total ?? 0} done={summary?.done ?? 0} isFuture={isFutureDate(referenceDate, todayStartValue)} />`.
    - **`searchExpanded` 도입**: `const [searchExpanded, setSearchExpanded] = useState(false)`(P-53). 진행률 한 줄과 리스트 사이에 검색 아이콘 상시 렌더 → 탭 시 `toggleSearch()`(펼침 시 `TextInput` `autoFocus`, 접힘 시 `setInlineQuery('')` — D-18(a)/E-22-6). `TextInput`+clear 는 `searchExpanded === true` 일 때만 렌더.
    - **`resetDashboardView()` 에 `setSearchExpanded(false)` 추가**(현재 `setReferenceDate`/`setInlineQuery`/`setDebouncedQuery` 만) — "오늘로" 복귀·탭 blur·콜드 스타트 시 접힘(P-50/P-53/E-22-7). `goPrevDay`/`goNextDay` 는 `searchExpanded`·`inlineQuery` 미변경(E-22-2/AC-65 유지).
    - 날짜 네비게이션 영역을 한 줄 컴팩트 배치로(F-20 "작게" 요건 — 높이·타이포 축소, OI-15). 규칙·핸들러 로직은 무변경.
    - 빈 상태·검색 무결과 문구 분기(`dashboardListEmptyState`)는 그대로. 미래 날짜 & 0건이면 진행률 한 줄 "일정 없음", 목록은 E-10-1.
  - **`src/app/screens/dashboardViewModel.ts`**:
    - 신규 순수 헬퍼 `isFutureDate(refTs: number, todayStartTs: number): boolean` = `refTs > todayStartTs`(둘 다 로컬 자정 epoch ms, P-17).
    - **DASH-01 정정 반영**: `stepReferenceDate` 는 이미 방향 무관 `+ halfDay` 로 교정되어 있음(현 구현 유지). 문서(logic §16.3.7)만 예시식을 `+ dir*HALF_DAY` → `+ HALF_DAY` 로, `clock.startOfLocalDay()` 서술을 순수 `startOfLocalDay`(`src/core/domain/time.ts`) 직접 사용으로 정정 — **구현 변경 없음**.
- **무변경**: `src/core/**`(도메인/포트/서비스/infra/migration) — `DashboardService.getSummary(dateTs?)`·`ScheduleService.findInRange` 시그니처·로직 그대로 재사용, DB DDL/인덱스/트리거/시드(`database.md` §11), `ReminderScheduler`/알림 경로, 기존 코어 테스트·`npm run demo`, 다른 셸 화면(Calendar/Search/Settings/…), Zustand 슬라이스 정의, `bindings.ts`(`DashboardScreen.reads` 는 v1.10 지시대로 `dashboard.getSummary` 포함), `routes.ts`(`ScheduleEditor { presetDate?: number }` 유지 — OI-19).
- **신규 의존성**: **없음**. progress bar 는 RN `<View>` 너비 비율로 구현(신규 네이티브 모듈·npm 패키지 없음).
- **재검증 필요 AC (Developer 구현 후 Tester)**: **AC-60**(진행률 한 줄 "M / N 완료" + 25%/50% bar, 토글 시 갱신), **AC-61**(빈 상태 "0 / 0 완료" + 0% bar), **AC-62**(검색 아이콘 탭 펼침 후 실시간 필터, 진행률 한 줄 수치·bar 불변), **AC-63**(접이식 무결과 문구 구분), **AC-64**(검색어 초기화 — clear 및 접힘 시 D-18(a)), **AC-65**(날짜 이동 시 검색어·펼침 유지; "오늘로"·탭 이탈 시 초기화·접힘), **AC-66**(접이식 ↔ 전역 검색 독립), **AC-67**(검색 아이콘 토글·포커스 이동 — 신규), **AC-68**(미래 날짜 "일정 N건"만, 오늘·과거 복귀 시 복원 — 신규). 회귀 확인: AC-57~59(날짜 이동·오늘로·자정), AC-04/15/16/44~46(대시보드 기존 동작).
- **회귀 위험**: 낮음. 코어·DB·서비스·포트 무영향. `DashboardScreen` 단일 화면 + 순수 컴포넌트 1개 rename·재작성 + 순수 헬퍼 1개 추가. `referenceDate = 오늘` & `searchExpanded = false` 기본 경로가 v1.10 동작과 동일하므로 AC-04/15/16/44~46 회귀 가드됨. DASH-01 은 문서 정정만(구현 무변경).

### v1.10 (대시보드 F-20 날짜 탐색 / F-21 개수 카드 / F-22 인라인 검색)

- **구현 예정(Developer) — 셸(`src/app`)만**:
  - `src/app/screens/DashboardScreen.tsx`:
    - `referenceDate`(number, 로컬 자정 epoch)·`inlineQuery`(string) 로컬 state 추가. 초기값 `referenceDate = clock.startOfLocalDay(clock.now(), clock.timeZone())`, `inlineQuery = ''`.
    - `load()` 를 `referenceDate` 파라미터화: `getSummary(referenceDate)` + `findInRange(referenceDate, referenceDate + DAY_MS, undefined, 'startAt', DASHBOARD_PAGE_SIZE, cursor)` cursor 루프. `todayRange()` 제거.
    - `useEffect([referenceDate])` 로 날짜 변경 시 재로딩. in-flight 응답 stale 처리(`loadSeq` ref 비교, E-20-4).
    - **날짜 탐색 영역**(F-20): 좌/우 화살표(`stepReferenceDate(refTs, dir)` — `clock.startOfLocalDay` + 12h 쿠션, §16.3.7 자정/DST-안전 공식), 날짜 라벨(`Intl.DateTimeFormat` 로캘, `referenceDate === todayStart` 시 "오늘 ·" 접두), "오늘로" 버튼(`referenceDate !== todayStart` 일 때만; 탭 시 `referenceDate = todayStart` + `inlineQuery = ''`).
    - **개수 카드 영역**(F-21): `<CountCards total={summary.total} done={summary.done} />` 순수 컴포넌트. 로드 실패 시 카드 영역 재시도(E-21-2).
    - **인라인 검색 영역**(F-22): `TextInput` + clear 버튼 → `inlineQuery`. `debouncedQuery`(200ms). 목록은 `useMemo(() => filterByQuery(items, debouncedQuery), [items, debouncedQuery])`.
    - **자정 롤오버**(P-46): `AppState 'active'`·`useFocusEffect` 에서 `prevTodayStartRef` 대비 판별 → 오늘을 보고 있었으면 `referenceDate` 를 새 오늘로, 아니면 유지(§16.3.7).
    - **탭 이탈 리셋**(D-12): Dashboard 탭 `blur`(형제 탭 전환) 시 `resetDashboardView()`. Stack push(Detail/Editor) 복귀는 리셋 아님.
    - 빈 상태/검색 무결과 문구 분기(E-10-1 vs E-22-1). FAB/"일정 추가" 는 `referenceDate !== todayStart` 시 `presetDate` 파라미터 동반(OI-19).
  - `src/app/components/CountCards.tsx`(신규, 순수 프레젠테이션 — `src/core`·서비스·`bindings.ts` 무의존, props 만): 총 일정·완료 일정 2장 카드.
  - `src/app/state/bindings.ts`: `DashboardScreen.reads` 에 `{ service: 'dashboard', method: 'getSummary' }` 추가(현재 `findInRange` 만 — logic v1.8/§7 지시 반영). `invalidates` 슬라이스 변경 없음.
  - `src/app/navigation/routes.ts`: `ScheduleEditor` 파라미터에 `presetDate?: number` 추가(선택, OI-19).
  - (선택·Developer 재량) `src/core/domain/time.ts` 에 순수 헬퍼 `addLocalDays(ts, days, tz)` 추가 가능 — `startOfLocalDay`/`DAY_MS` 와 동일 파일의 순수 시간 유틸. 미추가 시 화면이 `clock.startOfLocalDay` + 쿠션 공식으로 처리(§16.3.7). 어느 쪽이든 **포트·서비스 계약 무변경**.
- **무변경**: `src/core/{domain(추가 헬퍼 예외),ports,services,infra,migration}/**` — `DashboardService.getSummary(dateTs?)`·`ScheduleService.findInRange` 시그니처·로직 그대로 재사용, DB DDL/인덱스/트리거/시드(`database.md` §11), `ReminderScheduler`/알림 경로, 기존 코어 테스트·`npm run demo`, 다른 셸 화면(Calendar/Search/Settings/…), Zustand 슬라이스 정의.
- **신규 의존성**: **없음**. `Intl.DateTimeFormat` 은 RN Hermes 내장(로캘 데이터는 기존 국제화 설정 범위). 새 네이티브 모듈·npm 패키지 없음.
- **회귀 위험**: 낮음. 코어·DB·서비스·포트 무영향. `DashboardScreen` 단일 화면에 로컬 state·파생 필터·신규 UI 영역 추가(기존 요약/목록/토글/삭제 경로는 인자만 `referenceDate` 로 일반화). AC-04/AC-15/AC-16/AC-44/AC-45/AC-46 회귀는 "referenceDate = 오늘" 기본 경로가 기존 동작과 동일하므로 가드됨.

### v1.9 (F-19 애플워치 워치 타깃)

- **신규(Developer) — 코어(`src/core`)**:
  - `src/core/ports/gateways.ts`: `WatchSyncGateway` 인터페이스 추가(`activate()`, `isSupported()`, `sendSnapshot(snapshot)`, `onIncomingToggle(cb)`, `ack(opId, result)`). 기존 포트 무변경.
  - `src/core/watchSync/snapshot.ts`(신규 순수): `buildWatchSnapshot(schedules, categories, clock)` — 오늘(로컬 자정, P-17) 목록 + 다음 예정 1건 파생, 필드 최소화(P-40), 시각 = epoch ms + IANA tz(P-39). `DashboardService` 와 동일한 `startOfLocalDay`/`findForDashboard` 파생 규칙 재사용.
  - `src/core/watchSync/reconcile.ts`(신규 순수): `resolveToggleLWW(op, schedule)` → `'APPLY' | 'SKIP_PHONE_WINS' | 'REJECT_NOT_FOUND'` (E-19-3).
  - `src/core/services/watchSyncService.ts`(신규): `pushSnapshot()`(빌더 호출 → `WatchSyncGateway.sendSnapshot`), `applyIncomingToggle(op)`(dedup 원장 → `reconcile` → `ScheduleService.toggleDone` → 원장 기록 → `pushSnapshot`). `toggleDone` 외 서비스 호출 없음(P-43).
  - `src/core/app.ts` `buildApp`: `watchSync?` 옵션 추가(미지정 시 `NoopWatchSyncGateway` — 기존 테스트·demo 무영향, REGRESSION 후방 호환).
- **신규(Developer) — 셸(`src/app`)**:
  - `src/app/adapters/watch/WatchConnectivityGateway.native.ts`: `react-native-watch-connectivity` 로 `WatchSyncGateway` 구현. iOS 전용, Android 는 `isSupported()=false` no-op.
  - `bootstrapSequence`/`composeNative`: 워치 게이트 활성화 + 수신 콜백 배선(iOS), 폰 데이터 변경 후 `pushSnapshot` 디바운스 호출.
- **신규(Developer) — 네이티브 iOS**: Xcode `ios/` 에 **watchOS 앱 타깃**(`TodayWhatWatch`, SwiftUI) + (D-10 시) 컴플리케이션 확장. Swift 로 오늘 목록·완료 토글·LWW·보류 큐·로컬 스냅샷 파일 구현. `src/core` 미링크.
- **무변경**: DB DDL/인덱스/트리거/시드(`database.md` §10 — LWW=`UPDATED_AT`, dedup=`APP_SETTING`), `ScheduleService`/`DashboardService`/`ReminderScheduler`/`CategoryService`/`SettingService` 로직(워치는 `toggleDone` 만 호출), 기존 셸 화면(Dashboard/Calendar/…) — 워치는 화면이 아님, `bindings.ts` `SCREEN_BINDINGS`.
- **신규 의존성**: `react-native-watch-connectivity` 1.x (iOS 네이티브 모듈, `pod install`). Android 미지원 → iOS 전용 부분 채택. `lottie`/기타 무관.
- **회귀 위험**: 낮음. 코어 서비스 로직 무변경(신규 서비스·순수 모듈 추가만). `buildApp` 옵션은 후방 호환(기본 no-op). 폰 UI 흐름 무변경. `ReminderScheduler`/알림 경로 무접촉(P-41).

### v1.8 (v1.3 재설계분 정식화 — F-06 / F-10 / F-18)

- **구현 예정(Developer)** — 재설계 코드를 설계에 맞게 정합화:
  - `src/core/services/categoryService.ts`: `create()` 에 중복 이름 검증(트림 + 대소문자 무시, `categories.list()` 대조) 추가. `rename(id, name)` 에 (a) `findById` → `NOT_FOUND_CATEGORY`, (b) `isSystem` → `POLICY_SYSTEM_CATEGORY_RENAME`, (c) 트림·길이 1..30, (d) 중복(자기 제외) 검증 추가 후 `categories.rename` 위임. (logic §5.1)
  - `src/core/domain/errors.ts`: `ErrorCodes` 에 `VALIDATION_CATEGORY_NAME_REQUIRED`, `VALIDATION_CATEGORY_NAME_DUPLICATE`, `POLICY_SYSTEM_CATEGORY_RENAME` 추가.
  - `src/core/services/reminderScheduler.ts`: `syncOnce()` 앞부분에 **전역 알림 게이트** — `settings.notificationsEnabled()` false 면 범위 내 `SCHEDULED` reminder 를 `notifications.cancel` + `markState('CANCELLED')` 후 조기 반환(신규 예약 없음). 신규 메서드 `applyGlobalNotificationsToggle(enabled)`: `false` → `reminders.findDue(now, Number.MAX_SAFE_INTEGER - now)` 로 활성(PENDING/SCHEDULED) 전부 취소·`CANCELLED`; `true` → no-op(D-07 (a), 회귀 재예약 없음). `metric('reminder.globalDisable.cancelled', n)`. (logic §6)
  - `src/core/services/settingService.ts`: `SettingKeys` 상수에 `NOTIF_ENABLED='notif.enabled'`, `SCHEDULE_DEFAULT_PRIORITY='schedule.defaultPriority'`, `SCHEDULE_DEFAULT_CATEGORY_ID='schedule.defaultCategoryId'` 추가(`bindings.ts` `SETTING_KEYS` 와 일치). 헬퍼 `newScheduleDefaults()` 추가. 기존 `get/set`·`notificationsEnabled/setNotificationsEnabled` 유지. (logic §10)
  - `src/app/state/bindings.ts`: `DashboardScreen.reads` 에 `{ service: 'dashboard', method: 'getSummary' }` 추가(기존 `findInRange` 병행). `CategoryManagerScreen.writes` 에 `{ service: 'categories', method: 'rename' }` 추가. `SettingsScreen.writes` 에 `{ service: 'scheduler', method: 'applyGlobalNotificationsToggle' }` 추가.
  - `src/app/screens/DashboardScreen.tsx`: (a) 상단 브랜드 영역(logo.png + tagline.png, §16.3.2 규약, 화면 폭 60% 이하) 복원 — T-01. (b) 요약 영역을 `DashboardService.getSummary` 결과(총계/완료/미완료/완료율/유형별 분포/다음 예정)로 렌더 — T-02. (c) 오늘 목록은 `findInRange`(page size `DASHBOARD_PAGE_SIZE=100`, `nextCursor` 루프)로 유지. (d) 빈 상태 브랜치에 명시적 "일정 추가" 버튼 + 상시 FAB 병존 — T-06. (e) `todayRange()` 를 `clock.startOfLocalDay(clock.now(), clock.timeZone())` 기반으로 — T-04.
  - `src/app/screens/CalendarScreen.tsx`: 하드코딩 `500` → `CALENDAR_MONTH_PAGE_SIZE=200` + `nextCursor` 루프(월당 최대 10페이지 안전 상한). `new Date()`(현재 시각) → `clock` 경유 — T-04/T-05.
  - `src/app/screens/SearchScreen.tsx`: `search.search({query, limit: SEARCH_PAGE_SIZE=50, cursor})` + `onEndReached` 추가 페이지 로드 — T-05.
  - `src/app/screens/CategoryManagerScreen.tsx`: 이름변경 UI 추가(비시스템 행 → 이름 입력 → `CategoryService.rename`), 시스템 행("기타")은 이름변경·삭제 컨트롤 비활성 + "기본 유형" 표기(AC-40). 오류는 `err.message` 인라인(E-06-3/4/5).
  - `src/app/screens/SettingsScreen.tsx`: "알림 사용" 토글 → `settings.set('notif.enabled', v)` **후** `scheduler.applyGlobalNotificationsToggle(v)` 호출(D-07). 새 일정 기본값 저장 경로 유지.
  - `src/app/screens/SwipeableRow.tsx` → `src/app/components/SwipeableRow.tsx` 로 이동 권장(순수 프레젠테이션, §16.10). 계약·구현(RN 내장 `PanResponder`+`Animated`) 유지. 삭제 확인(E-10-4)·캘린더 연동 일정(E-10-5/P-08) 처리는 **소비 화면** 책임(§16.10).
  - `src/app/bootstrap/AppContext`/`useServices`: `clock` 을 서비스 번들에 노출(표시 계층이 `Clock` 포트 사용, §16.11).
- **무변경**: DB 스키마(`database.md` — `IS_SYSTEM`·`REMINDER.STATE='CANCELLED'`·`APP_SETTING` k/v 모두 기존, v1.1은 검토 섹션만 추가), 포트 인터페이스 시그니처(`CategoryRepository.rename` 이미 존재, `ReminderRepository.findDue` 재사용), `ScheduleService.create/update`(알림 행 기록 로직 — P-32는 설정값 보존·예약 실행만 억제), 기존 코어 테스트(회귀 대상), `routes.ts`(`CategoryManager` 이미 등록).
- **신규 의존성**: **없음**. `react-native-gesture-handler` 는 스와이프 삭제 제스처 후보로 검토했으나 (a) 단일 축 수평 팬은 `PanResponder` 로 충분, (b) `GestureHandlerRootView` 래핑·네이티브 링크·`MainActivity` 변경·New Arch(N-9) 고려가 한 행 상호작용에 과함, (c) 프로젝트의 "네이티브 모듈 최소화" 방침(§16.9.1 reanimated/lottie 배제와 동일 논리) → **도입하지 않음**.
- **회귀 위험**: 중간. 코어 3개 서비스(`categoryService`·`reminderScheduler`·`settingService`) 로직 추가 → 기존 단위 테스트가 회귀 가드. 알림 게이트는 모든 예약 경로(create/update/restore/bootstrap/AppState/boot)가 `syncOnce()` 로 수렴하므로 단일 지점 변경. 대시보드 데이터 소스 정합화는 재설계 코드를 설계(v1.1~v1.5 기존)로 되돌리는 방향이라 신규 표면 최소.

### v1.7 (F-17 브랜드 오리 로딩 인디케이터)

- **구현 예정(Developer)**:
  - `package.json`: `react-native-svg` 15.x 추가. `ios/`: `pod install` 재실행(신규 Pod autolink). Android 은 autolink.
  - `src/app/components/` **신규 디렉터리** (순수 프레젠테이션 계층):
    - `BrandLoadingIndicator.tsx` — 공개 컴포넌트(props 계약 §16.9.2). `variant='fullscreen'|'inline'`.
    - `loadingIndicatorMachine.ts` — 표시/모드 판정 순수 FSM(React 비의존, `node:test` 대상).
    - `useLoadingIndicator.ts` — FSM + 타이머 + `AccessibilityInfo` + rAF 샘플러 배선 훅.
    - `duck/duckGeometry.ts`(로고 오리 SVG path·색 상수, 순수), `duck/activities.ts`(순환 활동 목록·순서·타이밍, 순수), `duck/DuckScene.tsx`(활동 1컷 SVG), `SvgErrorBoundary.tsx`.
  - `App.tsx`: 부트스트랩 대기 중 `<ActivityIndicator/>` → `<BrandLoadingIndicator variant="fullscreen" loading />` 로 교체(D-06(4)).
  - `src/app/screens/DashboardScreen.tsx` / `CalendarScreen.tsx` / `SearchScreen.tsx`: 부분 로딩 상태 플래그 추가(Dashboard 는 기존 `loaded` 재활용, Calendar 는 `loadingMonth` 신규, Search 는 `searching` 신규) → 콘텐츠 영역에 `<BrandLoadingIndicator variant="inline" .../>` 1개만 마운트(E-17-8). Search 는 `startActivity="search"`.
  - `src/assets/` : 신규 에셋 없음 — 정적 폴백은 기존 `src/assets/icons/logo.png` 재사용(P-21).
- **무변경**: `src/core/**`(도메인/서비스/포트/어댑터 계약), DB 스키마(`database.md` v1.0), `src/app/state/bindings.ts`·`stores.native.ts`(로딩 인디케이터는 서비스 바인딩이 아님 — 화면 로컬 상태), `src/app/adapters/**`, 기존 코어 테스트·`npm run demo`.
- **신규 의존성**: `react-native-svg` 15.x (native module, `pod install` 필요). 앱 크기: ABI 당 수백 KB 네이티브 바이너리. lottie/reanimated/device-info 는 **도입하지 않음**.
- **회귀 위험**: 낮음. 코어·DB·서비스·포트 무영향. 셸 화면은 로딩 분기 UI만 추가(기존 렌더 경로 유지). SVG 렌더 실패는 `SvgErrorBoundary`→`logo.png`→`ActivityIndicator` 3단계로 격리(AC-34).

### v1.6 (N-10 해소 — 날짜/시각 DateTimePicker 도입)

- **구현 예정(Developer)**:
  - `package.json`: `@react-native-community/datetimepicker` 8.6.0 추가.
  - `ios/`: `pod install` 재실행(신규 Pod 연결).
  - `src/app/screens/ScheduleEditorScreen.tsx`: 날짜/시각 TextInput + 증감 버튼 제거 → `DateTimePicker`(mode='date') + `DateTimePicker`(mode='time') 2단계 피커로 교체. `startAt`/`endAt` 상태를 epoch ms(`number`)로 직접 관리. `localWallToEpoch` 저장 경로 호출 제거(함수 자체는 유지).
- **무변경**: 코어 서비스 계약(`ScheduleService.create/update`, `startAt: number` 계약), 포트 인터페이스, DB 스키마, 기존 테스트(V-26 `localWallToEpoch` 단위 테스트 유지 — 함수 존속), `routes.ts`, `bindings.ts`.
- **신규 의존성**: `@react-native-community/datetimepicker` 8.6.0 (native module, `pod install` 필요).
- **회귀 위험**: 낮음. 서비스 계약(`startAt: number`) 무변경. UI 교체만이므로 코어 테스트 회귀 없음.

### v1.5 (F-16 앱 아이덴티티 UI)

- **구현 예정(Developer)**:
  - `src/app/navigation/RootNavigator.tsx`: `Tab.Navigator`의 각 `Tab.Screen`에 `tabBarIcon` 옵션 추가 — PNG 에셋을 `Image`로 렌더하고 활성 여부에 따라 `opacity` 또는 `tintColor` 적용 (P-19, AC-27).
  - `src/app/screens/DashboardScreen.tsx`: 헤더 로고(logo.png) + 태그라인(tagline.png) 렌더 영역 추가 — 화면 폭 60% 이하 제한(P-20), ScrollView 최상단 배치 (AC-25).
- **무변경**: 코어 서비스·포트 계약·DB 스키마·라우트·상태 슬라이스·기존 12개 코어 테스트.
- **신규 의존성**: 없음 — `Image`는 react-native 내장 컴포넌트.
- **회귀 위험**: 없음 — 기존 기능 변경 없이 UI 요소만 추가.

### v1.4 (일정 추가/수정 화면 연결)

- **구현 예정(Developer)**: `src/app/navigation/RootNavigator.tsx`(Dashboard/Calendar `headerRight`「+」, `ScheduleDetail`「편집」 — `useNavigation`), `src/app/screens/ScheduleEditorScreen.tsx`(F-01 폼으로 확장), `src/app/screens/DashboardScreen.tsx`·`CalendarScreen.tsx`·`ScheduleDetailScreen.tsx`(진입 버튼), 신규 날짜/시간 입력 컴포넌트(`src/app/ui/` 하위), 선택 `src/core/domain/time.ts`(`localWallToEpoch` 순수 함수 + 단위 테스트).
- **`bindings.ts` 정정 필요**: `ScheduleEditorScreen.reads` 에 `{ service: 'schedules', method: 'getById' }` 추가(수정 모드 프리필). `ScheduleDetailScreen.reads` 를 `findInRange` → `getById` 로 정정(실제 화면 코드와 일치). `invalidates` 는 이미 4-슬라이스.
- **무변경**: 코어 서비스 계약(`ScheduleService.create/update/getById`, `CategoryService.list/create`), 포트 인터페이스, `routes.ts`(`ScheduleEditor { scheduleId? }` 이미 정의), DB 스키마(`database.md` v1.0), 코어 도메인/서비스/검증 로직, 기존 12개 스펙·`npm run demo`.
- **신규 의존성**: 없음(네이티브 date picker 미도입 — N-10).
- **회귀 위험**: 낮음. 코어 무영향. 셸 화면 단위 테스트(서비스 목)로 폼 검증 매핑·무효화·네비게이션 확인.

### v1.1 (RN 앱 셸)

- **회귀 위험 영역**: `src/core/app.ts`의 `buildApp` 시그니처 확장(어댑터 오버라이드 파라미터 추가). **후방 호환 필수** — 기존 12개 테스트·`npm run demo`가 무변경 통과해야 한다(REGRESSION 검증 대상).
- **무변경**: `src/core/{domain,ports,services,infra,migration}/**`, `tests/**`, `tsconfig.json`(단, RN/JSX용 컴파일 옵션은 셸 전용 `tsconfig.app.json` 분리 또는 `jsx` 옵션 추가 — 코어 `typecheck` 결과에 영향 없도록), `document/architect/database.md`.
- **신규**: `src/app/**`, RN 프로젝트 파일(`index.js`, `App.tsx`, `metro.config.js`, `babel.config.js`, `react-native.config.js`, `app.json`), `android/`, `ios/`, 워치 타깃, `package.json` 의존성 추가(react, react-native, @react-navigation/*, zustand, @op-engineering/op-sqlite, @notifee/react-native, react-native-calendar-events, react-native-app-auth, react-native-keychain — 전부 overview 기술 스택 표의 고정 버전).
- **package.json 스크립트**: 기존 `test`/`typecheck`/`demo` 유지. 셸용 `lint`, (후속 환경용) `android`/`ios`/`start` 추가.

### v1.0 (코어 계층) — 완료

- 신규 프로젝트이므로 회귀 영향 대상 없음. 유지: `tsconfig.json` strict, TS 5.5 계열, git.
- `src/index.ts`는 코어 스모크 데모로 대체됨(유지).
- 코어 도메인/서비스/인메모리 어댑터/마이그레이션 러너 구현·검증 완료.

---

## 기술 스택 및 주요 기술 결정

기존 코드베이스 스택(**TypeScript 5.5 / npm / git / tsc strict**)을 계승한다. 그 위에 아래를 신규 선정한다. 런타임·주요 라이브러리는 major 고정.

| 영역 | 선정 | 고정 버전 | 근거 | 검토한 대안 |
| --- | --- | --- | --- | --- |
| 언어 | TypeScript | 5.5.x (repo 계승) | 기존 `devDependencies` 및 strict 설정 유지 | — |
| 앱 프레임워크 | React Native | 0.74.x | `알림앱.md` 확정("JS(TS)/react-native"). 0.74는 New Architecture 안정화·유지보수 대상 | Expo(관리형) — 네이티브 알림/캘린더/워치 커스텀 모듈 자유도 위해 제외 |
| 툴링 런타임 | Node.js | 20 LTS | RN 0.74 요구, LTS | Node 18(지원 종료 임박) |
| 화면 이동 | React Navigation | 6.x | RN 표준, 딥링크 지원(알림 탭 이동) | React Native Navigation(native) — 러닝코스트 |
| 상태 관리 | Zustand | 4.x | 경량, 코어 서비스와 분리 용이, 보일러플레이트 최소 | Redux Toolkit 2.x — 이번 범위엔 과함 / Context — 성능 |
| 로컬 DB | SQLite (`@op-engineering/op-sqlite`) | 9.x major 고정 (9.3.x pin) | `알림앱.md` 확정(SQLite). op-sqlite는 동기/비동기 API·prepared statement·**SQLCipher 옵션**(D-03 대응) 제공, New Arch 호환. **v1.2**: 6.x는 `cpp/types.h`가 `<vector>`를 include하지 않아 Xcode 26.2 clang(전이 include 불허)에서 컴파일 불가 → 9.x로 상향. 9.3.x는 헤더 정합 수정 + RN 0.74 peer 호환(`react-native: >0.73.0`) + 구아키텍처(`newArchEnabled=false`) 지원. 10.x는 동급 대체안, 11.x+는 RN 0.75+ 타깃이라 회피 | `react-native-quick-sqlite`(유지보수 둔화), `react-native-sqlite-storage`(구형 API), WatermelonDB(추상화 과다) |
| 마이그레이션 | 자체 러너 (`PRAGMA user_version`) | — | 스키마 소수·단일 클라이언트, ORM 불필요. 순번 SQL 파일 적용 | Drizzle/TypeORM 마이그레이션 — 의존성·번들 비용 |
| 날짜/시각 입력 | `@react-native-community/datetimepicker` | 8.6.0 (8.x major 고정) | N-10 해소. RN 0.74.x 호환(`react-native: '*'` peer). iOS/Android 공통 지원. Old Architecture(`newArchEnabled=false`) 지원. iOS: inline/spinner/compact 표시, Android: OS 다이얼로그. epoch ms 직접 추출로 텍스트 파싱 표면 제거(보안 개선). **버전 핀 근거**: N-10 계획 당시 "8.x" 명시, 8.6.0이 8.x 최신 안정 패치, 9.x와 동일 peer이나 계획 연속성 및 안정성 선호로 8.x 유지 | 순수 JS 캘린더 라이브러리(`react-native-calendars` — 번들 비용), 커스텀 휠 컴포넌트(구현 비용 과다), 텍스트 입력 + 파싱(이전 방식 — UX 열위 및 파싱 오류 위험) |
| SVG 벡터 렌더 | `react-native-svg` | 15.x major 고정 (15.11.x) | F-17 브랜드 오리 로딩 인디케이터(v1.7). 코드로 작성한 정적 SVG 도형(로고 오리 형태·색 유지)을 해상도 비의존으로 렌더. RN 0.74 호환, New/Old Arch 모두 지원. 애니메이션은 별도 라이브러리 없이 RN 내장 `Animated`(`useNativeDriver: true`)로 opacity/transform만 구동 | `lottie-react-native`(Bodymovin JSON 에셋 파이프라인·큰 네이티브 바이너리 — 미보유), `react-native-reanimated`(단순 루프에 과함·babel 플러그인/네이티브 추가), 순수 `View`+`borderRadius` 조합(로고 오리 형태 재현 난이도·레이아웃 코드 과다), 정적 PNG 시퀀스(NFR-11 "벡터 경량" 위배), 인라인 SVG 문자열 파서/WebView(§16.7 WebView 금지) |
| 로컬 알림 | `@notifee/react-native` | 9.x | 정밀 트리거(TimestampTrigger), 채널/카테고리, iOS/Android 통합 API, 부팅 후 재예약 훅 | RN PushNotificationIOS + 별도 안드로이드 구현 — 파편화 |
| 기본 캘린더 | `react-native-calendar-events` | 2.x | EventKit(iOS)/CalendarProvider(Android) 읽기·쓰기·권한 통합 | 플랫폼별 자체 브리지 — 유지비 |
| OAuth | `react-native-app-auth` | 7.x | Authorization Code + PKCE 표준 구현, IdP 중립(D-01=(c)에 부합) | WebView 직접 구현 — 보안 위험, 스토어 정책 |
| 보안 저장소 | `react-native-keychain` | 8.x | 토큰·DB 암호화 키를 Keychain/Keystore에 보관, 접근성 클래스 지정 | AsyncStorage 평문 — 금지 |
| 백그라운드/부팅 | `@notifee/react-native` + `react-native-boot-receiver`(Android) / iOS는 재예약을 앱 기동 시 수행 | — | P-09 알림 복원 | Headless JS 직접 구현 |
| 워치 앱 (F-19, v1.9 설계 / v1.14 구현 착수) | **네이티브 SwiftUI 단일 타깃 watchOS 앱**(`TodayWhatWatch`) — Xcode `ios/TodayWhat.xcodeproj` 에 신규 추가. SwiftUI `App` 라이프사이클 + `WKApplicationDelegateAdaptor`(레거시 App+Extension 2-타깃 폐기). `src/core` 코드 미링크, 페이로드 계약(`types.ts`/`watchMessage.ts`)·시각 규약(P-39)만 공유. 시스템 프레임워크만(CocoaPods 미링크) | watchOS 10.0 배포 타깃 / Swift 5.9+ | RN 은 watchOS UI 미지원, `src/core` 순수 TS 는 watchOS 확장에서 실행 불가 → 워치는 Swift 축소 재구현. 이식성은 "코드 공유"가 아닌 "계약 공유"로 달성(NFR-10). 단일 타깃 = Xcode 14+ 표준, 빌드 산출물 1개, `WKExtension` 프로세스 경계 없음 | 레거시 WatchKit App + WatchKit Extension 2-타깃 — 디프리케이트, 템플릿 제거 / RN 런타임을 워치에 임베드(Hermes on watchOS) — 비표준·중량, 폐기 / `react-native-watch` 류 실험 프로젝트 — 미성숙 |
| 폰↔워치 채널 (F-19, v1.9) | `react-native-watch-connectivity` | 1.x major 고정 | iOS `WCSession` 을 RN 브리지로 노출(activation / reachability / applicationContext / transferUserInfo / sendMessage). `WatchSyncGateway` 포트 구현 | 커스텀 네이티브 모듈 직접 작성(유지비↑, 동일 기능) — 필요 시 대체 가능 / Wear OS Data Layer — Android 워치는 이번 범위 밖(P-44, OI-11) |
| 테스트 | Jest 29 + ts-jest, `@testing-library/react-native` 12.x | Jest 29.x | RN 기본 러너. **코어 도메인/서비스는 순수 단위 테스트로 즉시 검증** | Vitest — RN 프리셋 미성숙 |
| 린트/포맷 | ESLint + `@react-native/eslint-config`, Prettier 3 | — | RN 표준 | Biome — RN 커뮤니티 채택 낮음 |

**주요 기술 결정**

1. **코어 도메인/서비스 계층을 React Native에 비의존적인 순수 TypeScript로 작성**하고, SQLite·알림·캘린더·OAuth·시계(Clock)를 **포트 인터페이스**로 추상화한다. 이유: (a) 모바일·워치가 동일 로직 공유(NFR-10), (b) 네이티브 없이 Jest로 즉시 검증 가능(현 파이프라인 Tester 단계), (c) 어댑터 교체 용이(op-sqlite → 다른 드라이버).
2. **시각은 UTC epoch(ms) + IANA 타임존 문자열로 저장**, 표시는 로컬 변환(P-16). 날짜 경계 계산은 `Clock` 포트를 통해 결정적으로 테스트.
3. **알림 예약은 "논리 예약(REMINDER 행)"과 "OS 예약"을 분리**. OS는 향후 일정 범위만 실제 예약, 나머지는 앱 기동/부팅/일정 변경 시 `ReminderScheduler.sync()`로 재조정(P-03, P-09).
4. **검색은 SQLite FTS5(external content) + `unicode61` + 서브스트링 대응을 위한 `LIKE` 폴백**. 2자 미만 검색은 결과 상한(P-11). (구버전 설계의 trigram 2자 이슈를 회피: FTS는 토큰 검색, 짧은 질의는 LIKE 폴백으로 처리.)
5. **DB 암호화는 빌드 플래그로 토글(SQLCipher)**. 기본 릴리스는 암호화 ON 제안, 키는 최초 실행 시 생성해 Keychain 저장(D-03 최종 확정 전까지 설계상 지원, 정책 결정 대기).
7. **브랜드 로딩 인디케이터(F-17)는 `react-native-svg` 15.x + RN 내장 `Animated`로 구현**(v1.7). 폐기안: lottie(에셋 파이프라인 부재), reanimated(과함), 순수 View 조합(오리 형태 재현 난이도), PNG 시퀀스(NFR-11 벡터 요건 위배), WebView/SVG 문자열 파서(§16.7 금지). 컴포넌트는 `src/app/components/**`에 배치하는 **순수 프레젠테이션 계층** — `src/core/**`·서비스·`bindings.ts` 무의존, 모든 데이터는 props 로 주입받는다. 표시 여부·모드(animation/static/spinner) 판정은 React 비의존 순수 FSM(`loadingIndicatorMachine.ts`)으로 분리해 `node:test` 로 검증한다. 3단계 폴백(애니메이션 → 정적 오리 → OS 스피너, `logo.png` 재사용)으로 어떤 경우에도 크래시 없이 로딩을 표시한다(E-17-2, AC-34). 상세 §16.9 (logic).
8. **애플워치 타깃(F-19)은 "네이티브 SwiftUI 앱 + 공유 계약" 전략으로 구현**(v1.9 설계 / **v1.14 구현 착수**). RN 은 watchOS UI 를 렌더하지 않고 `src/core` 순수 TS 도 watchOS 에서 못 돌므로, 워치 앱은 SwiftUI 로 축소 읽기 모델을 재구현하되 **페이로드 스키마·`epoch ms + IANA tz`(P-39)·상태 규칙(§7.6)** 만 폰과 공유한다. **v1.14**: `TodayWhatWatch` **단일 타깃**(SwiftUI `App` 라이프사이클, watchOS 10.0, 번들 ID `…todaywhat.watchkitapp` + `WKCompanionAppBundleIdentifier`), Podfile 밖(RN Pod 미링크·시스템 프레임워크만), iOS 앱에 Embed Watch Content, 공유 스킴 `TodayWhatWatch`. Swift `Codable` 은 `src/core/watchSync/types.ts` 를 필드명 1:1 미러(정수 epoch ms·`decodeIfPresent` null 키), 로컬 스냅샷/보류 큐 JSON 은 `FileProtectionType.complete`. `xcodebuild -scheme TodayWhatWatch` + 페어드 시뮬레이터 라운드트립·스크린샷이 이번 릴리스 검증. 상세 `logic.md` §17.11. 폰 측 재사용 범위: `src/core/watchSync/`(순수 스냅샷 빌더 + LWW 조정) + `WatchSyncService` + `WatchSyncGateway` 포트. **전송 메커니즘**: 폰→워치 스냅샷 = `updateApplicationContext`(최신 1건만 유지·자동 병합 — P-37 "실시간 스트리밍 불요"에 부합) + 도달 시 `sendMessage`(포그라운드·수동 새로고침 즉시 반영); 워치→폰 완료 토글 = `sendMessage`(도달 시 즉시·ack) → 실패/미도달 시 `transferUserInfo`(OS 보장 FIFO 큐, 앱 재시작에도 유지) + 워치 보류 큐 유지(E-19-1). **LWW(E-19-3/P-38)** 는 기존 `SCHEDULE.UPDATED_AT` + 스냅샷 `baseUpdatedAt` 비교로 처리 — **공유 스키마 무변경**, 잔여 부정확(완료 무관 폰 편집이 워치 토글보다 뒤일 때 워치 토글 드롭)은 residual risk 로 기록(§17.6). op 중복 적용 방지 원장은 `APP_SETTING` k/v(`watch.appliedOps` 링버퍼) 재사용. 상세 §17 (logic).
9. **통계 화면(F-23) 차트는 신규 npm 의존성 없이 기보유 `react-native-svg` 15.x 로 구현**(v1.12 도입 / **v1.13: 막대 → 선(line) 그래프로 교체**). 선택 연도 1개 × x축 1~12월 고정 × 유형별 건수의 **정적** 선 그래프이며, 인터랙션(범례 토글·월/유형 탭 이동·스크롤/줌·툴팁)·애니메이션은 이번 범위 밖(OI-23). 유형(계열) N개 → `<Svg>` 안에 `Polyline` N개(계열당 12점, 좌표 = 집계 건수와 `seriesPointMax` 로부터 코드 계산) + 건수 > 0 점마다 `Circle` 마커 + 축/베이스라인/그리드 `<Line>`; 월 라벨은 RN `<Text>` 행. **렌더 수단**: F-17 브랜드 인디케이터가 이미 도입·pod 설치한 `react-native-svg` 15.x 재사용 — **신규 npm 의존성·네이티브 표면 0**. 폐기안: 순수 RN `<View>` 회전 세그먼트(다중 계열 대각 선분의 서브픽셀 이음새·가독성 확보 난이), `victory-native`(skia/svg 의존·번들 큼), `react-native-chart-kit`/`react-native-gifted-charts`(정적 12점에 과함·신규 네이티브 표면). 근거: 단일 사용자 로컬·데이터 소량·정적 표시·"네이티브 모듈 최소화" 방침(#7 lottie/reanimated 배제, §16.9.1 / SwipeableRow gesture-handler 배제와 동일). **집계 계약 불변** — `src/app/screens/statisticsViewModel.ts` 순수 함수(`aggregateTotals`/`aggregateYear`/`monthBoundaries` …, 코어 `time.ts` `localWallToEpoch` 재사용)의 시그니처·`YearAggregate` 반환 형태를 바꾸지 않는다. y축 스케일 `seriesPointMax` 는 `YearAggregate` 로부터 화면이 순수 파생(뷰모델 필드 미추가). `src/core/**` 무변경. 상세 §7.2 / §16.3.8 (logic).
6. **일정 편집 날짜/시간 입력은 `@react-native-community/datetimepicker` 8.6.0으로 구현**(v1.6, N-10 해소). v1.4에서 디스크 여유 부족(~1.8 GiB)으로 이연했던 네이티브 DateTimePicker 도입을 v1.6에서 완료한다. 빌드 호스트 765 Gi 여유 확보로 이연 사유가 해소됨. iOS는 inline/spinner/compact 표시, Android는 OS 다이얼로그. 피커 `onChange` 콜백의 `Date.getTime()` → epoch ms 직접 추출로 텍스트 파싱 표면이 제거된다. 기존 `localWallToEpoch` 함수(`src/core/domain/time.ts`)는 역방향 표시 초기값 및 V-26 테스트용으로 존속하되 저장 경로에서는 사용하지 않는다. 코어/로직(포트 계약)/DB 무변경.

---

## 비기능 요약

`nfr.md` 참조. 핵심 결정:

- 성능: 일정 1만 건 기준 목록/대시보드 쿼리는 인덱스 + 기간 범위 + 페이지네이션(50건)으로 처리. 대시보드 집계는 단일 GROUP BY 쿼리.
- 용량: 개인 사용자 1명, 연 2,000건 증가 가정, 5년 1만 건 규모에서 SQLite 단일 파일로 충분.
- 가용성: 서버 없음 → 앱 로컬 가용성만. 저장소 손상 시 안전 모드 + 마지막 정상 스키마로 복구 시도(E-15-1).
- 관측성: 로컬 구조적 로그(레벨/카테고리/민감정보 마스킹), 알림 예약·발송·복원 이벤트 카운터, 마이그레이션 결과 로그. 원격 수집은 이번 범위 없음(미결정: 크래시 리포팅 도입 여부).
- 기획에 정량 SLO가 없어 응답시간 목표치는 "제안값"으로 표기하고 확정은 미결정으로 둔다.
- 로딩 애니메이션(F-17, NFR-11): 60fps 목표, 인디케이터 표시 중 허용 하한 50fps. `Animated` + `useNativeDriver`로 opacity/transform만 UI 스레드에서 구동(래스터 디코드·JSON 파싱·비디오 없음). rAF 프레임 저하 감지 시 정적 폴백으로 세션 강등, 로딩 종료·언마운트 시 `Animated.loop().stop()` + 타이머/rAF 해제(P-31). 상세 `nfr.md` §13.
- 워치 동기화(F-19, NFR-10 착수 / NFR-12): 베스트-에포트. 폰↔워치 채널 실패가 폰 기능을 저해하지 않음(격리). 폰→워치는 `updateApplicationContext` 로 최신 스냅샷만 유지(폴링 없음, 라디오 사용 최소화). 페이로드 크기 상한 — 오늘 목록 최대 200건 + 다음 예정 1건으로 절단(초과 시 `watch.snapshot.truncated` 메트릭). 워치는 오프라인에서 마지막 스냅샷 조회 + 보류 큐 완료 토글 가능(E-19-1). 상세 `nfr.md` §14. **v1.14**: watchOS 앱 타깃(`TodayWhatWatch`) 빌드 + 페어드 iPhone+Watch 시뮬레이터 설치/실행/실제 WCSession 라운드트립/스크린샷이 **이번 릴리스 검증**(`nfr.md` §11.1), 실기기 WCSession 엣지·BOOT·배터리만 후속(N-11).
- 통계 화면(F-23, v1.12 / v1.13 막대→선): 하단 그래프 = 선택 연도 1개의 `start_at` 범위 스캔(`idx_schedule_start`, 캘린더 월 조회와 동형) + 인메모리 12버킷·유형별 집계(≤ 수천 행, O(n)). 상단 카드 = 전체 기간(`findInRange(0, MAX)`) cursor 루프로 ≤ 1만 행 스캔·count(단일 사용자·§2 용량 범위 내). 차트는 정적 `react-native-svg` `Polyline`(계열당 1개, 12점) + 비영 점 `Circle` 마커(SVG 래스터 애니메이션 없음) → 프레임 예산 무영향. 접근성: 범례 텍스트 라벨 + **그래프 영역 데이터 요약 `<Text>`(월/유형/건수)가 주 스크린리더 경로**(색 비의존, NFR-08). 신규 정량 SLO·인덱스·의존성 없음. 상세 `nfr.md` §16.

---

## 미결정 사항

| ID | 내용 | 처리 |
| --- | --- | --- |
| D-01 | 계정 연동 = 자체 동기화 서버 도입 여부 | (c) 가정으로 설계. (a) 확정 시 `logic.md` API 설계에 동기화 API + `nfr.md`에 서버 SLO 추가 필요 |
| D-02 | 앱 → 기본 캘린더 쓰기(양방향) | 읽기는 설계 포함, 쓰기는 `CalendarSyncService.pushEnabled` 플래그로 옵션 설계. 확정 시 충돌 해결 UX 상세화 |
| D-03 | 로컬 DB 암호화 범위 | "전체 암호화(SQLCipher) 기본 ON" 제안. 최종 정책 확정 필요(성능·백업 영향) |
| D-04 | 우선순위 단계 수 | 3단계(HIGH/NORMAL/LOW)로 설계 |
| D-05 | 반복 일정 범위 | 단순 반복(NONE/DAILY/WEEKLY/MONTHLY/YEARLY + 종료일 또는 횟수) |
| D-06 | 오리 로딩 인디케이터 세부 정책 5건 (인라인 순환 방식 / 임계 수치 / 저사양·절전 판정 / 스플래시 관계 / 구현 수단) | v1.7에서 **설계값 확정**(위 "D-06 설계 확정값" 표). 서비스 정책이 아니라 기술/UX 튜닝 결정이며 기획이 Architect 위임 → 가정값 = 설계값. 게이트는 형식상 OPEN 유지(이해관계자 추인 대기), 설계·구현은 비차단 |
| D-07 | 전역 알림 사용 off 전환 시 기존 예약분 처리 | **(a) 즉시 전체 취소** 채택(plan v1.3 기본안, 사용자 방향 (B) 확정). 설계: `ReminderScheduler.applyGlobalNotificationsToggle(false)` 가 활성(PENDING/SCHEDULED) reminder 를 OS 취소 + `state='CANCELLED'`. on 복귀 시 기존 전체 일정 자동 일괄 재예약은 **하지 않음**(이후 저장·수정 건부터 `replaceForSchedule`→`syncOnce` 로 재생성). 게이트 상태 OPEN 유지(이해관계자 추인 대기), 비차단 |
| D-08 | 유형(카테고리) 속성 편집 범위 | **"이름만"** 채택(plan v1.3 기본안). 색상·아이콘은 시스템 자동 배정(`CATEGORY.COLOR` 기본값·`ICON` NULL 허용 유지), 사용자 편집 UI 없음(후속 OI-8). `CategoryManagerScreen` 은 목록 + 추가 + 이름변경 + 삭제만. DB 스키마 무변경. 게이트 상태 OPEN 유지, 비차단 |
| N-1 | 성능 정량 SLO, 알림 허용 오차 수치 | 기획에 없음 → 제안값만, 확정 대기 |
| N-2 | 원격 크래시/텔레메트리 도입 | 프라이버시 정책 필요, 이번 범위 보류 |
| N-3 | 삭제 Undo 보관 시간(OI-4) | `logic.md`에 "세션 내 + 5분" 제안, 확정 대기 |
| N-8 | RN 앱 셸의 온디바이스(Android/iOS 빌드·실행) 검증 | 현 파이프라인 환경에 RN 툴체인·SDK 없음 → 플랫폼 비의존 셸 로직·어댑터 계약만 검증, 네이티브 빌드·워치 연동은 별도 모바일 CI/개발기에서 후속. 산출물에 미검증 범위 명시 |
| N-9 | RN New Architecture(Fabric/TurboModules) 활성 여부 | RN 0.74 기준. 셸 구조는 New Arch 호환 라이브러리로 선정했으나 활성 플래그는 온디바이스 검증 시 확정 |
| N-10 | (1) **해소(v1.6)** — `@react-native-community/datetimepicker` 8.6.0 도입 완료. (2) **반복 일정 개별 회차 편집**("이 일정만/이후 모두", P-02) — 코어 `ScheduleService.update` 확장 필요, 이번 사이클 범위 밖 | (1) 해소. (2) 후속 사이클 |
| D-09 | 워치 갱신 트리거 조합 (F-19) | **(b)** 채택(plan v1.4 가정) — `updateApplicationContext`(폰 백그라운드 전송) + `sendMessage`(포그라운드·수동). 주기 폴링 미도입(OI-13). 게이트 형식상 OPEN(비차단) |
| D-10 | 워치 페이스 컴플리케이션 이번 범위 포함 여부 (F-19) | **"1종 포함"** 가정으로 설계 — `logic.md` §17.8 **조건부 설계 섹션**("오늘 남은 일정 수" 1종, WidgetKit/ClockKit). 미결 시 워치 타깃에서 확장 제외(코드 없음), AC-56 검증 제외. 산출물 범위 영향 → 착수 초기 이해관계자 확인 권장. 게이트 형식상 OPEN(비차단) |
| D-11 | 워치 완료 토글 역전파 지연/실패 시 노출 수준 (F-19) | **(b) 워치에 "동기화 대기" 표시** 채택(plan v1.4 가정) — 보류 큐 비어있지 않은 동안 워치 목록에 배지(§17.5). 폰 배지·안내 미도입. 게이트 형식상 OPEN(비차단) |
| N-11 | watchOS 앱 타깃 검증 (F-19) | **v1.14 에서 축소.** 환경에 watchOS 26.2 시뮬레이터(Apple Watch Series 11 / SE 3 / Ultra 3) + Xcode 확보 → **이번 릴리스 검증**: `xcodebuild -scheme TodayWhatWatch` 빌드(BUILD SUCCEEDED), 페어드 iPhone+Watch 시뮬레이터 설치·실행, 실제 WCSession(`applicationContext`/`sendMessage`) 라운드트립으로 워치 오늘 목록 렌더 + `xcrun simctl io … screenshot` 캡처, 완료 토글 낙관적 갱신·"동기화 대기" 배지(`nfr.md` §11.1, `logic.md` §17.11.5). **잔여 후속(실기기 한정)**: 물리 Apple Watch, `BOOT` 후 파일 영속, 배터리/지연, 백그라운드 `transferUserInfo` 실기기 타이밍, (D-10 시) 컴플리케이션 실기기 타임라인 (`nfr.md` §11.2). `src/core/watchSync/**` 순수 로직 + `WatchSyncService` + `WatchConnectivityGateway` 계약은 계속 `npm test`/`typecheck` |
| N-12 | 워치 LWW 정밀도 (F-19) | `SCHEDULE.UPDATED_AT` 기반 근사 LWW 채택(스키마 무변경). 완료와 무관한 폰 편집이 워치 토글보다 나중일 때 워치 토글이 드롭될 수 있음(residual risk, `logic.md` §17.6). 필드 수준 정밀 LWW(전용 `DONE_CHANGED_AT` 컬럼)는 후속 — 스키마 변경 수반이라 이번 릴리스 보류 |
| D-12 | 대시보드 기준 날짜 상태 지속 범위 (F-20) | **(a) 탭 이탈·앱 재시작 시 오늘로 리셋** 채택(plan v1.5 가정). `referenceDate`/`inlineQuery` = `DashboardScreen` 로컬 state, 영구 저장 없음(P-45). ScheduleDetail/Editor Stack push·복귀는 리셋 아님. `logic.md` §16.3.7. 게이트 형식상 OPEN(추인 대기), 비차단 |
| D-13 | 날짜 탐색 이동 범위 제한 (F-20) | **무제한** 채택(plan v1.5 가정). 원거리 날짜 = `findInRange` 인덱스 범위 쿼리(`nfr.md` §15). 제한 도입 시 경계 화살표 비활성(E-20-1). 비차단 |
| D-14 | 개수 카드 구성 (F-21) | **CLOSED (plan v1.6)** — 조정자 재확정으로 (d) **"진행률 한 줄"**(텍스트 + progress bar 1개)로 확정. 카드 2장 안(a) 폐기. `CountCards.tsx` → `ProgressLine.tsx`(`logic.md` §7.1.2 / §16.3.7). 완료율·유형별 분포·다음 예정은 요약 상세 존치(P-47/AC-46). 미결정 아님 |
| D-15 | 접이식 검색 대상 필드 (F-22) | **제목 + 메모**(유형명 미포함) 채택(plan v1.6 가정). 정규화 = 트림 + 소문자. 유형명은 F-11(P-12)·유형 필터 담당. `logic.md` §7.1. 비차단 |
| D-16 | 접이식 검색이 진행률 한 줄·요약에 반영되는지 (F-22) | **반영 안 함(진행률 한 줄 = 기준 날짜 전체)** 채택(plan v1.6 가정). 필터는 목록 렌더에만 적용(P-49). `logic.md` §7.1. 비차단 |
| D-17 | 날짜 이동 시 접이식 검색어 처리 (F-22) | **유지 후 재적용** 채택(plan v1.6 가정). 좌/우 화살표 = 검색어·펼침 상태 보존·재적용(E-22-2/AC-65); "오늘로"·탭 이탈·앱 재시작 = 초기화 + 접힘(P-50/P-53). `logic.md` §16.3.7. 비차단 |
| D-18 | 접이식 검색창 접을 때 검색어·필터 처리 (F-22, plan v1.6 신규) | **(a) 접으면 검색어 초기화 + 필터 해제** 채택(가정값). `toggleSearch()` 가 `searchExpanded=false` 시 `setInlineQuery('')`(`logic.md` §7.1.3 / §16.3.7, E-22-6). (b) "유지" 확정 시 접힘 시 보존·재펼침 복원으로 화면 로직만 조정(서비스·스키마 무영향). 게이트 형식상 OPEN(추인 대기), 비차단 — 상태 관리 영향 → 착수 초기 확인 권장 |
| D-19 | 미래 기준 날짜의 진행률 한 줄 표시 (F-21, plan v1.6 신규) | **(a) 총 일정 수만 표시(완료율·progress bar 숨김)** 채택(가정값). `isFutureDate(referenceDate, todayStart)` 순수 표시 조건 → `<ProgressLine isFuture>` "일정 N건"(`logic.md` §7.1.2, P-52, E-21-4, AC-68). `getSummary` 집계 경로 무변경. (b) "일관성" 확정 시 `isFuture` 분기만 제거. 게이트 형식상 OPEN(추인 대기), 비차단 — 지표 의미 영향 → 착수 초기 확인 권장 |
| N-13 | 요약 상세 "다음 예정 일정"의 기준일 스코프 (F-20) | 이번 사이클 코어 `getSummary` 무변경 → `nextScheduleId` 는 `clock.now()` 기준 실제 다음 예정 반환(기준일 과거/미래 무관). 기준일 스코프 필요 시 코어 `getSummary` 확장(스키마 무변경) 후속. 비차단, AC 회귀 없음. `logic.md` §15, `nfr.md` §12 |
| D-20 | 세 번째 탭 교체 후 전역 검색(F-11) 진입점 위치 (F-23, v1.7) | **(a) 캘린더 화면(F-02) 헤더 검색 아이콘** 채택(plan v1.7 가정). `SearchScreen` = Tab → Stack 이전, F-11 로직·필터·AC-13/14 무변경(P-54). (d)"완전 제거" 확정 시 Stack 등록·캘린더 아이콘 제거 + AC-13/14/76 이번 릴리스 검증 제외. **네비게이션 구조·AC 검증 대상에 직접 영향 → 착수 초기 이해관계자 확인 권장.** 게이트 형식상 OPEN, 비차단. `logic.md` §8/§16.2 |
| D-21 | 통계 상단 요약 카드 집계 범위 (F-23, v1.7) | **(a) 전체 기간 누적·하단 그래프 연도와 비연동(삭제분 제외)** 채택(plan v1.7 가정, P-55). 카드 = `findInRange(0, MAX)` 전건/완료 count. (b)"선택 연도로 카드도 필터" 확정 시 카드도 연도 범위 `findInRange` 로 전환(뷰모델 인자만 변경, 스키마 무영향). 지표 의미에 영향 → 착수 초기 확인 권장. 게이트 형식상 OPEN, 비차단. `logic.md` §7.2 |
| D-22 | 통계 건수의 반복 일정 카운트 단위 (F-23, v1.7) | **(a) 개별 인스턴스(반복 회차 포함), 대시보드/캘린더와 동일** 채택(plan v1.7 가정, P-58). 통계는 F-10·F-02 와 동일한 `ScheduleService.findInRange` 저장 행을 세므로 카운트 단위가 자동 일치. 현 구현은 반복 마스터 1행=1건(범위 조회가 회차 미확장); 향후 범위 조회에 회차 확장이 붙으면 통계도 동일 경로로 자동 승계. 게이트 형식상 OPEN, 비차단. `logic.md` §7.2 |
| D-23 | 하단 그래프 월 버킷 판정 기준일 (F-23, v1.7) | **(a) 일정 시작 일시(`start_at`), 로컬 자정 경계** 채택(plan v1.7 가정, P-56). 뷰모델이 선택 연도 13개 월 경계 epoch 를 순수 `localWallToEpoch(year, m, 1, 0, 0, clock.timeZone())` 로 계산 후 각 행 `start_at` 을 버킷팅. 생성일·완료 시각 아님. (b)/(c) 확정 시 버킷 키만 `createdAt`/`doneAt` 로 교체(뷰모델 국소 변경). 수치 의미에 영향 → 착수 초기 확인 권장. 게이트 형식상 OPEN, 비차단. `logic.md` §7.2 |
| OI-22 | 통계 상단 카드에 완료율(%)·미완료 수 등 추가 지표 병기 여부 (F-23) | **설계 결정: 이번 범위는 "총 할 일 건수"/"완료된 건수" 카드 2장만**(plan F-23 상단 요약 카드 "확정" 범위). 완료율 병기는 후속(OI-22). 비차단 |
| OI-26 | 통계 화면 로딩 시 F-17 브랜드 로딩 인디케이터 노출 위치 (F-23) | **설계 결정: `StatisticsScreen` 콘텐츠 영역에 인라인·소형 1개**(`logic.md` §16.9.8 #6 추가). F-17 「노출 위치」 표의 "Search 결과 로딩"(#4)은 `SearchScreen` 이 Stack 화면으로 잔존하므로 유지, 통계는 #6 로 추가. F-17 규칙 자체는 무변경. 비차단 |
| D-03 | SQLCipher 기본 활성 → op-sqlite 어댑터의 `PRAGMA key` 경로 | 셸은 빌드 플래그로 토글 가능하게 설계, 최종 정책은 D-03 확정 대기 |
