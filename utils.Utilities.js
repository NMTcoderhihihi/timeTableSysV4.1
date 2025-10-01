/**
 * @file utils.Utilities.js
 * @description Chứa các hàm tiện ích chung, độc lập, được sử dụng trong toàn bộ dự án.
 */

// =====================================================================================
// HÀM HASHING - TẠO MÃ ĐỊNH DANH DUY NHẤT CHO SỰ KIỆN
// =====================================================================================

/**
 * Tạo ra một chuỗi hash (mã định danh) duy nhất cho một sự kiện dựa trên các thuộc tính cốt lõi.
 * Bất kỳ thay đổi nào trong các thuộc tính này (môn học, thời gian, địa điểm) sẽ tạo ra một hash khác.
 * Điều này là nền tảng cho việc so sánh và phát hiện thay đổi.
 * @param {object} eventData - Đối tượng sự kiện lấy từ API.
 * @returns {string} Một chuỗi MD5 hash.
 */
function createEventHash(eventData) {
  const coreProperties = [
    eventData.MaMonHoc,
    eventData.TenNhom,
    eventData.ToThucHanh,
    eventData.ThoiGianBD,
    eventData.ThoiGianKT,
    eventData.TenPhong,
    eventData.TenCoSo,
    eventData.GiaoVien,
    eventData.Type,
  ];

  const stringToHash = coreProperties.join('|');
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, stringToHash, Utilities.Charset.UTF_8);
  
  // Chuyển đổi mảng byte thành chuỗi hex
  return digest.map(byte => {
    const hex = (byte & 0xFF).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

// =====================================================================================
// HÀM TIỆN ÍCH VỀ THỜI GIAN
// =====================================================================================

/**
 * Lấy đối tượng Date hiện tại theo múi giờ Việt Nam.
 * @returns {Date} Đối tượng Date đã được điều chỉnh theo múi giờ VN.
 */
function getVietnamTime() {
  return new Date(); // Apps Script V8 runtime mặc định theo múi giờ của script (đã set trong appsscript.json)
}

/**
 * Định dạng một đối tượng Date thành chuỗi "HH:mm".
 * @param {Date} date - Đối tượng Date cần định dạng.
 * @returns {string} Chuỗi thời gian theo định dạng "HH:mm".
 */
function formatToHourMinute(date) {
  return Utilities.formatDate(date, TIMEZONE, 'HH:mm');
}

/**
 * Làm tròn một chuỗi thời gian (ví dụ: "07:08") xuống mốc 15 phút gần nhất.
 * Ví dụ: "07:08" -> "07:00", "07:50" -> "07:45", "07:15" -> "07:15".
 * @param {string} timeString - Chuỗi thời gian đầu vào, định dạng "HH:mm".
 * @returns {string} Chuỗi thời gian đã được làm tròn.
 */
function roundTimeDownTo15Minutes(timeString) {
  if (!timeString || !/^\d{2}:\d{2}$/.test(timeString)) {
    return ""; // Trả về rỗng nếu định dạng không hợp lệ
  }
  
  const [hours, minutes] = timeString.split(':').map(Number);
  
  const roundedMinutes = Math.floor(minutes / 15) * 15;
  
  const formattedHours = hours.toString().padStart(2, '0');
  const formattedMinutes = roundedMinutes.toString().padStart(2, '0');
  
  return `${formattedHours}:${formattedMinutes}`;
}