# VEO3 Tool với GPM-Login Integration

Ứng dụng Tauri để tạo video và ảnh với Google VEO3 AI, tích hợp GPM-Login để lấy reCAPTCHA token tự động.

## ✨ Tính năng

### 🔧 Tích hợp GPM-Login
- Tự động phát hiện GPM-Login API (port 19990-19999)
- Khởi động GPM-Login từ app
- Tạo profile tạm thời để lấy reCAPTCHA token
- Auto-cleanup profile sau khi sử dụng

### 🎬 Tạo Video & Ảnh
- **Text-to-Video**: Tạo video từ mô tả text
- **Image-to-Video**: Tạo video từ ảnh khởi đầu
- **Text-to-Image**: Tạo ảnh từ mô tả text
- Hỗ trợ nhiều tỷ lệ khung hình (landscape, portrait, square)
- Chọn model (Imagen 3.5, Gemini Pixel 2)

### 📋 Queue System
- **Queue tự động**: Xử lý hàng loạt prompts
- **Batch import**: Import nhiều prompts cùng lúc
- **Real-time monitoring**: Theo dõi trạng thái tasks
- **Background processing**: Chạy ngầm với notification
- **Auto-retry**: Tự động thử lại khi lỗi

### 📊 Quản lý Tasks
- Lịch sử đầy đủ các tasks
- Filter theo trạng thái
- Download links cho kết quả
- Thống kê real-time

## 🚀 Cài đặt

### Yêu cầu
- **Rust** (latest stable)
- **Node.js** (v18+)
- **GPM-Login** đã cài đặt
- **Cookie** từ labs.google

### Bước 1: Clone và cài đặt
```bash
cd veo3-tauri
bun install
```

### Bước 2: Build Rust backend
```bash
cd src-tauri
cargo build
cd ..
```

### Bước 3: Chạy development
```bash
bun run tauri dev
```

Hoặc sử dụng script tự động:
```bash
run.bat
```

## ⚙️ Cấu hình

### 1. GPM-Login Setup
- **Đường dẫn executable**: `D:\X\GPMLogin\GPMLogin.exe`
- App sẽ tự động phát hiện API port
- Có thể khởi động GPM từ trong app

### 2. VEO3 API Config
Lấy từ labs.google (F12 → Application → Cookies):
- **Session Token**: `__Secure-next-auth.session-token`
- **CSRF Token**: `__Host-next-auth.csrf-token`
- **Email**: Account email
- **Project ID**: Cho tạo ảnh (optional)

### 3. Labs Cookie
Copy toàn bộ cookie string từ labs.google:
```
__Secure-next-auth.session-token=...; __Host-next-auth.csrf-token=...; email=...
```

## 🎯 Sử dụng

### Tạo thủ công
1. Chuyển tab **"Tạo thủ công"**
2. Nhập prompt
3. Chọn loại (video/ảnh), tỷ lệ, model
4. Click **"Tạo Video"** hoặc **"Tạo Ảnh"**

### Queue tự động
1. Chuyển tab **"Queue tự động"**
2. Click **"Bắt đầu Queue"**
3. Thêm prompts vào queue:
   - Thêm từng cái: Nhập prompt → **"Thêm vào Queue"**
   - Batch import: Paste nhiều prompts → **"Import Batch"**
4. App sẽ tự động xử lý từng task

### Theo dõi tiến độ
- **Status bar**: Hiển thị trạng thái GPM và queue
- **Queue stats**: Thống kê real-time
- **Lịch sử**: Xem tất cả tasks đã thực hiện
- **Notifications**: Thông báo khi hoàn thành

## 🔄 Workflow

### Tạo Video với GPM
```
1. App phát hiện GPM API
2. Tạo profile tạm thời
3. Start profile → lấy debug address
4. Puppeteer connect → set cookies
5. Navigate labs.google → lấy reCAPTCHA token
6. Call VEO3 API với token
7. Poll status cho đến khi hoàn thành
8. Cleanup: close + delete profile
```

### Queue Processing
```
1. User thêm tasks vào queue
2. Queue processor chạy ngầm
3. Lấy task pending → set processing
4. Tạo GPM profile → lấy token
5. Call API → poll status
6. Update task status → cleanup
7. Notification khi hoàn thành
8. Lặp lại với task tiếp theo
```

## 📁 Cấu trúc Project

```
veo3-tauri/
├── src/
│   ├── main.ts          # Frontend TypeScript
│   └── style.css        # Styling
├── src-tauri/
│   ├── src/
│   │   ├── main.rs      # Entry point
│   │   └── lib.rs       # Core logic
│   ├── Cargo.toml       # Rust dependencies
│   └── tauri.conf.json  # Tauri config
├── index.html           # UI layout
├── package.json         # Node dependencies
└── run.bat             # Build script
```

## 🛠️ API Commands

### GPM Integration
- `detect_gpm_api()` - Phát hiện GPM API
- `start_gpm_executable(path)` - Khởi động GPM
- `get_recaptcha_token(cookie, email)` - Lấy token

### VEO3 API
- `generate_video(config, request)` - Tạo video
- `generate_images(config, request)` - Tạo ảnh
- `check_video_status(config, operation_id)` - Check status
- `upload_image(config, image_base64)` - Upload ảnh

### Queue Management
- `add_task_to_queue(prompt, task_type)` - Thêm task
- `get_queue_stats()` - Lấy thống kê
- `get_all_tasks()` - Lấy tất cả tasks
- `clear_completed_tasks()` - Xóa tasks hoàn thành
- `start_queue_processor(config, cookie)` - Bắt đầu queue

## 🔧 Troubleshooting

### GPM-Login không kết nối
- Kiểm tra GPM đã chạy chưa
- Thử khởi động từ app
- Kiểm tra port range 19990-19999

### Cookie hết hạn
- Re-login labs.google
- Copy cookie mới
- Test connection trong app

### Queue không chạy
- Kiểm tra config đầy đủ
- Kiểm tra cookie hợp lệ
- Xem logs trong console

### Build errors
```bash
# Clear cache
cargo clean
bun run tauri build --debug
```

## 📝 Notes

- App tự động cleanup GPM profiles
- Session timeout: 10s sau lần dùng cuối
- Max concurrent browsers: 3
- Queue poll interval: 5s
- Notification cho completed tasks
- Auto-save config trong localStorage

## 🎉 Demo

1. Khởi động app: `run.bat`
2. Cấu hình GPM path và VEO3 tokens
3. Test connection
4. Thêm vài prompts vào queue
5. Start queue và xem magic! ✨