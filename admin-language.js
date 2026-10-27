(() => {
  const trigger = document.querySelector('#admin-language-trigger');
  const menu = document.querySelector('#admin-language-options');
  const currentLabel = document.querySelector('#admin-current-language');
  const options = [...document.querySelectorAll('[data-admin-language]')];
  const languageStorageKey = 'travel-horizon-language';
  const htmlKeys = new Set(['loginTitle']);
  let currentLanguage = 'en';

  function applyLanguage(languageCode) {
    currentLanguage = window.siteTranslations[languageCode] ? languageCode : 'en';
    const translation = window.siteTranslations[currentLanguage];
    const adminUi = translation.adminUi;
    document.documentElement.lang = currentLanguage;
    document.title = `${currentLanguage === 'en' ? 'Site editor' : currentLanguage === 'ky' ? 'Сайт редактору' : 'Редактор сайта'} · Travel Horizon`;
    try {
      localStorage.setItem(languageStorageKey, currentLanguage);
    } catch {
      // The control remains usable without browser storage.
    }

    document.querySelectorAll('[data-admin-i18n]').forEach((element) => {
      const value = adminUi[element.dataset.adminI18n];
      if (typeof value === 'string') element.textContent = value;
    });
    document.querySelectorAll('[data-admin-html]').forEach((element) => {
      const value = adminUi[element.dataset.adminHtml];
      if (typeof value === 'string') element.innerHTML = value;
    });
    options.forEach((option) => {
      option.setAttribute('aria-checked', String(option.dataset.adminLanguage === currentLanguage));
    });
    currentLabel.textContent = currentLanguage.toUpperCase();
    window.adminLocale = currentLanguage;
    window.adminUi = adminUi;
    document.dispatchEvent(new CustomEvent('admin-language-changed', { detail: { language: currentLanguage } }));
  }

  trigger.addEventListener('click', () => {
    const isOpen = trigger.getAttribute('aria-expanded') === 'true';
    trigger.setAttribute('aria-expanded', String(!isOpen));
    menu.hidden = isOpen;
  });

  trigger.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowDown') return;
    event.preventDefault();
    trigger.setAttribute('aria-expanded', 'true');
    menu.hidden = false;
    options[0].focus();
  });

  menu.addEventListener('click', (event) => {
    const option = event.target.closest('[data-admin-language]');
    if (!option) return;
    applyLanguage(option.dataset.adminLanguage);
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
  });

  menu.addEventListener('keydown', (event) => {
    const index = options.indexOf(document.activeElement);
    if (event.key === 'Escape') {
      event.preventDefault();
      menu.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      trigger.focus();
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0
      : event.key === 'End' ? options.length - 1
        : (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
    options[next].focus();
  });

  document.addEventListener('pointerdown', (event) => {
    if (event.target.closest('.admin-language-switch')) return;
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
  });

  try {
    currentLanguage = localStorage.getItem(languageStorageKey) || 'en';
  } catch {
    currentLanguage = 'en';
  }
  applyLanguage(currentLanguage);
})();