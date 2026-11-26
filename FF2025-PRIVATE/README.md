# FF2025-PRIVATE V1

Backend game độc lập để học tập và thử nghiệm: tài khoản, profile, lobby, inventory, room, matchmaking, mô phỏng trận đấu, ranking và web admin.

**Không phải server chính thức của Garena, không chứa client Free Fire, không triển khai giao thức độc quyền và không tự kết nối được client Free Fire 2025.**

## Yêu cầu
- Node.js 24
- PostgreSQL
- Biến môi trường theo `.env.example`

## Chạy local
1. Sao chép `.env.example` thành `.env`.
2. Điền `DATABASE_URL`, `JWT_SECRET` (ít nhất 32 ký tự), `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
3. Chạy `npm install`.
4. Chạy `npm start`.
5. Mở `http://localhost:10000/health` và `/admin`.

## Deploy Render
- Tạo PostgreSQL database trên Render.
- Tạo Web Service từ GitHub repository.
- Build command: `npm install`
- Start command: `npm start`
- Thêm biến môi trường:
  - `NODE_ENV=production`
  - `DATABASE_URL` = Internal Database URL nếu web service và database cùng Render
  - `JWT_SECRET` = chuỗi ngẫu nhiên dài tối thiểu 32 ký tự
  - `ADMIN_EMAIL` = email admin
  - `ADMIN_PASSWORD` = mật khẩu admin mạnh
  - `JWT_EXPIRES_IN=7d`
- Deploy, sau đó kiểm tra `/health` và mở `/admin`.

## API
Tất cả API dưới đây dùng prefix `/api`. Những endpoint yêu cầu đăng nhập cần header `Authorization: Bearer TOKEN`.

| Method | Path | Mục đích |
|---|---|---|
| GET | `/health` | Kiểm tra server/database |
| POST | `/api/auth/register` | Tạo tài khoản |
| POST | `/api/auth/login` | Đăng nhập |
| GET | `/api/auth/me` | Tài khoản hiện tại |
| GET/PATCH | `/api/profile` | Xem/sửa tên |
| GET | `/api/lobby` | Dữ liệu lobby |
| GET | `/api/inventory` | Kho đồ mô phỏng |
| GET/POST | `/api/rooms` | Danh sách/tạo phòng |
| POST | `/api/rooms/:code/join` | Vào phòng |
| POST | `/api/matchmaking/quick` | Tìm phòng chờ |
| POST | `/api/battles/simulate/:code` | Chủ phòng chạy mô phỏng (cần >= 2 người) |
| GET | `/api/battles/history` | Lịch sử trận |
| GET | `/api/ranking` | Bảng xếp hạng |
| GET | `/api/admin/overview` | Tổng quan admin |
| GET | `/api/admin/users` | Danh sách người dùng admin |

## Tạo tài khoản người chơi
Gửi POST `/api/auth/register` với JSON:
```json
{
  "email": "player@example.com",
  "username": "player_01",
  "password": "A-Strong-Password-123"
}
```

## Bảo mật
- Không commit `.env`.
- Không chia sẻ `JWT_SECRET`, `DATABASE_URL` hoặc mật khẩu admin.
- Đổi mật khẩu admin sau lần triển khai đầu tiên nếu có nghi ngờ lộ thông tin.
- Render free có thể sleep và giới hạn tài nguyên; không cam kết uptime 24/7.
