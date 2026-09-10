//
//  ScheduleRow.swift
//  TodayWhatWatch
//
//  오늘 목록 1행 — 제목·시작시각(로컬 tz 변환, P-39)·유형 색 점+라벨·중요도 표식·완료 토글.
//  탭 시 낙관적 로컬 토글 + PendingQueue.enqueue + connectivity.sendToggle(§17.11.3).
//

import SwiftUI

struct ScheduleRow: View {
    let item: WatchScheduleItem
    let onToggle: () -> Void

    private var startDate: Date {
        Date(timeIntervalSince1970: TimeInterval(item.startAt) / 1000)
    }

    private var timeText: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm"
        formatter.timeZone = TimeZone(identifier: item.timeZone) ?? TimeZone.current
        return formatter.string(from: startDate)
    }

    /// §7.6 — 시작 경과 & 미완료 → 구분 스타일.
    private var isOverdue: Bool {
        !item.isDone && startDate < Date()
    }

    var body: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(Color(hex: item.categoryColor))
                .frame(width: 8, height: 8)

            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 4) {
                    Text(item.title)
                        .font(.body)
                        .strikethrough(item.isDone)
                        .foregroundColor(item.isDone ? .secondary : .primary)
                        .lineLimit(1)
                    if item.isHighPriority {
                        Image(systemName: "exclamationmark.circle.fill")
                            .foregroundColor(.red)
                            .imageScale(.small)
                    }
                }
                Text("\(timeText) · \(item.categoryLabel)")
                    .font(.caption2)
                    .foregroundColor(isOverdue ? .orange : .secondary)
            }

            Spacer()

            Button(action: onToggle) {
                Image(systemName: item.isDone ? "checkmark.circle.fill" : "circle")
                    .foregroundColor(item.isDone ? .green : .secondary)
            }
            .buttonStyle(.plain)
        }
        .opacity(isOverdue ? 0.85 : 1.0)
    }
}

extension Color {
    /// '#RRGGBB' 문자열 → Color. 파싱 실패 시 시스템 기본색(E-19-4 — 삭제·미존재 유형은 폰이 이미 매핑).
    init(hex: String) {
        var s = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        if s.hasPrefix("#") { s.removeFirst() }
        guard s.count == 6, let value = UInt32(s, radix: 16) else {
            self = .gray
            return
        }
        let r = Double((value >> 16) & 0xFF) / 255.0
        let g = Double((value >> 8) & 0xFF) / 255.0
        let b = Double(value & 0xFF) / 255.0
        self = Color(red: r, green: g, blue: b)
    }
}
