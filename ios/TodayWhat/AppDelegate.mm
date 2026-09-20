#import "AppDelegate.h"

#import <React/RCTBundleURLProvider.h>
#import <Firebase.h>

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  // F-27(v1.23, 원격 푸시 알림/FCM): Firebase 초기화는 `GoogleService-Info.plist`(이 타깃의 Copy
  // Bundle Resources에 포함되어야 함, document/architect/logic.md §13.10)를 읽어 수행된다.
  // 표준 설치 절차에 따라 didFinishLaunchingWithOptions 최상단에서 1회 호출한다.
  [FIRApp configure];

  self.moduleName = @"TodayWhat";
  // You can add your custom initial props in the dictionary below.
  // They will be passed down to the ViewController used by React Native.
  self.initialProps = @{};

  return [super application:application didFinishLaunchingWithOptions:launchOptions];
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
  return [self bundleURL];
}

- (NSURL *)bundleURL
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

@end
