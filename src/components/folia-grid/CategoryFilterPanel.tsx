import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ListFilter, X } from 'lucide-react';
import type { ProviderSongListCategoryGroup } from '../../types/onlineMusic';
import { gridChromeClassesFor } from './GridViewTabs';
import { useReducedMotionFor } from '../../hooks/useReducedMotionFor';

// src/components/folia-grid/CategoryFilterPanel.tsx
//
// 歌单广场的分类筛选。两级：组（语种/流派/主题/心情/场景）→ 组内细分项。
// 视觉上完全复用首页胶囊那一套词汇（rounded-full + 毛玻璃 + 发丝分隔线），
// 不引入任何新元素；坐在 actions 那行下方，跟「换一批」并列而不抢位。

export interface CategorySelection {
    groupLabel: string;
    itemId: string;
    itemLabel: string;
}

interface CategoryFilterPanelProps {
    groups: ProviderSongListCategoryGroup[];
    isDaylight: boolean;
    selected: CategorySelection | null;
    onSelect: (selection: CategorySelection | null) => void;
    onClose: () => void;
}

export const CategoryFilterPanel: React.FC<CategoryFilterPanelProps> = ({
    groups,
    isDaylight,
    selected,
    onSelect,
    onClose,
}) => {
    const { t } = useTranslation();
    const chrome = gridChromeClassesFor(isDaylight);
    const calm = useReducedMotionFor('uiMicroMotion');
    const [activeGroupId, setActiveGroupId] = useState<string | null>(
        () => groups.find(group => group.items.some(item => item.id === selected?.itemId))?.id ?? groups[0]?.id ?? null,
    );
    const panelRef = useRef<HTMLDivElement>(null);

    // 面板开着时点外面收起。只在挂载期间生效，关闭即移除，不给全局留监听。
    useEffect(() => {
        if (!panelRef.current) return undefined;
        const handlePointerDown = (event: MouseEvent) => {
            const target = event.target as Node | null;
            if (target && !panelRef.current?.contains(target)) onClose();
        };
        // 延迟一帧再挂：打开时那一下点击不该立刻把它关掉。
        const frame = requestAnimationFrame(() => window.addEventListener('mousedown', handlePointerDown));
        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener('mousedown', handlePointerDown);
        };
    }, [onClose]);

    // Esc 收起同样只在这个面板开着时有效（父级 Esc 走自己的返回链路，这里不抢）。
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape' || event.repeat) return;
            event.stopPropagation();
            onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const activeGroup = useMemo(
        () => groups.find(group => group.id === activeGroupId) ?? null,
        [activeGroupId, groups],
    );

    if (groups.length === 0) return null;

    return (
        <motion.div
            ref={panelRef}
            initial={calm ? undefined : { opacity: 0, y: -6 }}
            animate={calm ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            data-ponder-panel-category
            className={`pointer-events-auto absolute left-1/2 top-full z-20 mt-2 w-[min(92vw,44rem)] -translate-x-1/2 rounded-2xl border p-3 shadow-2xl backdrop-blur-xl ${
                isDaylight ? 'border-black/10 bg-white/85' : 'border-white/10 bg-[#141418]/90'
            }`}
        >
            <div className="mb-2 flex items-center justify-between">
                <span className={`text-xs font-medium ${chrome.softText}`}>{t('home.categoryTitle')}</span>
                <div className="flex items-center gap-1">
                    {selected && (
                        <button
                            type="button"
                            onClick={() => onSelect(null)}
                            className={`rounded-full px-2.5 py-1 text-[11px] transition-colors ${chrome.softText} hover:opacity-80`}
                        >
                            {t('home.categoryClear')}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label={t('ui.close')}
                        className={`rounded-full p-1 transition-colors ${chrome.softText} hover:opacity-80`}
                    >
                        <X size={13} />
                    </button>
                </div>
            </div>

            {/* 第一行：分组胶囊 */}
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <button
                    type="button"
                    onClick={() => onSelect(null)}
                    className={`flex h-6 items-center rounded-full px-2.5 text-[11px] font-medium transition-colors ${
                        !selected ? chrome.strongText : chrome.softText
                    } ${chrome.pill}`}
                >
                    {t('home.categoryAll')}
                </button>
                {groups.map(group => {
                    const isActive = activeGroupId === group.id;
                    const hasSelection = group.items.some(item => item.id === selected?.itemId);
                    return (
                        <button
                            key={group.id}
                            type="button"
                            onClick={() => setActiveGroupId(group.id)}
                            className={`flex h-6 items-center rounded-full px-2.5 text-[11px] font-medium transition-colors ${
                                isActive ? chrome.strongText : chrome.softText
                            } ${chrome.pill}`}
                        >
                            {group.label}
                            {hasSelection && <span className="ml-1 opacity-70">·</span>}
                        </button>
                    );
                })}
            </div>

            {/* 第二行：当前组的细分项。两行之间用发丝线分隔，跟 tab 胶囊里的分隔线同一规格。 */}
            <div className={`flex flex-wrap items-center gap-1.5 border-t pt-2 ${isDaylight ? "border-black/10" : "border-white/10"}`}>
                {(activeGroup?.items ?? []).map(item => {
                    const isActive = selected?.itemId === item.id;
                    return (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => onSelect(
                                isActive
                                    ? null
                                    : { groupLabel: activeGroup?.label ?? '', itemId: item.id, itemLabel: item.label },
                            )}
                            className={`flex h-6 items-center rounded-full px-2.5 text-[11px] font-medium transition-colors ${
                                isActive ? chrome.strongText : chrome.softText
                            } ${chrome.pill}`}
                        >
                            {item.label}
                        </button>
                    );
                })}
            </div>
        </motion.div>
    );
};

// 由调用侧决定分隔线色：面板自身不复制一套主题判断。
const dividerClass = 'border-current/10';

export interface CategoryFilterButtonProps {
    isDaylight: boolean;
    open: boolean;
    selectedLabel: string | null;
    onClick: () => void;
}

/** actions 行里那个入口胶囊。图标 + 「分类」（选中后显示选中的那一项）。 */
export const CategoryFilterButton: React.FC<CategoryFilterButtonProps> = ({
    isDaylight,
    open,
    selectedLabel,
    onClick,
}) => {
    const { t } = useTranslation();
    const chrome = gridChromeClassesFor(isDaylight);
    return (
        <button
            type="button"
            onClick={onClick}
            title={t('home.categoryTitle')}
            className={`flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-medium backdrop-blur-md transition-colors ${chrome.pill} ${
                open || selectedLabel ? chrome.strongText : chrome.softText
            }`}
        >
            <ListFilter size={13} />
            <span className="whitespace-nowrap">{selectedLabel ?? t('home.categoryTitle')}</span>
        </button>
    );
};
