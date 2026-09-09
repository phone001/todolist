/**
 * 워치 완료 토글 LWW(Last-Write-Wins) 충돌 해소 — 순수 함수.
 * 설계 근거: document/architect/logic.md §17.6, 예외 E-19-3, 정책 P-38, AC-50, N-12.
 *
 * 타임스탬프 기준: 기존 `SCHEDULE.UPDATED_AT`(epoch ms, toggleDone/update 가 매 변경 시 갱신)
 * + op 의 `baseUpdatedAt`(워치가 받은 스냅샷 항목의 updatedAt). 신규 컬럼 없음(N-12).
 * 정밀도 epoch ms. 동시(같은 ms)면 폰 우선 — 결정적.
 */
import type { Schedule } from '../domain/types.ts';
import type { WatchLwwDecision, WatchToggleOp } from './types.ts';

export function resolveToggleLWW(op: WatchToggleOp, schedule: Schedule): WatchLwwDecision {
  if (schedule.deletedAt != null) return 'REJECT_NOT_FOUND';

  // 폰이 스냅샷 이후 이 일정을 건드리지 않았으면 워치 변경을 그대로 적용.
  if (schedule.updatedAt <= op.baseUpdatedAt) return 'APPLY';

  // 폰이 이후 변경함 → 더 나중 타임스탬프가 이김(P-38 Last-Write-Wins).
  return op.watchChangedAt > schedule.updatedAt ? 'APPLY' : 'SKIP_PHONE_WINS';
}
