/**
 * @file utils.Tester.js
 * @description Chứa các hàm tiện ích dùng cho việc kiểm thử (testing) hệ thống.
 * CÁC HÀM TRONG FILE NÀY KHÔNG PHẢI LÀ MỘT PHẦN CỦA HỆ THỐNG CHÍNH THỨC.
 * Chúng chỉ nên được chạy thủ công từ trình soạn thảo Apps Script.
 */

/**
 * Giả lập (mock) một sự thay đổi trong dữ liệu lịch học để kiểm thử luồng "Đồng bộ Thông minh".
 * HÀM NÀY CHỈ NÊN ĐƯỢC CHẠY THỦ CÔNG TỪ TRÌNH SOẠN THẢO SCRIPT.
 * * Cách hoạt động:
 * 1. Đọc toàn bộ lịch học tương lai từ sheet chính (`LichHoc_DaXuLy`).
 * 2. Tạo ra một phiên bản "giả" của lịch này:
 * - Xóa đi buổi học đầu tiên (giả lập buổi học bị hủy).
 * - Thay đổi tên phòng của buổi học thứ hai (giả lập buổi học bị dời phòng).
 * 3. Ghi dữ liệu giả này vào sheet tạm (`LichHoc_HienTai`).
 * * Sau khi chạy hàm này, bạn có thể chạy thủ công hàm `controllers_Main_runIntelligentSync`
 * để kích hoạt luồng so sánh và gửi email thông báo thay đổi.
 */
function utils_Tester_mockApiChange() {
  Logger.log("TESTER: Bắt đầu tạo dữ liệu lịch học giả...");

  // 1. Lấy dữ liệu các sự kiện tương lai từ cơ sở dữ liệu chính
  const allData = SheetService.getAllData(SHEET_NAMES.PROCESSED_SCHEDULE);
  const now = new Date();
  let futureEvents = allData.filter(e => new Date(e.ThoiGianBD) > now);

  if (futureEvents.length < 2) {
    Logger.log("TESTER: Lỗi - Cần ít nhất 2 sự kiện trong tương lai để tạo dữ liệu giả.");
    SpreadsheetApp.getUi().alert("Cần ít nhất 2 sự kiện trong tương lai để chạy kiểm thử.");
    return;
  }

  // 2. Tạo ra các thay đổi giả
  // - Hủy buổi học đầu tiên
  const deletedEvent = futureEvents.shift(); // Lấy và xóa phần tử đầu tiên
  Logger.log(`TESTER: Giả lập HỦY buổi học: ${deletedEvent.TenMonHoc} lúc ${deletedEvent.ThoiGianBD}`);
  
  // - Dời phòng buổi học tiếp theo
  const originalRoom = futureEvents[0].TenPhong;
  futureEvents[0].TenPhong = "P.TEST-999"; // Thay đổi tên phòng
  // Tạo lại hash vì dữ liệu đã thay đổi
  futureEvents[0].eventHash = createEventHash(futureEvents[0]); 
  Logger.log(`TESTER: Giả lập DỜI PHÒNG cho buổi học ${futureEvents[0].TenMonHoc} từ ${originalRoom} sang ${futureEvents[0].TenPhong}`);
  
  // 3. Ghi dữ liệu đã bị thay đổi vào sheet tạm
  SheetService.writeToSheet(SHEET_NAMES.CURRENT_SCHEDULE, futureEvents);

  Logger.log("TESTER: Đã tạo xong dữ liệu giả. Giờ bạn có thể chạy 'controllers_Main_runIntelligentSync' để kiểm tra.");
  
}

/**
 * =====================================================================================
 * HÀM KIỂM THỬ (TESTING)
 * =====================================================================================
 */

/**
 * Phiên bản KIỂM THỬ của hàm đồng bộ thông minh.
 * HÀM NÀY CHỈ NÊN ĐƯỢC CHẠY THỦ CÔNG TỪ TRÌNH SOẠN THẢO SCRIPT.
 * Nó sẽ KHÔNG gọi API thật. Thay vào đó, nó sử dụng dữ liệu đã được
 * chuẩn bị sẵn trong sheet 'LichHoc_HienTai' (bởi hàm utils_Tester_mockApiChange)
 * để thực hiện logic so sánh và gửi thông báo.
 * @returns {string} Thông báo kết quả kiểm thử.
 */
function controllers_Main_runIntelligentSync_TEST() {
  Logger.log("CONTROLLER (TEST): Bắt đầu luồng Đồng bộ Thông minh KIỂM THỬ...");
  utils_Tester_mockApiChange();

  // ** MODIFIED: Bỏ qua bước 1 & 2 (gọi API và ghi đè sheet) **
  // Thay vào đó, chúng ta đọc trực tiếp dữ liệu đã được chuẩn bị sẵn
  const processedFutureEvents = SheetService.getAllData(
    SHEET_NAMES.CURRENT_SCHEDULE,
  );
  
  if (processedFutureEvents.length === 0) {
    const msg = "CONTROLLER (TEST): Lỗi - không tìm thấy dữ liệu giả trong sheet 'LichHoc_HienTai'. Bạn đã chạy hàm 'utils_Tester_mockApiChange' chưa?";
    Logger.log(msg);
    SpreadsheetApp.getUi().alert(msg);
    return;
  }
  Logger.log(`CONTROLLER (TEST): Đã đọc ${processedFutureEvents.length} bản ghi giả từ sheet tạm.`);


  // 3. So sánh (Diffing) - Logic từ đây trở đi giữ nguyên như hàm thật
  const oldHashes = SheetService.getFutureEventHashes(
    SHEET_NAMES.PROCESSED_SCHEDULE,
  );
  const newHashes = new Set(processedFutureEvents.map((e) => e.eventHash));

  const addedHashes = [...newHashes].filter((h) => !oldHashes.has(h));
  const deletedHashes = [...oldHashes].filter((h) => !newHashes.has(h));

  Logger.log(
    `Sync (TEST): Tìm thấy ${addedHashes.length} sự kiện mới và ${deletedHashes.length} sự kiện bị xóa.`,
  );

  if (addedHashes.length === 0 && deletedHashes.length === 0) {
    Logger.log("CONTROLLER (TEST): Không có thay đổi nào. Dừng luồng.");
    SheetService.clearSheet(SHEET_NAMES.CURRENT_SCHEDULE);
    return "Kiểm thử hoàn tất. Không có thay đổi nào.";
  }

  // 4. Xử lý thay đổi
  const allProcessedData = SheetService.getAllData(
    SHEET_NAMES.PROCESSED_SCHEDULE,
  );
  const eventsToDelete = allProcessedData.filter((e) =>
    deletedHashes.includes(e.eventHash),
  );
  const eventsToAdd = processedFutureEvents.filter((e) =>
    addedHashes.includes(e.eventHash),
  );

  // Xóa sự kiện cũ trên Calendar
  const eventIdsToDelete = eventsToDelete
    .map((e) => e.googleCalendarEventId)
    .filter(Boolean);
  CalendarService.clearSystemEvents(eventIdsToDelete);

  // Tạo sự kiện mới trên Calendar
  const updates = CalendarService.createEventsInBatch(eventsToAdd);
  SheetService.updateEventIds(SHEET_NAMES.CURRENT_SCHEDULE, updates);

  // ** PHẦN THÔNG BÁO THÔNG MINH (giữ nguyên) **
  const properties = PropertiesService.getScriptProperties();
  const userEmail = properties.getProperty(SCRIPT_PROPERTIES_KEYS.EMAIL);
  const geminiApiKey = properties.getProperty(
    SCRIPT_PROPERTIES_KEYS.GEMINI_API_KEY,
  );
  let emailBody = "";
  const subject = `[KIỂM THỬ] Có ${
    addedHashes.length + deletedHashes.length
  } thay đổi lịch học`;

  try {
    if (geminiApiKey) {
      Logger.log(
        "Controller (TEST): Phát hiện có Gemini API Key. Đang gọi AI...",
      );
      emailBody = GeminiService.summarizeChanges(eventsToAdd, eventsToDelete);
    } else {
      throw new Error("Không có API Key, chuyển sang thông báo thường.");
    }
  } catch (e) {
    Logger.log(
      `Controller (TEST): Không thể dùng AI (${e.message}). Tạo thông báo đơn giản.`,
    );
    const formatEvent = (event) =>
      `- ${event.TenMonHoc} (Phòng ${event.TenPhong}) lúc ${new Date(
        event.ThoiGianBD,
      ).toLocaleString("vi-VN")}`;
    const addedText =
      eventsToAdd.length > 0
        ? `CÁC BUỔI HỌC MỚI:\n${eventsToAdd.map(formatEvent).join("\n")}`
        : "";
    const deletedText =
      eventsToDelete.length > 0
        ? `CÁC BUỔI HỌC BỊ HỦY:\n${eventsToDelete.map(formatEvent).join("\n")}`
        : "";
    emailBody = `Chào bạn,\n\nĐây là email KIỂM THỬ:\n\n${addedText}\n\n${deletedText}\n\nVui lòng kiểm tra lại lịch.`;
  }

  if (userEmail) {
    MailApp.sendEmail(userEmail, subject, emailBody);
    Logger.log(`Controller (TEST): Đã gửi email thông báo đến ${userEmail}.`);
  }

  // 5. Commit dữ liệu
  SheetService.commitChanges();

  Logger.log("CONTROLLER (TEST): Hoàn tất luồng Đồng bộ Thông minh KIỂM THỬ.");
  return `Kiểm thử hoàn tất: ${addedHashes.length} thêm, ${deletedHashes.length} xóa.`;
}


// Hàm gọi Gemini API
function callGeminiAPI(prompt) {
  // Lấy API Key từ Script Properties để bảo mật
  var apiKey = "AIzaSyBVCJDZJGZwfShX4nhyU5-iNeQlpIZPg80";
  if (!apiKey) {
    return 'Lỗi: Vui lòng thiết lập GEMINI_API_KEY trong Script Properties.';
  }
  
  // Sử dụng endpoint mới nhất (v1beta) và mô hình gemini-2.5-flash
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + apiKey;
  
  // Thiết lập payload theo định dạng chuẩn của Gemini API
  var payload = {
    "contents": [
      {
        "role": "user",
        "parts": [
          {
            "text": prompt
          }
        ]
      }
    ],
    "generationConfig": {
      "temperature": 0.7, // Điều chỉnh nhiệt độ để kiểm soát tính sáng tạo
      "topP": 0.8,
      "topK": 40,
      "thinkingConfig": {
        "thinkingBudget": 0 // Tắt tính năng "thinking" để tăng tốc độ
      }
    }
  };
  
  // Thiết lập tùy chọn cho yêu cầu HTTP
  var options = {
    'method': 'post',
    'contentType': 'application/json',
    'payload': JSON.stringify(payload),
    'muteHttpExceptions': true // Giữ nguyên để kiểm tra mã lỗi HTTP
  };
  
  try {
    // Gửi yêu cầu đến Gemini API
    var response = UrlFetchApp.fetch(url, options);
    var responseCode = response.getResponseCode();
    var responseText = response.getContentText();
    var json = JSON.parse(responseText);
    
    // Kiểm tra mã trạng thái HTTP
    if (responseCode !== 200) {
      return 'Lỗi HTTP ' + responseCode + ': ' + (json.error ? json.error.message : responseText);
    }
    
    // Kiểm tra phản hồi từ API
    if (json.candidates && json.candidates.length > 0 && json.candidates[0].content && json.candidates[0].content.parts && json.candidates[0].content.parts.length > 0) {
      return json.candidates[0].content.parts[0].text;
    } else if (json.error) {
      return 'Lỗi từ API: ' + json.error.message;
    } else {
      return 'Không có nội dung hợp lệ trong phản hồi từ API.';
    }
  } catch (e) {
    return 'Lỗi khi gọi API: ' + e.toString();
  }
}

// Hàm thử nghiệm để gọi API từ Google Sheets
function testGeminiAPI() {
  var prompt = 'Viết một đoạn mô tả ngắn về Hà Nội trong 50 từ.';
  var result = callGeminiAPI(prompt);
  Logger.log(result);
  

}


