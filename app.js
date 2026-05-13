// ─────────────────────────────────────────────
// Injected at build time by GitHub Actions
// DO NOT commit real values here
// ─────────────────────────────────────────────
const CONFIG = {
  // SHA-256 hash of "username:password"  (injected by CI)
  AUTH_HASH: "%%AUTH_HASH%%",
  // ModelMatch API bearer token (injected by CI)
  MM_TOKEN: "%%MM_TOKEN%%",
  API_BASE: "https://api.modelmatch.com",
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
async function sha256(str) {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(str)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function $(id) { return document.getElementById(id); }

function setStatus(msg, type = "") {
  const el = $("status-bar");
  el.textContent = msg;
  el.className = "status-bar " + type;
}

function fmt(val, prefix = "") {
  if (val == null || val === "" || val === undefined) return "—";
  return prefix + val;
}

function fmtCurrency(val) {
  if (!val) return "—";
  return "$" + Number(val).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function fmtRate(val) {
  if (!val) return "—";
  return Number(val).toFixed(3) + "%";
}

function fmtDate(val) {
  if (!val) return "—";
  const d = new Date(val);
  return isNaN(d) ? val : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function loanTypeBadge(type) {
  if (!type) return `<span class="badge badge-other">—</span>`;
  const t = type.toLowerCase();
  if (t.includes("purchase")) return `<span class="badge badge-purchase">${type}</span>`;
  if (t.includes("refi") || t.includes("refinance")) return `<span class="badge badge-refi">${type}</span>`;
  return `<span class="badge badge-other">${type}</span>`;
}

// ─────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────
const SESSION_KEY = "lo_intel_auth";

async function checkLogin(username, password) {
  const hash = await sha256(`${username}:${password}`);
  return hash === CONFIG.AUTH_HASH;
}

function isLoggedIn() {
  return sessionStorage.getItem(SESSION_KEY) === "1";
}

function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.add("hidden"));
  $(id).classList.remove("hidden");
}

// ─────────────────────────────────────────────
// API
// ─────────────────────────────────────────────
async function mmFetch(path, params = {}) {
  const url = new URL(CONFIG.API_BASE + path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${CONFIG.MM_TOKEN}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${txt || res.statusText}`);
  }
  return res.json();
}

async function fetchOriginator(nmls) {
  // Search originators by NMLS
  return mmFetch("/originators", { nmls_id: nmls, limit: 1 });
}

async function fetchLoans(nmls) {
  // Pull loan history for this originator
  return mmFetch("/loans", { nmls_id: nmls, limit: 200 });
}

async function fetchSales(nmls) {
  return mmFetch("/sales", { nmls_id: nmls, limit: 200 });
}

// ─────────────────────────────────────────────
// RENDER
// ─────────────────────────────────────────────
let currentData = null; // store for export

function renderProfile(originator) {
  if (!originator) return;

  const o = originator;
  const contact = o.contact || o;
  const stats = [
    { label: "Total Volume", value: fmtCurrency(o.total_volume || o.volume) },
    { label: "Total Units", value: fmt(o.total_units || o.units) },
    { label: "Avg Loan Amt", value: fmtCurrency(o.avg_loan_amount) },
    { label: "Active Since", value: fmtDate(o.license_date || o.start_date) },
    { label: "NMLS ID", value: fmt(o.nmls_id || o.nmls) },
    { label: "State", value: fmt(o.state) },
  ];

  const contactFields = [
    { label: "Phone", value: contact.phone || o.phone },
    { label: "Email", value: contact.email || o.email },
    { label: "Company", value: o.company || o.employer },
    { label: "Branch", value: o.branch },
    { label: "Address", value: o.address },
    { label: "LinkedIn", value: contact.linkedin || o.linkedin },
  ].filter((f) => f.value);

  $("profile-section").innerHTML = `
    <div class="profile-card">
      <div class="profile-name">${o.full_name || o.name || "Loan Officer"}</div>
      <div class="profile-meta">
        ${o.title ? `<span class="meta-chip">${o.title}</span>` : ""}
        ${o.company || o.employer ? `<span class="meta-chip">${o.company || o.employer}</span>` : ""}
        ${o.state ? `<span class="meta-chip">${o.state}</span>` : ""}
      </div>

      <div class="section-label">Production Stats</div>
      <div class="stats-grid">
        ${stats.map((s) => `
          <div class="stat-box">
            <div class="stat-label">${s.label}</div>
            <div class="stat-value ${s.label === "NMLS ID" || s.label === "State" || s.label === "Active Since" ? "neutral" : ""}">${s.value}</div>
          </div>
        `).join("")}
      </div>

      ${contactFields.length > 0 ? `
        <div class="section-label">Contact Information</div>
        <div class="contact-grid">
          ${contactFields.map((f) => `
            <div class="contact-item">
              <div class="contact-item-label">${f.label}</div>
              <div class="contact-item-value">${f.value}</div>
            </div>
          `).join("")}
        </div>
      ` : ""}
    </div>
  `;
}

function renderLoans(loans) {
  if (!loans || loans.length === 0) {
    $("loans-section").innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">◎</div>
        <div class="empty-text">No loan records found for this NMLS ID</div>
      </div>`;
    return;
  }

  const rows = loans.map((l) => `
    <tr>
      <td>${fmtDate(l.close_date || l.transaction_date || l.date)}</td>
      <td>${loanTypeBadge(l.loan_type || l.transaction_type || l.type)}</td>
      <td class="rate">${fmtRate(l.interest_rate || l.rate)}</td>
      <td class="amount">${fmtCurrency(l.loan_amount || l.amount)}</td>
      <td>${fmt(l.borrower_name || l.borrower || l.primary_borrower)}</td>
      <td>${fmt(l.borrower_email || l.email)}</td>
      <td>${fmt(l.borrower_phone || l.phone)}</td>
      <td>${fmt(l.property_address || l.address)}</td>
      <td>${fmt(l.lender || l.lender_name)}</td>
    </tr>
  `).join("");

  $("loans-section").innerHTML = `
    <div class="section-label">Loan Transaction History (${loans.length} records)</div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Close Date</th>
            <th>Type</th>
            <th>Rate</th>
            <th>Loan Amount</th>
            <th>Borrower</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Property Address</th>
            <th>Lender</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

// ─────────────────────────────────────────────
// EXCEL EXPORT
// ─────────────────────────────────────────────
function exportToExcel() {
  if (!currentData) return;
  const { originator, loans } = currentData;
  const wb = XLSX.utils.book_new();

  // Sheet 1 — Originator Profile
  const profileRows = [
    ["LO Intelligence Export"],
    [],
    ["NMLS ID", originator?.nmls_id || originator?.nmls || ""],
    ["Name", originator?.full_name || originator?.name || ""],
    ["Title", originator?.title || ""],
    ["Company", originator?.company || originator?.employer || ""],
    ["Branch", originator?.branch || ""],
    ["State", originator?.state || ""],
    ["Phone", originator?.phone || originator?.contact?.phone || ""],
    ["Email", originator?.email || originator?.contact?.email || ""],
    ["LinkedIn", originator?.linkedin || originator?.contact?.linkedin || ""],
    ["Address", originator?.address || ""],
    [],
    ["Total Volume", originator?.total_volume || originator?.volume || ""],
    ["Total Units", originator?.total_units || originator?.units || ""],
    ["Avg Loan Amount", originator?.avg_loan_amount || ""],
    ["Active Since", originator?.license_date || originator?.start_date || ""],
  ];
  const wsProfile = XLSX.utils.aoa_to_sheet(profileRows);
  XLSX.utils.book_append_sheet(wb, wsProfile, "Originator Profile");

  // Sheet 2 — Loan History
  if (loans && loans.length > 0) {
    const headers = [
      "Close Date", "Loan Type", "Interest Rate", "Loan Amount",
      "Borrower Name", "Borrower Email", "Borrower Phone",
      "Property Address", "Lender",
    ];
    const loanRows = loans.map((l) => [
      l.close_date || l.transaction_date || l.date || "",
      l.loan_type || l.transaction_type || l.type || "",
      l.interest_rate || l.rate || "",
      l.loan_amount || l.amount || "",
      l.borrower_name || l.borrower || l.primary_borrower || "",
      l.borrower_email || l.email || "",
      l.borrower_phone || l.phone || "",
      l.property_address || l.address || "",
      l.lender || l.lender_name || "",
    ]);
    const wsLoans = XLSX.utils.aoa_to_sheet([headers, ...loanRows]);
    XLSX.utils.book_append_sheet(wb, wsLoans, "Loan History");
  }

  const name = (originator?.full_name || originator?.name || "LO")
    .replace(/\s+/g, "_");
  XLSX.writeFile(wb, `LO_${name}_${Date.now()}.xlsx`);
}

// ─────────────────────────────────────────────
// MAIN SEARCH FLOW
// ─────────────────────────────────────────────
async function runSearch() {
  const nmls = $("nmls-input").value.trim().replace(/\D/g, "");
  if (!nmls) {
    setStatus("Please enter a valid NMLS ID", "error");
    return;
  }

  // UI — loading state
  $("search-btn").disabled = true;
  $("spinner").style.display = "inline-block";
  $("search-label").textContent = "Fetching…";
  setStatus(`Pulling data for NMLS ${nmls}…`);
  $("results-area").style.display = "none";
  $("profile-section").innerHTML = "";
  $("loans-section").innerHTML = "";

  try {
    const [origData, loanData] = await Promise.all([
      fetchOriginator(nmls),
      fetchLoans(nmls),
    ]);

    // Normalize — the API may return {data: [...]} or [...] directly
    const originator = Array.isArray(origData)
      ? origData[0]
      : origData?.data?.[0] || origData?.results?.[0] || origData;

    const loans = Array.isArray(loanData)
      ? loanData
      : loanData?.data || loanData?.results || loanData?.loans || [];

    currentData = { originator, loans };

    const loName = originator?.full_name || originator?.name || `NMLS ${nmls}`;
    $("results-title").textContent = loName;

    renderProfile(originator);
    renderLoans(loans);

    $("results-area").style.display = "block";
    setStatus(
      `✓ Found ${loans.length} loan record${loans.length !== 1 ? "s" : ""} for ${loName}`,
      "success"
    );
  } catch (err) {
    console.error(err);
    setStatus(`Error: ${err.message}`, "error");
    currentData = null;
  } finally {
    $("search-btn").disabled = false;
    $("spinner").style.display = "none";
    $("search-label").textContent = "Pull Data";
  }
}

// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  // Check existing session
  if (isLoggedIn()) {
    showScreen("app-screen");
  }

  // Login
  async function attemptLogin() {
    const u = $("username").value.trim();
    const p = $("password").value;
    if (!u || !p) return;

    const ok = await checkLogin(u, p);
    if (ok) {
      sessionStorage.setItem(SESSION_KEY, "1");
      showScreen("app-screen");
    } else {
      $("login-error").classList.add("visible");
      $("password").value = "";
      $("password").focus();
      setTimeout(() => $("login-error").classList.remove("visible"), 3000);
    }
  }

  $("login-btn").addEventListener("click", attemptLogin);
  $("password").addEventListener("keydown", (e) => {
    if (e.key === "Enter") attemptLogin();
  });
  $("username").addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("password").focus();
  });

  // Logout
  $("logout-btn").addEventListener("click", () => {
    sessionStorage.removeItem(SESSION_KEY);
    showScreen("login-screen");
    $("nmls-input").value = "";
    $("results-area").style.display = "none";
    currentData = null;
  });

  // Search
  $("search-btn").addEventListener("click", runSearch);
  $("nmls-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") runSearch();
  });

  // Export
  $("export-btn").addEventListener("click", exportToExcel);
});
