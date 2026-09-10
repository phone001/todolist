//
//  TodayWhatWatchApp.swift
//  TodayWhatWatch
//
//  @main 엔트리 — SwiftUI App 라이프사이클 + WKApplicationDelegateAdaptor(§17.11.1).
//

import SwiftUI

@main
struct TodayWhatWatchApp: App {
    @WKApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var connectivity = WatchConnectivityService()

    var body: some Scene {
        WindowGroup {
            TodayView()
                .environmentObject(connectivity)
                .onAppear {
                    appDelegate.connectivity = connectivity
                    connectivity.activate()
                }
        }
    }
}
