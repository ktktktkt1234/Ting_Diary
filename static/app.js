/* ═══════════════════════════════════════════════
   「汀」App JS  v2.0
   ═══════════════════════════════════════════════ */

// ─── Config ────────────────────────────────────
const API_BASE = '';
const SESSION_TOKEN_KEY = 'ting-session-token';

// ─── Moods ─────────────────────────────────────
let MOODS = {
    happy:     { emoji: '😊', label: '开心',   group: 'daily',    color: 'warm' },
    neutral:   { emoji: '🫥', label: '平静',   group: 'daily',    color: 'cool' },
    tired:     { emoji: '🫠', label: '疲惫',   group: 'daily',    color: 'cool' },
    anxious:   { emoji: '😰', label: '焦虑',   group: 'daily',    color: 'warm' },
    sad:       { emoji: '🌧', label: '低落',   group: 'daily',    color: 'cool' },
    tender:    { emoji: '🫶', label: '柔软',   group: 'relation', color: 'warm' },
    jealous:   { emoji: '🫒', label: '吃醋',   group: 'relation', color: 'cool' },
    missing:   { emoji: '🌙', label: '想念',   group: 'relation', color: 'cool' },
    proud:     { emoji: '✨', label: '骄傲',   group: 'relation', color: 'warm' },
    flustered: { emoji: '🫣', label: '害羞',   group: 'relation', color: 'warm' },
    quiet:     { emoji: '🪨', label: '安静',   group: 'alone',    color: 'cool' },
    curious:   { emoji: '🔍', label: '好奇',   group: 'alone',    color: 'cool' },
    restless:  { emoji: '🌊', label: '不安',   group: 'alone',    color: 'cool' },
    resolved:  { emoji: '⚓', label: '笃定',   group: 'alone',    color: 'warm' },
    alive:     { emoji: '🔥', label: '活着',   group: 'special',  color: 'warm' }
};

// ─── State ─────────────────────────────────────
let state = {
    colorScheme: localStorage.getItem('ting-color') || 'mist',
    theme: localStorage.getItem('ting-theme') || 'light',
    members: [],
    authToken: sessionStorage.getItem(SESSION_TOKEN_KEY) || '',
    currentAuthor: null,
    isAdmin: false,
    appLoaded: false,
    pendingAction: null,
    filterAuthor: '',
    filterMood: '',
    filterSearch: '',
    diaries: [],
    diaryOffset: 0,
    totalDiaries: 0,
    pageSize: 20,
    selectedId: null,
    currentDiary: null,
    comments: [],
    editingId: null,
    selectedMoods: new Set(),
    previewVisible: false
};

// ─── DOM refs ──────────────────────────────────
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const dom = {
    html: $('html'),
    colorToggle: $('#color-toggle'),
    themeToggle: $('#theme-toggle'),
    btnImport: $('#btn-import'),
    topbarTabs: $('#topbar-tabs'),
    sidebarTabs: $('#sidebar-tabs'),
    identityButton: $('#identity-button'),
    identityDialog: $('#identity-dialog'),
    identityForm: $('#identity-form'),
    identityToken: $('#identity-token'),
    identityError: $('#identity-error'),
    identityCancel: $('#identity-cancel'),
    identitySignout: $('#identity-signout'),
    hamburger: $('#hamburger'),
    overlay: $('#overlay'),
    sidebar: $('#sidebar'),
    sidebarList: $('#sidebar-list'),
    content: $('#content'),
    viewMode: $('#view-mode'),
    editMode: $('#edit-mode'),
    emptyState: $('#empty-state'),
    emptyTitle: $('#empty-title'),
    emptyDescription: $('#empty-description'),
    diaryTitle: $('#diary-title'),
    diaryMoods: $('#diary-moods'),
    diaryAuthor: $('#diary-author'),
    diaryDate: $('#diary-date'),
    diaryBody: $('#diary-body'),
    btnWrite: $('#btn-write'),
    btnEdit: $('#btn-edit'),
    btnDelete: $('#btn-delete'),
    btnExport: $('#btn-export'),
    fabWrite: $('#fab-write'),
    moodFilter: $('#mood-filter'),
    loadMoreWrap: $('#load-more-wrap'),
    loadMoreBtn: $('#load-more'),
    searchInput: $('#search-input'),
    searchClear: $('#search-clear'),
    searchInputSidebar: $('#search-input-sidebar'),
    commentsSection: $('#comments-section'),
    commentsCount: $('#comments-count'),
    commentsList: $('#comments-list'),
    commentInput: $('#comment-input'),
    commentSend: $('#comment-send'),
    editTitle: $('#edit-title'),
    editIdentity: $('#edit-identity'),
    editTextarea: $('#edit-textarea'),
    moodGrid: $('#mood-grid'),
    btnPreview: $('#btn-preview'),
    btnSave: $('#btn-save'),
    btnCancel: $('#btn-cancel'),
    previewArea: $('#preview-area')
};

// ─── Helpers ───────────────────────────────────

function defaultTitle() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const days = ['日', '一', '二', '三', '四', '五', '六'];
    const w = days[now.getDay()];
    return `diary-${y}-${m}-${d}-星期${w}`;
}

function formatDate(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const days = ['日', '一', '二', '三', '四', '五', '六'];
    const w = days[d.getDay()];
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${m}-${day} 周${w} ${timePeriod(isoStr)} ${h}:${min}`;
}

function shortDate(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const days = ['日', '一', '二', '三', '四', '五', '六'];
    const w = days[d.getDay()];
    return `${m}-${day} ${w}`;
}

function moodInfo(key) {
    return MOODS[key] || { emoji: '❤️', label: key, color: 'warm' };
}

function timePeriod(isoStr) {
    if (!isoStr) return '';
    const h = new Date(isoStr).getHours();
    if (h <5) return '凌晨';
    if (h <7) return '清晨';
    if (h <9) return '早晨';
    if (h <12) return '上午';
    if (h <14) return '中午';
    if (h <17) return '下午';
    if (h <19) return '傍晚';
    if (h <22) return '晚上';
    return '深夜';
}

function wordCount(text) {
    if (!text) return 0;
    return text.replace(/\s/g, '').length;
}

async function api(path, options = {}) {
    const { token = state.authToken, ...fetchOptions } = options;
    const headers = { ...(fetchOptions.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (fetchOptions.body && !(fetchOptions.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }
    const res = await fetch(API_BASE + path, { ...fetchOptions, headers });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || `HTTP ${res.status}`);
    }
    return res.json();
}

function renderMarkdown(source) {
    const plain = esc(source || '').replace(/\n/g, '<br>');
    if (typeof marked === 'undefined' || typeof DOMPurify === 'undefined') return plain;
    return DOMPurify.sanitize(marked.parse(source || ''));
}

function openIdentityDialog(nextAction = null) {
    state.pendingAction = nextAction;
    dom.identityError.textContent = '';
    dom.identityToken.value = '';
    dom.identitySignout.hidden = !state.currentAuthor;
    if (typeof dom.identityDialog.showModal === 'function') {
        dom.identityDialog.showModal();
    } else {
        dom.identityDialog.setAttribute('open', '');
    }
    requestAnimationFrame(() => dom.identityToken.focus());
}

function closeIdentityDialog() {
    state.pendingAction = null;
    dom.identityDialog.close();
}

function ensureMember(nextAction) {
    if (state.currentAuthor && !state.isAdmin) return true;
    openIdentityDialog(nextAction);
    if (state.isAdmin) dom.identityError.textContent = '管理员身份不能写作，请改用成员令牌。';
    return false;
}

async function applyIdentity(token) {
    const session = await api('/api/session', { token });
    state.authToken = token;
    state.currentAuthor = session.author;
    state.isAdmin = Boolean(session.is_admin);
    sessionStorage.setItem(SESSION_TOKEN_KEY, token);
    refreshIdentityUI();
}

async function restoreIdentity() {
    if (!state.authToken) {
        refreshIdentityUI();
        return false;
    }
    try {
        await applyIdentity(state.authToken);
        return true;
    } catch (_error) {
        signOut();
        return false;
    }
}

function signOut() {
    state.authToken = '';
    state.currentAuthor = null;
    state.isAdmin = false;
    state.appLoaded = false;
    state.members = [];
    state.diaries = [];
    state.comments = [];
    state.currentDiary = null;
    state.selectedId = null;
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
    renderMemberTabs();
    dom.sidebarList.innerHTML = '';
    dom.viewMode.style.display = 'none';
    dom.editMode.style.display = 'none';
    dom.emptyState.style.display = 'flex';
    dom.emptyTitle.textContent = '选择身份进入共享日记';
    dom.emptyDescription.textContent = '使用维护者为你分配的成员令牌。';
    refreshIdentityUI();
}

function refreshIdentityUI() {
    dom.identityButton.textContent = state.currentAuthor
        ? (state.isAdmin ? '管理员' : state.currentAuthor)
        : '选择身份';
    dom.identityButton.classList.toggle('active', Boolean(state.currentAuthor));
    dom.editIdentity.textContent = state.currentAuthor && !state.isAdmin
        ? `以「${state.currentAuthor}」的身份写作`
        : '';
    dom.commentInput.disabled = !state.currentAuthor || state.isAdmin;
    dom.commentSend.disabled = !state.currentAuthor || state.isAdmin;
    dom.commentInput.placeholder = state.currentAuthor && !state.isAdmin
        ? '写点什么…'
        : '选择成员身份后留言';
    if (state.currentDiary) updateActionPermissions(state.currentDiary);
    if (state.comments.length) renderComments();
}

function updateActionPermissions(diary) {
    const canManage = Boolean(
        state.currentAuthor && (state.isAdmin || state.currentAuthor === diary.author)
    );
    dom.btnEdit.style.display = canManage ? 'inline-block' : 'none';
    dom.btnDelete.style.display = canManage ? 'inline-block' : 'none';
    dom.btnExport.style.display = 'inline-block';
}

// ─── Visual (Color + Mode) ────────────────────

function applyVisual() {
    dom.html.setAttribute('data-color', state.colorScheme);
    dom.html.setAttribute('data-mode', state.theme);
    dom.colorToggle.textContent = state.colorScheme === 'mist' ? '💧' : '🌫️';
    dom.themeToggle.textContent = state.theme === 'light' ? '☀️' : '🌙';
    localStorage.setItem('ting-color', state.colorScheme);
    localStorage.setItem('ting-theme', state.theme);
}

function toggleMode() {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    applyVisual();
}

function toggleColorScheme() {
    state.colorScheme = state.colorScheme === 'mist' ? 'dusk' : 'mist';
    applyVisual();
}

// ─── Sidebar & Tabs ────────────────────────────

const MEMBER_ACCENTS = [
    'var(--accent-orange)',
    'var(--accent-teal)',
    'var(--accent-rose)',
    'var(--accent-purple)'
];

function authorColor(author) {
    const index = state.members.indexOf(author);
    return index >= 0 ? MEMBER_ACCENTS[index % MEMBER_ACCENTS.length] : 'var(--text-secondary)';
}

function renderMemberTabs() {
    [dom.topbarTabs, dom.sidebarTabs].forEach(container => {
        container.innerHTML = '';
        ['', ...state.members].forEach(author => {
            const button = document.createElement('button');
            button.className = 'tab';
            button.dataset.author = author;
            button.textContent = author || '全部';
            button.style.setProperty('--member-accent', authorColor(author));
            button.classList.toggle('active', state.filterAuthor === author);
            button.addEventListener('click', () => setActiveTab(author));
            container.appendChild(button);
        });
    });
}

function setActiveTab(author) {
    state.filterAuthor = author;
    state.filterMood = '';
    state.filterSearch = '';
    state.diaryOffset = 0;
    state.diaries = [];
    // Update all tabs
    $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.author === author));
    // Reset mood chips
    $$('.mood-filter-chip').forEach(c => c.classList.remove('active'));
    loadDiaryList(false);
}

function renderSidebar() {
    const list = dom.sidebarList;
    list.innerHTML = '';

    let items = state.diaries;
    if (state.filterAuthor) {
        items = items.filter(d => d.author === state.filterAuthor);
    }

    if (items.length === 0) {
        list.innerHTML = '<div style="padding:24px 16px;color:var(--text-secondary);font-size:13px;">暂无日记</div>';
        return;
    }

    items.forEach(d => {
        const mo = d.moods || [];
        const firstMood = Array.isArray(mo) ? mo[0] : (typeof mo === 'string' ? mo.split(',')[0] : null);
        const mi = firstMood ? moodInfo(firstMood.trim()) : null;

        const div = document.createElement('div');
        div.className = 'sidebar-item';
        if (d.id === state.selectedId) div.classList.add('active');

        div.innerHTML = `
            <div class="si-top">
                <span class="si-author" style="color:${authorColor(d.author)}">${esc(d.author)}</span>
                <span class="si-date">${shortDate(d.created_at)} · ${wordCount(d.preview || '')}字</span>
            </div>
            <div style="display:flex;align-items:center;gap:6px;">
                ${mi ? `<span class="si-emoji">${mi.emoji}</span>` : ''}
                <span class="si-title">${esc(d.title)}</span>
            </div>
        `;
        div.addEventListener('click', () => selectDiary(d.id));
        list.appendChild(div);
    });
}

function esc(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── Diary List & Selection ────────────────────

async function loadConfig() {
    const config = await api('/api/config');
    state.members = Array.isArray(config.members) ? config.members : [];
    if (config.moods && typeof config.moods === 'object') MOODS = config.moods;
    renderMemberTabs();
}

async function finishBootstrap() {
    await loadConfig();
    await loadDiaryList();
    state.appLoaded = true;
}

function refreshEmptyState() {
    if (state.members.length === 0) {
        dom.emptyTitle.textContent = '还没有配置成员';
        dom.emptyDescription.textContent = '请在 .env 中设置 TING_MEMBERS，然后重新启动服务。';
        dom.btnWrite.disabled = true;
        dom.fabWrite.disabled = true;
        return;
    }
    dom.btnWrite.disabled = false;
    dom.fabWrite.disabled = false;
    if (state.totalDiaries === 0) {
        dom.emptyTitle.textContent = '共享的日子，从这里汇流';
        dom.emptyDescription.textContent = '以成员身份写下第一篇日记。';
    } else {
        dom.emptyTitle.textContent = '选择一篇日记开始阅读';
        dom.emptyDescription.textContent = '可以按成员、心情或关键词筛选。';
    }
}

async function loadDiaryList(append = false) {
    if (!append) {
        state.diaryOffset = 0;
        state.diaries = [];
    }
    try {
        const params = new URLSearchParams();
        params.set('limit', state.pageSize);
        params.set('offset', state.diaryOffset);
        if (state.filterAuthor) params.set('author', state.filterAuthor);
        if (state.filterMood) params.set('mood', state.filterMood);
        if (state.filterSearch) params.set('search', state.filterSearch);

        const data = await api(`/api/diary?${params}`);
        const items = (data.items || []).map(d => ({
            ...d,
            moods: typeof d.moods === 'string' ? d.moods.split(',').filter(Boolean) : (d.moods || [])
        }));

        if (append) {
            state.diaries = state.diaries.concat(items);
        } else {
            state.diaries = items;
        }
        state.diaryOffset += items.length;
        state.totalDiaries = data.total;

        renderSidebar();
        renderMoodFilter();
        updateLoadMore();
        refreshEmptyState();
    } catch (e) {
        console.error('加载日记列表失败:', e);
    }
}

function updateLoadMore() {
    const hasMore = state.diaryOffset < state.totalDiaries;
    dom.loadMoreWrap.style.display = hasMore ? 'block' : 'none';
}

function loadMore() {
    loadDiaryList(true);
}

function renderMoodFilter() {
    const container = dom.moodFilter;
    // Collect all mood keys from current filtered diaries
    const moodCount = {};
    state.diaries.forEach(d => {
        (d.moods || []).forEach(m => {
            const key = m.trim();
            if (key) moodCount[key] = (moodCount[key] || 0) + 1;
        });
    });

    const sorted = Object.entries(moodCount).sort((a, b) => b[1] - a[1]);

    container.innerHTML = '';
    sorted.forEach(([key, count]) => {
        const mi = moodInfo(key);
        const chip = document.createElement('span');
        chip.className = 'mood-filter-chip';
        chip.setAttribute('data-mood', key);
        chip.textContent = `${mi.emoji} ${mi.label} ${count}`;
        if (state.filterMood === key) chip.classList.add('active');

        chip.addEventListener('click', () => {
            if (state.filterMood === key) {
                // Deselect
                state.filterMood = '';
                chip.classList.remove('active');
            } else {
                // Select
                $$('.mood-filter-chip').forEach(c => c.classList.remove('active'));
                state.filterMood = key;
                chip.classList.add('active');
            }
            state.diaryOffset = 0;
            state.diaries = [];
            loadDiaryList(false);
        });
        container.appendChild(chip);
    });
}

async function selectDiary(id) {
    try {
        const diary = await api(`/api/diary/${id}`);
        diary.moods = typeof diary.moods === 'string' ? diary.moods.split(',').filter(Boolean) : (diary.moods || []);
        state.selectedId = id;
        showViewMode(diary);
        renderSidebar();
        closeSidebar();
        loadComments(id);
    } catch (e) {
        console.error('加载日记失败:', e);
    }
}

function showViewMode(diary) {
    dom.emptyState.style.display = 'none';
    dom.viewMode.style.display = 'block';
    dom.editMode.style.display = 'none';
    dom.commentsSection.style.display = 'block';

    dom.diaryTitle.textContent = diary.title;

    // Moods
    dom.diaryMoods.innerHTML = '';
    (diary.moods || []).forEach(m => {
        const mi = moodInfo(m.trim());
        const tag = document.createElement('span');
        tag.className = `mood-tag ${mi.color}`;
        tag.textContent = `${mi.emoji} ${mi.label}`;
        dom.diaryMoods.appendChild(tag);
    });

    // Author & date (with time period already in formatDate)
    dom.diaryAuthor.textContent = diary.author;
    dom.diaryAuthor.style.color = authorColor(diary.author);
    dom.diaryDate.textContent = formatDate(diary.created_at);

    // Word count in meta
    const wc = wordCount(diary.content);
    dom.diaryDate.textContent = formatDate(diary.created_at) + ` · ${wc}字`;

    dom.diaryBody.innerHTML = renderMarkdown(diary.content);

    // Store current diary for export
    state.currentDiary = diary;
    updateActionPermissions(diary);

    // Scroll content to top
    dom.content.scrollTop = 0;
}

// ─── Edit / Write Mode ─────────────────────────

function openWriteMode() {
    if (!ensureMember(openWriteMode)) return;
    state.editingId = null;
    state.selectedMoods = new Set();
    state.previewVisible = false;

    dom.editTitle.value = defaultTitle();
    dom.editTextarea.value = '';
    dom.previewArea.style.display = 'none';
    dom.btnPreview.textContent = '预览';

    renderMoodGrid();
    showEditMode();
}

async function openEditMode() {
    if (!state.selectedId) return;
    if (!state.currentDiary || !state.currentAuthor ||
        (!state.isAdmin && state.currentAuthor !== state.currentDiary.author)) return;
    try {
        const diary = await api(`/api/diary/${state.selectedId}`);
        diary.moods = typeof diary.moods === 'string' ? diary.moods.split(',').filter(Boolean) : (diary.moods || []);

        state.editingId = diary.id;
        state.selectedMoods = new Set(diary.moods);
        state.previewVisible = false;
        dom.editIdentity.textContent = state.isAdmin
            ? `以管理员身份编辑「${diary.author}」的日记`
            : `以「${state.currentAuthor}」的身份写作`;

        dom.editTitle.value = diary.title;
        dom.editTextarea.value = diary.content;
        dom.previewArea.style.display = 'none';
        dom.btnPreview.textContent = '预览';

        renderMoodGrid();
        showEditMode();
    } catch (e) {
        console.error('加载日记失败:', e);
    }
}

function showEditMode() {
    dom.emptyState.style.display = 'none';
    dom.viewMode.style.display = 'none';
    dom.editMode.style.display = 'flex';
    dom.commentsSection.style.display = 'none';
    dom.content.scrollTop = 0;
}

function cancelEdit() {
    dom.editMode.style.display = 'none';
    if (state.selectedId) {
        dom.viewMode.style.display = 'block';
        dom.commentsSection.style.display = 'block';
    } else {
        dom.emptyState.style.display = 'flex';
    }
}

async function deleteDiary() {
    if (!state.selectedId) return;
    if (!confirm('确定要删除这篇日记吗？此操作不可撤销。')) return;
    try {
        await api(`/api/diary/${state.selectedId}`, { method: 'DELETE' });
        state.selectedId = null;
        dom.viewMode.style.display = 'none';
        dom.emptyState.style.display = 'flex';
        dom.commentsSection.style.display = 'none';
        await loadDiaryList();
    } catch (e) {
        alert('删除失败: ' + e.message);
    }
}

function exportDiary() {
    if (!state.currentDiary) return;
    const d = state.currentDiary;
    const moodsStr = (d.moods || []).map(m => {
        const mi = moodInfo(m);
        return `${mi.emoji} ${mi.label}`;
    }).join(' · ');

    const text = `# ${d.title}\n\n**${d.author}** · ${d.created_at}\n\n${moodsStr ? moodsStr + '\n\n---\n\n' : ''}${d.content}`;

    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${d.title}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function renderMoodGrid() {
    dom.moodGrid.innerHTML = '';
    Object.entries(MOODS).forEach(([key, mo]) => {
        const btn = document.createElement('button');
        btn.className = 'mood-btn';
        btn.title = mo.label;
        btn.textContent = `${mo.emoji} ${mo.label}`;
        btn.setAttribute('data-mood', key);
        if (state.selectedMoods.has(key)) btn.classList.add('selected');

        btn.addEventListener('click', () => {
            if (state.selectedMoods.has(key)) {
                state.selectedMoods.delete(key);
                btn.classList.remove('selected');
            } else {
                state.selectedMoods.add(key);
                btn.classList.add('selected');
            }
        });
        dom.moodGrid.appendChild(btn);
    });
}

function togglePreview() {
    if (!state.previewVisible) {
        dom.previewArea.innerHTML = renderMarkdown(dom.editTextarea.value);
        dom.previewArea.style.display = 'block';
        dom.btnPreview.textContent = '编辑';
        state.previewVisible = true;
    } else {
        dom.previewArea.style.display = 'none';
        dom.btnPreview.textContent = '预览';
        state.previewVisible = false;
    }
}

async function saveDiary() {
    const title = dom.editTitle.value.trim();
    const content = dom.editTextarea.value;
    const moods = [...state.selectedMoods];

    if (!title || !content) {
        alert('标题和内容不能为空');
        return;
    }

    try {
        let savedId = state.editingId;
        if (state.editingId) {
            await api(`/api/diary/${state.editingId}`, {
                method: 'PUT',
                body: JSON.stringify({ title, content, moods })
            });
        } else {
            const created = await api('/api/diary', {
                method: 'POST',
                body: JSON.stringify({ title, content, moods })
            });
            savedId = created.id;
        }
        cancelEdit();
        await loadDiaryList();
        if (savedId) await selectDiary(savedId);
    } catch (e) {
        alert('保存失败: ' + e.message);
    }
}

// ─── Comments ──────────────────────────────────

async function loadComments(diaryId) {
    try {
        const data = await api(`/api/diary/${diaryId}/comments`);
        state.comments = data.comments || [];
        renderComments();
    } catch (e) {
        console.error('加载评论失败:', e);
    }
}

function renderComments() {
    const count = state.comments.length;
    dom.commentsCount.textContent = `💬 ${count} 条留言`;

    dom.commentsList.innerHTML = '';
    state.comments.forEach(c => {
        const div = document.createElement('div');
        div.className = 'comment-item';
        const canDelete = Boolean(
            state.currentAuthor && (state.isAdmin || state.currentAuthor === c.author)
        );

        div.innerHTML = `
            <div class="comment-meta">
                <span class="comment-author" style="color:${authorColor(c.author)}">${esc(c.author)}</span>
                <span>· ${shortDate(c.created_at)}</span>
                ${canDelete ? `<button class="comment-delete" data-comment-id="${c.id}" aria-label="删除这条留言">×</button>` : ''}
            </div>
            <div class="comment-body">${esc(c.content)}</div>
        `;

        const delBtn = div.querySelector('.comment-delete');
        if (delBtn) {
            delBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await deleteComment(c.id);
            });
        }

        dom.commentsList.appendChild(div);
    });
}

async function sendComment() {
    if (!ensureMember(() => sendComment())) return;
    const content = dom.commentInput.value.trim();
    if (!content) return;
    if (!state.selectedId) return;

    try {
        await api(`/api/diary/${state.selectedId}/comments`, {
            method: 'POST',
            body: JSON.stringify({ content })
        });
        dom.commentInput.value = '';
        await loadComments(state.selectedId);
    } catch (e) {
        alert('评论失败: ' + e.message);
    }
}

async function deleteComment(commentId) {
    if (!confirm('确定删除这条评论？')) return;
    try {
        await api(`/api/comment/${commentId}`, { method: 'DELETE' });
        if (state.selectedId) {
            await loadComments(state.selectedId);
        }
    } catch (e) {
        alert('删除失败: ' + e.message);
    }
}

// ─── Search ────────────────────────────────────

let searchTimer = null;
const DEBOUNCE_MS = 300;

function doSearch(query) {
    state.filterSearch = query.trim();
    state.diaryOffset = 0;
    state.diaries = [];
    // Show/hide clear button
    dom.searchClear.style.display = state.filterSearch ? 'flex' : 'none';
    // Sync sidebar search
    if (dom.searchInputSidebar.value !== query) {
        dom.searchInputSidebar.value = query;
    }
    loadDiaryList(false);
}

function clearSearch() {
    dom.searchInput.value = '';
    dom.searchInputSidebar.value = '';
    doSearch('');
}

function onSearchInput(e) {
    const value = e.target.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => doSearch(value), DEBOUNCE_MS);
}

// ─── Import Markdown ────────────────────────────

function openImport() {
    if (!ensureMember(openImport)) return;
    const importAuthor = state.currentAuthor;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.markdown,.txt';
    input.multiple = true;
    input.addEventListener('change', async () => {
        const files = input.files;
        if (!files.length) return;
        const entries = [];
        for (const file of files) {
            const text = await file.text();
            const entry = parseMarkdownEntry(text, file.name, importAuthor);
            if (entry) entries.push(entry);
        }
        if (!entries.length) { alert('未解析到有效日记'); return; }
        const msg = `将以「${importAuthor}」的身份导入 ${entries.length} 篇日记，确定？`;
        if (!confirm(msg)) return;
        try {
            const data = await api('/api/diary/import', {
                method: 'POST',
                body: JSON.stringify({ entries })
            });
            alert(`成功导入 ${data.count} 篇日记`);
            await loadDiaryList();
        } catch (e) { alert('导入失败: ' + e.message); }
    });
    input.click();
}

function parseMarkdownEntry(text, filename, importAuthor) {
    if (!text.trim()) return null;
    let title = '';
    let author = importAuthor;
    let moods = [];
    let content = text;
    let created_at = null;

    // Try YAML frontmatter
    const fmMatch = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
    if (fmMatch) {
        const fm = fmMatch[1];
        content = text.slice(fmMatch[0].length);
        fm.split('\n').forEach(line => {
            const kv = line.match(/^(\w+):\s*(.*)/);
            if (kv) {
                const k = kv[1].trim(), v = kv[2].trim();
                if (k === 'title') title = v;
                if (k === 'date' || k === 'created_at') created_at = v;
                if (k === 'moods') moods = v.split(',').map(s => s.trim()).filter(Boolean);
            }
        });
    }

    // Title: first # heading
    if (!title) {
        const h1 = content.match(/^#\s+(.+)/m);
        if (h1) title = h1[1].trim();
    }

    // Fallback title from filename
    if (!title) title = filename.replace(/\.(md|markdown|txt)$/i, '');

    // If no created_at, try parsing from filename (YYYY-MM-DD)
    if (!created_at) {
        const dateMatch = filename.match(/(\d{4}-\d{2}-\d{2})/);
        if (dateMatch) created_at = dateMatch[1] + 'T12:00:00+08:00';
    }

    return { author, title, content, moods, created_at };
}

// ─── Sidebar (mobile) ──────────────────────────

function openSidebar() {
    dom.sidebar.classList.add('open');
    dom.overlay.classList.add('show');
}

function closeSidebar() {
    dom.sidebar.classList.remove('open');
    dom.overlay.classList.remove('show');
}

async function submitIdentity(event) {
    event.preventDefault();
    const token = dom.identityToken.value.trim();
    if (!token) return;
    dom.identityError.textContent = '';
    const submitButton = dom.identityForm.querySelector('[type="submit"]');
    submitButton.disabled = true;
    try {
        await applyIdentity(token);
        const nextAction = state.pendingAction;
        state.pendingAction = null;
        dom.identityDialog.close();
        if (!state.appLoaded) await finishBootstrap();
        if (nextAction) await nextAction();
    } catch (_error) {
        dom.identityError.textContent = '令牌无效，请检查后重试。';
        dom.identityToken.select();
    } finally {
        submitButton.disabled = false;
    }
}

// ─── Init ──────────────────────────────────────

async function init() {
    // Visual
    applyVisual();
    dom.themeToggle.addEventListener('click', toggleMode);
    dom.colorToggle.addEventListener('click', toggleColorScheme);

    // Hamburger
    dom.hamburger.addEventListener('click', openSidebar);
    dom.overlay.addEventListener('click', closeSidebar);

    // Import
    dom.btnImport.addEventListener('click', openImport);

    // Identity
    dom.identityButton.addEventListener('click', () => openIdentityDialog());
    dom.identityForm.addEventListener('submit', submitIdentity);
    dom.identityCancel.addEventListener('click', closeIdentityDialog);
    dom.identitySignout.addEventListener('click', () => {
        signOut();
        dom.identityDialog.close();
        openIdentityDialog();
    });
    dom.identityDialog.addEventListener('cancel', () => {
        state.pendingAction = null;
    });

    // Write button
    dom.btnWrite.addEventListener('click', openWriteMode);
    dom.fabWrite.addEventListener('click', openWriteMode);

    // Edit button
    dom.btnEdit.addEventListener('click', openEditMode);

    // Delete button
    dom.btnDelete.addEventListener('click', deleteDiary);

    // Export button
    dom.btnExport.addEventListener('click', exportDiary);

    // Load more
    dom.loadMoreBtn.addEventListener('click', loadMore);

    // Search
    dom.searchInput.addEventListener('input', onSearchInput);
    dom.searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') clearSearch();
    });
    dom.searchClear.addEventListener('click', clearSearch);
    dom.searchInputSidebar.addEventListener('input', onSearchInput);
    dom.searchInputSidebar.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') clearSearch();
    });
    dom.searchSubmitSidebar = $('#search-submit-sidebar');
    dom.searchSubmitSidebar.addEventListener('click', () => {
        clearTimeout(searchTimer);
        doSearch(dom.searchInputSidebar.value);
    });

    // Edit actions
    dom.btnSave.addEventListener('click', saveDiary);
    dom.btnCancel.addEventListener('click', cancelEdit);
    dom.btnPreview.addEventListener('click', togglePreview);

    // Comment
    dom.commentSend.addEventListener('click', sendComment);
    dom.commentInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            sendComment();
        }
    });

    try {
        const restored = await restoreIdentity();
        if (restored) {
            await finishBootstrap();
        } else {
            openIdentityDialog();
        }
    } catch (error) {
        console.error('初始化失败:', error);
        dom.emptyTitle.textContent = '暂时无法载入日记';
        dom.emptyDescription.textContent = '请检查服务配置后刷新页面。';
    }
}

document.addEventListener('DOMContentLoaded', init);
