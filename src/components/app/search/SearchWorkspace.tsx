import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Clock3, Loader2, Music, Search, User, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import type { Theme, UnifiedSong } from '../../../types';
import type { MediaId, OnlineSearchSuggestion } from '../../../types/onlineMusic';
import {
    type SearchSource,
    useSearchNavigationStore,
} from '../../../stores/useSearchNavigationStore';
import SearchResultsList from './SearchResultsList';
import { useCollectionNavigationStore } from '../../../stores/useCollectionNavigationStore';
import { useOnlineProviderAccountStore } from '../../../stores/useOnlineProviderAccountStore';
import { omni } from '../../../services/onlineMusic/omni';
import { collectionKey, createOnlineGridViewCollection, type GridViewCollectionDescriptor } from '../home/gridViewCollectionAdapters';

// src/components/app/search/SearchWorkspace.tsx
// 搜索框的三件细化都在这一个文件里：smartbox 输入联想（下拉）、搜索历史（localStorage）、
// 专辑/歌单类型搜索的集合卡行。联想与集合卡都走 omni（在线数据只走 omni 的铁律），
// provider 没实现对应方法就静默降级为没有那一件。

const SEARCH_HISTORY_KEY = 'folia.search-history';
const SEARCH_HISTORY_LIMIT = 8;
/** 输入联想与集合卡的防抖：短到跟手，长到不打爆 smartbox。 */
const SUGGESTION_DEBOUNCE_MS = 250;
/** blur 后留一小段时间，让历史/联想项的 onMouseDown 先于面板消失。 */
const HISTORY_BLUR_DELAY_MS = 120;

const readSearchHistory = (): string[] => {
    if (typeof window === 'undefined') return [];
    try {
        const raw = window.localStorage.getItem(SEARCH_HISTORY_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
    } catch {
        return [];
    }
};

const writeSearchHistory = (entries: string[]): void => {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(entries.slice(0, SEARCH_HISTORY_LIMIT)));
    } catch {
        // localStorage 写不进去（隐私模式/配额）就只活在本组件 state 里，不解释。
    }
};

type SearchWorkspaceProps = {
    theme: Theme;
    isDaylight: boolean;
    onClose: () => void;
    onSubmitSearch: (source?: SearchSource) => void;
    onLoadMore: () => void;
    onPlayTrack: (track: UnifiedSong) => void;
    onAddTrackToQueue: (track: UnifiedSong) => void;
    onOpenArtist: (track: UnifiedSong, artistName: string, artistId?: MediaId, entityId?: string) => void;
    onOpenAlbum: (track: UnifiedSong, albumName: string, albumId?: MediaId, entityId?: string) => void;
    onOpenCollection: (collection: GridViewCollectionDescriptor) => void;
};

const SearchWorkspace: React.FC<SearchWorkspaceProps> = ({
    theme,
    isDaylight,
    onClose,
    onSubmitSearch,
    onLoadMore,
    onPlayTrack,
    onAddTrackToQueue,
    onOpenArtist,
    onOpenAlbum,
    onOpenCollection,
}) => {
    const { t } = useTranslation();
    const {
        searchQuery,
        searchSourceTab,
        searchResults,
        isSearchOpen,
        isSearching,
        isLoadingMore,
        searchError,
        hasMore,
        scrollTop,
        setSearchQuery,
        setSearchScrollTop,
    } = useSearchNavigationStore(useShallow(state => ({
        searchQuery: state.searchQuery,
        searchSourceTab: state.searchSourceTab,
        searchResults: state.searchResults,
        isSearchOpen: state.isSearchOpen,
        isSearching: state.isSearching,
        isLoadingMore: state.isLoadingMore,
        searchError: state.searchError,
        hasMore: state.hasMore,
        scrollTop: state.scrollTop,
        setSearchQuery: state.setSearchQuery,
        setSearchScrollTop: state.setSearchScrollTop,
    })));
    const results = searchResults || [];
    const activeOnlineProviderId = useOnlineProviderAccountStore(state => state.activeProviderId);
    const sources = useMemo<SearchSource[]>(() => [activeOnlineProviderId, 'local', 'navidrome'], [activeOnlineProviderId]);
    const hasCollection = useCollectionNavigationStore(state => Boolean(state.snapshot?.stack.length));
    const getSourceLabel = (source: SearchSource) => {
        if (source === 'local') return t('search.sourceLocal');
        if (source === 'navidrome') return t('search.sourceNavidrome');
        return omni.getProviderLabel(source);
    };

    const [suggestions, setSuggestions] = useState<OnlineSearchSuggestion[]>([]);
    const [activeSuggestion, setActiveSuggestion] = useState(-1);
    const [collections, setCollections] = useState<GridViewCollectionDescriptor[]>([]);
    const [history, setHistory] = useState<string[]>(() => readSearchHistory());
    const [isHistoryVisible, setIsHistoryVisible] = useState(false);

    const isOnlineTab = searchSourceTab !== 'local' && searchSourceTab !== 'navidrome';

    useEffect(() => {
        if (!isSearchOpen || hasCollection) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [hasCollection, isSearchOpen, onClose]);

    // 输入联想 + 类型搜索集合卡：同一次防抖里取，provider 没实现就各自空。
    useEffect(() => {
        if (!isSearchOpen || !isOnlineTab || searchQuery.trim().length === 0) {
            setSuggestions([]);
            setCollections([]);
            setActiveSuggestion(-1);
            return;
        }

        const timer = window.setTimeout(() => {
            const query = searchQuery.trim();
            void omni.searchSmartboxSuggestions(searchSourceTab, query)
                .then(items => setSuggestions(items))
                .catch(() => setSuggestions([]));
            void omni.searchProviderCollections(searchSourceTab, query, { limit: 12, offset: 0 })
                .then(page => setCollections(page.items.map(item => createOnlineGridViewCollection(item, searchSourceTab))))
                .catch(() => setCollections([]));
        }, SUGGESTION_DEBOUNCE_MS);
        setActiveSuggestion(-1);
        return () => window.clearTimeout(timer);
    }, [isOnlineTab, isSearchOpen, searchQuery, searchSourceTab]);

    const recordSearchHistory = useCallback((value: string) => {
        const trimmed = value.trim();
        if (!trimmed) return;
        setHistory(previous => {
            const next = [trimmed, ...previous.filter(entry => entry !== trimmed)].slice(0, SEARCH_HISTORY_LIMIT);
            writeSearchHistory(next);
            return next;
        });
    }, []);

    const clearSearchHistory = useCallback(() => {
        setHistory([]);
        writeSearchHistory([]);
    }, []);

    const runSearch = useCallback((source?: SearchSource) => {
        if (!source && searchQuery.trim()) {
            recordSearchHistory(searchQuery);
        }
        onSubmitSearch(source);
    }, [onSubmitSearch, recordSearchHistory, searchQuery]);

    const pickSuggestion = useCallback((suggestion: OnlineSearchSuggestion) => {
        setSuggestions([]);
        setActiveSuggestion(-1);
        setSearchQuery(suggestion.value);
        recordSearchHistory(suggestion.value);
        onSubmitSearch();
    }, [onSubmitSearch, recordSearchHistory, setSearchQuery]);

    const pickHistoryEntry = useCallback((value: string) => {
        setSearchQuery(value);
        onSubmitSearch();
    }, [onSubmitSearch, setSearchQuery]);

    return (
        <AnimatePresence>
            {isSearchOpen && (
                <motion.section
                    initial={{ opacity: 0, y: 28 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 28 }}
                    className={`fixed inset-0 flex flex-col overflow-hidden px-3 py-4 sm:px-6 sm:py-6 ${
                        hasCollection ? 'z-[5]' : 'z-50'
                    }`}
                    style={{
                        color: theme.primaryColor,
                        backgroundColor: isDaylight ? 'rgba(250,250,250,0.96)' : 'rgba(8,8,10,0.94)',
                        backdropFilter: 'blur(24px)',
                    }}
                >
                    <header className="mx-auto flex w-full max-w-5xl shrink-0 flex-col gap-3">
                        <div className="flex items-center gap-3">
                            <form
                                className={`relative flex-1 rounded-2xl border ${
                                    isDaylight ? 'border-black/10 bg-black/[0.04]' : 'border-white/10 bg-white/[0.05]'
                                }`}
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    runSearch();
                                }}
                            >
                                {isSearching ? (
                                    <Loader2 className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin opacity-50" />
                                ) : (
                                    <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 opacity-45" />
                                )}
                                <input
                                    value={searchQuery}
                                    onChange={event => setSearchQuery(event.target.value)}
                                    onKeyDown={(event) => {
                                        if (suggestions.length === 0) return;
                                        if (event.key === 'ArrowDown') {
                                            event.preventDefault();
                                            setActiveSuggestion(previous => (previous + 1) % suggestions.length);
                                            return;
                                        }
                                        if (event.key === 'ArrowUp') {
                                            event.preventDefault();
                                            setActiveSuggestion(previous => (previous <= 0 ? suggestions.length - 1 : previous - 1));
                                            return;
                                        }
                                        if (event.key === 'Enter' && activeSuggestion >= 0) {
                                            event.preventDefault();
                                            pickSuggestion(suggestions[activeSuggestion]);
                                        }
                                    }}
                                    onFocus={() => setIsHistoryVisible(true)}
                                    onBlur={() => window.setTimeout(() => setIsHistoryVisible(false), HISTORY_BLUR_DELAY_MS)}
                                    placeholder={t('search.placeholder')}
                                    className="w-full bg-transparent py-3.5 pl-11 pr-4 text-sm outline-none"
                                    autoFocus
                                />

                                {searchQuery.trim().length === 0 && isHistoryVisible && history.length > 0 && (
                                    <div
                                        className={`absolute left-0 right-0 top-full z-10 mt-2 rounded-2xl border p-2 ${
                                            isDaylight ? 'border-black/10 bg-white shadow-lg' : 'border-white/10 bg-[#141418] shadow-xl'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between px-2 pb-1">
                                            <span className="flex items-center gap-1.5 text-xs opacity-55">
                                                <Clock3 size={13} />
                                                {t('search.history')}
                                            </span>
                                            <button
                                                type="button"
                                                onMouseDown={event => event.preventDefault()}
                                                onClick={clearSearchHistory}
                                                className="text-xs opacity-55 transition-opacity hover:opacity-90"
                                            >
                                                {t('search.clearHistory')}
                                            </button>
                                        </div>
                                        <div className="flex flex-col">
                                            {history.map(entry => (
                                                <button
                                                    key={entry}
                                                    type="button"
                                                    onMouseDown={event => event.preventDefault()}
                                                    onClick={() => pickHistoryEntry(entry)}
                                                    className="rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-black/5"
                                                >
                                                    {entry}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {searchQuery.trim().length > 0 && suggestions.length > 0 && (
                                    <div
                                        className={`absolute left-0 right-0 top-full z-10 mt-2 rounded-2xl border p-2 ${
                                            isDaylight ? 'border-black/10 bg-white shadow-lg' : 'border-white/10 bg-[#141418] shadow-xl'
                                        }`}
                                    >
                                        <div className="flex flex-col">
                                            {suggestions.map((suggestion, index) => (
                                                <button
                                                    key={`${suggestion.kind}:${suggestion.value}:${index}`}
                                                    type="button"
                                                    onMouseDown={event => event.preventDefault()}
                                                    onMouseEnter={() => setActiveSuggestion(index)}
                                                    onClick={() => pickSuggestion(suggestion)}
                                                    className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                                                        index === activeSuggestion ? (isDaylight ? 'bg-black/10' : 'bg-white/10') : (isDaylight ? 'hover:bg-black/5' : 'hover:bg-white/5')
                                                    }`}
                                                >
                                                    {suggestion.kind === 'singer'
                                                        ? <User size={15} className="shrink-0 opacity-55" />
                                                        : <Music size={15} className="shrink-0 opacity-55" />}
                                                    <span className="truncate">{suggestion.value}</span>
                                                    {suggestion.detail && (
                                                        <span className="truncate text-xs opacity-50">{suggestion.detail}</span>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </form>
                            <button
                                type="button"
                                onClick={onClose}
                                className={`rounded-full p-3 ${
                                    isDaylight ? 'bg-black/5 hover:bg-black/10' : 'bg-white/10 hover:bg-white/15'
                                }`}
                                aria-label={t('ui.backToHome')}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <nav className="flex gap-2 overflow-x-auto pb-1">
                            {sources.map(source => (
                                <button
                                    type="button"
                                    key={source}
                                    onClick={() => {
                                        if (source !== searchSourceTab) {
                                            runSearch(source);
                                        }
                                    }}
                                    className={`rounded-full px-4 py-2 text-xs font-medium transition-colors ${
                                        source === searchSourceTab
                                            ? 'shadow-sm'
                                            : isDaylight
                                                ? 'bg-black/5 text-black/60 hover:bg-black/10'
                                                : 'bg-white/5 text-white/60 hover:bg-white/10'
                                    }`}
                                    style={source === searchSourceTab ? {
                                        backgroundColor: theme.accentColor,
                                        color: theme.backgroundColor,
                                    } : undefined}
                                >
                                    {getSourceLabel(source)}
                                </button>
                            ))}
                        </nav>
                    </header>

                    {collections.length > 0 && (
                        <div className="mx-auto mt-3 w-full max-w-5xl shrink-0">
                            <div className="flex gap-3 overflow-x-auto pb-2">
                                {collections.map(collection => (
                                    <button
                                        key={collectionKey(collection)}
                                        type="button"
                                        onClick={() => onOpenCollection(collection)}
                                        className={`w-28 shrink-0 overflow-hidden rounded-2xl border p-2 text-left transition-colors ${
                                            isDaylight ? 'border-black/10 bg-black/[0.04] hover:bg-black/[0.08]' : 'border-white/10 bg-white/[0.05] hover:bg-white/[0.09]'
                                        }`}
                                    >
                                        {collection.coverUrl ? (
                                            <img
                                                src={collection.coverUrl}
                                                alt=""
                                                loading="lazy"
                                                className="aspect-square w-full rounded-xl object-cover"
                                            />
                                        ) : (
                                            <div className={`aspect-square w-full rounded-xl ${
                                                isDaylight ? 'bg-black/10' : 'bg-white/10'
                                            }`} />
                                        )}
                                        <p className="mt-2 truncate text-xs font-medium">{collection.name}</p>
                                        <p className="truncate text-[11px] opacity-50">
                                            {collection.type === 'album' ? t('search.album') : t('search.playlist')}
                                            {collection.trackCount ? ` · ${collection.trackCount}` : ''}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="mx-auto mt-3 min-h-0 w-full max-w-5xl flex-1">
                        {isSearching ? (
                            <div className="flex h-full items-center justify-center">
                                <Loader2 className="h-9 w-9 animate-spin opacity-45" />
                            </div>
                        ) : searchError && results.length === 0 ? (
                            <div className="flex h-full flex-col items-center justify-center gap-3 text-center opacity-65">
                                <AlertCircle size={32} />
                                <p>{t('search.error')}</p>
                                <button
                                    type="button"
                                    onClick={() => runSearch()}
                                    className="rounded-full border border-current/15 px-4 py-2 text-sm"
                                >
                                    {t('search.retry')}
                                </button>
                            </div>
                        ) : results.length === 0 ? (
                            <div className="flex h-full items-center justify-center text-sm opacity-50">
                                {t('home.noResults')}
                            </div>
                        ) : (
                            <div className="flex h-full flex-col">
                                <div className="min-h-0 flex-1">
                                    <SearchResultsList
                                        tracks={results}
                                        scrollTop={scrollTop}
                                        isDaylight={isDaylight}
                                        onScrollTopChange={setSearchScrollTop}
                                        onPlayTrack={onPlayTrack}
                                        onAddTrackToQueue={onAddTrackToQueue}
                                        onOpenArtist={onOpenArtist}
                                        onOpenAlbum={onOpenAlbum}
                                    />
                                </div>
                                {searchError ? (
                                    <div className="flex shrink-0 items-center justify-center gap-3 py-3 text-sm">
                                        <span className="opacity-60">{t('search.error')}</span>
                                        <button
                                            type="button"
                                            disabled={isLoadingMore}
                                            onClick={onLoadMore}
                                            className="rounded-full border border-current/15 px-4 py-2 disabled:opacity-50"
                                        >
                                            {t('search.retry')}
                                        </button>
                                    </div>
                                ) : hasMore && (
                                    <div className="flex shrink-0 justify-center py-3">
                                        <button
                                            type="button"
                                            disabled={isLoadingMore}
                                            onClick={onLoadMore}
                                            className={`rounded-full border px-5 py-2 text-sm disabled:opacity-50 ${
                                                isDaylight
                                                    ? 'border-black/10 bg-black/5 hover:bg-black/10'
                                                    : 'border-white/10 bg-white/5 hover:bg-white/10'
                                            }`}
                                        >
                                            {isLoadingMore ? t('localMusic.searching') : t('home.loadMore')}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </motion.section>
            )}
        </AnimatePresence>
    );
};

export default SearchWorkspace;
