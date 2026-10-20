import './page-defaults.js';
import { cloudEnabled, adminSession, getPage, listEvents, savePage, saveEvent, deleteEvent, uploadImage } from './backend';
import { signIn, confirmSignIn, signOut, resetPassword, confirmResetPassword } from 'aws-amplify/auth';
(function () {
  let events = [];
  let selectedEventId = "";

  const defaults = window.fullRankPageDefaults;

  const loginPanel = document.getElementById("login-panel");
  const dashboard = document.getElementById("dashboard");
  const loginForm = document.getElementById("login-form");
  const loginMessage = document.getElementById("login-message");
  const pageForm = document.getElementById("page-form");
  const pageMessage = document.getElementById("page-message");
  const eventForm = document.getElementById("event-form");
  const eventMessage = document.getElementById("event-message");
  const eventList = document.getElementById("event-list");

  const deleteEventButton = document.getElementById("delete-event-button");
  const profileEmail = document.getElementById("profile-email");
  let authStep = "";
  let resetEmail = "";

  function setMessage(element, message, isError) {
    element.textContent = message;
    element.classList.toggle("error", Boolean(isError));
  }

  function formToObject(form) {
    return Array.from(new FormData(form).entries()).reduce((values, entry) => {
      const [key, value] = entry;
      values[key] = typeof value === "string" ? value.trim() : value;
      return values;
    }, {});
  }

  function fillForm(form, values) {
    Array.from(form.elements).forEach((element) => {
      if (!element.name) {
        return;
      }

      if (element.type === "checkbox") {
        element.checked = values[element.name] !== false;
        return;
      }

      element.value = values[element.name] || "";
    });
  }

  async function uploadFile(file, folder) {
    return file ? uploadImage(file, folder) : "";
  }
  function showLogin() { loginPanel.hidden = false; dashboard.hidden = true; }
  async function openDashboard() {
    const user = await adminSession();
    if (!user) { showLogin(); return; }
    loginPanel.hidden = true; dashboard.hidden = false;
    profileEmail.textContent = user.signInDetails?.loginId || user.username;
    const page = await getPage();
    fillForm(pageForm, { ...defaults, ...page });
    await refreshEvents();
  }
  async function refreshEvents() {
    events = await listEvents(); renderEventList();
    if (selectedEventId && !events.some(event => event.id === selectedEventId)) resetEventForm();
  }
  async function handleSignIn(result) {
    authStep = result.nextStep.signInStep;
    const challenge = document.getElementById('challenge-form');
    if (authStep === 'DONE') { challenge.hidden = true; loginForm.hidden = false; await openDashboard(); return; }
    if (authStep === 'RESET_PASSWORD') { await beginReset(); return; }
    const supported = ['CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED', 'CONFIRM_SIGN_IN_WITH_TOTP_CODE', 'CONFIRM_SIGN_IN_WITH_SMS_CODE', 'CONFIRM_SIGN_IN_WITH_EMAIL_CODE', 'CONFIRM_SIGN_IN_WITH_PASSWORD'];
    if (!supported.includes(authStep)) {
      await signOut();
      throw new Error('This sign-in method requires administrator assistance. Supported login: email and password.');
    }
    loginForm.hidden = true; challenge.hidden = false;
    const input = document.getElementById('challenge-response');
    const password = authStep.includes('PASSWORD');
    input.type = password ? 'password' : 'text';
    input.autocomplete = password ? 'new-password' : 'one-time-code';
    document.getElementById('challenge-label').textContent = authStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED' ? 'Choose a new password' : password ? 'Password' : 'Verification code';
    input.value = ''; input.focus();
  }
  async function beginReset() {
    resetEmail = loginForm.email.value.trim();
    if (!resetEmail) throw new Error('Enter your email address first.');
    await resetPassword({ username: resetEmail });
    document.getElementById('reset-form').hidden = false;
    document.getElementById('challenge-form').hidden = true;
    loginForm.hidden = true;
    setMessage(loginMessage, 'If the account can reset its password, a code has been sent.');
  }

  function resetEventForm() {
    selectedEventId = "";
    eventForm.reset();
    eventForm.elements.isPublished.checked = true;
    eventForm.elements.sortOrder.value = "0";
    deleteEventButton.hidden = true;
    renderEventList();
  }

  function selectEvent(id) {
    const event = events.find((item) => item.id === id);
    if (!event) {
      resetEventForm();
      return;
    }

    selectedEventId = id;
    fillForm(eventForm, event);
    eventForm.elements.id.value = id;
    deleteEventButton.hidden = false;
    renderEventList();
  }

  function renderEventList() {
    eventList.innerHTML = "";

    if (events.length === 0) {
      const empty = document.createElement("p");
      empty.className = "form-message";
      empty.textContent = "No events yet.";
      eventList.appendChild(empty);
      return;
    }

    events.forEach((event) => {
      const button = document.createElement("button");
      const meta = [event.date, event.venue].filter(Boolean).join(" | ");
      button.type = "button";
      button.className = `event-list-item${event.id === selectedEventId ? " active" : ""}`;
      button.textContent = event.title || "Untitled event";

      if (meta) {
        const metaElement = document.createElement("span");
        metaElement.textContent = meta;
        button.appendChild(metaElement);
      }

      button.addEventListener("click", () => selectEvent(event.id));
      eventList.appendChild(button);
    });
  }

  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((tab) => tab.classList.remove("active"));
      document.querySelectorAll(".panel").forEach((panel) => panel.classList.remove("active"));
      button.classList.add("active");
      document.getElementById(button.dataset.tab).classList.add("active");
    });
  });

  document.getElementById("logout-button").addEventListener("click", async () => { await signOut(); showLogin(); });
  document.getElementById("new-event-button").addEventListener("click", resetEventForm);

  loginForm.addEventListener('submit', async event => {
    event.preventDefault(); setMessage(loginMessage, 'Logging in...');
    try { await handleSignIn(await signIn({ username: loginForm.email.value.trim(), password: loginForm.password.value })); setMessage(loginMessage, ''); }
    catch (error) { setMessage(loginMessage, error.message, true); }
  });
  document.getElementById('forgot-password').addEventListener('click', async () => {
    try { await beginReset(); } catch (error) { setMessage(loginMessage, error.message, true); }
  });
  document.getElementById('challenge-form').addEventListener('submit', async event => {
    event.preventDefault();
    try { await handleSignIn(await confirmSignIn({ challengeResponse: document.getElementById('challenge-response').value })); setMessage(loginMessage, ''); }
    catch (error) { setMessage(loginMessage, error.message, true); }
  });
  document.getElementById('reset-form').addEventListener('submit', async event => {
    event.preventDefault();
    try {
      await confirmResetPassword({ username: resetEmail, confirmationCode: document.getElementById('reset-code').value, newPassword: document.getElementById('reset-password').value });
      event.target.reset(); event.target.hidden = true; loginForm.hidden = false;
      loginForm.password.value = ''; setMessage(loginMessage, 'Password reset. Sign in with your new password.');
    } catch (error) { setMessage(loginMessage, error.message, true); }
  });
  document.querySelectorAll('[data-back-login]').forEach(button => button.addEventListener('click', async () => {
    await signOut(); document.getElementById('reset-form').hidden = true; document.getElementById('challenge-form').hidden = true;
    loginForm.hidden = false; setMessage(loginMessage, '');
  }));

  pageForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setMessage(pageMessage, "Saving...", false);

    try {
      const page = formToObject(pageForm);
      const heroImageUrl = await uploadFile(
        document.getElementById("hero-image").files[0],
        "page-assets"
      );

      if (heroImageUrl) {
        page.heroImageKey = heroImageUrl;
        page.heroImageUrl = "";
        pageForm.elements.heroImageKey.value = heroImageUrl;
        pageForm.elements.heroImageUrl.value = "";
      }

      await savePage(page);
      setMessage(pageMessage, "Home page saved.", false);
    } catch (error) {
      setMessage(pageMessage, error.message, true);
    }
  });

  eventForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setMessage(eventMessage, "Saving...", false);

    try {
      const values = formToObject(eventForm);
      const eventImageUrl = await uploadFile(
        document.getElementById("event-image").files[0],
        "event-assets"
      );

      if (eventImageUrl) {
        values.imageKey = eventImageUrl;
        values.imageUrl = "";
        eventForm.elements.imageKey.value = eventImageUrl;
        eventForm.elements.imageUrl.value = "";
      }

      const payload = {
        ...values,
        isPublished: eventForm.elements.isPublished.checked,
        sortOrder: Number(values.sortOrder || 0)
      };
      delete payload.id;

      const saved = await saveEvent(selectedEventId, payload);
      selectedEventId = saved.id;
      eventForm.elements.id.value = saved.id;
      await refreshEvents();
      deleteEventButton.hidden = false;

      setMessage(eventMessage, "Event saved.", false);
    } catch (error) {
      setMessage(eventMessage, error.message, true);
    }
  });

  deleteEventButton.addEventListener("click", async () => {
    if (!selectedEventId || !window.confirm("Delete this event?")) {
      return;
    }

    try {
      await deleteEvent(selectedEventId);
      await refreshEvents();
      resetEventForm();
      setMessage(eventMessage, "Event deleted.", false);
    } catch (error) {
      setMessage(eventMessage, error.message, true);
    }
  });

  pageForm.elements.heroImageUrl.addEventListener('input', () => { pageForm.elements.heroImageKey.value = ''; });
  eventForm.elements.imageUrl.addEventListener('input', () => { eventForm.elements.imageKey.value = ''; });
  resetEventForm();
  if (!cloudEnabled) {
    document.getElementById('offline-notice').hidden = false;
    document.querySelectorAll('form input, form button, form textarea, form select').forEach(element => { element.disabled = true; });
  } else {
    openDashboard().catch(error => { showLogin(); setMessage(loginMessage, error.message, true); });
  }
})();
