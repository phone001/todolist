//
//  TodayView.swift
//  TodayWhatWatch
//
//  루트 화면(§17.11.3, v1.17 개정 §17.12) — 타이틀 우측 헤더 요약("오늘 - {완료}/{전체}") /
//  오늘 목록 / 빈 상태(E-19-5) / "최신 아님"(E-19-1) / "동기화 대기"(D-11) / pull-to-refresh(P-43(d)).
//  v1.17: "완료/미완료" 헤더 Section 과 "다음 예정" Section 은 제거(P-68, AC-91/92).
//

import SwiftUI

struct TodayView: View {
    @EnvironmentObject private var connectivity: WatchConnectivityService

    /// "오늘 - {완료}/{전체}" — WatchSnapshot.summary 만으로 산출(§17.12, P-68, AC-91).
    /// 오늘 0건(E-19-5)이면 done=0, total=0 → "오늘 - 0/0"(E-19-8) 이 분기 없이 자동 산출된다.
    /// 연결 불가로 마지막 스냅샷을 표시 중(E-19-1)이어도 그 스냅샷의 summary 를 그대로 사용한다.
    private var headerSummaryText: String {
        let done = connectivity.snapshot?.summary.done ?? 0
        let total = done + (connectivity.snapshot?.summary.notDone ?? 0)
        return "오늘 - \(done)/\(total)"
    }

    var body: some View {
        NavigationStack {
            Group {
                if connectivity.snapshot == nil && !connectivity.isConfigured {
                    NotConfiguredView()
                } else {
                    content
                }
            }
            .navigationTitle("오늘")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Text(headerSummaryText)
                }
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
