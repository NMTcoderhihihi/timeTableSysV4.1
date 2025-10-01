/**
 * @file services.Api.js
 * @description Lớp dịch vụ chỉ chịu trách nhiệm giao tiếp với API lịch học của trường.
 * Bao gồm cơ chế thử lại (retry) để tăng độ ổn định.
 */

class ApiService {

  /**
   * Hàm nội bộ để thực hiện fetch với cơ chế thử lại.
   * @private
   * @param {string} url - URL của API.
   * @param {object} options - Các tùy chọn cho request.
   * @returns {GoogleAppsScript.URL_Fetch.HTTPResponse} Đối tượng response nếu thành công.
   * @throws {Error} Ném lỗi nếu thất bại sau tất cả các lần thử.
   */
  static _fetchWithRetry(url, options) {
    const properties = PropertiesService.getScriptProperties();
    const maxRetries = parseInt(properties.getProperty(SCRIPT_PROPERTIES_KEYS.MAX_RETRIES) || DEFAULT_SETTINGS.MAX_RETRIES);
    const retryDelaySeconds = parseInt(properties.getProperty(SCRIPT_PROPERTIES_KEYS.RETRY_DELAY_SECONDS) || DEFAULT_SETTINGS.RETRY_DELAY_SECONDS);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        Logger.log(`ApiService: Đang gọi API, lần thử ${attempt}/${maxRetries}...`);
        const response = UrlFetchApp.fetch(url, options);

        if (response.getResponseCode() >= 500) {
          throw new Error(`Server trả về lỗi: ${response.getResponseCode()}`);
        }
        Logger.log(`ApiService: Gọi API thành công ở lần thử ${attempt}.`);
        return response;
      } catch (e) {
        Logger.log(`ApiService: Lỗi khi gọi API lần thử ${attempt}: ${e.toString()}`);
        if (attempt >= maxRetries) {
          Logger.log(`ApiService: Đã hết số lần thử lại. Ném lỗi ra ngoài.`);
          throw new Error(`Không thể kết nối tới API sau ${maxRetries} lần thử.`);
        }
        Logger.log(`ApiService: Sẽ thử lại sau ${retryDelaySeconds} giây...`);
        Utilities.sleep(retryDelaySeconds * 1000);
      }
    }
  }
  
  /**
   * Xây dựng các tùy chọn cho yêu cầu fetch.
   * @private
   * @param {number} pageIndex - Số trang cần lấy.
   * @param {string} studentId - Mã số sinh viên.
   * @param {number} pageSize - Kích thước trang.
   * @param {string} startDateIso - Ngày bắt đầu lấy dữ liệu (chuỗi ISO).
   * @returns {object} Đối tượng tùy chọn cho UrlFetchApp.
   */
  static _buildRequestOptions(pageIndex, studentId, pageSize, startDateIso) {
    const payload = {
      StudentID: studentId,
      Ngay: startDateIso,
      PageIndex: pageIndex,
      PageSize: pageSize,
    };
    return {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: false, // Để false để try...catch có thể bắt lỗi
    };
  }

  /**
   * Lấy dữ liệu lịch học từ tất cả các trang của API.
   * @param {string} startDateIso - Ngày bắt đầu lấy dữ liệu (định dạng YYYY-MM-DD).
   * @returns {Object[]} Mảng các đối tượng sự kiện thô từ API.
   */
  static fetchAllSchedulePages(startDateIso) {
    const properties = PropertiesService.getScriptProperties();
    const studentId = properties.getProperty(SCRIPT_PROPERTIES_KEYS.STUDENT_ID);
    const pageSize = parseInt(properties.getProperty(SCRIPT_PROPERTIES_KEYS.PAGE_SIZE) || DEFAULT_SETTINGS.PAGE_SIZE);

    if (!studentId) {
      throw new Error('Mã số sinh viên chưa được cấu hình.');
    }

    Logger.log(`ApiService: Bắt đầu lấy lịch học. MSSV: ${studentId}, Ngày BĐ: ${startDateIso}`);
    let allEvents = [];

    try {
      // Gọi trang đầu tiên để lấy tổng số trang
      const initialOptions = this._buildRequestOptions(1, studentId, pageSize, startDateIso);
      const initialResponse = this._fetchWithRetry(API_URL, initialOptions);
      const initialJson = JSON.parse(initialResponse.getContentText());

      if (!initialJson || !initialJson.data || initialJson.data.length < 3) {
        Logger.log("ApiService: Lỗi - API trả về dữ liệu không đúng cấu trúc ở lần gọi đầu tiên.");
        return [];
      }

      allEvents = allEvents.concat(initialJson.data[2]);
      const totalRecords = initialJson.data[1][0].TotalRecord;
      const totalPages = Math.ceil(totalRecords / pageSize);
      Logger.log(`ApiService: Tìm thấy ${totalRecords} buổi học, tương ứng ${totalPages} trang.`);

      // Lặp qua các trang còn lại
      for (let page = 2; page <= totalPages; page++) {
        const pageOptions = this._buildRequestOptions(page, studentId, pageSize, startDateIso);
        const pageResponse = this._fetchWithRetry(API_URL, pageOptions);
        const pageJson = JSON.parse(pageResponse.getContentText());
        if (pageJson && pageJson.data && pageJson.data.length >= 3) {
          allEvents = allEvents.concat(pageJson.data[2]);
        }
      }

      Logger.log(`ApiService: Hoàn tất. Đã lấy được tổng cộng ${allEvents.length} sự kiện.`);
      return allEvents;
    } catch (e) {
      Logger.log(`ApiService: LỖI NGHIÊM TRỌNG khi lấy dữ liệu API: ${e.toString()}`);
      // Ném lại lỗi để Controller có thể bắt và thông báo cho người dùng
      throw new Error(`Không thể lấy dữ liệu từ máy chủ LHU. Vui lòng thử lại sau. Chi tiết: ${e.message}`);
    }
  }
}