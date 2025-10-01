/**
 * @file controllers.Checkin.js
 * @description Controller xử lý các yêu cầu cho luồng check-in.
 */

/**
 * Được gọi từ client-side của trang check-in để lấy thông tin sự kiện.
 * @param {string} eventHash - Mã hash của sự kiện được truyền từ URL.
 * @returns {object} Một đối tượng chứa thông tin cần thiết để hiển thị trên UI.
 */
function controllers_Checkin_getEventForCheckin(eventHash) {
  if (!eventHash) {
    return { error: 'Không tìm thấy mã sự kiện.' };
  }
  
  try {
    const eventData = SheetService.findRowByHash(SHEET_NAMES.PROCESSED_SCHEDULE, eventHash);
    
    if (!eventData) {
      return { error: 'Sự kiện không tồn tại hoặc đã bị thay đổi.' };
    }

    // Chỉ trả về các thông tin cần thiết cho client
    return {
      tenMonHoc: eventData.TenMonHoc,
      thoiGianBD: eventData.ThoiGianBD,
      tenPhong: eventData.TenPhong,
      daCheckIn: eventData.daCheckIn, // Trạng thái hiện tại
    };
  } catch (e) {
    Logger.log(`Lỗi nghiêm trọng khi lấy dữ liệu check-in: ${e.message}`);
    return { error: 'Có lỗi xảy ra khi truy vấn dữ liệu.' };
  }
}


/**
 * Được gọi từ client-side để cập nhật trạng thái check-in mới.
 * @param {string} eventHash - Mã hash của sự kiện.
 * @param {boolean} status - Trạng thái mới (true cho 'Có mặt', false cho 'Vắng mặt').
 * @returns {object} Một đối tượng chứa thông báo thành công hoặc lỗi.
 */
function controllers_Checkin_setCheckinStatus(eventHash, status) {
  if (!eventHash) {
    return { success: false, message: 'Thiếu mã sự kiện.' };
  }
  
  try {
    const success = SheetService.updateCellByHash(
      SHEET_NAMES.PROCESSED_SCHEDULE, 
      eventHash, 
      'daCheckIn', 
      status 
    );
    
    if (success) {
      const statusText = status ? 'CÓ MẶT' : 'VẮNG MẶT';
      return { success: true, message: `Đã cập nhật trạng thái thành: ${statusText}` };
    } else {
      return { success: false, message: 'Không tìm thấy sự kiện để cập nhật.' };
    }
  } catch (e) {
    Logger.log(`Lỗi nghiêm trọng khi cập nhật trạng thái check-in: ${e.message}`);
    return { success: false, message: 'Có lỗi xảy ra phía máy chủ.' };
  }
}