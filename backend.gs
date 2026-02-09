
// --- CẤU HÌNH ID SPREADSHEET (PRODUCTION) ---
const CONFIG = {
  // 1. Sheet Đăng Nhập
  DN_ID: '1FGcLJTKt1qV_VpTTD73USFCXNoe1X22-UsLJpwCHN18',
  DN_SHEET_NAME: 'DN',

  // 2. Sheet Kho Chính (Master Data)
  KHO_ID: '1DSg_2nJoPkAfudCy4QnHBEbvKhwHm-j6Cd9CK_cwfkg',
  KHO_SHEET_NAME: 'KHO',

  // 3. Sheet Nhập Lại (Re-Import)
  SKUN_ID: '1HfJ6c48d0BhIsdKdCIZdq6JOBC7UHrszv-A8eI45ORM',
  SKUN_SHEET_NAME: 'SKUN',

  // 4. Sheet Xuất Kho (Export)
  SKUX_ID: '1ztt84ZUrGk1NlhjmbdAIm6tjlGHZBRDMPgOEQi24CUw',
  SKUX_SHEET_NAME: 'SKUX'
};

// --- SERVE HTML ---
function doGet(e) {
  return ContentService.createTextOutput("Backend API is running.");
}

// --- HANDLE API REQUESTS (POST) ---
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(30000); 

  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  try {
    if (!e.postData || !e.postData.contents) throw new Error("No payload found");

    const params = JSON.parse(e.postData.contents);
    const action = params.action;
    let result = {};

    switch (action) {
      case 'login':
        result = { success: true, isValid: checkLogin(params.username, params.password) };
        break;
      case 'search':
        const data = searchPaperBySku(params.sku);
        result = { success: true, found: !!data, data: data };
        break;
      case 'saveBatch':
        result = saveBatchData(params.data, params.sheetName);
        break;
      default:
        result = { success: false, message: 'Invalid action: ' + action };
    }

    output.setContent(JSON.stringify(result));

  } catch (err) {
    Logger.log(err);
    output.setContent(JSON.stringify({ success: false, message: err.toString() }));
  } finally {
    lock.releaseLock();
  }
  
  return output;
}

// ==========================================
// 1. LOGIC ĐĂNG NHẬP
// ==========================================
function checkLogin(username, password) {
  try {
    if (!username || !password) return false;
    const ss = SpreadsheetApp.openById(CONFIG.DN_ID);
    const sheet = ss.getSheetByName(CONFIG.DN_SHEET_NAME);
    if (!sheet) return false;
    const data = sheet.getDataRange().getDisplayValues();
    const u = String(username).toLowerCase().trim();
    const p = String(password).trim();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).toLowerCase().trim() === u && String(data[i][1]).trim() === p) return true;
    }
    return false;
  } catch (e) { return false; }
}

// ==========================================
// 2. LOGIC TÌM KIẾM
// ==========================================
function searchPaperBySku(skuCode) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.KHO_ID);
    const sheet = ss.getSheetByName(CONFIG.KHO_SHEET_NAME);
    if (!sheet) return null;

    const searchKey = String(skuCode).trim().toLowerCase();
    
    // Tìm SKU (Cột A)
    let finder = sheet.getRange("A:A").createTextFinder(searchKey).matchEntireCell(false);
    let results = finder.findAll();
    let targetRowIndex = -1;
    
    for (let i = 0; i < results.length; i++) {
       if (String(results[i].getValue()).toLowerCase().trim() === searchKey) {
         targetRowIndex = results[i].getRow();
         break;
       }
    }

    // Tìm Mã Kiện (Cột C) nếu không thấy SKU
    if (targetRowIndex === -1) {
       finder = sheet.getRange("C:C").createTextFinder(searchKey).matchEntireCell(false);
       results = finder.findAll();
       for (let i = 0; i < results.length; i++) {
         if (String(results[i].getValue()).toLowerCase().trim() === searchKey) {
           targetRowIndex = results[i].getRow();
           break;
         }
       }
    }

    if (targetRowIndex !== -1) {
      const values = sheet.getRange(targetRowIndex, 1, 1, 19).getValues()[0];
      return {
        sku: String(values[0]),
        purpose: String(values[1]),
        packageId: String(values[2]),
        type: String(values[3]),
        gsm: values[4],
        supplier: String(values[5]),
        manufacturer: String(values[6]),
        importDate: formatDate(values[7], "dd/MM/yyyy"), // Chỉ lấy Ngày
        prodDate: formatDate(values[8], "dd/MM/yyyy"),   // Chỉ lấy Ngày
        lengthCm: values[9],
        widthCm: values[10],
        weight: values[11],
        quantity: values[12],
        customerOrder: String(values[13]),
        materialCode: String(values[14]),
        location: String(values[15]),
        pendingOut: String(values[16]),
        importer: String(values[17]),
        updatedAt: formatDate(values[18]) // Mặc định có giờ phút
      };
    }
    return null;
  } catch (e) { throw new Error(e.toString()); }
}

// ==========================================
// 3. LOGIC LƯU DỮ LIỆU
// ==========================================
function saveBatchData(payloadArray, targetSheetName) {
  if (!payloadArray || payloadArray.length === 0) return { count: 0 };

  // A. KHO CHÍNH (UPDATE)
  if (targetSheetName === 'KHO') {
    return updateMasterInventory(payloadArray);
  } 
  
  // B. NHẬP LẠI (SKUN)
  else if (targetSheetName === 'SKUN') {
    return insertRawData(payloadArray, CONFIG.SKUN_ID, CONFIG.SKUN_SHEET_NAME, ['sku', 'weight', 'quantity']);
  }

  // C. XUẤT KHO (SKUX)
  else if (targetSheetName === 'SKUX') {
    return insertRawData(payloadArray, CONFIG.SKUX_ID, CONFIG.SKUX_SHEET_NAME, ['sku', 'quantity']);
  }

  else {
    return { success: false, message: "Invalid Sheet Name" };
  }
}

// Helper A: Update Master Data
function updateMasterInventory(items) {
  const ss = SpreadsheetApp.openById(CONFIG.KHO_ID);
  const sheet = ss.getSheetByName(CONFIG.KHO_SHEET_NAME);
  const lastRow = sheet.getLastRow();
  const rangeValues = sheet.getRange(1, 1, lastRow, 3).getValues();
  
  // Map SKU/PackageID to Row Index
  const skuMap = new Map();
  for (let i = 1; i < rangeValues.length; i++) {
    const s = String(rangeValues[i][0]).trim().toLowerCase();
    if (s) skuMap.set(s, i + 1);
    const p = String(rangeValues[i][2]).trim().toLowerCase();
    if (p && !skuMap.has(p)) skuMap.set(p, i + 1);
  }
  
  let updatedCount = 0;
  
  // Process Updates
  items.forEach(item => {
    const key = String(item.sku).trim().toLowerCase();
    
    if (skuMap.has(key)) {
      const rowIndex = skuMap.get(key);
      
      // Update basic fields
      if (item.gsm !== undefined) sheet.getRange(rowIndex, 5).setValue(item.gsm);
      if (item.lengthCm !== undefined) sheet.getRange(rowIndex, 10).setValue(item.lengthCm);
      if (item.widthCm !== undefined) sheet.getRange(rowIndex, 11).setValue(item.widthCm);
      if (item.weight !== undefined) sheet.getRange(rowIndex, 12).setValue(item.weight);
      if (item.quantity !== undefined) sheet.getRange(rowIndex, 13).setValue(item.quantity);
      if (item.location !== undefined) sheet.getRange(rowIndex, 16).setValue(item.location);
      if (item.importer !== undefined) sheet.getRange(rowIndex, 18).setValue(item.importer);
      
      // Update DATES - REMOVED Single Quote Prefix
      if (item.importDate !== undefined) sheet.getRange(rowIndex, 8).setValue(item.importDate);
      if (item.prodDate !== undefined) sheet.getRange(rowIndex, 9).setValue(item.prodDate);
      
      // Update Timestamp - Keep quote for safety or remove if needed (kept here for logging safety)
      if (item.updatedAt !== undefined) sheet.getRange(rowIndex, 19).setValue("'" + item.updatedAt);
      
      updatedCount++;
    }
  });
  
  return { success: true, count: updatedCount, message: `Đã cập nhật ${updatedCount} dòng vào KHO.` };
}

// Helper B: Insert Raw Data
function insertRawData(items, spreadsheetId, sheetName, fieldsToMap) {
  const ss = SpreadsheetApp.openById(spreadsheetId);
  let sheet = ss.getSheetByName(sheetName);
  
  // Create sheet if missing
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    const headers = fieldsToMap.map(f => {
       if (f === 'sku') return 'SKU';
       if (f === 'weight') return 'TRỌNG LƯỢNG';
       if (f === 'quantity') return 'SỐ LƯỢNG';
       return f.toUpperCase();
    });
    sheet.appendRow(headers);
  }
  
  const rowsToAdd = items.map(item => {
    const row = [];
    fieldsToMap.forEach(field => {
      row.push(item[field] !== undefined ? item[field] : "");
    });
    return row;
  });
  
  if (rowsToAdd.length > 0) {
    const lastRow = sheet.getLastRow();
    sheet.getRange(lastRow + 1, 1, rowsToAdd.length, rowsToAdd[0].length).setValues(rowsToAdd);
  }
  
  return { success: true, count: rowsToAdd.length, message: `Đã thêm ${rowsToAdd.length} dòng vào ${sheetName}.` };
}

// Utils
function formatDate(dateObj, pattern) {
  if (!dateObj) return "";
  const formatStr = pattern || "dd/MM/yyyy HH:mm";
  try {
    // 1. If Date Object
    if (typeof dateObj.getMonth === 'function') {
      return Utilities.formatDate(dateObj, "GMT+7", formatStr);
    }
    
    // 2. If String
    let str = String(dateObj).trim();
    if (pattern === "dd/MM/yyyy") {
      // Simple Split to remove time part if present (by space or T)
      if (str.includes(" ")) {
        str = str.split(" ")[0];
      } else if (str.includes("T")) {
        str = str.split("T")[0];
      }
    }
    return str;
  } catch (e) { return String(dateObj); }
}
