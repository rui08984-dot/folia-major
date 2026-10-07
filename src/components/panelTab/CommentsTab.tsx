import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle, Loader2, ThumbsUp, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SongResult } from '../../types';
import type { ProviderComment } from '../../types/onlineMusic';
import { omni } from '../../services/onlineMusic/omni';

// src/components/panelTab/CommentsTab.tsx
//
// 播放面板的「评论」tab：只读展示当前这首歌的在线评论。
// 数据全走 omni（铁律：面板不直连 provider）。三家形状已在各自 provider 正规化成 ProviderComment，
// 这里只管渲染。分页用 offset 累加，「加载更多」追加到列表尾部。
// QQ 匿名回空（需登录态）——空态文案要区分「没有评论」和「登录后可见」吗？不能：provider 层
// 已经把两者都归一成空数组，UI 无从分辨，也不该猜。统一显示「还没有评论」，登录后自然有。

const PAGE_SIZE = 20;

interface CommentsTabProps {
    song: SongResult;
    isDaylight?: boolean;
}

const CommentsTab: React.FC<CommentsTabProps> = ({ song, isDaylight = false }) => {
    const { t } = useTranslation();
    const [comments, setComments] = useState<ProviderComment[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [error, setError] = useState(false);
    const offsetRef = useRef(0);
    // 换歌时丢弃上一首的在途结果，避免慢响应把旧歌的评论盖到新歌上。
    const requestSeqRef = useRef(0);

    const textPrimary = isDaylight ? 'text-black/80' : 'text-white/85';
    const textSecondary = isDaylight ? 'text-black/45' : 'text-white/45';
    const cardBg = isDaylight ? 'bg-black/[0.03]' : 'bg-white/[0.04]';
    const hotBg = isDaylight ? 'bg-amber-500/15 text-amber-700' : 'bg-amber-400/15 text-amber-300';

    const fetchPage = useCallback(async (offset: number, replace: boolean) => {
        const seq = ++requestSeqRef.current;
        if (replace) { setLoading(true); setError(false); } else { setLoadingMore(true); }
        try {
            const page = await omni.getSongComments(song, { limit: PAGE_SIZE, offset });
            if (seq !== requestSeqRef.current) return;
            offsetRef.current = page.nextOffset;
            setHasMore(page.hasMore);
            setComments(prev => (replace ? page.items : [...prev, ...page.items]));
        } catch {
            if (seq !== requestSeqRef.current) return;
            if (replace) { setComments([]); setError(true); }
        } finally {
            if (seq === requestSeqRef.current) { setLoading(false); setLoadingMore(false); }
        }
    }, [song]);

    useEffect(() => {
        offsetRef.current = 0;
        setComments([]);
        setHasMore(false);
        void fetchPage(0, true);
    }, [fetchPage, song.id]);

    if (loading) {
        return (
            <div className="flex items-center justify-center gap-2 py-10">
                <Loader2 size={16} className="animate-spin opacity-60" />
                <span className={`text-sm ${textSecondary}`}>{t('panel.commentsLoading')}</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 py-10">
                <span className={`text-sm ${textSecondary}`}>{t('panel.commentsError')}</span>
                <button
                    type="button"
                    onClick={() => void fetchPage(0, true)}
                    className={`rounded-full px-3 py-1 text-xs ${cardBg} ${textPrimary} transition-colors hover:opacity-80`}
                >
                    {t('panel.commentsRetry')}
                </button>
            </div>
        );
    }

    if (comments.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center gap-2 py-10">
                <MessageCircle size={20} className={textSecondary} />
                <span className={`text-sm ${textSecondary}`}>{t('panel.commentsEmpty')}</span>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2 p-1 max-h-[52vh] overflow-y-auto">
            {comments.map((comment, index) => (
                <div
                    key={`${comment.id}-${index}`}
                    className={`rounded-xl p-3 ${cardBg}`}
                >
                    <div className="flex items-center gap-2 mb-1.5">
                        {comment.avatarUrl ? (
                            <img src={comment.avatarUrl} alt="" className="h-6 w-6 rounded-full object-cover shrink-0" loading="lazy" />
                        ) : (
                            <div className={`h-6 w-6 rounded-full ${cardBg} shrink-0`} />
                        )}
                        <span className={`text-xs font-medium truncate ${textPrimary}`}>{comment.userName}</span>
                        {comment.isHot && (
                            <span className={`rounded px-1.5 py-0.5 text-[10px] shrink-0 ${hotBg}`}>{t('panel.commentsHot')}</span>
                        )}
                    </div>
                    <p className={`text-sm leading-relaxed whitespace-pre-wrap break-words ${textPrimary}`}>{comment.content}</p>
                    <div className={`mt-1.5 flex items-center gap-3 text-[11px] ${textSecondary}`}>
                        {typeof comment.likedCount === 'number' && (
                            <span className="flex items-center gap-1"><ThumbsUp size={11} />{comment.likedCount}</span>
                        )}
                        {comment.timeStr && <span>{comment.timeStr}</span>}
                        {comment.ipLocation && <span className="flex items-center gap-0.5"><MapPin size={10} />{comment.ipLocation}</span>}
                    </div>
                </div>
            ))}
            {hasMore && (
                <button
                    type="button"
                    disabled={loadingMore}
                    onClick={() => void fetchPage(offsetRef.current, false)}
                    className={`mx-auto my-1 flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs ${cardBg} ${textPrimary} transition-opacity disabled:opacity-50`}
                >
                    {loadingMore && <Loader2 size={12} className="animate-spin" />}
                    {t('panel.commentsLoadMore')}
                </button>
            )}
        </div>
    );
};

export default CommentsTab;
