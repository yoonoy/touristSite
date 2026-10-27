const routes = {
  lakes: {
    3: { title: 'A little taste of Issyk-Kul', copy: 'Start in Bishkek, wind through the Boom Gorge, then settle into lakeside life in Cholpon-Ata. Two nights, no alarms.' },
    5: { title: 'The lake, at your own pace', copy: 'Pair a night in Karakol with warm springs, quiet coves, and the red rock canyons along Issyk-Kul’s south shore.' },
    7: { title: 'Around the big blue', copy: 'Take the scenic loop from Bishkek through Karakol and the southern shore. Leave room for a swim, a market stop, and a day with no plan.' }
  },
  hiking: {
    3: { title: 'A foothold in the mountains', copy: 'Give Bishkek a day, then head to Ala-Archa National Park for a high-valley hike with the Tian Shan right on your doorstep.' },
    5: { title: 'Into the Ala-Kul country', copy: 'Base yourself in Karakol for day hikes, forest trails, and big views. A local guide can help match the route to your pace.' },
    7: { title: 'The long way to the high places', copy: 'Build toward Ala-Kul with an acclimatisation day, a guided trek, and a soft landing by Issyk-Kul. Mountain weather sets the rhythm.' }
  },
  culture: {
    3: { title: 'A first taste of nomad life', copy: 'Walk Bishkek’s lively Osh Bazaar, share a home-cooked meal, and spend a night in a yurt near the shore of Issyk-Kul.' },
    5: { title: 'Meet the makers and herders', copy: 'Travel east from Bishkek to Karakol for Dungan food, a felt-making visit, and a yurt stay with a family in the mountains.' },
    7: { title: 'Life between the pastures', copy: 'Link Karakol, a family-run yurt camp, and a high-altitude pasture. Make time for stories, slow tea, and the people who call this home.' }
  }
};

const plannerForm = document.querySelector('#planner-form');
const result = document.querySelector('#planner-result');
const languageButtons = document.querySelectorAll('[data-language]');
const languageTrigger = document.querySelector('#language-trigger');
const languageMenu = document.querySelector('#language-options');
const currentLanguageLabel = document.querySelector('#current-language');
const languageStorageKey = 'travel-horizon-language';
const htmlTranslationKeys = new Set(['introStamp', 'plannerStamp']);
let websiteContent = null;
let currentLanguage = localStorage.getItem(languageStorageKey) || 'en';
let lastPlannerChoice = null;

const menuToggle = document.querySelector('.menu-toggle');
const navigation = document.querySelector('.main-nav');

menuToggle.addEventListener('click', () => {
  const isOpen = menuToggle.getAttribute('aria-expanded') === 'true';
  menuToggle.setAttribute('aria-expanded', String(!isOpen));
  menuToggle.setAttribute('aria-label', window.siteTranslations[currentLanguage].ui[isOpen ? 'openMenu' : 'closeMenu']);
  navigation.classList.toggle('is-open', !isOpen);
});

navigation.addEventListener('click', (event) => {
  if (event.target.closest('a')) {
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', window.siteTranslations[currentLanguage].ui.openMenu);
    navigation.classList.remove('is-open');
  }
});

function readContentPath(content, path) {
  return path.split('.').reduce((value, key) => value?.[key], content);
}

function applyWebsiteContent() {
  if (!websiteContent) return;
  const overrides = window.siteTranslations[currentLanguage].content;
  const savedLocale = websiteContent.locales?.[currentLanguage] || {};
  const content = {
    hero: { ...websiteContent.hero, ...overrides.hero, ...savedLocale.hero },
    journeys: websiteContent.journeys.map((journey, index) => ({
      ...journey,
      ...(overrides.journeys?.[index] || {}),
      ...(savedLocale.journeys?.[index] || {})
    })),
    land: { ...websiteContent.land, ...overrides.land, ...savedLocale.land }
  };

  document.querySelectorAll('[data-content]').forEach((element) => {
    const value = readContentPath(content, element.dataset.content);
    if (typeof value === 'string') element.textContent = value;
  });
  document.querySelectorAll('[data-content-image]').forEach((image) => {
    const source = readContentPath(content, image.dataset.contentImage);
    const alt = readContentPath(content, image.dataset.contentAlt);
    if (typeof source === 'string') image.src = source;
    if (typeof alt === 'string') image.alt = alt;
  });
}

function renderPlannerResult(scroll = false) {
  if (!lastPlannerChoice) return;
  const translation = window.siteTranslations[currentLanguage];
  const route = translation.routes[lastPlannerChoice.mood][lastPlannerChoice.duration];
  const label = document.createElement('span');
  label.className = 'result-label';
  label.textContent = translation.ui.resultLabels[lastPlannerChoice.duration];
  const title = document.createElement('h3');
  title.textContent = route.title;
  const copy = document.createElement('p');
  copy.textContent = route.copy;
  result.replaceChildren(label, title, copy);
  result.hidden = false;
  if (scroll) result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function applyLanguage(languageCode) {
  currentLanguage = window.siteTranslations[languageCode] ? languageCode : 'en';
  const translation = window.siteTranslations[currentLanguage];
  document.documentElement.lang = currentLanguage;
  try {
    localStorage.setItem(languageStorageKey, currentLanguage);
  } catch {
    // Keep language switching available when browser storage is disabled.
  }

  document.querySelectorAll('[data-i18n]').forEach((element) => {
    const value = translation.ui[element.dataset.i18n];
    if (typeof value !== 'string') return;
    if (htmlTranslationKeys.has(element.dataset.i18n)) element.innerHTML = value;
    else element.textContent = value;
  });
  languageButtons.forEach((button) => {
    button.setAttribute('aria-checked', String(button.dataset.language === currentLanguage));
  });
  currentLanguageLabel.textContent = currentLanguage.toUpperCase();
  const menuIsOpen = menuToggle.getAttribute('aria-expanded') === 'true';
  menuToggle.setAttribute('aria-label', translation.ui[menuIsOpen ? 'closeMenu' : 'openMenu']);
  applyWebsiteContent();
  renderPlannerResult();
}

try {
  currentLanguage = localStorage.getItem(languageStorageKey) || 'en';
} catch {
  currentLanguage = 'en';
}

languageButtons.forEach((button) => {
  button.addEventListener('click', () => {
    applyLanguage(button.dataset.language);
    languageMenu.hidden = true;
    languageTrigger.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', window.siteTranslations[currentLanguage].ui.openMenu);
    navigation.classList.remove('is-open');
  });
});

languageTrigger.addEventListener('click', () => {
  const isOpen = languageTrigger.getAttribute('aria-expanded') === 'true';
  languageTrigger.setAttribute('aria-expanded', String(!isOpen));
  languageMenu.hidden = isOpen;
});

languageTrigger.addEventListener('keydown', (event) => {
  if (event.key !== 'ArrowDown') return;
  event.preventDefault();
  languageTrigger.setAttribute('aria-expanded', 'true');
  languageMenu.hidden = false;
  languageButtons[0].focus();
});

languageMenu.addEventListener('keydown', (event) => {
  const options = [...languageButtons];
  const currentIndex = options.indexOf(document.activeElement);
  if (event.key === 'Escape') {
    event.preventDefault();
    languageMenu.hidden = true;
    languageTrigger.setAttribute('aria-expanded', 'false');
    languageTrigger.focus();
    return;
  }
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const nextIndex = event.key === 'Home' ? 0
    : event.key === 'End' ? options.length - 1
      : (currentIndex + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
  options[nextIndex].focus();
});

document.addEventListener('pointerdown', (event) => {
  if (event.target.closest('.language-switch')) return;
  languageMenu.hidden = true;
  languageTrigger.setAttribute('aria-expanded', 'false');
});

plannerForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const formData = new FormData(plannerForm);
  lastPlannerChoice = { mood: formData.get('mood'), duration: formData.get('duration') };
  renderPlannerResult(true);
});

async function loadWebsiteContent() {
  if (window.location.protocol === 'file:') return;
  try {
    const response = await fetch('/api/content');
    if (!response.ok) return;
    const { content } = await response.json();
    websiteContent = content;
    applyWebsiteContent();
  } catch {
    // Keep the bundled default content available if the local server is offline.
  }
}

applyLanguage(currentLanguage);
loadWebsiteContent();
