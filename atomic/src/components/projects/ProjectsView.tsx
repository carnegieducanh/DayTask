import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import '../books/books.css'; // .books-sidebar/.books-wrap dùng chung với Books tab
import './projects.css';
import { format } from 'date-fns';
import { useSmoothScroll } from '../../hooks/useSmoothScroll';
import {
  IconFolderCode,
  IconPlus,
  IconX,
  IconSearch,
  IconTag,
  IconChevronDown,
  IconClockHour4,
  IconCircleCheck,
  IconStack2,
  IconArrowLeft,
} from '@tabler/icons-react';
import type { Project, ProjectFolder, FolderTag, ProjectStatus, ProjectCategory, NewProject } from '../../types';
import {
  dbGetProjects,
  dbAddProject,
  dbUpdateProject,
  dbUpdateProjectCoverPosition,
  dbGetProjectsMissingCoverThumb,
  dbSetProjectCoverThumb,
  dbDeleteProject,
  dbGetProjectStats,
  dbGetYearsWithCounts,
  dbGetFolders,
  dbGetFolderTags,
  dbAddFolder,
  dbUpdateFolder,
  dbUpdateFolderCoverPosition,
  dbDeleteFolder,
  dbDeleteFolderByName,
  seedProjectsIfEmpty,
} from '../../store/projectsDb';
import { useT } from '../../i18n';
import { CATEGORY_TAB_ICON } from './icons';
import { resizeCoverThumbFromDataUrl } from './projectImageUtils';
import Pagination from './Pagination';
import FolderCard from './FolderCard';
import AddFolderModal from './AddFolderModal';
import ProjectCard from './ProjectCard';
import ProjectDetailModal from './ProjectDetailModal';
import AddProjectModal from './AddProjectModal';

type StatusFilter = 'all' | ProjectStatus;
type SortBy = 'date' | 'title' | 'status';

const YEAR_LIST_VISIBLE = 3;
const FOLDER_PAGE_SIZE = 12;
const PROJECT_PAGE_SIZE = 12;

export default function ProjectsView() {
  const t = useT();

  const [category, setCategory] = useState<ProjectCategory>('product');
  const [folders, setFolders] = useState<ProjectFolder[]>([]);
  const [foldersTotal, setFoldersTotal] = useState(0);
  const [folderPage, setFolderPage] = useState(1);
  const [folderTags, setFolderTags] = useState<FolderTag[]>([]);
  const [openFolder, setOpenFolder] = useState<{ id: number; name: string } | null>(null);
  const [viewAllProjects, setViewAllProjects] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsTotal, setProjectsTotal] = useState(0);
  const [projectPage, setProjectPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [yearFilter, setYearFilter] = useState<number | null>(new Date().getFullYear());
  const [tagSearch, setTagSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [years, setYears] = useState<{ year: number; count: number }[]>([]);
  const [yearListExpanded, setYearListExpanded] = useState(false);
  const [yearListCollapsedHeight, setYearListCollapsedHeight] = useState<number | undefined>(undefined);
  const [yearListFullHeight, setYearListFullHeight] = useState<number | undefined>(undefined);
  const [stats, setStats] = useState({ total: 0, inProgress: 0, completed: 0 });
  const [yearStats, setYearStats] = useState({ total: 0, inProgress: 0, completed: 0 });
  const [showAddFolderModal, setShowAddFolderModal] = useState(false);
  const [editingFolder, setEditingFolder] = useState<ProjectFolder | null>(null);
  const [showAddProjectModal, setShowAddProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [viewingProject, setViewingProject] = useState<Project | null>(null);
  const [pendingDeleteProject, setPendingDeleteProject] = useState<Project | null>(null);
  const [pendingDeleteFolder, setPendingDeleteFolder] = useState<ProjectFolder | null>(null);
  const [pendingDeleteFolderTag, setPendingDeleteFolderTag] = useState<{ name: string; category: ProjectCategory; undo: () => void } | null>(null);
  const [seeded, setSeeded] = useState(false);

  const mainRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const yearListRef = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deleteProjectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deleteFolderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deleteFolderTagTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seedStartedRef = useRef(false);
  const titleRowRef = useRef<HTMLDivElement>(null);
  const titleTabLabelRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [titleIndicatorStyle, setTitleIndicatorStyle] = useState<{ left: number; top: number; width: number } | null>(null);

  useSmoothScroll(mainRef);
  useSmoothScroll(sidebarRef);

  const loadStats = useCallback(async (cat: ProjectCategory) => {
    setStats(await dbGetProjectStats(cat));
  }, []);

  const loadYearStats = useCallback(async (cat: ProjectCategory, year: number | null) => {
    setYearStats(await dbGetProjectStats(cat, year ?? undefined));
  }, []);

  const loadYears = useCallback(async (cat: ProjectCategory, status: StatusFilter) => {
    setYears(await dbGetYearsWithCounts(cat, status === 'all' ? undefined : status));
  }, []);

  const loadFolders = useCallback(async (cat: ProjectCategory, status: StatusFilter, year: number | null, page: number) => {
    const onlyActive = status !== 'all' || year !== null;
    const res = await dbGetFolders({
      category: cat,
      status: status === 'all' ? undefined : status,
      year: year ?? undefined,
      onlyActive,
      limit: FOLDER_PAGE_SIZE,
      offset: (page - 1) * FOLDER_PAGE_SIZE,
    });
    if (res.items.length === 0 && page > 1 && res.total > 0) {
      setFolderPage(Math.max(1, Math.ceil(res.total / FOLDER_PAGE_SIZE)));
      return;
    }
    setFolders(res.items);
    setFoldersTotal(res.total);
  }, []);

  const loadFolderTags = useCallback(async (cat: ProjectCategory, status: StatusFilter, year: number | null) => {
    setFolderTags(await dbGetFolderTags({ category: cat, status: status === 'all' ? undefined : status, year: year ?? undefined }));
  }, []);

  const loadProjects = useCallback(async (
    cat: ProjectCategory,
    folderName: string,
    status: StatusFilter,
    year: number | null,
    search: string,
    sort: SortBy,
    page: number
  ) => {
    const res = await dbGetProjects({
      category: cat,
      folder: folderName,
      status: status === 'all' ? undefined : status,
      year: year ?? undefined,
      search,
      sortBy: sort,
      limit: PROJECT_PAGE_SIZE,
      offset: (page - 1) * PROJECT_PAGE_SIZE,
    });
    if (res.items.length === 0 && page > 1 && res.total > 0) {
      setProjectPage(Math.max(1, Math.ceil(res.total / PROJECT_PAGE_SIZE)));
      return;
    }
    setProjects(res.items);
    setProjectsTotal(res.total);
  }, []);

  useEffect(() => {
    if (seedStartedRef.current) return;
    seedStartedRef.current = true;
    seedProjectsIfEmpty().then(() => {
      setSeeded(true);
      backfillMissingCoverThumbs();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // One-time (per project) backfill: projects saved before cover_image_thumb existed, or
  // restored from an older backup, have cover_image but no thumb yet. Regenerate the thumb
  // client-side from the already-stored full-res cover — no re-upload needed. Cheap no-op
  // on every later mount since the WHERE clause only matches rows still missing a thumb.
  async function backfillMissingCoverThumbs() {
    const rows = await dbGetProjectsMissingCoverThumb();
    if (!rows.length) return;
    for (const row of rows) {
      try {
        const thumb = await resizeCoverThumbFromDataUrl(row.cover_image);
        await dbSetProjectCoverThumb(row.id, thumb);
      } catch {
        // unreadable image — leave thumb null, card falls back to the full-res cover
      }
    }
    await refreshAll();
  }

  useEffect(() => {
    if (!seeded) return;
    loadStats(category);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seeded, category]);

  useEffect(() => {
    if (!seeded) return;
    loadYearStats(category, yearFilter);
    loadYears(category, statusFilter);
    loadFolders(category, statusFilter, yearFilter, folderPage);
    loadFolderTags(category, statusFilter, yearFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seeded, category, statusFilter, yearFilter, folderPage]);

  useEffect(() => {
    if (!seeded || (!openFolder && !viewAllProjects)) return;
    loadProjects(category, openFolder ? openFolder.name : '', statusFilter, yearFilter, searchQuery, sortBy, projectPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seeded, category, openFolder, viewAllProjects, statusFilter, yearFilter, sortBy, projectPage]);

  function handleSearch(q: string) {
    setSearchQuery(q);
    setProjectPage(1);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      if (openFolder || viewAllProjects) loadProjects(category, openFolder ? openFolder.name : '', statusFilter, yearFilter, q, sortBy, 1);
    }, 300);
  }

  function handleOpenFolder(folder: { id: number; name: string }) {
    if (openFolder?.id === folder.id) {
      handleBack();
      return;
    }
    setOpenFolder(folder);
    setViewAllProjects(false);
    setSearchQuery('');
    setProjectPage(1);
  }

  function handleShowAllProjects() {
    setViewAllProjects(true);
    setSearchQuery('');
    setProjectPage(1);
  }

  function handleBack() {
    setOpenFolder(null);
    setViewAllProjects(false);
    setProjects([]);
    setSearchQuery('');
    setProjectPage(1);
  }

  function handleCategoryChange(next: ProjectCategory) {
    if (next === category) return;
    setCategory(next);
    setOpenFolder(null);
    setViewAllProjects(false);
    setProjects([]);
    setStatusFilter('all');
    setYearFilter(new Date().getFullYear());
    setSearchQuery('');
    setTagSearch('');
    setFolderPage(1);
    setProjectPage(1);
  }

  async function refreshAll() {
    await Promise.all([
      loadStats(category),
      loadYearStats(category, yearFilter),
      loadYears(category, statusFilter),
      loadFolders(category, statusFilter, yearFilter, folderPage),
      loadFolderTags(category, statusFilter, yearFilter),
      (openFolder || viewAllProjects) ? loadProjects(category, openFolder ? openFolder.name : '', statusFilter, yearFilter, searchQuery, sortBy, projectPage) : Promise.resolve(),
    ]);
  }

  async function handleSaveFolder(name: string, coverImage: string | null, coverPosition: string | null) {
    if (editingFolder) {
      await dbUpdateFolder(editingFolder.id, name, coverImage, coverPosition);
      setEditingFolder(null);
      if (openFolder && openFolder.id === editingFolder.id) {
        setOpenFolder({ ...openFolder, name });
      }
    } else {
      await dbAddFolder(name, coverImage, category, coverPosition);
      setShowAddFolderModal(false);
    }
    await Promise.all([
      loadFolders(category, statusFilter, yearFilter, folderPage),
      loadFolderTags(category, statusFilter, yearFilter),
    ]);
  }

  async function handleRepositionFolderCover(folder: ProjectFolder, position: string) {
    await dbUpdateFolderCoverPosition(folder.id, position);
    setFolders((prev) => prev.map((f) => (f.id === folder.id ? { ...f, cover_position: position } : f)));
  }

  async function commitDeleteFolder(folder: ProjectFolder) {
    await dbDeleteFolder(folder.id);
    setPendingDeleteFolder(null);
    await Promise.all([
      loadStats(category),
      loadYearStats(category, yearFilter),
      loadYears(category, statusFilter),
      loadFolders(category, statusFilter, yearFilter, folderPage),
      loadFolderTags(category, statusFilter, yearFilter),
    ]);
  }

  function handleDeleteFolder(folder: ProjectFolder) {
    if (deleteFolderTimerRef.current) clearTimeout(deleteFolderTimerRef.current);
    if (pendingDeleteFolder) commitDeleteFolder(pendingDeleteFolder);

    setFolders((prev) => prev.filter((f) => f.id !== folder.id));
    setFolderTags((prev) => prev.filter((f) => f.id !== folder.id));
    setPendingDeleteFolder(folder);
    if (openFolder && openFolder.id === folder.id) handleBack();

    deleteFolderTimerRef.current = setTimeout(() => commitDeleteFolder(folder), 4000);
  }

  function handleUndoDeleteFolder() {
    if (deleteFolderTimerRef.current) clearTimeout(deleteFolderTimerRef.current);
    if (!pendingDeleteFolder) return;
    loadFolders(category, statusFilter, yearFilter, folderPage);
    loadFolderTags(category, statusFilter, yearFilter);
    setPendingDeleteFolder(null);
  }

  async function handleAddProject(data: NewProject, coverPosition: string | null) {
    const p = await dbAddProject(data);
    if (p) {
      if (coverPosition) await dbUpdateProjectCoverPosition(p.id, coverPosition);
      setShowAddProjectModal(false);
      await refreshAll();
    }
  }

  async function handleUpdateProject(data: NewProject, coverPosition: string | null) {
    if (!editingProject) return;
    await dbUpdateProject(editingProject.id, data);
    await dbUpdateProjectCoverPosition(editingProject.id, coverPosition);
    setEditingProject(null);
    await refreshAll();
  }

  async function handleRepositionCover(project: Project, position: string) {
    await dbUpdateProjectCoverPosition(project.id, position);
    setProjects((prev) => prev.map((p) => (p.id === project.id ? { ...p, cover_position: position } : p)));
    setViewingProject((prev) => (prev && prev.id === project.id ? { ...prev, cover_position: position } : prev));
  }

  async function handleQuickStatusChange(project: Project, status: ProjectStatus) {
    const completed_date = status === 'completed' ? project.completed_date ?? format(new Date(), 'yyyy-MM-dd') : null;
    await dbUpdateProject(project.id, {
      title: project.title,
      category: project.category,
      status,
      start_date: project.start_date,
      completed_date,
      notes: project.notes ?? undefined,
      link_repo: project.link_repo ?? undefined,
      link_youtube: project.link_youtube ?? undefined,
      composer: project.composer ?? undefined,
      cover_image: project.cover_image,
      cover_image_thumb: project.cover_image_thumb,
      folders: project.folders,
    });
    setViewingProject((prev) => (prev && prev.id === project.id ? { ...prev, status, completed_date } : prev));
    await refreshAll();
  }

  async function commitDeleteProject(project: Project) {
    await dbDeleteProject(project.id);
    await Promise.all([
      loadStats(category),
      loadYearStats(category, yearFilter),
      loadYears(category, statusFilter),
      loadFolders(category, statusFilter, yearFilter, folderPage),
      loadFolderTags(category, statusFilter, yearFilter),
      (openFolder || viewAllProjects)
        ? loadProjects(category, openFolder ? openFolder.name : '', statusFilter, yearFilter, searchQuery, sortBy, projectPage)
        : Promise.resolve(),
    ]);
    setPendingDeleteProject(null);
  }

  function handleDeleteProject(project: Project) {
    if (deleteProjectTimerRef.current) clearTimeout(deleteProjectTimerRef.current);
    if (pendingDeleteProject) commitDeleteProject(pendingDeleteProject);

    setProjects((prev) => prev.filter((p) => p.id !== project.id));
    setPendingDeleteProject(project);

    deleteProjectTimerRef.current = setTimeout(() => commitDeleteProject(project), 4000);
  }

  function handleUndoDeleteProject() {
    if (deleteProjectTimerRef.current) clearTimeout(deleteProjectTimerRef.current);
    if (!pendingDeleteProject || (!openFolder && !viewAllProjects)) return;
    loadProjects(category, openFolder ? openFolder.name : '', statusFilter, yearFilter, searchQuery, sortBy, projectPage);
    setPendingDeleteProject(null);
  }

  async function commitDeleteFolderTag(name: string, cat: ProjectCategory) {
    await dbDeleteFolderByName(name, cat);
    setPendingDeleteFolderTag(null);
    await Promise.all([
      loadFolders(category, statusFilter, yearFilter, folderPage),
      loadFolderTags(category, statusFilter, yearFilter),
    ]);
  }

  function handleFolderTagDeleted(name: string, cat: ProjectCategory, undo: () => void) {
    if (deleteFolderTagTimerRef.current) clearTimeout(deleteFolderTagTimerRef.current);
    if (pendingDeleteFolderTag) commitDeleteFolderTag(pendingDeleteFolderTag.name, pendingDeleteFolderTag.category);

    setPendingDeleteFolderTag({ name, category: cat, undo });
    deleteFolderTagTimerRef.current = setTimeout(() => commitDeleteFolderTag(name, cat), 4000);
  }

  function handleUndoFolderTagDelete() {
    if (!pendingDeleteFolderTag) return;
    if (deleteFolderTagTimerRef.current) { clearTimeout(deleteFolderTagTimerRef.current); deleteFolderTagTimerRef.current = null; }
    pendingDeleteFolderTag.undo();
    setPendingDeleteFolderTag(null);
  }

  function handleStatusFilter(f: StatusFilter) {
    setStatusFilter(f);
    setFolderPage(1);
    setProjectPage(1);
  }

  function handleYearFilter(year: number) {
    setYearFilter((prev) => (prev === year ? null : year));
    setFolderPage(1);
    setProjectPage(1);
  }

  useLayoutEffect(() => {
    const el = yearListRef.current;
    if (!el) return;
    const items = Array.from(el.children) as HTMLElement[];
    const full = el.scrollHeight;
    const collapsed = items.length > YEAR_LIST_VISIBLE
      ? items[YEAR_LIST_VISIBLE - 1].offsetTop + items[YEAR_LIST_VISIBLE - 1].offsetHeight
      : full;
    setYearListFullHeight(full);
    setYearListCollapsedHeight(collapsed);
  }, [years]);

  useEffect(() => {
    setYearListExpanded(false);
  }, [category, statusFilter]);

  const copy = t.projects.categoryCopy[category];

  useLayoutEffect(() => {
    const row = titleRowRef.current;
    const label = titleTabLabelRefs.current[viewAllProjects ? 1 : 0];
    if (!row || !label) return;
    const rowRect = row.getBoundingClientRect();
    const labelRect = label.getBoundingClientRect();
    setTitleIndicatorStyle({ left: labelRect.left - rowRect.left, top: labelRect.bottom - rowRect.top - 2, width: labelRect.width });
  }, [viewAllProjects, copy.pageTitle, t.projects.viewAll]);

  // Danh sách tag luôn đầy đủ, không ẩn theo status/year filter và không phân trang
  // — chỉ số đếm (project_count) trên mỗi tag thay đổi theo filter đang chọn.
  // Thứ tự cố định theo lúc tạo (id tăng dần, đã sort ở SQL), không đổi theo
  // last_activity như lưới folder chính (folder chính có phân trang riêng).
  const filteredTagFolders = useMemo(
    () => folderTags.filter((f) => !tagSearch || f.name.toLowerCase().includes(tagSearch.toLowerCase())),
    [folderTags, tagSearch]
  );

  const headerSubText = useMemo(() => {
    if (statusFilter === 'in_progress') return copy.totalCount(yearStats.inProgress);
    if (statusFilter === 'completed') return copy.totalCount(yearStats.completed);
    return copy.totalCount(yearStats.total);
  }, [yearStats, copy, statusFilter]);

  const emptyProjectsText = searchQuery ? copy.emptySearch : (viewAllProjects ? copy.emptyAll : copy.emptyItems);

  return (
    <>
      <div className="projects-category-tabs">
        {(['product', 'figma', 'piano'] as ProjectCategory[]).map((cat) => (
          <button
            key={cat}
            className={`projects-category-tab${category === cat ? ' active' : ''}`}
            onClick={() => handleCategoryChange(cat)}
          >
            {CATEGORY_TAB_ICON[cat]}
            {t.projects.categoryLabels[cat]}
          </button>
        ))}
      </div>
      <div className="books-wrap">
      {/* ── Sidebar ── */}
      <div ref={sidebarRef} className="books-sidebar projects-sidebar">
        <div key={`status-${category}`} className="books-sb-section projects-sidebar-anim">
          <div className="books-sb-label">{t.nav.projects}</div>
          <button
            className={`books-sb-item${statusFilter === 'all' ? ' active' : ''}`}
            onClick={() => handleStatusFilter('all')}
          >
            <IconStack2 size={14} />
            {t.projects.statusAll}
            <span className="books-sb-count">{stats.total}</span>
          </button>
          <button
            className={`books-sb-item${statusFilter === 'in_progress' ? ' active' : ''}`}
            onClick={() => handleStatusFilter('in_progress')}
          >
            <IconClockHour4 size={14} />
            {copy.statusInProgress}
            <span className="books-sb-count">{stats.inProgress}</span>
          </button>
          <button
            className={`books-sb-item${statusFilter === 'completed' ? ' active' : ''}`}
            onClick={() => handleStatusFilter('completed')}
          >
            <IconCircleCheck size={14} />
            {copy.statusCompleted}
            <span className="books-sb-count">{stats.completed}</span>
          </button>
        </div>

        {years.length > 0 && (
          <div className="books-sb-section">
            <div className="books-sb-label">{t.projects.byYear}</div>
            <div
              key={`years-${category}`}
              ref={yearListRef}
              className={`projects-year-list${years.length > YEAR_LIST_VISIBLE ? ' collapsible' : ''}${yearListExpanded ? ' expanded' : ''}`}
              style={{ maxHeight: yearListExpanded ? yearListFullHeight : (yearListCollapsedHeight ?? yearListFullHeight) }}
            >
              {years.map(({ year, count }) => (
                <button
                  key={year}
                  className={`books-sb-item${yearFilter === year ? ' active' : ''}`}
                  onClick={() => handleYearFilter(year)}
                >
                  <span className="books-year-badge">{year}</span>
                  <span className="books-sb-count">{count}</span>
                </button>
              ))}
            </div>
            {years.length > YEAR_LIST_VISIBLE && (
              <button
                type="button"
                className="projects-year-list-toggle"
                onClick={() => setYearListExpanded((v) => !v)}
              >
                {yearListExpanded ? t.projects.seeLess : t.projects.seeMore}
                <IconChevronDown size={12} className={`projects-year-list-chevron${yearListExpanded ? ' open' : ''}`} />
              </button>
            )}
          </div>
        )}

        {folderTags.length > 0 && (
          <div className="books-sb-section">
            <div className="books-sb-label">{t.calendar.filterTags}</div>
            <div className="books-sb-tag-search-wrap">
              <IconSearch size={12} className="books-sb-tag-search-icon" />
              <input
                className="books-sb-tag-search"
                type="text"
                placeholder={t.calendar.filterTagSearch}
                value={tagSearch}
                onChange={(e) => setTagSearch(e.target.value)}
                spellCheck={false}
              />
            </div>
            <div key={`tags-${category}`} className="projects-tag-list-anim">
              <div className="books-sb-tag-list">
                {filteredTagFolders.length === 0 ? (
                  <div className="books-sb-tag-empty">{t.tags.noTags}</div>
                ) : (
                  filteredTagFolders.map((folder) => (
                    <button
                      key={folder.id}
                      className={`books-sb-item${openFolder?.id === folder.id ? ' active' : ''}`}
                      onClick={() => handleOpenFolder(folder)}
                    >
                      <IconTag size={13} />
                      <span className="books-sb-item-name">{folder.name}</span>
                      <span className="books-sb-count">{folder.project_count}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Main ── */}
      <div ref={mainRef} className="books-main projects-main">
        {!openFolder ? (
          <>
            <div className="books-header">
              <div>
                <div className="projects-title-row" ref={titleRowRef}>
                  <button
                    type="button"
                    className={`projects-title-tab${!viewAllProjects ? ' active' : ''}`}
                    onClick={() => setViewAllProjects(false)}
                  >
                    <span className="projects-title-tab-label" ref={(el) => { titleTabLabelRefs.current[0] = el; }}>{copy.pageTitle}</span>
                  </button>
                  <button
                    type="button"
                    className={`projects-title-tab${viewAllProjects ? ' active' : ''}`}
                    onClick={handleShowAllProjects}
                  >
                    <span className="projects-title-tab-label" ref={(el) => { titleTabLabelRefs.current[1] = el; }}>{t.projects.viewAll}</span>
                  </button>
                  {titleIndicatorStyle && (
                    <span
                      className="projects-title-indicator"
                      style={{
                        transform: `translate(${titleIndicatorStyle.left}px, ${titleIndicatorStyle.top}px)`,
                        width: titleIndicatorStyle.width,
                      }}
                    />
                  )}
                </div>
                <div className="books-header-sub">{viewAllProjects ? copy.totalCount(projectsTotal) : headerSubText}</div>
              </div>
              {viewAllProjects ? (
                <button className="books-btn-add" onClick={() => setShowAddProjectModal(true)}>
                  <IconPlus size={13} />
                  {copy.addItem}
                </button>
              ) : (
                <button className="books-btn-add" onClick={() => setShowAddFolderModal(true)}>
                  <IconPlus size={13} />
                  {t.projects.addFolder}
                </button>
              )}
            </div>

            {!viewAllProjects ? (
              <div key={`${category}-${statusFilter}-${yearFilter ?? ''}`} className="books-content-view">
                {folderTags.length === 0 ? (
                  <div className="books-empty-state">
                    <IconFolderCode size={36} className="books-empty-icon" />
                    <p className="books-empty-text">{t.projects.emptyFolders}</p>
                    <button className="books-btn-add" onClick={() => setShowAddFolderModal(true)}>
                      <IconPlus size={13} />
                      {t.projects.addFolder}
                    </button>
                  </div>
                ) : folders.length === 0 ? (
                  <div className="books-empty-state">
                    <IconFolderCode size={36} className="books-empty-icon" />
                    <p className="books-empty-text">{t.projects.emptyFolderResults}</p>
                  </div>
                ) : (
                  <>
                    <div className="projects-folder-grid">
                      {folders.map((folder) => (
                        <FolderCard
                          key={folder.id}
                          folder={folder}
                          onOpen={() => handleOpenFolder(folder)}
                          onEdit={() => setEditingFolder(folder)}
                          onDelete={() => handleDeleteFolder(folder)}
                          onRepositionCover={(position) => handleRepositionFolderCover(folder, position)}
                        />
                      ))}
                    </div>
                    <Pagination page={folderPage} total={foldersTotal} pageSize={FOLDER_PAGE_SIZE} onChange={setFolderPage} />
                  </>
                )}
              </div>
            ) : (
              <>
                <div className="books-toolbar">
                  <div className="books-search-wrap">
                    <IconSearch size={13} className="books-search-icon" />
                    <input
                      className="books-search-input"
                      placeholder={copy.searchPlaceholder}
                      value={searchQuery}
                      onChange={(e) => handleSearch(e.target.value)}
                      spellCheck={false}
                    />
                    {searchQuery && (
                      <button
                        className="books-search-clear"
                        onClick={() => { setSearchQuery(''); setProjectPage(1); loadProjects(category, '', statusFilter, yearFilter, '', sortBy, 1); }}
                      >
                        <IconX size={12} />
                      </button>
                    )}
                  </div>
                  <select
                    className="books-sort-select"
                    value={sortBy}
                    onChange={(e) => { setSortBy(e.target.value as SortBy); setProjectPage(1); }}
                  >
                    <option value="date">{t.projects.sortDate}</option>
                    <option value="title">{t.projects.sortTitle}</option>
                    <option value="status">{t.projects.sortStatus}</option>
                  </select>
                </div>

                <div key={`all-${statusFilter}-${yearFilter ?? ''}`} className="books-content-view">
                  {projects.length === 0 ? (
                    <div className="books-empty-state">
                      <IconFolderCode size={36} className="books-empty-icon" />
                      <p className="books-empty-text">{emptyProjectsText}</p>
                    </div>
                  ) : (
                    <>
                      <div className="projects-card-grid">
                        {projects.map((project) => (
                          <ProjectCard
                            key={project.id}
                            project={project}
                            onView={() => setViewingProject(project)}
                            onEdit={() => setEditingProject(project)}
                            onDelete={() => handleDeleteProject(project)}
                            onRepositionCover={(position) => handleRepositionCover(project, position)}
                          />
                        ))}
                      </div>
                      <Pagination page={projectPage} total={projectsTotal} pageSize={PROJECT_PAGE_SIZE} onChange={setProjectPage} />
                    </>
                  )}
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <div className="books-header">
              <div className="projects-header-title-group">
                <button className="icon-btn" onClick={handleBack} title={t.projects.back}>
                  <IconArrowLeft size={16} />
                </button>
                <div>
                  <div className="books-header-title">{openFolder.name}</div>
                  <div className="books-header-sub">{copy.folderCount(projectsTotal)}</div>
                </div>
              </div>
              <div className="books-header-actions">
                <button className="books-btn-add" onClick={() => setShowAddProjectModal(true)}>
                  <IconPlus size={13} />
                  {copy.addItem}
                </button>
              </div>
            </div>

            <div className="books-toolbar">
              <div className="books-search-wrap">
                <IconSearch size={13} className="books-search-icon" />
                <input
                  className="books-search-input"
                  placeholder={copy.searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  spellCheck={false}
                />
                {searchQuery && (
                  <button
                    className="books-search-clear"
                    onClick={() => { setSearchQuery(''); setProjectPage(1); loadProjects(category, openFolder.name, statusFilter, yearFilter, '', sortBy, 1); }}
                  >
                    <IconX size={12} />
                  </button>
                )}
              </div>
              <select
                className="books-sort-select"
                value={sortBy}
                onChange={(e) => { setSortBy(e.target.value as SortBy); setProjectPage(1); }}
              >
                <option value="date">{t.projects.sortDate}</option>
                <option value="title">{t.projects.sortTitle}</option>
                <option value="status">{t.projects.sortStatus}</option>
              </select>
            </div>

            <div key={`${openFolder.id}-${statusFilter}-${yearFilter ?? ''}`} className="books-content-view">
              {projects.length === 0 ? (
                <div className="books-empty-state">
                  <IconFolderCode size={36} className="books-empty-icon" />
                  <p className="books-empty-text">{emptyProjectsText}</p>
                </div>
              ) : (
                <>
                  <div className="projects-card-grid">
                    {projects.map((project) => (
                      <ProjectCard
                        key={project.id}
                        project={project}
                        onView={() => setViewingProject(project)}
                        onEdit={() => setEditingProject(project)}
                        onDelete={() => handleDeleteProject(project)}
                        onRepositionCover={(position) => handleRepositionCover(project, position)}
                      />
                    ))}
                  </div>
                  <Pagination page={projectPage} total={projectsTotal} pageSize={PROJECT_PAGE_SIZE} onChange={setProjectPage} />
                </>
              )}
            </div>
          </>
        )}
      </div>

      {showAddFolderModal && (
        <AddFolderModal category={category} onSave={handleSaveFolder} onClose={() => setShowAddFolderModal(false)} />
      )}

      {editingFolder && (
        <AddFolderModal category={editingFolder.category} onSave={handleSaveFolder} onClose={() => setEditingFolder(null)} initialFolder={editingFolder} />
      )}

      {showAddProjectModal && (
        <AddProjectModal
          category={category}
          onSave={handleAddProject}
          onClose={() => setShowAddProjectModal(false)}
          initialFolders={openFolder ? [openFolder.name] : undefined}
          onFolderDeleted={handleFolderTagDeleted}
        />
      )}

      {editingProject && (
        <AddProjectModal
          category={editingProject.category}
          onSave={handleUpdateProject}
          onClose={() => setEditingProject(null)}
          initialProject={editingProject}
          onFolderDeleted={handleFolderTagDeleted}
        />
      )}

      {viewingProject && (
        <ProjectDetailModal
          project={viewingProject}
          onClose={() => setViewingProject(null)}
          onEdit={() => { setEditingProject(viewingProject); setViewingProject(null); }}
          onDelete={() => { handleDeleteProject(viewingProject); setViewingProject(null); }}
          onStatusChange={(status) => handleQuickStatusChange(viewingProject, status)}
        />
      )}

      {pendingDeleteProject && (
        <div className="delete-toast" role="status">
          <span className="delete-toast-msg">{t.projects.deleted(pendingDeleteProject.title)}</span>
          <button className="delete-toast-undo" onClick={handleUndoDeleteProject}>{t.projects.undo}</button>
        </div>
      )}

      {pendingDeleteFolder && (
        <div className="delete-toast" role="status">
          <span className="delete-toast-msg">{t.projects.deletedFolder(pendingDeleteFolder.name)}</span>
          <button className="delete-toast-undo" onClick={handleUndoDeleteFolder}>{t.projects.undo}</button>
        </div>
      )}

      {pendingDeleteFolderTag && (
        <div className="delete-toast" role="status">
          <span className="delete-toast-msg">{t.toast.deleted(pendingDeleteFolderTag.name)}</span>
          <button className="delete-toast-undo" onClick={handleUndoFolderTagDelete}>{t.toast.undo}</button>
        </div>
      )}
      </div>
    </>
  );
}
