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
  STUDENT_ID: "STUDENT_ID",
  EMAIL: "EMAIL",
  SPREADSHEET_ID: "SPREADSHEET_ID",
  CALENDAR_ID: "CALENDAR_ID",
  GEMINI_API_KEY: "GEMINI_API_KEY",
  GEMINI_TONE: "GEMINI_TONE", // ++ ADDED
  WEBAPP_URL: "WEBAPP_URL",
  // Cài đặt nâng cao
  PAGE_SIZE: "PAGE_SIZE",
  MAX_RETRIES: "MAX_RETRIES",
  RETRY_DELAY_SECONDS: "RETRY_DELAY_SECONDS",
  SYNC_START_DATE: "SYNC_START_DATE",
  EVENT_BATCH_SIZE: "EVENT_BATCH_SIZE", // ++ ADDED
  BATCH_DELAY_MINUTES: "BATCH_DELAY_MINUTES", // ++ ADDED
  // Cài đặt trigger
  SYNC_TIMES: "SYNC_TIMES",
  IS_AUTO_SYNC_ACTIVE: "IS_AUTO_SYNC_ACTIVE",
  // Khóa hệ thống & Hàng đợi
  SYSTEM_LOCK: "SYSTEM_LOCK", // ++ ADDED
  BATCH_QUEUE: "BATCH_QUEUE", // ++ ADDED
  SYSTEM_STATE: "SYSTEM_STATE",
};

// =====================================================================================
// CẤU HÌNH GOOGLE SHEETS
// =====================================================================================

const SHEET_NAMES = {
  PROCESSED_SCHEDULE: "LichHoc_DaXuLy", // Sheet chính, cơ sở dữ liệu ổn định
  CURRENT_SCHEDULE: "LichHoc_HienTai", // Sheet tạm, để so sánh và chuẩn bị dữ liệu
};

/**
 * Định nghĩa tiêu đề cho các cột trong cả 2 sheet.
 * Thứ tự các cột ở đây sẽ quyết định thứ tự cột được tạo trên Google Sheet.
 */
const SHEET_HEADERS = [
  "eventHash",
  "googleCalendarEventId",
  "daCheckIn",
  "lastUpdated",
  "MaMonHoc",
  "TenMonHoc",
  "TenNhom",
  "ToThucHanh",
  "ThoiGianBD",
  "ThoiGianKT",
  "SoTietBuoi",
  "TenPhong",
  "TenCoSo",
  "GiaoVien",
  "SoTinChi",
  "MaLopHoc",
  "Type",
  "TinhTrang",
  "calenType", // ++ ADDED
];

// =====================================================================================
// CẤU HÌNH MẶC ĐỊNH CỦA HỆ THỐNG
// =====================================================================================

const DEFAULT_SETTINGS = {
  PAGE_SIZE: 100,
  MAX_RETRIES: 3,
  RETRY_DELAY_SECONDS: 10,
  SYNC_TIMES: JSON.stringify(["07:00", "12:00", "22:00"]),
  EVENT_BATCH_SIZE: 40, // ++ ADDED: Mặc định 40 sự kiện/lô
  BATCH_DELAY_MINUTES: 2, // ++ ADDED: Mặc định chờ 2 phút giữa các lô
};

// =====================================================================================
// CẤU HÌNH API & TRIGGER
// =====================================================================================

const API_URL = "https://tapi.lhu.edu.vn/calen/auth/XemLich_LichSinhVien";

/**
 * Tên các hàm controller sẽ được gọi bởi trigger hoặc từ phía client.
 * Việc dùng hằng số giúp dễ quản lý khi đổi tên hàm.
 */
const HANDLER_FUNCTIONS = {
  AUTO_SYNC_TRIGGER: "controllers_Main_triggerHandler",
  INTELLIGENT_SYNC: "controllers_Main_runIntelligentSync",
  PROCESS_BATCH: "controllers_Main_processEventBatch", // ++ ADDED
};

// Khoảng thời gian chạy của trigger (tính bằng phút).
// Nên là ước số của 60 (1, 2, 3, 4, 5, 6, 10, 12, 15, 20, 30).
const TRIGGER_INTERVAL_MINUTES = 15;

const TIMEZONE = "Asia/Ho_Chi_Minh"; // Múi giờ Việt Nam
const OFFICIAL_SCHEDULE_URL = "https://calen.lhu.edu.vn/xem-lich-sinh-vien";
