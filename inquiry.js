(() => {
  'use strict';

  if (window.PogeunInquiryBoard) return;
  window.PogeunInquiryBoard = true;

  const STORAGE_KEY = 'pogeun-adoption-inquiry-board-v1';
  const PAGE_SIZE = 8;
  const CATEGORIES = ['입양 상담', '아이 정보', '입양 준비', '기타 문의'];
  const SAMPLE_POSTS = [
    { id: 'sample-1', category: '입양 준비', title: '처음 강아지를 맞이하기 전 꼭 준비해야 할 것이 있을까요?', author: '새싹집사', content: '가족 모두 동의했고 산책과 병원 방문을 준비 중이에요. 처음 가족을 맞이할 때 꼭 확인하거나 준비해야 하는 물품, 생활 습관이 궁금합니다.', date: '2026-10-29T09:00:00.000Z', views: 24, sample: true },
    { id: 'sample-2', category: '아이 정보', title: '보호소 방문 전에 아이의 성격을 미리 알 수 있나요?', author: '천천히준비', content: '사진으로 마음이 가는 아이가 생겼어요. 실제로 만나기 전에 보호소에 어떤 점을 문의하면 아이의 성격과 생활 습관을 잘 알 수 있을까요?', date: '2026-10-28T05:30:00.000Z', views: 18, sample: true },
    { id: 'sample-3', category: '입양 상담', title: '맞벌이 가정의 돌봄 시간을 어떻게 준비하면 좋을까요?', author: '같이사는가족', content: '가족 모두 입양을 원하지만 평일 낮에는 집을 비우게 됩니다. 입양 전에 혼자 있는 시간을 어떻게 줄이고 돌봄 일정을 계획하면 좋을지 조언을 구합니다.', date: '2026-10-26T12:15:00.000Z', views: 31, sample: true },
    { id: 'sample-4', category: '기타 문의', title: '입양 후 적응 기간에는 어떤 점을 가장 신경 써야 하나요?', author: '포근한하루', content: '새 집에 온 아이가 편안하게 적응할 수 있도록 미리 준비하고 싶어요. 처음 며칠 동안 지켜야 할 약속이나 피해야 할 행동이 궁금합니다.', date: '2026-10-24T02:45:00.000Z', views: 12, sample: true },
  ];

  const elements = {
    postList: document.getElementById('postList'),
    emptyState: document.getElementById('emptyState'),
    postCount: document.getElementById('postCount'),
    pagination: document.getElementById('pagination'),
    search: document.getElementById('boardSearch'),
    category: document.getElementById('categoryFilter'),
    listPanel: document.querySelector('.board-list-panel'),
    writePanel: document.getElementById('writePanel'),
    detailPanel: document.getElementById('detailPanel'),
    form: document.getElementById('postForm'),
    toast: document.getElementById('boardToast'),
    passwordDialog: document.getElementById('passwordDialog'),
  };

  let posts = loadPosts();
  let currentPage = 1;
  let currentPostId = null;
  let postToDelete = null;
  let toastTimer;

  function loadPosts() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(saved)) return [...SAMPLE_POSTS];
      const userPosts = saved.filter((post) => post && typeof post === 'object' && !post.sample && typeof post.id === 'string');
      return [...userPosts, ...SAMPLE_POSTS];
    } catch {
      return [...SAMPLE_POSTS];
    }
  }

  function savePosts() {
    try {
      const userPosts = posts.filter((post) => !post.sample);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userPosts));
      return true;
    } catch {
      showToast('브라우저 저장 공간이 부족해 글을 저장하지 못했어요.');
      return false;
    }
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[char]);
  }

  function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add('visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => elements.toast.classList.remove('visible'), 3200);
  }

  function formatDate(dateString) {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  }

  function getFilteredPosts() {
    const query = elements.search.value.trim().toLocaleLowerCase('ko');
    const category = elements.category.value;
    return posts
      .filter((post) => category === 'all' || post.category === category)
      .filter((post) => !query || `${post.title} ${post.content} ${post.author} ${post.category}`.toLocaleLowerCase('ko').includes(query))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  function renderList() {
    const visiblePosts = getFilteredPosts();
    const pageCount = Math.max(1, Math.ceil(visiblePosts.length / PAGE_SIZE));
    currentPage = Math.min(currentPage, pageCount);
    const start = (currentPage - 1) * PAGE_SIZE;
    const pagePosts = visiblePosts.slice(start, start + PAGE_SIZE);

    elements.postCount.textContent = String(visiblePosts.length);
    elements.emptyState.hidden = pagePosts.length !== 0;
    elements.postList.innerHTML = pagePosts.map((post, index) => `
      <tr class="post-row" data-post-id="${escapeHTML(post.id)}">
        <td class="board-col-number">${visiblePosts.length - start - index}</td>
        <td class="board-col-category"><span class="category-badge">${escapeHTML(post.category)}</span></td>
      <td class="post-title-cell"><button class="post-title-button" type="button" data-open-post="${escapeHTML(post.id)}">${escapeHTML(post.title)}${post.sample ? '' : '<span class="new-badge">NEW</span>'}</button></td>
        <td class="board-col-author">${escapeHTML(post.author)}</td>
        <td class="board-col-date">${escapeHTML(formatDate(post.date))}</td>
        <td class="board-col-views">${Number.isFinite(post.views) ? post.views : 0}</td>
      </tr>`).join('');

    renderPagination(pageCount);
  }

  function renderPagination(pageCount) {
    if (pageCount <= 1) {
      elements.pagination.innerHTML = '';
      return;
    }

    const buttons = [];
    for (let page = 1; page <= pageCount; page += 1) {
      buttons.push(`<button class="page-button${page === currentPage ? ' active' : ''}" type="button" data-page="${page}" aria-label="${page}페이지"${page === currentPage ? ' aria-current="page"' : ''}>${page}</button>`);
    }
    elements.pagination.innerHTML = `<button class="page-button page-arrow" type="button" data-page="${Math.max(1, currentPage - 1)}" aria-label="이전 페이지"${currentPage === 1 ? ' disabled' : ''}>‹</button>${buttons.join('')}<button class="page-button page-arrow" type="button" data-page="${Math.min(pageCount, currentPage + 1)}" aria-label="다음 페이지"${currentPage === pageCount ? ' disabled' : ''}>›</button>`;
  }

  function showView(view) {
    elements.listPanel.hidden = view !== 'list';
    elements.writePanel.hidden = view !== 'write';
    elements.detailPanel.hidden = view !== 'detail';
    if (view === 'list') document.getElementById('boardHeading').focus?.();
    if (view === 'write') document.getElementById('postCategory').focus();
    if (view === 'detail') document.getElementById('backToListButton').focus();
    window.scrollTo({ top: document.querySelector('.board-section').offsetTop - 86, behavior: 'smooth' });
  }

  function openWrite() {
    elements.form.reset();
    clearErrors();
    updateCounter('postTitle', 'titleCount');
    updateCounter('postContent', 'contentCount');
    showView('write');
  }

  function clearErrors() {
      ['postCategoryError', 'postTitleError', 'postAuthorError', 'postContentError'].forEach((id) => {
      document.getElementById(id).textContent = '';
    });
    ['postCategory', 'postTitle', 'postAuthor', 'postContent'].forEach((id) => {
      document.getElementById(id).removeAttribute('aria-invalid');
    });
  }

  function setError(id, message) {
    document.getElementById(`${id}Error`).textContent = message;
    document.getElementById(id).setAttribute('aria-invalid', 'true');
  }

  function updateCounter(inputId, outputId) {
    document.getElementById(outputId).textContent = String(document.getElementById(inputId).value.length);
  }

  function validatePost() {
    clearErrors();
    const category = document.getElementById('postCategory');
    const title = document.getElementById('postTitle');
    const author = document.getElementById('postAuthor');
    const content = document.getElementById('postContent');
    const validations = [
      [category, 'postCategory', category.value ? '' : '문의 분류를 선택해 주세요.'],
      [title, 'postTitle', title.value.trim().length >= 4 ? '' : '제목을 4자 이상 입력해 주세요.'],
      [author, 'postAuthor', author.value.trim() ? '' : '게시판에 표시할 별명을 입력해 주세요.'],
      [content, 'postContent', content.value.trim().length >= 10 ? '' : '문의 내용을 10자 이상 입력해 주세요.'],
    ];

    const invalid = validations.find(([, key, message]) => message && key);
    validations.forEach(([input, key, message]) => {
      if (message) setError(key, message);
    });
    if (invalid) {
      invalid[0].focus();
      return false;
    }
    return true;
  }

  function createPost(event) {
    event.preventDefault();
    if (!validatePost()) return;

    const post = {
      id: `post-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      category: document.getElementById('postCategory').value,
      title: document.getElementById('postTitle').value.trim(),
      author: document.getElementById('postAuthor').value.trim(),
      content: document.getElementById('postContent').value.trim(),
      date: new Date().toISOString(),
      views: 0,
      sample: false,
    };

    posts.unshift(post);
    if (!savePosts()) {
      posts = posts.filter((item) => item.id !== post.id);
      renderList();
      return;
    }
    elements.form.reset();
    currentPage = 1;
    elements.search.value = '';
    elements.category.value = 'all';
    renderList();
    showView('list');
    showToast('문의 글이 이 브라우저에 저장됐어요.');
  }

  function openPost(id) {
    const post = posts.find((item) => item.id === id);
    if (!post) return;
    currentPostId = post.id;
    if (!post.sample) {
      post.views = (Number(post.views) || 0) + 1;
      savePosts();
    }
    document.getElementById('detailCategory').textContent = post.category;
    document.getElementById('detailDate').textContent = formatDate(post.date);
    document.getElementById('detailViews').textContent = String(post.views || 0);
    document.getElementById('detailTitle').textContent = post.title;
    document.getElementById('detailAuthor').textContent = post.author;
    document.getElementById('detailContent').textContent = post.content;
    document.getElementById('deletePostButton').hidden = post.sample;
    showView('detail');
  }

  function closeDetail() {
    currentPostId = null;
    renderList();
    showView('list');
  }

  function requestDelete() {
    if (!currentPostId) return;
    postToDelete = currentPostId;
    document.getElementById('deleteError').textContent = '';
    elements.passwordDialog.showModal();
  }

  function confirmDelete() {
    if (!postToDelete) return;
    const post = posts.find((item) => item.id === postToDelete);
    if (!post || post.sample) return;

    posts = posts.filter((item) => item.id !== postToDelete);
    if (!savePosts()) return;
    elements.passwordDialog.close();
    postToDelete = null;
    currentPostId = null;
    renderList();
    showView('list');
    showToast('게시글을 삭제했습니다.');
  }

  elements.form.addEventListener('submit', createPost);
  document.getElementById('openWriteButton').addEventListener('click', openWrite);
  document.getElementById('emptyWriteButton').addEventListener('click', openWrite);
  document.getElementById('closeWriteButton').addEventListener('click', () => showView('list'));
  document.getElementById('cancelWriteButton').addEventListener('click', () => showView('list'));
  document.getElementById('backToListButton').addEventListener('click', closeDetail);
  document.getElementById('deletePostButton').addEventListener('click', requestDelete);
  document.getElementById('confirmDeleteButton').addEventListener('click', confirmDelete);
  elements.postList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-open-post]');
    if (button) openPost(button.dataset.openPost);
  });
  elements.pagination.addEventListener('click', (event) => {
    const button = event.target.closest('[data-page]');
    if (!button || button.disabled) return;
    currentPage = Number(button.dataset.page);
    renderList();
  });
  elements.search.addEventListener('input', () => {
    currentPage = 1;
    renderList();
  });
  elements.category.addEventListener('change', () => {
    currentPage = 1;
    renderList();
  });

  document.getElementById('postTitle').addEventListener('input', () => updateCounter('postTitle', 'titleCount'));
  document.getElementById('postContent').addEventListener('input', () => updateCounter('postContent', 'contentCount'));

  const params = new URLSearchParams(window.location.search);
  const pet = params.get('pet');
  if (pet) {
    openWrite();
    document.getElementById('postCategory').value = '입양 상담';
    document.getElementById('postTitle').value = `${pet.slice(0, 40)} 입양 문의`;
    updateCounter('postTitle', 'titleCount');
    showToast(`${pet.slice(0, 40)}에 대한 문의 글을 작성할 수 있어요.`);
  }

  renderList();
})();