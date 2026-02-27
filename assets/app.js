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
  waytoagiMode: "2d",
  waytoagiPage: 1,
  waytoagiData: null,
  generatedAt: null,
};

const statsEl = document.getElementById("stats");
const siteSelectEl = document.getElementById("siteSelect");
const competitorTimeSelectEl = document.getElementById("competitorTimeSelect");
const sitePillsEl = document.getElementById("sitePills");
const newsListEl = document.getElementById("newsList");
const updatedAtEl = document.getElementById("updatedAt");
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

function competitorTimeFilterLabel() {
  if (state.competitorTimeFilter === "14d") return "近2周";
  if (state.competitorTimeFilter === "7d") return "近7天";
  return "最近更新";
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
        const raw = x?.published_at || x?.first_seen_at;
        const ts = raw ? new Date(raw).getTime() : Number.NaN;
        return { item: x, ts };
      })
      .filter((x) => Number.isFinite(x.ts));
    if (!dated.length) return arr.slice(0, 1);
    dated.sort((a, b) => b.ts - a.ts);
    return [dated[0].item];
  }
  return arr.filter((x) => competitorItemPassesTime(x));
}

function currentSectionTitle() {
  if (state.boardSection === "focus") return "特别关注（近3天）";
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
      heroLogoEl.src = "./assets/hero-focus.svg";
      heroLogoEl.alt = "特别关注图标";
    }
    const days = Number(state.specialFocus?.window_days || 3);
    heroTagEl.textContent = "SPECIAL FOCUS";
    heroTitleEl.textContent = `特别关注（近${days}天）`;
    heroSubEl.textContent = "不生产噱头，只做忠实的搬运工——preset themes，integrate news，remove noise";
    return;
  }

  if (heroLogoEl) {
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
  return activeWatchSections().flatMap((s) => s.items || []);
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
  tabCompetitorBtnEl.classList.toggle("active", state.boardSection === "competitor");
}

function renderModeSwitch() {
  const isAi = state.boardSection === "ai";
  const isFocus = state.boardSection === "focus";
  const isCompetitor = state.boardSection === "competitor";
  waytoagiWrapEl.classList.toggle("hidden", !isFocus);
  if (competitorTimeSelectEl) {
    competitorTimeSelectEl.classList.toggle("hidden", !isCompetitor);
    competitorTimeSelectEl.value = state.competitorTimeFilter || "latest";
  }

  if (aiSortSwitchWrapEl) aiSortSwitchWrapEl.classList.toggle("hidden", !(isAi && !state.siteFilter));
  if (aiSortDefaultBtnEl) aiSortDefaultBtnEl.classList.toggle("active", state.aiSortMode === "default");
  if (aiSortInterestBtnEl) aiSortInterestBtnEl.classList.toggle("active", state.aiSortMode === "interest");
}

function itemMatchesQuery(item) {
  const q = state.query.trim().toLowerCase();
  if (!q) return true;
  const hay = `${item.title || ""} ${item.title_zh || ""} ${item.title_en || ""} ${item.site_name || ""} ${item.source || ""}`.toLowerCase();
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

function renderItemNode(item) {
  const node = itemTpl.content.firstElementChild.cloneNode(true);
  node.querySelector(".site").textContent = item.site_name;
  const sourcePrefix = state.boardSection === "competitor"
    ? (item.monitor_class === "official" ? "[官方公告] " : "[其他来源] ")
    : "";
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
  const sections = activeWatchSections();
  const frag = document.createDocumentFragment();
  let total = 0;

  sections.forEach((section) => {
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
    total += timedItems.length;

    const sectionNode = document.createElement("section");
    sectionNode.className = "watch-section";
    sectionNode.innerHTML = `
      <header class="watch-section-head">
        <h3>${section.name}</h3>
        <span>${fmtNumber(timedItems.length)} 条</span>
      </header>
      <div class="watch-section-list"></div>
    `;

    const listEl = sectionNode.querySelector(".watch-section-list");
    timedItems.forEach((item) => listEl.appendChild(renderItemNode(item)));
    frag.appendChild(sectionNode);
  });

  resultCountEl.textContent = `${fmtNumber(total)} 条`;
  if (!total) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "当前筛选条件下没有结果。";
    newsListEl.appendChild(empty);
    return;
  }

  newsListEl.appendChild(frag);
}

function renderList() {
  if (aiSortSwitchWrapEl) aiSortSwitchWrapEl.classList.toggle("hidden", !(state.boardSection === "ai" && !state.siteFilter));
  if (state.boardSection === "ai" && !state.siteFilter) {
    listTitleEl.textContent = state.aiSortMode === "interest"
      ? "最近 24 小时更新（兴趣优先排序）"
      : "最近 24 小时更新（默认排序）";
  } else {
    listTitleEl.textContent = currentSectionTitle();
  }
  newsListEl.innerHTML = "";
  if (resultCountEl) resultCountEl.style.display = "";

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

function renderAll() {
  renderHeroBySection();
  renderBoardTabs();
  renderModeSwitch();
  setStatsForCurrentSection();
  renderSiteFilters();
  renderList();
  if (state.boardSection === "focus" && state.specialFocus?.generated_at) {
    updatedAtEl.textContent = `更新时间：${fmtTime(state.specialFocus.generated_at)}`;
    return;
  }
  if (state.boardSection === "competitor" && state.competitorMonitor?.generated_at) {
    updatedAtEl.textContent = `更新时间：${fmtTime(state.competitorMonitor.generated_at)}`;
    return;
  }
  if (state.generatedAt) {
    updatedAtEl.textContent = `更新时间：${fmtTime(state.generatedAt)}`;
  }
}

async function init() {
  const [newsResult, waytoagiResult, specialResult, competitorResult] = await Promise.allSettled([
    loadNewsData(),
    loadWaytoagiData(),
    loadSpecialFocusData(),
    loadCompetitorData(),
  ]);

  if (newsResult.status === "fulfilled") {
    const payload = newsResult.value;
    state.itemsAi = payload.items_ai || payload.items || [];
    state.statsAi = payload.site_stats || [];
    state.totalAi = payload.total_items || state.itemsAi.length;
    state.generatedAt = payload.generated_at;
  } else {
    updatedAtEl.textContent = "新闻数据加载失败";
    newsListEl.innerHTML = `<div class="empty">${newsResult.reason.message}</div>`;
    return;
  }

  if (waytoagiResult.status === "fulfilled") {
    state.waytoagiData = waytoagiResult.value;
    renderWaytoagi(state.waytoagiData);
  } else {
    waytoagiUpdatedAtEl.textContent = "加载失败";
    waytoagiListEl.innerHTML = `<div class="waytoagi-error">${waytoagiResult.reason.message}</div>`;
  }

  if (specialResult.status === "fulfilled") {
    state.specialFocus = specialResult.value;
  }

  if (competitorResult.status === "fulfilled") {
    state.competitorMonitor = competitorResult.value;
  }

  renderAll();
}

searchInputEl.addEventListener("input", (e) => {
  state.query = e.target.value;
  renderList();
});

siteSelectEl.addEventListener("change", (e) => {
  if (state.boardSection === "ai") {
    state.siteFilter = e.target.value;
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

initTheme();
init();
