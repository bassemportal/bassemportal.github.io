# BassemTV Admin

Responsive, installable, plain HTML/CSS/JavaScript admin dashboard for the BassemTV Supabase project. No React, Vite, build step, or service-role key.

## 1. Configure Supabase

1. Open `config.js`.
2. Keep the project URL or change it if required.
3. Replace `PASTE_YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY_HERE` with the project's **publishable key** (or legacy `anon` key).
4. Never paste a `service_role` / secret key into this browser project.

The publishable key is expected to be visible in browser JavaScript. Security must be enforced by RLS and server-side functions, not by hiding the key.

## 2. Database setup already applied for this project

The dashboard expects the following setup to have been applied in the BassemTV Supabase project:

- `public.dashboard_users` with `role` (`superadmin` or `admin`) and `status` (`pending`, `active`, `disabled`, `rejected`).
- An `auth.users` trigger that creates a new `admin` profile with `pending` status.
- `public.is_dashboard_superadmin()` and `public.is_dashboard_admin()` authorization functions.
- `public.manage_dashboard_user(uuid,text)` RPC, callable only by an active Super Admin.
- RLS enabled on `dashboard_users`, `mac_devices`, `playlists`, `playlist_assignments`, `servers`, and `app_set_devices`.
- Active-admin RLS policies on the five BassemTV data tables.

Do not add broad policies such as `USING (true)` to these tables. That would bypass the intended administrator approval model.

The first Super Admin is promoted manually in Supabase SQL Editor. Public registration always creates a pending ordinary Admin; registration metadata cannot select a role or activate an account.

## 3. Authentication setup

- Enable email/password authentication in Supabase Auth.
- Decide whether email confirmation is required for new registrations.
- In **Authentication → URL Configuration**, add the deployed dashboard URL to the allowed Redirect URLs. Password recovery and confirmation links return to this page.
- Configure SMTP / custom email delivery for reliable production confirmation and password-reset emails.
- Admin login checks `dashboard_users.status`; only `active` accounts enter the dashboard.
- Pending, rejected, and disabled accounts are signed out and shown an explanatory message.
- Super Admin alone sees the Dashboard Users page and can approve, reject, or disable ordinary Admin accounts.

## 4. Dashboard features

- Email/password login and sign out.
- Public registration that creates pending Admin accounts.
- Email password-recovery flow.
- Super Admin-only user approval, rejection, and disable controls.
- Overview counts and recent devices.
- Create one playlist per valid MAC line.
- Server-derived playlist name and portal URL.
- Sample metadata defaults, including `expiration_date: null`, zero counts, and the requested stalker token.
- Optional assignment of newly created playlists to selected devices.
- Bulk many-to-many assignments with duplicate ignoring.
- Playlist edit/delete.
- Device create, enable/disable, delete (also removes its assignment rows).
- Server create, edit, enable/disable, delete.
- Responsive dark/gold UI and PWA shell.

## 5. Passkeys / fingerprint login

This build includes Supabase Auth passkey registration and sign-in. Passkey support is experimental and requires Supabase Auth passkeys enabled for the project.

1. In Supabase Dashboard, open Authentication → Passkeys and enable passkey authentication.
2. Set Relying Party Display Name to `BassemTV`.
3. Set Relying Party ID to `bassemportal.github.io` (domain only; no scheme or path).
4. Set Relying Party Origins to `https://bassemportal.github.io`.
5. Deploy this dashboard over HTTPS and keep the configured project key in `config.js`.
6. Sign in with email/password, open Settings, and choose Register this phone. Then sign out and test Use fingerprint / passkey.

The login uses Supabase `signInWithPasskey()` and the settings page uses `registerPasskey()`, `auth.passkey.list()`, and `auth.passkey.delete()`. Android may prompt for fingerprint, face unlock, or device PIN depending on device settings. Biometric data is not sent to Supabase. Email/password remains available as a fallback. Passkeys are tied to the relying-party domain, so do not change the GitHub Pages domain after registration without planning passkey migration.


## 6. Publish on GitHub Pages

Upload the files in this folder to the root of a GitHub repository (or the selected Pages folder), enable GitHub Pages, and open the published URL. You can also test locally using a simple static HTTP server. Opening `index.html` as a `file://` URL may limit service-worker installation.

## Playlist generation details

- Host identifier: hostname without its final domain segment. For example, `http://100main.cc` becomes `100main`, and `http://ter.main.com` becomes `ter.main`.
- Playlist name: `<host_identifier>_<12-character-uppercase-MAC>`.
- Database device MAC values are normalized to 12 uppercase hex characters, matching the supplied `mac_devices` sample.
- The playlist URL field is stored as `s:` followed by JSON. The `m` field inside that JSON uses colon-separated uppercase MAC notation, as in the supplied sample.
- A host URL with a path keeps that path; a host without a path gets `/c` appended.
- `sn` and `adid` use the supplied sample defaults.

## Notes

- The app does not read or write `app_set_devices`; that is separate runtime/device-state data.
- Device deletion removes matching assignment rows first because the supplied schema does not define a foreign key from `playlist_assignments.device_mac` to `mac_devices.mac`.
- Playlist deletion relies on the supplied `ON DELETE CASCADE` foreign key for assignment cleanup.
- The dashboard loads up to 5,000 rows per data table in one request. For larger deployments, add server-side pagination.
- The browser uses only the Supabase publishable/anon key. Never use a service-role or secret key here.
- After deploying changes, the service-worker cache version is incremented so clients fetch the updated files.

## 7. Install as an Android PWA

1. Deploy the files to the same GitHub Pages location as the dashboard. Keep your existing `config.js` and its working Supabase publishable/anon key; do not replace it with a placeholder copy from an archive.
2. Open the HTTPS GitHub Pages dashboard URL in Chrome on Android.
3. Tap **Install BassemTV on this phone**. If Chrome does not show its install prompt, open Chrome's ⋮ menu and choose **Install app** or **Add to Home screen**.
4. Launch BassemTV from the new home-screen icon. The app shell can load offline, but Supabase login and dashboard data require an internet connection.

This package makes the dashboard installable as a PWA. Fingerprint/passkey login is a separate authentication change and is not enabled by this PWA shell yet; it will be added and tested next, without storing biometric data in the dashboard.
