# Travel Horizon local editor

The admin panel includes a visual editor for homepage and destination text, photo URLs, and photo uploads. Uploaded photos are stored in `uploads/`, and editable copy is stored in `content.json`. An advanced source editor is also available for `index.html`, `styles.css`, and `script.js`.

## Start the site

Use Node.js 18 or newer. Set an admin password of at least 5 characters and start the server from this project folder. Short passwords are only suitable for local testing:

```sh
ADMIN_PASSWORD='use-a-long-unique-password-here' npm start
```

Open the public website at <http://127.0.0.1:4173> and the editor at <http://127.0.0.1:4173/admin>.

The server intentionally listens only on `127.0.0.1`. This prototype is not a public multi-user deployment: anyone with access to this computer and the password can edit the site. Photo uploads accept JPEG, PNG, and WebP up to 8 MB. Do not expose it to the internet. A hosted version needs HTTPS, persistent user accounts and roles, production-grade password hashing, backups, and a deployment workflow that publishes approved content safely.