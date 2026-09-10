//
//  LWW.swift
//  TodayWhatWatch
//
//  src/core/watchSync/reconcile.ts `resolveToggleLWW` 의 Swift 미러(§17.6 / §17.11.3).
//  용도: 새 스냅샷 수신 시 아직 ack 안 된 보류 op 에 대해 "스냅샷이 이미 반영/추월했는지"
//  낙관적 판정(폰이 최종 권위 — 워치는 표시 일관성용).
//

import Foundation

/// LWW 판정 결과. src/core/watchSync/types.ts `WatchLwwDecision` 미러.
enum WatchLwwDecision: String {
    case apply = "APPLY"
    case skipPhoneWins = "SKIP_PHONE_WINS"
}

/// `schedule.updatedAt <= op.baseUpdatedAt` → 폰이 이 항목을 손대지 않았으므로 워치 변경 유지.
/// 그 외 → `op.watchChangedAt > schedule.updatedAt` 이면 워치 변경이 더 나중 → 유지, 아니면 폰이 이김.
func resolveToggleLWW(op: WatchToggleOp, scheduleUpdatedAt: Int64) -> WatchLwwDecision {
    if scheduleUpdatedAt <= op.baseUpdatedAt {
        return .apply
    }
    return op.watchChangedAt > scheduleUpdatedAt ? .apply : .skipPhoneWins
}
