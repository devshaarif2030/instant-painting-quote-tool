/**
 * Painting Instant Quote: lead backend (Google Apps Script).
 *
 * What it does
 *  - doPost: receives a lead from the Next.js app, adds a row to the "Quotes" sheet,
 *    emails the homeowner their PDF quote and sends you a new-lead alert.
 *  - followUps (hourly trigger): day 2 "any questions?" and day 5 "book your site visit"
 *    emails. Stops when the homeowner replies or you set Status to Booked / Lost.
 *
 * Setup (once)
 *  1. Create a Google Sheet. Extensions > Apps Script. Paste this file.
 *  2. Project Settings > Script Properties, add:
 *       LEAD_SECRET   a long random string (same value as LEAD_SECRET in Vercel)
 *       OWNER_EMAIL   where new-lead alerts go
 *       COMPANY_NAME  optional, defaults to "Northfield Painting"
 *       FOLLOWUPS     optional, set to "on" to send day 2 / day 5 follow-ups (off by default,
 *                     so a public demo never sends repeat emails to strangers)
 *  3. Run setup() once and accept the permissions. It creates the sheet and the trigger.
 *  4. Deploy > New deployment > Web app. Execute as: Me. Who has access: Anyone.
 *     Copy the /exec URL into APPS_SCRIPT_URL in Vercel.
 *
 * Demo safety: addresses ending in @example.com are logged but never emailed.
 */

var SHEET = "Quotes";
var HEADERS = [
  "Created", "Quote ID", "Name", "Email", "Phone", "ZIP", "State", "Rooms", "Rooms detail",
  "Low", "High", "Estimate", "Hours", "Crew", "Days", "Timeline", "Score",
  "Status", "Follow-ups sent", "Last contacted", "Notes"
];
var COL = {};
HEADERS.forEach(function (h, i) { COL[h] = i + 1; });

function props_() { return PropertiesService.getScriptProperties(); }
function company_() { return props_().getProperty("COMPANY_NAME") || "Northfield Painting"; }
function isDemoAddress_(email) { return /@example\.com$/i.test(String(email || "")); }
function money_(n) { return "$" + Number(n).toLocaleString("en-US"); }
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET) || ss.insertSheet(SHEET);
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
  }
  return sh;
}

function setup() {
  sheet_();
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "followUps") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("followUps").timeBased().everyHours(1).create();
  if (!props_().getProperty("LEAD_SECRET")) throw new Error("Add LEAD_SECRET in Script Properties.");
  if (!props_().getProperty("OWNER_EMAIL")) throw new Error("Add OWNER_EMAIL in Script Properties.");
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var d = JSON.parse(e.postData.contents);
    if (!d || d.secret !== props_().getProperty("LEAD_SECRET")) return json_({ ok: false, error: "unauthorized" });

    lock.waitLock(10000);
    var sh = sheet_();
    sh.appendRow([
      new Date(d.createdAt), d.quoteId, d.name, d.email, d.phone, d.zip, d.state, d.rooms, d.roomsSummary,
      d.low, d.high, d.total, d.hours, d.crew, d.days, d.timeline, d.score,
      "Quoted", 0, new Date(), ""
    ]);
    lock.releaseLock();

    var pdf = Utilities.newBlob(Utilities.base64Decode(d.pdfBase64), "application/pdf", d.quoteId + ".pdf");
    var emailed = Boolean(d.homeownerEmailed);
    // If the app sends the homeowner email itself (SMTP on your domain), skip it here.
    if (!d.homeownerHandled && !isDemoAddress_(d.email)) {
      GmailApp.sendEmail(d.email, "Your painting quote " + d.quoteId + " from " + company_(), quoteText_(d), {
        htmlBody: quoteHtml_(d),
        attachments: [pdf],
        name: company_()
      });
      emailed = true;
    }

    var owner = props_().getProperty("OWNER_EMAIL");
    if (owner) {
      GmailApp.sendEmail(
        owner,
        "[" + String(d.score).toUpperCase() + "] New quote " + d.quoteId + ": " + money_(d.low) + " to " + money_(d.high),
        [
          "Name: " + d.name, "Email: " + d.email, "Phone: " + (d.phone || "-"),
          "ZIP: " + d.zip + " " + d.state, "Rooms: " + d.rooms + " (" + d.roomsSummary + ")",
          "Range: " + money_(d.low) + " to " + money_(d.high) + " (estimate " + money_(d.total) + ")",
          "Labour: " + d.hours + " hrs, " + d.crew + " painter(s), " + d.days + " day(s)",
          "Timeline: " + d.timeline, "Score: " + d.score,
          "", "Homeowner emailed: " + (emailed ? "yes" : "no")
        ].join("\n"),
        { attachments: [pdf], name: "Quote tool" }
      );
    }
    return json_({ ok: true, emailed: emailed });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

function quoteText_(d) {
  return [
    "Hi " + firstName_(d.name) + ",",
    "",
    "Thanks for using our instant quote. Your estimate for " + d.rooms + " room(s) is " +
      money_(d.low) + " to " + money_(d.high) + ".",
    "That is about " + d.hours + " labour hours, " + d.crew + " painter(s), " + d.days + " day(s) on site.",
    "",
    "The full breakdown is attached as a PDF (quote " + d.quoteId + ", valid 30 days).",
    "The final price is confirmed at a free site visit. Just reply to this email to book one.",
    "",
    company_(),
    "",
    "--",
    "This is a demo quote tool built by devshaarif.com. " + company_() + " is a fictional company and the prices are demo rates."
  ].join("\n");
}

function quoteHtml_(d) {
  return '<div style="font-family:Arial,sans-serif;color:#18181b;max-width:520px;line-height:1.5">' +
    "<p>Hi " + esc_(firstName_(d.name)) + ",</p>" +
    "<p>Thanks for using our instant quote. Your estimate for " + d.rooms + " room(s):</p>" +
    '<p style="font-size:26px;font-weight:bold;margin:8px 0">' + money_(d.low) + " to " + money_(d.high) + "</p>" +
    '<p style="color:#71717a;margin-top:0">About ' + d.hours + " labour hours, " + d.crew + " painter(s), " + d.days + " day(s) on site.</p>" +
    "<p>The full breakdown is attached as a PDF (quote <b>" + esc_(d.quoteId) + "</b>, valid 30 days).</p>" +
    "<p>The final price is confirmed at a free site visit. Just reply to this email to book one.</p>" +
    "<p>" + esc_(company_()) + "</p>" +
    '<hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0 12px">' +
    '<p style="font-size:12px;color:#71717a">This is a demo quote tool built by devshaarif.com. ' +
    esc_(company_()) + " is a fictional company and the prices are demo rates.</p></div>";
}

function followUps() {
  if (props_().getProperty("FOLLOWUPS") !== "on") return;
  var sh = sheet_();
  var rows = sh.getDataRange().getValues();
  var now = new Date();
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    var status = r[COL["Status"] - 1];
    var sent = Number(r[COL["Follow-ups sent"] - 1]) || 0;
    var email = r[COL["Email"] - 1];
    var created = new Date(r[COL["Created"] - 1]);
    if (status !== "Quoted" || sent >= 2 || isDemoAddress_(email)) continue;

    if (hasReplied_(email, created)) {
      sh.getRange(i + 1, COL["Status"]).setValue("Replied");
      continue;
    }
    var days = (now - created) / 86400000;
    var due = (sent === 0 && days >= 2) || (sent === 1 && days >= 5);
    if (!due) continue;

    var name = firstName_(r[COL["Name"] - 1]);
    var id = r[COL["Quote ID"] - 1];
    var subject, body;
    if (sent === 0) {
      subject = "Any questions about quote " + id + "?";
      body = "Hi " + name + ",\n\nJust checking you got your painting quote (" + id + "). " +
        "Happy to answer anything about colours, timing or what is included.\n\n" + company_();
    } else {
      subject = "Book your free site visit (quote " + id + ")";
      body = "Hi " + name + ",\n\nIf you would like to go ahead, reply with two times that suit you " +
        "and we will confirm the final price on site. No obligation.\n\nThis is our last follow-up.\n\n" + company_();
    }
    GmailApp.sendEmail(email, subject, body, { name: company_() });
    sh.getRange(i + 1, COL["Follow-ups sent"]).setValue(sent + 1);
    sh.getRange(i + 1, COL["Last contacted"]).setValue(now);
  }
}

function hasReplied_(email, since) {
  var after = Utilities.formatDate(since, "UTC", "yyyy/MM/dd");
  return GmailApp.search("from:" + email + " after:" + after, 0, 1).length > 0;
}

function firstName_(name) { return String(name || "there").trim().split(/\s+/)[0]; }
function esc_(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}
