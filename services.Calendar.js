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
    const calendarId = properties.getProperty(SCRIPT_PROPERTIES_KEYS.CALENDAR_ID);

    if (calendarId) {
      try {
        const calendar = CalendarApp.getCalendarById(calendarId);
        // Thử một hành động nhỏ để chắc chắn có quyền truy cập
        calendar.getName(); 
        Logger.log(`CalendarService: Đã truy cập thành công Calendar ID: ${calendarId}`);
        return calendar;
      } catch (e) {
        Logger.log(`CalendarService: LỖI - Không thể truy cập Calendar ID ${calendarId}. Lỗi: ${e.message}. Sẽ tạo calendar mới.`);
      }
    }

    // Nếu không có ID hoặc truy cập lỗi, tạo calendar mới
    Logger.log('CalendarService: Đang tạo Google Calendar mới...');
    const newCalendar = CalendarApp.createCalendar('Lịch Học LHU [Tự động]');
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
    const webAppUrl = ScriptApp.getService().getUrl();
    // Chèn eventHash vào link để backend có thể tìm lại sự kiện trong sheet
    const checkinLink = `${webAppUrl}?page=checkin&hash=${eventData.eventHash}`;
    
    const title = `[${eventData.TenPhong}] ${eventData.TenMonHoc}`;
    const loaiBuoi = eventData.Type === 0 ? 'Lý thuyết' : 'Thực hành';
    
    const description = `--- CHI TIẾT BUỔI HỌC ---
Môn học: ${eventData.TenMonHoc}
Lớp học phần: ${eventData.TenNhom}
Giáo viên: ${eventData.GiaoVien}

Địa điểm: ${eventData.TenPhong} (${eventData.TenCoSo})
Loại: ${loaiBuoi}

--- TƯƠNG TÁC ---
➡️ Nhấn vào đây để Check-in: ${checkinLink}
--- THAM KHẢO ---
➡️ Xem lịch gốc của trường: ${OFFICIAL_SCHEDULE_URL}`
    
    return {
      title,
      options: { description: description.trim() },
    };
  }

  /**
   * Tạo một loạt sự kiện trên Google Calendar từ dữ liệu được cung cấp.
   * @param {Object[]} eventsData - Mảng các đối tượng sự kiện đọc từ Sheet.
   * @returns {Object[]} Mảng các đối tượng chứa { eventHash, newEventId } để cập nhật lại vào Sheet.
   */
  static createEventsInBatch(eventsData) {
    if (!eventsData || eventsData.length === 0) {
      return [];
    }
    const calendar = this._getCalendar();
    const updatesForSheet = [];

    Logger.log(`CalendarService: Bắt đầu tạo ${eventsData.length} sự kiện...`);

    for (const eventData of eventsData) {
      try {
        const startTime = new Date(eventData.ThoiGianBD);
        const endTime = new Date(eventData.ThoiGianKT);

        // Bỏ qua các sự kiện có thời gian không hợp lệ
        if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
          Logger.log(`Lỗi: Thời gian không hợp lệ cho sự kiện ${eventData.TenMonHoc}. Bỏ qua.`);
          continue;
        }

        const { title, options } = this._buildEventDetails(eventData);
        const newEvent = calendar.createEvent(title, startTime, endTime, options);
        
        updatesForSheet.push({
          eventHash: eventData.eventHash,
          newEventId: newEvent.getId(),
        });
        
        Logger.log(`✅ Đã tạo: ${title}`);
        Utilities.sleep(500); // Tạm nghỉ 0.5 giây để tránh vượt giới hạn API
      } catch (e) {
        Logger.log(`❌ Lỗi khi tạo sự kiện cho môn '${eventData.TenMonHoc}': ${e.message}`);
      }
    }
    
    Logger.log(`CalendarService: Hoàn tất tạo sự kiện. Thành công: ${updatesForSheet.length}/${eventsData.length}.`);
    return updatesForSheet;
  }

  /**
   * Xóa tất cả các sự kiện của hệ thống dựa trên danh sách eventId.
   * Dùng cho chức năng "Reset an toàn".
   * @param {string[]} eventIds - Mảng các googleCalendarEventId cần xóa.
   */
  static clearSystemEvents(eventIds) {
    if (!eventIds || eventIds.length === 0) return;
    const calendar = this._getCalendar();
    Logger.log(`CalendarService: Bắt đầu xóa ${eventIds.length} sự kiện hệ thống...`);

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
        Logger.log(`Lỗi nhỏ khi xóa sự kiện ID ${eventId} (có thể đã bị xóa): ${e.message}`);
      }
    }
    Logger.log('CalendarService: Hoàn tất xóa sự kiện hệ thống.');
  }

  /**
   * Xóa toàn bộ calendar và tạo lại một cái mới.
   * Dùng cho chức năng "Reset nhanh".
   */
  static deleteAndRecreateCalendar() {
    const properties = PropertiesService.getScriptProperties();
    const calendarId = properties.getProperty(SCRIPT_PROPERTIES_KEYS.CALENDAR_ID);

    if (calendarId) {
      try {
        const calendar = CalendarApp.getCalendarById(calendarId);
        calendar.deleteCalendar();
        Logger.log(`CalendarService: Đã xóa thành công Calendar cũ ID: ${calendarId}`);
      } catch (e) {
        Logger.log(`CalendarService: Lỗi khi xóa Calendar cũ ID ${calendarId}: ${e.message}`);
      }
    }
    
    // Xóa ID cũ và để hàm _getCalendar() tự tạo cái mới
    properties.deleteProperty(SCRIPT_PROPERTIES_KEYS.CALENDAR_ID);
    Logger.log('CalendarService: Đang yêu cầu tạo Calendar mới...');
    this._getCalendar(); // Gọi hàm này để kích hoạt việc tạo mới và lưu ID
  }
}