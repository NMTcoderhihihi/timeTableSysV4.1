/**
 * @file controllers.Main.js
 * @description Controller chính, xử lý hầu hết các yêu cầu từ giao diện người dùng
 * và điều phối các services để thực hiện các luồng nghiệp vụ.
 */

// =====================================================================================
// HÀM ĐƯỢC GỌI TỪ CLIENT (WEB APP)
// =====================================================================================

function controllers_Main_getSystemStatus() {
  const properties = PropertiesService.getScriptProperties();
  const studentId = properties.getProperty(SCRIPT_PROPERTIES_KEYS.STUDENT_ID);
  const email = properties.getProperty(SCRIPT_PROPERTIES_KEYS.EMAIL);
  const spreadsheetId = properties.getProperty(
    SCRIPT_PROPERTIES_KEYS.SPREADSHEET_ID,
  );

  const isConfigured = !!(studentId && email);
  const isInitialized = !!spreadsheetId;
  const isAutoSyncActive =
    properties.getProperty(SCRIPT_PROPERTIES_KEYS.IS_AUTO_SYNC_ACTIVE) ===
    "true";

  return { isConfigured, isInitialized, isAutoSyncActive };
}

function controllers_Main_getSettings() {
  const properties = PropertiesService.getScriptProperties();
  const syncTimesRaw =
    properties.getProperty(SCRIPT_PROPERTIES_KEYS.SYNC_TIMES) ||
    DEFAULT_SETTINGS.SYNC_TIMES;
  const syncTimes = JSON.parse(syncTimesRaw);

  return {
    studentId: properties.getProperty(SCRIPT_PROPERTIES_KEYS.STUDENT_ID) || "",
    email: properties.getProperty(SCRIPT_PROPERTIES_KEYS.EMAIL) || "",
    calendarId:
      properties.getProperty(SCRIPT_PROPERTIES_KEYS.CALENDAR_ID) || "",
    spreadsheetId:
      properties.getProperty(SCRIPT_PROPERTIES_KEYS.SPREADSHEET_ID) || "",
    pageSize:
      properties.getProperty(SCRIPT_PROPERTIES_KEYS.PAGE_SIZE) ||
      DEFAULT_SETTINGS.PAGE_SIZE,
    maxRetries:
      properties.getProperty(SCRIPT_PROPERTIES_KEYS.MAX_RETRIES) ||
      DEFAULT_SETTINGS.MAX_RETRIES,
    retryDelaySeconds:
      properties.getProperty(SCRIPT_PROPERTIES_KEYS.RETRY_DELAY_SECONDS) ||
      DEFAULT_SETTINGS.RETRY_DELAY_SECONDS,
    syncTime1: syncTimes[0] || "",
    syncTime2: syncTimes[1] || "",
    syncTime3: syncTimes[2] || "",
    syncStartDate:
      properties.getProperty(SCRIPT_PROPERTIES_KEYS.SYNC_START_DATE) || "", // ++ ADDED
    geminiApiKey:
      properties.getProperty(SCRIPT_PROPERTIES_KEYS.GEMINI_API_KEY) || "",
  };
}

function controllers_Main_saveSettings(settings) {
  const properties = PropertiesService.getScriptProperties();
  if (!settings.studentId || !settings.email)
    throw new Error("Mã số sinh viên và Email là bắt buộc.");

  const syncTimes = [
    roundTimeDownTo15Minutes(settings.syncTime1),
    roundTimeDownTo15Minutes(settings.syncTime2),
    roundTimeDownTo15Minutes(settings.syncTime3),
  ].filter(Boolean);

  const propertiesToSet = {
    [SCRIPT_PROPERTIES_KEYS.STUDENT_ID]: settings.studentId.trim(),
    [SCRIPT_PROPERTIES_KEYS.EMAIL]: settings.email.trim(),
    [SCRIPT_PROPERTIES_KEYS.CALENDAR_ID]: settings.calendarId.trim(),
    [SCRIPT_PROPERTIES_KEYS.PAGE_SIZE]:
      settings.pageSize || DEFAULT_SETTINGS.PAGE_SIZE,
    [SCRIPT_PROPERTIES_KEYS.MAX_RETRIES]:
      settings.maxRetries || DEFAULT_SETTINGS.MAX_RETRIES,
    [SCRIPT_PROPERTIES_KEYS.RETRY_DELAY_SECONDS]:
      settings.retryDelaySeconds || DEFAULT_SETTINGS.RETRY_DELAY_SECONDS,
    [SCRIPT_PROPERTIES_KEYS.SYNC_TIMES]: JSON.stringify(syncTimes),
    [SCRIPT_PROPERTIES_KEYS.SYNC_START_DATE]: settings.syncStartDate || "", // ++ ADDED
    [SCRIPT_PROPERTIES_KEYS.GEMINI_API_KEY]: settings.geminiApiKey
      ? settings.geminiApiKey.trim()
      : "",
  };

  properties.setProperties(propertiesToSet, false);
  return "Lưu cài đặt thành công!";
}

function controllers_Main_initializeSystem() {
  Logger.log("CONTROLLER: Bắt đầu luồng Khởi tạo Hệ thống...");
  SheetService._getSpreadsheet();
  CalendarService._getCalendar();
  // ** MODIFIED: Ưu tiên ngày người dùng cài đặt, nếu không có thì dùng ngày hiện tại
  const properties = PropertiesService.getScriptProperties();
  const userDefinedStartDate = properties.getProperty(
    SCRIPT_PROPERTIES_KEYS.SYNC_START_DATE,
  );
  const startDate = userDefinedStartDate
    ? userDefinedStartDate
    : new Date().toISOString().split("T")[0];

  Logger.log(`CONTROLLER: Sử dụng ngày bắt đầu đồng bộ là: ${startDate}`);
  const apiEvents = ApiService.fetchAllSchedulePages(startDate);

  const processedEvents = apiEvents.map((event) => ({
    ...event,
    eventHash: createEventHash(event),
    lastUpdated: new Date().toISOString(),
    daCheckIn: "",
    googleCalendarEventId: "",
  }));

  SheetService.writeToSheet(SHEET_NAMES.PROCESSED_SCHEDULE, processedEvents);
  const updates = CalendarService.createEventsInBatch(processedEvents);
  SheetService.updateEventIds(SHEET_NAMES.PROCESSED_SCHEDULE, updates);

  Logger.log("CONTROLLER: Hoàn tất luồng Khởi tạo Hệ thống.");
  return "Hệ thống đã được khởi tạo thành công!";
}

function controllers_Main_resetSystem(resetOption) {
  Logger.log(
    `CONTROLLER: Bắt đầu luồng Reset Hệ thống với lựa chọn: ${resetOption}`,
  );
  if (resetOption === 1) {
    const allData = SheetService.getAllData(SHEET_NAMES.PROCESSED_SCHEDULE);
    const eventIdsToDelete = allData
      .map((row) => row.googleCalendarEventId)
      .filter(Boolean);
    CalendarService.clearSystemEvents(eventIdsToDelete);
  } else if (resetOption === 2) {
    CalendarService.deleteAndRecreateCalendar();
  }

  SheetService.clearAllData();
  controllers_Main_initializeSystem();
  Logger.log("CONTROLLER: Hoàn tất luồng Reset Hệ thống.");
  return "Hệ thống đã được reset thành công!";
}

/**
 * Chạy luồng đồng bộ thông minh (Intelligent Sync).
 * @returns {string} Thông báo kết quả.
 */
function controllers_Main_runIntelligentSync() {
  Logger.log("CONTROLLER: Bắt đầu luồng Đồng bộ Thông minh...");

  // // 1. Tải dữ liệu mới từ API và chỉ lấy sự kiện tương lai
  const today = new Date().toISOString().split("T")[0];
  const apiEvents = ApiService.fetchAllSchedulePages(today);
  const now = new Date();
  const futureApiEvents = apiEvents.filter((e) => new Date(e.ThoiGianBD) > now);

  // // 2. Ghi dữ liệu tương lai vào sheet tạm (`_HienTai`)
  const processedFutureEvents = futureApiEvents.map((event) => ({
    ...event,
    eventHash: createEventHash(event),
    lastUpdated: new Date().toISOString(),
    daCheckIn: "",
    googleCalendarEventId: "",
  }));
  SheetService.writeToSheet(
    SHEET_NAMES.CURRENT_SCHEDULE,
    processedFutureEvents,
  );

  // 3. So sánh (Diffing)
  const oldHashes = SheetService.getFutureEventHashes(
    SHEET_NAMES.PROCESSED_SCHEDULE,
  );
  const newHashes = new Set(processedFutureEvents.map((e) => e.eventHash));

  const addedHashes = [...newHashes].filter((h) => !oldHashes.has(h));
  const deletedHashes = [...oldHashes].filter((h) => !newHashes.has(h));

  Logger.log(
    `Sync: Tìm thấy ${addedHashes.length} sự kiện mới và ${deletedHashes.length} sự kiện bị xóa.`,
  );

  if (addedHashes.length === 0 && deletedHashes.length === 0) {
    Logger.log("CONTROLLER: Không có thay đổi nào. Dừng luồng đồng bộ.");
    SheetService.clearSheet(SHEET_NAMES.CURRENT_SCHEDULE);
    return "Hoàn tất. Không có thay đổi nào được phát hiện.";
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

  // ** ++ ADDED: PHẦN THÔNG BÁO THÔNG MINH ++ **
  const properties = PropertiesService.getScriptProperties();
  const userEmail = properties.getProperty(SCRIPT_PROPERTIES_KEYS.EMAIL);
  const geminiApiKey = properties.getProperty(
    SCRIPT_PROPERTIES_KEYS.GEMINI_API_KEY,
  );
  let emailBody = "";
  const subject = `[Lịch học] Có ${
    addedHashes.length + deletedHashes.length
  } thay đổi mới`;

  try {
    if (geminiApiKey) {
      Logger.log(
        "Controller: Phát hiện có Gemini API Key. Đang gọi AI để tóm tắt...",
      );
      emailBody = GeminiService.summarizeChanges(eventsToAdd, eventsToDelete);
    } else {
      throw new Error("Không có API Key, chuyển sang thông báo thường.");
    }
  } catch (e) {
    Logger.log(
      `Controller: Không thể dùng AI (${e.message}). Tạo thông báo đơn giản.`,
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
    emailBody = `Chào bạn,\n\nHệ thống vừa phát hiện các thay đổi trong lịch học của bạn:\n\n${addedText}\n\n${deletedText}\n\nVui lòng kiểm tra lại lịch.`;
  }
  const emailFooter = `\n\n---\nĐể xem lịch gốc, vui lòng truy cập:\n${OFFICIAL_SCHEDULE_URL}`;
  emailBody += emailFooter;

  if (userEmail) {
    MailApp.sendEmail(userEmail, subject, emailBody);
    Logger.log(`Controller: Đã gửi email thông báo thay đổi đến ${userEmail}.`);
  }
  // ** KẾT THÚC PHẦN THÔNG BÁO **

  // 5. Commit dữ liệu
  SheetService.commitChanges();

  Logger.log("CONTROLLER: Hoàn tất luồng Đồng bộ Thông minh.");
  return `Đồng bộ hoàn tất: ${addedHashes.length} thêm, ${deletedHashes.length} xóa.`;
}

/**
 * Lấy dữ liệu đã được xử lý cho Dashboard.
 * @returns {object} Dữ liệu cho các biểu đồ.
 */
function controllers_Main_getDashboardData() {
  const allData = SheetService.getAllData(SHEET_NAMES.PROCESSED_SCHEDULE);
  const now = new Date();
  const pastEvents = allData.filter((e) => new Date(e.ThoiGianBD) < now);

  if (pastEvents.length === 0) {
    return { error: "Chưa có dữ liệu buổi học trong quá khứ để thống kê." };
  }

  const summaryBySubject = {};
  pastEvents.forEach((event) => {
    const subject = event.TenMonHoc;
    if (!summaryBySubject[subject]) {
      summaryBySubject[subject] = { total: 0, present: 0 };
    }
    summaryBySubject[subject].total++;
    if (String(event.daCheckIn).toLowerCase() === "true") {
      summaryBySubject[subject].present++;
    }
  });

  // Chuyển đổi sang định dạng mảng cho Google Charts
  const chartData = [["Môn học", "Tỷ lệ chuyên cần (%)"]];
  for (const subject in summaryBySubject) {
    const { total, present } = summaryBySubject[subject];
    const attendanceRate = total > 0 ? (present / total) * 100 : 0;
    chartData.push([subject, attendanceRate]);
  }

  return { chartData };
}

// =====================================================================================
// HÀM QUẢN LÝ TRIGGER
// =====================================================================================

function controllers_Main_toggleAutoSync(activate) {
  const allTriggers = ScriptApp.getProjectTriggers();
  allTriggers.forEach((trigger) => {
    if (trigger.getHandlerFunction() === HANDLER_FUNCTIONS.AUTO_SYNC_TRIGGER) {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  if (activate) {
    ScriptApp.newTrigger(HANDLER_FUNCTIONS.AUTO_SYNC_TRIGGER)
      .timeBased()
      .everyMinutes(TRIGGER_INTERVAL_MINUTES)
      .create();
    PropertiesService.getScriptProperties().setProperty(
      SCRIPT_PROPERTIES_KEYS.IS_AUTO_SYNC_ACTIVE,
      "true",
    );
    return `Đã kích hoạt đồng bộ tự động.`;
  } else {
    PropertiesService.getScriptProperties().setProperty(
      SCRIPT_PROPERTIES_KEYS.IS_AUTO_SYNC_ACTIVE,
      "false",
    );
    return "Đã tạm dừng đồng bộ tự động.";
  }
}

function controllers_Main_triggerHandler() {
  const properties = PropertiesService.getScriptProperties();
  const syncTimesRaw =
    properties.getProperty(SCRIPT_PROPERTIES_KEYS.SYNC_TIMES) || "[]";
  const syncTimes = JSON.parse(syncTimesRaw);
  if (syncTimes.length === 0) return;

  const now = getVietnamTime();
  const currentTimeString = formatToHourMinute(now);
  const roundedCurrentTime = roundTimeDownTo15Minutes(currentTimeString);

  if (syncTimes.includes(roundedCurrentTime)) {
    Logger.log(">>> TRÚNG THỜI ĐIỂM SYNC! Bắt đầu chạy đồng bộ thông minh...");
    controllers_Main_runIntelligentSync();
  }
}
