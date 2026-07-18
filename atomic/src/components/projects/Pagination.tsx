import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';

export default function Pagination({
  page, total, pageSize, onChange,
}: {
  page: number; total: number; pageSize: number; onChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;
  return (
    <div className="projects-pagination">
      <button
        type="button"
        className="projects-pagination-btn"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
      >
        <IconChevronLeft size={14} />
      </button>
      <span className="projects-pagination-label">{page} / {totalPages}</span>
      <button
        type="button"
        className="projects-pagination-btn"
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
      >
        <IconChevronRight size={14} />
      </button>
    </div>
  );
}
