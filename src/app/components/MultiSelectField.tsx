/**
 * 다중 선택 셀렉트박스 — 순수 프레젠테이션 컴포넌트 (F-08, P-70, D-31(a)).
 * 설계 근거: document/architect/logic.md v1.17 §16.3.1 "선택형 필드 셀렉트박스화" /
 *           §16.3.1 "사전 알림 프리셋 다중 선택".
 * 환경 제약: react / react-native 의존 → 파이프라인 미실행(정적 리뷰). 라벨·토글 계산 로직은
 *           selectFieldLogic.ts(순수, node:test)로 위임한다.
 *
 * 순수 프레젠테이션 컴포넌트: `src/core/**`·서비스·`bindings.ts` 를 import 하지 않는다.
 * 신규 의존성 없음 — RN 내장 `Pressable`/`Modal`/`Text` 만 사용.
 * 옵션 행을 탭해도 모달이 자동으로 닫히지 않는다(다중 선택) — 하단 "닫기" 액션으로 확정한다.
 */
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  formatMultiSelectTriggerLabel,
  toggleMultiSelectValue,
  type SelectOption,
} from './selectFieldLogic.ts';

export type { SelectOption };

export interface MultiSelectFieldProps {
  label: string;
  values: number[];
  options: SelectOption<number>[];
  onChange: (values: number[]) => void;
  disabled?: boolean;
}

export function MultiSelectField({ label, values, options, onChange, disabled }: MultiSelectFieldProps) {
  const [open, setOpen] = useState(false);
  const triggerLabel = formatMultiSelectTriggerLabel(values, options);

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${triggerLabel}`}
        accessibilityState={{ disabled: !!disabled }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[styles.trigger, disabled ? styles.disabled : null]}
      >
        <Text style={styles.triggerText}>{triggerLabel} ▾</Text>
      </Pressable>

      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            {options.map((o) => {
              const checked = values.includes(o.value);
              return (
                <Pressable
                  key={o.value}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked }}
                  onPress={() => onChange(toggleMultiSelectValue(values, o.value))}
                  style={styles.option}
                >
                  <Text style={styles.optionText}>
                    {checked ? '✓ ' : ''}
                    {o.label}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable
              accessibilityRole="button"
              onPress={() => setOpen(false)}
              style={styles.closeButton}
            >
              <Text style={styles.closeText}>닫기</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: {
    borderWidth: 1,
    borderColor: '#888',
    borderRadius: 4,
    padding: 8,
    marginTop: 4,
  },
  disabled: {
    opacity: 0.5,
  },
  triggerText: {
    fontSize: 15,
    color: '#333',
  },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  sheet: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 8,
  },
  option: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  optionText: {
    fontSize: 15,
    color: '#333',
  },
  closeButton: {
    paddingVertical: 12,
    marginTop: 4,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  closeText: {
    color: '#007AFF',
    fontWeight: '600',
  },
});
