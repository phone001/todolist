//
//  Models.swift
//  TodayWhatWatch
//
//  F-19 워치 동기화 페이로드 계약의 Swift 미러.
//  설계 근거: document/architect/logic.md §17.11.3/§17.11.4.
//  단일 출처: src/core/watchSync/types.ts (WatchScheduleItem / WatchSnapshot / WatchToggleOp).
//  CodingKeys 는 TS 필드명과 1:1(camelCase). null 가능 키는 decodeIfPresent.
//

import Foundation

/// 워치 목록 1행. src/core/watchSync/types.ts `WatchScheduleItem` 미러.
struct WatchScheduleItem: Codable, Identifiable, Equatable {
    let id: Int
    /// 원제목(§13.9 — 알림 마스킹과 무관).
    let title: String
    /// epoch ms(UTC) — P-39. 초 아님.
    let startAt: Int64
    /// IANA 타임존(예: "Asia/Seoul"). 표시 시점에만 로컬 변환.
    let timeZone: String
    let categoryLabel: String
    let categoryColor: String
    let isHighPriority: Bool
    var isDone: Bool
    var doneAt: Int64?
    /// SCHEDULE.UPDATED_AT — 토글 op 의 baseUpdatedAt 로 되돌려 보낸다(§17.6).
    let updatedAt: Int64
}

/// 다음 예정 1건(당일 밖 가능). `WatchSnapshot.nextUpcoming`.
struct UpcomingRef: Codable, Equatable {
    let id: Int
    let title: String
    let startAt: Int64
    let timeZone: String
}

/// 목록 헤더 카운트. `WatchSnapshot.summary`.
struct Summary: Codable, Equatable {
    let done: Int
    let notDone: Int
}

/// 폰 → 워치 "오늘 스냅샷". src/core/watchSync/types.ts `WatchSnapshot` 미러.
struct WatchSnapshot: Codable, Equatable {
    /// epoch ms — 워치 "최신 아님" 판정·표시.
    let builtAt: Int64
    let dayStart: Int64
    let dayEnd: Int64
    /// 시작 시각 오름차순, 최대 WATCH_SNAPSHOT_MAX_ITEMS 건(폰이 절단).
    let today: [WatchScheduleItem]
    let truncated: Bool
    let nextUpcoming: UpcomingRef?
    let summary: Summary
    /// 폰이 처리 완료한 op(보류 큐 정리 키).
    let ackedOpIds: [String]
}

/// 워치 → 폰 완료 토글 op. src/core/watchSync/types.ts `WatchToggleOp` 미러.
struct WatchToggleOp: Codable, Equatable {
    /// 워치가 생성한 UUID(멱등키) — 반드시 소문자 RFC-4122(WATCH_UUID_RE 통과, §13.9).
    let opId: String
    let scheduleId: Int
    let done: Bool
    /// 워치에서 토글한 시각(epoch ms, 정수) — LWW 비교값.
    let watchChangedAt: Int64
    /// 워치가 받은 스냅샷 항목의 updatedAt — LWW 기준선(§17.6).
    let baseUpdatedAt: Int64
}

/// 폰이 보내는 평탄(flat) ack. `{ type:'ack', opId, result }`(§17.11.4).
struct WatchAck: Codable, Equatable {
    let type: String
    let opId: String
    let result: String
}

/// 송/수신 공용 봉투. `{ "type": <String>, "payload": <Object> }`(§17.11.4).
/// `payload` 는 타입별로 다르므로 디코드 시점에 목적에 맞는 타입으로 재디코드한다.
struct WatchEnvelope: Codable {
    let type: String
    let payload: JSONValue?
}

/// 임의 JSON 트리를 표현하는 최소 Codable 래퍼(payload 재디코드용).
/// 미지 타입의 봉투를 조용히 무시하기 위해 스냅샷/토글 payload 구조를 강제하지 않는다.
enum JSONValue: Codable {
    case object([String: JSONValue])
    case array([JSONValue])
    case string(String)
    case number(Double)
    case bool(Bool)
    case null

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let v = try? container.decode([String: JSONValue].self) {
            self = .object(v)
        } else if let v = try? container.decode([JSONValue].self) {
            self = .array(v)
        } else if let v = try? container.decode(String.self) {
            self = .string(v)
        } else if let v = try? container.decode(Double.self) {
            self = .number(v)
        } else if let v = try? container.decode(Bool.self) {
            self = .bool(v)
        } else {
            self = .null
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .object(let v): try container.encode(v)
        case .array(let v): try container.encode(v)
        case .string(let v): try container.encode(v)
        case .number(let v): try container.encode(v)
        case .bool(let v): try container.encode(v)
        case .null: try container.encodeNil()
        }
    }

    /// `Data` 로 재인코딩 후 원하는 타입으로 재디코드할 때 사용.
    func reencoded<T: Decodable>(as type: T.Type) -> T? {
        guard let data = try? JSONEncoder().encode(self) else { return nil }
        return try? JSONDecoder().decode(T.self, from: data)
    }
}

/// RFC-4122 형식 UUID(대소문자 허용). `src/app/adapters/watch/watchMessage.ts` `WATCH_UUID_RE` 미러.
enum WatchUUID {
    static func isValid(_ s: String) -> Bool {
        let pattern = "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
        return s.range(of: pattern, options: .regularExpression) != nil
    }
}

/// 현재 시각의 정수 epoch ms(§17.11.3 `nowEpochMs()` — `.rounded()` 필수, 정수 계약).
func nowEpochMs() -> Int64 {
    Int64((Date().timeIntervalSince1970 * 1000).rounded())
}
