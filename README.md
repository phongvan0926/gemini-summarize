# 🌟 Gemini Summarize - Chrome Extension

Tiện ích mở rộng trình duyệt Chrome mạnh mẽ cho phép **tóm tắt tức thì mọi trang web và video YouTube bằng Google Gemini** trực tiếp trên trang đang mở. Tiện ích sử dụng ngay tài khoản Gemini đã đăng nhập sẵn trong cùng trình duyệt mà **không cần chuyển tab, không cần API Key và tự động xóa sạch session rác trên tài khoản Gemini sau khi tóm tắt**.

---

## ✨ Điểm Nổi Bật

1. **Tóm tắt trực tiếp trên trang (In-Page Floating UI)**:
   - Cửa sổ tóm tắt dạng modal nổi hiện ngay tại góc trang web bạn đang xem.
   - Hỗ trợ **kéo thả di chuyển (drag & drop)** và **thay đổi kích thước (resize)** tùy ý.
   - Trải nghiệm mượt mà, không gián đoạn, không mở thêm tab mới.

2. **Dùng ngay tài khoản Gemini đã đăng nhập (Web Session - 100% Miễn phí)**:
   - Tận dụng phiên đăng nhập Google Gemini (`gemini.google.com`) có sẵn trên trình duyệt.
   - Không cần đăng ký API Key, không giới hạn thẻ tín dụng, không mất phí.
   - Hỗ trợ tùy chọn **Google AI Studio API Key** với các mô hình thế hệ mới nhất (**Gemini 2.5 Flash, Gemini 2.5 Pro, Gemini 2.0 Flash Thinking**) cùng tính năng **tự do nhập bất kỳ Model ID mới nào của Google (Custom Model ID)**, đảm bảo không bao giờ bị lỗi thời.

3. **🧹 Tự động xóa sạch Session rác trên Gemini Web (Auto Session Cleanup)**:
   - Sau khi tạo xong nội dung tóm tắt, tiện ích tự động gọi RPC của Google Gemini để dọn dẹp sạch sẽ cuộc hội thoại đó khỏi tài khoản.
   - Giúp danh sách lịch sử chat trên `gemini.google.com` của bạn luôn gọn gàng 100%, không bị tràn ngập hàng chục đoạn chat tóm tắt ngắn.

4. **🧠 Hệ thống Prompts chuyên sâu & Tùy biến linh hoạt**:
   - **Tự động thông minh (Auto-Detect)**: Tự nhận diện thể loại bài viết (Tin tức, Hướng dẫn kỹ thuật, Phân tích chuyên sâu...) -> chọn khuôn mẫu tóm tắt tối ưu (5W1H, Action Checklist, Golden Nugget).
   - **Kỹ thuật Feynman**: Giải thích siêu dễ hiểu với ví dụ gần gũi như cho người mới bắt đầu.
   - **Sơ đồ tư duy (Mindmap / Logic)**: Tái cấu trúc nội dung theo cây logic nguyên nhân - giải pháp - hệ quả.
   - **Flashcards (Active Recall)**: Bộ câu hỏi & trả lời giúp ôn tập và ghi nhớ sâu.
   - **Phân tích phản biện (Critical Thinking)**: Đánh giá luận điểm, lỗ hổng lập luận và góc nhìn đa chiều.
   - **TL;DR (3 câu siêu ngắn)** & **Ý chính gạch đầu dòng (Bullet points kèm emoji)**.
   - **Quản lý Prompt cá nhân hóa**: Thêm, sửa, xóa các câu lệnh tùy chỉnh của riêng bạn trong trang Cài đặt.

5. **Trích xuất nội dung thông minh với Mozilla Readability**:
   - Sử dụng thuật toán **Mozilla Readability** chính thức, trích xuất nguyên vẹn 100% bài viết dài (loại bỏ quảng cáo, menu, bình luận, teaser).
   - **Hỗ trợ video YouTube**: Tự động nhận diện và trích xuất phụ đề (transcript) để tóm tắt video nhanh chóng.
   - **Tóm tắt đoạn văn bản được chọn**: Bôi đen một đoạn văn bản bất kỳ để hiện nút tóm tắt nổi hoặc dùng menu chuột phải.
   - Hỗ trợ đa ngôn ngữ: Tiếng Việt, English, 中文, 日本語, 한국어, Français, Español, Deutsch.

---

## 🚀 Hướng Dẫn Cài Đặt Vào Trình Duyệt

Tiện ích tương thích với tất cả trình duyệt nền Chromium (Google Chrome, Microsoft Edge, Brave, Cốc Cốc, Arc, v.v.):

1. Mở trình duyệt và truy cập vào trang quản lý tiện ích:
   - **Chrome / Cốc Cốc / Brave**: `chrome://extensions/`
   - **Microsoft Edge**: `edge://extensions/`
2. Bật công tắc **"Chế độ dành cho nhà phát triển" (Developer mode)** ở góc trên bên phải màn hình.
3. Bấm vào nút **"Tải tiện ích đã giải nén" (Load unpacked)** ở góc trên bên trái.
4. Chọn thư mục tiện ích:
   ```
   gemini_summarize
   ```
5. Tiện ích **Gemini Summarize** sẽ xuất hiện trên danh sách tiện ích! Bấm vào biểu tượng mảnh ghép (Extensions) trên thanh công cụ trình duyệt và ghim (Pin) biểu tượng Gemini để tiện sử dụng mọi lúc.

---

## 📖 Hướng Dẫn Sử Dụng

### Cách 1: Tóm tắt toàn bộ trang web hoặc video YouTube
1. Mở bất kỳ bài báo, blog, tài liệu hoặc video YouTube nào.
2. Bấm vào biểu tượng **Gemini Summarize** trên thanh công cụ trình duyệt.
3. Cửa sổ tóm tắt nổi sẽ mở ra ngay trên trang, tự động đọc nội dung và streaming tóm tắt trực quan theo thời gian thực.

### Cách 2: Tóm tắt đoạn văn bản chọn lọc
1. Dùng chuột bôi đen đoạn văn bản bạn muốn đọc tóm tắt.
2. Bấm vào nút nổi **"Tóm tắt với Gemini"** vừa xuất hiện cạnh con trỏ chuột (hoặc nhấp chuột phải chọn **"Tóm tắt bằng Gemini"**).
3. Cửa sổ tóm tắt sẽ hiện ra và xử lý riêng đoạn văn bản bạn vừa chọn.

---

## ⚙️ Cấu Hình & Tùy Chọn

Nhấp chuột phải vào biểu tượng extension và chọn **"Tùy chọn" (Options)** hoặc bấm biểu tượng bánh răng ⚙️ trong cửa sổ tóm tắt để:
- Kiểm tra trạng thái đăng nhập tài khoản Google Gemini.
- Bật/tắt tính năng **Tự động xóa lịch sử chat trên Gemini sau khi tóm tắt**.
- Quản lý và thêm mới các **Mẫu câu lệnh (Custom Prompts)**.
- Chuyển đổi giữa chế độ **Gemini Web (Mặc định - Miễn phí)** và **Gemini API Key**.
- Thay đổi ngôn ngữ mặc định và mẫu tóm tắt yêu thích khi mở tiện ích.

---

## 📁 Cấu Trúc Mã Nguồn

```
gemini_summarize/
├── manifest.json                  # Cấu hình Manifest V3
├── .gitignore                     # Tệp loại trừ file rác / OS / build cache
├── README.md                      # Hướng dẫn chi tiết
├── icons/                         # Bộ icon kích thước 16, 32, 48, 128 và SVG
├── background/
│   ├── service-worker.js          # Background script điều phối sự kiện & kết nối
│   ├── gemini-web-client.js       # Client giao tiếp Gemini Web qua session & RPC dọn dẹp
│   └── gemini-api-client.js       # Client giao tiếp Google AI Studio API
├── content/
│   ├── readability.js             # Thuật toán Mozilla Readability trích xuất bài viết sạch
│   ├── content-script.js          # Injected script điều khiển popup iframe & phụ đề YouTube
│   └── content-styles.css         # CSS cho khung nổi iframe trên trang
├── popup/
│   ├── index.html                 # Giao diện cửa sổ tóm tắt nổi
│   ├── popup.js                   # Xử lý logic giao diện, kéo thả, streaming markdown
│   ├── popup.css                  # Kiểu dáng giao diện hiện đại
│   └── lib/
│       └── marked.min.js          # Thư viện render Markdown
├── options/
│   ├── index.html                 # Trang cài đặt tiện ích
│   ├── options.js                 # Xử lý cài đặt, CRUD custom prompts & kiểm tra đăng nhập
│   └── options.css                # Kiểu dáng trang cài đặt
└── rules/
    └── declarative_net_request.json # Header rules cho gemini.google.com
```

---

## 📄 Bản Quyền & Giấy Phép
Dự án được phát triển nhằm phục vụ mục đích học tập và nâng cao năng suất cá nhân.
Mọi bản quyền thuộc về tác giả.
