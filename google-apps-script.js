// Google Apps Script — MiniCRM MCP Lead + Email automatizáció
//
// Beállítás:
// 1. Nyisd meg a Google Sheet-et: https://docs.google.com/spreadsheets/d/1XdCVDlFX7d_rjRZkjc__-BLfpRjXKwJY-aUQG-U2y2A
// 2. Extensions → Apps Script
// 3. Töröld a meglévő kódot és illeszd be ezt az egészet
// 4. Deploy → New deployment → Web app (Execute as: Me, Who has access: Anyone)
// 5. Az URL-t írd be a landing page SHEET_WEBHOOK konstansba
// 6. Futtasd egyszer a setupExpiryTrigger() függvényt (Run gomb) → ez beállítja a napi lejárat-ellenőrzést
//
// Sheet fejléc (első sor):
// A1: Dátum | B1: Cégnév | C1: Név | D1: Telefon | E1: E-mail | F1: Felhasználók | G1: Licenckulcs | H1: Lejárat | I1: Email küldve | J1: Lejárati email

// ============================================================
// 1. Lead rögzítés + üdvözlő email
// ============================================================

function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = JSON.parse(e.postData.contents);

    var expiryDate = data.expiresAt ? new Date(data.expiresAt) : '';
    var expiryStr = expiryDate ? Utilities.formatDate(expiryDate, 'Europe/Budapest', 'yyyy. MM. dd.') : '';

    // Append lead row
    sheet.appendRow([
      Utilities.formatDate(new Date(), 'Europe/Budapest', 'yyyy. MM. dd. HH:mm'),
      data.company || '',
      data.name || '',
      data.phone || '',
      data.email || '',
      data.userCount || '',
      data.licenseKey || '',
      expiryStr,
      '',  // I: Email küldve
      ''   // J: Lejárati email
    ]);

    // Send welcome email
    if (data.email && data.licenseKey) {
      sendWelcomeEmail(data.email, data.name || '', data.licenseKey, expiryStr);
      // Mark email sent
      var lastRow = sheet.getLastRow();
      sheet.getRange(lastRow, 9).setValue('igen');
    }

    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================================
// 2. Üdvözlő email
// ============================================================

function sendWelcomeEmail(email, name, licenseKey, expiryDate) {
  var subject = 'MiniCRM MCP - Licenckulcs és beállítási útmutató';
  var greeting = name ? ('Kedves ' + name + '!') : 'Kedves Felhasználó!';

  var htmlBody = '<!DOCTYPE html>'
    + '<html><head><meta charset="utf-8"></head>'
    + '<body style="margin:0;padding:0;background:#f4f4f7;font-family:Arial,Helvetica,sans-serif;">'
    + '<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:32px 0;">'
    + '<tr><td align="center">'
    + '<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">'

    // Header
    + '<tr><td style="background:#0a0e17;padding:28px 40px;text-align:center;">'
    + '<span style="font-size:24px;font-weight:bold;color:#e2e8f0;">Mini</span>'
    + '<span style="font-size:24px;font-weight:bold;color:#4f7df5;">CRM</span>'
    + '<span style="font-size:24px;font-weight:bold;color:#e2e8f0;"> MCP</span>'
    + '</td></tr>'

    // Body
    + '<tr><td style="padding:36px 40px;">'
    + '<p style="font-size:16px;color:#333;margin:0 0 16px;">' + greeting + '</p>'
    + '<p style="font-size:15px;color:#555;line-height:1.6;margin:0 0 24px;">'
    + 'Köszönjük, hogy kipróbálja a MiniCRM MCP-t! Az alábbiakban megtalálja a próba licenckulcsát és a beállítási útmutatót.'
    + '</p>'

    // License key box
    + '<div style="background:#0a0e17;border:2px solid #3dd68c;border-radius:10px;padding:20px;text-align:center;margin:0 0 24px;">'
    + '<p style="font-size:12px;color:#8892a8;margin:0 0 8px;text-transform:uppercase;letter-spacing:1px;">Az Ön licenckulcsa</p>'
    + '<p style="font-size:18px;font-family:monospace;color:#3dd68c;margin:0;word-break:break-all;font-weight:bold;">'
    + licenseKey
    + '</p>'
    + '<p style="font-size:13px;color:#8892a8;margin:8px 0 0;">Érvényes: ' + expiryDate + '</p>'
    + '</div>'

    // Setup steps
    + '<h2 style="font-size:18px;color:#333;margin:0 0 16px;">Beállítás 5 egyszerű lépésben</h2>'

    + '<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">'

    + '<tr><td style="padding:10px 0;border-bottom:1px solid #eee;">'
    + '<table cellpadding="0" cellspacing="0"><tr>'
    + '<td style="width:32px;height:32px;background:#4f7df5;border-radius:50%;text-align:center;vertical-align:middle;color:#fff;font-weight:bold;font-size:14px;">1</td>'
    + '<td style="padding-left:12px;font-size:14px;color:#555;">Nyissa meg a <a href="https://minicrmmcp.netlify.app/setup" style="color:#4f7df5;font-weight:bold;">beállítási útmutatót</a> és másolja ki az MCP szerver URL-t</td>'
    + '</tr></table></td></tr>'

    + '<tr><td style="padding:10px 0;border-bottom:1px solid #eee;">'
    + '<table cellpadding="0" cellspacing="0"><tr>'
    + '<td style="width:32px;height:32px;background:#4f7df5;border-radius:50%;text-align:center;vertical-align:middle;color:#fff;font-weight:bold;font-size:14px;">2</td>'
    + '<td style="padding-left:12px;font-size:14px;color:#555;">Nyissa meg a <a href="https://claude.ai/settings/connectors?modal=add-custom-connector" style="color:#4f7df5;font-weight:bold;">Claude AI Connectors beállításokat</a> és illessze be az URL-t</td>'
    + '</tr></table></td></tr>'

    + '<tr><td style="padding:10px 0;border-bottom:1px solid #eee;">'
    + '<table cellpadding="0" cellspacing="0"><tr>'
    + '<td style="width:32px;height:32px;background:#4f7df5;border-radius:50%;text-align:center;vertical-align:middle;color:#fff;font-weight:bold;font-size:14px;">3</td>'
    + '<td style="padding-left:12px;font-size:14px;color:#555;">Kattintson a miniCRM melletti <strong>Connect</strong> gombra</td>'
    + '</tr></table></td></tr>'

    + '<tr><td style="padding:10px 0;border-bottom:1px solid #eee;">'
    + '<table cellpadding="0" cellspacing="0"><tr>'
    + '<td style="width:32px;height:32px;background:#4f7df5;border-radius:50%;text-align:center;vertical-align:middle;color:#fff;font-weight:bold;font-size:14px;">4</td>'
    + '<td style="padding-left:12px;font-size:14px;color:#555;">Adja meg a fenti <strong>licenckulcsot</strong>, a MiniCRM <strong>System ID</strong>-ját (a címsorból: r3.minicrm.hu/<strong>XXXXX</strong>/...) és az <strong>API kulcsát</strong> (Beállítások → Rendszer → API kulcs)</td>'
    + '</tr></table></td></tr>'

    + '<tr><td style="padding:10px 0;">'
    + '<table cellpadding="0" cellspacing="0"><tr>'
    + '<td style="width:32px;height:32px;background:#3dd68c;border-radius:50%;text-align:center;vertical-align:middle;color:#fff;font-weight:bold;font-size:14px;">5</td>'
    + '<td style="padding-left:12px;font-size:14px;color:#555;">Kész! Nyissa meg a <a href="https://claude.ai" style="color:#4f7df5;font-weight:bold;">claude.ai</a>-t és kezdje el használni a MiniCRM-et természetes nyelven.</td>'
    + '</tr></table></td></tr>'

    + '</table>'

    // Important note
    + '<div style="background:#fff8ee;border-left:4px solid #e8a040;border-radius:6px;padding:14px 18px;margin:0 0 24px;">'
    + '<p style="font-size:13px;color:#8a6d3b;margin:0;line-height:1.6;">'
    + '<strong>Fontos:</strong> A MiniCRM-ben aktív REST API + XML szinkronizáció modul szükséges (Beállítások → Előfizetés → Haladó integrációs csomag). E nélkül nem érhető el az API kulcs.'
    + '</p></div>'

    // CTA button
    + '<div style="text-align:center;margin:0 0 16px;">'
    + '<a href="https://minicrmmcp.netlify.app/setup" style="display:inline-block;padding:14px 36px;background:#4f7df5;color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:bold;">Részletes beállítási útmutató</a>'
    + '</div>'

    + '<p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 8px;">'
    + 'Ha bármilyen kérdése van, írjon nekünk az <a href="mailto:info@nexly.digital" style="color:#4f7df5;">info@nexly.digital</a> címre.'
    + '</p>'

    + '</td></tr>'

    // Footer
    + '<tr><td style="background:#f8f8fa;padding:20px 40px;border-top:1px solid #eee;text-align:center;">'
    + '<p style="font-size:12px;color:#999;margin:0 0 4px;">MiniCRM MCP - A Nexly Digital fejlesztése</p>'
    + '<a href="https://www.nexly.hu" style="font-size:12px;color:#4f7df5;">www.nexly.hu</a>'
    + '</td></tr>'

    + '</table></td></tr></table></body></html>';

  GmailApp.sendEmail(email, subject, '', {
    htmlBody: htmlBody,
    name: 'MiniCRM MCP'
  });
}

// ============================================================
// 3. Lejárati értesítő - napi trigger
// ============================================================

function setupExpiryTrigger() {
  // Először töröljük a meglévő triggereket (ha van)
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'checkExpiredLicenses') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  // Napi trigger reggel 9-kor
  ScriptApp.newTrigger('checkExpiredLicenses')
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .create();

  Logger.log('Lejárati ellenőrzés trigger beállítva (naponta 9:00).');
}

function checkExpiredLicenses() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = sheet.getDataRange().getValues();
  var today = new Date();
  today.setHours(0, 0, 0, 0);

  // Skip header row
  for (var i = 1; i < data.length; i++) {
    var expiryStr = data[i][7]; // H oszlop: Lejárat
    var email = data[i][4];     // E oszlop: E-mail
    var name = data[i][2];      // C oszlop: Név
    var licenseKey = data[i][6]; // G oszlop: Licenckulcs
    var expirySent = data[i][9]; // J oszlop: Lejárati email

    if (!expiryStr || !email || expirySent === 'igen') continue;

    // Parse Hungarian date format "2026. 04. 30."
    var expiryDate;
    try {
      var parts = expiryStr.toString().replace(/\./g, '').trim().split(/\s+/);
      if (parts.length >= 3) {
        expiryDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      }
    } catch(e) { continue; }

    if (!expiryDate || isNaN(expiryDate.getTime())) continue;

    expiryDate.setHours(0, 0, 0, 0);

    // Ha ma lejár vagy már lejárt
    if (expiryDate <= today) {
      sendExpiryEmail(email, name, licenseKey, expiryStr);
      sheet.getRange(i + 1, 10).setValue('igen'); // J oszlop: megjelölés
    }
  }
}

function sendExpiryEmail(email, name, licenseKey, expiryDate) {
  var subject = 'MiniCRM MCP - Próba licenc lejárt';
  var greeting = name ? ('Kedves ' + name + '!') : 'Kedves Felhasználó!';

  var htmlBody = '<!DOCTYPE html>'
    + '<html><head><meta charset="utf-8"></head>'
    + '<body style="margin:0;padding:0;background:#f4f4f7;font-family:Arial,Helvetica,sans-serif;">'
    + '<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:32px 0;">'
    + '<tr><td align="center">'
    + '<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">'

    // Header
    + '<tr><td style="background:#0a0e17;padding:28px 40px;text-align:center;">'
    + '<span style="font-size:24px;font-weight:bold;color:#e2e8f0;">Mini</span>'
    + '<span style="font-size:24px;font-weight:bold;color:#4f7df5;">CRM</span>'
    + '<span style="font-size:24px;font-weight:bold;color:#e2e8f0;"> MCP</span>'
    + '</td></tr>'

    // Body
    + '<tr><td style="padding:36px 40px;">'
    + '<p style="font-size:16px;color:#333;margin:0 0 16px;">' + greeting + '</p>'
    + '<p style="font-size:15px;color:#555;line-height:1.6;margin:0 0 24px;">'
    + 'Az ingyenes próba licenckulcsa (' + expiryDate + ') lejárt.'
    + '</p>'

    // Expired key box
    + '<div style="background:#f8f8fa;border:2px solid #ddd;border-radius:10px;padding:20px;text-align:center;margin:0 0 24px;">'
    + '<p style="font-size:12px;color:#999;margin:0 0 8px;text-transform:uppercase;letter-spacing:1px;">Lejárt licenckulcs</p>'
    + '<p style="font-size:16px;font-family:monospace;color:#999;margin:0;word-break:break-all;text-decoration:line-through;">'
    + licenseKey
    + '</p></div>'

    + '<p style="font-size:15px;color:#555;line-height:1.6;margin:0 0 24px;">'
    + 'Ha elégedett volt a szolgáltatással és szeretné tovább használni, szívesen segítünk az előfizetés beállításában.'
    + '</p>'

    // CTA
    + '<div style="text-align:center;margin:0 0 24px;">'
    + '<a href="mailto:info@nexly.digital?subject=MiniCRM%20MCP%20el%C5%91fizet%C3%A9s" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#c8702a,#e8a040);color:#0a0e17;text-decoration:none;border-radius:8px;font-size:15px;font-weight:bold;">Előfizetés igénylése</a>'
    + '</div>'

    + '<p style="font-size:14px;color:#555;line-height:1.6;margin:0;">'
    + 'Kérdés esetén írjon az <a href="mailto:info@nexly.digital" style="color:#4f7df5;">info@nexly.digital</a> címre.'
    + '</p>'
    + '</td></tr>'

    // Footer
    + '<tr><td style="background:#f8f8fa;padding:20px 40px;border-top:1px solid #eee;text-align:center;">'
    + '<p style="font-size:12px;color:#999;margin:0 0 4px;">MiniCRM MCP - A Nexly Digital fejlesztése</p>'
    + '<a href="https://www.nexly.hu" style="font-size:12px;color:#4f7df5;">www.nexly.hu</a>'
    + '</td></tr>'

    + '</table></td></tr></table></body></html>';

  GmailApp.sendEmail(email, subject, '', {
    htmlBody: htmlBody,
    name: 'MiniCRM MCP'
  });
}
