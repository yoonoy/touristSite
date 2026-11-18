# Travel Horizon

The admin panel includes a visual editor for homepage and destination text, photo URLs, and photo uploads. Editable copy is stored in PostgreSQL; uploaded photos are stored in `data/uploads/`. An advanced source editor is also available for the public files in `public/`.

## Project layout

- `public/` contains the visitor-facing page, styles, scripts, and translations.
- `admin/` contains the admin page, styles, and editor scripts.
- `data/content.json` is imported once to seed an empty PostgreSQL database.
- `data/uploads/` is created when the first photo is uploaded.
- `.env` stores local environment variables and is excluded from Git.
- `.env.example` lists the PostgreSQL and Telegram configuration keys without credentials.
- `server.js` serves the site and admin UI, and handles login, content, and photo APIs.
- PostgreSQL stores the site's content in the `site_content` table.
- `openapi.json` describes the HTTP API, and Swagger UI is available at `/api-docs`.
- `package.json` defines the local start command.
- `README.md` contains setup and security notes.

## Start the site

Use Node.js 18 or newer and PostgreSQL. Create a database and configure its connection string in `.env`:

```sh
createdb tourist_site
```

Set `DATABASE_URL` in `.env` to a PostgreSQL connection URL for that database (see `.env.example`). The PostgreSQL user must be allowed to connect and create tables. On its first start, the server creates `site_content` and imports `data/content.json` only if the table has no content yet. After that, PostgreSQL is the source of truth; admin edits are saved there.

Start the server from this project folder:

```sh
ADMIN_PASSWORD='' npm start
```

The local admin password is `12345`. To use a different password, set `ADMIN_PASSWORD` to a value of at least 5 characters before starting the server. Keep the server running, then open the public website at <http://127.0.0.1:4173> and click **Admin** (or open <http://127.0.0.1:4173/admin>). Do not open the HTML files directly or use a static-file preview server; editing and saved content both use this local server.

Browse and try the documented API at <http://127.0.0.1:4173/api-docs>. The raw OpenAPI specification is at <http://127.0.0.1:4173/api-docs/openapi.json>. Admin endpoints require signing in and keeping the session cookie; write operations also require a same-origin request.

For Telegram configuration, put your bot token in `TELEGRAM_BOT_TOKEN` and the destination chat ID in `TELEGRAM_CHAT_ID` in `.env`. The consultation form at the bottom of the homepage sends the visitor's name, surname, phone number, and selected destination to that chat. Keep the token private; it is only used by the server.

The server intentionally listens only on `127.0.0.1`. This prototype is not a public multi-user deployment: anyone with access to this computer and the password can edit the site. Photo uploads accept JPEG, PNG, and WebP up to 8 MB. Do not expose it to the internet. A hosted version needs HTTPS, persistent user accounts and roles, production-grade password hashing, backups, and a deployment workflow that publishes approved content safely.