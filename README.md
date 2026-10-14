# IPS Digital Checklists (offline PWA)
Static app: serve the folder over HTTPS (or http://localhost) and open index.html; "Add to Home screen" to install.
Flow per job (auto REP no.): 1 Pre-Load Roadworthiness Check -> (LOAD REFUSED stops) -> 2 Load Securing Checklist -> 3 Load Securing Certificate (pre-filled).
Data is stored on the device (IndexedDB, localStorage fallback). Export PDFs to keep records.
Local test: `python3 -m http.server 8765` then `python3 tests-e2e.py` (Playwright).
Files: index.html, styles.css, forms.js (form content from the IPS Word templates), app.js, pdf.js, sw.js, lib/jspdf.umd.min.js (jsPDF 2.5.2, MIT).
