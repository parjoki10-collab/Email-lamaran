(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const DEFAULTS = {
    applicantName: "Yoga Dahnu",
    jobPosition: "Operator Produksi",
    salutation: "Kepada Yth. HRD {nama_perusahaan},",
    companyName: "",
    subjectTemplate: "{posisi}_{nama_pelamar}",
    bodyTemplate: `Dengan hormat,

Saya bermaksud mengajukan lamaran pekerjaan untuk posisi {posisi} di perusahaan yang Bapak/Ibu pimpin.

Sebagai bahan pertimbangan, saya lampirkan CV dan berkas pendukung lainnya. Besar harapan saya untuk mendapatkan kesempatan mengikuti proses seleksi di perusahaan yang Bapak/Ibu pimpin.

Demikian lamaran ini saya sampaikan. Atas perhatian dan kesempatan yang diberikan, saya ucapkan terima kasih.

Hormat saya,

{nama_pelamar}`
  };
  const SETTINGS_KEY = "lamaranMailSettingsV1";
  let generated = [];
  let parsed = { tokens: [], valid: [], invalid: [], duplicates: [] };
  let toastTimer;

  function loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
      Object.keys(DEFAULTS).forEach(key => {
        $(key).value = typeof saved[key] === "string" ? saved[key] : DEFAULTS[key];
      });
    } catch (_) {
      Object.keys(DEFAULTS).forEach(key => $(key).value = DEFAULTS[key]);
    }
  }
  function settings() {
    const result = {};
    Object.keys(DEFAULTS).forEach(key => result[key] = $(key).value.trim());
    return result;
  }
  function saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings())); } catch (_) {}
    $("savedState").textContent = "✓ Pengaturan tersimpan otomatis";
  }
  function applySettings() {
    saveSettings();
    if (generated.length) renderResults();
    showToast("Pengaturan diterapkan ke hasil email.");
  }
  function isValidEmail(email) {
    if (email.length > 254 || /\s/.test(email)) return false;
    return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(email);
  }
  function parseInput() {
    const raw = $("emailInput").value.trim();
    const tokens = raw ? raw.split(/[\s,;]+/).map(x => x.trim()).filter(Boolean) : [];
    const seen = new Set(), valid = [], invalid = [], duplicates = [];
    tokens.forEach(email => {
      const normalized = email.toLowerCase();
      if (seen.has(normalized)) { duplicates.push(email); return; }
      seen.add(normalized);
      if (isValidEmail(email)) valid.push(email);
      else invalid.push(email);
    });
    parsed = { tokens, valid, invalid, duplicates };
    updateStats();
    return parsed;
  }
  function updateStats() {
    $("totalCount").textContent = parsed.tokens.length;
    $("validCount").textContent = parsed.valid.length;
    $("duplicateCount").textContent = parsed.duplicates.length;
    $("invalidCount").textContent = parsed.invalid.length;
    $("invalidLabel").textContent = `(${parsed.invalid.length})`;
    $("invalidList").textContent = parsed.invalid.join(" · ");
    $("invalidBox").classList.toggle("hidden", parsed.invalid.length === 0);
  }
  function replaceTokens(template, company) {
    const s = settings();
    const values = {
      nama_pelamar: s.applicantName || DEFAULTS.applicantName,
      posisi: s.jobPosition || DEFAULTS.jobPosition,
      nama_perusahaan: company || s.companyName || ""
    };
    return String(template || "").replace(/\{(nama_pelamar|posisi|nama_perusahaan)\}/gi, (_, key) => values[key.toLowerCase()] || "");
  }
  function inferCompanyName() {
    const name = settings().companyName;
    return name || "";
  }
  function makeEmail(email) {
    const s = settings();
    const company = inferCompanyName();
    let greeting = replaceTokens(s.salutation || DEFAULTS.salutation, company);
    if (!company && /\s*\{nama_perusahaan\}\s*/i.test(s.salutation)) {
      greeting = (s.salutation || DEFAULTS.salutation).replace(/\s*\{nama_perusahaan\}\s*/i, "").replace(/\s+,/g, ",").trim();
    }
    if (!greeting) greeting = "Kepada Yth. HRD,";
    const subject = replaceTokens(s.subjectTemplate || DEFAULTS.subjectTemplate, company);
    const body = replaceTokens(s.bodyTemplate || DEFAULTS.bodyTemplate, company);
    return { email, subject, message: `${greeting}\n\n${body}`.trim() };
  }
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
  }
  function renderResults() {
    const list = $("resultsList");
    list.innerHTML = "";
    generated = parsed.valid.map(makeEmail);
    $("resultCount").textContent = generated.length;
    $("emptyState").classList.toggle("hidden", generated.length > 0);
    $("copyAllResultsBtn").disabled = generated.length === 0;
    generated.forEach((item, index) => {
      const card = document.createElement("article");
      card.className = "result-card";
      card.style.animationDelay = `${Math.min(index * 25, 250)}ms`;
      card.innerHTML = `
        <div class="card-top">
          <div><div class="card-index">LAMARAN #${String(index + 1).padStart(2, "0")}</div><div class="recipient">${escapeHtml(item.email)}</div></div>
          <span class="card-status">✓ Valid</span>
        </div>
        <div class="card-content">
          <div class="field-label">Subjek</div><div class="subject-text">${escapeHtml(item.subject)}</div>
          <div class="field-label">Isi pesan</div><div class="message-preview">${escapeHtml(item.message)}</div>
        </div>
        <div class="card-actions">
          <button class="btn btn-secondary" data-action="email" data-index="${index}">▣ Salin Penerima</button>
          <button class="btn btn-secondary" data-action="subject" data-index="${index}">▣ Salin Subjek</button>
          <button class="btn btn-secondary" data-action="message" data-index="${index}">▣ Salin Isi Pesan</button>
          <button class="btn btn-copy-all" data-action="all" data-index="${index}">▣ Salin Semua</button>
          <button class="btn btn-gmail" data-action="gmail" data-index="${index}">↗ Kirim via Gmail</button>
        </div>`;
      list.appendChild(card);
    });
  }
  function fullText(item) {
    return `Kepada: ${item.email}\nSubjek: ${item.subject}\n\n${item.message}`;
  }
  async function copyText(text, label) {
    try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
      else {
        const area = document.createElement("textarea");
        area.value = text; area.style.position = "fixed"; area.style.opacity = "0";
        document.body.appendChild(area); area.select();
        const ok = document.execCommand("copy"); area.remove();
        if (!ok) throw new Error("copy failed");
      }
      showToast(`${label} berhasil disalin.`);
    } catch (_) { showToast("Tidak bisa menyalin otomatis. Silakan salin secara manual."); }
  }
  function openGmail(item) {
    const recipient = item.email || "";
    const subject = item.subject || "";
    const body = item.message || "";

    if (isMobileDevice()) {
      // Open the Gmail app in a separate browsing context. Do not navigate
      // the generator tab to a custom URL scheme, so Safari can return to it.
      const gmailAppUrl = "googlegmail://co?to=" + encodeURIComponent(recipient)
        + "&subject=" + encodeURIComponent(subject)
        + "&body=" + encodeURIComponent(body);
      const appTab = window.open(gmailAppUrl, "_blank");
      if (!appTab) {
        showToast("Browser memblokir pembukaan Gmail. Izinkan pop-up atau buka Gmail secara manual.");
        return;
      }
      showToast("Gmail dibuka. Setelah mengirim, kembali ke tab generator untuk melanjutkan.");
      return;
    }

    const params = new URLSearchParams({
      view: "cm", fs: "1", tf: "cm", to: recipient, su: subject, body: body
    });
    const url = "https://mail.google.com/mail/u/0/?" + params.toString();
    const opened = window.open(url, "_blank");
    if (!opened) showToast("Tab baru diblokir. Izinkan pop-up browser lalu coba lagi.");
    else showToast("Gmail dibuka. Periksa pesan, lampirkan CV, lalu kirim manual.");
  }

  function showToast(message) {
    const toast = $("toast"); toast.textContent = message; toast.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
  }
  $("emailInput").addEventListener("input", () => { parseInput(); $("inputMessage").textContent = ""; });
  $("generateBtn").addEventListener("click", () => {
    parseInput();
    if (!parsed.tokens.length) { $("inputMessage").textContent = "Masukkan setidaknya satu alamat email terlebih dahulu."; return; }
    if (!parsed.valid.length) { $("inputMessage").textContent = "Tidak ada alamat email valid yang bisa dibuat."; generated = []; renderResults(); return; }
    $("inputMessage").textContent = `${parsed.valid.length} email valid siap diproses${parsed.duplicates.length ? ` · ${parsed.duplicates.length} duplikat diabaikan` : ""}${parsed.invalid.length ? ` · ${parsed.invalid.length} alamat tidak valid diabaikan` : ""}.`;
    renderResults();
    $("resultsList").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  $("clearBtn").addEventListener("click", () => {
    $("emailInput").value = ""; parsed = { tokens: [], valid: [], invalid: [], duplicates: [] };
    generated = []; updateStats(); renderResults(); $("inputMessage").textContent = "";
    showToast("Input email dibersihkan.");
  });
  $("removeDuplicatesBtn").addEventListener("click", () => {
    parseInput();
    const seen = new Set(), unique = [];
    parsed.tokens.forEach(email => { const key = email.toLowerCase(); if (!seen.has(key)) { seen.add(key); unique.push(email); } });
    $("emailInput").value = unique.join("\n"); parseInput();
    $("inputMessage").textContent = `${parsed.duplicates.length} alamat duplikat dihapus dari input.`;
    showToast("Duplikat dihapus.");
  });
  $("copyValidBtn").addEventListener("click", () => {
    parseInput();
    if (!parsed.valid.length) return showToast("Belum ada email valid untuk disalin.");
    copyText(parsed.valid.join("\n"), "Daftar email valid");
  });
  $("copyAllResultsBtn").addEventListener("click", () => {
    if (!generated.length) return;
    copyText(generated.map((item, i) => `=== LAMARAN ${i + 1} ===\n${fullText(item)}`).join("\n\n--------------------\n\n"), "Semua hasil email");
  });
  $("resultsList").addEventListener("click", event => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const item = generated[Number(button.dataset.index)];
    if (!item) return;
    switch (button.dataset.action) {
      case "email": copyText(item.email, "Email penerima"); break;
      case "subject": copyText(item.subject, "Subjek"); break;
      case "message": copyText(item.message, "Isi pesan"); break;
      case "all": copyText(fullText(item), "Data email"); break;
      case "gmail": openGmail(item); break;
    }
  });
  $("toggleSettings").addEventListener("click", () => {
    const panel = $("settingsPanel"), opening = panel.classList.contains("hidden");
    panel.classList.toggle("hidden", !opening);
    $("toggleSettings").setAttribute("aria-expanded", String(opening));
    if (opening) panel.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  Object.keys(DEFAULTS).forEach(key => $(key).addEventListener("input", () => {
    saveSettings();
    if (generated.length) renderResults();
  }));
  $("applySettings").addEventListener("click", applySettings);
  $("resetSettings").addEventListener("click", () => {
    Object.keys(DEFAULTS).forEach(key => $(key).value = DEFAULTS[key]);
    saveSettings(); if (generated.length) renderResults(); showToast("Pengaturan kembali ke default.");
  });
  loadSettings(); parseInput(); renderResults();
})();
