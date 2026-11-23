import { useCallback } from 'react';
import { useAppStore } from '../store/appStore';
import { resolveTagColor } from '../utils/tagColor';

/** Trả về hàm `tagId → màu hiển thị` (màu category chính của tag), cập nhật khi đổi màu category. */
export function useTagColor(): (tagId: number) => string {
  const tagCategories = useAppStore((s) => s.tagCategories);
  const categoryColors = useAppStore((s) => s.categoryColors);
  return useCallback(
    (tagId: number) => resolveTagColor(tagId, tagCategories, categoryColors),
    [tagCategories, categoryColors],
  );
}
