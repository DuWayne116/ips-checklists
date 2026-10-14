"use strict";
/* PDF builder (jsPDF, bundled locally in lib/) */
let LOGO = null;
async function loadLogo() {
  if (LOGO) return LOGO;
  const b = await (await fetch("icons/logo.png")).blob();
  LOGO = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); });
  return LOGO;
}
const PS = s => String(s ?? "").replace(/[\u2013\u2014]/g, "-").replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/\u2026/g, "...").replace(/[^\x00-\xff]/g, "");
const RED = [236, 76, 76], GREY = [242, 242, 242], DARK = [40, 40, 40], MUT = [120, 120, 120];
async function buildPDF(job, fids) {
  const { jsPDF } = window.jspdf, doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const logo = await loadLogo(), W = 210, H = 297, M = 12, CW = W - 2 * M, BOT = H - 16;
  let y = M, first = true, certPages = new Set();
  const newPage = () => { doc.addPage(); y = M + 4; if (curFid === "cert") certPages.add(doc.getNumberOfPages()); };
  const need = h => { if (y + h > BOT) newPage(); };
  const txt = (s, x, yy, o = {}) => { doc.setFont("helvetica", o.b ? "bold" : o.i ? "italic" : "normal"); doc.setFontSize(o.sz || 9); doc.setTextColor(...(o.c || DARK)); doc.text(PS(s), x, yy, o.al ? { align: o.al } : undefined); };
  const wrap = (s, w, sz = 9, b) => { doc.setFont("helvetica", b ? "bold" : "normal"); doc.setFontSize(sz); return doc.splitTextToSize(PS(s), w); };
  const para = (s, o = {}) => { const L = wrap(s, CW - (o.indent || 0), o.sz || 8.5, o.b); const lh = (o.sz || 8.5) * 0.42; need(L.length * lh + 2);
    doc.setFont("helvetica", o.i ? "italic" : o.b ? "bold" : "normal"); doc.setTextColor(...(o.c || DARK)); doc.text(L, M + (o.indent || 0), y + lh); y += L.length * lh + 2.5; };
  const bar = t => { need(24); doc.setFillColor(...RED); doc.rect(M, y, CW, 6.5, "F"); txt(t, M + 2.5, y + 4.6, { b: 1, sz: 10, c: [255, 255, 255] }); y += 8.5; };
  const kv = (pairs) => { // 2 columns of label/value
    const cw = CW / 2;
    for (let i = 0; i < pairs.length; i += 2) {
      const row = pairs.slice(i, i + 2), hs = row.map(([l, v]) => Math.max(wrap(v || "-", cw - 35, 9).length * 4, wrap(l, 30, 7.5, 1).length * 3.3));
      const h = Math.max(...hs) + 3; need(h);
      row.forEach(([l, v], j) => { const x = M + j * cw; doc.setDrawColor(210); doc.setFillColor(...GREY); doc.rect(x, y, 32, h, "FD"); doc.rect(x + 32, y, cw - 32, h);
        const ll = wrap(l, 30, 7.5, 1); doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(...DARK); doc.text(ll, x + 1.5, y + 3.6);
        doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.text(wrap(v || "-", cw - 35, 9), x + 34, y + 4); });
      y += h;
    }
    y += 2;
  };
  const table = (cols, rows, o = {}) => { // cols:[{h,w,al}] rows:[[cells]] ; cell may be {t,c,b}
    const head = () => { need(7); let x = M; doc.setFillColor(...GREY); doc.setDrawColor(200); doc.rect(M, y, CW, 6, "FD");
      cols.forEach(c => { txt(c.h, x + 1.5, y + 4.2, { b: 1, sz: 7.5 }); x += c.w; }); y += 6; };
    head();
    rows.forEach(r => {
      const cells = r.map((c, j) => typeof c === "object" && c ? c : { t: c }), lines = cells.map((c, j) => wrap(c.t || "", cols[j].w - 3, 8.5, c.b));
      const h = Math.max(...lines.map(l => l.length)) * 3.7 + 2.6;
      if (y + h > BOT) { newPage(); head(); }
      let x = M; doc.setDrawColor(215); doc.rect(M, y, CW, h);
      cells.forEach((c, j) => { doc.setFont("helvetica", c.b ? "bold" : "normal"); doc.setFontSize(8.5); doc.setTextColor(...(c.c || DARK));
        doc.text(lines[j], x + 1.5, y + 3.9); x += cols[j].w; });
      y += h;
    });
    y += 2.5;
  };
  const stamp = f => { const s = [`Started: ${fmtDT(f.started)}`, f.completed ? `Signed off: ${fmtDT(f.completed)}` : "NOT SIGNED OFF (draft)", f.gps && !f.gps.err ? `GPS: ${f.gps.lat.toFixed(5)}, ${f.gps.lng.toFixed(5)} (+/-${Math.round(f.gps.acc)} m)` : "GPS: not available"].join("   |   ");
    txt(s, M, y + 3, { sz: 7.5, c: f.completed ? MUT : RED, b: !f.completed }); y += 6; };
  const header = (def, f) => {
    doc.addImage(logo, "PNG", M, y, 48, 48 * 371 / 1600);
    txt(def.title, W - M, y + 5, { b: 1, sz: 15, al: "right" });
    def.subtitle.split("\n").forEach((l, i) => txt(l, W - M, y + 10 + i * 4, { sz: 7.5, c: MUT, al: "right" }));
    y += 17; doc.setDrawColor(...RED); doc.setLineWidth(0.8); doc.line(M, y, W - M, y); doc.setLineWidth(0.2); y += 2; stamp(f);
  };
  const sigs = (f, roles, h = 34) => {
    const n = roles.length, w = (CW - (n - 1) * 3) / n; need(h + 2);
    roles.forEach((r, i) => { const s = f.sigs[r.k] || {}, x = M + i * (w + 3); doc.setDrawColor(200); doc.rect(x, y, w, h);
      doc.setFillColor(...GREY); doc.rect(x, y, w, 5.5, "F"); txt(r.label, x + 1.5, y + 3.9, { b: 1, sz: 8 });
      if (s.img) { const p = doc.getImageProperties(s.img), mh = h - 18.5, mw = w - 6, sc = Math.min(mw / p.width, mh / p.height); doc.addImage(s.img, "PNG", x + 3, y + 7, p.width * sc, p.height * sc); }
      txt(`Name: ${s.name || "-"}`, x + 1.5, y + h - 7, { sz: 8 }); txt(`Date/time: ${s.time ? fmtDT(s.time) : "-"}`, x + 1.5, y + h - 2.5, { sz: 7.5, c: MUT }); });
    y += h + 3;
  };
  const photos = (list, title) => {
    if (!list.length) return; need(8); txt(`${title} (${list.length})`, M, y + 3, { b: 1, sz: 8, c: MUT }); y += 5;
    const pw = (CW - 9) / 4;
    list.forEach((p, i) => { const pr = doc.getImageProperties(p.img), ph = pw * pr.height / pr.width; if (i % 4 === 0) { need(ph + 6); } const x = M + (i % 4) * (pw + 3);
      doc.addImage(p.img, "JPEG", x, y, pw, ph); txt(`${fmtDT(p.time)}${p.gps ? "  " + p.gps.lat.toFixed(4) + "," + p.gps.lng.toFixed(4) : ""}`, x, y + ph + 3, { sz: 6, c: MUT });
      if (i % 4 === 3 || i === list.length - 1) y += ph + 5.5; });
    y += 1;
  };
  const choiceVal = (f, fd) => { const v = f.v[fd.k]; let s = Array.isArray(v) ? v.join(", ") : v || ""; if (fd.other && s.includes("Other")) s = s.replace("Other", "Other: " + (f.v[fd.k + "_other"] || "")); return s; };
  let curFid = null;
  for (const fid of fids) {
    const def = FORMS[fid], f = job.forms[fid]; if (!f) continue; curFid = fid;
    if (!first) doc.addPage(); first = false; y = M;
    if (fid === "cert") { certPages.add(doc.getNumberOfPages()); renderCert(); continue; }
    header(def, f);
    if (def.notice) { const L = wrap(def.notice.html.replace(/<[^>]+>/g, ""), CW - 6, 8); const h = L.length * 3.5 + 4; need(h);
      doc.setDrawColor(...RED); doc.setFillColor(253, 234, 234); doc.rect(M, y, CW, h, "FD"); doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...DARK); doc.text(L, M + 3, y + 4); y += h + 3; }
    for (const sec of def.sections) {
      bar(sec.title);
      let pairs = [];
      const flush = () => { if (pairs.length) { kv(pairs); pairs = []; } };
      for (const fd of sec.fields) {
        if (fd.showIf && f.v[fd.showIf[0]] !== fd.showIf[1]) continue;
        if (fd.t === "text") { pairs.push([fd.label, f.v[fd.k]]); continue; }
        if (fd.t === "choice") { pairs.push([fd.label, choiceVal(f, fd)]); continue; }
        flush();
        if (fd.t === "note") para((fd.text || fd.html.replace(/<[^>]+>/g, "")), { i: fd.cls !== "small", sz: fd.cls === "small" ? 7 : 8, c: fd.cls === "small" ? MUT : DARK });
        else if (fd.t === "textarea") { para(fd.label + ":", { b: 1 }); para(f.v[fd.k] || "-", { indent: 2 }); }
        else if (fd.t === "checks") table([{ h: "#", w: 8 }, { h: "Check", w: 104 }, { h: fd.labels.join(" / "), w: 22 }, { h: "Comment", w: CW - 134 }],
          fd.items.map((it, i) => { const c = f.checks[`${sec.k}.${i}`] || {}; const lab = c.s != null ? fd.labels[c.s] : "-";
            return [String(i + 1), it, { t: lab, b: 1, c: c.s === 0 ? [31, 157, 85] : c.s === 1 ? RED : MUT }, c.c || ""]; }));
        else if (fd.t === "lashings") { const L = f.rows.lashings || [];
          table([{ h: "Lashing / restraint type", w: 60 }, { h: "Quantity", w: 25 }, { h: "WLL / LC each (daN)", w: 38 }, { h: "Total (daN)", w: 30 }, { h: "Condition OK", w: CW - 153 }],
            [...L.map(r => [r.other ? "Other: " + (r.type || "") : r.type, r.qty, r.wll, String((+r.qty || 0) * (+r.wll || 0)), r.ok]),
             [{ t: "TOTAL", b: 1 }, { t: String(L.reduce((a, r) => a + (+r.qty || 0), 0)), b: 1 }, "", { t: String(L.reduce((a, r) => a + (+r.qty || 0) * (+r.wll || 0), 0)), b: 1 }, ""]]); }
        else if (fd.t === "rows") { const R = f.rows[fd.k] || []; table(fd.cols.map((c, j) => ({ h: c.label, w: [90, 70, CW - 160][j] })), R.length ? R.map(r => fd.cols.map(c => r[c.k] || "")) : [["None recorded", "", ""]]); }
        else if (fd.t === "photocount") pairs.push(["No. of photos", String(Object.values(f.photos).reduce((a, p) => a + p.length, 0))]);
        else if (fd.t === "sigs") sigs(f, fd.roles);
      }
      flush();
      photos(f.photos[sec.k] || [], "Photos");
    }
  }
  function renderCert() {
    const f = job.forms.cert, v = f.v, def = FORMS.cert;
    y = 12; const lw = 58, lh = lw * 371 / 1600; doc.addImage(logo, "PNG", (W - lw) / 2, y, lw, lh); y += lh + 9;
    txt("LOAD SECURING CERTIFICATE", W / 2, y, { b: 1, sz: 20, al: "center" }); y += 6;
    txt(CO, W / 2, y, { sz: 9.5, c: [89, 89, 89], al: "center" }); y += 3; doc.setDrawColor(...RED); doc.setLineWidth(0.6); doc.line(M + 20, y, W - M - 20, y); doc.setLineWidth(0.2); y += 5;
    doc.setDrawColor(...RED); doc.setFillColor(253, 234, 234); doc.rect(M + 4, y, CW - 8, 9, "D");
    doc.rect(M + 4, y, 32, 9, "FD"); txt("Certificate no.", M + 6, y + 5.8, { b: 1, sz: 9.5 }); txt(v.cert_no, M + 39, y + 5.8, { sz: 10, b: 1 });
    doc.setFillColor(253, 234, 234); doc.rect(M + 100, y, 18, 9, "FD"); txt("Date", M + 102, y + 5.8, { b: 1, sz: 9.5 }); txt(v.date, M + 121, y + 5.8, { sz: 10 }); y += 14;
    para(def.sections[0].fields[2].html.replace(/<[^>]+>/g, ""), { sz: 9.5 }); y += 1;
    bar("Vehicle & load details");
    const fv = k => def.sections[1].fields.find(x => x.k === k);
    kv([["Vehicle reg.", v.vehicle_reg], ["Trailer reg. / type", v.trailer], ["Container no.", v.container_no], ["Seal no.", v.seal_no],
      ["Weight (kg)", v.weight], ["Weight source", v.weight_source], ["Restraint method", choiceVal(f, fv("method"))], ["Lashings (qty / WLL each)", v.lashings],
      ["Edge protectors used", v.edge], ["Checklist / REP no.", v.rep], ["Loading location", v.location], ["Date / time of departure", v.departure ? v.departure.replace("T", " ") : ""]]);
    para("Load description:", { b: 1, sz: 8.5 }); para(v.load_desc || "-", { indent: 2, sz: 9 });
    bar("Issued by IPS loadmaster"); sigs(f, [{ k: "loadmaster", label: "Loadmaster" }], 29);
    bar("Driver acknowledgement");
    para(def.sections[3].fields[0].text, { sz: 8.5 }); kv([["Driver licence no.", v.driver_licence], ["Driver name", f.sigs.driver?.name]]); sigs(f, [{ k: "driver", label: "Driver" }], 29);
    const dl = wrap(def.sections[4].fields[0].html.replace(/<[^>]+>/g, ""), CW - 6, 7); const dh = dl.length * 3 + 4; need(dh);
    doc.setFillColor(...GREY); doc.setDrawColor(191); doc.rect(M, y, CW, dh, "FD"); doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(...DARK); doc.text(dl, M + 3, y + 3.8); y += dh + 2; need(6);
    txt(`GPS at issue: ${f.gps && !f.gps.err ? f.gps.lat.toFixed(5) + ", " + f.gps.lng.toFixed(5) : "n/a"}   |   ${f.completed ? "Issued " + fmtDT(f.completed) : "DRAFT - not signed off"}`, M, y + 3, { sz: 7, c: f.completed ? MUT : RED });
  }
  // footers & certificate border
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    if (certPages.has(i)) { doc.setDrawColor(...RED); doc.setLineWidth(1.2); doc.rect(5, 5, W - 10, H - 10); doc.setLineWidth(0.2); }
    doc.setDrawColor(220); doc.line(M, H - 13, W - M, H - 13);
    txt(CO, M, H - 9, { b: 1, sz: 7.5, c: [89, 89, 89] }); txt(CONTACT, M, H - 5.5, { sz: 7, c: MUT });
    txt(`${job.rep}   |   Page ${i} of ${n}`, W - M, H - 9, { sz: 7.5, c: MUT, al: "right" });
  }
  doc.setProperties({ title: `IPS ${job.rep}`, author: CO, subject: fids.map(f => FORMS[f].title).join(", ") });
  return doc.output("blob");
}
