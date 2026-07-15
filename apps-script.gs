// =====================================================
// Wedding RSVP — Google Apps Script (Backend)
// =====================================================
// Cara setup:
// 1. Buka Google Sheets → create sheet baru, name "RSVP"
// 2. Extensions → Apps Script
// 3. Paste code ni
// 4. Deploy → New Deployment → Web App
//    - Execute as: Me
//    - Who has access: Anyone
// 5. Copy Web App URL → paste dalam index.html (RSVP_API_URL)
//
// Sheet columns auto-created:
// A: Timestamp | B: Nama | C: Phone | D: Attendance | E: Pax | F: Message
// =====================================================

function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('RSVP');
  
  // Parse form data
  const data = {};
  if (e.postData && e.postData.contents) {
    const params = e.postData.contents.split('&');
    params.forEach(param => {
      const [key, value] = param.split('=');
      data[decodeURIComponent(key)] = decodeURIComponent((value || '').replace(/\+/g, ' '));
    });
  }
  
  // Append row
  sheet.appendRow([
    data.timestamp || new Date().toISOString(),
    data.name || '',
    data.phone || '',
    data.attendance || '',
    data.pax || '1',
    data.message || ''
  ]);
  
  // Return success (CORS)
  return ContentService.createTextOutput(JSON.stringify({ success: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return ContentService.createTextOutput('RSVP API Ready ✅');
}

// =====================================================
// Optional: Get all RSVP data (for admin view)
// =====================================================
function getRSVPs() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('RSVP');
  const data = sheet.getDataRange().getValues();
  return JSON.stringify(data);
}
