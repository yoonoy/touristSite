# Travel Horizon

The admin panel includes a visual editor for homepage and destination text, photo URLs, and photo uploads. Uploaded photos are stored in `data/uploads/`, and editable copy is stored in `data/content.json`. An advanced source editor is also available for the public files in `public/`.

## Project layout

- `public/` contains the visitor-facing page, styles, scripts, and translations.
- `admin/` contains the admin page, styles, and editor scripts.
- `data/` contains saved website content and uploaded photos.
- `data/uploads/` is created when the first photo is uploaded.
- `.env` stores local environment variables and is excluded from Git.
- `.env.example` lists the Telegram configuration keys without credentials.
- `server.js` serves the site and admin UI, and handles login, content, and photo APIs.
- `package.json` defines the local start command.
- `README.md` contains setup and security notes.

## Start the site

Use Node.js 18 or newer and start the server from this project folder:

```sh
npm start
```

The local admin password is `12345`. To use a different password, set `ADMIN_PASSWORD` to a value of at least 5 characters before starting the server. Keep the server running, then open the public website at <http://127.0.0.1:4173> and click **Admin** (or open <http://127.0.0.1:4173/admin>). Do not open the HTML files directly or use a static-file preview server; editing and saved content both use this local server.

For Telegram configuration, put your bot token in `TELEGRAM_BOT_TOKEN` and the destination chat ID in `TELEGRAM_CHAT_ID` in `.env`. The consultation form at the bottom of the homepage sends the visitor's name, surname, phone number, and selected destination to that chat. Keep the token private; it is only used by the server.

The server intentionally listens only on `127.0.0.1`. This prototype is not a public multi-user deployment: anyone with access to this computer and the password can edit the site. The default password is for local testing only; set a unique `ADMIN_PASSWORD` and do not expose this server to the internet. Photo uploads accept JPEG, PNG, and WebP up to 8 MB. A hosted version needs HTTPS, persistent user accounts and roles, production-grade password hashing, backups, and a deployment workflow that publishes approved content safely.