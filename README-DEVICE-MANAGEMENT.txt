BassemTV Device Management Update

Included:
- Last connection timestamp (uses mac_devices.last_seen; null values show Never connected).
- Inactivity filters: 7, 15, and 30+ days. Devices that have never connected are included in each inactivity filter.
- Bulk select, enable, disable, and delete. Bulk delete asks for confirmation and removes playlist assignments before deleting devices.
- Per-device playlist assignment history, including assigned/unassigned events and timestamps.
- Service worker cache version bumped to force the new files to refresh after deployment.

IMPORTANT DEPLOYMENT ORDER
1. In Supabase Dashboard, open SQL Editor and run playlist-assignment-history.sql.
   This creates the history table and trigger, secures reads with the existing
   public.is_dashboard_admin() function, and seeds current assignments as the
   initial history. Future assignment additions/removals are then recorded.
2. In the GitHub Pages repository root, replace ONLY these four files:
   - index.html
   - app.js
   - style.css
   - sw.js
3. Do not replace config.js. No Edge Function deployment is required.
4. Commit the files, wait for GitHub Pages to publish, then open the dashboard
   and press Ctrl+F5 (or clear the site cache if the old version remains).
5. Test the Devices page: filter inactive devices, select a few, test Enable or
   Disable, and open History for a device. Test bulk Delete only with test data.

The history log records changes from the time the SQL migration is installed.
Existing current assignments are seeded once; assignments deleted before this
migration cannot be reconstructed retroactively.
