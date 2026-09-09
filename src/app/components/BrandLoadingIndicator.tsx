/**
 * 브랜드 로딩 인디케이터 (F-17) — 로고 오리가 도메인 활동을 순환하는 벡터 애니메이션.
 * 설계 근거: document/architect/logic.md v1.7 §16.9 (전체), nfr.md v1.5 §13,
 *           plan.md v1.2 F-17 / P-22~P-31 / AC-29~38.
 * 환경 제약: react / react-native / react-native-svg 의존 → 파이프라인 미실행(정적 리뷰).
 *
 * 순수 프레젠테이션 컴포넌트: `src/core/**`·`bindings.ts`·`stores.native.ts` 를 import 하지 않는다.
 * 입력은 전부 props(boolean/enum/문자열 상수/콜백). 화면은 로딩 "원인"이 아니라 boolean 만 전달한다.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SvgErrorBoundary } from './SvgErrorBoundary.tsx';
import { DuckScene } from './duck/DuckScene.tsx';
import {
  ACTIVITY_CROSSFADE_MS,
  ACTIVITY_VISIBLE_MS,
  activitySequence,
  STATIC_FALLBACK_ACTIVITY,
  type ActivityId,
} from './duck/activities.ts';
import {
  DUCK_MAX_WIDTH_RATIO_FULLSCREEN,
  DUCK_MAX_WIDTH_RATIO_INLINE,
  DUCK_SIZE_FULLSCREEN,
  DUCK_SIZE_INLINE,
} from './duck/duckGeometry.ts';
import { useLoadingIndicator } from './useLoadingIndicator.native.ts';

const LOGO = require('../../assets/icons/logo.png') as number;

export interface BrandLoadingIndicatorProps {
  /** 화면이 자기 로딩 상태를 그대로 전달. 컴포넌트가 지연/최소표시 게이트를 적용해 실제 visible 을 도출한다. */
  loading: boolean;
  /** 로딩 종료 사유. 'error' 면 최소 표시 시간을 적용하지 않고 즉시 사라진다(E-17-7, AC-38). 기본 'success'. */
  endReason?: 'success' | 'error';
  /** 배치. 기본 'inline'. */
  variant?: 'fullscreen' | 'inline';
  /** 순환 시작 활동. Search 화면은 'search'. 미지정 시 기본 순서 첫 활동('checkList'). */
  startActivity?: ActivityId;
  /** 활동 순서 override. 미지정 시 기본 4활동 순환. 길이는 3~5로 clamp(P-23). */
  sequence?: ActivityId[];
  /** P-28 타임아웃 초과 시 노출할 보조 문구/슬롯. 미지정 시 기본 문구. */
  timeoutHint?: React.ReactNode;
  /** 타임아웃 이후 노출되는 재시도/취소 핸들러(E-17-4). 없으면 버튼 미표시. */
  onRetry?: () => void;
  onCancel?: () => void;
  /** 접근성 라벨. 기본 "불러오는 중"(P-30, AC-37). */
  accessibilityLabel?: string;
  testID?: string;
}

const DEFAULT_LABEL = '불러오는 중';
const DEFAULT_TIMEOUT_HINT = '계속 불러오는 중이에요';

function clampSize(base: number, ratio: number): number {
  const w = Dimensions.get('window').width;
  if (!w || w <= 0) return base;
  return Math.max(24, Math.min(base, Math.round(w * ratio)));
}

/** 오리 활동 순환 + 크로스페이드 + 은은한 바운스 루프 (§16.9.1, §16.9.3). */
function DuckLoop({ sequence, size }: { sequence: ActivityId[]; size: number }) {
  const len = sequence.length;
  const [index, setIndex] = useState(0);

  const curOpacity = useRef(new Animated.Value(1)).current;
  const prevOpacity = useRef(new Animated.Value(0)).current;
  const bounce = useRef(new Animated.Value(0)).current;

  const fadeRef = useRef<Animated.CompositeAnimation | null>(null);
  const bounceLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  // 활동 전환 타이머 (활동당 2500ms 노출)
  useEffect(() => {
    if (len <= 1) return undefined;
    const id = setInterval(() => {
      setIndex((x) => (x + 1) % len);
    }, ACTIVITY_VISIBLE_MS);
    return () => clearInterval(id);
  }, [len]);

  // 크로스페이드 (300ms 겹침 — 급격한 점프 없음, R-17-3)
  useEffect(() => {
    curOpacity.setValue(0);
    prevOpacity.setValue(1);
    fadeRef.current = Animated.parallel([
      Animated.timing(curOpacity, {
        toValue: 1,
        duration: ACTIVITY_CROSSFADE_MS,
        useNativeDriver: true,
      }),
      Animated.timing(prevOpacity, {
        toValue: 0,
        duration: ACTIVITY_CROSSFADE_MS,
        useNativeDriver: true,
      }),
    ]);
    fadeRef.current.start();
    return () => {
      fadeRef.current?.stop();
    };
  }, [index, curOpacity, prevOpacity]);

  // 은은한 바운스 무한 루프 (useNativeDriver) — 로딩 종료 시 cleanup 에서 .stop() (P-31, §16.9.9)
  useEffect(() => {
    bounceLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, { toValue: 1, duration: 620, useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 0, duration: 620, useNativeDriver: true }),
      ]),
    );
    bounceLoopRef.current.start();
    return () => {
      bounceLoopRef.current?.stop();
    };
  }, [bounce]);

  const translateY = bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });
  const current = sequence[index] ?? STATIC_FALLBACK_ACTIVITY;
  const previous = sequence[(index - 1 + len) % len] ?? STATIC_FALLBACK_ACTIVITY;

  return (
    <Animated.View style={{ width: size, height: size, transform: [{ translateY }] }}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: prevOpacity }]}>
        <DuckScene activity={previous} size={size} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: curOpacity }]}>
        <DuckScene activity={current} size={size} />
      </Animated.View>
    </Animated.View>
  );
}

export function BrandLoadingIndicator(props: BrandLoadingIndicatorProps) {
  const {
    loading,
    endReason = 'success',
    variant = 'inline',
    startActivity,
    sequence,
    timeoutHint,
    onRetry,
    onCancel,
    accessibilityLabel = DEFAULT_LABEL,
    testID,
  } = props;

  const { visible, mode, showTimeoutHint, notifyRenderFailed } = useLoadingIndicator({
    loading,
    endReason,
  });

  // 정적 폴백의 DuckScene 마저 실패하면 logo.png → 그것도 실패하면 스피너 (§16.9.5)
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => {
    if (!visible) setImageFailed(false);
  }, [visible]);

  const seq = useMemo(() => activitySequence(startActivity, sequence), [startActivity, sequence]);

  const isFullscreen = variant === 'fullscreen';
  const size = isFullscreen
    ? clampSize(DUCK_SIZE_FULLSCREEN, DUCK_MAX_WIDTH_RATIO_FULLSCREEN)
    : clampSize(DUCK_SIZE_INLINE, DUCK_MAX_WIDTH_RATIO_INLINE);

  if (!visible) return null;

  let body: React.ReactNode;
  if (mode === 'spinner') {
    body = imageFailed ? (
      <ActivityIndicator />
    ) : (
      <Image
        source={LOGO}
        onError={() => setImageFailed(true)}
        resizeMode="contain"
        style={{ width: size, height: size }}
      />
    );
  } else if (mode === 'static') {
    body = (
      <SvgErrorBoundary onFail={notifyRenderFailed}>
        <DuckScene activity={STATIC_FALLBACK_ACTIVITY} size={size} />
      </SvgErrorBoundary>
    );
  } else {
    body = (
      <SvgErrorBoundary onFail={notifyRenderFailed}>
        <DuckLoop sequence={seq} size={size} />
      </SvgErrorBoundary>
    );
  }

  const showText = mode !== 'animation'; // 정적/스피너 단계에서만 "불러오는 중…" 시각 텍스트

  return (
    <View
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityLiveRegion={Platform.OS === 'android' ? 'polite' : undefined}
      style={isFullscreen ? styles.fullscreen : styles.inline}
    >
      {body}

      {showText ? (
        <Text style={styles.caption} importantForAccessibility="no" accessibilityElementsHidden>
          불러오는 중…
        </Text>
      ) : null}

      {showTimeoutHint ? (
        <View style={styles.hintBox}>
          {timeoutHint !== undefined && typeof timeoutHint !== 'string' ? (
            timeoutHint
          ) : (
            <Text style={styles.hintText}>{(timeoutHint as string | undefined) ?? DEFAULT_TIMEOUT_HINT}</Text>
          )}
          {onRetry || onCancel ? (
            <View style={styles.hintActions}>
              {onRetry ? (
                <Pressable onPress={onRetry} accessibilityRole="button" style={styles.hintButton}>
                  <Text style={styles.hintRetry}>다시 시도</Text>
                </Pressable>
              ) : null}
              {onCancel ? (
                <Pressable onPress={onCancel} accessibilityRole="button" style={styles.hintButton}>
                  <Text style={styles.hintCancel}>취소</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fullscreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  inline: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  caption: {
    marginTop: 8,
    fontSize: 13,
    color: '#888',
  },
  hintBox: {
    marginTop: 12,
    alignItems: 'center',
  },
  hintText: {
    fontSize: 13,
    color: '#666',
  },
  hintActions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  hintButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  hintRetry: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  hintCancel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
  },
});
