//
//  AppDelegate.swift
//  TodayWhatWatch
//
//  WKApplicationDelegate — 단일 타깃 watchOS 앱(§17.11.1, WKApplicationDelegateAdaptor).
//

import WatchKit

final class AppDelegate: NSObject, WKApplicationDelegate {
    var connectivity: WatchConnectivityService?

    func applicationDidFinishLaunching() {
        connectivity?.activate()
    }

    /// 포그라운드 진입(D-09 (b)) — 최신 스냅샷 요청.
    func applicationDidBecomeActive() {
        connectivity?.requestSnapshot()
    }
}
