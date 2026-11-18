(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const cfg = window.BASSEM_CONFIG || {};
  const message = (text, error=false) => {
    $("resetMessage").textContent = text;
    $("resetMessage").classList.toggle("error", error);
  };
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY || cfg.SUPABASE_ANON_KEY.includes("PASTE_YOUR")) {
    $("loadingState").classList.add("hidden");
    message("Supabase is not configured. Please contact the administrator.", true);
    return;
  }
  const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  let recoveryReady = false;
  let finished = false;
  const showForm = () => {
    if (finished) return;
    recoveryReady = true;
    $("loadingState").classList.add("hidden");
    $("passwordForm").classList.remove("hidden");
    message("");
  };
  const hash = new URLSearchParams(location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(location.search);
  const urlError = hash.get("error_description") || query.get("error_description") || hash.get("error") || query.get("error");
  if (urlError) {
    $("loadingState").classList.add("hidden");
    message(decodeURIComponent(urlError.replace(/\+/g, " ")), true);
    return;
  }
  const { data: listener } = sb.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY" && session) showForm();
  });
  sb.auth.getSession().then(({ data, error }) => {
    if (error) throw error;
    // Supabase's implicit flow returns type=recovery in the URL fragment.
    if (data.session && (hash.get("type") === "recovery" || recoveryReady)) showForm();
    else if (!recoveryReady) {
      $("loadingState").classList.add("hidden");
      message("This recovery link is invalid, expired, or already used. Request a new password-reset email.", true);
    }
  }).catch(err => {
    $("loadingState").classList.add("hidden");
    message(err.message || "Unable to verify this recovery link.", true);
  });
  $("passwordForm").addEventListener("submit", async event => {
    event.preventDefault();
    if (!recoveryReady) return;
    const password = $("password").value;
    if (password.length < 8) return message("Use at least 8 characters for your password.", true);
    if (password !== $("confirmPassword").value) return message("The passwords do not match.", true);
    const button = $("saveButton");
    button.disabled = true;
    button.textContent = "Saving…";
    try {
      const { error } = await sb.auth.updateUser({ password });
      if (error) throw error;
      finished = true;
      $("passwordForm").classList.add("hidden");
      message("Your password has been updated successfully. You can now sign in.");
      await sb.auth.signOut();
    } catch (err) {
      message(err.message || "Unable to update your password.", true);
      button.disabled = false;
      button.textContent = "Save new password";
    }
  });
  window.addEventListener("beforeunload", () => listener.subscription.unsubscribe());
})();
