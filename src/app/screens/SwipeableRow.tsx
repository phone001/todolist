/**
 * 왼쪽 스와이프 시 「수정 / 삭제」 액션을 노출하는 리스트 행 래퍼.
 * 의존성 추가 없이 RN 내장 PanResponder + Animated 로 구현 (gesture-handler 미도입).
 * 환경 제약: react / react-native 의존 → 파이프라인 미실행(정적 리뷰).
 */
import React, { useRef } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';

const ACTION_W = 80;
const OPEN_X = -ACTION_W * 2;

export function SwipeableRow({
  children,
  onEdit,
  onDelete,
}: {
  children: React.ReactNode;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const openRef = useRef(false);
  const startXRef = useRef(0);

  const snap = (to: number) => {
    openRef.current = to !== 0;
    Animated.timing(translateX, { toValue: to, duration: 160, useNativeDriver: true }).start();
  };

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) =>
        Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderGrant: () => {
        startXRef.current = openRef.current ? OPEN_X : 0;
      },
      onPanResponderMove: (_e, g) => {
        let next = startXRef.current + g.dx;
        if (next > 0) next = 0;
        if (next < OPEN_X - 24) next = OPEN_X - 24;
        translateX.setValue(next);
      },
      onPanResponderRelease: (_e, g) => {
        const next = startXRef.current + g.dx;
        snap(next < OPEN_X / 2 ? OPEN_X : 0);
      },
      onPanResponderTerminate: () => snap(openRef.current ? OPEN_X : 0),
    }),
  ).current;

  return (
    <View style={styles.wrap}>
      <View style={styles.actions} pointerEvents="box-none">
        <Pressable
          style={[styles.action, { backgroundColor: '#007AFF' }]}
          onPress={() => {
            snap(0);
            onEdit();
          }}
        >
          <Text style={styles.actionText}>수정</Text>
        </Pressable>
        <Pressable
          style={[styles.action, { backgroundColor: '#FF3B30' }]}
          onPress={() => {
            snap(0);
            onDelete();
          }}
        >
          <Text style={styles.actionText}>삭제</Text>
        </Pressable>
      </View>
      <Animated.View style={[styles.front, { transform: [{ translateX }] }]} {...pan.panHandlers}>
        {/* 열린 상태에서 본문을 누르면 닫기(그 탭은 소비). 닫힌 상태에선 자식(체크박스 등)이 정상 동작 */}
        <View
          onStartShouldSetResponder={() => {
            if (openRef.current) {
              snap(0);
              return true;
            }
            return false;
          }}
        >
          {children}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative', overflow: 'hidden', backgroundColor: '#fff' },
  actions: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  action: { width: ACTION_W, alignItems: 'center', justifyContent: 'center' },
  actionText: { color: '#fff', fontWeight: '600' },
  front: { backgroundColor: '#fff' },
});
