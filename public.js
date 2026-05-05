const publicHeading = document.querySelector("#publicHeading");
const publicSubcopy = document.querySelector("#publicSubcopy");
const publicTotalCount = document.querySelector("#publicTotalCount");
const publicGoodNotesTotal = document.querySelector("#publicGoodNotesTotal");
const publicBadNotesTotal = document.querySelector("#publicBadNotesTotal");
const publicTopPattern = document.querySelector("#publicTopPattern");
const publicTopPatternCount = document.querySelector("#publicTopPatternCount");
const publicBalanceText = document.querySelector("#publicBalanceText");
const publicSummaryHeadline = document.querySelector("#publicSummaryHeadline");
const publicSummaryNarrative = document.querySelector("#publicSummaryNarrative");
const publicEntryList = document.querySelector("#publicEntryList");
const publicEmptyState = document.querySelector("#publicEmptyState");
const publicEntryTemplate = document.querySelector("#publicEntryTemplate");

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

      const existing = exactMap.get(key) || { count: 0, label: point };
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
    const existing = keywordMap.get(word) || { count: 0, label: word };
    existing.count += 1;
    keywordMap.set(word, existing);
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

function renderEntries(entries) {
  publicEntryList.replaceChildren();
  publicEmptyState.classList.toggle("is-visible", entries.length === 0);

  for (const entry of entries) {
    const node = publicEntryTemplate.content.firstElementChild.cloneNode(true);
    const image = node.querySelector("img");
    const noImageText = node.querySelector(".entry-media span");
    const title = node.querySelector("h3");
    const date = node.querySelector(".entry-head p");
    const goods = node.querySelector('[data-field="goods"]');
    const bads = node.querySelector('[data-field="bads"]');
    const goodCount = node.querySelector('[data-field="goodCount"]');
    const badCount = node.querySelector('[data-field="badCount"]');
    const goodTags = node.querySelector('[data-field="goodTags"]');
    const badTags = node.querySelector('[data-field="badTags"]');

    title.textContent = entry.title;
    date.textContent = safeDisplayDate(entry.date);
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
    } else {
      image.hidden = true;
      noImageText.hidden = false;
    }

    publicEntryList.append(node);
  }
}

function renderSummary(username, entries) {
  const goodCount = entries.reduce((sum, entry) => sum + countPoints(entry.goods), 0);
  const badCount = entries.reduce((sum, entry) => sum + countPoints(entry.bads), 0);
  const goodPatterns = countTerms(entries, "goods");
  const badPatterns = countTerms(entries, "bads");
  const strongestPattern = goodPatterns[0] || badPatterns[0];

  publicHeading.textContent = `@${username}`;
  publicSubcopy.textContent = `${username}'s public analysis journal and repeated review patterns.`;
  publicTotalCount.textContent = entries.length.toString();
  publicGoodNotesTotal.textContent = goodCount.toString();
  publicBadNotesTotal.textContent = badCount.toString();
  publicTopPattern.textContent = strongestPattern?.label || "-";
  publicTopPatternCount.textContent = strongestPattern
    ? `${strongestPattern.count} times`
    : "No pattern yet.";

  if (!entries.length) {
    publicBalanceText.textContent = "No public analysis yet.";
    publicSummaryHeadline.textContent = "No public patterns yet.";
    publicSummaryNarrative.textContent =
      "Once public entries are shared, this page will show the most repeated strengths and mistakes.";
    return;
  }

  publicBalanceText.textContent =
    goodCount === badCount
      ? `${goodCount} good notes and ${badCount} bad notes shared.`
      : goodCount > badCount
        ? `${goodCount} good notes versus ${badCount} bad notes shared.`
        : `${badCount} bad notes versus ${goodCount} good notes shared.`;

  if (goodPatterns[0] && badPatterns[0]) {
    publicSummaryHeadline.textContent = `Most repeated strength: "${goodPatterns[0].label}". Most repeated mistake: "${badPatterns[0].label}".`;
    publicSummaryNarrative.textContent = `${username} has shared ${entries.length} public analyses so far. The public record shows ${goodCount} good notes and ${badCount} bad notes across those entries.`;
    return;
  }

  if (goodPatterns[0]) {
    publicSummaryHeadline.textContent = `Most repeated strength: "${goodPatterns[0].label}".`;
    publicSummaryNarrative.textContent = `${username} has shared ${entries.length} analyses and the public record already shows a clear repeated edge.`;
    return;
  }

  if (badPatterns[0]) {
    publicSummaryHeadline.textContent = `Most repeated correction: "${badPatterns[0].label}".`;
    publicSummaryNarrative.textContent = `${username} has shared ${entries.length} analyses and one repeated mistake is already visible in the public record.`;
    return;
  }

  publicSummaryHeadline.textContent = "This public journal is starting to collect patterns.";
  publicSummaryNarrative.textContent = `${username} has shared ${entries.length} public analyses with ${goodCount} good notes and ${badCount} bad notes so far.`;
}

async function bootstrap() {
  const pathParts = window.location.pathname.split("/").filter(Boolean);
  const username = pathParts[0] === "u" ? pathParts[1] : "";

  if (!username) {
    publicHeading.textContent = "Public profile not found";
    publicSubcopy.textContent = "This link is missing a valid username.";
    return;
  }

  try {
    const response = await fetch(`/api/public/${username}`);
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Public profile not found.");
    }

    renderSummary(payload.profile.username, payload.entries || []);
    renderEntries(payload.entries || []);
  } catch (error) {
    publicHeading.textContent = "Public profile not found";
    publicSubcopy.textContent = error.message;
    publicSummaryHeadline.textContent = "No public patterns yet.";
    publicSummaryNarrative.textContent =
      "This profile does not exist or has not shared any public entries yet.";
    publicEntryList.replaceChildren();
    publicEmptyState.classList.add("is-visible");
  }
}

bootstrap();
