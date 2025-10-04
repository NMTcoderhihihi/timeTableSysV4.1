/**
 * @file services.Gemini.js
 * @description Lớp dịch vụ chuyên trách việc giao tiếp với Google AI (Gemini API),
 * được cập nhật theo cấu trúc gọi API chuẩn và mới nhất.
 */

class GeminiService {
  /**
   * Định dạng dữ liệu sự kiện thô thành một chuỗi văn bản dễ đọc cho AI.
   * @private
   * @param {object} event - Đối tượng sự kiện.
   * @returns {string} Chuỗi định dạng.
   */
  static _formatEventForPrompt(event) {
    const startTime = new Date(event.ThoiGianBD);
    const day = startTime.toLocaleDateString("vi-VN", {
      weekday: "long",
      day: "numeric",
      month: "numeric",
    });
    const time = startTime.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `- ${event.TenMonHoc} (Phòng ${event.TenPhong}) lúc ${time} ngày ${day}.`;
  }

  /**
   * Gửi danh sách các thay đổi lịch học đến Gemini API và nhận về bản tóm tắt.
   * @param {Array<object>} newEvents - Danh sách các sự kiện mới được thêm.
   * @param {Array<object>} deletedEvents - Danh sách các sự kiện đã bị hủy.
   * @returns {string} Nội dung email do AI tạo ra.
   */
  static summarizeChanges(newEvents, deletedEvents, tone = "friendly") {
    const properties = PropertiesService.getScriptProperties();
    const apiKey = properties.getProperty(
      SCRIPT_PROPERTIES_KEYS.GEMINI_API_KEY,
    );

    if (!apiKey) {
      throw new Error("Gemini API Key chưa được cấu hình.");
    }

    // ** MODIFIED: Sử dụng endpoint và model mới nhất **
    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" +
      apiKey;
    let promptIntro =
      "Bạn là một trợ lý sinh viên thân thiện. Nhiệm vụ của bạn là viết một email thông báo về thay đổi lịch học.";
    let greeting = "Chào bạn,";

    if (tone === "direct") {
      promptIntro =
        "Bạn là một trợ lý thông tin. Nhiệm vụ của bạn là thông báo các thay đổi trong lịch học một cách trực tiếp, ngắn gọn và chính xác nhất.";
      greeting = "Thông báo thay đổi lịch học:";
    }

    // --- Xây dựng Prompt ---
    const addedText =
      newEvents.length > 0
        ? `**Các buổi học mới được thêm:**\n${newEvents
            .map(this._formatEventForPrompt)
            .join("\n")}`
        : "";
    const deletedText =
      deletedEvents.length > 0
        ? `**Các buổi học đã bị hủy:**\n${deletedEvents
            .map(this._formatEventForPrompt)
            .join("\n")}`
        : "";

    const prompt = `
      ${promptIntro}

      **QUY TẮC BẮT BUỘC:**
        1.  **ĐỊNH DẠNG ĐẦU RA:** Chỉ trả về văn bản thuần túy (plain text). TUYỆT ĐỐI KHÔNG sử dụng bất kỳ cú pháp Markdown nào.
      2.  **GIỌNG VĂN:** ${
        tone === "friendly"
          ? "Thân thiện, gần gũi như một người bạn."
          : "Trực tiếp, đi thẳng vào vấn đề, không có lời chào hỏi rườm rà."
      } Bắt đầu bằng "${greeting}".
      3.  **CẤU TRÚC:**
          - Nếu tổng số thay đổi (thêm + hủy) lớn hơn 5:
              a. Hãy liệt kê chi tiết các thay đổi diễn ra trong 7 ngày tới.
              b. Sau đó, chỉ cần tóm tắt số lượng các thay đổi còn lại (ví dụ: "Ngoài ra, còn có 8 thay đổi khác trong các tuần tiếp theo.").
          - Nếu tổng số thay đổi nhỏ hơn hoặc bằng 5, hãy liệt kê tất cả.
          - Cố gắng nhóm các thay đổi theo môn học và nhận diện các trường hợp "dời lịch".
      4.  **CÂU CHÚC:** Kết thúc email bằng MỘT trong các câu chúc tạo động lực ngẫu nhiên sau:
          - "Hãy biến mỗi ngày thành một kiệt tác."
          - "Thành công không phải là đích đến, đó là cuộc hành trình."
          - "Cách tốt nhất để dự đoán tương lai là tạo ra nó."
          - "Hãy tin vào bản thân và tất cả những gì bạn đang có."

      **Dữ liệu thay đổi:**
      ${addedText}
      ${deletedText}
    `;

    // ** MODIFIED: Thiết lập payload theo định dạng chuẩn mới nhất **
    const payload = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.5,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 1024,
      },
    };

    const options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    };

    try {
      const response = UrlFetchApp.fetch(url, options);
      const responseCode = response.getResponseCode();
      const responseText = response.getContentText();

      if (responseCode !== 200) {
        Logger.log(`Gemini Error - HTTP ${responseCode}: ${responseText}`);
        throw new Error(
          `Lỗi từ API Gemini (HTTP ${responseCode}). Vui lòng kiểm tra lại API Key và Logs.`,
        );
      }

      const json = JSON.parse(responseText);

      if (
        json.candidates &&
        json.candidates.length > 0 &&
        json.candidates[0].content &&
        json.candidates[0].content.parts[0]
      ) {
        Logger.log("Gemini: Đã nhận được tóm tắt thành công.");
        return json.candidates[0].content.parts[0].text;
      } else {
        Logger.log(
          `Gemini Error: Phản hồi không hợp lệ. Body: ${responseText}`,
        );
        // Cung cấp thông báo lỗi chi tiết hơn nếu có từ API
        const errorMessage = json.error
          ? json.error.message
          : "Không có nội dung hợp lệ trong phản hồi.";
        throw new Error(errorMessage);
      }
    } catch (e) {
      Logger.log(`Gemini: Lỗi nghiêm trọng khi gọi API: ${e.toString()}`);
      throw e; // Ném lại lỗi để controller xử lý
    }
  }
}
