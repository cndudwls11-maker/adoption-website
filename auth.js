(() => {
  'use strict';

  const signupForm = document.getElementById('signupForm');
  const loginForm = document.getElementById('loginForm');
  const status = document.getElementById('authStatus');

  function showStatus(message, isError = false) {
    if (!status) return;
    status.textContent = message;
    status.hidden = false;
    status.classList.toggle('is-error', isError);
    status.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  async function sendJson(url, body) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body),
    });
    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error('인증 API가 JSON 응답을 반환하지 않았습니다. Pages Functions 배포와 D1 바인딩을 확인해 주세요.');
    }
    if (!response.ok) throw new Error(result.error || '요청을 처리하지 못했습니다.');
    return result;
  }

  function setBusy(form, busy) {
    const button = form.querySelector('[type="submit"]');
    if (!button) return;
    button.disabled = busy;
    button.setAttribute('aria-busy', String(busy));
  }

  if (signupForm) {
    signupForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!signupForm.reportValidity()) return;

      const password = document.getElementById('password').value;
      const passwordConfirm = document.getElementById('passwordConfirm').value;
      if (password !== passwordConfirm) {
        document.getElementById('passwordConfirm').setCustomValidity('비밀번호가 서로 일치하지 않습니다.');
        document.getElementById('passwordConfirm').reportValidity();
        document.getElementById('passwordConfirm').setCustomValidity('');
        return;
      }

      setBusy(signupForm, true);
      showStatus('회원 정보를 안전하게 등록하고 있습니다.');
      try {
        await sendJson('/api/auth/register', {
          nickname: document.getElementById('nickname').value.trim(),
          email: document.getElementById('email').value.trim(),
          gender: signupForm.elements.gender.value,
        });
        showStatus('회원가입이 완료되었습니다. 로그인 상태로 이동합니다.');
        window.setTimeout(() => { window.location.href = 'index.html'; }, 900);
      } catch (error) {
        showStatus(error.message, true);
      } finally {
        setBusy(signupForm, false);
      }
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!loginForm.reportValidity()) return;

      setBusy(loginForm, true);
      showStatus('로그인 정보를 확인하고 있습니다.');
      try {
        await sendJson('/api/auth/login', {
          email: document.getElementById('loginEmail').value.trim(),
          password: document.getElementById('loginPassword').value,
        });
        showStatus('로그인되었습니다.');
        window.setTimeout(() => { window.location.href = 'index.html'; }, 700);
      } catch (error) {
        showStatus(error.message, true);
      } finally {
        setBusy(loginForm, false);
      }
    });
  }

  document.querySelectorAll('[data-logout]').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        await sendJson('/api/auth/logout', {});
        window.location.reload();
      } catch (error) {
        showStatus(error.message, true);
      }
    });
  });

  async function updateAccountNavigation() {
    const slots = [...document.querySelectorAll('[data-auth-nav]')];
    if (!slots.length) return;
    try {
      const response = await fetch('/api/auth/me', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
      if (!response.ok) return;
      const result = await response.json();
      if (!result.authenticated || !result.member) return;
      slots.forEach((slot) => {
        const label = document.createElement('span');
        label.className = 'auth-nav-nickname';
        label.textContent = `${result.member.nickname}님`;
        const logout = document.createElement('button');
        logout.type = 'button';
        logout.className = 'auth-nav-logout';
        logout.dataset.logout = '';
        logout.textContent = '로그아웃';
        slot.replaceChildren(label, logout);
        logout.addEventListener('click', async () => {
          await sendJson('/api/auth/logout', {});
          window.location.reload();
        });
      });
    } catch {
      // Static previews without the auth API keep their normal sign-up/login links.
    }
  }

  updateAccountNavigation();
})();