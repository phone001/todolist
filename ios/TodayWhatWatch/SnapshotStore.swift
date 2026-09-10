//
//  SnapshotStore.swift
//  TodayWhatWatch
//
//  마지막 WatchSnapshot 을 앱 컨테이너(Application Support) JSON 파일 1개로 저장/로드.
//  §17.11.3 / §17.11.6 — 쓰기 시 .completeFileProtection, 앱 컨테이너 밖(공유·App Group) 미사용.
//

import Foundation

/// 워치 로컬 파일 영속 공통(§17.11.6 — NSFileProtectionComplete, 공유 컨테이너 밖).
enum WatchLocalStorage {
    static func applicationSupportDirectory() -> URL {
        let fm = FileManager.default
        let dir = fm.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        if !fm.fileExists(atPath: dir.path) {
            try? fm.createDirectory(at: dir, withIntermediateDirectories: true)
        }
        return dir
    }

    static func write(_ data: Data, to url: URL) throws {
        try data.write(to: url, options: [.atomic, .completeFileProtection])
    }
}

/// 마지막 스냅샷 영속 — 앱 재실행 시 오프라인 초기 렌더(E-19-1).
final class SnapshotStore {
    private let fileURL: URL

    init(fileName: String = "watch-snapshot.json") {
        self.fileURL = WatchLocalStorage.applicationSupportDirectory().appendingPathComponent(fileName)
    }

    func load() -> WatchSnapshot? {
        guard let data = try? Data(contentsOf: fileURL) else { return nil }
        return try? JSONDecoder().decode(WatchSnapshot.self, from: data)
    }

    func save(_ snapshot: WatchSnapshot) {
        guard let data = try? JSONEncoder().encode(snapshot) else { return }
        try? WatchLocalStorage.write(data, to: fileURL)
    }
}
