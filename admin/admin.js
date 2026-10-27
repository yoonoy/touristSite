const loginView = document.querySelector('#login-view');
const editorView = document.querySelector('#editor-view');
const loginForm = document.querySelector('#login-form');
const loginMessage = document.querySelector('#login-message');
const passwordInput = document.querySelector('#password');
const fileSelect = document.querySelector('#file-select');
const fileEditor = document.querySelector('#file-editor');
const saveButton = document.querySelector('#save-button');
const logoutButton = document.querySelector('#logout-button');
const fileState = document.querySelector('#file-state');
const lineNumbers = document.querySelector('#line-numbers');

let savedContent = '';
let selectedFile = '';

async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(path, {
      credentials: 'same-origin',
      ...options,
      headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers }
    });
  } catch {
    throw new Error('Cannot reach the local server. Start it and open http://127.0.0.1:4173/admin.html.');
  }

  const responseBody = await response.text();
  let data;
  try {
    data = responseBody ? JSON.parse(responseBody) : {};
  } catch {
    throw new Error('The server returned an unreadable response. Open http://127.0.0.1:4173/admin.html.');
  }
  if (!response.ok) throw new Error(data.error || 'The request could not be completed.');
  return data;
}

function setFileState(message, state = '') {
  fileState.textContent = message;
  fileState.dataset.state = state;
}

function updateLineNumbers() {
  const count = fileEditor.value.split('\n').length;
  lineNumbers.textContent = Array.from({ length: count }, (_, index) => index + 1).join('\n');
  lineNumbers.scrollTop = fileEditor.scrollTop;
}

async function loadSelectedFile() {
  const file = fileSelect.value;
  if (!file) return;
  setFileState('Loading…');
  fileEditor.disabled = true;
  saveButton.disabled = true;
  try {
    const data = await api(`/api/files/${encodeURIComponent(file)}`);
    selectedFile = data.name;
    savedContent = data.content;
    fileEditor.value = data.content;
    fileEditor.disabled = false;
    updateLineNumbers();
    setFileState('All changes saved');
  } catch (error) {
    setFileState(error.message, 'error');
    if (error.message === 'Sign in to continue.') showLogin();
  }
}

function showEditor() {
  loginView.hidden = true;
  editorView.hidden = false;
}

function showLogin() {
  editorView.hidden = true;
  loginView.hidden = false;
  passwordInput.focus();
}

async function openEditor() {
  const data = await api('/api/files');
  fileSelect.replaceChildren(...data.files.map((file) => new Option(file, file)));
  showEditor();
  await loadSelectedFile();
  await window.loadWebsiteContent();
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginMessage.textContent = '';
  const submitButton = loginForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  try {
    await api('/api/login', { method: 'POST', body: JSON.stringify({ password: passwordInput.value }) });
    passwordInput.value = '';
    await openEditor();
  } catch (error) {
    loginMessage.textContent = error.message;
  } finally {
    submitButton.disabled = false;
  }
});

fileSelect.addEventListener('change', async () => {
  if (fileEditor.value !== savedContent && !window.confirm('Discard unsaved changes?')) {
    fileSelect.value = selectedFile;
    return;
  }
  await loadSelectedFile();
});

fileEditor.addEventListener('input', () => {
  saveButton.disabled = fileEditor.value === savedContent;
  setFileState(saveButton.disabled ? 'All changes saved' : 'Unsaved changes');
  updateLineNumbers();
});

fileEditor.addEventListener('scroll', () => {
  lineNumbers.scrollTop = fileEditor.scrollTop;
});

saveButton.addEventListener('click', async () => {
  saveButton.disabled = true;
  setFileState('Saving…');
  try {
    await api(`/api/files/${encodeURIComponent(selectedFile)}`, {
      method: 'PUT',
      body: JSON.stringify({ content: fileEditor.value })
    });
    savedContent = fileEditor.value;
    setFileState('All changes saved');
  } catch (error) {
    setFileState(error.message, 'error');
    saveButton.disabled = fileEditor.value === savedContent;
  }
});

logoutButton.addEventListener('click', async () => {
  await api('/api/logout', { method: 'POST' }).catch(() => {});
  showLogin();
});

document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's' && !editorView.hidden) {
    event.preventDefault();
    if (!saveButton.disabled) saveButton.click();
  }
});

if (window.location.protocol === 'file:') {
  passwordInput.disabled = true;
  loginForm.querySelector('button[type="submit"]').disabled = true;
  loginMessage.textContent = 'Sign-in needs the local server. Open http://127.0.0.1:4173/admin.html.';
} else {
  api('/api/files').then(openEditor).catch(() => {});
}