//
//  WatchConnectivityService.swift
//  TodayWhatWatch
//
//  WCSessionDelegate + ObservableObject — 워치 측 WCSession 송수신 단일 창구(§17.11.3).
//  수신: didReceiveApplicationContext / didReceiveMessage(+replyHandler) / didReceiveUserInfo
//        → 봉투 type 분기(snapshot / ack, 그 외 무시 — §17.11.4).
//  송신: requestSnapshot(pull-to-refresh·포그라운드 진입), toggle op(isReachable ? sendMessage :
//        transferUserInfo).
//  순수 시스템 프레임워크만 사용(WatchConnectivity/Foundation) — 서드파티 0(§17.11.6).
//

import Foundation
import WatchConnectivity
import Combine

final class WatchConnectivityService: NSObject, ObservableObject, WCSessionDelegate {
    /// 표시용 스냅샷 — 보류(미-ack) 토글 op 을 낙관적으로 덮어쓴 값(overlay).
    @Published private(set) var snapshot: WatchSnapshot?
    /// activation 미완 또는 마지막 스냅샷 수신이 오래됨(§17.11.3 E-19-1 "최신 아님" 배지).
    @Published private(set) var isStale: Bool = true
    /// 보류(미-ack) op 개수 — "동기화 대기" 배지(D-11).
    @Published private(set) var pendingCount: Int = 0
    /// 폰과 아직 한 번도 페어링/스냅샷을 받지 못함(E-19-2).
    @Published private(set) var isConfigured: Bool = false

    let pendingQueue = PendingQueue()
    private let snapshotStore = SnapshotStore()
    private var rawSnapshot: WatchSnapshot?
    private var lastContextReceivedAt: Date?
    private var stalenessTimer: Timer?

    /// 이 시간(초) 이상 새 컨텍스트가 없으면 "최신 아님"으로 간주.
    private static let staleThreshold: TimeInterval = 15 * 60

    override init() {
        super.init()
        pendingCount = pendingQueue.count
        if let cached = snapshotStore.load() {
            rawSnapshot = cached
            snapshot = overlay(cached)
            isConfigured = true
        }
    }

    func activate() {
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
        startStalenessTimer()
        evaluateStaleness()
    }

    private func startStalenessTimer() {
        stalenessTimer?.invalidate()
        stalenessTimer = Timer.scheduledTimer(withTimeInterval: 60, repeats: true) { [weak self] _ in
            self?.evaluateStaleness()
        }
    }

    private func evaluateStaleness() {
        let activated = WCSession.isSupported() && WCSession.default.activationState == .activated
        let old: Bool
        if let last = lastContextReceivedAt {
            old = Date().timeIntervalSince(last) > Self.staleThreshold
        } else {
            old = rawSnapshot == nil
        }
        DispatchQueue.main.async {
            self.isStale = !activated || old
        }
    }

    // MARK: - 송신

    /// 수동 새로고침(P-43(d)) / 포그라운드 진입(D-09 (b)).
    func requestSnapshot() {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        guard session.activationState == .activated else { return }
        let envelope: [String: Any] = ["type": "requestSnapshot"]
        if session.isReachable {
            session.sendMessage(envelope, replyHandler: { [weak self] reply in
                self?.handleInbound(reply)
            }, errorHandler: { _ in
                // 실패해도 다음 applicationContext 로 자연 수신(§17.2). 폰 흐름을 막지 않는다.
            })
        }
    }

    /// 완료 토글 op 생성·낙관적 반영·전송(§17.11.3).
    func sendToggle(for item: WatchScheduleItem) {
        let op = WatchToggleOp(
            opId: UUID().uuidString.lowercased(),
            scheduleId: item.id,
            done: !item.isDone,
            watchChangedAt: nowEpochMs(),
            baseUpdatedAt: item.updatedAt
        )
        pendingQueue.enqueue(op)
        pendingCount = pendingQueue.count
        if let raw = rawSnapshot {
            snapshot = overlay(raw)
        }

        let payload: [String: Any] = [
            "opId": op.opId,
            "scheduleId": op.scheduleId,
            "done": op.done,
            "watchChangedAt": op.watchChangedAt,
            "baseUpdatedAt": op.baseUpdatedAt,
        ]
        let envelope: [String: Any] = ["type": "toggle", "payload": payload]

        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        if session.isReachable {
            session.sendMessage(envelope, replyHandler: nil, errorHandler: { _ in
                session.transferUserInfo(envelope)
            })
        } else {
            session.transferUserInfo(envelope)
        }
    }

    // MARK: - 수신

    private func handleInbound(_ message: [String: Any]) {
        guard let type = message["type"] as? String else { return }
        switch type {
        case "snapshot":
            guard let payloadDict = message["payload"] as? [String: Any],
                  let data = try? JSONSerialization.data(withJSONObject: payloadDict),
                  let snap = try? JSONDecoder().decode(WatchSnapshot.self, from: data) else { return }
            applySnapshot(snap)
        case "ack":
            guard let opId = message["opId"] as? String else { return }
            DispatchQueue.main.async {
                self.pendingQueue.remove(opId: opId)
                self.pendingCount = self.pendingQueue.count
                if let raw = self.rawSnapshot {
                    self.snapshot = self.overlay(raw)
                }
            }
        default:
            // 미지 타입은 조용히 무시(§17.11.4 — classifyInboundMessage 와 동일 정책).
            break
        }
    }

    private func applySnapshot(_ snap: WatchSnapshot) {
        rawSnapshot = snap
        snapshotStore.save(snap)

        for opId in snap.ackedOpIds {
            pendingQueue.remove(opId: opId)
        }
        for op in pendingQueue.all() {
            if let item = snap.today.first(where: { $0.id == op.scheduleId }) {
                if resolveToggleLWW(op: op, scheduleUpdatedAt: item.updatedAt) == .skipPhoneWins {
                    pendingQueue.remove(opId: op.opId)
                }
            } else {
                // 스냅샷에 더 이상 없음(삭제/필터 아웃) → 적용 대상 없음, 보류 해제.
                pendingQueue.remove(opId: op.opId)
            }
        }

        DispatchQueue.main.async {
            self.pendingCount = self.pendingQueue.count
            self.snapshot = self.overlay(snap)
            self.isConfigured = true
            self.lastContextReceivedAt = Date()
            self.isStale = false
        }
    }

    /// 아직 ack 안 된 보류 op 을 스냅샷 위에 낙관적으로 덮어쓴다(LWW APPLY 인 것만 잔류 — §17.11.3).
    private func overlay(_ snap: WatchSnapshot) -> WatchSnapshot {
        let pending = pendingQueue.all()
        guard !pending.isEmpty else { return snap }
        var today = snap.today
        for op in pending {
            if let idx = today.firstIndex(where: { $0.id == op.scheduleId }) {
                today[idx].isDone = op.done
            }
        }
        return WatchSnapshot(
            builtAt: snap.builtAt,
            dayStart: snap.dayStart,
            dayEnd: snap.dayEnd,
            today: today,
            truncated: snap.truncated,
            nextUpcoming: snap.nextUpcoming,
            summary: snap.summary,
            ackedOpIds: snap.ackedOpIds
        )
    }

    // MARK: - WCSessionDelegate

    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        evaluateStaleness()
    }

    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        handleInbound(applicationContext)
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        handleInbound(message)
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any], replyHandler: @escaping ([String: Any]) -> Void) {
        handleInbound(message)
        replyHandler(["ok": true])
    }

    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any]) {
        handleInbound(userInfo)
    }
}
