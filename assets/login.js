const AUTH_STORAGE_KEY = "agent_news_accounts_v1";
const AUTH_SESSION_KEY = "agent_news_session_v1";
const DEFAULT_ACCOUNT = {
  username: "AF_PM",
  password: "AgentNewsTracker",
};

const authFormEl = document.getElementById("authForm");
const authUsernameEl = document.getElementById("authUsername");
const authPasswordEl = document.getElementById("authPassword");
const authSubmitBtnEl = document.getElementById("authSubmitBtn");
const authMessageEl = document.getElementById("authMessage");

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

function setMessage(message, isError = false) {
  if (!authMessageEl) return;
  authMessageEl.textContent = message || "";
  authMessageEl.classList.toggle("is-error", Boolean(isError));
}

async function loginUser(username, password) {
  const accounts = await ensureAuthStore();
  const account = accounts.find((item) => item?.username === username);
  if (!account) throw new Error("账号不存在");
  const passwordHash = await hashPassword(password);
  if (account.passwordHash !== passwordHash) throw new Error("密码错误");
  localStorage.setItem(AUTH_SESSION_KEY, username);
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
  return true;
}

async function bootstrap() {
  const authed = await restoreSession();
  if (authed) {
    window.location.replace("./index.html");
  }
}

authFormEl?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const username = String(authUsernameEl?.value || "").trim();
  const password = String(authPasswordEl?.value || "");

  if (!username || !password) {
    setMessage("账号和密码不能为空。", true);
    return;
  }

  if (authSubmitBtnEl) authSubmitBtnEl.disabled = true;
  setMessage("正在登录...");

  try {
    await loginUser(username, password);
    window.location.assign("./index.html");
  } catch (error) {
    setMessage(error instanceof Error ? error.message : "操作失败", true);
  } finally {
    if (authSubmitBtnEl) authSubmitBtnEl.disabled = false;
  }
});

bootstrap();
