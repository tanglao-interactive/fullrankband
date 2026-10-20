(function () {
  if (!window.firebase || !firebase.apps.length) return;
  const emulatorHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  const useEmulators = emulatorHosts.has(window.location.hostname);

  window.fullRankFirebase = {
    useEmulators,
    db: firebase.firestore(),
    storage: firebase.storage()
  };

  if (firebase.auth) {
    window.fullRankFirebase.auth = firebase.auth();
  }

  if (useEmulators) {
    window.fullRankFirebase.db.useEmulator("127.0.0.1", 8180);
    window.fullRankFirebase.storage.useEmulator("127.0.0.1", 9199);

    if (window.fullRankFirebase.auth) {
      window.fullRankFirebase.auth.useEmulator("http://127.0.0.1:9099", {
        disableWarnings: true
      });
    }
  }
})();
