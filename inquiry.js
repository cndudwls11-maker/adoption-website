(() => {
  'use strict';

  const form = document.getElementById('inquiryForm');
  const confirmation = document.getElementById('confirmationDialog');
  const confirmationMessage = document.getElementById('confirmationMessage');
  const toast = document.getElementById('inquiryToast');
  let toastTimer;

  const errorMessages = {
    inquiryType: '문의 유형을 선택해 주세요.',
    applicantName: '이름을 입력해 주세요.',
    applicantPhone: '올바른 연락처를 입력해 주세요.',
    applicantEmail: '이메일 형식을 확인해 주세요.',
    question: '문의 내용을 10자 이상 입력해 주세요.',
    privacyConsent: '시연용 문의 안내를 확인하고 동의해 주세요.',
  };

  function showToast(message) {
    toast.textContent = message;
    toast.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast.hidden = true;
    }, 3000);
  }

  function setFieldError(name, message) {
    const error = document.querySelector(`[data-error-for="${name}"]`);
    if (error) error.textContent = message;

    const input = form.elements.namedItem(name);
    if (input && input.type !== 'radio' && input.type !== 'checkbox') {
      if (message) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    }
  }

  function validateForm() {
    let firstInvalid = null;
    const data = new FormData(form);
    const inquiryType = data.get('inquiryType');
    const name = document.getElementById('applicantName');
    const phone = document.getElementById('applicantPhone');
    const email = document.getElementById('applicantEmail');
    const question = document.getElementById('question');
    const consent = document.getElementById('privacyConsent');
    const phoneDigits = phone.value.replace(/\D/g, '');

    const validations = [
      ['inquiryType', inquiryType ? '' : errorMessages.inquiryType, document.querySelector('input[name="inquiryType"]')],
      ['applicantName', name.value.trim() ? '' : errorMessages.applicantName, name],
      ['applicantPhone', phoneDigits.length >= 9 && phoneDigits.length <= 15 ? '' : errorMessages.applicantPhone, phone],
      ['applicantEmail', !email.value.trim() || email.validity.valid ? '' : errorMessages.applicantEmail, email],
      ['question', question.value.trim().length >= 10 ? '' : errorMessages.question, question],
      ['privacyConsent', consent.checked ? '' : errorMessages.privacyConsent, consent],
    ];

    for (const [field, message, input] of validations) {
      setFieldError(field, message);
      if (message && !firstInvalid) firstInvalid = input;
    }

    if (firstInvalid) {
      firstInvalid.focus();
      return false;
    }
    return true;
  }

  function updateCount(textareaId, countId) {
    const textarea = document.getElementById(textareaId);
    const count = document.getElementById(countId);
    count.textContent = String(textarea.value.length);
  }

  document.getElementById('livingPlan').addEventListener('input', () => {
    updateCount('livingPlan', 'messageCount');
  });
  document.getElementById('question').addEventListener('input', () => {
    updateCount('question', 'questionCount');
    if (document.getElementById('question').value.trim().length >= 10) {
      setFieldError('question', '');
    }
  });

  document.getElementById('applicantName').addEventListener('input', (event) => {
    if (event.currentTarget.value.trim()) setFieldError('applicantName', '');
  });
  document.getElementById('applicantPhone').addEventListener('input', (event) => {
    const digits = event.currentTarget.value.replace(/\D/g, '');
    if (digits.length >= 9 && digits.length <= 15) setFieldError('applicantPhone', '');
  });
  document.getElementById('applicantEmail').addEventListener('input', (event) => {
    const email = event.currentTarget;
    const isValid = !email.value.trim() || email.validity.valid;
    setFieldError('applicantEmail', isValid ? '' : errorMessages.applicantEmail);
  });
  document.querySelectorAll('input[name="inquiryType"]').forEach((radio) => {
    radio.addEventListener('change', () => setFieldError('inquiryType', ''));
  });
  document.getElementById('privacyConsent').addEventListener('change', (event) => {
    if (event.currentTarget.checked) setFieldError('privacyConsent', '');
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!validateForm()) {
      showToast('필수 항목을 확인해 주세요.');
      return;
    }

    const data = new FormData(form);
    const selectedType = String(data.get('inquiryType'));
    const petName = String(data.get('petName') || '').trim();
    const question = String(data.get('question') || '').trim();
    const preview = [
      `문의 유형: ${selectedType}`,
      petName ? `관심 있는 아이: ${petName}` : '',
      `문의 내용: ${question}`,
    ].filter(Boolean).join('\n');

    confirmationMessage.textContent = preview;
    confirmation.classList.add('open');
    confirmation.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    document.getElementById('closeConfirmation').focus();
  });

  function closeConfirmation() {
    confirmation.classList.remove('open');
    confirmation.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    showToast('시연용 미리보기입니다. 문의는 실제 접수되지 않았어요.');
  }

  document.getElementById('closeConfirmation').addEventListener('click', closeConfirmation);
  confirmation.addEventListener('click', (event) => {
    if (event.target === confirmation) closeConfirmation();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && confirmation.classList.contains('open')) closeConfirmation();
  });

  const params = new URLSearchParams(window.location.search);
  const pet = params.get('pet');
  if (pet) {
    document.getElementById('petName').value = pet.slice(0, 40);
    document.getElementById('applicantName').focus({ preventScroll: true });
    showToast(`${pet.slice(0, 40)}에게 관심을 보내는 문의 양식이에요.`);
  }
})();