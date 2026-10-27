(() => {
  const contentForm = document.querySelector('#content-form');
  const contentPanel = document.querySelector('#content-panel');
  const contentState = document.querySelector('#content-state');
  const contentSave = document.querySelector('#content-save');
  const journeyFields = document.querySelector('#journey-fields');
  const landPhoto = document.querySelector('#land-photo');
  let draft;
  let savedContent;
  let currentLocale = 'en';
  const localeDrafts = {};
  const dirtyLocales = new Set();

  function localizedText(key, fallback = key) {
    return window.adminUi?.[key] || fallback;
  }

  async function request(url, options = {}) {
    let response;
    try {
      response = await fetch(url, { credentials: 'same-origin', ...options });
    } catch {
      throw new Error('Could not reach the local server. Reopen http://127.0.0.1:4173/admin.html.');
    }
    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error('The server returned an unreadable response. Reopen http://127.0.0.1:4173/admin.html.');
    }
    if (!response.ok) throw new Error(data.error || 'The request could not be completed.');
    return data;
  }

  function getPath(object, path) {
    return path.split('.').reduce((value, key) => value?.[key], object);
  }

  function setPath(object, path, value) {
    const keys = path.split('.');
    const leaf = keys.pop();
    const target = keys.reduce((current, key) => current[key], object);
    target[leaf] = value;
  }

  function makeLocaleDraft(locale) {
    if (locale === 'en') return structuredClone(savedContent);
    if (savedContent.locales?.[locale]) return structuredClone(savedContent.locales[locale]);

    const translated = window.siteTranslations[locale].content;
    return {
      hero: { ...savedContent.hero, ...translated.hero },
      journeys: savedContent.journeys.map((journey, index) => ({
        ...journey,
        ...(translated.journeys?.[index] || {})
      })),
      land: { ...savedContent.land, ...translated.land }
    };
  }

  function setStatus(key, error = false) {
    contentState.textContent = localizedText(key, key);
    contentState.dataset.state = error ? 'error' : '';
  }

  function markChanged() {
    dirtyLocales.add(currentLocale);
    localeDrafts[currentLocale] = structuredClone(draft);
    contentSave.disabled = false;
    setStatus('unsavedStatus');
  }

  function makeField(labelKey, path, value, multiline = false) {
    const label = document.createElement('label');
    const labelText = document.createElement('span');
    labelText.dataset.adminDynamic = labelKey;
    labelText.textContent = localizedText(labelKey);
    const input = document.createElement(multiline ? 'textarea' : 'input');
    input.value = value || '';
    input.dataset.contentPath = path;
    if (multiline) input.rows = 3;
    label.append(labelText, input);
    return label;
  }

  function makePhotoEditor(title, path, imageUrl, altText) {
    const editor = document.createElement('div');
    editor.className = 'photo-editor';
    const heading = document.createElement('h3');
    heading.dataset.photoTitle = title;
    heading.textContent = `${title} ${localizedText('photoWord', 'photo')}`;
    editor.append(heading);

    const control = document.createElement('div');
    control.className = 'photo-control';
    control.dataset.photoPath = path;
    control.tabIndex = 0;

    const preview = document.createElement('img');
    preview.className = 'photo-preview';
    preview.src = imageUrl;
    preview.alt = altText || '';
    control.append(preview);

    const hint = document.createElement('p');
    hint.dataset.adminDynamic = 'photoHint';
    hint.textContent = localizedText('photoHint');
    control.append(hint);

    const urlLabel = document.createElement('label');
    urlLabel.className = 'photo-url-label';
    const urlLabelText = document.createElement('span');
    urlLabelText.dataset.adminDynamic = 'photoUrl';
    urlLabelText.textContent = localizedText('photoUrl');
    const urlInput = document.createElement('input');
    urlInput.type = 'url';
    urlInput.value = imageUrl || '';
    urlInput.dataset.contentPath = path;
    urlInput.autocomplete = 'url';
    urlLabel.append(urlLabelText, urlInput);
    control.append(urlLabel);

    const actions = document.createElement('div');
    actions.className = 'photo-control-actions';
    const chooseButton = document.createElement('button');
    chooseButton.className = 'photo-upload-button';
    chooseButton.type = 'button';
    chooseButton.dataset.adminDynamic = 'choosePhoto';
    chooseButton.textContent = localizedText('choosePhoto');
    const fileInput = document.createElement('input');
    fileInput.className = 'photo-upload-input';
    fileInput.type = 'file';
    fileInput.accept = 'image/jpeg,image/png,image/webp';
    fileInput.setAttribute('aria-label', `${localizedText('choosePhoto')} ${title}`);
    const status = document.createElement('span');
    status.className = 'photo-status';
    status.setAttribute('role', 'status');
    chooseButton.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      if (fileInput.files[0]) uploadPhoto(fileInput.files[0], control);
      fileInput.value = '';
    });
    actions.append(chooseButton, fileInput, status);
    control.append(actions);
    editor.append(control);
    return editor;
  }

  async function uploadPhoto(file, control) {
    const status = control.querySelector('.photo-status');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      status.dataset.adminMessageKey = 'photoTypes';
      status.textContent = localizedText('photoTypes');
      status.dataset.state = 'error';
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      status.dataset.adminMessageKey = 'photoTooLarge';
      status.textContent = localizedText('photoTooLarge');
      status.dataset.state = 'error';
      return;
    }

    status.dataset.adminMessageKey = 'uploading';
    status.textContent = localizedText('uploading');
    status.dataset.state = '';
    const button = control.querySelector('.photo-upload-button');
    button.disabled = true;
    try {
      const data = await request('/api/uploads', { method: 'POST', headers: { 'Content-Type': file.type }, body: file });
      setPath(draft, control.dataset.photoPath, data.url);
      control.querySelector('[data-content-path]').value = data.url;
      control.querySelector('.photo-preview').src = data.url;
      markChanged();
      status.dataset.adminMessageKey = 'photoReady';
      status.textContent = localizedText('photoReady');
    } catch (error) {
      status.textContent = error.message;
      status.dataset.state = 'error';
    } finally {
      button.disabled = false;
    }
  }

  function render(content) {
    draft = structuredClone(content);
    contentPanel.querySelectorAll('[data-content-path]').forEach((control) => {
      control.value = getPath(draft, control.dataset.contentPath) || '';
    });

    journeyFields.replaceChildren();
    draft.journeys.forEach((journey, index) => {
      const group = document.createElement('article');
      group.className = 'journey-editor';
      group.append(
        makeField('destinationTitle', `journeys.${index}.title`, journey.title),
        makeField('smallLabel', `journeys.${index}.label`, journey.label),
        makeField('tripDuration', `journeys.${index}.duration`, journey.duration),
        makeField('descriptionLabel', `journeys.${index}.description`, journey.description, true),
        makeField('photoAccessibility', `journeys.${index}.alt`, journey.alt),
        makePhotoEditor(`${journey.title} photo`, `journeys.${index}.image`, journey.image, journey.alt)
      );
      journeyFields.append(group);
    });
    landPhoto.replaceChildren(makePhotoEditor('Song-Kol section photo', 'land.image', draft.land.image, draft.land.alt));
    contentSave.disabled = true;
    setStatus('savedStatus');
  }

  document.addEventListener('admin-language-changed', (event) => {
    contentPanel.querySelectorAll('[data-admin-dynamic]').forEach((element) => {
      element.textContent = localizedText(element.dataset.adminDynamic);
    });
    contentPanel.querySelectorAll('[data-photo-title]').forEach((heading) => {
      heading.textContent = `${heading.dataset.photoTitle} ${localizedText('photoWord', 'photo')}`;
    });
    contentPanel.querySelectorAll('[data-admin-message-key]').forEach((status) => {
      status.textContent = localizedText(status.dataset.adminMessageKey);
    });

    if (!savedContent || currentLocale === event.detail.language) return;
    localeDrafts[currentLocale] = structuredClone(draft);
    currentLocale = event.detail.language;
    const nextDraft = dirtyLocales.has(currentLocale)
      ? structuredClone(localeDrafts[currentLocale])
      : makeLocaleDraft(currentLocale);
    localeDrafts[currentLocale] = structuredClone(nextDraft);
    render(nextDraft);
    contentSave.disabled = !dirtyLocales.has(currentLocale);
    if (dirtyLocales.has(currentLocale)) setStatus('unsavedStatus');
  });

  contentPanel.addEventListener('input', (event) => {
    const control = event.target.closest('[data-content-path]');
    if (!control || !draft) return;
    setPath(draft, control.dataset.contentPath, control.value);
    if (control.dataset.contentPath.endsWith('.image')) {
      control.closest('.photo-control').querySelector('.photo-preview').src = control.value;
    }
    markChanged();
  });

  contentPanel.addEventListener('dragover', (event) => {
    if (!event.target.closest('.photo-control')) return;
    event.preventDefault();
    document.body.classList.add('drag-over');
  });

  contentPanel.addEventListener('dragleave', (event) => {
    if (!event.relatedTarget || !contentPanel.contains(event.relatedTarget)) document.body.classList.remove('drag-over');
  });

  contentPanel.addEventListener('drop', (event) => {
    const control = event.target.closest('.photo-control');
    if (!control) return;
    event.preventDefault();
    document.body.classList.remove('drag-over');
    if (event.dataTransfer.files[0]) uploadPhoto(event.dataTransfer.files[0], control);
  });

  document.addEventListener('paste', (event) => {
    const control = document.activeElement.closest?.('.photo-control');
    const item = [...(event.clipboardData?.items || [])].find((entry) => entry.type.startsWith('image/'));
    const image = item?.getAsFile();
    if (!control || !image) return;
    event.preventDefault();
    uploadPhoto(image, control);
  });

  contentForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    contentSave.disabled = true;
    setStatus('savingStatus');
    try {
      await request('/api/content', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: currentLocale, content: draft })
      });
      if (currentLocale === 'en') {
        savedContent = { ...savedContent, ...structuredClone(draft) };
      } else {
        savedContent.locales = { ...savedContent.locales, [currentLocale]: structuredClone(draft) };
      }
      localeDrafts[currentLocale] = structuredClone(draft);
      dirtyLocales.delete(currentLocale);
      setStatus('savedRefresh');
    } catch (error) {
      setStatus(error.message, true);
      contentSave.disabled = false;
    }
  });

  window.loadWebsiteContent = async () => {
    const data = await request('/api/content');
    savedContent = data.content;
    currentLocale = window.adminLocale || 'en';
    const initialDraft = makeLocaleDraft(currentLocale);
    localeDrafts[currentLocale] = structuredClone(initialDraft);
    render(initialDraft);
  };
})();