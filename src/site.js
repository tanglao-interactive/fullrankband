import './page-defaults.js';
import { cloudEnabled, publicContent } from './backend';
(function () {
  const defaults = window.fullRankPageDefaults;
  const nav = document.getElementById("main-nav");
  const menu = document.querySelector(".menu-toggle");
  function closeMenu() {
    menu.setAttribute("aria-expanded", "false");
    nav.classList.remove("is-open");
  }
  menu.addEventListener("click", () => {
    const open = menu.getAttribute("aria-expanded") !== "true";
    menu.setAttribute("aria-expanded", String(open));
    nav.classList.toggle("is-open", open);
  });
  nav.addEventListener("click", (event) => { if (event.target.closest("a")) closeMenu(); });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menu.getAttribute("aria-expanded") === "true") {
      closeMenu(); menu.focus();
    }
  });
  document.querySelectorAll("audio, video").forEach((media) => {
    media.addEventListener("play", () => {
      document.querySelectorAll("audio, video").forEach((other) => { if (other !== media) other.pause(); });
      document.getElementById("media-feedback").textContent = "";
    });
    media.addEventListener("error", () => {
      document.getElementById("media-feedback").textContent = "This recording couldn’t load. Please refresh the page and try again.";
    });
  });

  // Old event-poster defaults must not reappear as current show announcements.
  const legacyDefaults = {
    heroSubtitle: "Indie Rock Night", heroDate: "Dec 28 - 9 PM",
    venueName: "Moon Moon's Bar & Cafe", addressLine1: "Triangle Island Plaza, 2nd Floor Narra Street",
    addressLine2: "Shopping - Bacolod City", callout: "NO DOOR CHARGE",
    footerText: "© 2024 Full Rank | All Rights Reserved", heroImageUrl: "images/full-rank-bank-wish-bg.jpeg"
  };
  function renderPage(page = {}) {
    const content = { ...defaults, ...page };
    for (const [field, value] of Object.entries(legacyDefaults)) {
      if (content[field] === value) content[field] = defaults[field];
    }
    document.querySelectorAll("[data-page-field]").forEach((element) => {
      const value = content[element.dataset.pageField];
      element.textContent = value ?? "";
      if (element.dataset.pageField === "heroDate") element.hidden = !value;
    });
    const image = document.getElementById("hero-image");
    image.src = content.heroImageUrl || defaults.heroImageUrl;
    image.onerror = () => {
      image.onerror = null;
      image.src = defaults.heroImageUrl;
    };
    const home = document.getElementById("home-content");
    home.replaceChildren();
    if (content.customHtml?.trim()) {
      // The existing CMS supports trusted-admin HTML.
      home.innerHTML = content.customHtml;
    } else {
      for (const field of ["venueName", "addressLine1", "addressLine2", "callout"]) {
        if (!content[field]) continue;
        const paragraph = document.createElement("p");
        paragraph.textContent = content[field];
        home.appendChild(paragraph);
      }
    }
    home.hidden = !home.hasChildNodes();
    const email = (content.bookingEmail || "").trim();
    const contact = document.getElementById("booking-contact");
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    contact.hidden = !validEmail;
    document.getElementById("booking-pending").hidden = validEmail;
    if (validEmail) {
      const mailto = `mailto:${encodeURIComponent(email)}?subject=Full%20Rank%20booking%20inquiry`;
      const address = document.getElementById("booking-address");
      address.textContent = email;
      address.href = mailto;
      document.getElementById("booking-email-app").href = mailto;
      document.getElementById("booking-gmail").href = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=Full%20Rank%20booking%20inquiry`;
    }
  }
  function renderEvents(events = []) {
    const grid = document.getElementById("events-grid");
    const published = events.filter((event) => event.isPublished !== false);
    grid.replaceChildren();
    grid.hidden = published.length === 0;
    document.getElementById("events-empty").hidden = published.length > 0;
    published.forEach((event) => {
      const card = document.createElement("article"); card.className = "event-card";
      if (event.imageUrl) {
        const image = document.createElement("img"); image.src = event.imageUrl;
        image.alt = event.title || "Full Rank event"; image.loading = "lazy"; card.appendChild(image);
      }
      const body = document.createElement("div"); body.className = "event-card-body";
      const title = document.createElement("h3"); title.textContent = event.title || "Full Rank show"; body.appendChild(title);
      for (const value of [[event.date, event.time].filter(Boolean).join(" · "), [event.venue, event.address].filter(Boolean).join(" · "), event.ticketInfo, event.description]) {
        if (!value) continue;
        const paragraph = document.createElement("p"); paragraph.textContent = value; body.appendChild(paragraph);
      }
      card.appendChild(body); grid.appendChild(card);
    });
  }
  document.getElementById("booking-copy").addEventListener("click", async () => {
    const status = document.getElementById("booking-copy-status");
    try {
      await navigator.clipboard.writeText(document.getElementById("booking-address").textContent);
      status.textContent = "Email address copied.";
    } catch {
      status.textContent = "Select and copy the email address shown above.";
    }
  });
  renderPage();
  renderEvents();
  if (cloudEnabled) {
    let loading = false;
    async function refresh(force = false) {
      if (loading || (document.hidden && !force)) return;
      loading = true;
      try { const content = await publicContent(); renderPage(content.page || {}); renderEvents(content.events); }
      catch (error) { console.warn('Website content is temporarily unavailable. Showing the last available content.'); }
      finally { loading = false; }
    }
    refresh(true);
    setInterval(refresh, 5 * 60 * 1000);
    document.addEventListener('visibilitychange', () => refresh());
  }
})();
