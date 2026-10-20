(function () {
  const { auth, db, storage, useEmulators } = window.fullRankFirebase;
  const pageRef = db.collection("site").doc("home");
  const eventsRef = db.collection("events");
  const serverTimestamp = firebase.firestore.FieldValue.serverTimestamp;
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
  const createEmulatorUserButton = document.getElementById("create-emulator-user");
  const deleteEventButton = document.getElementById("delete-event-button");
  const profileEmail = document.getElementById("profile-email");
  let pageUnsubscribe = null;
  let eventsUnsubscribe = null;

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
    if (!file) {
      return "";
    }

    const safeName = file.name.replace(/[^a-z0-9._-]/gi, "-").toLowerCase();
    const path = `${folder}/${Date.now()}-${safeName}`;
    const ref = storage.ref(path);
    await ref.put(file);
    return ref.getDownloadURL();
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

  document.getElementById("logout-button").addEventListener("click", () => auth.signOut());
  document.getElementById("new-event-button").addEventListener("click", resetEventForm);

  createEmulatorUserButton.hidden = !useEmulators;
  createEmulatorUserButton.addEventListener("click", async () => {
    setMessage(loginMessage, "Creating emulator user...", false);
    try {
      await auth.createUserWithEmailAndPassword(
        loginForm.email.value,
        loginForm.password.value
      );
      setMessage(loginMessage, "Emulator user created.", false);
    } catch (error) {
      setMessage(loginMessage, error.message, true);
    }
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setMessage(loginMessage, "Logging in...", false);

    try {
      await auth.signInWithEmailAndPassword(
        loginForm.email.value,
        loginForm.password.value
      );
      setMessage(loginMessage, "", false);
    } catch (error) {
      setMessage(loginMessage, error.message, true);
    }
  });

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
        page.heroImageUrl = heroImageUrl;
        pageForm.elements.heroImageUrl.value = heroImageUrl;
      }

      await pageRef.set({ ...page, updatedAt: serverTimestamp() }, { merge: true });
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
        values.imageUrl = eventImageUrl;
        eventForm.elements.imageUrl.value = eventImageUrl;
      }

      const payload = {
        ...values,
        isPublished: eventForm.elements.isPublished.checked,
        sortOrder: Number(values.sortOrder || 0),
        updatedAt: serverTimestamp()
      };
      delete payload.id;

      if (selectedEventId) {
        await eventsRef.doc(selectedEventId).set(payload, { merge: true });
      } else {
        const doc = await eventsRef.add({ ...payload, createdAt: serverTimestamp() });
        selectedEventId = doc.id;
        eventForm.elements.id.value = doc.id;
      }

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
      await eventsRef.doc(selectedEventId).delete();
      resetEventForm();
      setMessage(eventMessage, "Event deleted.", false);
    } catch (error) {
      setMessage(eventMessage, error.message, true);
    }
  });

  auth.onAuthStateChanged((user) => {
    loginPanel.hidden = Boolean(user);
    dashboard.hidden = !user;
    profileEmail.textContent = user?.email || "Admin";

    if (!user) {
      if (pageUnsubscribe) {
        pageUnsubscribe();
        pageUnsubscribe = null;
      }

      if (eventsUnsubscribe) {
        eventsUnsubscribe();
        eventsUnsubscribe = null;
      }

      return;
    }

    pageUnsubscribe = pageRef.onSnapshot((snapshot) => {
      fillForm(pageForm, { ...defaults, ...(snapshot.exists ? snapshot.data() : {}) });
    });

    eventsUnsubscribe = eventsRef.orderBy("sortOrder", "asc").onSnapshot((snapshot) => {
      events = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      renderEventList();

      if (selectedEventId && !events.some((event) => event.id === selectedEventId)) {
        resetEventForm();
      }
    });
  });

  resetEventForm();
})();
