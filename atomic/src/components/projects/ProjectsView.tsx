import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import '../books/books.css'; // modal thêm/sửa (.books-modal-*) dùng chung với Books tab
import './projects.css';
import { format } from 'date-fns';
import { useSmoothScroll } from '../../hooks/useSmoothScroll';
import {
  IconPlus,
  IconX,
  IconSearch,
  IconChevronDown,
  IconChevronLeft,
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

  // Danh sách tag luôn đầy đủ, không ẩn theo status/year filter và không phân trang
  // — chỉ số đếm (project_count) trên mỗi tag thay đổi theo filter đang chọn.
  // Thứ tự cố định theo lúc tạo (id tăng dần, đã sort ở SQL), không đổi theo
  // last_activity như lưới folder chính (folder chính có phân trang riêng).
  const filteredTagFolders = useMemo(
    () => folderTags.filter((f) => !tagSearch || f.name.toLowerCase().includes(tagSearch.toLowerCase())),
    [folderTags, tagSearch]
  );

  // Số đếm trên tab "Tất cả" = số dự án khớp năm + trạng thái đang lọc
  const filteredCount = statusFilter === 'in_progress'
    ? yearStats.inProgress
    : statusFilter === 'completed'
    ? yearStats.completed
    : yearStats.total;

  const summaryText = yearStats.total === 0
    ? copy.totalCount(0)
    : [
        copy.totalCount(yearStats.total),
        `${yearStats.inProgress} ${copy.statusInProgress.toLowerCase()}`,
        `${yearStats.completed} ${copy.statusCompleted.toLowerCase()}`,
      ].join(' · ');

  const emptyProjectsText = searchQuery ? copy.emptySearch : (viewAllProjects ? copy.emptyAll : copy.emptyItems);

  function renderTools(folderName: string) {
    return (
      <div className="pj-tools">
        <div className="pj-search">
          <IconSearch size={14} />
          <input
            placeholder={copy.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            spellCheck={false}
          />
          {searchQuery && (
            <button
              type="button"
              className="pj-search-clear"
              onClick={() => { setSearchQuery(''); setProjectPage(1); loadProjects(category, folderName, statusFilter, yearFilter, '', sortBy, 1); }}
            >
              <IconX size={12} />
            </button>
          )}
        </div>
        <label className="pj-sort">
          <span className="pj-sort-label">{t.projects.sortBy}</span>
          <select
            className="pj-sort-select"
            value={sortBy}
            onChange={(e) => { setSortBy(e.target.value as SortBy); setProjectPage(1); }}
          >
            <option value="date">{t.projects.sortDate}</option>
            <option value="title">{t.projects.sortTitle}</option>
            <option value="status">{t.projects.sortStatus}</option>
          </select>
        </label>
      </div>
    );
  }

  function renderProjects(viewKey: string) {
    return (
      <div key={viewKey} className="pj-content">
        {projects.length === 0 ? (
          <p className="pj-empty">{emptyProjectsText}</p>
        ) : (
          <>
            <div className="pj-grid">
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
    );
  }

  return (
    <div className="pj-wrap">
      <nav className="pj-sections">
        {(['product', 'figma', 'piano'] as ProjectCategory[]).map((cat) => (
          <button
            key={cat}
            type="button"
            className={`pj-section-tab${category === cat ? ' active' : ''}`}
            onClick={() => handleCategoryChange(cat)}
          >
            {CATEGORY_TAB_ICON[cat]}
            {t.projects.categoryLabels[cat]}
          </button>
        ))}
      </nav>

      <div className="pj-body">
        {/* ── Cột lọc ── */}
        <aside ref={sidebarRef} className="pj-rail">
          <section key={`status-${category}`} className="pj-rail-section pj-rail-anim">
            <div className="pj-rail-label">{t.projects.statusLabel}</div>
            <button
              type="button"
              className={`pj-rail-item${statusFilter === 'all' ? ' active' : ''}`}
              onClick={() => handleStatusFilter('all')}
            >
              <span className="pj-status-dot" />
              <span className="pj-rail-name">{t.projects.statusAll}</span>
              <span className="pj-rail-count">{stats.total}</span>
            </button>
            <button
              type="button"
              className={`pj-rail-item${statusFilter === 'in_progress' ? ' active' : ''}`}
              onClick={() => handleStatusFilter('in_progress')}
            >
              <span className="pj-status-dot status-in_progress" />
              <span className="pj-rail-name">{copy.statusInProgress}</span>
              <span className="pj-rail-count">{stats.inProgress}</span>
            </button>
            <button
              type="button"
              className={`pj-rail-item${statusFilter === 'completed' ? ' active' : ''}`}
              onClick={() => handleStatusFilter('completed')}
            >
              <span className="pj-status-dot status-completed" />
              <span className="pj-rail-name">{copy.statusCompleted}</span>
              <span className="pj-rail-count">{stats.completed}</span>
            </button>
          </section>

          {years.length > 0 && (
            <section className="pj-rail-section">
              <div className="pj-rail-label">{t.projects.byYear}</div>
              <div
                key={`years-${category}`}
                ref={yearListRef}
                className={`pj-year-list${years.length > YEAR_LIST_VISIBLE ? ' collapsible' : ''}${yearListExpanded ? ' expanded' : ''}`}
                style={{ maxHeight: yearListExpanded ? yearListFullHeight : (yearListCollapsedHeight ?? yearListFullHeight) }}
              >
                {years.map(({ year, count }) => (
                  <button
                    key={year}
                    type="button"
                    className={`pj-rail-item${yearFilter === year ? ' active' : ''}`}
                    onClick={() => handleYearFilter(year)}
                  >
                    <span className="pj-rail-name pj-rail-year">{year}</span>
                    <span className="pj-rail-count">{count}</span>
                  </button>
                ))}
              </div>
              {years.length > YEAR_LIST_VISIBLE && (
                <button
                  type="button"
                  className="pj-rail-more"
                  onClick={() => setYearListExpanded((v) => !v)}
                >
                  {yearListExpanded ? t.projects.seeLess : t.projects.seeMore}
                  <IconChevronDown size={12} className={`pj-rail-more-chevron${yearListExpanded ? ' open' : ''}`} />
                </button>
              )}
            </section>
          )}

          {folderTags.length > 0 && (
            <section className="pj-rail-section">
              <div className="pj-rail-label">{t.calendar.filterTags}</div>
              <input
                className="pj-rail-search"
                type="text"
                placeholder={t.calendar.filterTagSearch}
                value={tagSearch}
                onChange={(e) => setTagSearch(e.target.value)}
                spellCheck={false}
              />
              <div key={`tags-${category}`} className="pj-rail-list pj-rail-tags-anim">
                {filteredTagFolders.length === 0 ? (
                  <div className="pj-rail-empty">{t.tags.noTags}</div>
                ) : (
                  filteredTagFolders.map((folder) => (
                    <button
                      key={folder.id}
                      type="button"
                      className={`pj-rail-item${openFolder?.id === folder.id ? ' active' : ''}`}
                      onClick={() => handleOpenFolder(folder)}
                    >
                      <span className="pj-rail-name">{folder.name}</span>
                      <span className="pj-rail-count">{folder.project_count}</span>
                    </button>
                  ))
                )}
              </div>
            </section>
          )}
        </aside>

        {/* ── Trang chính ── */}
        <div ref={mainRef} className="pj-main">
          <div className="pj-page">
            {!openFolder ? (
              <>
                <header className="pj-head">
                  <div className="pj-head-main">
                    <span className="pj-eyebrow">
                      {t.projects.categoryLabels[category]}
                      {yearFilter !== null && ` · ${yearFilter}`}
                    </span>
                    <h1 className="pj-title">{copy.pageTitle}</h1>
                    <p className="pj-subtitle">{summaryText}</p>
                  </div>
                  {viewAllProjects ? (
                    <button type="button" className="pj-btn-primary" onClick={() => setShowAddProjectModal(true)}>
                      <IconPlus size={15} />
                      {copy.addItem}
                    </button>
                  ) : (
                    <button type="button" className="pj-btn-primary" onClick={() => setShowAddFolderModal(true)}>
                      <IconPlus size={15} />
                      {t.projects.addFolder}
                    </button>
                  )}
                </header>

                <div className="pj-toolbar">
                  <div className="pj-tabs">
                    <button
                      type="button"
                      className={`pj-tab${!viewAllProjects ? ' active' : ''}`}
                      onClick={() => setViewAllProjects(false)}
                    >
                      {t.projects.tabFolders}
                      <span className="pj-tab-count">{foldersTotal}</span>
                    </button>
                    <button
                      type="button"
                      className={`pj-tab${viewAllProjects ? ' active' : ''}`}
                      onClick={handleShowAllProjects}
                    >
                      {copy.tabAll}
                      <span className="pj-tab-count">{filteredCount}</span>
                    </button>
                  </div>
                  {viewAllProjects && renderTools('')}
                </div>

                {!viewAllProjects ? (
                  <div key={`${category}-${statusFilter}-${yearFilter ?? ''}`} className="pj-content">
                    {folderTags.length === 0 ? (
                      <div className="pj-empty">
                        <p>{t.projects.emptyFolders}</p>
                        <button type="button" className="pj-btn-primary" onClick={() => setShowAddFolderModal(true)}>
                          <IconPlus size={15} />
                          {t.projects.addFolder}
                        </button>
                      </div>
                    ) : folders.length === 0 ? (
                      <p className="pj-empty">{t.projects.emptyFolderResults}</p>
                    ) : (
                      <>
                        <div className="pj-grid">
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
                  renderProjects(`all-${statusFilter}-${yearFilter ?? ''}`)
                )}
              </>
            ) : (
              <>
                <header className="pj-head">
                  <div className="pj-head-main">
                    <button type="button" className="pj-back" onClick={handleBack} title={t.projects.back}>
                      <IconChevronLeft size={13} />
                      {copy.pageTitle}
                    </button>
                    <h1 className="pj-title">{openFolder.name}</h1>
                    <p className="pj-subtitle">
                      {copy.folderCount(projectsTotal)}
                      {yearFilter !== null && ` · ${yearFilter}`}
                    </p>
                  </div>
                  <button type="button" className="pj-btn-primary" onClick={() => setShowAddProjectModal(true)}>
                    <IconPlus size={15} />
                    {copy.addItem}
                  </button>
                </header>

                <div className="pj-toolbar">{renderTools(openFolder.name)}</div>

                {renderProjects(`${openFolder.id}-${statusFilter}-${yearFilter ?? ''}`)}
              </>
            )}
          </div>
        </div>
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
  );
}
