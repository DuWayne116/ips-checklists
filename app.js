"use strict";
/* ---------- storage (IndexedDB with localStorage fallback) ---------- */
const DB = (() => {
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    if (!("indexedDB" in window)) return rej("no idb");
    const r = indexedDB.open("ips-checklists", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("jobs", { keyPath: "id" });
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
  const tx = (mode, fn) => open().then(db => new Promise((res, rej) => {
    const t = db.transaction("jobs", mode), s = t.objectStore("jobs"); const q = fn(s);
    t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error);
  }));
  const lsAll = () => JSON.parse(localStorage.getItem("ips-jobs") || "{}");
  return {
    all: () => tx("readonly", s => s.getAll()).catch(() => Object.values(lsAll())),
    get: id => tx("readonly", s => s.get(id)).catch(() => lsAll()[id]),
    put: j => tx("readwrite", s => s.put(j)).catch(() => { const a = lsAll(); a[j.id] = j; localStorage.setItem("ips-jobs", JSON.stringify(a)); }),
    del: id => tx("readwrite", s => s.delete(id)).catch(() => { const a = lsAll(); delete a[id]; localStorage.setItem("ips-jobs", JSON.stringify(a)); })
  };
})();

/* ---------- helpers ---------- */
const $ = (s, el = document) => el.querySelector(s), $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad2 = n => String(n).padStart(2, "0");
const fmtDT = d => { d = new Date(d); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
const fmtGPS = g => g ? (g.err ? `GPS unavailable (${g.err})` : `${g.lat.toFixed(5)}, ${g.lng.toFixed(5)} (±${Math.round(g.acc)} m)`) : "GPS: locating…";
const gpText = t => esc(t).replace(/\((GP)([^)]*)\)/g, '(<span class="gp">GP</span>$2)');
function toast(m, ms = 2200) { const t = $("#toast"); t.textContent = m; t.hidden = false; clearTimeout(t._t); t._t = setTimeout(() => t.hidden = true, ms); }
let saveT = null, cur = { job: null, fid: null };
function save(job = cur.job, now) { job.updated = Date.now(); clearTimeout(saveT); const go = () => DB.put(job); return now ? go() : (saveT = setTimeout(go, 300)); }

function getGPS() {
  return new Promise(res => {
    if (!navigator.geolocation) return res({ err: "not supported", time: Date.now() });
    navigator.geolocation.getCurrentPosition(p => res({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy, time: Date.now() }),
      e => res({ err: e.message || "denied", time: Date.now() }), { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  });
}
let lastGPS = null;

/* ---------- jobs ---------- */
function nextRep() {
  const d = new Date(), day = `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
  const k = "ips-seq-" + day, n = (+localStorage.getItem(k) || 0) + 1; localStorage.setItem(k, n);
  return `REP-${day}-${String(n).padStart(3, "0")}`;
}
const newForm = () => ({ v: {}, checks: {}, photos: {}, sigs: {}, rows: {}, started: Date.now(), gps: null, completed: null });
async function createJob() {
  const rep = nextRep(), now = Date.now();
  const job = { id: rep + "-" + now.toString(36), rep, created: now, updated: now, status: "rw", forms: {} };
  job.forms.rw = newForm(); Object.assign(job.forms.rw.v, { rep, datetime: fmtDT(now), linked_rep: rep, loadmaster: localStorage.getItem("ips-loadmaster") || "" });
  await save(job, true); return job;
}
function ensureForm(job, fid) {
  if (job.forms[fid]) return job.forms[fid];
  const f = job.forms[fid] = newForm(), now = Date.now(), rw = job.forms.rw?.v || {}, ls = job.forms.ls;
  if (fid === "ls") Object.assign(f.v, { rep: job.rep, datetime: fmtDT(now), location: rw.location, vehicle_reg: rw.truck_reg, trailer_reg: rw.trailer_reg1,
    driver: rw.driver, loadmaster: rw.loadmaster, trailer_type: rw.trailer_type, trailer_type_other: rw.trailer_type_other, cert_no: certNo(job) });
  if (fid === "cert" && ls) {
    const v = ls.v, L = ls.rows.lashings || [];
    const tt = v.trailer_type === "Other" ? v.trailer_type_other : v.trailer_type;
    const mmap = { "Blocking / bracing": "Blocking / bracing", "Top-over (friction) lashing": "Top-over lashing", "Direct lashing": "Direct lashing", "Twist locks": "Twist locks" };
    const lash = L.filter(r => +r.qty).map(r => `${r.qty} x ${r.type}${r.wll ? " @ " + r.wll + " daN" : ""}`).join("; ");
    Object.assign(f.v, { cert_no: certNo(job), date: fmtDT(now).slice(0, 10), vehicle_reg: v.vehicle_reg, trailer: [v.trailer_reg, tt].filter(Boolean).join(" / "),
      container_no: v.container_no, seal_no: v.seal_no, weight: v.load_mass, weight_source: v.mass_source === "Weighbridge ticket" ? "Weighbridge" : v.mass_source ? "Declared" : "",
      method: v.method === "Combination" ? [] : (mmap[v.method] ? [mmap[v.method]] : []), lashings: lash, edge: v.edge_qty, rep: job.rep, location: v.location,
      departure: toLocalInput(now) });
    if (ls.sigs.loadmaster) f.sigs.loadmaster = { name: ls.sigs.loadmaster.name };
    if (ls.sigs.driver) f.sigs.driver = { name: ls.sigs.driver.name };
  }
  return f;
}
const certNo = job => "CERT-" + job.rep.replace(/^REP-/, "");
const toLocalInput = t => { const d = new Date(t); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
function jobStatus(job) {
  if (job.status === "refused") return ["Load refused", "refused"];
  if (job.status === "done") return ["Complete", "done"];
  return [{ rw: "Roadworthiness", ls: "Load securing", cert: "Certificate" }[job.status] + " in progress", "prog"];
}

/* ---------- router ---------- */
window.addEventListener("hashchange", route);
$("#homeLogo").onclick = () => location.hash = "#/";
$("#backBtn").onclick = () => { const p = location.hash.split("/"); location.hash = p.length > 3 ? `#/job/${p[2]}` : "#/"; };
async function route() {
  const p = location.hash.replace(/^#\/?/, "").split("/");
  $("#backBtn").hidden = !p[0]; const A = $("#app"); A.oninput = A.onchange = A.onclick = null; window.scrollTo(0, 0);
  if (p[0] === "job" && p[1]) {
    const job = await DB.get(decodeURIComponent(p[1])); if (!job) return location.hash = "#/";
    cur.job = job;
    if (p[2] && FORMS[p[2]]) return renderForm(job, p[2]);
    return renderJob(job);
  }
  renderHome();
}

/* ---------- home ---------- */
async function renderHome() {
  $("#topTitle").textContent = "Digital Checklists";
  const jobs = (await DB.all()).sort((a, b) => b.updated - a.updated);
  $("#app").innerHTML = `
  <section class="hero"><h1>Loadmaster checklists</h1>
   <p>Roadworthiness check &rarr; Load securing checklist &rarr; Load securing certificate, linked by one REP number.</p>
   <button class="btn" id="newJob">+ Start new job</button></section>
  <div class="card"><div class="sechd">Jobs <span class="cnt">${jobs.length}</span></div>
   ${jobs.length ? jobs.map(j => { const [s, c] = jobStatus(j), v = j.forms.rw?.v || {};
     return `<div class="job" data-id="${esc(j.id)}"><div class="main"><div class="rep">${esc(j.rep)}</div>
     <div class="muted">${esc(v.truck_reg || "No vehicle yet")} · ${esc(v.location || "")} · ${fmtDT(j.created)}</div></div><span class="chip ${c}">${s}</span></div>` }).join("")
     : `<div class="empty">No jobs yet. Tap <b>Start new job</b> to begin.</div>`}</div>
  <p class="muted" style="text-align:center">Data is saved on this device only. Export PDFs to keep records.</p>`;
  $("#newJob").onclick = async () => { const j = await createJob(); location.hash = `#/job/${encodeURIComponent(j.id)}/rw`; };
  $$(".job").forEach(el => el.onclick = () => location.hash = `#/job/${encodeURIComponent(el.dataset.id)}`);
}

/* ---------- job overview ---------- */
function renderJob(job) {
  $("#topTitle").textContent = job.rep;
  const F = job.forms, rwDone = !!F.rw?.completed, refused = job.status === "refused", lsDone = !!F.ls?.completed, certDone = !!F.cert?.completed;
  const steps = [
    { fid: "rw", n: 1, done: rwDone, open: true, desc: rwDone ? `Outcome: <b>${esc(F.rw.v.outcome)}</b> · signed ${fmtDT(F.rw.completed)}` : "Visual walk-around of truck & trailer before loading" },
    { fid: "ls", n: 2, done: lsDone, open: rwDone && !refused, desc: refused ? "Not available: load refused" : lsDone ? `Signed ${fmtDT(F.ls.completed)}` : "Restraint, lashings, final walk-around and sign-offs" },
    { fid: "cert", n: 3, done: certDone, open: lsDone && !refused, desc: refused ? "Not available: load refused" : certDone ? `${esc(F.cert.v.cert_no)} issued ${fmtDT(F.cert.completed)}` : "Pre-filled from the checklist; loadmaster & driver sign" }];
  const [s, c] = jobStatus(job);
  $("#app").innerHTML = `
   <div class="card"><div class="bd"><div class="row" style="align-items:center"><div style="flex:1"><h1>${esc(job.rep)}</h1>
   <div class="muted">${esc(F.rw?.v.truck_reg || "")} ${esc(F.rw?.v.driver ? "· " + F.rw.v.driver : "")} · created ${fmtDT(job.created)}</div></div><span class="chip ${c}">${s}</span></div></div></div>
   ${refused ? `<div class="notice refused"><b>LOAD REFUSED.</b> The job flow is stopped. Export the roadworthiness check as a record of the defects.</div>` : ""}
   <div class="card steps">${steps.map(st => { const f = F[st.fid];
     const cls = st.done ? "done" : st.fid === "rw" && refused ? "refused" : st.open ? "active" : "locked";
     return `<div class="step ${cls}"><div class="num">${st.done ? "&#10003;" : st.n}</div><div class="main"><h2>${FORMS[st.fid].title}</h2><div class="muted">${st.desc}</div>
     <div class="acts">${st.open ? `<a class="btn sm ${st.done ? "" : "primary"}" href="#/job/${encodeURIComponent(job.id)}/${st.fid}">${st.done ? "View" : f ? "Continue" : "Start"}</a>` : ""}
     ${f ? `<button class="btn sm ghost" data-pdf="${st.fid}">PDF</button><button class="btn sm ghost" data-share="${st.fid}">Share</button>` : ""}</div></div></div>` }).join("")}</div>
   <div class="row"><button class="btn primary" id="jobPdf">Combined job PDF</button><button class="btn" id="jobShare">Share / email job</button></div>
   <div style="margin-top:22px"><button class="btn ghost block" id="delJob">Delete job from this device</button></div>`;
  $$("[data-pdf]").forEach(b => b.onclick = () => exportPDF(job, [b.dataset.pdf], false));
  $$("[data-share]").forEach(b => b.onclick = () => exportPDF(job, [b.dataset.share], true));
  const all = ["rw", "ls", "cert"].filter(k => F[k]);
  $("#jobPdf").onclick = () => exportPDF(job, all, false);
  $("#jobShare").onclick = () => exportPDF(job, all, true);
  $("#delJob").onclick = async () => { if (confirm(`Delete ${job.rep} and all its forms, photos and signatures from this device?`)) { await DB.del(job.id); location.hash = "#/"; } };
}

/* ---------- form rendering ---------- */
function renderForm(job, fid, keepScroll) {
  const def = FORMS[fid];
  if (fid === "ls" && (!job.forms.rw?.completed || job.status === "refused")) { toast("Complete the roadworthiness check first"); return location.hash = `#/job/${encodeURIComponent(job.id)}`; }
  if (fid === "cert" && (!job.forms.ls?.completed || job.status === "refused")) { toast("Complete the load securing checklist first"); return location.hash = `#/job/${encodeURIComponent(job.id)}`; }
  const f = ensureForm(job, fid); cur = { job, fid };
  const ro = !!f.completed, y = window.scrollY;
  if (!f.gps && !ro) { f.gps = lastGPS; getGPS().then(g => { lastGPS = g; if (!f.gps || f.gps.err) { f.gps = g; save(job); } const s = $("#gpsStamp"); if (s && cur.fid === fid) s.textContent = "📍 " + fmtGPS(f.gps); }); }
  $("#topTitle").textContent = def.short + " · " + job.rep;
  let h = `<h1>${def.title}</h1><p class="muted" style="margin-top:0;white-space:pre-line">${esc(def.subtitle)}</p>`;
  h += `<div class="stamp"><span>🕒 Started ${fmtDT(f.started)}</span><span id="gpsStamp">📍 ${fmtGPS(f.gps)}</span>${f.completed ? `<span>✔ Signed off ${fmtDT(f.completed)}</span>` : ""}</div>`;
  if (def.notice) h += `<div class="notice">${def.notice.html}</div>`;
  if (ro) h += `<div class="done-banner">This form is signed off and locked. <button class="btn sm ghost" id="reopen" style="margin-left:6px">Reopen to edit</button></div>`;
  h += `<div id="errs"></div><fieldset ${ro ? "disabled" : ""}>`;
  for (const sec of def.sections) {
    const nChecks = sec.fields.filter(x => x.t === "checks").reduce((a, x) => a + x.items.length, 0);
    const answered = nChecks ? sec.fields.filter(x => x.t === "checks").reduce((a, x) => a + x.items.filter((_, i) => f.checks[`${sec.k}.${i}`]?.s != null).length, 0) : 0;
    h += `<section class="card" id="sec-${sec.k}"><div class="sechd"><span>${gpText(sec.title)}</span>${nChecks ? `<span class="cnt" id="cnt-${sec.k}">${answered}/${nChecks}</span>` : ""}</div><div class="bd">`;
    let grid = [];
    const flush = () => { if (grid.length) { h += `<div class="grid">${grid.join("")}</div>`; grid = []; } };
    for (const fd of sec.fields) {
      if (fd.showIf && f.v[fd.showIf[0]] !== fd.showIf[1]) continue;
      if (fd.t === "text") { grid.push(fieldText(f, fd)); continue; }
      flush(); h += renderField(job, f, sec, fd);
    }
    flush();
    if (sec.photos) h += photoBlock(f, sec);
    h += `</div></section>`;
  }
  h += `</fieldset>`;
  h += ro ? `<div class="actions"><button class="btn" id="fPdf">PDF</button><button class="btn" id="fShare">Share</button><a class="btn primary" href="#/job/${encodeURIComponent(job.id)}">Job</a></div>`
          : `<div class="actions"><a class="btn ghost" href="#/job/${encodeURIComponent(job.id)}">Save &amp; exit</a><button class="btn primary" id="signoff">Complete &amp; sign off</button></div>`;
  $("#app").innerHTML = h;
  bindForm(job, fid, f);
  if (keepScroll) window.scrollTo(0, y);
}
function fieldText(f, fd) {
  const val = f.v[fd.k] ?? "";
  return `<label class="f ${fd.full ? "full" : ""}" data-fk="${fd.k}">${esc(fd.label)}${fd.req ? ' <span class="req">*</span>' : ""}
   <input data-k="${fd.k}" type="${fd.type || "text"}" ${fd.type === "number" ? 'inputmode="decimal" min="0"' : ""} value="${esc(val)}" ${fd.ro ? "readonly" : ""} ${fd.upper ? 'style="text-transform:uppercase"' : ""} autocomplete="off"></label>`;
}
function renderField(job, f, sec, fd) {
  switch (fd.t) {
    case "note": return `<p class="note ${fd.cls || ""}">${fd.html || esc(fd.text)}</p>`;
    case "textarea": return `<label class="f" data-fk="${fd.k}">${esc(fd.label)}${fd.req ? ' <span class="req">*</span>' : ""}<textarea data-k="${fd.k}">${esc(f.v[fd.k] ?? "")}</textarea></label>`;
    case "choice": {
      const v = f.v[fd.k], sel = o => fd.multi ? (v || []).includes(o) : v === o;
      return `<div class="f" data-fk="${fd.k}" style="margin:12px 0"><label class="f">${esc(fd.label)}${fd.req ? ' <span class="req">*</span>' : ""}${fd.multi ? ' <span class="muted">(select all that apply)</span>' : ""}</label>
       <div class="opts ${fd.big ? "big" : ""}">${fd.opts.map(o => `<button type="button" class="opt ${sel(o) ? "on" : ""}" data-choice="${fd.k}" data-val="${esc(o)}" ${fd.multi ? "data-multi=1" : ""}>${esc(o)}</button>`).join("")}</div>
       ${fd.other && sel("Other") ? `<input data-k="${fd.k}_other" placeholder="${esc(fd.otherLabel || "Specify other")}" value="${esc(f.v[fd.k + "_other"] ?? "")}">` : ""}</div>`;
    }
    case "checks": return fd.items.map((it, i) => {
      const key = `${sec.k}.${i}`, c = f.checks[key] || {}, bad = c.s === 1;
      return `<div class="ck ${c.c || bad ? "showc" : ""}" data-ck="${key}"><div class="q"><span class="n">${i + 1}.</span><span>${gpText(it)}</span></div>
       <div class="seg">${fd.labels.map((l, j) => `<button type="button" class="s${j} ${c.s === j ? "on" : ""}" data-set="${key}" data-s="${j}">${l}</button>`).join("")}</div>
       <button type="button" class="addc">+ Comment</button><div class="cm"><input data-ckc="${key}" placeholder="${bad ? "Describe the " + fd.labels[1].toLowerCase() + " (required)" : "Comment"}" value="${esc(c.c || "")}"></div></div>`;
    }).join("");
    case "lashings": {
      const L = f.rows.lashings || (f.rows.lashings = [{ type: "Webbing straps (ratchet)", qty: "", wll: "", ok: "" }, { type: "Chains & binders", qty: "", wll: "", ok: "" }, { type: "", other: 1, qty: "", wll: "", ok: "" }]);
      const tq = L.reduce((a, r) => a + (+r.qty || 0), 0), tt = L.reduce((a, r) => a + (+r.qty || 0) * (+r.wll || 0), 0);
      return `<label class="f" style="margin-top:14px">Lashings / restraints</label>${L.map((r, i) => `<div class="drow"><b>${r.other ? `<input data-lr="${i}" data-lk="type" placeholder="Other: type" value="${esc(r.type)}">` : esc(r.type)}</b>
        <div class="grid" style="grid-template-columns:1fr 1fr;margin-top:6px"><label class="f">Quantity<input data-lr="${i}" data-lk="qty" type="number" inputmode="numeric" min="0" value="${esc(r.qty)}"></label>
        <label class="f">WLL / LC each (daN)<input data-lr="${i}" data-lk="wll" type="number" inputmode="decimal" min="0" value="${esc(r.wll)}"></label></div>
        <div class="muted" style="margin-top:6px">Total: <b data-ltot="${i}">${(+r.qty || 0) * (+r.wll || 0)}</b> daN</div>
        <div class="f" style="margin-top:6px">Condition OK <div class="opts">${["Yes", "No"].map(o => `<button type="button" class="opt ${r.ok === o ? "on" : ""}" data-lok="${i}" data-val="${o}">${o}</button>`).join("")}</div></div></div>`).join("")}
       <div class="drow" style="background:#fafafa"><b>TOTAL</b>: <span id="lashTot">${tq} lashings · ${tt} daN</span></div>`;
    }
    case "rows": {
      const R = f.rows[fd.k] || (f.rows[fd.k] = []);
      return `<div class="f" data-fk="${fd.k}" style="margin-top:8px"><label class="f">${esc(fd.label)}</label>
       ${R.map((r, i) => `<div class="drow">${fd.cols.map(c => c.yn ? `<div class="f">${esc(c.label)}<div class="opts">${["Yes", "No"].map(o => `<button type="button" class="opt ${r[c.k] === o ? "on" : ""}" data-rk="${fd.k}" data-ri="${i}" data-rc="${c.k}" data-val="${o}">${o}</button>`).join("")}</div></div>`
         : `<label class="f">${esc(c.label)}<input data-rk="${fd.k}" data-ri="${i}" data-rc="${c.k}" value="${esc(r[c.k] || "")}"></label>`).join("")}
         <button type="button" class="btn sm ghost" data-rdel="${fd.k}" data-ri="${i}" style="margin-top:8px">Remove</button></div>`).join("")}
       <div class="row" style="margin-top:8px"><button type="button" class="btn sm" data-radd="${fd.k}">+ Add defect</button>${fd.autoDefects ? `<button type="button" class="btn sm" id="pullDefects">Add items marked Defect</button>` : ""}</div></div>`;
    }
    case "photocount": { const n = Object.values(f.photos).reduce((a, p) => a + p.length, 0) + ((job.forms.rw && job !== null && f !== job.forms.rw) ? 0 : 0);
      return `<p class="muted"><b>No. of photos (this form):</b> ${n}</p>`; }
    case "sigs": return `<div class="sigs">${fd.roles.map(r => { const s = f.sigs[r.k] || {}, dn = s.name ?? defaultSigName(f, r.k);
      return `<div class="sig" data-fk="sig_${r.k}"><b>${esc(r.label)}</b> <span class="req" style="color:var(--red)">*</span>
       <label class="f" style="margin-top:6px">Name<input data-sign="${r.k}" value="${esc(dn)}"></label>
       <div class="pad" data-pad="${r.k}" data-label="${esc(r.label)}">${s.img ? `<img src="${s.img}" alt="signature">` : "Tap to sign"}</div>
       <div class="when">${s.time ? "Signed " + fmtDT(s.time) + (s.gps && !s.gps.err ? " · " + s.gps.lat.toFixed(5) + ", " + s.gps.lng.toFixed(5) : "") : ""}</div></div>` }).join("")}</div>`;
  }
  return "";
}
const defaultSigName = (f, k) => k === "loadmaster" ? (f.v.loadmaster || (cur.job.forms.rw?.v.loadmaster) || "") : k === "driver" ? (f.v.driver || cur.job.forms.rw?.v.driver || cur.job.forms.ls?.v.driver || "") : k === "consignor" ? "" : "";
function photoBlock(f, sec) {
  const P = f.photos[sec.k] || [];
  return `<div class="photos"><div class="row" style="align-items:center"><span class="muted" style="flex:1">Photos (${P.length})</span>
   <label class="btn sm camlbl">📷 Add photo<input type="file" accept="image/*" capture="environment" data-photo="${sec.k}" multiple></label></div>
   <div class="thumbs">${P.map((p, i) => `<div class="thumb"><img src="${p.img}" alt="photo"><button type="button" data-pdel="${sec.k}" data-pi="${i}" aria-label="Remove photo">&times;</button></div>`).join("")}</div></div>`;
}

function bindForm(job, fid, f) {
  const app = $("#app"), rer = () => renderForm(job, fid, true);
  app.oninput = (e => {
    const t = e.target;
    if (t.dataset.k) { f.v[t.dataset.k] = t.dataset.k && t.style.textTransform === "uppercase" ? t.value.toUpperCase() : t.value; if (t.dataset.k === "loadmaster") localStorage.setItem("ips-loadmaster", t.value); }
    else if (t.dataset.ckc) { (f.checks[t.dataset.ckc] ||= {}).c = t.value; }
    else if (t.dataset.lr) { const r = f.rows.lashings[+t.dataset.lr]; r[t.dataset.lk] = t.value; const L = f.rows.lashings;
      $(`[data-ltot="${t.dataset.lr}"]`).textContent = (+r.qty || 0) * (+r.wll || 0);
      $("#lashTot").textContent = `${L.reduce((a, r) => a + (+r.qty || 0), 0)} lashings · ${L.reduce((a, r) => a + (+r.qty || 0) * (+r.wll || 0), 0)} daN`; }
    else if (t.dataset.rk) f.rows[t.dataset.rk][+t.dataset.ri][t.dataset.rc] = t.value;
    else if (t.dataset.sign) (f.sigs[t.dataset.sign] ||= {}).name = t.value;
    t.closest(".invalid")?.classList.remove("invalid");
    save(job);
  });
  app.onchange = (async e => {
    const t = e.target; if (!t.dataset.photo) return;
    const files = [...t.files]; if (!files.length) return; toast("Processing photo…");
    const g = lastGPS && !lastGPS.err ? lastGPS : f.gps;
    for (const file of files) { try { const img = await compressPhoto(file, g); (f.photos[t.dataset.photo] ||= []).push({ img, time: Date.now(), gps: g && !g.err ? { lat: g.lat, lng: g.lng } : null }); } catch (err) { toast("Could not read photo"); } }
    await save(job, true); rer(); toast("Photo saved");
  });
  app.onclick = (e => {
    const b = e.target.closest("button,[data-pad]"); if (!b) return; const d = b.dataset;
    if (b.closest("fieldset[disabled]") && !d.pad) return;
    if (d.set) { const c = (f.checks[d.set] ||= {}); c.s = c.s === +d.s ? null : +d.s; const ck = b.closest(".ck");
      $$("button", ck).forEach(x => x.classList.toggle("on", x.dataset.s == c.s && c.s != null)); if (c.s === 1) { ck.classList.add("showc"); }
      ck.classList.remove("invalid"); const sk = d.set.split(".")[0], cnt = $("#cnt-" + sk);
      if (cnt) { const tot = $$(`[data-ck^="${sk}."]`).length; cnt.textContent = `${$$(`[data-ck^="${sk}."]`).filter(x => f.checks[x.dataset.ck]?.s != null).length}/${tot}`; }
      save(job); return; }
    if (b.classList.contains("addc")) { b.closest(".ck").classList.add("showc"); $("input", b.closest(".ck")).focus(); return; }
    if (d.choice) { if (d.multi) { const a = f.v[d.choice] ||= []; const i = a.indexOf(d.val); i < 0 ? a.push(d.val) : a.splice(i, 1); } else f.v[d.choice] = f.v[d.choice] === d.val ? "" : d.val; save(job); return rer(); }
    if (d.lok) { const r = f.rows.lashings[+d.lok]; r.ok = r.ok === d.val ? "" : d.val; save(job); return rer(); }
    if (d.radd) { f.rows[d.radd].push({}); save(job); return rer(); }
    if (d.rdel) { f.rows[d.rdel].splice(+d.ri, 1); save(job); return rer(); }
    if (d.rk && d.val) { const r = f.rows[d.rk][+d.ri]; r[d.rc] = r[d.rc] === d.val ? "" : d.val; save(job); return rer(); }
    if (b.id === "pullDefects") { const R = f.rows.defects ||= [], have = new Set(R.map(r => r.defect)); let n = 0;
      for (const sec of FORMS[fid].sections) for (const fd of sec.fields) if (fd.t === "checks") fd.items.forEach((it, i) => { const c = f.checks[`${sec.k}.${i}`];
        if (c?.s === 1) { const txt = `${sec.title.split(".")[0]}.${i + 1} ${it}${c.c ? " - " + c.c : ""}`; if (!have.has(txt)) { R.push({ defect: txt }); n++; } } });
      toast(n ? `${n} defect(s) added` : "No new items marked Defect"); save(job); return rer(); }
    if (d.pdel) { if (confirm("Remove this photo?")) { f.photos[d.pdel].splice(+d.pi, 1); save(job); rer(); } return; }
    if (d.pad) { if (f.completed) return; return openSig(d.label, img => { const s = (f.sigs[d.pad] ||= {}); if (s.name == null) s.name = defaultSigName(f, d.pad); s.img = img; s.time = Date.now(); s.gps = lastGPS || f.gps; save(job, true); rer(); }); }
    if (b.id === "signoff") return signOff(job, fid, f);
    if (b.id === "reopen") { if (confirm("Reopen this form for editing? It will need to be signed off again" + (fid !== "cert" ? " and later forms remain as they are." : "."))) { f.completed = null; if (fid === "rw" || job.status === "done") job.status = fid; save(job, true).then(rer); } return; }
    if (b.id === "fPdf") return exportPDF(job, [fid], false);
    if (b.id === "fShare") return exportPDF(job, [fid], true);
  });
}

/* ---------- validation & sign-off ---------- */
function validate(job, fid, f) {
  const errs = [], def = FORMS[fid];
  for (const sec of def.sections) for (const fd of sec.fields) {
    if (fd.showIf && f.v[fd.showIf[0]] !== fd.showIf[1]) continue;
    const v = f.v[fd.k];
    if (fd.req && ["text", "textarea", "choice"].includes(fd.t) && (v == null || String(v).trim() === "" || (Array.isArray(v) && !v.length))) errs.push({ sel: `[data-fk="${fd.k}"]`, msg: `${sec.title}: ${fd.label} is required` });
    if (fd.t === "choice" && fd.other && (fd.multi ? (v || []).includes("Other") : v === "Other") && !String(f.v[fd.k + "_other"] || "").trim()) errs.push({ sel: `[data-fk="${fd.k}"]`, msg: `${sec.title}: specify "Other" for ${fd.label}` });
    if (fd.t === "checks") fd.items.forEach((it, i) => { const k = `${sec.k}.${i}`, c = f.checks[k];
      if (c?.s == null) errs.push({ sel: `[data-ck="${k}"]`, msg: `${sec.title.split(" ")[0]}${i + 1} not answered` });
      else if (c.s === 1 && !String(c.c || "").trim()) errs.push({ sel: `[data-ck="${k}"]`, msg: `${sec.title.split(" ")[0]}${i + 1}: add a comment describing the ${fd.labels[1].toLowerCase()}` }); });
    if (fd.t === "sigs") fd.roles.forEach(r => { const s = f.sigs[r.k] || {}, nm = s.name ?? defaultSigName(f, r.k);
      if (!String(nm || "").trim()) errs.push({ sel: `[data-fk="sig_${r.k}"]`, msg: `${r.label}: name required` });
      if (!s.img) errs.push({ sel: `[data-fk="sig_${r.k}"]`, msg: `${r.label}: signature required` }); });
  }
  if (fid === "rw") {
    const anyDef = Object.values(f.checks).some(c => c?.s === 1), D = (f.rows.defects || []).filter(r => String(r.defect || "").trim());
    if (f.v.outcome === "OK TO LOAD" && anyDef) errs.push({ sel: '[data-fk="outcome"]', msg: "Items are marked Defect: choose LOAD REFUSED or OK to load after defect corrected" });
    if (f.v.outcome && f.v.outcome !== "OK TO LOAD" && !D.length) errs.push({ sel: '[data-fk="defects"]', msg: "List the defect(s) found in section 12" });
    if (f.v.outcome === "OK to load after defect corrected" && D.some(r => r.corrected !== "Yes")) errs.push({ sel: '[data-fk="defects"]', msg: "All listed defects must be marked Corrected = Yes to load" });
  }
  return errs;
}
async function signOff(job, fid, f) {
  // persist default sig names
  for (const k of Object.keys(f.sigs)) if (f.sigs[k].name == null) f.sigs[k].name = defaultSigName(f, k);
  const errs = validate(job, fid, f);
  $$(".invalid").forEach(x => x.classList.remove("invalid"));
  if (errs.length) {
    errs.forEach(e => $(e.sel)?.classList.add("invalid"));
    $("#errs").innerHTML = `<div class="errs"><b>${errs.length} item(s) need attention before sign-off:</b><ul>${errs.slice(0, 12).map((e, i) => `<li><a href="#" data-goto="${i}">${esc(e.msg)}</a></li>`).join("")}${errs.length > 12 ? `<li>…and ${errs.length - 12} more</li>` : ""}</ul></div>`;
    $$("[data-goto]").forEach(a => a.onclick = ev => { ev.preventDefault(); $(errs[+a.dataset.goto].sel)?.scrollIntoView({ behavior: "smooth", block: "center" }); });
    $("#errs").scrollIntoView({ behavior: "smooth", block: "start" }); toast("Please complete the highlighted items"); return;
  }
  f.completed = Date.now(); if (!f.gps || f.gps.err) f.gps = lastGPS || f.gps;
  for (const k in f.sigs) if (!f.sigs[k].name) f.sigs[k].name = defaultSigName(f, k);
  if (fid === "rw") { job.status = f.v.outcome.startsWith("LOAD REFUSED") ? "refused" : "ls"; }
  if (fid === "ls") job.status = "cert";
  if (fid === "cert") job.status = "done";
  await save(job, true);
  toast(job.status === "refused" ? "Load refused – flow stopped" : "Signed off ✔");
  location.hash = `#/job/${encodeURIComponent(job.id)}`;
}

/* ---------- photos ---------- */
function compressPhoto(file, g) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      const MAX = 1280, s = Math.min(1, MAX / Math.max(im.width, im.height)), w = Math.round(im.width * s), h = Math.round(im.height * s);
      const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"); x.drawImage(im, 0, 0, w, h);
      const txt = `${fmtDT(Date.now())}${g && !g.err ? `  ${g.lat.toFixed(5)}, ${g.lng.toFixed(5)}` : ""}  ${cur.job?.rep || ""}`, fs = Math.max(14, Math.round(w / 45));
      x.font = `bold ${fs}px sans-serif`; x.fillStyle = "rgba(0,0,0,.55)"; x.fillRect(0, h - fs * 1.8, w, fs * 1.8); x.fillStyle = "#fff"; x.fillText(txt, fs * .5, h - fs * .6);
      URL.revokeObjectURL(url); res(c.toDataURL("image/jpeg", 0.72));
    };
    im.onerror = () => { URL.revokeObjectURL(url); rej(); }; im.src = url;
  });
}

/* ---------- signature pad ---------- */
function openSig(label, cb) {
  const m = $("#sigModal"), cv = $("#sigCanvas"); $("#sigTitle").textContent = label + " signature"; m.hidden = false;
  const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1; cv.width = r.width * dpr; cv.height = r.height * dpr;
  const x = cv.getContext("2d"); x.scale(dpr, dpr); x.lineWidth = 2.4; x.lineCap = x.lineJoin = "round"; x.strokeStyle = "#0a1f66";
  let drawing = false, has = false, last = null;
  const pos = e => { const b = cv.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
  cv.onpointerdown = e => { drawing = true; cv.setPointerCapture(e.pointerId); last = pos(e); x.beginPath(); x.arc(last[0], last[1], 1.1, 0, 7); x.fillStyle = x.strokeStyle; x.fill(); has = true; };
  cv.onpointermove = e => { if (!drawing) return; const p = pos(e); x.beginPath(); x.moveTo(...last); x.lineTo(...p); x.stroke(); last = p; has = true; };
  cv.onpointerup = cv.onpointercancel = () => drawing = false;
  const close = () => { m.hidden = true; cv.onpointerdown = cv.onpointermove = null; };
  $("#sigClear").onclick = () => { x.clearRect(0, 0, cv.width, cv.height); has = false; };
  $("#sigCancel").onclick = close;
  $("#sigSave").onclick = () => { if (!has) return toast("Please sign first"); cb(trimCanvas(cv)); close(); };
}
function trimCanvas(cv) {
  const x = cv.getContext("2d"), { width: w, height: h } = cv, d = x.getImageData(0, 0, w, h).data; let t = h, l = w, r = 0, b = 0;
  for (let y = 0; y < h; y++) for (let i = 0; i < w; i++) if (d[(y * w + i) * 4 + 3]) { if (y < t) t = y; if (y > b) b = y; if (i < l) l = i; if (i > r) r = i; }
  const p = 10, o = document.createElement("canvas"); l = Math.max(0, l - p); t = Math.max(0, t - p); r = Math.min(w, r + p); b = Math.min(h, b + p);
  o.width = r - l; o.height = b - t; const ox = o.getContext("2d"); ox.fillStyle = "#fff"; ox.fillRect(0, 0, o.width, o.height); ox.drawImage(cv, l, t, o.width, o.height, 0, 0, o.width, o.height);
  return o.toDataURL("image/png");
}

/* ---------- PDF export / share ---------- */
async function exportPDF(job, fids, share) {
  try {
    toast("Building PDF…");
    const blob = await buildPDF(job, fids);
    const name = `${job.rep}_${fids.length > 1 ? "Job" : FORMS[fids[0]].title.replace(/[^A-Za-z]+/g, "-")}.pdf`;
    const file = new File([blob], name, { type: "application/pdf" });
    if (share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: `IPS ${job.rep}`, text: `IPS Packaging – ${fids.map(f => FORMS[f].title).join(", ")} for ${job.rep}` }); return; }
      catch (e) { if (e.name === "AbortError") return; }
    }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000);
    if (share) { toast("Sharing not supported here – PDF downloaded. Attach it to your email.", 4000);
      setTimeout(() => location.href = `mailto:?subject=${encodeURIComponent("IPS " + job.rep + " – " + fids.map(f => FORMS[f].title).join(", "))}&body=${encodeURIComponent("Please find the attached PDF (" + name + ").\n\nInternational Packaging Solutions (PTY) Ltd\n082 450 5688 | ips-packaging.co.za")}`, 800); }
    else toast("PDF saved: " + name, 3000);
  } catch (e) { console.error(e); toast("PDF failed: " + e.message, 4000); }
}

/* ---------- boot ---------- */
function net() { const n = $("#netState"); n.textContent = navigator.onLine ? "" : "Offline"; n.className = "net" + (navigator.onLine ? "" : " off"); }
window.addEventListener("online", net); window.addEventListener("offline", net); net();
if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {});
if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
getGPS().then(g => lastGPS = g);
route();
