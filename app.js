// app.js — talks to /api/* Vercel routes, never directly to ModelMatch

const SESSION_KEY = "lo_intel_token";
let currentData = null;

// ── Helpers ──────────────────────────────────
function $(id) { return document.getElementById(id); }

function setStatus(msg, type = "") {
  const el = $("status-bar");
  el.textContent = msg;
  el.className = "status-bar " + type;
}

function fmt(val) { return val ?? "—"; }

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

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.add("hidden"));
  $(id).classList.remove("hidden");
}

function getToken() { return sessionStorage.getItem(SESSION_KEY); }

// ── API calls ────────────────────────────────
async function apiGet(path) {
  const token = getToken();
  const res = await fetch(path, {
    headers: {
      "x-app-auth": token,
      "Content-Type": "application/json",
    }
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

// ── Auth ─────────────────────────────────────
async function login(username, password) {
  const res = await fetch("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (data.ok) {
    sessionStorage.setItem(SESSION_KEY, data.token);
    return true;
  }
  return false;
}

// ── Render ────────────────────────────────────
function renderProfile(originator) {
  if (!originator || typeof originator !== "object") return;

  // Flatten nested contact object if present
  const o = { ...originator, ...(originator.contact || {}) };

  const stats = [
    { label: "NMLS ID",       value: fmt(o.nmls_id || o.nmls),                   neutral: true },
    { label: "Total Volume",  value: fmtCurrency(o.total_volume || o.volume) },
    { label: "Total Units",   value: fmt(o.total_units || o.units) },
    { label: "Avg Loan Amt",  value: fmtCurrency(o.avg_loan_amount) },
    { label: "State",         value: fmt(o.state),                                neutral: true },
    { label: "Active Since",  value: fmtDate(o.license_date || o.start_date),    neutral: true },
  ];

  const contactFields = [
    { label: "Phone",    value: o.phone },
    { label: "Email",    value: o.email },
    { label: "Company",  value: o.company || o.employer },
    { label: "Branch",   value: o.branch },
    { label: "Address",  value: o.address },
    { label: "LinkedIn", value: o.linkedin },
    { label: "Website",  value: o.website },
  ].filter(f => f.value);

  $("profile-section").innerHTML = `
    <div class="profile-card">
      <div class="profile-name">${o.full_name || o.name || "Loan Officer"}</div>
      <div class="profile-meta">
        ${o.title   ? `<span class="meta-chip">${o.title}</span>` : ""}
        ${o.company || o.employer ? `<span class="meta-chip">${o.company || o.employer}</span>` : ""}
        ${o.state   ? `<span class="meta-chip">${o.state}</span>` : ""}
      </div>
      <div class="section-label">Production Stats</div>
      <div class="stats-grid">
        ${stats.map(s => `
          <div class="stat-box">
            <div class="stat-label">${s.label}</div>
            <div class="stat-value ${s.neutral ? "neutral" : ""}">${s.value}</div>
          </div>`).join("")}
      </div>
      ${contactFields.length ? `
        <div class="section-label">Contact Information</div>
        <div class="contact-grid">
          ${contactFields.map(f => `
            <div class="contact-item">
              <div class="contact-item-label">${f.label}</div>
              <div class="contact-item-value">${f.value}</div>
            </div>`).join("")}
        </div>` : ""}
    </div>`;
}

function renderLoans(loans) {
  if (!loans || loans.length === 0) {
    $("loans-section").innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">◎</div>
        <div class="empty-text">No loan records found</div>
      </div>`;
    return;
  }

  const rows = loans.map(l => `
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
    </tr>`).join("");

  $("loans-section").innerHTML = `
    <div class="section-label">Loan Transaction History (${loans.length} records)</div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Close Date</th><th>Type</th><th>Rate</th><th>Loan Amount</th>
            <th>Borrower</th><th>Email</th><th>Phone</th><th>Property</th><th>Lender</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function renderDiagnostic(data, nmls) {
  $("profile-section").innerHTML = `
    <div class="diag-box">
      <div class="diag-title">⚠ API endpoint discovery needed — paste this output to your developer</div>
      NMLS queried: ${nmls}
      ${JSON.stringify(data, null, 2)}
    </div>`;
  $("loans-section").innerHTML = "";
}

// ── Excel Export ──────────────────────────────
function exportToExcel() {
  if (!currentData) return;
  const { originator, loans } = currentData;
  const wb = XLSX.utils.book_new();

  const o = originator || {};
  const flat = { ...o, ...(o.contact || {}) };

  const profileRows = [
    ["LO Intelligence Export"],
    [],
    ["NMLS ID",       flat.nmls_id || flat.nmls || ""],
    ["Name",          flat.full_name || flat.name || ""],
    ["Title",         flat.title || ""],
    ["Company",       flat.company || flat.employer || ""],
    ["Branch",        flat.branch || ""],
    ["State",         flat.state || ""],
    ["Phone",         flat.phone || ""],
    ["Email",         flat.email || ""],
    ["LinkedIn",      flat.linkedin || ""],
    ["Address",       flat.address || ""],
    [],
    ["Total Volume",  flat.total_volume || flat.volume || ""],
    ["Total Units",   flat.total_units || flat.units || ""],
    ["Avg Loan Amt",  flat.avg_loan_amount || ""],
    ["Active Since",  flat.license_date || flat.start_date || ""],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(profileRows), "Originator Profile");

  if (loans && loans.length > 0) {
    const headers = ["Close Date","Loan Type","Interest Rate","Loan Amount","Borrower Name","Borrower Email","Borrower Phone","Property Address","Lender"];
    const loanRows = loans.map(l => [
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
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers, ...loanRows]), "Loan History");
  }

  const name = (flat.full_name || flat.name || "LO").replace(/\s+/g, "_");
  XLSX.writeFile(wb, `LO_${name}_${Date.now()}.xlsx`);
}

// ── Main Search ───────────────────────────────
async function runSearch() {
  const nmls = $("nmls-input").value.trim().replace(/\D/g, "");
  if (!nmls) { setStatus("Please enter a valid NMLS ID", "error"); return; }

  $("search-btn").disabled = true;
  $("spinner").style.display = "inline-block";
  $("search-label").textContent = "Fetching…";
  setStatus(`Pulling data for NMLS ${nmls}…`);
  $("results-area").style.display = "none";

  try {
    const [origRes, loanRes] = await Promise.all([
      apiGet(`/api/lookup?nmls=${nmls}&type=originator`),
      apiGet(`/api/lookup?nmls=${nmls}&type=loans`),
    ]);

    // If API returned diagnostic data, show it
    if (origRes.diagnostic) {
      $("results-title").textContent = `NMLS ${nmls} — Diagnostic`;
      renderDiagnostic({ originator: origRes, loans: loanRes }, nmls);
      $("results-area").style.display = "block";
      setStatus("API endpoint discovery mode — see diagnostic output", "error");
      return;
    }

    // Normalize data shapes
    const originator = Array.isArray(origRes.data) ? origRes.data[0] : origRes.data;
    const loans = Array.isArray(loanRes.data) ? loanRes.data : loanRes.data?.loans || loanRes.data?.results || [];

    currentData = { originator, loans };

    const name = originator?.full_name || originator?.name || `NMLS ${nmls}`;
    $("results-title").textContent = name;
    renderProfile(originator);
    renderLoans(loans);
    $("results-area").style.display = "block";
    setStatus(`✓ ${loans.length} loan record${loans.length !== 1 ? "s" : ""} found for ${name}`, "success");

  } catch (err) {
    setStatus(`Error: ${err.message}`, "error");
    currentData = null;
  } finally {
    $("search-btn").disabled = false;
    $("spinner").style.display = "none";
    $("search-label").textContent = "Pull Data";
  }
}

// ── Init ──────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  if (getToken()) showScreen("app-screen");

  async function attemptLogin() {
    const u = $("username").value.trim();
    const p = $("password").value;
    if (!u || !p) return;

    $("login-btn").disabled = true;
    $("login-spinner").style.display = "inline-block";

    const ok = await login(u, p);

    $("login-btn").disabled = false;
    $("login-spinner").style.display = "none";

    if (ok) {
      showScreen("app-screen");
    } else {
      $("login-error").classList.add("visible");
      $("password").value = "";
      $("password").focus();
      setTimeout(() => $("login-error").classList.remove("visible"), 3000);
    }
  }

  $("login-btn").addEventListener("click", attemptLogin);
  $("password").addEventListener("keydown", e => { if (e.key === "Enter") attemptLogin(); });
  $("username").addEventListener("keydown", e => { if (e.key === "Enter") $("password").focus(); });

  $("logout-btn").addEventListener("click", () => {
    sessionStorage.removeItem(SESSION_KEY);
    showScreen("login-screen");
    $("nmls-input").value = "";
    $("results-area").style.display = "none";
    currentData = null;
  });

  $("search-btn").addEventListener("click", runSearch);
  $("nmls-input").addEventListener("keydown", e => { if (e.key === "Enter") runSearch(); });
  $("export-btn").addEventListener("click", exportToExcel);
});
