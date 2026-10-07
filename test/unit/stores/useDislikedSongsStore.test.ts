// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SongResult } from '@/types';

// test/unit/stores/useDislikedSongsStore.test.ts

const STORAGE_KEY = 'folia.disliked-songs';

const onlineSong = (mediaId: string): SongResult => ({
    id: mediaId,
    name: 'x',
    artists: [],
    album: { id: '', name: '' },
    durationMs: 1000,
    sourceRef: { kind: 'online', providerId: 'qq', mediaId },
} as SongResult);

describe('useDislikedSongsStore', () => {
    let useDislikedSongsStore: typeof import('@/stores/useDislikedSongsStore').useDislikedSongsStore;

    beforeEach(async () => {
        localStorage.clear();
        vi.resetModules();
        ({ useDislikedSongsStore } = await import('@/stores/useDislikedSongsStore'));
        useDislikedSongsStore.setState({ keys: [] });
    });

    it('records a disliked key and reports has() true', () => {
        useDislikedSongsStore.getState().add(onlineSong('111'));
        expect(useDislikedSongsStore.getState().has(onlineSong('111'))).toBe(true);
        expect(useDislikedSongsStore.getState().has(onlineSong('222'))).toBe(false);
    });

    it('dedupes and persists to localStorage', () => {
        const add = useDislikedSongsStore.getState().add;
        add(onlineSong('111'));
        add(onlineSong('111'));
        add(onlineSong('222'));
        expect(useDislikedSongsStore.getState().keys).toEqual(['online:qq:222', 'online:qq:111']);
        expect(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')).toEqual(['online:qq:222', 'online:qq:111']);
    });

    it('distinguishes same mediaId across providers by key', () => {
        const add = useDislikedSongsStore.getState().add;
        add(onlineSong('111'));
        // 另一 provider 的同号 id 不应被误判为已不感兴趣
        const other = { id: '111', name: 'x', artists: [], album: { id: '', name: '' }, durationMs: 0, sourceRef: { kind: 'online', providerId: 'netease', mediaId: '111' } } as SongResult;
        expect(useDislikedSongsStore.getState().has(other)).toBe(false);
    });

    it('clear empties state and storage', () => {
        useDislikedSongsStore.getState().add(onlineSong('111'));
        useDislikedSongsStore.getState().clear();
        expect(useDislikedSongsStore.getState().keys).toEqual([]);
        expect(localStorage.getItem(STORAGE_KEY)).toBe('[]');
    });
});
