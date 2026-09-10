//
//  PendingQueue.swift
//  TodayWhatWatch
//
//  WatchToggleOp FIFO 큐를 JSON 파일 1개로 영속(§17.11.3 / §17.11.6 — .completeFileProtection).
//  앱 재시작에도 유지(E-19-1). enqueue(낙관적 토글 시) / remove(ack 수신 시) / all(재전송·배지 카운트).
//

import Foundation

final class PendingQueue: ObservableObject {
    private let fileURL: URL
    @Published private(set) var ops: [WatchToggleOp] = []

    init(fileName: String = "watch-pending-queue.json") {
        self.fileURL = WatchLocalStorage.applicationSupportDirectory().appendingPathComponent(fileName)
        self.ops = Self.load(from: fileURL)
    }

    private static func load(from url: URL) -> [WatchToggleOp] {
        guard let data = try? Data(contentsOf: url) else { return [] }
        return (try? JSONDecoder().decode([WatchToggleOp].self, from: data)) ?? []
    }

    private func persist() {
        guard let data = try? JSONEncoder().encode(ops) else { return }
        try? WatchLocalStorage.write(data, to: fileURL)
    }

    func enqueue(_ op: WatchToggleOp) {
        ops.append(op)
        persist()
    }

    func remove(opId: String) {
        ops.removeAll { $0.opId == opId }
        persist()
    }

    func all() -> [WatchToggleOp] {
        ops
    }

    var count: Int {
        ops.count
    }
}
