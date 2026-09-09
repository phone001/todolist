/**
 * 애플워치 워치 동기화(F-19) 공유 페이로드 계약 — 폰 측 단일 출처.
 * 설계 근거: document/architect/logic.md §17.3 / §17.4 / §17.6, §13.9,
 *            document/architect/nfr.md §14, document/architect/overview.md v1.9.
 *
 * 이 모듈은 순수 타입/상수만 정의한다. `react-native` 등 플랫폼 모듈을 import 하지 않는다.
 * watchOS(Swift) 앱은 코드가 아니라 이 스키마를 재현한다(NFR-10 "계약 공유").
 */

/** 워치 목록 1행. 필드 최소화(P-40): 메모·이력·알림·유형 전체정의·토큰 미포함. */
export interface WatchScheduleItem {
  id: number;
  /** 원제목. 워치 앱 화면 표시 — 알림 마스킹(P-10-1)과 무관(§13.9). */
  title: string;
  /** epoch ms (UTC) — P-39. 워치는 표시 시점에만 로컬 변환. */
  startAt: number;
  /** IANA tz (예: 'Asia/Seoul') — P-39. */
  timeZone: string;
  /** 표시 라벨. 삭제·미존재 유형이면 시스템 "기타" 라벨(E-19-4). */
  categoryLabel: string;
  /** '#RRGGBB'. 삭제·미존재 유형이면 시스템 색. */
  categoryColor: string;
  /** 중요도 "높음"만 표식(F-19 표시 요소). */
  isHighPriority: boolean;
  isDone: boolean;
  doneAt: number | null;
  /** SCHEDULE.UPDATED_AT — 워치가 op.baseUpdatedAt 로 되돌려 보냄(§17.6). */
  updatedAt: number;
}

/** 폰 → 워치 "오늘 스냅샷". `updateApplicationContext` 로 최신 1건만 유지(§17.2). */
export interface WatchSnapshot {
  /** epoch ms — 워치 "최신 아님" 판정·표시. */
  builtAt: number;
  /** 로컬 자정 경계(P-17). */
  dayStart: number;
  dayEnd: number;
  /** 시작 시각 오름차순, 최대 WATCH_SNAPSHOT_MAX_ITEMS 건. */
  today: WatchScheduleItem[];
  /** today 가 상한 초과로 절단됐는지. */
  truncated: boolean;
  /** 다음 예정 1건(당일 밖 가능) 또는 null(P-40). */
  nextUpcoming: { id: number; title: string; startAt: number; timeZone: string } | null;
  /** 목록 헤더 카운트. 컴플리케이션(D-10)도 notDone 을 사용. */
  summary: { done: number; notDone: number };
  /** 폰이 처리 완료한 op(transferUserInfo 경로 ack). 빌더는 비우고 전송 계층이 채운다. */
  ackedOpIds: string[];
}

/** 워치 → 폰 완료 토글 op. 스칼라 5개(< 1KB). */
export interface WatchToggleOp {
  /** 워치가 생성한 UUID(멱등키). */
  opId: string;
  scheduleId: number;
  done: boolean;
  /** 워치에서 토글한 시각(epoch ms) — LWW 비교값. */
  watchChangedAt: number;
  /** 워치가 받은 스냅샷 항목의 updatedAt — LWW 기준선(§17.6). */
  baseUpdatedAt: number;
}

/** op 처리 결과 ack 코드(§17.4 / §13.9). */
export type WatchToggleAck =
  | 'APPLIED'
  | 'RESOLVED'
  | 'DUPLICATE'
  | 'NOT_FOUND'
  | 'REJECTED';

/** LWW 판정 결과(§17.6). */
export type WatchLwwDecision = 'APPLY' | 'SKIP_PHONE_WINS' | 'REJECT_NOT_FOUND';

/** op 중복 적용 방지 원장 항목. APP_SETTING k/v 에 링버퍼로 저장(§17.4, database.md §10). */
export interface WatchAppliedOp {
  opId: string;
  ts: number;
}

/** today 페이로드 상한(P-40 / E-19-6). 초과 시 절단 + truncated=true. */
export const WATCH_SNAPSHOT_MAX_ITEMS = 200;

/** op 중복 제거 원장 링버퍼 크기(§17.4). */
export const WATCH_APPLIED_OPS_MAX = 50;

/** op 중복 제거 원장 APP_SETTING 키(§17.4, database.md §10). */
export const WATCH_APPLIED_OPS_KEY = 'watch.appliedOps';
