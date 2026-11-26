# Phân tích TikTok Shop

Ứng dụng web tĩnh phân tích quảng cáo, doanh thu và đối chiếu kế toán cho TikTok Shop từ các file Excel/CSV xuất từ TikTok.

- File TikTok được đọc và tính toán **ngay trong trình duyệt của người dùng**; dữ liệu lưu trong trình duyệt của máy đó, không gửi lên máy chủ.
- Kho mã nguồn này **chỉ chứa chương trình** – không chứa file dữ liệu, báo cáo hay bản sao lưu.
- Chạy được khi mất mạng sau lần mở đầu tiên.

## Ba vai trò

| Vai trò | Làm gì | Thấy gì |
|---|---|---|
| Kế toán | Nhập file, kiểm soát trùng lặp, xuất Excel có mật khẩu, lập báo cáo lãnh đạo | Toàn bộ dữ liệu trên máy mình |
| Lãnh đạo | Mở file báo cáo `.html` đã mã hóa, nhập mật khẩu | Số liệu tổng hợp trong báo cáo được gửi |
| Nhân sự | Mở link riêng `#gui=…`, kiểm tra file, tạo gói `.ttsgoi` mã hóa gửi kế toán | Không xem được báo cáo |

Hướng dẫn chi tiết: `docs/huong_dan.html`.

## Cấu trúc

```
docs/               trang web (GitHub Pages phục vụ từ thư mục này)
  index.html        ứng dụng
  huong_dan.html    hướng dẫn sử dụng
  kiem_thu.html     kiểm tra công thức (40 tình huống)
  js/               core, schema, store, importer, cube, metrics, views, charts,
                    excel, excel-report, secure, viewer, app
  sw.js             chạy offline
tests/
  du_lieu_kiem_thu/ file mẫu dựng sẵn, không chứa dữ liệu thật
```

Bộ kiểm thử tổng thể trên file xuất thật của TikTok được giữ trên máy kế toán, không đưa vào kho này.

## Bảo mật

- Excel: mã hóa chuẩn Microsoft Office (Agile, AES-256, SHA-512).
- Báo cáo lãnh đạo: AES-256-GCM, khóa từ mật khẩu PBKDF2-SHA256 310.000 vòng.
- Gói nhân sự: ECDH P-256 + AES-256-GCM tới khóa công khai của kế toán.
- Không lưu thông tin cá nhân khách hàng (tên, số điện thoại, địa chỉ, số thẻ…).
