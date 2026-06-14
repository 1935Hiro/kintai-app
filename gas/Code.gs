// ===================================================
// 勤怠記録 PWA - Google Apps Script バックエンド
// ===================================================
// 使い方:
// 1. Google スプレッドシートを新規作成
// 2. 拡張機能 → Apps Script → このコードを貼り付け
// 3. デプロイ → 新しいデプロイ → ウェブアプリ
//    - 実行ユーザー: 自分
//    - アクセスできるユーザー: 全員
// 4. デプロイURLをコピーして index.html の GAS_URL に貼り付け

const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();

// ===================================================
// GET リクエスト
// ===================================================
function doGet(e) {
  const action = e.parameter.action;

  // 設定取得
  if (action === 'settings') {
    const month = e.parameter.month; // YYYY-MM
    return jsonResponse({ url: getSettings('levtech_url_' + month) || '' });
  }

  // 月の記録取得
  const month = e.parameter.month; // YYYY-MM
  if (!month) return jsonResponse({ error: 'month parameter required' });

  const records = getRecords(month);
  return jsonResponse({ records });
}

// ===================================================
// POST リクエスト
// ===================================================
function doPost(e) {
  const data = JSON.parse(e.postData.contents);

  // 設定保存
  if (data.action === 'settings') {
    setSettings('levtech_url_' + data.month, data.url);
    return jsonResponse({ ok: true });
  }

  // 記録保存（upsert）
  const { date, start, end, note } = data;
  if (!date) return jsonResponse({ error: 'date required' });

  upsertRecord(date, start || '', end || '', note || '');
  return jsonResponse({ ok: true });
}

// ===================================================
// 記録の取得
// ===================================================
function getRecords(month) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(month);
  if (!sheet) return [];

  const rows = sheet.getDataRange().getValues();
  // ヘッダー行をスキップ
  return rows.slice(1).map(row => ({
    date:  row[0] ? Utilities.formatDate(new Date(row[0]), 'Asia/Tokyo', 'yyyy-MM-dd') : '',
    start: row[1] || '',
    end:   row[2] || '',
    note:  row[3] || ''
  })).filter(r => r.date);
}

// ===================================================
// 記録の保存（upsert）
// ===================================================
function upsertRecord(date, start, end, note) {
  const month = date.substring(0, 7); // YYYY-MM
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // シートが無ければ作成
  let sheet = ss.getSheetByName(month);
  if (!sheet) {
    sheet = ss.insertSheet(month);
    sheet.appendRow(['date', 'start', 'end', 'note']);
  }

  // 既存行を検索
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    const rowDate = rows[i][0]
      ? Utilities.formatDate(new Date(rows[i][0]), 'Asia/Tokyo', 'yyyy-MM-dd')
      : '';
    if (rowDate === date) {
      // 更新
      sheet.getRange(i + 1, 2).setValue(start);
      sheet.getRange(i + 1, 3).setValue(end);
      sheet.getRange(i + 1, 4).setValue(note);
      return;
    }
  }

  // 新規追加
  sheet.appendRow([date, start, end, note]);
}

// ===================================================
// 設定の読み書き
// ===================================================
function getSettings(key) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName('settings');
  if (!sheet) return null;

  const rows = sheet.getDataRange().getValues();
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === key) return rows[i][1];
  }
  return null;
}

function setSettings(key, value) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName('settings');
  if (!sheet) {
    sheet = ss.insertSheet('settings');
  }

  const rows = sheet.getDataRange().getValues();
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  sheet.appendRow([key, value]);
}

// ===================================================
// ヘルパー
// ===================================================
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
