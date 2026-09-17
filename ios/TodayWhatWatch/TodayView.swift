//
//  TodayView.swift
//  TodayWhatWatch
//
//  루트 화면(§17.11.3, v1.17 개정 §17.12) — 타이틀("오늘일정") /
//  오늘 목록(리스트 Section 헤더 요약 "오늘일정 - {완료}/{전체}", P-73/AC-96) /
//  빈 상태(E-19-5) / "최신 아님"(E-19-1) / "동기화 대기"(D-11) / pull-to-refresh(P-43(d)).
//  v1.17: "완료/미완료" 헤더 Section 과 "다음 예정" Section 은 제거(P-68, AC-91/92).
//  v1.20: 상단 네비게이션 타이틀 우측 헤더 요약(.toolbar)은 삭제(P-68 축소, AC-91 폐기).
//

import SwiftUI

struct TodayView: View {
    @EnvironmentObject private var connectivity: WatchConnectivityService

    /// "오늘일정 - {완료}/{전체}" — WatchSnapshot.summary 만으로 산출(§17.12, P-73, AC-96).
    /// 리스트 Section 헤더의 유일한 소비처(상단 헤더 요약은 v1.20에서 삭제됨).
    /// 오늘 0건(E-19-5)이면 리스트 Section 자체가 렌더되지 않으므로 이 값도 표시되지 않는다.
    /// 연결 불가로 마지막 스냅샷을 표시 중(E-19-1)이어도 그 스냅샷의 summary 를 그대로 사용한다.
    private var headerSummaryText: String {
        let done = connectivity.snapshot?.summary.done ?? 0
        let total = done + (connectivity.snapshot?.summary.notDone ?? 0)
        return "오늘일정 - \(done)/\(total)"
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
            .navigationTitle("오늘뭐해")

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
                Section(headerSummaryText) {
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
