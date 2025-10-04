/**
 * @file controllers.Main.js
 * @description Controller chính, xử lý hầu hết các yêu cầu từ giao diện người dùng
 * và điều phối các services để thực hiện các luồng nghiệp vụ.
 */

// =====================================================================================
// HÀM QUẢN LÝ KHÓA TRẠNG THÁI
// =====================================================================================

/**
 * ** MODIFIED: Logic khóa được viết lại hoàn toàn để sử dụng khóa trạng thái.
 * Thực thi một hành động sau khi kiểm tra và đặt trạng thái hệ thống thành 'PROCESSING'.
 * @param {Function} action - Hàm cần thực thi.
 * @returns {*} Kết quả trả về của hàm action.
 */
function runLockedTask(action) {
  const properties = PropertiesService.getScriptProperties();
  const currentState = properties.getProperty(
    SCRIPT_PROPERTIES_KEYS.SYSTEM_STATE,
  );

  if (currentState === "PROCESSING") {
    throw new Error(
      "Hệ thống đang bận xử lý một tác vụ nền. Vui lòng đợi hoàn tất rồi thử lại.",
    );
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    throw new Error(
      "Không thể lấy được khóa tài nguyên tạm thời. Vui lòng thử lại sau giây lát.",
    );
  }

  try {
    // Đặt trạng thái thành bận
    properties.setProperty(SCRIPT_PROPERTIES_KEYS.SYSTEM_STATE, "PROCESSING");
    Logger.log("SYSTEM STATE SET TO: PROCESSING");

    // Thực thi hành động chính
    return action();
  } finally {
    // Lưu ý: Không trả trạng thái về IDLE ở đây.
    // Việc này sẽ do hàm xử lý lô cuối cùng hoặc hàm forceKill thực hiện.
    lock.releaseLock();
  }
}

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

  const isProcessing =
    properties.getProperty(SCRIPT_PROPERTIES_KEYS.SYSTEM_STATE) ===
    "PROCESSING"; // ++ ADDED
  return { isConfigured, isInitialized, isAutoSyncActive, isProcessing }; // ** MODIFIED
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
      properties.getProperty(SCRIPT_PROPERTIES_KEYS.SYNC_START_DATE) || "",
    eventBatchSize:
      properties.getProperty(SCRIPT_PROPERTIES_KEYS.EVENT_BATCH_SIZE) ||
      DEFAULT_SETTINGS.EVENT_BATCH_SIZE,
    batchDelayMinutes:
      properties.getProperty(SCRIPT_PROPERTIES_KEYS.BATCH_DELAY_MINUTES) ||
      DEFAULT_SETTINGS.BATCH_DELAY_MINUTES,
    geminiApiKey:
      properties.getProperty(SCRIPT_PROPERTIES_KEYS.GEMINI_API_KEY) || "",
    geminiTone:
      properties.getProperty(SCRIPT_PROPERTIES_KEYS.GEMINI_TONE) || "friendly",
    webappUrl: properties.getProperty(SCRIPT_PROPERTIES_KEYS.WEBAPP_URL) || "",
  };
}

function controllers_Main_saveSettings(settings) {
  return runLockedTask(() => {
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
      [SCRIPT_PROPERTIES_KEYS.SYNC_START_DATE]: settings.syncStartDate || "",
      [SCRIPT_PROPERTIES_KEYS.EVENT_BATCH_SIZE]:
        settings.eventBatchSize || DEFAULT_SETTINGS.EVENT_BATCH_SIZE,
      [SCRIPT_PROPERTIES_KEYS.BATCH_DELAY_MINUTES]:
        settings.batchDelayMinutes || DEFAULT_SETTINGS.BATCH_DELAY_MINUTES,
      [SCRIPT_PROPERTIES_KEYS.GEMINI_API_KEY]: settings.geminiApiKey
        ? settings.geminiApiKey.trim()
        : "",
      [SCRIPT_PROPERTIES_KEYS.GEMINI_TONE]: settings.geminiTone || "friendly", // ++ ADDED
      [SCRIPT_PROPERTIES_KEYS.WEBAPP_URL]: settings.webappUrl
        ? settings.webappUrl.trim()
        : "",
    };

    properties.setProperties(propertiesToSet, false);
    return "Lưu cài đặt thành công!";
  });
}

function controllers_Main_initializeSystem() {
  return runLockedTask(() => {
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
    const result = CalendarService.createEventsInBatch(processedEvents);

    Logger.log("CONTROLLER: Hoàn tất luồng Khởi tạo Hệ thống.");
    return result.message;
  });
}

function controllers_Main_resetSystem(resetOption) {
  return runLockedTask(() => {
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
    return "Hệ thống đã được reset và đang khởi tạo lại trong nền.";
  });
}

/**
 * Chạy luồng đồng bộ thông minh (Intelligent Sync).
 * @returns {string} Thông báo kết quả.
 */
function controllers_Main_runIntelligentSync() {
  return runLockedTask(() => {
    Logger.log("CONTROLLER: Bắt đầu luồng Đồng bộ Thông minh...");

    // // 1. Tải dữ liệu mới từ API và chỉ lấy sự kiện tương lai
    const today = new Date().toISOString().split("T")[0];
    const apiEvents = ApiService.fetchAllSchedulePages(today);
    const now = new Date();
    const futureApiEvents = apiEvents.filter(
      (e) => new Date(e.ThoiGianBD) > now,
    );

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
    const geminiTone =
      properties.getProperty(SCRIPT_PROPERTIES_KEYS.GEMINI_TONE) || "friendly"; // ++ ADDED
    const webappUrl =
      properties.getProperty(SCRIPT_PROPERTIES_KEYS.WEBAPP_URL) ||
      ScriptApp.getService().getUrl(); // ++ ADDED
    let emailBody = "";
    const subject = `[Lịch học] Có ${
      addedHashes.length + deletedHashes.length
    } thay đổi mới`;

    try {
      if (geminiApiKey) {
        Logger.log(
          "Controller: Phát hiện có Gemini API Key. Đang gọi AI để tóm tắt...",
        );
        emailBody = GeminiService.summarizeChanges(
          eventsToAdd,
          deletedEvents,
          geminiTone,
        );
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
          ? `CÁC BUỔI HỌC BỊ HỦY:\n${eventsToDelete
              .map(formatEvent)
              .join("\n")}`
          : "";
      emailBody = `Chào bạn,\n\nHệ thống vừa phát hiện các thay đổi trong lịch học của bạn:\n\n${addedText}\n\n${deletedText}\n\nVui lòng kiểm tra lại lịch.`;
    }
    const emailFooter = `\n\n---\nĐể xem lịch gốc, vui lòng truy cập:\n${OFFICIAL_SCHEDULE_URL}\n\nĐể quản lý hệ thống, truy cập:\n${webappUrl}`;
    emailBody += emailFooter;

    if (userEmail) {
      MailApp.sendEmail(userEmail, subject, emailBody);
      Logger.log(
        `Controller: Đã gửi email thông báo thay đổi đến ${userEmail}.`,
      );
    }
    // ** KẾT THÚC PHẦN THÔNG BÁO **

    // 5. Commit dữ liệu
    SheetService.commitChanges();

    Logger.log("CONTROLLER: Hoàn tất luồng Đồng bộ Thông minh.");
    return `Đồng bộ hoàn tất: ${addedHashes.length} thêm, ${deletedHashes.length} xóa. ${result.message}`;
  });
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
      summaryBySubject[subject] = { total: 0, present: 0, absent: 0 };
    }
    summaryBySubject[subject].total++;
    if (String(event.daCheckIn).toLowerCase() === "true") {
      summaryBySubject[subject].present++;
    } else {
      summaryBySubject[subject].absent++;
    }
  });

  // Chuyển đổi sang định dạng mảng cho Google Charts
  const dashboardData = [];
  for (const subject in summaryBySubject) {
    const { total, present, absent } = summaryBySubject[subject];
    const attendanceRate = total > 0 ? Math.round((present / total) * 100) : 0;
    dashboardData.push({
      subject,
      total,
      present,
      absent,
      rate: attendanceRate,
    });
  }

  // ++ ADDED: Ghi log dữ liệu để dò lỗi
  Logger.log(`Dashboard Data Sent to UI: ${JSON.stringify(dashboardData)}`);

  return { dashboardData };
}

// =====================================================================================
// HÀM XỬ LÝ NỀN (BACKGROUND) & TRIGGER
// =====================================================================================

/**
 * Hàm xử lý lô sự kiện, được gọi bởi trigger động.
 */
function controllers_Main_processEventBatch() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(300000)) {
    // Khóa 5 phút để xử lý
    Logger.log(
      "PROCESS_BATCH: Không thể lấy khóa, có thể một luồng khác đang chạy. Bỏ qua lần này.",
    );
    return;
  }

  try {
    const properties = PropertiesService.getScriptProperties();
    const queueRaw = properties.getProperty(SCRIPT_PROPERTIES_KEYS.BATCH_QUEUE);
    if (!queueRaw) {
      Logger.log("PROCESS_BATCH: Hàng đợi rỗng. Dọn dẹp trigger và kết thúc.");
      cleanupTriggers(HANDLER_FUNCTIONS.PROCESS_BATCH);
      return;
    }

    const queue = JSON.parse(queueRaw);
    const batchToProcess = queue.shift(); // Lấy lô đầu tiên ra khỏi hàng đợi

    if (!batchToProcess || batchToProcess.length === 0) {
      Logger.log("PROCESS_BATCH: Hàng đợi rỗng sau khi parse. Kết thúc.");
      properties.deleteProperty(SCRIPT_PROPERTIES_KEYS.BATCH_QUEUE);
      cleanupTriggers(HANDLER_FUNCTIONS.PROCESS_BATCH);
      return;
    }

    Logger.log(
      `PROCESS_BATCH: Đang xử lý ${batchToProcess.length} sự kiện. Còn lại ${queue.length} lô.`,
    );

    const calendar = CalendarService._getCalendar();
    const updatesForSheet = [];

    batchToProcess.forEach((eventData) => {
      try {
        const startTime = new Date(eventData.ThoiGianBD);
        const endTime = new Date(eventData.ThoiGianKT);

        if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
          Logger.log(
            `Lỗi: Thời gian không hợp lệ cho sự kiện ${eventData.TenMonHoc}. Bỏ qua.`,
          );
          return;
        }

        const { title, options } =
          CalendarService._buildEventDetails(eventData);
        const newEvent = calendar.createEvent(
          title,
          startTime,
          endTime,
          options,
        );

        updatesForSheet.push({
          eventHash: eventData.eventHash,
          newEventId: newEvent.getId(),
        });

        Logger.log(`✅ Đã tạo sự kiện: ${title}`);
        Utilities.sleep(500);
      } catch (e) {
        Logger.log(
          `❌ Lỗi khi tạo sự kiện '${eventData.TenMonHoc}': ${e.message}`,
        );
      }
    });

    if (updatesForSheet.length > 0) {
      Logger.log(
        `PROCESS_BATCH: Đang cập nhật ${updatesForSheet.length} Event ID vào Google Sheet.`,
      );
      SheetService.updateEventIds(
        SHEET_NAMES.PROCESSED_SCHEDULE,
        updatesForSheet,
      );
    }

    if (queue.length > 0) {
      properties.setProperty(
        SCRIPT_PROPERTIES_KEYS.BATCH_QUEUE,
        JSON.stringify(queue),
      );
      const delay = parseInt(
        properties.getProperty(SCRIPT_PROPERTIES_KEYS.BATCH_DELAY_MINUTES) ||
          DEFAULT_SETTINGS.BATCH_DELAY_MINUTES,
      );

      cleanupTriggers(HANDLER_FUNCTIONS.PROCESS_BATCH); // Xóa trigger cũ trước khi tạo mới

      ScriptApp.newTrigger(HANDLER_FUNCTIONS.PROCESS_BATCH)
        .timeBased()
        .after(delay * 60 * 1000)
        .create();
      Logger.log(
        `PROCESS_BATCH: Đã lên lịch cho lô tiếp theo sau ${delay} phút.`,
      );
    } else {
      properties.deleteProperty(SCRIPT_PROPERTIES_KEYS.BATCH_QUEUE);
      cleanupTriggers(HANDLER_FUNCTIONS.PROCESS_BATCH);
      // ** QUAN TRỌNG: Mở khóa hệ thống khi xong việc
      properties.setProperty(SCRIPT_PROPERTIES_KEYS.SYSTEM_STATE, "IDLE");
      Logger.log("PROCESS_BATCH: Hoàn tất! SYSTEM STATE SET TO: IDLE");
    }
  } finally {
    lock.releaseLock();
  }
}

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
/**
 * Hàm dừng khẩn cấp, không bị khóa.
 */
function controllers_Main_forceKillSystem() {
  Logger.log("!!! KÍCH HOẠT DỪNG KHẨN CẤP !!!");

  cleanupTriggers();
  Logger.log("Đã xóa tất cả trigger.");

  const properties = PropertiesService.getScriptProperties();
  properties.deleteProperty(SCRIPT_PROPERTIES_KEYS.BATCH_QUEUE);
  Logger.log("Đã xóa hàng đợi đang xử lý.");

  // ** QUAN TRỌNG: Mở khóa hệ thống
  properties.setProperty(SCRIPT_PROPERTIES_KEYS.SYSTEM_STATE, "IDLE");
  Logger.log("Đã xóa hàng đợi và MỞ KHÓA HỆ THỐNG (STATE = IDLE).");

  properties.deleteProperty(SCRIPT_PROPERTIES_KEYS.SPREADSHEET_ID);
  properties.deleteProperty(SCRIPT_PROPERTIES_KEYS.CALENDAR_ID);
  properties.setProperty(SCRIPT_PROPERTIES_KEYS.IS_AUTO_SYNC_ACTIVE, "false");
  Logger.log("Đã đưa hệ thống về trạng thái chưa khởi tạo.");

  return "Hệ thống đã được dừng khẩn cấp và reset về trạng thái ban đầu.";
}

/**
 * Dọn dẹp trigger theo tên hàm.
 * @param {string} [handlerFunction] - Tên hàm của trigger cần xóa. Nếu để trống, xóa tất cả.
 */
function cleanupTriggers(handlerFunction) {
  const triggers = ScriptApp.getProjectTriggers();
  let deletedCount = 0;
  triggers.forEach((trigger) => {
    if (!handlerFunction || trigger.getHandlerFunction() === handlerFunction) {
      ScriptApp.deleteTrigger(trigger);
      deletedCount++;
    }
  });
  Logger.log(`Đã xóa ${deletedCount} trigger.`);
}
