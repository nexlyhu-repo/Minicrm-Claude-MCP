// Google Apps Script — ezt a kódot kell beilleszteni a Google Sheet-hez tartozó Apps Script-be.
//
// Beállítás:
// 1. Nyisd meg a Google Sheet-et: https://docs.google.com/spreadsheets/d/1XdCVDlFX7d_rjRZkjc__-BLfpRjXKwJY-aUQG-U2y2A
// 2. Extensions → Apps Script
// 3. Töröld a meglévő kódot és illeszd be ezt az egészet
// 4. Deploy → New deployment → Web app
//    - Execute as: Me
//    - Who has access: Anyone
// 5. Másold ki a Web app URL-t és írd be a landing page SHEET_WEBHOOK konstansba
//
// A Sheet első sorába (fejléc) írd be:
// A1: Dátum | B1: Cégnév | C1: Név | D1: Telefon | E1: E-mail | F1: Felhasználók | G1: Licenckulcs | H1: Lejárat

function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = JSON.parse(e.postData.contents);

    sheet.appendRow([
      new Date().toLocaleString('hu-HU'),
      data.company || '',
      data.name || '',
      data.phone || '',
      data.email || '',
      data.userCount || '',
      data.licenseKey || '',
      data.expiresAt ? new Date(data.expiresAt).toLocaleString('hu-HU') : ''
    ]);

    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
