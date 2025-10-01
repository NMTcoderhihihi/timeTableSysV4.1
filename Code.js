/**
 * @file Code.gs
 * @description Điểm vào chính của Web App.
 * Chỉ chịu trách nhiệm điều hướng (routing) và phục vụ file HTML tương ứng.
 */

/**
 * Hàm được gọi khi người dùng truy cập URL của Web App.
 * @param {object} e - Đối tượng sự kiện từ Google, chứa các tham số URL.
 * @returns {HtmlOutput} Giao diện người dùng của ứng dụng.
 */
function doGet(e) {
  const page = e.parameter.page;

  if (page === "checkin" && e.parameter.hash) {
    // Nếu URL có ?page=checkin, phục vụ giao diện check-in
    // Dùng createTemplateFromFile để có thể truyền biến vào HTML
    const template = HtmlService.createTemplateFromFile(
      "views.checkin-ui.html",
    );
    template.eventHash = e.parameter.hash; // Truyền eventHash vào template

    return template
      .evaluate() // evaluate() sẽ thực thi các scriplet như <?!= eventHash ?>
      .setTitle("Check-in Buổi học")
      .addMetaTag("viewport", "width=device-width, initial-scale=1.0");
  } else {
    // Mặc định, phục vụ giao diện bảng điều khiển chính
    return HtmlService.createHtmlOutputFromFile("views.index.html")
      .setTitle("Bảng Điều Khiển Lịch Học")
      .addMetaTag("viewport", "width=device-width, initial-scale=1.0");
  }
}
