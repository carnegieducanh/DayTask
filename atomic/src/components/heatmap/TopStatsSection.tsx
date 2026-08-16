import { useMemo } from 'react';
import { useT } from '../../i18n';
import { fmtMinutes } from './heatmapFormat';

export interface StatItem {
  key: string;
  name: string;
  color: string;
  tasks: number;
  minutes: number;
}

interface MergedStat {
  key: string;
  name: string;
  color: string;
  a: StatItem;
  b: StatItem;
}

function statValue(item: StatItem, mode: 'count' | 'hours'): number {
  return mode === 'hours' ? item.minutes : item.tasks;
}

// Merges 2 periods into a union list (an item missing from one period shows as 0 there),
// sorted by combined value so the most prominent item in either period surfaces first.
function mergeForCompare(listA: StatItem[], listB: StatItem[], mode: 'count' | 'hours'): MergedStat[] {
  const zero = (item: StatItem): StatItem => ({ ...item, tasks: 0, minutes: 0 });
  const map = new Map<string, MergedStat>();
  listA.forEach((item) => map.set(item.key, { key: item.key, name: item.name, color: item.color, a: item, b: zero(item) }));
  listB.forEach((item) => {
    const existing = map.get(item.key);
    if (existing) existing.b = item;
    else map.set(item.key, { key: item.key, name: item.name, color: item.color, a: zero(item), b: item });
  });
  const merged = Array.from(map.values());
  merged.sort((x, y) => statValue(y.a, mode) + statValue(y.b, mode) - (statValue(x.a, mode) + statValue(x.b, mode)));
  return merged;
}

interface TopStatsSectionProps {
  title: string;
  mode: 'count' | 'hours';
  compare: boolean;
  onCompareChange: (compare: boolean) => void;
  categoriesLabel: string;
  tagsLabel: string;
  categoriesCurrent: StatItem[];
  categoriesPrev: StatItem[];
  tagsCurrent: StatItem[];
  tagsPrev: StatItem[];
  currentLabel: string;
  prevLabel: string;
}

export default function TopStatsSection({
  title, mode, compare, onCompareChange,
  categoriesLabel, tagsLabel,
  categoriesCurrent, categoriesPrev, tagsCurrent, tagsPrev,
  currentLabel, prevLabel,
}: TopStatsSectionProps) {
  const t = useT();

  const categoriesMerged = useMemo(
    () => mergeForCompare(categoriesCurrent, categoriesPrev, mode),
    [categoriesCurrent, categoriesPrev, mode]
  );
  const tagsMerged = useMemo(
    () => mergeForCompare(tagsCurrent, tagsPrev, mode),
    [tagsCurrent, tagsPrev, mode]
  );

  const maxCategoryValue = Math.max(...categoriesCurrent.map((s) => statValue(s, mode)), 1);
  const maxTagValue = Math.max(...tagsCurrent.map((s) => statValue(s, mode)), 1);
  const maxCategoryCompareValue = Math.max(...categoriesMerged.flatMap((m) => [statValue(m.a, mode), statValue(m.b, mode)]), 1);
  const maxTagCompareValue = Math.max(...tagsMerged.flatMap((m) => [statValue(m.a, mode), statValue(m.b, mode)]), 1);

  const renderSingleList = (list: StatItem[], max: number) => {
    if (list.length === 0) {
      return <div style={{ fontSize: '0.86rem', color: 'var(--text-muted)' }}>{t.heatmap.noTagData}</div>;
    }
    return (
      <div className="tag-stats-list">
        {list.map((stat) => (
          <div key={stat.key} className="tag-stat-row">
            <span className="tag-stat-name" style={{ color: stat.color }}>{stat.name}</span>
            <div className="tag-stat-bar-wrap">
              <div
                className="tag-stat-bar"
                style={{ width: `${Math.round((statValue(stat, mode) / max) * 100)}%`, background: stat.color }}
              />
            </div>
            <span className="tag-stat-count">{stat.tasks}</span>
            {stat.minutes > 0 && <span className="tag-stat-hours">{fmtMinutes(stat.minutes)}</span>}
          </div>
        ))}
      </div>
    );
  };

  // Grid (not per-row flex) so the value/delta columns line up across every item —
  // each column's width is driven by its widest cell across the whole list, not just its own row.
  const renderCompareList = (merged: MergedStat[], max: number) => {
    if (merged.length === 0) {
      return <div style={{ fontSize: '0.86rem', color: 'var(--text-muted)' }}>{t.heatmap.noTagData}</div>;
    }
    return (
      <div className="tag-stats-compare-grid">
        {merged.map((item, idx) => {
          const aVal = statValue(item.a, mode);
          const bVal = statValue(item.b, mode);
          const delta = aVal - bVal;
          const deltaLabel = mode === 'hours' ? fmtMinutes(Math.abs(delta)) : String(Math.abs(delta));
          const deltaClass = delta > 0 ? ' delta-up' : delta < 0 ? ' delta-down' : '';
          return (
            <div key={item.key} style={{ display: 'contents' }}>
              {idx > 0 && <div className="tsc-spacer" />}
              <span className="tag-stat-name tsc-span2" style={{ color: item.color }}>{item.name}</span>
              <div className="tag-stat-bar-wrap tag-stat-bar-wrap--sm">
                <div className="tag-stat-bar" style={{ width: `${Math.round((aVal / max) * 100)}%`, background: item.color }} />
              </div>
              <span className="tsc-value">{mode === 'hours' ? fmtMinutes(aVal) : aVal}</span>
              <span className={`tsc-delta tsc-span2${deltaClass}`}>
                {delta !== 0 ? `${delta > 0 ? '+' : '−'}${deltaLabel}` : ''}
              </span>
              <div className="tag-stat-bar-wrap tag-stat-bar-wrap--sm">
                <div className="tag-stat-bar tag-stat-bar--prev" style={{ width: `${Math.round((bVal / max) * 100)}%`, background: item.color }} />
              </div>
              <span className="tsc-value">{mode === 'hours' ? fmtMinutes(bVal) : bVal}</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div className="section-label">{title}</div>
        <div className="heatmap-mode-toggle">
          <button
            className={`heatmap-mode-btn${!compare ? ' heatmap-mode-btn--active' : ''}`}
            onClick={() => onCompareChange(false)}
          >
            {t.heatmap.singlePeriod}
          </button>
          <button
            className={`heatmap-mode-btn${compare ? ' heatmap-mode-btn--active' : ''}`}
            onClick={() => onCompareChange(true)}
          >
            {t.heatmap.comparePeriod}
          </button>
        </div>
      </div>

      {compare && (
        <div className="tag-stat-compare-legend">
          <span className="tag-stat-compare-legend-item">
            <i className="tag-stat-compare-dot tag-stat-compare-dot--a" />{currentLabel}
          </span>
          <span className="tag-stat-compare-legend-item">
            <i className="tag-stat-compare-dot tag-stat-compare-dot--b" />{prevLabel}
          </span>
        </div>
      )}

      <div className="heatmap-two-col">
        <div style={{ flex: '1 1 0', minWidth: 0 }}>
          <div className="section-label" style={{ marginBottom: 12 }}>{categoriesLabel}</div>
          {compare ? renderCompareList(categoriesMerged, maxCategoryCompareValue) : renderSingleList(categoriesCurrent, maxCategoryValue)}
        </div>
        <div style={{ flex: '1 1 0', minWidth: 0 }}>
          <div className="section-label" style={{ marginBottom: 12 }}>{tagsLabel}</div>
          {compare ? renderCompareList(tagsMerged, maxTagCompareValue) : renderSingleList(tagsCurrent, maxTagValue)}
        </div>
      </div>
    </div>
  );
}
