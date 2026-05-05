const MAX_IMAGE_SIDE = 1600;

const state = {
  authMode: "login",
  currentImage: null,
  currentUser: null,
  entries: [],
  imageDirty: false,
  profile: null,
};

const authShell = document.querySelector("#authShell");
const dashboardShell = document.querySelector("#dashboardShell");
const flashMessage = document.querySelector("#flashMessage");
const authButtons = [...document.querySelectorAll("[data-auth-mode]")];
const authForm = document.querySelector("#authForm");
const authEyebrow = document.querySelector("#authEyebrow");
const authHeading = document.querySelector("#authHeading");
const authSubcopy = document.querySelector("#authSubcopy");
const authSubmitButton = document.querySelector("#authSubmitButton");
const signupUsername = document.querySelector("#signupUsername");
const signupEmail = document.querySelector("#signupEmail");
const loginIdentifier = document.querySelector("#loginIdentifier");
const authPassword = document.querySelector("#authPassword");
const authFields = [...document.querySelectorAll("[data-auth-field]")];

const publicProfileLink = document.querySelector("#publicProfileLink");
const copyShareButton = document.querySelector("#copyShareButton");
const logoutButton = document.querySelector("#logoutButton");
const usernamePreview = document.querySelector("#usernamePreview");
const totalCount = document.querySelector("#totalCount");
const goodNotesTotal = document.querySelector("#goodNotesTotal");
const badNotesTotal = document.querySelector("#badNotesTotal");
const publicEntryTotal = document.querySelector("#publicEntryTotal");
const balanceText = document.querySelector("#balanceText");
const edgeCaption = document.querySelector("#edgeCaption");
const summaryHeadline = document.querySelector("#summaryHeadline");
const summaryNarrative = document.querySelector("#summaryNarrative");
const topGood = document.querySelector("#topGood");
const topGoodCount = document.querySelector("#topGoodCount");
const topBad = document.querySelector("#topBad");
const topBadCount = document.querySelector("#topBadCount");
const goodPatternList = document.querySelector("#goodPatternList");
const badPatternList = document.querySelector("#badPatternList");

const form = document.querySelector("#analysisForm");
const entryIdInput = document.querySelector("#entryId");
const titleInput = document.querySelector("#titleInput");
const dateInput = document.querySelector("#dateInput");
const visibilityInput = document.querySelector("#visibilityInput");
const imageInput = document.querySelector("#imageInput");
const imagePreview = document.querySelector("#imagePreview");
const uploadBox = document.querySelector("#uploadBox");
const uploadCopy = document.querySelector("#uploadCopy");
const imageMeta = document.querySelector("#imageMeta");
const removeImageButton = document.querySelector("#removeImageButton");
const goodsInput = document.querySelector("#goodsInput");
const badsInput = document.querySelector("#badsInput");
const resetButton = document.querySelector("#resetButton");
const saveButton = document.querySelector("#saveButton");
const searchInput = document.querySelector("#searchInput");
const entryList = document.querySelector("#entryList");
const emptyState = document.querySelector("#emptyState");
const entryTemplate = document.querySelector("#entryTemplate");

const imageDialog = document.querySelector("#imageDialog");
const dialogImage = document.querySelector("#dialogImage");
const closeDialog = document.querySelector("#closeDialog");

const stopWords = new Set([
  "about",
  "after",
  "again",
  "also",
  "analysis",
  "because",
  "before",
  "being",
  "better",
  "could",
  "done",
  "from",
  "good",
  "have",
  "into",
  "just",
  "more",
  "need",
  "only",
  "over",
  "plan",
  "same",
  "setup",
  "than",
  "that",
  "then",
  "there",
  "this",
  "trade",
  "trading",
  "very",
  "what",
  "when",
  "with",
  "without",
  "wrong",
  "your",
]);

dateInput.valueAsDate = new Date();

function showFlash(message, tone = "info") {
  flashMessage.hidden = false;
  flashMessage.dataset.tone = tone;
  flashMessage.textContent = message;

  window.clearTimeout(showFlash.timeoutId);
  showFlash.timeoutId = window.setTimeout(() => {
    flashMessage.hidden = true;
  }, 3600);
}

async function apiFetch(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const errorMessage =
      typeof payload === "string" ? payload : payload.error || "Request failed.";
    throw new Error(errorMessage);
  }

  return payload;
}

function safeDisplayDate(dateValue) {
  if (!dateValue) {
    return "No date";
  }

  const date = new Date(`${dateValue}T00:00:00`);
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function cleanPoint(value) {
  return value
    .replace(/^[\s\-*+.0-9)]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePoints(text) {
  const points = String(text || "")
    .split(/\n|;|,/)
    .map(cleanPoint)
    .filter((point) => point.length > 1);

  if (points.length) {
    return points;
  }

  const fallback = cleanPoint(String(text || ""));
  return fallback ? [fallback] : [];
}

function countPoints(text) {
  return parsePoints(text).length;
}

function normalizePoint(point) {
  return point
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\b(i|my|the|a|an|to|too)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word));
}

function countTerms(entriesToCount, field) {
  const exactMap = new Map();

  for (const entry of entriesToCount) {
    for (const point of parsePoints(entry[field] || "")) {
      const key = normalizePoint(point);
      if (!key) {
        continue;
      }

      const existing = exactMap.get(key) || { count: 0, kind: "point", label: point };
      existing.count += 1;
      exactMap.set(key, existing);
    }
  }

  const repeatedPoints = [...exactMap.values()]
    .filter((item) => item.count > 1)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  if (repeatedPoints.length) {
    return repeatedPoints;
  }

  const keywordMap = new Map();
  const allText = entriesToCount.map((entry) => entry[field] || "").join(" ");
  const words = tokenize(allText);

  for (const word of words) {
    const existing = keywordMap.get(word) || { count: 0, kind: "keyword", label: word };
    existing.count += 1;
    keywordMap.set(word, existing);
  }

  for (let index = 0; index < words.length - 1; index += 1) {
    const phrase = `${words[index]} ${words[index + 1]}`;
    const existing = keywordMap.get(phrase) || {
      count: 0,
      kind: "keyword",
      label: phrase,
    };
    existing.count += 1;
    keywordMap.set(phrase, existing);
  }

  return [...keywordMap.values()]
    .filter((item) => item.count > 1)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function truncate(text, fallback) {
  const cleaned = cleanPoint(text || "");
  if (!cleaned) {
    return fallback;
  }
  return cleaned.length > 220 ? `${cleaned.slice(0, 220)}...` : cleaned;
}

function buildSummaryCopy(entries) {
  const goodCount = entries.reduce((sum, entry) => sum + countPoints(entry.goods), 0);
  const badCount = entries.reduce((sum, entry) => sum + countPoints(entry.bads), 0);
  const publicCount = entries.filter((entry) => entry.visibility === "public").length;
  const goodPatterns = countTerms(entries, "goods");
  const badPatterns = countTerms(entries, "bads");
  const topGoodPattern = goodPatterns[0]?.label;
  const topBadPattern = badPatterns[0]?.label;

  if (!entries.length) {
    return {
      badCount,
      badPatterns,
      balance: "Start by saving your first analysis.",
      edgeCaptionText: "Choose public visibility when you want to share.",
      goodCount,
      goodPatterns,
      headline: "Your repeated habits will appear here.",
      narrative:
        "Add a few analyses and the app will tell you what you do well most often and which mistake keeps showing up.",
      publicCount,
    };
  }

  const balance =
    goodCount === badCount
      ? `${goodCount} good notes and ${badCount} bad notes recorded so far.`
      : goodCount > badCount
        ? `${goodCount} good notes versus ${badCount} bad notes so far.`
        : `${badCount} bad notes versus ${goodCount} good notes so far.`;

  const edgeCaptionText = publicCount
    ? `${publicCount} public entries live at your share link.`
    : "Choose public visibility when you want to share.";

  if (topGoodPattern && topBadPattern) {
    return {
      badCount,
      badPatterns,
      balance,
      edgeCaptionText,
      goodCount,
      goodPatterns,
      headline: `Your clearest strength is "${topGoodPattern}" and your most repeated mistake is "${topBadPattern}".`,
      narrative: `Across ${entries.length} saved analyses, you logged ${goodCount} good notes and ${badCount} bad notes. Keep leaning into "${topGoodPattern}" and use your next review to reduce "${topBadPattern}".`,
      publicCount,
    };
  }

  if (topGoodPattern) {
    return {
      badCount,
      badPatterns,
      balance,
      edgeCaptionText,
      goodCount,
      goodPatterns,
      headline: `Your strongest repeated habit is "${topGoodPattern}".`,
      narrative: `Across ${entries.length} saved analyses, your good notes are already forming a clear edge. Add more bad notes too if you want a sharper correction loop.`,
      publicCount,
    };
  }

  if (topBadPattern) {
    return {
      badCount,
      badPatterns,
      balance,
      edgeCaptionText,
      goodCount,
      goodPatterns,
      headline: `Your most repeated correction is "${topBadPattern}".`,
      narrative: `Across ${entries.length} saved analyses, the journal can already see one mistake showing up again. Add more good notes too if you want a stronger picture of your edge.`,
      publicCount,
    };
  }

  return {
    badCount,
    badPatterns,
    balance,
    edgeCaptionText,
    goodCount,
    goodPatterns,
    headline: "Your journal is starting to collect patterns.",
    narrative: `You have ${entries.length} saved analyses with ${goodCount} good notes and ${badCount} bad notes. Once a note repeats, it will move into the pattern radar automatically.`,
    publicCount,
  };
}

function renderPatterns(list, items) {
  list.replaceChildren();

  if (!items.length) {
    const li = document.createElement("li");
    li.className = "muted-list-item";
    li.textContent = "No repeated pattern yet.";
    list.append(li);
    return;
  }

  for (const item of items.slice(0, 6)) {
    const li = document.createElement("li");
    const label = document.createElement("span");
    const count = document.createElement("strong");
    label.textContent = item.label;
    count.textContent = `${item.count}x`;
    li.append(label, count);
    list.append(li);
  }
}

function renderTagList(container, text, kind) {
  container.replaceChildren();
  const points = parsePoints(text);

  if (!points.length) {
    const tag = document.createElement("span");
    tag.className = "tag muted";
    tag.textContent = "None";
    container.append(tag);
    return;
  }

  for (const point of points.slice(0, 4)) {
    const tag = document.createElement("span");
    tag.className = `tag ${kind}`;
    tag.textContent = point;
    container.append(tag);
  }
}

function setAuthMode(mode) {
  state.authMode = mode;

  for (const button of authButtons) {
    button.classList.toggle("is-active", button.dataset.authMode === mode);
  }

  for (const field of authFields) {
    const visible = field.dataset.authField === mode;
    field.hidden = !visible;
  }

  if (mode === "login") {
    authEyebrow.textContent = "Welcome back";
    authHeading.textContent = "Login to your journal";
    authSubcopy.textContent =
      "Sign in to manage your analysis library and public profile.";
    authSubmitButton.textContent = "Login";
    authPassword.setAttribute("autocomplete", "current-password");
  } else {
    authEyebrow.textContent = "Create your space";
    authHeading.textContent = "Start your public journal";
    authSubcopy.textContent =
      "Make an account, save private notes, and publish only the analyses you want to share.";
    authSubmitButton.textContent = "Create account";
    authPassword.setAttribute("autocomplete", "new-password");
  }
}

function showAuthShell() {
  authShell.hidden = false;
  dashboardShell.hidden = true;
}

function showDashboardShell() {
  authShell.hidden = true;
  dashboardShell.hidden = false;
}

function publicProfileUrl() {
  if (!state.currentUser) {
    return "#";
  }
  return `${window.location.origin}/u/${state.currentUser.username}`;
}

function syncProfileUI() {
  const shareUrl = publicProfileUrl();
  publicProfileLink.href = shareUrl;
  usernamePreview.value = state.currentUser ? `@${state.currentUser.username}` : "";
}

function updateImagePreview() {
  if (state.currentImage?.dataUrl) {
    imagePreview.src = state.currentImage.dataUrl;
    imagePreview.hidden = false;
    uploadCopy.hidden = true;
    imageMeta.textContent = `${state.currentImage.name || "Screenshot"} · ${state.currentImage.width || "-"} x ${state.currentImage.height || "-"} stored on your account`;
    removeImageButton.disabled = false;
    return;
  }

  imagePreview.hidden = true;
  imagePreview.removeAttribute("src");
  uploadCopy.hidden = false;
  uploadCopy.textContent = "Drop screenshot or click to add";
  imageMeta.textContent = "PNG, JPG, or WEBP. Images are resized locally before saving.";
  removeImageButton.disabled = true;
}

function resetEntryForm() {
  form.reset();
  entryIdInput.value = "";
  dateInput.valueAsDate = new Date();
  visibilityInput.value = "private";
  state.currentImage = null;
  state.imageDirty = false;
  imageInput.value = "";
  saveButton.textContent = "Save analysis";
  updateImagePreview();
}

function filteredEntries() {
  const term = searchInput.value.trim().toLowerCase();
  const sorted = [...state.entries].sort((a, b) => {
    const dateDiff = String(b.date || "").localeCompare(String(a.date || ""));
    if (dateDiff !== 0) {
      return dateDiff;
    }
    return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
  });

  if (!term) {
    return sorted;
  }

  return sorted.filter((entry) =>
    [entry.title, entry.goods, entry.bads, entry.date, entry.visibility]
      .join(" ")
      .toLowerCase()
      .includes(term),
  );
}

function renderSummary() {
  const summary = buildSummaryCopy(state.entries);
  totalCount.textContent = state.entries.length.toString();
  goodNotesTotal.textContent = summary.goodCount.toString();
  badNotesTotal.textContent = summary.badCount.toString();
  publicEntryTotal.textContent = summary.publicCount.toString();
  balanceText.textContent = summary.balance;
  edgeCaption.textContent = summary.edgeCaptionText;
  summaryHeadline.textContent = summary.headline;
  summaryNarrative.textContent = summary.narrative;
  topGood.textContent = summary.goodPatterns[0]?.label || "-";
  topGoodCount.textContent = summary.goodPatterns[0]
    ? `${summary.goodPatterns[0].count} times`
    : "No pattern yet";
  topBad.textContent = summary.badPatterns[0]?.label || "-";
  topBadCount.textContent = summary.badPatterns[0]
    ? `${summary.badPatterns[0].count} times`
    : "No pattern yet";
  renderPatterns(goodPatternList, summary.goodPatterns);
  renderPatterns(badPatternList, summary.badPatterns);
}

function renderEntries() {
  entryList.replaceChildren();
  const visibleEntries = filteredEntries();
  emptyState.classList.toggle("is-visible", visibleEntries.length === 0);
  emptyState.textContent = searchInput.value.trim()
    ? "No saved analysis matches that search."
    : "No analysis saved yet.";

  for (const entry of visibleEntries) {
    const node = entryTemplate.content.firstElementChild.cloneNode(true);
    const imageButton = node.querySelector(".entry-media");
    const image = node.querySelector("img");
    const noImageText = node.querySelector(".entry-media span");
    const title = node.querySelector("h3");
    const date = node.querySelector(".entry-head p");
    const visibility = node.querySelector('[data-field="visibility"]');
    const goods = node.querySelector('[data-field="goods"]');
    const bads = node.querySelector('[data-field="bads"]');
    const goodCount = node.querySelector('[data-field="goodCount"]');
    const badCount = node.querySelector('[data-field="badCount"]');
    const goodTags = node.querySelector('[data-field="goodTags"]');
    const badTags = node.querySelector('[data-field="badTags"]');

    node.dataset.id = entry.id;
    title.textContent = entry.title;
    date.textContent = safeDisplayDate(entry.date);
    visibility.textContent = entry.visibility === "public" ? "Public" : "Private";
    visibility.className = `visibility-pill ${entry.visibility === "public" ? "public-pill" : "private-pill"}`;
    goods.textContent = truncate(entry.goods, "No goods added.");
    bads.textContent = truncate(entry.bads, "No bads added.");
    goodCount.textContent = countPoints(entry.goods).toString();
    badCount.textContent = countPoints(entry.bads).toString();
    renderTagList(goodTags, entry.goods, "good");
    renderTagList(badTags, entry.bads, "bad");

    if (entry.image?.dataUrl) {
      image.src = entry.image.dataUrl;
      image.alt = `${entry.title} screenshot`;
      image.hidden = false;
      noImageText.hidden = true;
      imageButton.disabled = false;
    } else {
      image.hidden = true;
      noImageText.hidden = false;
      imageButton.disabled = true;
    }

    entryList.append(node);
  }
}

function renderApp() {
  syncProfileUI();
  renderSummary();
  renderEntries();
}

function loadEntryIntoForm(entry) {
  entryIdInput.value = entry.id;
  titleInput.value = entry.title;
  dateInput.value = entry.date;
  visibilityInput.value = entry.visibility || "private";
  goodsInput.value = entry.goods || "";
  badsInput.value = entry.bads || "";
  state.currentImage = entry.image || null;
  state.imageDirty = false;
  imageInput.value = "";
  saveButton.textContent = "Update analysis";
  updateImagePreview();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function loadEntries() {
  const payload = await apiFetch("/api/entries", { method: "GET" });
  state.entries = payload.entries || [];
  state.profile = payload.profile || null;
  renderApp();
}

function resolveEntryImage(existingEntry) {
  if (state.imageDirty) {
    return state.currentImage;
  }
  return existingEntry?.image || null;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImageElement(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not read this screenshot."));
    image.src = dataUrl;
  });
}

async function prepareImageAsset(file) {
  const originalDataUrl = await readFileAsDataUrl(file);
  const image = await loadImageElement(originalDataUrl);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const longestSide = Math.max(width, height);
  const scale = longestSide > MAX_IMAGE_SIDE ? MAX_IMAGE_SIDE / longestSide : 1;
  const nextWidth = Math.max(1, Math.round(width * scale));
  const nextHeight = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    return {
      dataUrl: originalDataUrl,
      height,
      name: file.name,
      type: file.type || "image/png",
      width,
    };
  }

  canvas.width = nextWidth;
  canvas.height = nextHeight;
  context.drawImage(image, 0, 0, nextWidth, nextHeight);

  const exportType = file.type === "image/png" ? "image/png" : "image/jpeg";
  const dataUrl =
    exportType === "image/png"
      ? canvas.toDataURL(exportType)
      : canvas.toDataURL(exportType, 0.9);

  return {
    dataUrl,
    height: nextHeight,
    name: file.name,
    type: exportType,
    width: nextWidth,
  };
}

async function handleSelectedFile(file) {
  if (!file || !file.type.startsWith("image/")) {
    throw new Error("Please choose an image file.");
  }

  state.currentImage = await prepareImageAsset(file);
  state.imageDirty = true;
  updateImagePreview();
}

async function bootstrap() {
  setAuthMode("login");

  try {
    const payload = await apiFetch("/api/session", { method: "GET" });
    if (payload.user) {
      state.currentUser = payload.user;
      showDashboardShell();
      await loadEntries();
      return;
    }
  } catch (error) {
    console.error(error);
  }

  showAuthShell();
  updateImagePreview();
}

authButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setAuthMode(button.dataset.authMode);
  });
});

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    const payload =
      state.authMode === "login"
        ? await apiFetch("/api/auth/login", {
            body: JSON.stringify({
              identifier: loginIdentifier.value.trim(),
              password: authPassword.value,
            }),
            method: "POST",
          })
        : await apiFetch("/api/auth/signup", {
            body: JSON.stringify({
              email: signupEmail.value.trim(),
              password: authPassword.value,
              username: signupUsername.value.trim(),
            }),
            method: "POST",
          });

    state.currentUser = payload.user;
    authForm.reset();
    showDashboardShell();
    syncProfileUI();
    resetEntryForm();
    await loadEntries();
    showFlash(
      state.authMode === "login"
        ? "Logged in successfully."
        : "Account created. Your journal is ready.",
      "success",
    );
  } catch (error) {
    showFlash(error.message, "error");
  }
});

logoutButton.addEventListener("click", async () => {
  try {
    await apiFetch("/api/auth/logout", {
      body: JSON.stringify({}),
      method: "POST",
    });
    state.currentUser = null;
    state.entries = [];
    showAuthShell();
    setAuthMode("login");
    showFlash("Logged out.", "success");
  } catch (error) {
    showFlash(error.message, "error");
  }
});

copyShareButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(publicProfileUrl());
    showFlash("Public profile link copied.", "success");
  } catch (error) {
    showFlash("Could not copy the link on this browser.", "error");
  }
});

imageInput.addEventListener("change", async () => {
  const [file] = imageInput.files;
  if (!file) {
    return;
  }

  try {
    await handleSelectedFile(file);
  } catch (error) {
    showFlash(error.message, "error");
  }
});

["dragenter", "dragover"].forEach((eventName) => {
  uploadBox.addEventListener(eventName, (event) => {
    event.preventDefault();
    uploadBox.classList.add("is-dragging");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  uploadBox.addEventListener(eventName, (event) => {
    event.preventDefault();
    uploadBox.classList.remove("is-dragging");
  });
});

uploadBox.addEventListener("drop", async (event) => {
  const [file] = event.dataTransfer?.files || [];
  if (!file) {
    return;
  }

  try {
    await handleSelectedFile(file);
  } catch (error) {
    showFlash(error.message, "error");
  }
});

removeImageButton.addEventListener("click", () => {
  state.currentImage = null;
  state.imageDirty = true;
  imageInput.value = "";
  updateImagePreview();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const existing = state.entries.find((entry) => entry.id === entryIdInput.value);
  const payload = {
    bads: badsInput.value.trim(),
    date: dateInput.value,
    goods: goodsInput.value.trim(),
    image: resolveEntryImage(existing),
    title: titleInput.value.trim(),
    visibility: visibilityInput.value,
  };

  try {
    if (existing) {
      await apiFetch(`/api/entries/${existing.id}`, {
        body: JSON.stringify(payload),
        method: "PUT",
      });
      showFlash("Analysis updated.", "success");
    } else {
      await apiFetch("/api/entries", {
        body: JSON.stringify(payload),
        method: "POST",
      });
      showFlash("Analysis saved.", "success");
    }

    resetEntryForm();
    await loadEntries();
  } catch (error) {
    showFlash(error.message, "error");
  }
});

resetButton.addEventListener("click", resetEntryForm);

entryList.addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  const card = event.target.closest(".entry-card");
  if (!button || !card) {
    return;
  }

  const entry = state.entries.find((item) => item.id === card.dataset.id);
  if (!entry) {
    return;
  }

  if (button.dataset.action === "view-image" && entry.image?.dataUrl) {
    dialogImage.src = entry.image.dataUrl;
    imageDialog.showModal();
    return;
  }

  if (button.dataset.action === "edit") {
    loadEntryIntoForm(entry);
    return;
  }

  if (button.dataset.action === "delete") {
    const shouldDelete = window.confirm(`Delete "${entry.title}"?`);
    if (!shouldDelete) {
      return;
    }

    try {
      await apiFetch(`/api/entries/${entry.id}`, {
        body: JSON.stringify({}),
        method: "DELETE",
      });
      if (entryIdInput.value === entry.id) {
        resetEntryForm();
      }
      await loadEntries();
      showFlash("Analysis deleted.", "success");
    } catch (error) {
      showFlash(error.message, "error");
    }
  }
});

closeDialog.addEventListener("click", () => {
  imageDialog.close();
});

imageDialog.addEventListener("click", (event) => {
  if (event.target === imageDialog) {
    imageDialog.close();
  }
});

searchInput.addEventListener("input", renderEntries);

bootstrap();
