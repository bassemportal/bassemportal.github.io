(() => {
  let deferredPrompt = null;
  const button = document.getElementById('installAppBtn');
  const help = document.getElementById('installAppHelp');
  if (!button) return;

  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (isStandalone) {
    button.textContent = 'BassemTV is installed';
    button.disabled = true;
    if (help) help.textContent = 'You are using the installed app.';
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredPrompt = event;
  });

  button.addEventListener('click', async () => {
    if (isStandalone) return;
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (help) help.textContent = choice.outcome === 'accepted' ? 'Installation started.' : 'Installation was cancelled.';
      deferredPrompt = null;
      return;
    }
    if (help) help.textContent = 'In Chrome, open the ⋮ menu and choose “Install app” or “Add to Home screen”.';
  });

  window.addEventListener('appinstalled', () => {
    button.textContent = 'BassemTV is installed';
    button.disabled = true;
    if (help) help.textContent = 'You can now open BassemTV from your home screen.';
  });
})();
