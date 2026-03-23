const state = {
  itemsAi: [],
  statsAi: [],
  totalAi: 0,
  siteFilter: "",
  watchFilter: "",
  competitorSourceFilter: "official",
  competitorProductFilter: "",
  competitorTimeFilter: "latest",
  query: "",
  aiSortMode: "interest",
  boardSection: "focus",
  specialFocus: { sections: [], total_items: 0 },
  competitorMonitor: { sections: [], total_items: 0 },
  wechatFeed: {
    pages: [],
    pageIndex: 0,
    initialized: false,
    lastFetchedAt: 0,
  },
  waytoagiMode: "2d",
  waytoagiPage: 1,
  waytoagiData: null,
  generatedAt: null,
  overallGeneratedAt: null,
  currentUser: null,
  loading: {
    ai: false,
    focus: false,
    competitor: false,
    wechat: false,
    waytoagi: false,
  },
  loadErrors: {
    ai: null,
    focus: null,
    competitor: null,
    wechat: null,
    waytoagi: null,
  },
};

const logoutBtnEl = document.getElementById("logoutBtn");

const statsEl = document.getElementById("stats");
const siteSelectEl = document.getElementById("siteSelect");
const competitorTimeSelectEl = document.getElementById("competitorTimeSelect");
const sitePillsEl = document.getElementById("sitePills");
const newsListEl = document.getElementById("newsList");
const listPagerEl = document.getElementById("listPager");
const searchInputEl = document.getElementById("searchInput");
const resultCountEl = document.getElementById("resultCount");
const listTitleEl = document.getElementById("listTitle");
const aiSortSwitchWrapEl = document.getElementById("aiSortSwitchWrap");
const aiSortDefaultBtnEl = document.getElementById("aiSortDefaultBtn");
const aiSortInterestBtnEl = document.getElementById("aiSortInterestBtn");
const itemTpl = document.getElementById("itemTpl");
const heroTagEl = document.getElementById("heroTag");
const heroTitleEl = document.getElementById("heroTitle");
const heroSubEl = document.getElementById("heroSub");
const heroLogoEl = document.querySelector(".hero-logo");
const watchBoardEl = document.getElementById("watchBoard");

const tabAiBtnEl = document.getElementById("tabAiBtn");
const tabFocusBtnEl = document.getElementById("tabFocusBtn");
const tabWechatBtnEl = document.getElementById("tabWechatBtn");
const tabCompetitorBtnEl = document.getElementById("tabCompetitorBtn");
const themeToggleBtnEl = document.getElementById("themeToggleBtn");

const waytoagiWrapEl = document.getElementById("waytoagiWrap");
const waytoagiUpdatedAtEl = document.getElementById("waytoagiUpdatedAt");
const waytoagiMetaEl = document.getElementById("waytoagiMeta");
const waytoagiListEl = document.getElementById("waytoagiList");
const waytoagiPagerEl = document.getElementById("waytoagiPager");
const waytoagiTodayBtnEl = document.getElementById("waytoagiTodayBtn");
const waytoagi7dBtnEl = document.getElementById("waytoagi7dBtn");
const WAYTOAGI_PAGE_SIZE = 5;
const DATA_REFRESH_POLL_MS = 20000;
const WECHAT_REFRESH_POLL_MS = 5 * 60 * 1000;
const AUTH_STORAGE_KEY = "agent_news_accounts_v1";
const AUTH_SESSION_KEY = "agent_news_session_v1";
const LINGOWHALE_AUTH_STORAGE_KEY = "lingowhale_feed_auth_v1";
const WECHAT_FEED_DEFAULT_CONFIG = {
  endpoint: "https://api-public.lingowhale.com/api/feed/v2/feed/subscription",
  detailEndpoint: "https://api.lingowhale.com/api/entry/detail",
  channelIds: ["699fe88daffba3b7ded9a486"],
  sortType: 2,
  limit: 10,
  filterUnread: false,
  webSite: "web",
  origin: "https://lingowhale.com",
  referer: "https://lingowhale.com/",
  headers: {
    accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJCdWZmZXJUaW1lIjo2MDQ4MDAsImlzcyI6ImFjY2Vzc190b2tlbiIsImV4cCI6MTc3MzI5NjcyNiwibmJmIjoxNzcyMDg3MTI2LCJVaWQiOiIwMWViNmM4NDllMTQ0YWY2OTNjNzg2NDYyY2MwMTM4NiIsIlBpZCI6IjBlNDRlMjMzOTFkMjQ4Y2VhODc1NWNlNTJmMTA0OTk4IiwiR2lkIjozLCJTdWJHaWQiOjMwMiwiUGhvbmUiOiIiLCJVc2VyTmFtZSI6IueUqOaIt18xNzcyMDg3MTI2NDcxIn0.WTVJPBCRPxCz0CbPuLvRsrlQwY3guBvuaUlWnMnUi3E",
    authToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJCdWZmZXJUaW1lIjo2MDQ4MDAsImlzcyI6ImF1dGhfdG9rZW4iLCJleHAiOjE3NzQ2NzkxMjYsIm5iZiI6MTc3MjA4NzEyNiwiVWlkIjoiMDFlYjZjODQ5ZTE0NGFmNjkzYzc4NjQ2MmNjMDEzODYiLCJQaWQiOiIwZTQ0ZTIzMzkxZDI0OGNlYTg3NTVjZTUyZjEwNDk5OCIsIkdpZCI6MywiU3ViR2lkIjozMDIsIlBob25lIjoiIiwiVXNlck5hbWUiOiLnlKjmiLdfMTc3MjA4NzEyNjQ3MSJ9.NWHZdVgQNizaOBYsj4cXw5tzXN6SEx318Hcw5Ra7Uk4",
    uId: "0e44e23391d248cea8755ce52f104998",
    bId: "2887445415554ae396c7e650af8be732",
    guestId: "3d5ec084808368e39a787076f2bbcf70",
  },
};
const WECHAT_FEED_AUTH_MISSING_MSG = "AI HOTPOT🔥 鉴权缺失，请在浏览器 localStorage 的 lingowhale_feed_auth_v1 中配置 accessToken/authToken/uId/bId/guestId。";
const WECHAT_DETAIL_URL_CACHE = new Map();
const HERO_INBOX_FALLBACK_DATA = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none"><rect x="4" y="4" width="56" height="56" rx="14" fill="#E9F6FF" stroke="#9BCBEE"/><path d="M16 22a4 4 0 0 1 4-4h24a4 4 0 0 1 4 4v20a4 4 0 0 1-4 4h-8l-4-5-4 5h-8a4 4 0 0 1-4-4V22z" fill="#5CB8F7" stroke="#2F87D6" stroke-width="2"/><path d="M22 34h8l2 3h0l2-3h8" stroke="#1F6FB5" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M32 16v14" stroke="#2F87D6" stroke-width="3" stroke-linecap="round"/><path d="M27 25l5 5 5-5" stroke="#2F87D6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>')}`;
const DEFAULT_ACCOUNT = {
  username: "AF_PM",
  password: "AgentNewsTracker",
};

function applyTheme(mode) {
  const theme = mode === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", theme);
  if (themeToggleBtnEl) {
    themeToggleBtnEl.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
  }
  try {
    localStorage.setItem("agent_news_theme", theme);
  } catch (_) {}
}

function initTheme() {
  let saved = "light";
  try {
    saved = localStorage.getItem("agent_news_theme") || "light";
  } catch (_) {}
  applyTheme(saved === "dark" ? "dark" : "light");
}

async function hashPassword(password) {
  const normalized = String(password || "");
  if (window.crypto?.subtle && window.TextEncoder) {
    const bytes = new TextEncoder().encode(normalized);
    const digest = await window.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest)).map((x) => x.toString(16).padStart(2, "0")).join("");
  }
  return `plain:${normalized}`;
}

function readAccounts() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function writeAccounts(accounts) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(accounts));
}

async function ensureAuthStore() {
  const accounts = readAccounts();
  if (accounts.some((item) => item?.username === DEFAULT_ACCOUNT.username)) return accounts;
  const nextAccounts = accounts.concat({
    username: DEFAULT_ACCOUNT.username,
    passwordHash: await hashPassword(DEFAULT_ACCOUNT.password),
    createdAt: new Date().toISOString(),
    seed: true,
  });
  writeAccounts(nextAccounts);
  return nextAccounts;
}

function setSessionUser(username) {
  state.currentUser = username || null;
}

async function restoreSession() {
  await ensureAuthStore();
  const username = localStorage.getItem(AUTH_SESSION_KEY);
  if (!username) return false;
  const account = readAccounts().find((item) => item?.username === username);
  if (!account) {
    localStorage.removeItem(AUTH_SESSION_KEY);
    return false;
  }
  setSessionUser(username);
  return true;
}

function logoutUser() {
  localStorage.removeItem(AUTH_SESSION_KEY);
  setSessionUser("");
  window.location.assign("./login.html");
}

function fmtNumber(n) {
  return new Intl.NumberFormat("zh-CN").format(n || 0);
}

function fmtTime(iso) {
  if (!iso) return "时间未知";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "时间未知";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function fmtDate(iso) {
  if (!iso) return "未知日期";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function latestIso(values) {
  const timestamps = values
    .map((value) => {
      const ts = value ? new Date(value).getTime() : Number.NaN;
      return Number.isFinite(ts) ? ts : null;
    })
    .filter((value) => value !== null);

  if (!timestamps.length) return null;
  return new Date(Math.max(...timestamps)).toISOString();
}

function safeParseJson(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

function getWechatFeedConfig() {
  const override = safeParseJson(localStorage.getItem(LINGOWHALE_AUTH_STORAGE_KEY)) || {};
  const overrideHeaders = (override && typeof override === "object" && override.headers && typeof override.headers === "object")
    ? override.headers
    : {};
  return {
    ...WECHAT_FEED_DEFAULT_CONFIG,
    ...override,
    headers: {
      ...WECHAT_FEED_DEFAULT_CONFIG.headers,
      ...overrideHeaders,
    },
  };
}

function hasWechatFeedAuth(cfg) {
  const h = cfg?.headers || {};
  return Boolean(h.accessToken && h.authToken && h.uId && h.bId && h.guestId);
}

function getWechatAuthHeaders(cfg) {
  return {
    Accept: "application/json, text/plain, */*",
    "Content-Type": "application/json",
    "Access-Token": cfg?.headers?.accessToken || "",
    "Auth-Token": cfg?.headers?.authToken || "",
    "U-Id": cfg?.headers?.uId || "",
    "B-Id": cfg?.headers?.bId || "",
    "Guest-Id": cfg?.headers?.guestId || "",
    "Web-Site": cfg?.webSite || "web",
    Origin: cfg?.origin || "https://lingowhale.com",
    Referer: cfg?.referer || "https://lingowhale.com/",
  };
}

function normalizeUrlish(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (/^[a-z]+:\/\//i.test(value)) return "";
  return `https://${value.replace(/^\/+/, "")}`;
}

function trimUrlToken(value) {
  return String(value || "")
    .trim()
    .replace(/^[<("'`]+/, "")
    .replace(/[>"')`.,;!?，。；！）】]+$/, "");
}

function decodeURIComponentSafe(value) {
  try {
    return decodeURIComponent(value);
  } catch (_) {
    return String(value || "");
  }
}

function extractUrlsFromText(text) {
  const raw = String(text || "");
  if (!raw) return [];
  const normalizedText = raw
    .replace(/\\\//g, "/")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"");
  const directMatches = normalizedText.match(/https?:\/\/[^\s"'<>)\]}]+/gi) || [];
  const encodedMatches = normalizedText.match(/https%3A%2F%2F[A-Za-z0-9%._~!$&'()*+,;=:/?-]+/gi) || [];
  return directMatches.concat(encodedMatches.map((part) => decodeURIComponentSafe(part)));
}

function expandedWechatUrlCandidates(raw) {
  const normalized = normalizeUrlish(trimUrlToken(raw));
  if (!normalized) return [];
  const candidates = [normalized];
  try {
    const parsed = new URL(normalized);
    ["url", "u", "target", "target_url", "link", "redirect", "redirect_url", "dest", "destination", "continue", "to"]
      .forEach((key) => {
        const val = parsed.searchParams.get(key);
        if (!val) return;
        const decoded = decodeURIComponentSafe(val);
        const extracted = normalizeUrlish(trimUrlToken(decoded));
        if (extracted) candidates.push(extracted);
      });
  } catch (_) {}
  return candidates;
}

function isLikelyWechatArticleUrl(raw) {
  const normalized = normalizeUrlish(trimUrlToken(raw));
  if (!normalized) return false;
  try {
    const parsed = new URL(normalized);
    if (!/^https?:$/i.test(parsed.protocol)) return false;
    const host = parsed.hostname.toLowerCase();
    if (host === "lingowhale.com" || host === "www.lingowhale.com" || host === "api.lingowhale.com" || host === "api-public.lingowhale.com") {
      return false;
    }
    if (host.endsWith("aliyuncs.com")) return false;
    if ((parsed.pathname === "" || parsed.pathname === "/") && !parsed.search) return false;
    if (/\.(png|jpe?g|gif|webp|svg|ico|bmp|pdf)$/i.test(parsed.pathname)) return false;
    return true;
  } catch (_) {
    return false;
  }
}

function scoreWechatArticleUrl(raw) {
  const normalized = normalizeUrlish(trimUrlToken(raw));
  if (!normalized) return Number.NEGATIVE_INFINITY;
  try {
    const parsed = new URL(normalized);
    const host = parsed.hostname.toLowerCase();
    let score = 0;
    if (host === "mp.weixin.qq.com") score += 120;
    if (host.endsWith("weixin.qq.com")) score += 80;
    if (parsed.pathname.startsWith("/s")) score += 20;
    if (parsed.search.includes("__biz=") && parsed.search.includes("mid=")) score += 20;
    if (parsed.hash.includes("wechat_redirect")) score += 5;
    return score;
  } catch (_) {
    return Number.NEGATIVE_INFINITY;
  }
}

function pickBestWechatArticleUrl(rawCandidates) {
  const seen = new Set();
  let bestUrl = "";
  let bestScore = Number.NEGATIVE_INFINITY;
  rawCandidates.forEach((raw) => {
    expandedWechatUrlCandidates(raw).forEach((candidate) => {
      const normalized = normalizeUrlish(trimUrlToken(candidate));
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      if (!isLikelyWechatArticleUrl(normalized)) return;
      const score = scoreWechatArticleUrl(normalized);
      if (!bestUrl || score > bestScore) {
        bestUrl = normalized;
        bestScore = score;
      }
    });
  });
  return bestUrl;
}

function resolveWechatTargetUrl(item) {
  const seeds = [
    item?.url,
    item?.source_url,
    item?.origin_url,
    item?.share_url,
    item?.original_url,
  ];
  [item?.description, item?.content, item?.abstract].forEach((text) => {
    extractUrlsFromText(text).forEach((url) => seeds.push(url));
  });

  return pickBestWechatArticleUrl(seeds);
}

function resolveWechatDetailTargetUrl(detail) {
  const urlInfo = detail?.url_info || {};
  const htmlContent = String(urlInfo?.html_content || "");
  const seeds = [];

  const hrefMatches = htmlContent.matchAll(/href=["']([^"']+)["']/gi);
  for (const match of hrefMatches) {
    seeds.push(match[1]);
  }

  extractUrlsFromText(urlInfo?.content).forEach((url) => seeds.push(url));
  extractUrlsFromText(urlInfo?.html_content).forEach((url) => seeds.push(url));
  return pickBestWechatArticleUrl(seeds);
}

async function fetchWechatDetailTargetUrl(item, cfg) {
  const entryId = String(item?.entry_id || "").trim();
  const entryType = Number(item?.entry_type);
  if (!entryId || !Number.isFinite(entryType)) return "";

  const cacheKey = `${entryType}:${entryId}`;
  const cached = WECHAT_DETAIL_URL_CACHE.get(cacheKey);
  if (typeof cached === "string") return cached;
  if (cached && typeof cached.then === "function") return cached;

  const requestPromise = (async () => {
    try {
      const endpoint = String(cfg?.detailEndpoint || WECHAT_FEED_DEFAULT_CONFIG.detailEndpoint || "").trim();
      if (!endpoint) return "";
      const params = new URLSearchParams({
        entry_id: entryId,
        entry_type: String(entryType),
      });
      const res = await fetch(`${endpoint}?${params.toString()}`, {
        method: "GET",
        headers: getWechatAuthHeaders(cfg),
      });
      if (!res.ok) return "";
      const json = await res.json();
      if (!json || Number(json.code) !== 0) return "";
      return resolveWechatDetailTargetUrl(json.data || "");
    } catch (_) {
      return "";
    }
  })();

  WECHAT_DETAIL_URL_CACHE.set(cacheKey, requestPromise);
  const resolved = await requestPromise;
  WECHAT_DETAIL_URL_CACHE.set(cacheKey, resolved || "");
  return resolved || "";
}

function normalizeWechatFeedItem(item) {
  const channelName = String(item?.channel?.name || "未知频道");
  const sourceName = String(
    item?.info_source?.info_source_name
    || item?.channel?.info_sources?.[0]?.info_source_name
    || item?.info_source?.info_source_root
    || "未知来源"
  );
  const pubTs = Number(item?.pub_time);
  const pubIso = Number.isFinite(pubTs) && pubTs > 0 ? new Date(pubTs * 1000).toISOString() : "";
  const abstractText = String(item?.abstract || item?.description || item?.content || "").trim();
  const snippet = abstractText ? abstractText.slice(0, 220) : "暂无摘要";
  return {
    ...item,
    title: String(item?.title || "无标题"),
    channel_name: channelName,
    source_name: sourceName,
    abstract_text: snippet,
    target_url: resolveWechatTargetUrl(item),
    published_at: pubIso,
    site_name: channelName,
    site_id: String(item?.channel?.channel_id || "wechat"),
    source: sourceName,
  };
}

async function fetchWechatFeedPage(cursor = "") {
  const cfg = getWechatFeedConfig();
  if (!hasWechatFeedAuth(cfg)) throw new Error(WECHAT_FEED_AUTH_MISSING_MSG);

  const payload = {
    cursor: String(cursor || ""),
    sort_type: Number(cfg.sortType || 2),
    limit: Number(cfg.limit || 10),
    filter_unread: Boolean(cfg.filterUnread),
    channel_ids: Array.isArray(cfg.channelIds) ? cfg.channelIds : WECHAT_FEED_DEFAULT_CONFIG.channelIds,
  };
  const res = await fetch(cfg.endpoint, {
    method: "POST",
    headers: getWechatAuthHeaders(cfg),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI HOTPOT🔥 请求失败：HTTP ${res.status} ${text.slice(0, 180)}`);
  }

  const json = await res.json();
  if (!json || Number(json.code) !== 0) {
    const code = json && Object.prototype.hasOwnProperty.call(json, "code") ? json.code : "unknown";
    const msg = json?.msg || "unknown";
    throw new Error(`AI HOTPOT🔥 接口返回错误：code=${code}, msg=${msg}`);
  }

  const data = json.data || {};
  const list = Array.isArray(data.feed_list) ? data.feed_list : [];
  const normalizedItems = list.map(normalizeWechatFeedItem);
  const items = await Promise.all(normalizedItems.map(async (item) => {
    if (item.target_url) return item;
    const recovered = await fetchWechatDetailTargetUrl(item, cfg);
    if (!recovered) return item;
    return { ...item, target_url: recovered };
  }));
  return {
    items,
    cursor: String(data.cursor || ""),
    hasMore: Boolean(data.has_more),
  };
}

function wechatFeedRefreshStale() {
  if (!state.wechatFeed.initialized) return true;
  const lastFetchedAt = Number(state.wechatFeed.lastFetchedAt || 0);
  if (!Number.isFinite(lastFetchedAt) || lastFetchedAt <= 0) return true;
  return (Date.now() - lastFetchedAt) >= WECHAT_REFRESH_POLL_MS;
}

async function refreshWechatFirstPage({ silent = false, allowUninitialized = false, force = false } = {}) {
  if (state.loading.wechat) return false;
  if (!allowUninitialized && !state.wechatFeed.initialized) return false;
  if (!force && !wechatFeedRefreshStale()) return false;

  state.loading.wechat = true;
  state.loadErrors.wechat = null;
  if (!silent) renderAll();

  try {
    const page = await fetchWechatFeedPage("");
    state.wechatFeed.pages = [page];
    state.wechatFeed.pageIndex = 0;
    state.wechatFeed.initialized = true;
    state.wechatFeed.lastFetchedAt = Date.now();
    state.loadErrors.wechat = null;
    return true;
  } catch (err) {
    state.loadErrors.wechat = err;
    return false;
  } finally {
    state.loading.wechat = false;
    if (!silent || state.boardSection === "wechat" || state.loadErrors.wechat) {
      renderAll();
    }
  }
}

async function loadWechatInitialPage() {
  await refreshWechatFirstPage({ silent: false, allowUninitialized: true, force: true });
}

async function loadWechatNextPage() {
  if (state.loading.wechat) return;
  const pages = state.wechatFeed.pages || [];
  const current = pages[state.wechatFeed.pageIndex];
  if (!current) return;
  if (!current.hasMore || !current.cursor) return;

  state.loading.wechat = true;
  state.loadErrors.wechat = null;
  renderAll();
  try {
    const page = await fetchWechatFeedPage(current.cursor);
    state.wechatFeed.pages.push(page);
    state.wechatFeed.pageIndex = state.wechatFeed.pages.length - 1;
    state.wechatFeed.lastFetchedAt = Date.now();
    state.loadErrors.wechat = null;
  } catch (err) {
    state.loadErrors.wechat = err;
  } finally {
    state.loading.wechat = false;
    renderAll();
  }
}

function gotoWechatPrevPage() {
  if (state.wechatFeed.pageIndex <= 0) return;
  state.wechatFeed.pageIndex -= 1;
  renderAll();
}

function gotoWechatNextPage() {
  const pages = state.wechatFeed.pages || [];
  const idx = state.wechatFeed.pageIndex;
  if (idx < pages.length - 1) {
    state.wechatFeed.pageIndex += 1;
    renderAll();
    return;
  }
  const current = pages[idx];
  if (!current || !current.hasMore) return;
  loadWechatNextPage();
}

function competitorTimeFilterLabel() {
  if (state.competitorTimeFilter === "14d") return "近2周";
  if (state.competitorTimeFilter === "7d") return "近7天";
  return "最近更新";
}

function itemTimestamp(item) {
  const raw = item?.published_at || item?.first_seen_at;
  const ts = raw ? new Date(raw).getTime() : Number.NaN;
  return Number.isFinite(ts) ? ts : 0;
}

function compareItemsByTimestampDesc(a, b) {
  const byTs = itemTimestamp(b) - itemTimestamp(a);
  if (byTs !== 0) return byTs;

  const byPublished = Number(Boolean(b?.published_at)) - Number(Boolean(a?.published_at));
  if (byPublished !== 0) return byPublished;

  const aKey = String(a?.id || a?.url || a?.title || "");
  const bKey = String(b?.id || b?.url || b?.title || "");
  const byKey = aKey.localeCompare(bKey, "en");
  if (byKey !== 0) return byKey;

  return String(a?.title || "").localeCompare(String(b?.title || ""), "zh-CN");
}

function competitorItemPassesTime(item) {
  if (state.competitorTimeFilter === "latest") return true;
  const raw = item?.published_at || item?.first_seen_at;
  if (!raw) return false;
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return false;
  const days = state.competitorTimeFilter === "14d" ? 14 : 7;
  const keepAfter = Date.now() - (days * 24 * 60 * 60 * 1000);
  return dt.getTime() >= keepAfter;
}

function competitorApplyTimeFilter(items) {
  const arr = Array.isArray(items) ? items.slice() : [];
  if (state.competitorTimeFilter === "latest") {
    const dated = arr
      .map((x) => {
        return { item: x, ts: itemTimestamp(x) };
      })
      .filter((x) => x.ts > 0);
    if (!dated.length) return arr.slice(0, 1);
    dated.sort((a, b) => b.ts - a.ts);
    return [dated[0].item];
  }
  return arr.filter((x) => competitorItemPassesTime(x));
}

function currentSectionTitle() {
  if (state.boardSection === "focus") return "特别关注（近3天）";
  if (state.boardSection === "wechat") return "AI HOTPOT🔥";
  if (state.boardSection === "competitor") return `竞品更新追踪（${competitorTimeFilterLabel()}）`;
  return "最近 24 小时更新";
}

function setStatsCards(cards) {
  statsEl.innerHTML = "";
  cards.forEach(([k, v]) => {
    const node = document.createElement("div");
    node.className = "stat";
    node.innerHTML = `<div class="k">${k}</div><div class="v">${v}</div>`;
    statsEl.appendChild(node);
  });
}

function setStatsForCurrentSection() {
  const isAi = state.boardSection === "ai";
  statsEl.classList.add("hidden");
  watchBoardEl.classList.add("hidden");
  statsEl.innerHTML = "";
  watchBoardEl.innerHTML = "";
  if (!isAi) return;
}

function renderHeroBySection() {
  if (state.boardSection === "ai") {
    if (heroLogoEl) {
      heroLogoEl.onerror = null;
      heroLogoEl.src = "./assets/hero-ai.svg";
      heroLogoEl.alt = "AI资讯图标";
    }
    heroTagEl.textContent = "AI NEWS INTELLIGENCE";
    heroTitleEl.textContent = "AI资讯（近24h）";
    heroSubEl.textContent = "信息爆炸时代的资讯滤纸，只滴滤最好喝的AI Coffee。";
    return;
  }

  if (state.boardSection === "focus") {
    if (heroLogoEl) {
      heroLogoEl.onerror = null;
      heroLogoEl.src = "./assets/hero-focus.svg";
      heroLogoEl.alt = "特别关注图标";
    }
    const days = Number(state.specialFocus?.window_days || 3);
    heroTagEl.textContent = "SPECIAL FOCUS";
    heroTitleEl.textContent = `特别关注（近${days}天）`;
    heroSubEl.textContent = "不生产噱头，只做忠实的搬运工——preset themes，integrate news，remove noise";
    return;
  }

  if (state.boardSection === "wechat") {
    if (heroLogoEl) {
      heroLogoEl.onerror = () => {
        heroLogoEl.onerror = null;
        heroLogoEl.src = HERO_INBOX_FALLBACK_DATA;
      };
      heroLogoEl.src = "./assets/hero-inbox.svg";
      heroLogoEl.alt = "AI HOTPOT🔥图标";
    }
    heroTagEl.textContent = "AI HOTPOT";
    heroTitleEl.textContent = "AI HOTPOT🔥";
    heroSubEl.textContent = "精选WX公众号的AI相关内容，二手的消息也很香！";
    return;
  }

  if (heroLogoEl) {
    heroLogoEl.onerror = null;
    heroLogoEl.src = "./assets/hero-competitor.svg";
    heroLogoEl.alt = "竞品更新追踪图标";
  }
  heroTagEl.textContent = "COMPETITOR MONITOR";
  heroTitleEl.textContent = `竞品更新追踪（${competitorTimeFilterLabel()}）`;
  heroSubEl.textContent = "重点跟踪扣子、AppBuilder、百炼、腾讯元器等平台更新，按主题分组展示。";
}

function computeSiteStats(items) {
  const m = new Map();
  items.forEach((item) => {
    if (!m.has(item.site_id)) {
      m.set(item.site_id, { site_id: item.site_id, site_name: item.site_name, count: 0, raw_count: 0 });
    }
    const row = m.get(item.site_id);
    row.count += 1;
    row.raw_count += 1;
  });
  return Array.from(m.values()).sort((a, b) => b.count - a.count || a.site_name.localeCompare(b.site_name, "zh-CN"));
}

function activeAiItems() {
  return state.itemsAi;
}

function activeWatchSections() {
  if (state.boardSection === "focus") return state.specialFocus.sections || [];
  if (state.boardSection === "competitor") return state.competitorMonitor.sections || [];
  return [];
}

function activeBaseItems() {
  if (state.boardSection === "ai") return activeAiItems();
  if (state.boardSection === "wechat") {
    const page = state.wechatFeed.pages[state.wechatFeed.pageIndex];
    return Array.isArray(page?.items) ? page.items : [];
  }
  return activeWatchSections().flatMap((s) => s.items || []);
}

function hasItemsForSection(section) {
  if (section === "ai") return activeAiItems().length > 0;
  if (section === "focus") return (state.specialFocus.sections || []).some((s) => (s.items || []).length > 0);
  if (section === "competitor") return (state.competitorMonitor.sections || []).some((s) => (s.items || []).length > 0);
  if (section === "wechat") return (state.wechatFeed.pages || []).some((p) => (p.items || []).length > 0);
  return false;
}

function currentSiteStats() {
  return computeSiteStats(activeBaseItems());
}

function siteLabel(siteId, siteName) {
  const map = {
    newsnow: "新闻快讯",
    buzzing: "热议追踪",
    tophub: "中文AI热点榜",
    aihot: "全球AI榜单聚合",
    infoflow: "信息流",
    techurls: "科技网址",
    albase: "AI基地",
  };
  const key = String(siteId || "").trim().toLowerCase();
  const mapped = map[key];
  if (mapped) return mapped;
  return String(siteName || siteId || "").trim();
}

function renderSiteFilters() {
  sitePillsEl.innerHTML = "";
  siteSelectEl.innerHTML = "";

  if (state.boardSection === "wechat") {
    siteSelectEl.innerHTML = '<option value="">AI HOTPOT🔥</option>';
    siteSelectEl.value = "";
    return;
  }

  if (state.boardSection === "ai") {
    const stats = currentSiteStats();
    siteSelectEl.innerHTML = '<option value="">全部站点</option>';
    stats.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s.site_id;
      opt.textContent = siteLabel(s.site_id, s.site_name);
      siteSelectEl.appendChild(opt);
    });
    siteSelectEl.value = state.siteFilter;

    const allPill = document.createElement("button");
    allPill.className = `pill ${state.siteFilter === "" ? "active" : ""}`;
    allPill.textContent = "全部";
    allPill.onclick = () => {
      state.siteFilter = "";
      renderSiteFilters();
      renderList();
    };
    sitePillsEl.appendChild(allPill);

    stats.forEach((s) => {
      const btn = document.createElement("button");
      btn.className = `pill ${state.siteFilter === s.site_id ? "active" : ""}`;
      btn.textContent = siteLabel(s.site_id, s.site_name);
      btn.onclick = () => {
        state.siteFilter = s.site_id;
        renderSiteFilters();
        renderList();
      };
      sitePillsEl.appendChild(btn);
    });
    return;
  }

  const sections = activeWatchSections();
  const isCompetitor = state.boardSection === "competitor";
  if (!isCompetitor) {
    const filterOptions = [{ id: "", label: "全部主题" }];
    sections.forEach((section) => {
      filterOptions.push({
        id: `section:${section.id}`,
        label: `${section.name} (${fmtNumber((section.items || []).length)})`,
      });
    });

    filterOptions.forEach((f) => {
      const opt = document.createElement("option");
      opt.value = f.id;
      opt.textContent = f.label;
      siteSelectEl.appendChild(opt);
    });
    siteSelectEl.value = state.watchFilter;

    filterOptions.forEach((f) => {
      const btn = document.createElement("button");
      btn.className = `pill ${state.watchFilter === f.id ? "active" : ""}`;
      btn.textContent = f.label.replace(/\s*\(\d[\d,]*\)\s*$/, "");
      btn.onclick = () => {
        state.watchFilter = f.id;
        renderSiteFilters();
        renderList();
      };
      sitePillsEl.appendChild(btn);
    });
    return;
  }

  // Competitor tab: source class selector + product pills.
  const allItems = sections.flatMap((s) => competitorApplyTimeFilter(s.items || []));
  const officialCount = allItems.filter((i) => i.monitor_class === "official").length;
  const otherCount = allItems.filter((i) => i.monitor_class !== "official").length;
  const sourceOptions = [
    { id: "all", label: `全部 (${fmtNumber(allItems.length)})` },
    { id: "official", label: `官方公告 (${fmtNumber(officialCount)})` },
    { id: "other", label: `其他来源 (${fmtNumber(otherCount)})` },
  ];
  sourceOptions.forEach((f) => {
    const opt = document.createElement("option");
    opt.value = f.id;
    opt.textContent = f.label;
    siteSelectEl.appendChild(opt);
  });
  siteSelectEl.value = state.competitorSourceFilter || "official";

  const productFilters = [{ id: "", name: "全部", count: allItems.length }].concat(
    sections.map((s) => ({ id: s.id, name: s.name, count: competitorApplyTimeFilter(s.items || []).length }))
  );
  productFilters.forEach((f) => {
    const btn = document.createElement("button");
    btn.className = `pill ${state.competitorProductFilter === f.id ? "active" : ""}`;
    btn.textContent = `${f.name}${f.id ? "" : ""}`;
    btn.onclick = () => {
      state.competitorProductFilter = f.id;
      renderSiteFilters();
      renderList();
    };
    sitePillsEl.appendChild(btn);
  });
}

function renderBoardTabs() {
  tabAiBtnEl.classList.toggle("active", state.boardSection === "ai");
  tabFocusBtnEl.classList.toggle("active", state.boardSection === "focus");
  if (tabWechatBtnEl) tabWechatBtnEl.classList.toggle("active", state.boardSection === "wechat");
  tabCompetitorBtnEl.classList.toggle("active", state.boardSection === "competitor");
}

function currentSectionLoadingMessage() {
  if (state.boardSection === "ai") {
    return "AI 资讯主数据较大，首次进入可能需要几秒，内容到达后会自动显示。";
  }
  if (state.boardSection === "focus") {
    return "正在整理特别关注内容。系统会同时拉取多份数据，其中 AI 资讯主数据较大，但当前内容会优先显示。";
  }
  if (state.boardSection === "wechat") {
    return "AI HOTPOT🔥 正在慢慢炖煮中，可能会稍微久一点点（10-30 秒），先喝口水，内容回来会自动出现～";
  }
  return "正在加载竞品更新追踪，内容到达后会自动显示。";
}

function currentSectionErrorMessage() {
  const err = state.loadErrors[state.boardSection];
  if (!err) return "当前内容加载失败，请稍后刷新重试。";
  return err.message || "当前内容加载失败，请稍后刷新重试。";
}

function renderSectionStatusIfNeeded() {
  const section = state.boardSection;
  if (state.loading[section] && !hasItemsForSection(section)) {
    resultCountEl.textContent = "加载中";
    newsListEl.innerHTML = `<div class="empty">${currentSectionLoadingMessage()}</div>`;
    return true;
  }
  if (state.loadErrors[section] && !hasItemsForSection(section)) {
    resultCountEl.textContent = "加载失败";
    newsListEl.innerHTML = `<div class="empty">${currentSectionErrorMessage()}</div>`;
    return true;
  }
  return false;
}

function renderModeSwitch() {
  const isAi = state.boardSection === "ai";
  const isFocus = state.boardSection === "focus";
  const isCompetitor = state.boardSection === "competitor";
  const isWechat = state.boardSection === "wechat";
  waytoagiWrapEl.classList.toggle("hidden", !isFocus);
  if (competitorTimeSelectEl) {
    competitorTimeSelectEl.classList.toggle("hidden", !isCompetitor);
    competitorTimeSelectEl.value = state.competitorTimeFilter || "latest";
  }

  siteSelectEl.classList.toggle("hidden", isWechat);
  sitePillsEl.classList.toggle("hidden", isWechat);
  if (aiSortSwitchWrapEl) aiSortSwitchWrapEl.classList.toggle("hidden", !(isAi && !state.siteFilter));
  if (aiSortDefaultBtnEl) aiSortDefaultBtnEl.classList.toggle("active", state.aiSortMode === "default");
  if (aiSortInterestBtnEl) aiSortInterestBtnEl.classList.toggle("active", state.aiSortMode === "interest");
}

function itemMatchesQuery(item) {
  const q = state.query.trim().toLowerCase();
  if (!q) return true;
  const hay = `${item.title || ""} ${item.title_zh || ""} ${item.title_en || ""} ${item.site_name || ""} ${item.source || ""} ${item.channel_name || ""} ${item.abstract_text || ""}`.toLowerCase();
  return hay.includes(q);
}

function normalizeTitleForDedupe(raw) {
  const s = String(raw || "").toLowerCase();
  const compact = s
    .replace(/【[^】]*】/g, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/（[^）]*）/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "");
  if (!compact) return "";
  return compact;
}

function dedupeAiItemsForDisplay(items) {
  const sorted = items.slice().sort((a, b) => {
    const at = new Date(a.published_at || a.first_seen_at || 0).getTime() || 0;
    const bt = new Date(b.published_at || b.first_seen_at || 0).getTime() || 0;
    return bt - at;
  });

  const kept = [];
  const seen = [];
  sorted.forEach((item) => {
    const t = item.title_zh || item.title || item.title_en || "";
    const n = normalizeTitleForDedupe(t);
    if (!n) {
      kept.push(item);
      return;
    }

    const core = normalizeTitleForDedupe(String(t).split(/[:：]/).slice(1).join(":"));
    const currentKeys = [n, core].filter(Boolean);

    const dup = seen.some((x) => {
      if (!x) return false;
      if (currentKeys.includes(x)) return true;
      const minLen = Math.min(x.length, n.length);
      if (minLen >= 18 && (x.includes(n) || n.includes(x))) return true;
      return false;
    });

    if (dup) return;
    kept.push(item);
    seen.push(...currentKeys);
  });
  return kept;
}

const PRIORITY_COMPANY_KEYWORDS = [
  "openai", "chatgpt", "anthropic", "claude", "google", "gemini", "deepmind", "microsoft", "copilot",
  "meta", "llama", "nvidia", "amazon", "aws", "xai", "grok", "mistral", "cohere", "perplexity",
  "hugging face", "stability ai", "databricks", "scale ai", "cursor",
  "字节", "豆包", "腾讯", "混元", "阿里", "通义", "百度", "文心", "智谱", "glm", "月之暗面", "kimi",
  "minimax", "零一万物", "yi", "阶跃", "step", "deepseek",
];

const PRIORITY_TOPIC_RULES = [
  { id: "agent", points: 46, patterns: ["agent", "ai agent", "智能体", "多智能体", "autonomous agent"] },
  { id: "rag", points: 42, patterns: ["rag", "检索增强", "retrieval-augmented", "向量检索"] },
  { id: "model", points: 36, patterns: ["模型", "llm", "vlm", "sft", "rlhf", "pretrain", "finetune", "微调", "蒸馏", "量化"] },
  { id: "kg", points: 34, patterns: ["知识图谱", "knowledge graph", "graph rag", "graph database"] },
  { id: "skills", points: 34, patterns: ["skills", "skill", "技能", "技能商店"] },
  { id: "tool", points: 34, patterns: ["工具调用", "tool calling", "function calling", "mcp", "工具链", "workflow"] },
];

function textForPriority(item) {
  return `${item.title || ""} ${item.title_zh || ""} ${item.title_en || ""} ${item.source || ""} ${item.site_name || ""} ${item.url || ""}`.toLowerCase();
}

function calcPriorityScore(item) {
  const text = textForPriority(item);
  let score = 0;

  let companyHits = 0;
  PRIORITY_COMPANY_KEYWORDS.forEach((kw) => {
    if (text.includes(kw)) companyHits += 1;
  });
  score += Math.min(companyHits, 3) * 26;

  PRIORITY_TOPIC_RULES.forEach((rule) => {
    const hit = rule.patterns.some((p) => text.includes(p));
    if (hit) score += rule.points;
  });

  const dtRaw = item.published_at || item.first_seen_at;
  const dt = dtRaw ? new Date(dtRaw) : null;
  if (dt && !Number.isNaN(dt.getTime())) {
    const ageHours = (Date.now() - dt.getTime()) / (1000 * 60 * 60);
    if (ageHours <= 6) score += 20;
    else if (ageHours <= 12) score += 12;
    else if (ageHours <= 24) score += 6;
  }

  return score;
}

function sortByPriority(items) {
  const scored = items.map((item) => ({
    item,
    score: calcPriorityScore(item),
    ts: new Date(item.published_at || item.first_seen_at || 0).getTime() || 0,
  }));

  scored.sort((a, b) => b.score - a.score || b.ts - a.ts);
  return scored;
}

function renderPriorityAiAll(items) {
  const scored = sortByPriority(items);
  const primary = scored.filter((x) => x.score >= 56);
  const secondary = scored.filter((x) => x.score < 56);
  const frag = document.createDocumentFragment();

  const sections = [
    { title: "重点优先（知名公司/产品 + 关键技术）", rows: primary },
    { title: "其他资讯", rows: secondary },
  ];

  sections.forEach((section) => {
    if (!section.rows.length) return;
    const node = document.createElement("section");
    node.className = "site-group";
    node.innerHTML = `
      <header class="site-group-head">
        <h3>${section.title}</h3>
        <span>${fmtNumber(section.rows.length)} 条</span>
      </header>
      <div class="site-group-list"></div>
    `;
    const listEl = node.querySelector(".site-group-list");
    section.rows.forEach((row) => listEl.appendChild(renderItemNode(row.item)));
    frag.appendChild(node);
  });

  newsListEl.appendChild(frag);
}

function getFilteredAiItems() {
  return activeAiItems().filter((item) => {
    if (state.siteFilter && item.site_id !== state.siteFilter) return false;
    return itemMatchesQuery(item);
  });
}

function renderItemNode(item, options = {}) {
  const node = itemTpl.content.firstElementChild.cloneNode(true);
  node.querySelector(".site").textContent = item.site_name;
  let sourcePrefix = "";
  if (state.boardSection === "competitor") {
    sourcePrefix = item.monitor_class === "official" ? "[官方公告] " : "[其他来源] ";
  } else if (options.sectionName) {
    sourcePrefix = `[${options.sectionName}] `;
  }
  node.querySelector(".source").textContent = `分区: ${sourcePrefix}${item.source}`;
  if (state.boardSection === "competitor" && item.monitor_class === "official") {
    node.querySelector(".time").textContent = item.published_at ? `公告日期: ${fmtTime(item.published_at)}` : "公告日期: 未知";
  } else {
    node.querySelector(".time").textContent = fmtTime(item.published_at || item.first_seen_at);
  }

  const titleEl = node.querySelector(".title");
  const zh = (item.title_zh || "").trim();
  const en = (item.title_en || "").trim();
  const detailPoints = Array.isArray(item.detail_points) ? item.detail_points.filter((x) => String(x || "").trim()) : [];
  titleEl.textContent = "";
  if (zh && en && zh !== en) {
    const primary = document.createElement("span");
    primary.textContent = zh;
    const sub = document.createElement("span");
    sub.className = "title-sub";
    sub.textContent = en;
    titleEl.appendChild(primary);
    titleEl.appendChild(sub);
  } else {
    titleEl.textContent = item.title || zh || en;
  }
  if (detailPoints.length > 0) {
    const detailGroups = Array.isArray(item.detail_groups) ? item.detail_groups : [];
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "detail-toggle";
    const defaultOpen = Boolean(item.auto_expand_details);
    toggle.setAttribute("aria-expanded", defaultOpen ? "true" : "false");
    toggle.innerHTML = `<span class="arrow">${defaultOpen ? "▴" : "▾"}</span><span>${defaultOpen ? "收起详情" : "展开详情"}</span>`;
    const panel = document.createElement("div");
    panel.className = "detail-panel";
    if (detailGroups.length > 0) {
      detailGroups.forEach((group) => {
        const gTitle = String(group?.title || "").trim();
        const bullets = Array.isArray(group?.bullets) ? group.bullets.filter((x) => String(x || "").trim()) : [];
        if (!gTitle && bullets.length === 0) return;
        const block = document.createElement("div");
        block.className = "detail-group";
        if (gTitle) {
          const t = document.createElement("div");
          t.className = "detail-group-title";
          t.textContent = gTitle;
          block.appendChild(t);
        }
        if (bullets.length > 0) {
          const ul = document.createElement("ul");
          ul.className = "detail-bullets";
          bullets.forEach((b) => {
            const li = document.createElement("li");
            li.textContent = String(b);
            ul.appendChild(li);
          });
          block.appendChild(ul);
        }
        panel.appendChild(block);
      });
    } else {
      detailPoints.forEach((point) => {
        const row = document.createElement("div");
        row.className = "detail-point";
        row.textContent = String(point);
        panel.appendChild(row);
      });
    }
    toggle.addEventListener("click", () => {
      const opened = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", opened ? "false" : "true");
      node.classList.toggle("details-open", !opened);
      toggle.querySelector(".arrow").textContent = opened ? "▾" : "▴";
      toggle.querySelector("span:last-child").textContent = opened ? "展开详情" : "收起详情";
    });
    if (defaultOpen) node.classList.add("details-open");
    node.appendChild(toggle);
    node.appendChild(panel);
  }
  titleEl.href = item.url;
  return node;
}

function currentWechatPage() {
  return state.wechatFeed.pages[state.wechatFeed.pageIndex] || null;
}

function renderWechatItemNode(item) {
  const node = itemTpl.content.firstElementChild.cloneNode(true);
  node.classList.add("wechat-card");
  const siteEl = node.querySelector(".site");
  if (siteEl) siteEl.remove();
  node.querySelector(".source").textContent = `来源: ${item.source_name || "未知来源"}`;
  node.querySelector(".time").textContent = fmtTime(item.published_at);

  const titleEl = node.querySelector(".title");
  titleEl.textContent = item.title || "无标题";
  if (item.target_url) {
    titleEl.href = item.target_url;
    titleEl.target = "_blank";
    titleEl.rel = "noopener noreferrer";
    titleEl.classList.remove("no-link");
  } else {
    titleEl.removeAttribute("href");
    titleEl.removeAttribute("target");
    titleEl.removeAttribute("rel");
    titleEl.classList.add("no-link");
  }

  const abstractEl = document.createElement("p");
  abstractEl.className = "wechat-abstract";
  abstractEl.textContent = item.abstract_text || "暂无摘要";
  node.appendChild(abstractEl);
  return node;
}

function renderWechatPager(page) {
  if (!listPagerEl) return;
  listPagerEl.innerHTML = "";
  listPagerEl.classList.remove("hidden");
  if (!page) return;

  const prevBtn = document.createElement("button");
  prevBtn.className = "waytoagi-page-btn";
  prevBtn.type = "button";
  prevBtn.textContent = "上一页";
  prevBtn.disabled = state.wechatFeed.pageIndex <= 0 || state.loading.wechat;
  prevBtn.addEventListener("click", () => {
    gotoWechatPrevPage();
  });

  const pageInfo = document.createElement("span");
  pageInfo.className = "waytoagi-page-info";
  pageInfo.textContent = `${state.wechatFeed.pageIndex + 1} / ${state.wechatFeed.pages.length || 1}`;

  const hasCacheNext = state.wechatFeed.pageIndex < state.wechatFeed.pages.length - 1;
  const canFetchNext = Boolean(page.hasMore && page.cursor);
  const nextBtn = document.createElement("button");
  nextBtn.className = "waytoagi-page-btn";
  nextBtn.type = "button";
  nextBtn.textContent = state.loading.wechat ? "加载中..." : (hasCacheNext ? "下一页" : (canFetchNext ? "加载下一页" : "下一页"));
  nextBtn.disabled = state.loading.wechat || (!hasCacheNext && !canFetchNext);
  nextBtn.addEventListener("click", () => {
    gotoWechatNextPage();
  });

  listPagerEl.appendChild(prevBtn);
  listPagerEl.appendChild(pageInfo);
  listPagerEl.appendChild(nextBtn);
}

function renderWechatPage() {
  const page = currentWechatPage();
  if (!page) {
    resultCountEl.textContent = "0 条";
    newsListEl.innerHTML = '<div class="empty">暂无公众号内容，可稍后重试。</div>';
    renderWechatPager(null);
    return;
  }

  const filtered = (page.items || []).filter((item) => itemMatchesQuery(item));
  resultCountEl.textContent = `${fmtNumber(filtered.length)} 条`;
  if (!filtered.length) {
    newsListEl.innerHTML = '<div class="empty">当前筛选条件下没有结果。</div>';
    renderWechatPager(page);
    return;
  }

  const frag = document.createDocumentFragment();
  filtered.forEach((item) => frag.appendChild(renderWechatItemNode(item)));
  newsListEl.appendChild(frag);
  renderWechatPager(page);
}

function buildSourceGroupNode(source, items) {
  const section = document.createElement("section");
  section.className = "source-group";
  section.innerHTML = `
    <header class="source-group-head">
      <h3>${source}</h3>
      <span>${fmtNumber(items.length)} 条</span>
    </header>
    <div class="source-group-list"></div>
  `;
  const listEl = section.querySelector(".source-group-list");
  items.forEach((item) => listEl.appendChild(renderItemNode(item)));
  return section;
}

function groupBySource(items) {
  const groupMap = new Map();
  items.forEach((item) => {
    const key = item.source || "未分区";
    if (!groupMap.has(key)) {
      groupMap.set(key, []);
    }
    groupMap.get(key).push(item);
  });

  return Array.from(groupMap.entries()).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], "zh-CN"));
}

function renderGroupedBySource(items) {
  const groups = groupBySource(items);
  const frag = document.createDocumentFragment();

  groups.forEach(([source, groupItems]) => {
    frag.appendChild(buildSourceGroupNode(source, groupItems));
  });

  newsListEl.appendChild(frag);
}

function renderGroupedBySiteAndSource(items) {
  const siteMap = new Map();
  items.forEach((item) => {
    if (!siteMap.has(item.site_id)) {
      siteMap.set(item.site_id, {
        siteName: item.site_name || item.site_id,
        items: [],
      });
    }
    siteMap.get(item.site_id).items.push(item);
  });

  const sites = Array.from(siteMap.entries()).sort((a, b) => {
    const byCount = b[1].items.length - a[1].items.length;
    if (byCount !== 0) return byCount;
    return a[1].siteName.localeCompare(b[1].siteName, "zh-CN");
  });

  const frag = document.createDocumentFragment();
  sites.forEach(([, site]) => {
    const siteSection = document.createElement("section");
    siteSection.className = "site-group";
    siteSection.innerHTML = `
      <header class="site-group-head">
        <h3>${site.siteName}</h3>
        <span>${fmtNumber(site.items.length)} 条</span>
      </header>
      <div class="site-group-list"></div>
    `;

    const siteListEl = siteSection.querySelector(".site-group-list");
    const sourceGroups = groupBySource(site.items);
    sourceGroups.forEach(([source, groupItems]) => {
      siteListEl.appendChild(buildSourceGroupNode(source, groupItems));
    });
    frag.appendChild(siteSection);
  });

  newsListEl.appendChild(frag);
}

function renderGroupedBySiteFlat(items) {
  const siteMap = new Map();
  items.forEach((item) => {
    if (!siteMap.has(item.site_id)) {
      siteMap.set(item.site_id, {
        siteName: item.site_name || item.site_id,
        items: [],
      });
    }
    siteMap.get(item.site_id).items.push(item);
  });

  const sites = Array.from(siteMap.entries()).sort((a, b) => {
    const byCount = b[1].items.length - a[1].items.length;
    if (byCount !== 0) return byCount;
    return a[1].siteName.localeCompare(b[1].siteName, "zh-CN");
  });

  const timeOf = (x) => new Date(x.published_at || x.first_seen_at || 0).getTime() || 0;
  const frag = document.createDocumentFragment();

  sites.forEach(([, site]) => {
    const siteSection = document.createElement("section");
    siteSection.className = "site-group";
    siteSection.innerHTML = `
      <header class="site-group-head">
        <h3>${site.siteName}</h3>
        <span>${fmtNumber(site.items.length)} 条</span>
      </header>
      <div class="site-group-list"></div>
    `;
    const listEl = siteSection.querySelector(".site-group-list");
    site.items.slice().sort((a, b) => timeOf(b) - timeOf(a)).forEach((item) => {
      listEl.appendChild(renderItemNode(item));
    });
    frag.appendChild(siteSection);
  });

  newsListEl.appendChild(frag);
}

function renderWatchSections() {
  const visibleSections = [];

  activeWatchSections().forEach((section) => {
    if (state.boardSection === "competitor") {
      if (state.competitorProductFilter && section.id !== state.competitorProductFilter) return;
    } else if (state.watchFilter.startsWith("section:") && state.watchFilter !== `section:${section.id}`) {
      return;
    }
    const sectionItems = (section.items || []).filter((item) => {
      if (!itemMatchesQuery(item)) return false;
      if (state.boardSection === "competitor") {
        if (state.competitorSourceFilter === "official") return item.monitor_class === "official";
        if (state.competitorSourceFilter === "other") return item.monitor_class !== "official";
        return true;
      }
      if (state.watchFilter === "class:official") return item.monitor_class === "official";
      if (state.watchFilter === "class:other") return item.monitor_class !== "official";
      return true;
    });
    const timedItems = state.boardSection === "competitor" ? competitorApplyTimeFilter(sectionItems) : sectionItems;
    if (!timedItems.length) return;
    visibleSections.push({ section, items: timedItems });
  });

  const total = visibleSections.reduce((sum, entry) => sum + entry.items.length, 0);

  resultCountEl.textContent = `${fmtNumber(total)} 条`;
  if (!total) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "当前筛选条件下没有结果。";
    newsListEl.appendChild(empty);
    return;
  }

  if (state.boardSection === "focus" && !state.watchFilter) {
    const mixedItems = visibleSections
      .flatMap(({ section, items }) => items.map((item) => ({ item, sectionName: section.name })))
      .sort((a, b) => compareItemsByTimestampDesc(a.item, b.item));

    const mixedFrag = document.createDocumentFragment();
    mixedItems.forEach(({ item, sectionName }) => {
      mixedFrag.appendChild(renderItemNode(item, { sectionName }));
    });
    newsListEl.appendChild(mixedFrag);
    return;
  }

  const frag = document.createDocumentFragment();
  visibleSections.forEach(({ section, items }) => {
    const sectionNode = document.createElement("section");
    sectionNode.className = "watch-section";
    sectionNode.innerHTML = `
      <header class="watch-section-head">
        <h3>${section.name}</h3>
        <span>${fmtNumber(items.length)} 条</span>
      </header>
      <div class="watch-section-list"></div>
    `;

    const listEl = sectionNode.querySelector(".watch-section-list");
    items.forEach((item) => listEl.appendChild(renderItemNode(item)));
    frag.appendChild(sectionNode);
  });

  newsListEl.appendChild(frag);
}

function renderList() {
  if (aiSortSwitchWrapEl) aiSortSwitchWrapEl.classList.toggle("hidden", !(state.boardSection === "ai" && !state.siteFilter));
  if (state.boardSection === "ai" && !state.siteFilter) {
    listTitleEl.textContent = state.aiSortMode === "interest"
      ? "最近 24 小时更新（兴趣优先排序）"
      : "最近 24 小时更新（默认排序）";
  } else if (state.boardSection === "focus" && !state.watchFilter) {
    listTitleEl.textContent = "特别关注（全部主题混排）";
  } else {
    listTitleEl.textContent = currentSectionTitle();
  }
  newsListEl.innerHTML = "";
  if (listPagerEl) {
    listPagerEl.innerHTML = "";
    listPagerEl.classList.add("hidden");
  }
  if (resultCountEl) resultCountEl.style.display = "";
  if (renderSectionStatusIfNeeded()) return;

  if (state.boardSection === "ai") {
    const filteredRaw = getFilteredAiItems();
    const filtered = state.siteFilter ? filteredRaw : dedupeAiItemsForDisplay(filteredRaw);
    resultCountEl.textContent = `${fmtNumber(filtered.length)} 条`;
    if (!state.siteFilter && resultCountEl) resultCountEl.style.display = "none";

    if (!filtered.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "当前筛选条件下没有结果。";
      newsListEl.appendChild(empty);
      return;
    }

    if (state.siteFilter) {
      renderGroupedBySource(filtered);
      return;
    }

    if (state.aiSortMode === "interest") {
      renderPriorityAiAll(filtered);
      return;
    }
    renderGroupedBySiteFlat(filtered);
    return;
  }

  if (state.boardSection === "wechat") {
    renderWechatPage();
    return;
  }

  renderWatchSections();
}

function waytoagiViews(waytoagi) {
  const updates7d = Array.isArray(waytoagi?.updates_7d) ? waytoagi.updates_7d : [];
  const latestDate = waytoagi?.latest_date || (updates7d.length ? updates7d[0].date : null);
  const latestDateObj = latestDate ? new Date(`${latestDate}T00:00:00`) : null;
  const near2DateSet = new Set();
  if (latestDateObj && !Number.isNaN(latestDateObj.getTime())) {
    const oneDayMs = 24 * 60 * 60 * 1000;
    const d0 = latestDateObj;
    const d1 = new Date(d0.getTime() - oneDayMs);
    near2DateSet.add(`${d0.getFullYear()}-${String(d0.getMonth() + 1).padStart(2, "0")}-${String(d0.getDate()).padStart(2, "0")}`);
    near2DateSet.add(`${d1.getFullYear()}-${String(d1.getMonth() + 1).padStart(2, "0")}-${String(d1.getDate()).padStart(2, "0")}`);
  }
  const updates2d = updates7d.filter((u) => near2DateSet.has(String(u.date || "")));
  return { updates7d, updates2d, latestDate };
}

function renderWaytoagi(waytoagi) {
  const { updates7d, updates2d, latestDate } = waytoagiViews(waytoagi);
  if (waytoagiTodayBtnEl) waytoagiTodayBtnEl.classList.toggle("active", state.waytoagiMode === "2d");
  if (waytoagi7dBtnEl) waytoagi7dBtnEl.classList.toggle("active", state.waytoagiMode === "7d");
  waytoagiUpdatedAtEl.textContent = `更新时间：${fmtTime(waytoagi.generated_at)}`;

  waytoagiMetaEl.innerHTML = `
    <a href="${waytoagi.root_url || "#"}" target="_blank" rel="noopener noreferrer">主页面</a>
    <span>·</span>
    <a href="${waytoagi.history_url || "#"}" target="_blank" rel="noopener noreferrer">历史更新页</a>
    <span>·</span>
    <span>近 2 日（截至 ${latestDate || "--"}）：${fmtNumber(updates2d.length)} 条</span>
    <span>·</span>
    <span>近 7 日：${fmtNumber(waytoagi.count_7d || updates7d.length)} 条</span>
  `;

  waytoagiListEl.innerHTML = "";
  if (waytoagiPagerEl) waytoagiPagerEl.innerHTML = "";
  if (waytoagi.has_error) {
    const div = document.createElement("div");
    div.className = "waytoagi-error";
    div.textContent = waytoagi.error || "WaytoAGI 数据加载失败";
    waytoagiListEl.appendChild(div);
    return;
  }

  const updates = state.waytoagiMode === "2d" ? updates2d : updates7d;
  if (!updates.length) {
    const div = document.createElement("div");
    div.className = "waytoagi-empty";
    div.textContent = state.waytoagiMode === "2d"
      ? "近2日没有更新，可切换到近7日查看。"
      : (waytoagi.warning || "近 7 日没有更新");
    waytoagiListEl.appendChild(div);
    return;
  }

  const totalPages = Math.max(1, Math.ceil(updates.length / WAYTOAGI_PAGE_SIZE));
  state.waytoagiPage = Math.min(Math.max(state.waytoagiPage, 1), totalPages);
  const start = (state.waytoagiPage - 1) * WAYTOAGI_PAGE_SIZE;
  const pageItems = updates.slice(start, start + WAYTOAGI_PAGE_SIZE);

  pageItems.forEach((u) => {
    const row = document.createElement("a");
    row.className = "waytoagi-item";
    row.href = u.url || "#";
    row.target = "_blank";
    row.rel = "noopener noreferrer";

    const dateEl = document.createElement("span");
    dateEl.className = "d";
    dateEl.textContent = fmtDate(u.date);

    const contentEl = document.createElement("span");
    contentEl.className = "c";

    const titleEl = document.createElement("span");
    titleEl.className = "t";
    titleEl.textContent = u.title || u.detail || "";
    contentEl.appendChild(titleEl);

    const detail = (u.detail || "").trim();
    if (detail) {
      const detailEl = document.createElement("span");
      detailEl.className = "s";
      detailEl.textContent = detail;
      contentEl.appendChild(detailEl);
    }

    row.appendChild(dateEl);
    row.appendChild(contentEl);
    waytoagiListEl.appendChild(row);
  });

  if (totalPages > 1) {
    const prevBtn = document.createElement("button");
    prevBtn.className = "waytoagi-page-btn";
    prevBtn.type = "button";
    prevBtn.textContent = "上一页";
    prevBtn.disabled = state.waytoagiPage <= 1;
    prevBtn.addEventListener("click", () => {
      if (state.waytoagiPage <= 1) return;
      state.waytoagiPage -= 1;
      renderWaytoagi(waytoagi);
    });

    const pageInfo = document.createElement("span");
    pageInfo.className = "waytoagi-page-info";
    pageInfo.textContent = `${state.waytoagiPage} / ${totalPages}`;

    const nextBtn = document.createElement("button");
    nextBtn.className = "waytoagi-page-btn";
    nextBtn.type = "button";
    nextBtn.textContent = "下一页";
    nextBtn.disabled = state.waytoagiPage >= totalPages;
    nextBtn.addEventListener("click", () => {
      if (state.waytoagiPage >= totalPages) return;
      state.waytoagiPage += 1;
      renderWaytoagi(waytoagi);
    });

    if (waytoagiPagerEl) {
      waytoagiPagerEl.appendChild(prevBtn);
      waytoagiPagerEl.appendChild(pageInfo);
      waytoagiPagerEl.appendChild(nextBtn);
    }
  }
}

function renderWaytoagiStatus() {
  if (!waytoagiListEl) return;
  if (waytoagiPagerEl) waytoagiPagerEl.innerHTML = "";
  if (state.loading.waytoagi && !state.waytoagiData) {
    waytoagiUpdatedAtEl.textContent = "加载中...";
    waytoagiMetaEl.innerHTML = "";
    waytoagiListEl.innerHTML = '<div class="waytoagi-empty">WaytoAGI 更新日志加载中，稍后会自动补齐。</div>';
    return;
  }
  if (state.loadErrors.waytoagi && !state.waytoagiData) {
    waytoagiUpdatedAtEl.textContent = "加载失败";
    waytoagiMetaEl.innerHTML = "";
    waytoagiListEl.innerHTML = `<div class="waytoagi-error">${state.loadErrors.waytoagi.message || "WaytoAGI 数据加载失败"}</div>`;
  }
}

async function loadNewsData() {
  const res = await fetch(`./data/latest-24h.json?t=${Date.now()}`);
  if (!res.ok) throw new Error(`加载 latest-24h.json 失败: ${res.status}`);
  return res.json();
}

async function loadWaytoagiData() {
  const res = await fetch(`./data/waytoagi-7d.json?t=${Date.now()}`);
  if (!res.ok) throw new Error(`加载 waytoagi-7d.json 失败: ${res.status}`);
  return res.json();
}

async function loadSpecialFocusData() {
  const res = await fetch(`./data/special-focus.json?t=${Date.now()}`);
  if (!res.ok) throw new Error(`加载 special-focus.json 失败: ${res.status}`);
  return res.json();
}

async function loadCompetitorData() {
  const res = await fetch(`./data/competitor-monitor.json?t=${Date.now()}`);
  if (!res.ok) throw new Error(`加载 competitor-monitor.json 失败: ${res.status}`);
  return res.json();
}

function applyNewsPayload(payload) {
  state.itemsAi = payload.items_ai || payload.items || [];
  state.statsAi = payload.site_stats || [];
  state.totalAi = payload.total_items || state.itemsAi.length;
  state.generatedAt = payload.generated_at;
}

function applyWaytoagiPayload(payload) {
  state.waytoagiData = payload;
  renderWaytoagi(state.waytoagiData);
}

function applySpecialFocusPayload(payload) {
  state.specialFocus = payload;
}

function applyCompetitorPayload(payload) {
  state.competitorMonitor = payload;
}

function recomputeOverallGeneratedAt() {
  state.overallGeneratedAt = latestIso([
    state.generatedAt,
    state.specialFocus?.generated_at,
    state.competitorMonitor?.generated_at,
  ]);
}

async function refreshAllData({ silent = false } = {}) {
  if (silent) {
    const [newsResult, waytoagiResult, specialResult, competitorResult] = await Promise.allSettled([
      loadNewsData(),
      loadWaytoagiData(),
      loadSpecialFocusData(),
      loadCompetitorData(),
    ]);

    if (newsResult.status === "fulfilled") {
      applyNewsPayload(newsResult.value);
      state.loadErrors.ai = null;
    } else {
      state.loadErrors.ai = newsResult.reason;
    }

    if (waytoagiResult.status === "fulfilled") {
      applyWaytoagiPayload(waytoagiResult.value);
      state.loadErrors.waytoagi = null;
    } else {
      state.loadErrors.waytoagi = waytoagiResult.reason;
    }

    if (specialResult.status === "fulfilled") {
      applySpecialFocusPayload(specialResult.value);
      state.loadErrors.focus = null;
    } else {
      state.loadErrors.focus = specialResult.reason;
    }

    if (competitorResult.status === "fulfilled") {
      applyCompetitorPayload(competitorResult.value);
      state.loadErrors.competitor = null;
    } else {
      state.loadErrors.competitor = competitorResult.reason;
    }

    recomputeOverallGeneratedAt();
    renderAll();
    return;
  }

  state.loading.ai = true;
  state.loading.focus = true;
  state.loading.competitor = true;
  state.loading.waytoagi = true;
  state.loadErrors.ai = null;
  state.loadErrors.focus = null;
  state.loadErrors.competitor = null;
  state.loadErrors.waytoagi = null;
  renderAll();

  const rerender = () => {
    recomputeOverallGeneratedAt();
    renderAll();
  };

  const newsPromise = loadNewsData()
    .then((payload) => {
      applyNewsPayload(payload);
      state.loadErrors.ai = null;
    })
    .catch((err) => {
      state.loadErrors.ai = err;
    })
    .finally(() => {
      state.loading.ai = false;
      rerender();
    });

  const waytoagiPromise = loadWaytoagiData()
    .then((payload) => {
      applyWaytoagiPayload(payload);
      state.loadErrors.waytoagi = null;
    })
    .catch((err) => {
      state.loadErrors.waytoagi = err;
    })
    .finally(() => {
      state.loading.waytoagi = false;
      rerender();
    });

  const specialPromise = loadSpecialFocusData()
    .then((payload) => {
      applySpecialFocusPayload(payload);
      state.loadErrors.focus = null;
    })
    .catch((err) => {
      state.loadErrors.focus = err;
    })
    .finally(() => {
      state.loading.focus = false;
      rerender();
    });

  const competitorPromise = loadCompetitorData()
    .then((payload) => {
      applyCompetitorPayload(payload);
      state.loadErrors.competitor = null;
    })
    .catch((err) => {
      state.loadErrors.competitor = err;
    })
    .finally(() => {
      state.loading.competitor = false;
      rerender();
    });

  await Promise.allSettled([newsPromise, waytoagiPromise, specialPromise, competitorPromise]);
}

async function pollForFreshData() {
  let newsDataUpdated = false;
  try {
    const payload = await loadNewsData();
    const nextGeneratedAt = payload?.generated_at || null;
    if (nextGeneratedAt && nextGeneratedAt !== state.generatedAt) {
      newsDataUpdated = true;
      await refreshAllData({ silent: true });
    }
  } catch (_) {}

  if (!state.wechatFeed.initialized) return;
  if (!newsDataUpdated && !wechatFeedRefreshStale()) return;

  try {
    await refreshWechatFirstPage({ silent: true, force: newsDataUpdated });
  } catch (_) {}
}

function startDataPolling() {
  window.setInterval(() => {
    pollForFreshData();
  }, DATA_REFRESH_POLL_MS);
}

function renderAll() {
  renderHeroBySection();
  renderBoardTabs();
  renderModeSwitch();
  setStatsForCurrentSection();
  renderSiteFilters();
  renderList();
  if (!state.waytoagiData || state.loading.waytoagi || state.loadErrors.waytoagi) {
    renderWaytoagiStatus();
  }
}

async function init() {
  await refreshAllData();
  startDataPolling();
}

searchInputEl.addEventListener("input", (e) => {
  state.query = e.target.value;
  renderList();
});

siteSelectEl.addEventListener("change", (e) => {
  if (state.boardSection === "ai") {
    state.siteFilter = e.target.value;
  } else if (state.boardSection === "wechat") {
    return;
  } else if (state.boardSection === "competitor") {
    state.competitorSourceFilter = e.target.value || "official";
  } else {
    state.watchFilter = e.target.value;
  }
  renderSiteFilters();
  renderList();
});

if (competitorTimeSelectEl) {
  competitorTimeSelectEl.addEventListener("change", (e) => {
    state.competitorTimeFilter = e.target.value || "latest";
    renderAll();
  });
}

if (tabAiBtnEl) {
  tabAiBtnEl.addEventListener("click", () => {
    state.boardSection = "ai";
    state.siteFilter = "";
    state.watchFilter = "";
    state.competitorSourceFilter = "official";
    state.competitorProductFilter = "";
    state.competitorTimeFilter = "latest";
    renderAll();
  });
}

if (tabFocusBtnEl) {
  tabFocusBtnEl.addEventListener("click", () => {
    state.boardSection = "focus";
    state.siteFilter = "";
    state.watchFilter = "";
    state.competitorSourceFilter = "official";
    state.competitorProductFilter = "";
    state.competitorTimeFilter = "latest";
    renderAll();
  });
}

if (tabWechatBtnEl) {
  tabWechatBtnEl.addEventListener("click", () => {
    state.boardSection = "wechat";
    state.siteFilter = "";
    state.watchFilter = "";
    state.competitorSourceFilter = "official";
    state.competitorProductFilter = "";
    state.competitorTimeFilter = "latest";
    renderAll();
    if (!state.wechatFeed.initialized || !(state.wechatFeed.pages || []).length) {
      loadWechatInitialPage();
      return;
    }
    if (wechatFeedRefreshStale()) refreshWechatFirstPage({ silent: true, force: true });
  });
}

if (tabCompetitorBtnEl) {
  tabCompetitorBtnEl.addEventListener("click", () => {
    state.boardSection = "competitor";
    state.siteFilter = "";
    state.watchFilter = "";
    state.competitorSourceFilter = "official";
    state.competitorProductFilter = "";
    state.competitorTimeFilter = "latest";
    renderAll();
  });
}

if (waytoagiTodayBtnEl) {
  waytoagiTodayBtnEl.addEventListener("click", () => {
    state.waytoagiMode = "2d";
    state.waytoagiPage = 1;
    if (state.waytoagiData) renderWaytoagi(state.waytoagiData);
  });
}

if (waytoagi7dBtnEl) {
  waytoagi7dBtnEl.addEventListener("click", () => {
    state.waytoagiMode = "7d";
    state.waytoagiPage = 1;
    if (state.waytoagiData) renderWaytoagi(state.waytoagiData);
  });
}

if (themeToggleBtnEl) {
  themeToggleBtnEl.addEventListener("click", () => {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    applyTheme(isDark ? "light" : "dark");
  });
}

if (aiSortDefaultBtnEl) {
  aiSortDefaultBtnEl.addEventListener("click", () => {
    state.aiSortMode = "default";
    renderModeSwitch();
    renderList();
  });
}

if (aiSortInterestBtnEl) {
  aiSortInterestBtnEl.addEventListener("click", () => {
    state.aiSortMode = "interest";
    renderModeSwitch();
    renderList();
  });
}

if (logoutBtnEl) {
  logoutBtnEl.addEventListener("click", () => {
    logoutUser();
  });
}

async function bootstrap() {
  initTheme();
  const authed = await restoreSession();
  if (!authed) {
    window.location.replace("./login.html");
    return;
  }
  await init();
}

bootstrap();
