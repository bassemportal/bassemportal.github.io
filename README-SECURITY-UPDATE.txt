BassemTV Dashboard — Session Security Update

This patch adds configurable automatic logout after inactivity.

Included files to replace in the GitHub repository root:
- index.html
- app.js
- style.css
- sw.js

Do NOT replace config.js. Keep all other existing files.

After committing, open the dashboard and press Ctrl+F5.
Then open Settings > Session security and choose 5, 10, 15, 30, or 60 minutes.
Default is 15 minutes. The choice is stored in this browser only.

Important:
This is client-side inactivity logout. Supabase Auth's own rate limits remain the
protection against repeated failed sign-in attempts. Do not treat a browser-side
counter as secure rate limiting. Login audit history for failed attempts requires
server-side logging and is not part of this patch.
