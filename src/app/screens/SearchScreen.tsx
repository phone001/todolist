/**
 * 검색 — 제목/메모/유형명 (F-11, AC-13/14, P-11/P-12).
 * 바인딩: SearchService.search. 2자 미만이면 "짧은 검색어" 배지.
 * 결과 로딩 중에는 브랜드 로딩 인디케이터(인라인, 첫 활동 'search') 노출 (F-17, logic §16.9.8 #4).
 *   디바운스(250ms) + 인디케이터 자체 표시 지연(200ms)으로 빠른 질의 깜빡임 방지(E-17-3, AC-32).
 * 환경 제약: react / react-native 의존 → 파이프라인 미실행(정적 리뷰).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useServices } from '../bootstrap/AppContext.tsx';
import { useShellStore } from '../state/stores.native.ts';
import { BrandLoadingIndicator } from '../components/BrandLoadingIndicator.tsx';

export function SearchScreen() {
  const { search } = useServices();
  const result = useShellStore((s) => s.search);
  const setSearch = useShellStore((s) => s.setSearch);
  const clearStale = useShellStore((s) => s.clearStale);
  const [text, setText] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(
    async (raw: string) => {
      const q = raw.trim();
      if (q.length === 0) {
        setSearch('', [], false);
        setSearching(false);
        setSearchError(false);
        return;
      }
      setSearching(true);
      setSearchError(false);
      try {
        const res = await search.search({ query: q });
        setSearch(q, res.items, res.limited);
      } catch {
        // 조회 실패 → 마지막 결과 유지 + 에러/재시도 (E-02-2, E-17-7)
        setSearchError(true);
      } finally {
        setSearching(false);
      }
    },
    [search, setSearch],
  );

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void runSearch(text);
    }, 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [text, runSearch]);

  // 일정 추가/수정이 search 를 무효화하면 포커스 복귀 시 현재 검색어로 재조회 (logic §16.3).
  useFocusEffect(
    useCallback(() => {
      if (useShellStore.getState().stale.search) {
        clearStale('search');
        void runSearch(text);
      }
    }, [runSearch, text, clearStale]),
  );

  return (
    <View style={{ flex: 1 }}>
      <TextInput
        placeholder="검색어"
        value={text}
        onChangeText={setText}
        style={{ padding: 12, borderBottomWidth: 1 }}
      />
      {result.limited ? <Text style={{ padding: 8 }}>검색어가 짧아 결과가 제한됩니다</Text> : null}
      <View style={{ flex: 1 }}>
        <FlatList
          style={{ flex: 1 }}
          data={result.items}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <Text style={{ padding: 12 }}>{item.title}</Text>}
          ListEmptyComponent={
            searching || searchError || text.trim().length === 0 ? null : (
              <Text style={{ padding: 24 }}>결과가 없습니다</Text>
            )
          }
        />

        {/* F-17 인라인 인디케이터 — 결과 리스트 영역. 화면당 1개(E-17-8). */}
        {searching || searchError ? (
          <View style={styles.overlay} pointerEvents={searchError ? 'auto' : 'none'}>
            <BrandLoadingIndicator
              variant="inline"
              startActivity="search"
              loading={searching}
              endReason={searchError ? 'error' : 'success'}
              onRetry={() => void runSearch(text)}
              onCancel={() => setSearching(false)}
              testID="search-loading"
            />
            {searchError ? (
              <Pressable
                onPress={() => void runSearch(text)}
                accessibilityRole="button"
                style={{ marginTop: 4 }}
              >
                <Text style={{ color: '#007AFF', fontWeight: '600' }}>
                  검색하지 못했어요 · 다시 시도
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
