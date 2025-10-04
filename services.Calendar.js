/**
 * @file services.Calendar.js
 * @description Lớp dịch vụ quản lý tất cả các tương tác với Google Calendar.
 * Bao gồm logic tự động tạo và phục hồi (self-healing) cho Calendar.
 */

class CalendarService {
  /**
   * Lấy về đối tượng Calendar đang được sử dụng.
   * Đây là hàm cốt lõi của logic "Tự phục hồi".
   * @private
   * @returns {GoogleAppsScript.Calendar.Calendar} Đối tượng Calendar hợp lệ.
   */
  static _getCalendar() {
    const properties = PropertiesService.getScriptProperties();
    const calendarId = properties.getProperty(
      SCRIPT_PROPERTIES_KEYS.CALENDAR_ID,
    );

    if (calendarId) {
      try {
        const calendar = CalendarApp.getCalendarById(calendarId);
        // Thử một hành động nhỏ để chắc chắn có quyền truy cập
        calendar.getName();
        Logger.log(
          `CalendarService: Đã truy cập thành công Calendar ID: ${calendarId}`,
        );
        return calendar;
      } catch (e) {
        Logger.log(
          `CalendarService: LỖI - Không thể truy cập Calendar ID ${calendarId}. Lỗi: ${e.message}. Sẽ tạo calendar mới.`,
        );
      }
    }

    // Nếu không có ID hoặc truy cập lỗi, tạo calendar mới
    Logger.log("CalendarService: Đang tạo Google Calendar mới...");
    const newCalendar = CalendarApp.createCalendar("Lịch Học LHU [Tự động]");
    const newId = newCalendar.getId();
    properties.setProperty(SCRIPT_PROPERTIES_KEYS.CALENDAR_ID, newId);
    Logger.log(`CalendarService: Đã tạo và lưu Calendar mới với ID: ${newId}`);
    return newCalendar;
  }

  /**
   * Xây dựng chi tiết sự kiện (tiêu đề, mô tả, link check-in) từ dữ liệu thô.
   * @private
   * @param {object} eventData - Dữ liệu của một buổi học từ Sheet.
   * @returns {{title: string, options: object}} - Tiêu đề và các tùy chọn cho sự kiện.
   */
  static _buildEventDetails(eventData) {
    const properties = PropertiesService.getScriptProperties(); // ++ ADDED
    const customWebAppUrl = properties.getProperty(
      SCRIPT_PROPERTIES_KEYS.WEBAPP_URL,
    ); // ++ ADDED

    // ** MODIFIED: Ưu tiên link người dùng nhập, nếu không có thì lấy link tự động
    const webAppUrl = customWebAppUrl || ScriptApp.getService().getUrl();

    const checkinLink = `${webAppUrl}?page=checkin&hash=${eventData.eventHash}`;

    const title = `[${eventData.TenPhong}] ${eventData.TenMonHoc}`;
    const loaiBuoi = eventData.Type === 0 ? "Lý thuyết" : "Thực hành";

    const description = `--- CHI TIẾT BUỔI HỌC ---
Môn học: ${eventData.TenMonHoc}
Lớp học phần: ${eventData.TenNhom}
Giáo viên: ${eventData.GiaoVien}

Địa điểm: ${eventData.TenPhong} (${eventData.TenCoSo})
Loại: ${loaiBuoi}

--- TƯƠNG TÁC ---
➡️ Nhấn vào đây để Check-in: ${checkinLink}
--- THAM KHẢO ---
➡️ Xem lịch gốc của trường: ${OFFICIAL_SCHEDULE_URL}
➡️ Truy cập Bảng điều khiển: ${webAppUrl}`.trim(); // ++ ADDED

    const options = { description: description };

    // ** MODIFIED: Logic tô màu chính xác cho lịch thi
    if (String(eventData.calenType) === "2") {
      options.color = CalendarApp.EventColor.RED;
    }

    return { title, options };
  }

  /**
   * ** MODIFIED: Không tạo sự kiện trực tiếp nữa.
   * Thay vào đó, nó chuẩn bị hàng đợi và kích hoạt trigger đầu tiên.
   */
  static createEventsInBatch(eventsData) {
    if (!eventsData || eventsData.length === 0) {
      return { success: true, message: "Không có sự kiện mới nào để tạo." };
    }

    const properties = PropertiesService.getScriptProperties();
    const batchSize = parseInt(
      properties.getProperty(SCRIPT_PROPERTIES_KEYS.EVENT_BATCH_SIZE) ||
        DEFAULT_SETTINGS.EVENT_BATCH_SIZE,
    );

    // Chia mảng sự kiện thành các lô nhỏ
    const batches = [];
    for (let i = 0; i < eventsData.length; i += batchSize) {
      batches.push(eventsData.slice(i, i + batchSize));
    }

    Logger.log(
      `CalendarService: Đã chia ${eventsData.length} sự kiện thành ${batches.length} lô.`,
    );

    // Lưu hàng đợi vào PropertiesService
    properties.setProperty(
      SCRIPT_PROPERTIES_KEYS.BATCH_QUEUE,
      JSON.stringify(batches),
    );

    // Xóa trigger cũ nếu có để tránh trùng lặp
    ScriptApp.getProjectTriggers().forEach((trigger) => {
      if (trigger.getHandlerFunction() === HANDLER_FUNCTIONS.PROCESS_BATCH) {
        ScriptApp.deleteTrigger(trigger);
      }
    });

    // Tạo trigger để xử lý lô đầu tiên gần như ngay lập tức
    ScriptApp.newTrigger(HANDLER_FUNCTIONS.PROCESS_BATCH)
      .timeBased()
      .after(10 * 1000) // 10 giây
      .create();

    Logger.log("CalendarService: Đã kích hoạt trigger để xử lý lô đầu tiên.");
    return {
      success: true,
      message: `Bắt đầu tạo ${eventsData.length} sự kiện trong nền...`,
    };
  }

  /**
   * Xóa tất cả các sự kiện của hệ thống dựa trên danh sách eventId.
   * Dùng cho chức năng "Reset an toàn".
   * @param {string[]} eventIds - Mảng các googleCalendarEventId cần xóa.
   */
  static clearSystemEvents(eventIds) {
    if (!eventIds || eventIds.length === 0) return;
    const calendar = this._getCalendar();
    Logger.log(
      `CalendarService: Bắt đầu xóa ${eventIds.length} sự kiện hệ thống...`,
    );

    for (const eventId of eventIds) {
      if (!eventId) continue;
      try {
        const event = calendar.getEventById(eventId);
        if (event) {
          event.deleteEvent();
          Logger.log(`🗑️ Đã xóa sự kiện ID: ${eventId}`);
          Utilities.sleep(300); // Tạm nghỉ 0.3 giây
        }
      } catch (e) {
        // Bỏ qua lỗi nếu sự kiện không tồn tại (có thể đã bị xóa thủ công)
        Logger.log(
          `Lỗi nhỏ khi xóa sự kiện ID ${eventId} (có thể đã bị xóa): ${e.message}`,
        );
      }
    }
    Logger.log("CalendarService: Hoàn tất xóa sự kiện hệ thống.");
  }

  /**
   * Xóa toàn bộ calendar và tạo lại một cái mới.
   * Dùng cho chức năng "Reset nhanh".
   */
  static deleteAndRecreateCalendar() {
    const properties = PropertiesService.getScriptProperties();
    const calendarId = properties.getProperty(
      SCRIPT_PROPERTIES_KEYS.CALENDAR_ID,
    );

    if (calendarId) {
      try {
        const calendar = CalendarApp.getCalendarById(calendarId);
        calendar.deleteCalendar();
        Logger.log(
          `CalendarService: Đã xóa thành công Calendar cũ ID: ${calendarId}`,
        );
      } catch (e) {
        Logger.log(
          `CalendarService: Lỗi khi xóa Calendar cũ ID ${calendarId}: ${e.message}`,
        );
      }
    }

    // Xóa ID cũ và để hàm _getCalendar() tự tạo cái mới
    properties.deleteProperty(SCRIPT_PROPERTIES_KEYS.CALENDAR_ID);
    Logger.log("CalendarService: Đang yêu cầu tạo Calendar mới...");
    this._getCalendar(); // Gọi hàm này để kích hoạt việc tạo mới và lưu ID
  }
}
