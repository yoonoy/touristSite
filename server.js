const http = require('node:http');
const { createHash, randomBytes, timingSafeEqual } = require('node:crypto');
const { mkdir, readFile, rename, writeFile } = require('node:fs/promises');
const path = require('node:path');

const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT || 4173);
const PUBLIC_DIR = path.join(__dirname, 'public');
const ADMIN_DIR = path.join(__dirname, 'admin');
const DATA_DIR = path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const CONTENT_FILE = path.join(DATA_DIR, 'content.json');
const SESSION_TTL = 12 * 60 * 60 * 1000;
const MAX_BODY_SIZE = 1_000_000;
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const IMAGE_TYPES = new Map([
  ['image/jpeg', { extension: 'jpg', signature: Buffer.from([0xff, 0xd8, 0xff]) }],
  ['image/png', { extension: 'png', signature: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) }],
  ['image/webp', { extension: 'webp', signature: Buffer.from('RIFF'), webp: Buffer.from('WEBP') }]
]);
const EDITABLE_FILES = new Set(['index.html', 'styles.css', 'script.js']);
const PUBLIC_FILES = new Map([
  ['/', [path.join(PUBLIC_DIR, 'index.html'), 'text/html; charset=utf-8']],
  ['/index.html', [path.join(PUBLIC_DIR, 'index.html'), 'text/html; charset=utf-8']],
  ['/admin', [path.join(ADMIN_DIR, 'admin.html'), 'text/html; charset=utf-8']],
  ['/admin.html', [path.join(ADMIN_DIR, 'admin.html'), 'text/html; charset=utf-8']],
  ['/styles.css', [path.join(PUBLIC_DIR, 'styles.css'), 'text/css; charset=utf-8']],
  ['/script.js', [path.join(PUBLIC_DIR, 'script.js'), 'text/javascript; charset=utf-8']],
  ['/translations.js', [path.join(PUBLIC_DIR, 'translations.js'), 'text/javascript; charset=utf-8']],
  ['/admin.css', [path.join(ADMIN_DIR, 'admin.css'), 'text/css; charset=utf-8']],
  ['/admin.js', [path.join(ADMIN_DIR, 'admin.js'), 'text/javascript; charset=utf-8']],
  ['/admin-language.js', [path.join(ADMIN_DIR, 'admin-language.js'), 'text/javascript; charset=utf-8']],
  ['/content-editor.js', [path.join(ADMIN_DIR, 'content-editor.js'), 'text/javascript; charset=utf-8']]
]);
const sessions = new Map();
const loginAttempts = new Map();
const password = process.env.ADMIN_PASSWORD;

if (!password || password.length < 5) {
  console.error('Set ADMIN_PASSWORD to at least 5 characters before starting the server.');
  process.exit(1);
}

function sendJson(response, status, data, headers = {}) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers
  });
  response.end(JSON.stringify(data));
}

function sendText(response, status, text) {
  response.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  response.end(text);
}

async function readJson(request) {
  if (!request.headers['content-type']?.includes('application/json')) {
    throw Object.assign(new Error('Expected JSON request body.'), { status: 415 });
  }

  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (Buffer.byteLength(body) > MAX_BODY_SIZE) {
      throw Object.assign(new Error('Request body is too large.'), { status: 413 });
    }
  }

  try {
    return JSON.parse(body);
  } catch {
    throw Object.assign(new Error('Request body must be valid JSON.'), { status: 400 });
  }
}

function getSession(request) {
  const cookieHeader = request.headers.cookie || '';
  const token = cookieHeader.match(/(?:^|;\s*)admin_session=([a-f0-9]+)/)?.[1];
  const expiresAt = token && sessions.get(token);

  if (!expiresAt || expiresAt < Date.now()) {
    if (token) sessions.delete(token);
    return null;
  }

  sessions.set(token, Date.now() + SESSION_TTL);
  return token;
}

function requireSession(request, response) {
  if (getSession(request)) return true;
  sendJson(response, 401, { error: 'Sign in to continue.' });
  return false;
}

function checkSameOrigin(request) {
  const origin = request.headers.origin;
  const host = request.headers.host;
  return Boolean(origin && host && origin === `http://${host}`);
}

function safeFileName(urlPath) {
  const prefix = '/api/files/';
  if (!urlPath.startsWith(prefix)) return null;
  let name;
  try {
    name = decodeURIComponent(urlPath.slice(prefix.length));
  } catch {
    return null;
  }
  return EDITABLE_FILES.has(name) ? name : null;
}

async function readBinary(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_IMAGE_SIZE) {
      throw Object.assign(new Error('Photos must be smaller than 8 MB.'), { status: 413 });
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function isText(value) {
  return typeof value === 'string' && value.length <= 2000;
}

function isImageLocation(value) {
  return typeof value === 'string' && (
    value.startsWith('https://') || /^\/uploads\/[a-f0-9]{32}\.(jpg|png|webp)$/.test(value)
  );
}

function isValidContent(content) {
  if (!content || typeof content !== 'object' || !content.hero || !content.land || !Array.isArray(content.journeys)) return false;
  if (content.journeys.length !== 3) return false;
  const heroValid = ['eyebrow', 'titleLine', 'titleEmphasis', 'copyFirst', 'copySecond'].every((key) => isText(content.hero[key]));
  const landValid = ['titleLine', 'titleEmphasis', 'description', 'image', 'alt', 'caption'].every((key) =>
    key === 'image' ? isImageLocation(content.land[key]) : isText(content.land[key])
  );
  const journeysValid = content.journeys.every((journey) =>
    journey && ['label', 'duration', 'title', 'description', 'alt'].every((key) => isText(journey[key])) && isImageLocation(journey.image)
  );
  return heroValid && landValid && journeysValid;
}

async function writeJsonFile(filePath, value) {
  const tempPath = `${filePath}.${randomBytes(6).toString('hex')}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  await rename(tempPath, filePath);
}

async function handleRequest(request, response) {
  const url = new URL(request.url, `http://${request.headers.host || `${HOST}:${PORT}`}`);

  if (request.method === 'POST' && url.pathname === '/api/login') {
    const address = request.socket.remoteAddress || 'local';
    const attempt = loginAttempts.get(address) || { count: 0, lockedUntil: 0 };
    if (attempt.lockedUntil > Date.now()) {
      sendJson(response, 429, { error: 'Too many attempts. Try again later.' });
      return;
    }

    const body = await readJson(request);
    const candidate = typeof body.password === 'string' ? body.password : '';
    const expectedHash = createHash('sha256').update(password).digest();
    const actualHash = createHash('sha256').update(candidate).digest();
    if (!timingSafeEqual(actualHash, expectedHash)) {
      attempt.count += 1;
      if (attempt.count >= 5) attempt.lockedUntil = Date.now() + 15 * 60 * 1000;
      loginAttempts.set(address, attempt);
      sendJson(response, 401, { error: 'That password did not match.' });
      return;
    }

    loginAttempts.delete(address);
    const token = randomBytes(32).toString('hex');
    sessions.set(token, Date.now() + SESSION_TTL);
    sendJson(response, 200, { ok: true }, {
      'Set-Cookie': `admin_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL / 1000}`
    });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/logout') {
    const token = getSession(request);
    if (token) sessions.delete(token);
    sendJson(response, 200, { ok: true }, {
      'Set-Cookie': 'admin_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'
    });
    return;
  }

  if (url.pathname === '/api/content' && request.method === 'GET') {
    const content = JSON.parse(await readFile(CONTENT_FILE, 'utf8'));
    sendJson(response, 200, { content });
    return;
  }

  if (url.pathname === '/api/content' && request.method === 'PUT') {
    if (!requireSession(request, response)) return;
    if (!checkSameOrigin(request)) {
      sendJson(response, 403, { error: 'Request origin was not allowed.' });
      return;
    }
    const body = await readJson(request);
    const locale = body.locale || 'en';
    if (!['en', 'ky', 'ru'].includes(locale) || !isValidContent(body.content)) {
      sendJson(response, 400, { error: 'Some text or photo values are invalid.' });
      return;
    }
    const savedContent = JSON.parse(await readFile(CONTENT_FILE, 'utf8'));
    const nextContent = locale === 'en'
      ? { ...savedContent, ...body.content }
      : { ...savedContent, locales: { ...savedContent.locales, [locale]: body.content } };
    await writeJsonFile(CONTENT_FILE, nextContent);
    sendJson(response, 200, { ok: true });
    return;
  }

  if (url.pathname === '/api/uploads' && request.method === 'POST') {
    if (!requireSession(request, response)) return;
    if (!checkSameOrigin(request)) {
      sendJson(response, 403, { error: 'Request origin was not allowed.' });
      return;
    }
    const mimeType = request.headers['content-type'];
    const imageType = IMAGE_TYPES.get(mimeType);
    if (!imageType) {
      sendJson(response, 415, { error: 'Choose a JPEG, PNG, or WebP image.' });
      return;
    }
    const image = await readBinary(request);
    const hasSignature = image.subarray(0, imageType.signature.length).equals(imageType.signature);
    const isWebp = mimeType !== 'image/webp' || image.subarray(8, 12).equals(imageType.webp);
    if (!hasSignature || !isWebp || image.length === 0) {
      sendJson(response, 400, { error: 'The selected file is not a valid image of that type.' });
      return;
    }
    const fileName = `${randomBytes(16).toString('hex')}.${imageType.extension}`;
    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(path.join(UPLOAD_DIR, fileName), image, { flag: 'wx' });
    sendJson(response, 201, { url: `/uploads/${fileName}` });
    return;
  }

  const uploadName = url.pathname.match(/^\/uploads\/([a-f0-9]{32}\.(?:jpg|png|webp))$/)?.[1];
  if (request.method === 'GET' && uploadName) {
    const image = await readFile(path.join(UPLOAD_DIR, uploadName));
    const extension = path.extname(uploadName);
    const mimeType = extension === '.jpg' ? 'image/jpeg' : extension === '.png' ? 'image/png' : 'image/webp';
    response.writeHead(200, { 'Content-Type': mimeType, 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' });
    response.end(image);
    return;
  }

  if (url.pathname === '/api/files' && request.method === 'GET') {
    if (!requireSession(request, response)) return;
    sendJson(response, 200, { files: [...EDITABLE_FILES] });
    return;
  }

  const fileName = safeFileName(url.pathname);
  if (fileName && request.method === 'GET') {
    if (!requireSession(request, response)) return;
    const content = await readFile(path.join(PUBLIC_DIR, fileName), 'utf8');
    sendJson(response, 200, { name: fileName, content });
    return;
  }

  if (fileName && request.method === 'PUT') {
    if (!requireSession(request, response)) return;
    if (!checkSameOrigin(request)) {
      sendJson(response, 403, { error: 'Request origin was not allowed.' });
      return;
    }
    const body = await readJson(request);
    if (typeof body.content !== 'string') {
      sendJson(response, 400, { error: 'File content must be text.' });
      return;
    }
    const filePath = path.join(PUBLIC_DIR, fileName);
    const tempPath = `${filePath}.${randomBytes(6).toString('hex')}.tmp`;
    await writeFile(tempPath, body.content, { encoding: 'utf8', flag: 'wx' });
    await rename(tempPath, filePath);
    sendJson(response, 200, { ok: true, name: fileName });
    return;
  }

  if (request.method === 'GET' && PUBLIC_FILES.has(url.pathname)) {
    const [fileName, contentType] = PUBLIC_FILES.get(url.pathname);
    const content = await readFile(fileName);
    response.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'self' https: data:; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' https: data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'"
    });
    response.end(content);
    return;
  }

  sendText(response, 404, 'Not found.');
}

const server = http.createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    if (response.headersSent) {
      response.destroy();
      return;
    }
    const status = error.status || 500;
    if (status === 500) console.error(error);
    sendJson(response, status, { error: status === 500 ? 'The server could not complete that request.' : error.message });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Travel Horizon is running at http://${HOST}:${PORT}`);
  console.log(`Admin panel: http://${HOST}:${PORT}/admin`);
});