#!/usr/bin/env ruby
# frozen_string_literal: true

# add_watch_target.rb
#
# F-19 watchOS 앱 타깃 `TodayWhatWatch` 를 `TodayWhat.xcodeproj` 에 추가하는 멱등 스크립트.
# 설계 근거: document/architect/logic.md §17.11.1/§17.11.2.
#
# - 손으로 project.pbxproj 를 편집하지 않는다 — `xcodeproj` gem 으로 구조적으로 생성한다.
# - 재실행해도 누적되지 않도록(멱등), 기존에 생성된 TodayWhatWatch 관련 산출물(네이티브 타깃,
#   Embed Watch Content 빌드 페이즈, 타깃 의존성, 그룹, 공유 스킴)을 먼저 제거한 뒤 동일한 형태로
#   재생성한다.
# - 단일 타깃 watchOS 앱(SwiftUI App 라이프사이클) — 레거시 WatchKit App+Extension 2-타깃 구조 아님.
# - 워치 타깃은 Podfile 밖 — 시스템 프레임워크(WatchConnectivity/SwiftUI/Foundation, WKApplicationDelegate
#   를 위한 WatchKit)만 링크한다. RN/CocoaPods 산출물(Pods-TodayWhat*.xcconfig)을 상속하지 않는다.
#
# 사용법: `ruby ios/scripts/add_watch_target.rb` (반복 실행 가능)

require 'xcodeproj'

IOS_DIR = File.expand_path('..', __dir__)
PROJECT_PATH = File.join(IOS_DIR, 'TodayWhat.xcodeproj')
WATCH_TARGET_NAME = 'TodayWhatWatch'
WATCH_BUNDLE_ID = 'kr.purpledog.todaywhat.watchkitapp'
WATCH_DEPLOYMENT_TARGET = '10.0'
WATCH_SOURCE_DIR_NAME = 'TodayWhatWatch'
IOS_APP_TARGET_NAME = 'TodayWhat'

abort "project not found: #{PROJECT_PATH}" unless File.directory?(PROJECT_PATH)

project = Xcodeproj::Project.open(PROJECT_PATH)

ios_target = project.targets.find { |t| t.name == IOS_APP_TARGET_NAME }
abort "iOS app target '#{IOS_APP_TARGET_NAME}' not found" unless ios_target

# ---------------------------------------------------------------------------
# 1) 멱등성 — 기존 TodayWhatWatch 산출물 제거(타깃/그룹/의존성/임베드 페이즈/스킴)
# ---------------------------------------------------------------------------

if (existing_target = project.targets.find { |t| t.name == WATCH_TARGET_NAME })
  puts "[add_watch_target] removing existing target '#{WATCH_TARGET_NAME}' before recreate"

  # iOS 타깃의 의존성 중 워치 타깃을 가리키는 것 제거
  ios_target.dependencies.select { |d| d.target == existing_target }.each(&:remove_from_project)

  # iOS 타깃의 "Embed Watch Content" 복사 페이즈 제거
  ios_target.build_phases
            .select { |p| p.is_a?(Xcodeproj::Project::Object::PBXCopyFilesBuildPhase) && p.name == 'Embed Watch Content' }
            .each { |p| ios_target.build_phases.delete(p) }

  # 산출물 파일 참조 제거
  existing_target.product_reference&.remove_from_project

  existing_target.remove_from_project
end

if (existing_group = project.main_group.children.find { |g| g.respond_to?(:display_name) && g.display_name == WATCH_TARGET_NAME })
  existing_group.remove_from_project
end

scheme_path = Xcodeproj::XCScheme.shared_data_dir(PROJECT_PATH) + "#{WATCH_TARGET_NAME}.xcscheme"
File.delete(scheme_path) if File.exist?(scheme_path)

# ---------------------------------------------------------------------------
# 2) 그룹 + 파일 참조 (ios/TodayWhatWatch/**)
# ---------------------------------------------------------------------------

watch_group = project.main_group.new_group(WATCH_TARGET_NAME, WATCH_SOURCE_DIR_NAME)

source_dir = File.join(IOS_DIR, WATCH_SOURCE_DIR_NAME)
swift_files = Dir.glob(File.join(source_dir, '*.swift')).sort
info_plist_path = File.join(source_dir, 'Info.plist')
assets_path = File.join(source_dir, 'Assets.xcassets')

abort "no Swift sources found under #{source_dir}" if swift_files.empty?
abort "Info.plist not found: #{info_plist_path}" unless File.exist?(info_plist_path)
abort "Assets.xcassets not found: #{assets_path}" unless File.directory?(assets_path)

swift_file_refs = swift_files.map { |path| watch_group.new_reference(File.basename(path)) }
info_plist_ref = watch_group.new_reference('Info.plist')
assets_ref = watch_group.new_reference('Assets.xcassets')

# ---------------------------------------------------------------------------
# 3) 네이티브 타깃 (단일 타깃 watchOS 앱)
# ---------------------------------------------------------------------------

watch_target = project.new(Xcodeproj::Project::Object::PBXNativeTarget)
project.targets << watch_target
watch_target.name = WATCH_TARGET_NAME
watch_target.product_name = WATCH_TARGET_NAME
watch_target.product_type = 'com.apple.product-type.application'

product_ref = project.products_group.new_reference("#{WATCH_TARGET_NAME}.app")
product_ref.include_in_index = '0'
product_ref.set_explicit_file_type('wrapper.application')
product_ref.set_source_tree('BUILT_PRODUCTS_DIR')
watch_target.product_reference = product_ref

sources_phase = watch_target.source_build_phase
resources_phase = watch_target.resources_build_phase
watch_target.frameworks_build_phase # ensure phase exists before add_system_framework

swift_file_refs.each { |ref| sources_phase.add_file_reference(ref) }
resources_phase.add_file_reference(assets_ref)

# ---------------------------------------------------------------------------
# 4) 빌드 설정 (SDKROOT=watchos 를 먼저 세팅해야 add_system_framework 의 platform_name 판별이 동작)
# ---------------------------------------------------------------------------

common_settings = {
  'PRODUCT_NAME' => '$(TARGET_NAME)',
  'PRODUCT_BUNDLE_IDENTIFIER' => WATCH_BUNDLE_ID,
  'INFOPLIST_FILE' => "#{WATCH_SOURCE_DIR_NAME}/Info.plist",
  'ASSETCATALOG_COMPILER_APPICON_NAME' => 'AppIcon',
  'ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME' => 'AccentColor',
  'SDKROOT' => 'watchos',
  'SUPPORTED_PLATFORMS' => 'watchsimulator watchos',
  'TARGETED_DEVICE_FAMILY' => '4',
  'WATCHOS_DEPLOYMENT_TARGET' => WATCH_DEPLOYMENT_TARGET,
  'SWIFT_VERSION' => '5.0',
  'CODE_SIGN_STYLE' => 'Automatic',
  'CODE_SIGNING_ALLOWED' => 'NO',
  'DEVELOPMENT_TEAM' => '',
  'CURRENT_PROJECT_VERSION' => '1',
  'MARKETING_VERSION' => '1.0',
  'GENERATE_INFOPLIST_FILE' => 'NO',
  'SKIP_INSTALL' => 'YES',
  'ENABLE_PREVIEWS' => 'YES',
  'APPLICATION_EXTENSION_API_ONLY' => 'NO',
  'LD_RUNPATH_SEARCH_PATHS' => ['$(inherited)', '@executable_path/Frameworks'],
  'ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES' => 'YES',
  'SWIFT_EMIT_LOC_STRINGS' => 'YES',
  # RN/CocoaPods xcconfig 를 상속하지 않는다 — Pods baseConfigurationReference 미설정(§17.11.2).
}

debug_settings = common_settings.merge('DEBUG_INFORMATION_FORMAT' => 'dwarf', 'SWIFT_OPTIMIZATION_LEVEL' => '-Onone', 'ONLY_ACTIVE_ARCH' => 'YES')
release_settings = common_settings.merge('DEBUG_INFORMATION_FORMAT' => 'dwarf-with-dsym', 'SWIFT_OPTIMIZATION_LEVEL' => '-O', 'VALIDATE_PRODUCT' => 'YES')

watch_target.build_configuration_list = project.new(Xcodeproj::Project::Object::XCConfigurationList)

%w[Debug Release].each do |name|
  config = project.new(Xcodeproj::Project::Object::XCBuildConfiguration)
  config.name = name
  config.build_settings = (name == 'Debug' ? debug_settings : release_settings)
  watch_target.build_configuration_list.build_configurations << config
end
watch_target.build_configuration_list.default_configuration_name = 'Release'
watch_target.build_configuration_list.default_configuration_is_visible = '0'

# 시스템 프레임워크만 링크(§17.11.2) — RN Pods 미링크. WatchKit 은 WKApplicationDelegateAdaptor 용.
watch_target.add_system_framework(%w[WatchConnectivity SwiftUI WatchKit Foundation])

# ---------------------------------------------------------------------------
# 5) iOS 앱에 Embed Watch Content + 타깃 의존성 (임베드 시 워치 타깃 = TARGETED_DEVICE_FAMILY 4)
# ---------------------------------------------------------------------------

ios_target.add_dependency(watch_target)

embed_phase = ios_target.new_copy_files_build_phase('Embed Watch Content')
embed_phase.symbol_dst_subfolder_spec = :products_directory
embed_phase.dst_subfolder_spec = '16'
embed_phase.dst_path = '$(CONTENTS_FOLDER_PATH)/Watch'
build_file = embed_phase.add_file_reference(product_ref)
build_file.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }

# ---------------------------------------------------------------------------
# 6) 공유 스킴 (`xcodebuild -scheme TodayWhatWatch`)
# ---------------------------------------------------------------------------

scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(watch_target)
scheme.set_launch_target(watch_target)
scheme.save_as(PROJECT_PATH, WATCH_TARGET_NAME, true)

project.save

puts "[add_watch_target] done — target '#{WATCH_TARGET_NAME}' (bundle #{WATCH_BUNDLE_ID}, watchOS #{WATCH_DEPLOYMENT_TARGET}+) added to #{PROJECT_PATH}"
