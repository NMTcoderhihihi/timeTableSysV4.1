/**
 * @file utils.Config.js
 * @description Chứa tất cả các hằng số cấu hình và khóa cài đặt cho hệ thống.
 * Việc tập trung cấu hình vào một file giúp dễ dàng quản lý và thay đổi.
 */

// =====================================================================================
// KHÓA LƯU TRỮ TRÊN SCRIPT PROPERTIES
// =====================================================================================
/**
 * Chứa tất cả các khóa (key) sẽ được sử dụng để lưu trữ dữ liệu trên ScriptProperties.
 * Việc dùng hằng số giúp tránh lỗi gõ sai và dễ dàng tìm kiếm, thay thế.
 */
const SCRIPT_PROPERTIES_KEYS = {
  STUDENT_ID: 'STUDENT_ID',
  EMAIL: 'EMAIL',
  SPREADSHEET_ID: 'SPREADSHEET_ID',
  CALENDAR_ID: 'CALENDAR_ID',
  // Cài đặt nâng cao
  PAGE_SIZE: 'PAGE_SIZE',
  MAX_RETRIES: 'MAX_RETRIES',
  RETRY_DELAY_SECONDS: 'RETRY_DELAY_SECONDS',
  // Cài đặt trigger
  SYNC_TIMES: 'SYNC_TIMES', // Lưu mảng các thời điểm sync, ví dụ: ["07:00", "12:00"]
  IS_AUTO_SYNC_ACTIVE: 'IS_AUTO_SYNC_ACTIVE',
   GEMINI_API_KEY: 'GEMINI_API_KEY', 
};

// =====================================================================================
// CẤU HÌNH GOOGLE SHEETS
// =====================================================================================

const SHEET_NAMES = {
  PROCESSED_SCHEDULE: 'LichHoc_DaXuLy', // Sheet chính, cơ sở dữ liệu ổn định
  CURRENT_SCHEDULE: 'LichHoc_HienTai', // Sheet tạm, để so sánh và chuẩn bị dữ liệu
};

/**
 * Định nghĩa tiêu đề cho các cột trong cả 2 sheet.
 * Thứ tự các cột ở đây sẽ quyết định thứ tự cột được tạo trên Google Sheet.
 */
const SHEET_HEADERS = [
  'eventHash', // Khóa chính, duy nhất cho mỗi buổi học
  'googleCalendarEventId', // ID của sự kiện tương ứng trên Google Calendar
  'daCheckIn', // Trạng thái check-in (TRUE, FALSE, hoặc rỗng)
  'lastUpdated', // Dấu thời gian lần cập nhật cuối
  // Dưới đây là các cột dữ liệu gốc từ API
  'MaMonHoc',
  'TenMonHoc',
  'TenNhom',
  'ToThucHanh',
  'ThoiGianBD',
  'ThoiGianKT',
  'SoTietBuoi',
  'TenPhong',
  'TenCoSo',
  'GiaoVien',
  'SoTinChi',
  'MaLopHoc',
  'Type', // 0 = Lý thuyết, 1 = Thực hành
  'TinhTrang', // 0, 4, 5, 10 là các trạng thái hợp lệ
];


// =====================================================================================
// CẤU HÌNH MẶC ĐỊNH CỦA HỆ THỐNG
// =====================================================================================

const DEFAULT_SETTINGS = {
  PAGE_SIZE: 100, // Số buổi học tải về trong mỗi lần gọi API
  MAX_RETRIES: 3, // Số lần thử lại tối đa nếu gọi API thất bại
  RETRY_DELAY_SECONDS: 10, // Thời gian chờ (giây) giữa các lần thử lại
  SYNC_TIMES: JSON.stringify(['07:00', '12:00', '22:00']), // Mặc định 3 thời điểm
};

// =====================================================================================
// CẤU HÌNH API & TRIGGER
// =====================================================================================

const API_URL = 'https://tapi.lhu.edu.vn/calen/auth/XemLich_LichSinhVien';

/**
 * Tên các hàm controller sẽ được gọi bởi trigger hoặc từ phía client.
 * Việc dùng hằng số giúp dễ quản lý khi đổi tên hàm.
 */
const HANDLER_FUNCTIONS = {
  AUTO_SYNC_TRIGGER: 'controllers_Main_triggerHandler', // Hàm "gác cổng" cho trigger
  INTELLIGENT_SYNC: 'controllers_Main_runIntelligentSync', // Hàm xử lý sync chính
};

// Khoảng thời gian chạy của trigger (tính bằng phút).
// Nên là ước số của 60 (1, 2, 3, 4, 5, 6, 10, 12, 15, 20, 30).
const TRIGGER_INTERVAL_MINUTES = 15;

const TIMEZONE = 'Asia/Ho_Chi_Minh'; // Múi giờ Việt Nam
const OFFICIAL_SCHEDULE_URL = 'https://calen.lhu.edu.vn/xem-lich-sinh-vien'; 