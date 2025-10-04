/**
 * @file services.Sheet.js
 * @description Lớp dịch vụ quản lý tất cả các tương tác với Google Sheets.
 * Bao gồm logic tự động tạo và phục hồi (self-healing) để đảm bảo hệ thống luôn có DB.
 */

class SheetService {
  /**
   * Tìm một dòng trong sheet dựa trên eventHash và trả về dữ liệu của dòng đó.
   * @param {string} sheetName - Tên sheet cần tìm.
   * @param {string} hash - eventHash của sự kiện cần tìm.
   * @returns {object | null} Đối tượng chứa dữ liệu của dòng nếu tìm thấy, ngược lại trả về null.
   */
  static findRowByHash(sheetName, hash) {
    const data = this.getAllData(sheetName);

    // Thêm log để kiểm tra
    Logger.log(
      `findRowByHash: Đang tìm hash '${hash}' trong ${data.length} dòng của sheet '${sheetName}'.`,
    );

    const eventData = data.find(
      (row) => String(row.eventHash).trim() === String(hash).trim(),
    );

    if (eventData) {
      Logger.log(`findRowByHash: Đã tìm thấy dữ liệu cho hash: ${hash}`);
    } else {
      Logger.log(`findRowByHash: KHÔNG tìm thấy dữ liệu cho hash: ${hash}`);
    }

    return eventData || null;
  }

  /**
   * Cập nhật một ô cụ thể trong một dòng được xác định bởi eventHash.
   * @param {string} sheetName - Tên sheet cần cập nhật.
   * @param {string} hash - eventHash của dòng cần cập nhật.
   * @param {string} headerToUpdate - Tên cột (tiêu đề) cần cập nhật.
   * @param {*} newValue - Giá trị mới cần ghi vào ô.
   * @returns {boolean} True nếu cập nhật thành công, false nếu không tìm thấy dòng.
   */
  static updateCellByHash(sheetName, hash, headerToUpdate, newValue) {
    const spreadsheet = this._getSpreadsheet();
    const sheet = this._getSheet(spreadsheet, sheetName);
    const range = sheet.getDataRange();
    const values = range.getValues();
    const headers = values[0];

    const hashColumnIndex = headers.indexOf("eventHash");
    const targetColumnIndex = headers.indexOf(headerToUpdate);

    if (hashColumnIndex === -1 || targetColumnIndex === -1) {
      Logger.log(
        `Lỗi: Không tìm thấy cột 'eventHash' hoặc '${headerToUpdate}' trong sheet.`,
      );
      return false;
    }

    for (let i = 1; i < values.length; i++) {
      if (values[i][hashColumnIndex] === hash) {
        // Tìm thấy dòng, cập nhật giá trị. i + 1 vì index của mảng bắt đầu từ 0, row của sheet bắt đầu từ 1.
        sheet.getRange(i + 1, targetColumnIndex + 1).setValue(newValue);
        // Cập nhật thêm timestamp
        const timestampColumnIndex = headers.indexOf("lastUpdated");
        if (timestampColumnIndex !== -1) {
          sheet
            .getRange(i + 1, timestampColumnIndex + 1)
            .setValue(new Date().toISOString());
        }
        Logger.log(
          `Đã cập nhật cột '${headerToUpdate}' cho hash ${hash} thành công.`,
        );
        return true;
      }
    }

    Logger.log(`Không tìm thấy dòng nào có hash ${hash} để cập nhật.`);
    return false;
  }
  /**
   * Lấy về đối tượng Spreadsheet đang được sử dụng.
   * Đây là hàm cốt lõi của logic "Tự phục hồi".
   * @private
   * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet} Đối tượng Spreadsheet hợp lệ.
   */
  static _getSpreadsheet() {
    const properties = PropertiesService.getScriptProperties();
    const spreadsheetId = properties.getProperty(
      SCRIPT_PROPERTIES_KEYS.SPREADSHEET_ID,
    );

    if (spreadsheetId) {
      try {
        const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
        // Thử một hành động nhỏ để chắc chắn có quyền truy cập
        spreadsheet.getName();
        Logger.log(
          `SheetService: Đã truy cập thành công Spreadsheet ID: ${spreadsheetId}`,
        );
        return spreadsheet;
      } catch (e) {
        Logger.log(
          `SheetService: LỖI - Không thể truy cập Spreadsheet ID ${spreadsheetId}. Lỗi: ${e.message}. Sẽ tạo file mới.`,
        );
      }
    }

    Logger.log("SheetService: Đang tạo file Spreadsheet mới...");
    const studentId =
      PropertiesService.getScriptProperties().getProperty(
        SCRIPT_PROPERTIES_KEYS.STUDENT_ID,
      ) || "Unknown";
    const newSpreadsheet = SpreadsheetApp.create(
      `TimetableSys_DB (${studentId})`,
    );
    const newId = newSpreadsheet.getId();
    properties.setProperty(SCRIPT_PROPERTIES_KEYS.SPREADSHEET_ID, newId);
    Logger.log(`SheetService: Đã tạo và lưu Spreadsheet mới với ID: ${newId}`);

    // ++ ADDED: Logic di chuyển file vào cùng thư mục với script
    try {
      const scriptFile = DriveApp.getFileById(ScriptApp.getScriptId());
      const scriptFolder = scriptFile.getParents().next(); // Lấy thư mục cha đầu tiên
      const spreadsheetFile = DriveApp.getFileById(newId);
      spreadsheetFile.moveTo(scriptFolder);
      Logger.log(
        `SheetService: Đã di chuyển Spreadsheet vào thư mục: '${scriptFolder.getName()}'`,
      );
    } catch (e) {
      Logger.log(
        `SheetService: Lỗi khi di chuyển file Spreadsheet. Bỏ qua. Chi tiết: ${e.message}`,
      );
    }

    const defaultSheet = newSpreadsheet.getSheetByName("Sheet1");
    if (defaultSheet) {
      newSpreadsheet.deleteSheet(defaultSheet);
    }

    return newSpreadsheet;
  }

  /**
   * Lấy một sheet cụ thể theo tên. Nếu sheet không tồn tại, tự động tạo mới và thêm tiêu đề.
   * @private
   * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} spreadsheet - Đối tượng Spreadsheet.
   * @param {string} sheetName - Tên của sheet cần lấy (sử dụng hằng số từ Config).
   * @returns {GoogleAppsScript.Spreadsheet.Sheet} Đối tượng Sheet hợp lệ.
   */
  static _getSheet(spreadsheet, sheetName) {
    let sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(sheetName);
      Logger.log(`SheetService: Đã tạo sheet mới: '${sheetName}'`);
      // Thêm tiêu đề cho sheet mới
      sheet.appendRow(SHEET_HEADERS);
      Logger.log(`SheetService: Đã ghi tiêu đề cho sheet '${sheetName}'`);
    }
    return sheet;
  }

  /**
   * Ghi một mảng các đối tượng dữ liệu vào một sheet.
   * Dữ liệu cũ sẽ bị xóa hoàn toàn (trừ dòng tiêu đề).
   * @param {string} sheetName - Tên sheet để ghi dữ liệu.
   * @param {Object[]} dataObjects - Mảng các đối tượng sự kiện.
   */
  static writeToSheet(sheetName, dataObjects) {
    if (!dataObjects || dataObjects.length === 0) {
      Logger.log(
        `SheetService: Không có dữ liệu để ghi vào '${sheetName}'. Bỏ qua.`,
      );
      return;
    }

    const spreadsheet = this._getSpreadsheet();
    const sheet = this._getSheet(spreadsheet, sheetName);

    // Xóa dữ liệu cũ
    this.clearSheet(sheetName);

    // Chuyển đổi mảng đối tượng thành mảng 2D để ghi
    const dataRange = dataObjects.map((obj) =>
      SHEET_HEADERS.map((header) => obj[header] || ""),
    );

    // Ghi dữ liệu mới
    sheet
      .getRange(2, 1, dataRange.length, dataRange[0].length)
      .setValues(dataRange);
    Logger.log(
      `SheetService: Đã ghi thành công ${dataRange.length} dòng vào sheet '${sheetName}'.`,
    );
  }

  /**
   * Xóa toàn bộ dữ liệu của một sheet, chỉ giữ lại dòng tiêu đề.
   * @param {string} sheetName - Tên sheet cần xóa.
   */
  static clearSheet(sheetName) {
    const spreadsheet = this._getSpreadsheet();
    const sheet = this._getSheet(spreadsheet, sheetName);
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.deleteRows(2, lastRow - 1);
      Logger.log(
        `SheetService: Đã xóa ${
          lastRow - 1
        } dòng dữ liệu trong sheet '${sheetName}'.`,
      );
    }
  }

  /**
   * Đọc toàn bộ dữ liệu từ một sheet và chuyển đổi thành mảng các đối tượng.
   * @param {string} sheetName - Tên sheet cần đọc.
   * @returns {Object[]} Mảng các đối tượng dữ liệu.
   */
  static getAllData(sheetName) {
    const spreadsheet = this._getSpreadsheet();
    const sheet = this._getSheet(spreadsheet, sheetName);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return []; // Không có dữ liệu
    }
    const range = sheet.getRange(1, 1, lastRow, sheet.getLastColumn());
    const values = range.getValues();
    const headers = values.shift(); // Lấy dòng đầu tiên làm header

    return values.map((row) => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index];
      });
      return obj;
    });
  }

  /**
   * Xóa sạch dữ liệu và cấu trúc sheet, sau đó tạo lại từ đầu.
   * Thường được dùng trong quá trình Reset.
   * ** MODIFIED: Logic được viết lại hoàn toàn để tránh lỗi không thể xóa hết sheet.
   */
  static clearAllData() {
    Logger.log("SheetService: Bắt đầu quy trình tái tạo toàn bộ sheet...");
    const spreadsheet = this._getSpreadsheet();
    const allSheets = spreadsheet.getSheets();
    let tempSheet = null;

    // 1. Tạo sheet tạm
    try {
      tempSheet = spreadsheet.insertSheet(`_temp_${Date.now()}`);
      Logger.log(`SheetService: Đã tạo sheet tạm: ${tempSheet.getName()}`);
    } catch (e) {
      Logger.log(
        `Không thể tạo sheet tạm, có thể file đang trống. Bỏ qua. Lỗi: ${e.message}`,
      );
    }

    // 2. Xóa tất cả các sheet khác
    allSheets.forEach((sheet) => {
      // Kiểm tra để không xóa chính sheet tạm vừa tạo
      if (tempSheet && sheet.getSheetId() !== tempSheet.getSheetId()) {
        Logger.log(`SheetService: Đang xóa sheet cũ: ${sheet.getName()}`);
        spreadsheet.deleteSheet(sheet);
      } else if (!tempSheet && sheet.getName() === "Sheet1") {
        // Trường hợp file mới chỉ có "Sheet1"
        Logger.log(`SheetService: Đang xóa sheet mặc định: ${sheet.getName()}`);
        spreadsheet.deleteSheet(sheet);
      }
    });

    // 3. Tạo lại các sheet cần thiết
    this._getSheet(spreadsheet, SHEET_NAMES.PROCESSED_SCHEDULE);
    this._getSheet(spreadsheet, SHEET_NAMES.CURRENT_SCHEDULE);

    // 4. Xóa sheet tạm (nếu nó đã được tạo)
    if (tempSheet) {
      try {
        spreadsheet.deleteSheet(tempSheet);
        Logger.log("SheetService: Đã xóa sheet tạm thành công.");
      } catch (e) {
        Logger.log(`Lỗi khi xóa sheet tạm: ${e.message}`);
      }
    }

    Logger.log("SheetService: Hoàn tất tái tạo cấu trúc sheet.");
  }

  /**
   * Lấy danh sách duy nhất các eventHash từ một sheet.
   * Chỉ lấy các sự kiện có thời gian bắt đầu trong tương lai.
   * @param {string} sheetName - Tên sheet cần đọc.
   * @returns {Set<string>} Một Set chứa các eventHash.
   */
  static getFutureEventHashes(sheetName) {
    const allData = this.getAllData(sheetName);
    const now = new Date();
    const hashes = new Set();

    for (const row of allData) {
      const eventDate = new Date(row.ThoiGianBD);
      if (eventDate > now) {
        hashes.add(row.eventHash);
      }
    }
    return hashes;
  }

  /**
   * Cập nhật googleCalendarEventId cho một loạt sự kiện dựa trên eventHash.
   * @param {string} sheetName - Tên sheet cần cập nhật.
   * @param {Array<{eventHash: string, newEventId: string}>} updates - Mảng các đối tượng cập nhật.
   */
  static updateEventIds(sheetName, updates) {
    if (!updates || updates.length === 0) return;

    const spreadsheet = this._getSpreadsheet();
    const sheet = this._getSheet(spreadsheet, sheetName);
    const range = sheet.getDataRange();
    const values = range.getValues();
    const headers = values[0];

    const hashColIdx = headers.indexOf("eventHash");
    const eventIdColIdx = headers.indexOf("googleCalendarEventId");
    const updatedTimestampColIdx = headers.indexOf("lastUpdated");

    if (hashColIdx === -1 || eventIdColIdx === -1) return;

    const updatesMap = new Map(updates.map((u) => [u.eventHash, u.newEventId]));
    let changesMade = 0;

    for (let i = 1; i < values.length; i++) {
      const hash = values[i][hashColIdx];
      if (updatesMap.has(hash)) {
        sheet.getRange(i + 1, eventIdColIdx + 1).setValue(updatesMap.get(hash));
        if (updatedTimestampColIdx !== -1) {
          sheet
            .getRange(i + 1, updatedTimestampColIdx + 1)
            .setValue(new Date().toISOString());
        }
        changesMade++;
      }
    }
    Logger.log(
      `SheetService: Đã cập nhật ${changesMade} googleCalendarEventId vào sheet '${sheetName}'.`,
    );
  }

  /**
   * Thực hiện bước "commit" cuối cùng của luồng sync thông minh.
   * Xóa các sự kiện tương lai trong `_DaXuLy` và sao chép toàn bộ `_HienTai` vào.
   */
  static commitChanges() {
    const spreadsheet = this._getSpreadsheet();
    const processedSheet = this._getSheet(
      spreadsheet,
      SHEET_NAMES.PROCESSED_SCHEDULE,
    );
    const currentSheetData = this.getAllData(SHEET_NAMES.CURRENT_SCHEDULE);
    const now = new Date();

    // 1. Xóa các sự kiện tương lai trong LichHoc_DaXuLy
    const processedRange = processedSheet.getDataRange();
    const processedValues = processedRange.getValues();
    const timeColIdx = processedValues[0].indexOf("ThoiGianBD");
    const rowsToDelete = [];

    for (let i = processedValues.length - 1; i >= 1; i--) {
      const eventDate = new Date(processedValues[i][timeColIdx]);
      if (eventDate > now) {
        rowsToDelete.push(i + 1);
      }
    }

    // Sắp xếp ngược để xóa từ dưới lên không bị lỗi index
    rowsToDelete
      .sort((a, b) => b - a)
      .forEach((rowNum) => processedSheet.deleteRow(rowNum));
    Logger.log(
      `SheetService (Commit): Đã xóa ${rowsToDelete.length} sự kiện tương lai cũ khỏi '${SHEET_NAMES.PROCESSED_SCHEDULE}'.`,
    );

    // 2. Nối dữ liệu từ LichHoc_HienTai vào LichHoc_DaXuLy
    if (currentSheetData.length > 0) {
      const dataToAppend = currentSheetData.map((obj) =>
        SHEET_HEADERS.map((header) => obj[header] || ""),
      );
      processedSheet
        .getRange(
          processedSheet.getLastRow() + 1,
          1,
          dataToAppend.length,
          dataToAppend[0].length,
        )
        .setValues(dataToAppend);
      Logger.log(
        `SheetService (Commit): Đã sao chép ${dataToAppend.length} sự kiện mới từ '${SHEET_NAMES.CURRENT_SCHEDULE}' vào '${SHEET_NAMES.PROCESSED_SCHEDULE}'.`,
      );
    }

    // 3. Xóa sạch sheet tạm
    this.clearSheet(SHEET_NAMES.CURRENT_SCHEDULE);
  }
}
