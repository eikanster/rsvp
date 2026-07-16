// =====================================================
// Wedding RSVP — Google Apps Script Backend
// =====================================================
// Setup:
// 1. Buka sheets.google.com → create sheet → name "RSVP"
// 2. Extensions → Apps Script → paste code ni
// 3. Deploy → New Deployment → Web App
//    - Execute as: Me
//    - Who has access: Anyone
// 4. Copy URL → paste dalam index.html (RSVP_API_URL)
//
// Sheet columns (auto):
// A: Timestamp | B: Nama | C: Phone | D: Attendance | E: Pax | F: Message
//
// Secret key untuk elak spam:
// - Sama dengan RSVP_SECRET dalam index.html
// - Tukar kedua-dua sekali gus
// =====================================================

const SECRET = 'rsvp2026';  // ← TUKAR untuk security
const SHEET_NAME = 'RSVP';

function doPost(e) {
  // Parse form data
  const data = parseFormData(e);
  
  // 🔐 Secret key check — reject without valid secret
  if (data.secret !== SECRET) {
    return respond({ error: 'Unauthorized', success: false }, 403);
  }
  
  // Validate required fields
  if (!data.name || !data.phone || !data.attendance) {
    return respond({ error: 'Missing required fields' }, 400);
  }
  
  // Open sheet
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  
  // Create sheet if doesn't exist
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['Timestamp', 'Nama', 'Phone', 'Kehadiran', 'Pax', 'Ucapan']);
    sheet.getRange(1, 1, 1, 6).setFontWeight('bold').setBackground('#0d5e4a').setFontColor('#ffffff');
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
  
  return respond({ success: true, name: data.name });
}

// =====================================================
// Helper functions
// =====================================================
function parseFormData(e) {
  const data = {};
  if (e.postData && e.postData.contents) {
    try {
      // Try JSON first
      data = JSON.parse(e.postData.contents);
      return data;
    } catch (_) {
      // Fall back to URL-encoded
      const params = e.postData.contents.split('&');
      params.forEach(param => {
        const idx = param.indexOf('=');
        if (idx > -1) {
          const key = decodeURIComponent(param.substring(0, idx));
          const value = decodeURIComponent((param.substring(idx + 1) || '').replace(/\+/g, ' '));
          data[key] = value;
        }
      });
    }
  }
  return data;
}

function respond(body, status = 200) {
  return ContentService.createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return respond({ status: 'RSVP API Ready ✅', version: '1.0' });
}

// =====================================================
// Admin: Get all RSVPs (optional utility)
// =====================================================
function getRSVPs() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  return JSON.stringify(data);
}
