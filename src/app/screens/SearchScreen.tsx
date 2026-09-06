/**
 * 검색 — 제목/메모/유형명 (F-11, AC-13/14, P-11/P-12).
 * 바인딩: SearchService.search. 2자 미만이면 "짧은 검색어" 배지.
 * 환경 제약: react / react-native 의존 → 파이프라인 미실행(정적 리뷰).
 */
import React, { useEffect, useRef, useState } from 'react';
import { FlatList, Text, TextInput, View } from 'react-native';
import { useServices } from '../bootstrap/AppContext.tsx';
import { useShellStore } from '../state/stores.native.ts';

export function SearchScreen() {
  const { search } = useServices();
  const result = useShellStore((s) => s.search);
  const setSearch = useShellStore((s) => s.setSearch);
  const [text, setText] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const q = text.trim();
      if (q.length === 0) {
        setSearch('', [], false);
        return;
      }
      const res = await search.search({ query: q });
      setSearch(q, res.items, res.limited);
    }, 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [text, search, setSearch]);

  return (
    <View style={{ flex: 1 }}>
      <TextInput
        placeholder="검색어"
        value={text}
        onChangeText={setText}
        style={{ padding: 12, borderBottomWidth: 1 }}
      />
      {result.limited ? <Text style={{ padding: 8 }}>검색어가 짧아 결과가 제한됩니다</Text> : null}
      <FlatList
        data={result.items}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <Text style={{ padding: 12 }}>{item.title}</Text>}
        ListEmptyComponent={
          text.trim().length > 0 ? <Text style={{ padding: 24 }}>결과가 없습니다</Text> : null
        }
      />
    </View>
  );
}
