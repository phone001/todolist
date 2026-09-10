//
//  NotConfiguredView.swift
//  TodayWhatWatch
//
//  E-19-2 — 폰과 아직 한 번도 페어링/스냅샷 교환이 없는 상태. 목록·토글 UI 미표시.
//

import SwiftUI

struct NotConfiguredView: View {
    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: "iphone.and.arrow.forward")
                .font(.title2)
                .foregroundColor(.secondary)
            Text("폰 앱에서 설정을 완료해 주세요")
                .font(.footnote)
                .multilineTextAlignment(.center)
                .foregroundColor(.secondary)
        }
        .padding()
    }
}
