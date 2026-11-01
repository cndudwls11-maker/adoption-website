(() => {
  'use strict';

  // 디자인 확인용 예시 데이터입니다. 실제 보호소 데이터에 연결되어 있지 않습니다.
  const pets = [
    { id: 1, name: '초코', type: '강아지', breed: '믹스견', age: 2, gender: '여아', region: '서울', shelter: '서울시 동물복지지원센터', image: 'photo-1552053831-71594a27632d', position: 'center 48%', badge: '사람을 좋아해요' },
    { id: 2, name: '보리', type: '고양이', breed: '코리안 숏헤어', age: 1, gender: '남아', region: '경기', shelter: '경기도 동물보호센터', image: 'photo-1573865526739-10659fec78a5', position: 'center 42%', badge: '호기심 많은 친구' },
    { id: 3, name: '두부', type: '강아지', breed: '웰시 코기 믹스', age: 3, gender: '남아', region: '인천', shelter: '인천광역시 동물보호소', image: 'photo-1543466835-00a7907e9de1', position: 'center 48%', badge: '산책을 좋아해요' },
    { id: 4, name: '나비', type: '고양이', breed: '코리안 숏헤어', age: 2, gender: '여아', region: '대전', shelter: '대전동물보호사업소', image: 'photo-1514888286974-6c03e2ca1dba', position: 'center 44%', badge: '차분하고 다정해요' },
    { id: 5, name: '콩이', type: '강아지', breed: '푸들 믹스', age: 1, gender: '여아', region: '부산', shelter: '부산동물보호센터', image: 'photo-1516734212186-a967f81ad0d7', position: 'center 45%', badge: '밝고 활발해요' },
    { id: 6, name: '달이', type: '고양이', breed: '턱시도 믹스', age: 4, gender: '남아', region: '제주', shelter: '제주시 동물보호센터', image: 'photo-1533743983669-94fa5c4338ec', position: 'center 44%', badge: '천천히 친해져요' },
    { id: 7, name: '감자', type: '강아지', breed: '진도 믹스', age: 5, gender: '남아', region: '경기', shelter: '경기도 동물보호센터', image: 'photo-1548199973-03cce0bbc87b', position: 'center 45%', badge: '얌전하고 의젓해요' },
    { id: 8, name: '모카', type: '고양이', breed: '코리안 숏헤어', age: 1, gender: '여아', region: '서울', shelter: '서울시 동물복지지원센터', image: 'photo-1495360010541-f48722b34f7d', position: 'center 44%', badge: '장난감을 좋아해요' },
  ];

  const cards = document.getElementById('petCards');
  const typeButtons = [...document.querySelectorAll('.filter-chip')];
  const regionFilter = document.getElementById('regionFilter');
  const searchInput = document.getElementById('searchInput');
  const sortSelect = document.getElementById('sortSelect');
  const modal = document.getElementById('adoptionModal');
  const form = document.getElementById('adoptionForm');
  const toast = document.getElementById('toast');
  let selectedType = 'all';
  let toastTimer;

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[char]);
  }

  function renderPets() {
    const query = searchInput.value.trim().toLocaleLowerCase('ko');
    const visiblePets = pets.filter((pet) => {
      const matchesType = selectedType === 'all' || pet.type === selectedType;
      const matchesRegion = regionFilter.value === 'all' || pet.region === regionFilter.value;
      const searchable = `${pet.name} ${pet.breed} ${pet.shelter} ${pet.region}`.toLocaleLowerCase('ko');
      return matchesType && matchesRegion && (!query || searchable.includes(query));
    });

    if (sortSelect.value === 'young') visiblePets.sort((a, b) => a.age - b.age);
    if (sortSelect.value === 'old') visiblePets.sort((a, b) => b.age - a.age);

    if (!visiblePets.length) {
      cards.innerHTML = '<div class="empty-state"><strong>검색 결과가 없어요</strong>검색어나 필터를 바꿔 다시 찾아보세요.</div>';
      return;
    }

    cards.innerHTML = visiblePets.map((pet) => `
      <article class="pet-card">
        <div class="pet-photo">
          <img src="https://images.unsplash.com/${pet.image}?auto=format&fit=crop&w=650&q=80" alt="${escapeHTML(pet.name)} 사진" loading="lazy" style="object-position:${escapeHTML(pet.position)}">
          <span class="badge">${escapeHTML(pet.badge)}</span>
          <button class="heart-button" type="button" aria-label="${escapeHTML(pet.name)} 찜하기" aria-pressed="false">♡</button>
        </div>
        <div class="pet-details">
          <div class="pet-title"><h3>${escapeHTML(pet.name)}</h3><span class="pet-gender">${escapeHTML(pet.gender)}</span></div>
          <div class="pet-meta"><span>${escapeHTML(pet.breed)}</span><span>${pet.age}살</span><span>${escapeHTML(pet.region)}</span></div>
          <p class="shelter-name">⌖ ${escapeHTML(pet.shelter)}</p>
          <button class="apply-button" type="button" data-pet-id="${pet.id}">입양 상담 신청하기 →</button>
        </div>
      </article>`).join('');
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 3300);
  }

  function closeModal() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
  }

  typeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      selectedType = button.dataset.type;
      typeButtons.forEach((item) => {
        const isActive = item === button;
        item.classList.toggle('active', isActive);
        item.setAttribute('aria-pressed', String(isActive));
      });
      renderPets();
    });
  });

  [regionFilter, searchInput, sortSelect].forEach((control) => {
    control.addEventListener('input', renderPets);
    control.addEventListener('change', renderPets);
  });

  cards.addEventListener('click', (event) => {
    const heartButton = event.target.closest('.heart-button');
    if (heartButton) {
      const isSaved = heartButton.getAttribute('aria-pressed') !== 'true';
      heartButton.setAttribute('aria-pressed', String(isSaved));
      heartButton.classList.toggle('saved', isSaved);
      heartButton.textContent = isSaved ? '♥' : '♡';
      showToast(isSaved ? '마음에 드는 아이를 찜했어요.' : '찜 목록에서 뺐어요.');
      return;
    }

    const applyButton = event.target.closest('.apply-button');
    if (!applyButton) return;
    const pet = pets.find((item) => item.id === Number(applyButton.dataset.petId));
    if (!pet) return;

    document.getElementById('selectedPet').innerHTML = `
      <img src="https://images.unsplash.com/${pet.image}?auto=format&fit=crop&w=140&q=75" alt="">
      <div><strong>${escapeHTML(pet.name)} · ${escapeHTML(pet.breed)}</strong>
      <span>${pet.age}살 · ${escapeHTML(pet.region)} · ${escapeHTML(pet.shelter)}</span></div>`;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    document.getElementById('applicantName').focus();
  });

  modal.addEventListener('click', (event) => {
    if (event.target === modal || event.target.closest('.modal-close')) closeModal();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal.classList.contains('open')) closeModal();
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    closeModal();
    form.reset();
    showToast('상담 신청 시연이 완료됐어요. 데모 페이지라 실제 접수되지는 않습니다.');
  });

  renderPets();
})();