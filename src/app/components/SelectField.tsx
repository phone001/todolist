/**
 * 단일 선택 셀렉트박스 — 순수 프레젠테이션 컴포넌트 (F-06/F-07/F-08/F-24, P-70, D-31).
 * 설계 근거: document/architect/logic.md v1.17 §16.3.1 "선택형 필드 셀렉트박스화".
 * 환경 제약: react / react-native 의존 → 파이프라인 미실행(정적 리뷰). 라벨 계산 로직은
 *           selectFieldLogic.ts(순수, node:test)로 위임한다.
 *
 * 순수 프레젠테이션 컴포넌트: `src/core/**`·서비스·`bindings.ts` 를 import 하지 않는다
 * (BrandLoadingIndicator 와 동일 원칙). 신규 의존성 없음 — RN 내장 `Pressable`/`Modal`/`Text` 만 사용.
 */
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { resolveSelectedLabel, type SelectOption } from './selectFieldLogic.ts';

export type { SelectOption };

export interface SelectFieldProps<T> {
  label: string;
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
}

export function SelectField<T>({ label, value, options, onChange, disabled }: SelectFieldProps<T>) {
  const [open, setOpen] = useState(false);
  const selectedLabel = resolveSelectedLabel(value, options);

  const close = () => setOpen(false);

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selectedLabel}`}
        accessibilityState={{ disabled: !!disabled }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[styles.trigger, disabled ? styles.disabled : null]}
      >
        <Text style={styles.triggerText}>{selectedLabel} ▾</Text>
      </Pressable>

      <Modal transparent visible={open} animationType="fade" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
          <View style={styles.sheet}>
            {options.map((o) => {
              const checked = o.value === value;
              return (
                <Pressable
                  key={String(o.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked }}
                  onPress={() => {
                    onChange(o.value);
                    close();
                  }}
                  style={styles.option}
                >
                  <Text style={styles.optionText}>
                    {checked ? '✓ ' : ''}
                    {o.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
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
});
