const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const desktopSpace = $(".desktop-space");
const windows = Object.fromEntries(
  $$("[data-window]").map((element) => [element.dataset.window, element]),
);
const appNames = ["welcome", "journal", "workbench", "about"];
let highestZ = 10;
let toastTimer;
let saveTimer;

const starterNotes = [
  {
    title: "Why I make things",
    date: "A NOTE TO SELF · 01",
    body: "I like the moment when an idea stops being abstract and starts being useful to someone.\n\nThe first version can be small. It just needs to give the idea somewhere to land.",
  },
  {
    title: "A small rule",
    date: "A NOTE TO SELF · 02",
    body: "Make the next step clear enough that someone can try it without a map.\n\nThen listen, learn, and make the next version a little kinder.",
  },
  {
    title: "Keep a question",
    date: "A NOTE TO SELF · 03",
    body: "Curiosity is a good reason to begin.\n\nWhat would make this feel easier? What would make it more human? What could I learn by trying?",
  },
];

const starterProjects = [
  {
    title: "Show Once",
    category: "building",
    status: "IN MOTION",
    symbol: "↗",
    description:
      "A friendlier way to learn from a tutorial, one real step at a time.",
    detail:
      "A small learning workshop: find a guide, try one step, share progress, and keep moving at your own pace.",
  },
  {
    title: "Goodhand",
    category: "experiment",
    status: "PROTOTYPE",
    symbol: "✳",
    description:
      "A little workshop for turning things you want to learn into hands-on practice.",
    detail:
      "The current prototype explores guided lessons, photo check-ins, and an encouraging place to practice new skills.",
  },
  {
    title: "Patchwork OS",
    category: "experiment",
    status: "JUST STARTED",
    symbol: "▦",
    description:
      "A personal desktop for collecting half-finished thoughts and useful projects.",
    detail:
      "A playful corner of the web built from windows, small apps, and ideas worth keeping close.",
  },
];

function loadArray(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

let notes = loadArray("patchwork-notes-v1", starterNotes);
let projects = loadArray("patchwork-projects-v1", starterProjects);
let selectedNote = "";
try {
  selectedNote =
    localStorage.getItem("patchwork-selected-note-v1") || notes[0]?.title || "";
} catch {
  selectedNote = notes[0]?.title || "";
}
let activeFilter = "all";

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 2100);
}

function closeMenus() {
  $$(".menu-popover").forEach((menu) => {
    menu.hidden = true;
  });
  $$("[data-menu-toggle]").forEach((button) =>
    button.setAttribute("aria-expanded", "false"),
  );
}

function toggleMenu(menuId, trigger) {
  const menu = document.getElementById(menuId);
  const shouldOpen = menu.hidden;
  closeMenus();
  if (shouldOpen) {
    menu.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
  }
}

function syncDock() {
  $$(".dock-app").forEach((button) => {
    const app = button.dataset.app;
    const isOpen = windows[app] && !windows[app].hidden;
    button.classList.toggle("is-open", Boolean(isOpen));
  });
}

function bringToFront(windowElement) {
  highestZ += 1;
  windowElement.style.zIndex = String(highestZ);
}

function openApp(app) {
  const windowElement = windows[app];
  if (!windowElement) return;
  closeMenus();
  windowElement.hidden = false;
  windowElement.classList.remove("is-minimized");
  bringToFront(windowElement);
  syncDock();
}

function closeApp(app) {
  const windowElement = windows[app];
  if (!windowElement) return;
  windowElement.hidden = true;
  windowElement.classList.remove("is-maximized");
  syncDock();
}

function minimizeApp(app) {
  const windowElement = windows[app];
  if (!windowElement) return;
  windowElement.hidden = true;
  windowElement.classList.add("is-minimized");
  syncDock();
}

function toggleMaximize(windowElement) {
  if (windowElement.classList.contains("is-maximized")) {
    windowElement.classList.remove("is-maximized");
    const old = windowElement._beforeMaximize;
    if (old) {
      windowElement.style.left = old.left;
      windowElement.style.top = old.top;
      windowElement.style.width = old.width;
      windowElement.style.height = old.height;
      windowElement.style.transform = old.transform;
    }
    windowElement._beforeMaximize = null;
    return;
  }
  const rect = windowElement.getBoundingClientRect();
  const space = desktopSpace.getBoundingClientRect();
  windowElement._beforeMaximize = {
    left: windowElement.style.left,
    top: windowElement.style.top,
    width: windowElement.style.width,
    height: windowElement.style.height,
    transform: windowElement.style.transform,
    x: rect.left - space.left,
    y: rect.top - space.top,
    widthPx: rect.width,
    heightPx: rect.height,
  };
  windowElement.style.left = `${rect.left - space.left}px`;
  windowElement.style.top = `${rect.top - space.top}px`;
  windowElement.style.transform = "none";
  windowElement.classList.add("is-maximized");
}

function arrangeWindows() {
  const openWindows = appNames
    .map((name) => windows[name])
    .filter((element) => element && !element.hidden);
  const space = desktopSpace.getBoundingClientRect();
  openWindows.forEach((element, index) => {
    element.classList.remove("is-maximized");
    const left = Math.max(
      8,
      Math.min(
        space.width - element.offsetWidth - 8,
        (space.width - element.offsetWidth) / 2 + index * 28,
      ),
    );
    const top = Math.max(
      8,
      Math.min(
        space.height - element.offsetHeight - 8,
        (space.height - element.offsetHeight) / 2 + index * 25,
      ),
    );
    element.style.left = `${left}px`;
    element.style.top = `${top}px`;
    element.style.transform = "none";
    bringToFront(element);
  });
  closeMenus();
}

function makeWindowsDraggable() {
  Object.values(windows).forEach((windowElement) => {
    const handle = $("[data-drag-handle]", windowElement);
    windowElement.addEventListener("pointerdown", () =>
      bringToFront(windowElement),
    );
    let drag = null;

    handle.addEventListener("pointerdown", (event) => {
      if (
        event.target.closest(".window-control") ||
        windowElement.classList.contains("is-maximized")
      )
        return;
      const rect = windowElement.getBoundingClientRect();
      const space = desktopSpace.getBoundingClientRect();
      drag = {
        pointerId: event.pointerId,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
        spaceLeft: space.left,
        spaceTop: space.top,
        spaceWidth: space.width,
        spaceHeight: space.height,
        width: rect.width,
        height: rect.height,
      };
      bringToFront(windowElement);
      handle.setPointerCapture(event.pointerId);
      event.preventDefault();
    });

    handle.addEventListener("pointermove", (event) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      const left = Math.max(
        0,
        Math.min(
          drag.spaceWidth - drag.width,
          event.clientX - drag.offsetX - drag.spaceLeft,
        ),
      );
      const top = Math.max(
        0,
        Math.min(
          drag.spaceHeight - drag.height,
          event.clientY - drag.offsetY - drag.spaceTop,
        ),
      );
      windowElement.style.left = `${left}px`;
      windowElement.style.top = `${top}px`;
      windowElement.style.transform = "none";
    });

    const stopDrag = (event) => {
      if (drag?.pointerId === event.pointerId) drag = null;
    };
    handle.addEventListener("pointerup", stopDrag);
    handle.addEventListener("pointercancel", stopDrag);
    handle.addEventListener("lostpointercapture", stopDrag);
  });
}

function persistNotes() {
  const indicator = $("#saveIndicator");
  indicator.textContent = "Saving…";
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      localStorage.setItem("patchwork-notes-v1", JSON.stringify(notes));
      localStorage.setItem("patchwork-selected-note-v1", selectedNote || "");
      indicator.textContent = "Saved locally";
    } catch {
      indicator.textContent = "Could not save";
    }
  }, 350);
}

function renderNotes() {
  const list = $("#noteList");
  list.replaceChildren();
  if (!notes.length) {
    const empty = document.createElement("p");
    empty.className = "journal-sidebar-note";
    empty.textContent = "Your pages will show up here.";
    list.append(empty);
    $("#noteHeading").textContent = "A blank page";
    $("#noteDate").textContent = "START ANYWHERE";
    $("#noteBody").textContent = "Click here and write down a thought to keep.";
    return;
  }

  if (!notes.some((note) => note.title === selectedNote))
    selectedNote = notes[0].title;
  notes.forEach((note) => {
    const button = document.createElement("button");
    button.className = "note-tab";
    button.type = "button";
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", String(note.title === selectedNote));
    const title = document.createElement("b");
    title.textContent = note.title;
    const date = document.createElement("small");
    date.textContent = note.date;
    button.append(title, date);
    button.addEventListener("click", () => {
      const current = notes.find((item) => item.title === selectedNote);
      if (current) current.body = $("#noteBody").innerText;
      selectedNote = note.title;
      renderNotes();
      persistNotes();
    });
    list.append(button);
  });

  const selected =
    notes.find((note) => note.title === selectedNote) || notes[0];
  $("#noteHeading").textContent = selected.title;
  $("#noteDate").textContent = selected.date;
  $("#noteBody").textContent = selected.body;
}

function persistProjects() {
  try {
    localStorage.setItem("patchwork-projects-v1", JSON.stringify(projects));
  } catch {
    showToast("This idea could not be saved on this device.");
  }
}

function createProjectCard(project, index) {
  const card = document.createElement("article");
  card.className = "project-card";
  card.dataset.category = project.category;

  const top = document.createElement("div");
  top.className = "project-card-top";
  const symbol = document.createElement("span");
  symbol.className = "project-symbol";
  symbol.setAttribute("aria-hidden", "true");
  symbol.textContent = project.symbol || "✦";
  const status = document.createElement("span");
  status.className = "project-status";
  status.textContent = project.status || "NEW IDEA";
  top.append(symbol, status);

  const title = document.createElement("h3");
  title.textContent = project.title;
  const description = document.createElement("p");
  description.textContent = project.description;
  const detail = document.createElement("p");
  detail.className = "project-detail";
  detail.hidden = true;
  detail.textContent =
    project.detail ||
    "A new idea with room to grow. Add one small next step when you are ready.";
  const toggle = document.createElement("button");
  toggle.className = "project-open";
  toggle.type = "button";
  toggle.setAttribute("aria-expanded", "false");
  const action = document.createElement("span");
  action.textContent = "More about this";
  const arrow = document.createElement("span");
  arrow.setAttribute("aria-hidden", "true");
  arrow.textContent = "↘";
  toggle.append(action, arrow);
  toggle.addEventListener("click", () => {
    const expanded = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!expanded));
    detail.hidden = expanded;
    action.textContent = expanded ? "More about this" : "A little more";
    arrow.textContent = expanded ? "↘" : "↗";
  });

  card.append(top, title, description, detail, toggle);
  if (index >= 3) card.classList.add("added-project");
  return card;
}

function renderProjects() {
  const grid = $("#projectGrid");
  grid.replaceChildren();
  const visibleProjects = projects.filter(
    (project) => activeFilter === "all" || project.category === activeFilter,
  );
  visibleProjects.forEach((project, index) =>
    grid.append(createProjectCard(project, index)),
  );
  $("#projectCount").textContent = String(projects.length);
  $("#ideaCount").textContent =
    `${projects.length} ${projects.length === 1 ? "idea" : "ideas"} on the table`;
}

function updateClock() {
  const now = new Date();
  const time = new Intl.DateTimeFormat("en-ZA", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Africa/Johannesburg",
  });
  const date = new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
    timeZone: "Africa/Johannesburg",
  });
  $("#clock").textContent = time.format(now);
  $("#clock").dateTime = now.toISOString();
  $("#dateLabel").textContent = `${date.format(now).toUpperCase()} · JHB`;
}

function handleWindowAction(button) {
  const windowElement = button.closest("[data-window]");
  const app = windowElement?.dataset.window;
  if (!app) return;
  if (button.dataset.windowAction === "close") closeApp(app);
  if (button.dataset.windowAction === "minimize") minimizeApp(app);
  if (button.dataset.windowAction === "maximize") toggleMaximize(windowElement);
}

function bindEvents() {
  makeWindowsDraggable();
  document.addEventListener("click", (event) => {
    const menuButton = event.target.closest("[data-menu-toggle]");
    if (menuButton) {
      toggleMenu(menuButton.dataset.menuToggle, menuButton);
      return;
    }

    const appButton = event.target.closest("[data-app]");
    if (appButton) {
      openApp(appButton.dataset.app);
      return;
    }

    const windowAction = event.target.closest("[data-window-action]");
    if (windowAction) {
      handleWindowAction(windowAction);
      return;
    }

    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "arrange") arrangeWindows();
    if (action === "close-all") {
      appNames.forEach(closeApp);
      closeMenus();
    }

    const filter = event.target.closest("[data-filter]");
    if (filter) {
      activeFilter = filter.dataset.filter;
      $$(".filter-chip").forEach((chip) =>
        chip.classList.toggle("active", chip === filter),
      );
      renderProjects();
    }
  });

  document.addEventListener("pointerdown", (event) => {
    if (
      !event.target.closest(".menu-popover") &&
      !event.target.closest("[data-menu-toggle]")
    )
      closeMenus();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      const anyMenuOpen = $$(".menu-popover").some((menu) => !menu.hidden);
      if (anyMenuOpen) closeMenus();
      return;
    }
    const typing = event.target.matches(
      'input, textarea, [contenteditable="true"]',
    );
    if (typing || !(event.metaKey || event.ctrlKey)) return;
    const shortcuts = {
      1: "welcome",
      2: "journal",
      3: "workbench",
      4: "about",
    };
    if (shortcuts[event.key]) {
      event.preventDefault();
      openApp(shortcuts[event.key]);
    }
  });

  $("#noteBody").addEventListener("input", () => {
    const current = notes.find((note) => note.title === selectedNote);
    if (current) current.body = $("#noteBody").innerText;
    persistNotes();
  });

  $("#newProjectButton").addEventListener("click", () => {
    const form = $("#projectForm");
    form.hidden = !form.hidden;
    if (!form.hidden) $("#projectName").focus();
  });

  $("#projectForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const input = $("#projectName");
    const title = input.value.trim();
    if (!title) return;
    projects.unshift({
      title,
      category: "experiment",
      status: "NEW IDEA",
      symbol: "✦",
      description: "A fresh idea. Give it one small first step.",
      detail:
        "A blank page is a good place to start. Come back when it has a next step.",
    });
    persistProjects();
    activeFilter = "all";
    $$(".filter-chip").forEach((chip) =>
      chip.classList.toggle("active", chip.dataset.filter === "all"),
    );
    renderProjects();
    input.value = "";
    $("#projectForm").hidden = true;
    showToast("A new idea found a home.");
  });
}

function init() {
  renderNotes();
  renderProjects();
  bindEvents();
  updateClock();
  window.setInterval(updateClock, 1000);
  bringToFront(windows.welcome);
  syncDock();
}

init();
