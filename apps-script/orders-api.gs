/**
 * Bahe Kurtiz – Orders API (Google Apps Script web app) · version 1
 *
 * Saves order STATUS + COURIER + TRACKING to your Google Sheet and answers with a real
 * success / error, so the owner dashboard can show exactly what happened.
 * Also answers the customer "Track your order" page (order number + last 4 phone digits)
 * and runs the on-site Help Center (tickets + replies in a "Help" tab of the same Sheet).
 *
 * It works next to your existing Sheet script – it does NOT replace it.
 * Setup (once): see apps-script/README.md (Hinglish steps).
 *
 * Script properties (Project Settings → Script properties):
 *   OWNER_KEY  – the same owner key you type in the dashboard (required)
 *   SHEET_ID   – the long id from your Google Sheet link: docs.google.com/spreadsheets/d/<SHEET_ID>/edit (required)
 *
 * No secrets live in this file. Safe to keep in the public repo.
 */
var VERSION = 2; // 2 = Help Center (Help tab)

// ---- courier → OFFICIAL tracking link (same list as the website dashboard). {n} = number in the link; without {n} = the courier's official tracking page ----
var COURIERS = {
  "ShipGlobal": "https://shipglobal.in/tracking/",
  "DTDC": "https://www.dtdc.com/",
  "Delhivery": "https://www.delhivery.com/track-v2/package/{n}",
  "Blue Dart": "https://www.bluedart.com/web/guest/trackdartresultthirdparty?trackFor=0&trackNo={n}",
  "India Post (Speed Post)": "https://www.indiapost.gov.in/",
  "Ecom Express": "https://www.ecomexpress.in/",
  "Xpressbees": "https://www.xpressbees.com/shipment/tracking?awbNo={n}",
  "Shiprocket": "https://shiprocket.co/tracking/{n}",
  "Ekart": "https://ekartlogistics.com/shipmenttrack/{n}",
  "DHL Express": "https://www.dhl.com/global-en/home/tracking/tracking-express.html?submit=1&tracking-id={n}",
  "FedEx": "https://www.fedex.com/fedextrack/?trknbr={n}",
  "UPS": "https://www.ups.com/track?tracknum={n}",
  "Aramex": "https://www.aramex.com/us/en/track/results?ShipmentNumber={n}",
  "USPS (USA)": "https://tools.usps.com/go/TrackConfirmAction?tLabels={n}",
  "Royal Mail (UK)": "https://www.royalmail.com/track-your-item#/tracking-results/{n}",
  "Parcelforce (UK)": "https://www.parcelforce.com/track-trace?trackNumber={n}",
  "Canada Post": "https://www.canadapost-postescanada.ca/track-reperage/en#/search?searchFor={n}",
  "Australia Post": "https://auspost.com.au/mypost/track/details/{n}",
  "Pos Malaysia": "https://www.pos.com.my/",
  "SingPost": "https://www.singpost.com/track-items",
  "Emirates Post": "https://www.emiratespost.ae/",
  "Japan Post": "https://trackings.post.japanpost.jp/services/srv/search/direct?searchKind=S004&locale=en&reqCodeNo1={n}",
  "Deutsche Post / DHL Paket": "https://www.dhl.de/en/privatkunden/pakete-empfangen/verfolgen.html?piececode={n}"
};
function trackingUrl(courier, num, given) {
  var t = COURIERS[courier];
  if (t && num) return t.indexOf('{n}') >= 0 ? t.replace('{n}', encodeURIComponent(num)) : t;
  given = String(given || '').trim();
  return /^https:\/\/[^\s"<>]+$/.test(given) ? given.slice(0, 300) : '';
}

// ---- helpers ----
function props() { return PropertiesService.getScriptProperties(); }
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function book() { var id = props().getProperty('SHEET_ID'); return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet(); }
function norm(h) { return String(h || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
function keyOk(k) { var want = String(props().getProperty('OWNER_KEY') || ''); return want.length > 0 && String(k || '') === want; }
var ALIAS = {
  ref: ['reforder', 'orderref', 'orderno', 'ordernumber', 'orderid', 'order', 'ref'],
  status: ['status', 'orderstatus'],
  phone: ['phone', 'mobile', 'whatsapp', 'phonenumber', 'contact'],
  email: ['email', 'emailid'],
  name: ['name', 'customer', 'customername', 'fullname'],
  day: ['day', 'date', 'orderdate', 'time', 'timestamp', 'created', 'ts'],
  courier: ['courier', 'couriercompany', 'carrier'],
  tracking: ['tracking', 'trackingnumber', 'trackingno', 'awb', 'awbno'],
  trackurl: ['trackinglink', 'trackingurl'],
  updated: ['statusupdated', 'updated', 'lastupdate', 'lastupdated'],
  shipcost: ['shipcost', 'shippingcost', 'shippingkharcha'],
  note: ['statusnote', 'note', 'notes'],
  payment: ['payment', 'paymentmethod', 'method', 'paidby'],
  country: ['country'],
  emails: ['customeremails', 'emailssent', 'emaillog']
};
var NEW_HEADERS = { courier: 'Courier', tracking: 'Tracking', trackurl: 'Tracking link', updated: 'Status updated', emails: 'Customer emails' };
function colOf(hdr, k) { var a = ALIAS[k]; for (var i = 0; i < a.length; i++) { var j = hdr.indexOf(a[i]); if (j >= 0) return j; } return -1; }

// Find the order: sheets called "Orders" first, then any tab with a Status column. Matches the ref column (or any cell) exactly.
function findOrder(ref) {
  ref = String(ref || '').trim(); if (!ref) return null;
  var sheets = book().getSheets().slice().sort(function (a, b) { return rank(a) - rank(b); });
  function rank(s) { var n = s.getName().toLowerCase(); return /^orders?$/.test(n) ? 0 : /order/.test(n) ? 1 : 2; }
  for (var s = 0; s < sheets.length; s++) {
    var sh = sheets[s], v = sh.getDataRange().getValues(); if (v.length < 2) continue;
    var hdr = v[0].map(norm), cS = colOf(hdr, 'status'); if (cS < 0) continue;
    var cR = colOf(hdr, 'ref'), rows = [];
    for (var r = 1; r < v.length; r++) {
      if (cR >= 0) { if (String(v[r][cR]).trim() === ref) rows.push(r + 1); }
      else if (v[r].some(function (x) { return String(x).trim() === ref; })) rows.push(r + 1);
    }
    if (rows.length) return { sh: sh, hdr: hdr, rows: rows };
  }
  return null;
}
function ensureCol(f, k) {
  var c = colOf(f.hdr, k); if (c >= 0) return c;
  var last = f.sh.getLastColumn(); f.sh.getRange(1, last + 1).setValue(NEW_HEADERS[k] || k);
  f.hdr.push(norm(NEW_HEADERS[k] || k)); return last;
}
function fmt(v) { if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone() || 'Asia/Kolkata', 'd MMM yyyy, HH:mm'); return String(v === null || v === undefined ? '' : v); }
function read(f) {
  var row = f.rows[f.rows.length - 1], vals = f.sh.getRange(row, 1, 1, f.sh.getLastColumn()).getValues()[0];
  var g = function (k) { var c = colOf(f.hdr, k); return c >= 0 ? fmt(vals[c]) : ''; };
  return { ref: g('ref'), status: g('status'), courier: g('courier'), tracking: g('tracking'), tracking_url: g('trackurl'), updated: g('updated'), day: g('day'), name: g('name'), email: g('email'), phone: g('phone'), note: g('note'), payment: g('payment'), country: g('country'), emails: g('emails'), tab: f.sh.getName(), row: row };
}

// ---- web app ----
function doGet(e) {
  var p = (e && e.parameter) || {}, a = String(p.action || 'ping');
  try {
    if (a === 'ping') return out({ ok: true, app: 'bk-orders-api', version: VERSION, owner_key_set: !!props().getProperty('OWNER_KEY'), sheet_id_set: !!props().getProperty('SHEET_ID') });
    if (a === 'get') {
      if (!keyOk(p.key)) return out({ ok: false, error: 'key' });
      var f = findOrder(p.ref); if (!f) return out({ ok: false, error: 'not_found', ref: p.ref });
      return out({ ok: true, order: read(f) });
    }
    if (a === 'meta') {
      if (!keyOk(p.key)) return out({ ok: false, error: 'key' });
      var sheets = book().getSheets(), res = {};
      for (var s1 = 0; s1 < sheets.length; s1++) {
        var v = sheets[s1].getDataRange().getValues(); if (v.length < 2) continue; var h = v[0].map(norm);
        var cR = colOf(h, 'ref'), cS = colOf(h, 'status'); if (cR < 0 || cS < 0 || !/order/i.test(sheets[s1].getName())) continue;
        var cC = colOf(h, 'courier'), cT = colOf(h, 'tracking'), cU = colOf(h, 'trackurl'), cE = colOf(h, 'emails');
        for (var r1 = 1; r1 < v.length; r1++) { var ref1 = String(v[r1][cR]).trim(); if (!ref1) continue; res[ref1] = { status: String(v[r1][cS]), courier: cC >= 0 ? String(v[r1][cC]) : '', tracking: cT >= 0 ? String(v[r1][cT]) : '', tracking_url: cU >= 0 ? String(v[r1][cU]) : '', emails: cE >= 0 ? String(v[r1][cE]) : '' }; }
      }
      return out({ ok: true, orders: res });
    }
    if (a === 'track') {
      var f2 = findOrder(String(p.ref || '').toUpperCase()); if (!f2) return out({ ok: false, error: 'not_found' });
      var o = read(f2), ph = String(o.phone).replace(/\D/g, ''), last4 = String(p.ph || '').replace(/\D/g, '').slice(-4);
      if (!last4 || last4.length < 4 || ph.slice(-4) !== last4) return out({ ok: false, error: 'not_found' });
      return out({ ok: true, ref: o.ref, status: o.status, courier: o.courier, tracking: o.tracking, tracking_url: o.tracking_url, updated: o.updated, day: o.day, note: o.note });
    }
    return out({ ok: false, error: 'action' });
  } catch (err) { return out({ ok: false, error: 'server', detail: String(err).slice(0, 200) }); }
}


// =====================================================================================
// HELP CENTER – tickets in the "Help" tab. Thread = JSON list of messages in one cell.
// Customers prove who they are with order number + email (or the last 4 phone digits);
// questions without an order need name + email. Emails are sent by the website (Brevo).
// =====================================================================================
var HELP_HEAD = ['Ticket', 'Created', 'Updated', 'Status', 'Order', 'Name', 'Email', 'Phone', 'Reason', 'Unread', 'Last by', 'Thread'];
var REASONS = ['Where is my order?', 'Size or fit', 'Change address', 'Wrong or damaged item', 'Return / exchange', 'Payment', 'Other', 'General question'];
function helpSheet() { var b = book(), sh = b.getSheetByName('Help'); if (!sh) { sh = b.insertSheet('Help'); sh.appendRow(HELP_HEAD); } return sh; }
function tObj(r, row, forCustomer) {
  var th = []; try { th = JSON.parse(r[11] || '[]'); } catch (x) {}
  if (forCustomer) th = th.map(function (m) { return { by: m.by, at: m.at, text: m.text, photo: !!m.photo }; });
  return { ticket: String(r[0]), ts: (r[2] instanceof Date ? r[2].getTime() : Date.parse(r[2]) || 0), created: fmt(r[1]), updated: fmt(r[2]), status: String(r[3]), ref: String(r[4]), name: String(r[5]), email: String(r[6]), phone: forCustomer ? '' : String(r[7]), reason: String(r[8]), unread: String(r[9]) === 'Y', last_by: String(r[10]), thread: th, row: row };
}
function findTicket(id) {
  id = String(id || '').trim().toUpperCase(); if (!id) return null;
  var sh = helpSheet(), v = sh.getDataRange().getValues();
  for (var r = 1; r < v.length; r++) if (String(v[r][0]).toUpperCase() === id) return { sh: sh, row: r + 1, vals: v[r] };
  return null;
}
function saveTicket(t, vals) { t.sh.getRange(t.row, 1, 1, HELP_HEAD.length).setValues([vals]); t.vals = vals; }
function maskEmail(e) { var p = String(e || '').split('@'); return p.length === 2 ? p[0].slice(0, 2) + '•••@' + p[1] : ''; }
function samePhone(a, b) { a = String(a || '').replace(/\D/g, ''); b = String(b || '').replace(/\D/g, '').slice(-4); return b.length === 4 && a.slice(-4) === b; }
function sameEmail(a, b) { a = String(a || '').trim().toLowerCase(); b = String(b || '').trim().toLowerCase(); return a.length > 3 && a === b; }
function clean(s, n) { return String(s || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, n); }
function orderFor(ref, email, phone) {
  var f = findOrder(String(ref || '').trim().toUpperCase()); if (!f) return null;
  var o = read(f), ph4 = String(phone || '').replace(/\D/g, '').slice(-4);
  if (sameEmail(o.email, email) || (ph4.length === 4 && String(o.phone).replace(/\D/g, '').slice(-4) === ph4)) return o;
  return null;
}
function newTicketId() { var d = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyMMdd'); for (var i = 0; i < 20; i++) { var id = 'H' + d + '-' + (1000 + Math.floor(Math.random() * 9000)); if (!findTicket(id)) return id; } return 'H' + d + '-' + Date.now(); }
function photoFolder() { var it = DriveApp.getFoldersByName('Bahe Help photos'); return it.hasNext() ? it.next() : DriveApp.createFolder('Bahe Help photos'); }
function savePhoto(dataUrl, ticket) {
  var m = String(dataUrl || '').match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+\/=]+)$/); if (!m || m[2].length > 4000000) return '';
  try { var blob = Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], ticket + '-' + Date.now() + '.' + m[1].split('/')[1]); return photoFolder().createFile(blob).getUrl(); } catch (x) { return ''; }
}
function rateOk(k, max) { var c = CacheService.getScriptCache(), n = Number(c.get(k) || 0); if (n >= max) return false; c.put(k, String(n + 1), 3600); return true; }
function orderCard(o) { return o ? { ref: o.ref, status: o.status, courier: o.courier, tracking: o.tracking, tracking_url: o.tracking_url, updated: o.updated, day: o.day } : null; }
function ticketsFor(ref, email) {
  var v = helpSheet().getDataRange().getValues(), out = [];
  for (var r = 1; r < v.length; r++) if ((ref && String(v[r][4]).toUpperCase() === String(ref).toUpperCase()) || (!ref && sameEmail(v[r][6], email))) if (sameEmail(v[r][6], email) || ref) out.push({ ticket: String(v[r][0]), status: String(v[r][3]), reason: String(v[r][8]), updated: fmt(v[r][2]) });
  return out.reverse();
}

function help(b) {
  var a = String(b.action), now = new Date();
  if (a === 'help_order') { // customer: find my order (order no. + email or phone)
    var o = orderFor(b.ref, b.email, b.phone); if (!o) return { ok: false, error: 'order_not_found' };
    return { ok: true, order: orderCard(o), email: maskEmail(o.email), tickets: ticketsFor(o.ref, o.email) };
  }
  if (a === 'help_create') {
    if (b.hp) return { ok: true, ticket: 'H000000-0000' }; // honeypot – bots get a fake success
    var reason = REASONS.indexOf(b.reason) >= 0 ? b.reason : 'Other', msg = clean(b.message, 3000), email = clean(b.email, 120), name = clean(b.name, 80), ref = clean(b.ref, 30).toUpperCase(), phone = clean(b.phone, 30), o = null;
    if (msg.length < 3) return { ok: false, error: 'no_message' };
    if (ref) { o = orderFor(ref, email, phone); if (!o) return { ok: false, error: 'order_not_found' }; email = o.email || email; name = name || o.name; phone = o.phone || phone; }
    else { reason = 'General question'; if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, error: 'name_email_required' }; }
    if (!rateOk('h:' + String(email || phone).toLowerCase(), 6)) return { ok: false, error: 'too_many' };
    var id = newTicketId(), photo = b.photo ? savePhoto(b.photo, id) : '';
    var th = [{ by: 'customer', at: now.toISOString(), text: msg, photo: photo }];
    helpSheet().appendRow([id, now, now, 'Open', ref, name, email, "'" + phone, reason, 'Y', 'customer', JSON.stringify(th)]);
    var t = findTicket(id); return { ok: true, ticket: id, data: tObj(t.vals, t.row, false), order: orderCard(o) };
  }
  if (a === 'help_view' || a === 'help_reply_customer') { // customer: ticket id + email
    var t2 = findTicket(b.ticket); if (!t2 || !(sameEmail(t2.vals[6], b.email) || samePhone(t2.vals[7], b.phone))) return { ok: false, error: 'ticket_not_found' };
    if (a === 'help_reply_customer') {
      var m2 = clean(b.message, 3000); if (m2.length < 2) return { ok: false, error: 'no_message' };
      if (!rateOk('hr:' + String(b.ticket), 20)) return { ok: false, error: 'too_many' };
      var th2 = []; try { th2 = JSON.parse(t2.vals[11] || '[]'); } catch (x) {}
      th2.push({ by: 'customer', at: now.toISOString(), text: m2, photo: b.photo ? savePhoto(b.photo, t2.vals[0]) : '' });
      var v2 = t2.vals.slice(); v2[2] = now; v2[3] = 'Open'; v2[9] = 'Y'; v2[10] = 'customer'; v2[11] = JSON.stringify(th2); saveTicket(t2, v2);
    }
    var o2 = t2.vals[4] ? (function () { var f = findOrder(String(t2.vals[4])); return f ? read(f) : null; })() : null;
    return { ok: true, data: tObj(t2.vals, t2.row, a === 'help_view'), order: orderCard(o2) };
  }
  // ---- owner actions (OWNER_KEY) ----
  if (!keyOk(b.key)) return { ok: false, error: 'key' };
  if (a === 'help_list') {
    var v3 = helpSheet().getDataRange().getValues(), list = [];
    for (var r = 1; r < v3.length; r++) if (v3[r][0]) list.push(tObj(v3[r], r + 1, false));
    list.sort(function (x, y) { return y.ts - x.ts; });
    return { ok: true, tickets: list };
  }
  var t3 = findTicket(b.ticket); if (!t3) return { ok: false, error: 'ticket_not_found' };
  var v4 = t3.vals.slice();
  if (a === 'help_get_owner') return { ok: true, data: tObj(v4, t3.row, false) };
  if (a === 'help_read') { v4[9] = 'N'; saveTicket(t3, v4); return { ok: true, data: tObj(v4, t3.row, false) }; }
  if (a === 'help_status') { var st = ['Open', 'Waiting', 'Closed'].indexOf(b.status) >= 0 ? b.status : ''; if (!st) return { ok: false, error: 'status' }; v4[3] = st; v4[2] = now; v4[9] = 'N'; saveTicket(t3, v4); return { ok: true, data: tObj(v4, t3.row, false) }; }
  if (a === 'help_reply_owner') {
    var m4 = clean(b.message, 3000); if (m4.length < 1) return { ok: false, error: 'no_message' };
    var th4 = []; try { th4 = JSON.parse(v4[11] || '[]'); } catch (x) {}
    th4.push({ by: 'owner', at: now.toISOString(), text: m4 });
    v4[2] = now; v4[3] = b.close ? 'Closed' : 'Waiting'; v4[9] = 'N'; v4[10] = 'owner'; v4[11] = JSON.stringify(th4); saveTicket(t3, v4);
    return { ok: true, data: tObj(v4, t3.row, false) };
  }
  return { ok: false, error: 'action' };
}

function doPost(e) {
  var b = {}; try { b = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (x) { return out({ ok: false, error: 'bad_json' }); }
  var a = String(b.action || b.type || '');
  if (a.indexOf('help_') === 0) {
    var lk = LockService.getScriptLock(); try { lk.waitLock(15000); } catch (x) { return out({ ok: false, error: 'busy' }); }
    try { return out(help(b)); } catch (err) { return out({ ok: false, error: 'server', detail: String(err).slice(0, 200) }); } finally { try { lk.releaseLock(); } catch (x) {} }
  }
  if (a === 'email_log') {
    if (!keyOk(b.key)) return out({ ok: false, error: 'key' });
    var fl = findOrder(b.ref); if (!fl) return out({ ok: false, error: 'not_found' });
    var cE2 = ensureCol(fl, 'emails'), stamp = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'd MMM HH:mm');
    var item = clean(b.status, 20) + (b.ok ? ' ✓ ' : ' ✗ ') + stamp + (b.ok ? '' : ' (' + clean(b.error, 30) + ')');
    fl.rows.forEach(function (row) { var c = fl.sh.getRange(row, cE2 + 1), prev = String(c.getValue() || ''); c.setValue((prev ? prev + ' | ' : '') + item); });
    return out({ ok: true });
  }
  if (a !== 'status') return out({ ok: false, error: 'action' });
  if (!keyOk(b.key)) return out({ ok: false, error: 'key' });
  var lock = LockService.getScriptLock(); try { lock.waitLock(15000); } catch (x) { return out({ ok: false, error: 'busy' }); }
  try {
    var ref = String(b.ref || b.ref_order || '').trim(), st = String(b.status || '').trim().slice(0, 40);
    if (!ref) return out({ ok: false, error: 'no_ref' });
    if (!st) return out({ ok: false, error: 'no_status' });
    var courier = String(b.courier || '').trim().slice(0, 60), num = String(b.tracking || '').trim().slice(0, 60);
    if (/^shipped$/i.test(st) && (!courier || !num)) return out({ ok: false, error: 'courier_tracking_required' });
    var f = findOrder(ref); if (!f) return out({ ok: false, error: 'not_found', ref: ref });
    var cS = colOf(f.hdr, 'status'), set = {}; set[cS] = st;
    if (courier || num) { set[ensureCol(f, 'courier')] = courier; set[ensureCol(f, 'tracking')] = num; set[ensureCol(f, 'trackurl')] = trackingUrl(courier, num, b.tracking_url); }
    set[ensureCol(f, 'updated')] = new Date();
    var cShip = colOf(f.hdr, 'shipcost'); if (cShip >= 0 && b.ship_cost !== undefined && String(b.ship_cost) !== '') set[cShip] = Number(b.ship_cost) || 0;
    var cNote = colOf(f.hdr, 'note'); if (cNote >= 0 && b.note) set[cNote] = String(b.note).slice(0, 300);
    f.rows.forEach(function (row) { Object.keys(set).forEach(function (c) { f.sh.getRange(row, Number(c) + 1).setValue(set[c]); }); });
    SpreadsheetApp.flush();
    var o = read(f); // read back what is really in the sheet now
    return out({ ok: o.status === st, order: o, error: o.status === st ? undefined : 'not_saved' });
  } catch (err) { return out({ ok: false, error: 'server', detail: String(err).slice(0, 200) }); }
  finally { try { lock.releaseLock(); } catch (x) {} }
}
