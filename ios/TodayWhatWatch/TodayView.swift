//
//  TodayView.swift
//  TodayWhatWatch
//
//  루트 화면(§17.11.3) — 요약 헤더 / 다음 예정 1건 / 오늘 목록 / 빈 상태(E-19-5) /
//  "최신 아님"(E-19-1) / "동기화 대기"(D-11) / pull-to-refresh(P-43(d)).
//

import SwiftUI

struct TodayView: View {
    @EnvironmentObject private var connectivity: WatchConnectivityService

    var body: some View {
        Group {
            if connectivity.snapshot == nil && !connectivity.isConfigured {
                NotConfiguredView()
            } else {
                content
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        let snapshot = connectivity.snapshot

        List {
            if connectivity.isStale {
                Section {
                    Label("최신 아님", systemImage: "exclamationmark.arrow.triangle.2.circlepath")
                        .font(.caption2)
                        .foregroundColor(.orange)
                }
            }
            if connectivity.pendingCount > 0 {
                Section {
                    Label("동기화 대기 \(connectivity.pendingCount)", systemImage: "arrow.triangle.2.circlepath")
                        .font(.caption2)
                        .foregroundColor(.blue)
                }
            }

            if let summary = snapshot?.summary {
                Section {
                    HStack {
                        Text("완료 \(summary.done)")
                        Spacer()
                        Text("미완료 \(summary.notDone)")
                    }
                    .font(.caption)
                    .foregroundColor(.secondary)
                }
            }

            if let upcoming = snapshot?.nextUpcoming {
                Section("다음 예정") {
                    Text(upcoming.title)
                        .font(.footnote)
                        .lineLimit(1)
                }
            }

            let today = snapshot?.today ?? []
            if today.isEmpty {
                Section {
                    Text("오늘 일정이 없습니다")
                        .font(.footnote)
                        .foregroundColor(.secondary)
                }
            } else {
                Section("오늘") {
                    ForEach(today) { item in
                        ScheduleRow(item: item) {
                            connectivity.sendToggle(for: item)
                        }
                    }
                }
            }
        }
        .listStyle(.carousel)
        .refreshable {
            connectivity.requestSnapshot()
        }
        .opacity(connectivity.isStale ? 0.7 : 1.0)
    }
}
