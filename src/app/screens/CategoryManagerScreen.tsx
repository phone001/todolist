/**
 * 유형 관리 — 유형(카테고리) 목록 조회 + 추가 + 삭제 (F-06, E-06-1/E-06-2).
 * 설정 화면의 "유형 관리" 행에서 진입한다.
 * 바인딩: CategoryService.list/create/remove → categories 무효화.
 * 환경 제약: react / react-native 의존 → 파이프라인 미실행(정적 리뷰).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useServices } from '../bootstrap/AppContext.tsx';
import { useShellStore } from '../state/stores.native.ts';
import type { Category } from '../../core/domain/types.ts';

export function CategoryManagerScreen() {
  const { categories } = useServices();
  const invalidate = useShellStore((s) => s.invalidate);

  const [cats, setCats] = useState<Category[]>([]);
  const [name, setName] = useState('');

  const load = useCallback(async () => {
    setCats(await categories.list());
  }, [categories]);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async () => {
    const trimmed = name.trim();
    if (trimmed.length === 0) return;
    try {
      await categories.create(trimmed);
      setName('');
      invalidate('categories');
      await load();
    } catch (err) {
      Alert.alert('유형 추가 실패', err instanceof Error ? err.message : '이름은 1~30자여야 합니다.');
    }
  };

  const remove = (c: Category) => {
    Alert.alert('유형 삭제', `"${c.name}" 을(를) 삭제할까요?\n이 유형의 일정은 "기타"로 이동합니다.`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await categories.remove(c.id);
            invalidate('categories', 'list', 'dashboard');
            await load();
          } catch (err) {
            Alert.alert('삭제 실패', err instanceof Error ? err.message : '기본 유형은 삭제할 수 없습니다.');
          }
        },
      },
    ]);
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, gap: 16 }}>
      <View style={{ gap: 8 }}>
        {cats.map((c) => (
          <View
            key={c.id}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: '#f0f0f0',
            }}
          >
            <Text style={{ fontSize: 15 }}>
              {c.name}
              {c.isSystem ? '  (기본)' : ''}
            </Text>
            {c.isSystem ? (
              <Text style={{ color: '#bbb', fontSize: 13 }}>삭제 불가</Text>
            ) : (
              <Pressable onPress={() => remove(c)} hitSlop={8}>
                <Text style={{ color: '#FF3B30' }}>삭제</Text>
              </Pressable>
            )}
          </View>
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <TextInput
          placeholder="새 유형 이름"
          value={name}
          onChangeText={setName}
          onSubmitEditing={add}
          returnKeyType="done"
          maxLength={30}
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: '#ddd',
            borderRadius: 8,
            paddingHorizontal: 10,
            paddingVertical: 8,
          }}
        />
        <Pressable
          onPress={add}
          style={{ paddingVertical: 9, paddingHorizontal: 16, backgroundColor: '#007AFF', borderRadius: 8 }}
        >
          <Text style={{ color: '#fff' }}>추가</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
