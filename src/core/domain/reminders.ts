/**
 * 알림(REMINDER) 행 생성 규칙 (순수 함수).
 * 설계 근거: document/architect/logic.md 1.3, 6 (ReminderScheduler), database.md 3.3.
 */
import type { ReminderKind } from './types.ts';

export interface ReminderDraft {
  kind: ReminderKind;
  offsetMinutes: number;
  triggerAt: number;
}

/**
 * 사전 알림 오프셋 목록 + 정시 알림 여부로 알림 초안을 만든다.
 * - 오프셋은 중복 제거, 음수/비정수 제외(검증에서 이미 걸러지지만 방어).
 * - triggerAt = startAt - offset(분) * 60000.
 * - notifyAtStart 이면 kind='START', offset=0 초안 추가(PRE offset 0 과 kind 로 구분).
 */
export function buildReminderDrafts(
  startAt: number,
  offsets: number[],
  notifyAtStart: boolean,
): ReminderDraft[] {
  const unique = Array.from(new Set(offsets)).filter((o) => Number.isInteger(o) && o >= 0);
  unique.sort((a, b) => a - b);

  const drafts: ReminderDraft[] = unique.map((offsetMinutes) => ({
    kind: 'PRE',
    offsetMinutes,
    triggerAt: startAt - offsetMinutes * 60_000,
  }));

  if (notifyAtStart) {
    drafts.push({ kind: 'START', offsetMinutes: 0, triggerAt: startAt });
  }
  return drafts;
}

/** 알림 본문 문자열. showTitle=false 이면 제목을 노출하지 않는다(정책 P-10-1). */
export function formatReminderText(
  scheduleTitle: string,
  kind: ReminderKind,
  offsetMinutes: number,
  showTitle: boolean,
): { title: string; body: string } {
  const shownTitle = showTitle ? scheduleTitle : '일정 알림';
  if (kind === 'START') {
    return { title: shownTitle, body: '지금 시작' };
  }
  const when =
    offsetMinutes >= 1440
      ? `${Math.round(offsetMinutes / 1440)}일 전`
      : offsetMinutes >= 60
        ? `${Math.round(offsetMinutes / 60)}시간 전`
        : `${offsetMinutes}분 전`;
  return { title: shownTitle, body: `${when} 알림` };
}
