/* Các loại file / bảng dữ liệu và ánh xạ cột nguồn → trường chuẩn. So khớp sau khi bỏ dấu, chữ thường, bỏ phần trong ngoặc. */
(function (root) {
  'use strict';
  var K = root.TTSK, S = { all: [] };
  // f(key, nhãn, kiểu, [tên cột], tùy chọn{req, pii, neg, na, miss})
  function f(key, label, type, syn, o) { o = o || {}; return { key: key, label: label, type: type, syn: syn || [], required: !!o.req, pii: !!o.pii, negate: !!o.neg, nonAdd: !!o.na, missing: o.miss || null }; }
  function ds(o) { S.all.push(o); return o; }
  var PII = ['buyer username', 'buyer name', 'buyer message', 'recipient', 'recipient name', 'phone #', 'phone', 'phone number', 'zipcode', 'zip code', 'country', 'province', 'district', 'ward',
    'detail address', 'additional address information', 'address', 'shipping address', 'ten nguoi mua', 'ten nguoi nhan', 'nguoi nhan', 'so dien thoai', 'dien thoai', 'sdt', 'sdt nguoi nhan',
    'dia chi', 'dia chi chi tiet', 'dia chi giao hang', 'tinh thanh', 'tinh thanh pho', 'quan huyen', 'phuong xa', 'ma buu chinh', 'tin nhan cua nguoi mua', 'ten dang nhap nguoi mua', 'email',
    'ten khach hang', 'khach hang', 'dien thoai kh', 'dia chi kh', 'creator name', 'creator username', 'creator tax id', 'creator address', 'ma so thue ca nhan', 'cccd', 'cmnd'];

  ds({ key: 'ads_campaign', label: 'Báo cáo quảng cáo (chiến dịch / GMV Max)', source: 'TikTok Ads / Seller Center → Quảng cáo → GMV Max → Xuất báo cáo',
    desc: 'Chi phí, doanh thu gộp theo báo cáo quảng cáo, số đơn SKU – theo chiến dịch và/hoặc theo ngày.', dateField: 'date', signature: ['cost', 'revenue'],
    keyFields: ['campaign_id', 'campaign_name', 'date'], entityFields: ['campaign_id', 'campaign_name'], totalLabelFields: ['campaign_name', 'campaign_id', 'date', 'shop_name'], coverage: true,
    fields: [f('date', 'Ngày', 'Date', ['ngay', 'thoi gian', 'date', 'day', 'by day', 'stat time day', 'ngay bao cao', 'stat time']),
      f('shop_name', 'Tên shop', 'Text', ['shop', 'ten shop', 'cua hang', 'ten cua hang', 'store', 'store name', 'shop name']),
      f('campaign_id', 'ID chiến dịch', 'Text', ['id chien dich', 'campaign id', 'ma chien dich']),
      f('campaign_name', 'Tên chiến dịch', 'Text', ['ten chien dich', 'campaign name', 'chien dich', 'campaign']),
      f('cost', 'Chi phí quảng cáo', 'Money', ['chi phi', 'cost', 'spend', 'tong chi phi', 'chi tieu', 'total cost', 'chi phi quang cao', 'amount spent', 'chi phi thuc'], { req: 1 }),
      f('revenue', 'Doanh thu gộp (báo cáo quảng cáo)', 'Money', ['doanh thu gop', 'gross revenue', 'tong doanh thu gop', 'gmv', 'doanh thu', 'revenue', 'total revenue', 'tong doanh thu'], { req: 1 }),
      f('sku_orders', 'Số đơn SKU', 'Int', ['don hang sku', 'so don sku', 'sku orders', 'don sku', 'so don hang sku', 'orders sku', 'sku order', 'so luong don sku', 'luot dat hang sku'], { miss: 'Không tính được Số đơn SKU và Chi phí/đơn SKU' }),
      f('orders', 'Đơn hàng (theo file)', 'Int', ['don hang', 'orders', 'so don hang', 'so don']),
      f('roi_file', 'ROI/ROAS ghi trong file (đối chiếu)', 'Num', ['roi', 'roas']),
      f('currency', 'Tiền tệ', 'Text', ['tien te', 'currency', 'don vi tien te', 'loai tien te']),
      f('impressions', 'Lượt hiển thị', 'Int', ['luot hien thi', 'impressions', 'impression']),
      f('clicks', 'Lượt nhấp', 'Int', ['luot nhap', 'clicks', 'click'])] });

  ds({ key: 'ads_account_cost', label: 'Chi phí quảng cáo theo tài khoản (file Cost)', source: 'TikTok Business Center → Thanh toán → Chi phí (Cost_<ID BC>_….xlsx)',
    desc: 'Chi phí tiền mặt / tín dụng / tín dụng quảng cáo và thuế ước tính theo tài khoản quảng cáo. File không ghi kỳ – cần nhập kỳ.', signature: ['account_id', 'amount', 'cash'],
    keyFields: ['account_id', 'cost_type'], entityFields: ['account_id'], totalLabelFields: ['account_id', 'account_name'], coverage: true,
    fields: [f('account_id', 'ID tài khoản quảng cáo', 'Text', ['id tai khoan', 'account id', 'advertiser id', 'id nha quang cao'], { req: 1 }),
      f('account_name', 'Tên tài khoản', 'Text', ['ten tai khoan', 'account name', 'advertiser name']),
      f('cost_type', 'Loại', 'Text', ['loai', 'type']),
      f('cash', 'Chi phí tiền mặt', 'Money', ['chi phi tien mat', 'cash cost', 'cash'], { neg: 1 }),
      f('credit', 'Chi phí tín dụng', 'Money', ['chi phi tin dung', 'credit cost', 'credit'], { neg: 1 }),
      f('ad_credit', 'Chi phí tín dụng quảng cáo', 'Money', ['chi phi tin dung quang cao', 'ad credit cost', 'ad credit', 'voucher'], { neg: 1 }),
      f('amount', 'Số tiền (chi phí, chưa thuế)', 'Money', ['so tien', 'amount', 'total amount'], { req: 1, neg: 1 }),
      f('tax', 'Thuế ước tính', 'Money', ['thue uoc tinh', 'estimated tax', 'thue', 'tax'], { neg: 1, miss: 'Không tách được phần thuế' }),
      f('currency', 'Tiền tệ', 'Text', ['tien te', 'currency'])] });

  ds({ key: 'ads_topup', label: 'Giao dịch thanh toán Ads (file Transaction)', source: 'TikTok Business Center → Thanh toán → Giao dịch (Transaction_<ID BC>_….xlsx)',
    desc: 'Nạp tiền, thanh toán hóa đơn, chuyển số dư nội bộ, khuyến mãi… kèm số chứng từ. Số thẻ và người thao tác không được lưu.', dateField: 'time', signature: ['transaction_id', 'amount', 'time'],
    keyFields: ['transaction_id', 'account_id', 'tx_subtype'],
    fields: [f('time', 'Thời gian giao dịch', 'DateTime', ['thoi gian giao dich', 'transaction time', 'thoi gian', 'time'], { req: 1 }),
      f('timezone', 'Múi giờ', 'Text', ['mui gio', 'time zone', 'timezone']),
      f('tx_type', 'Loại giao dịch', 'Text', ['loai giao dich', 'transaction type']),
      f('tx_subtype', 'Loại giao dịch phụ', 'Text', ['loai giao dich phu', 'transaction subtype', 'sub type']),
      f('account_type', 'Loại tài khoản', 'Text', ['loai tai khoan', 'account type']),
      f('account_name', 'Tên tài khoản', 'Text', ['ten tai khoan', 'account name']),
      f('account_id', 'ID tài khoản', 'Text', ['id tai khoan', 'account id']),
      f('transaction_id', 'ID giao dịch', 'Text', ['id giao dich', 'transaction id', 'ma giao dich'], { req: 1 }),
      f('description', 'Mô tả (có số thẻ – không lưu)', 'Text', ['mo ta', 'description'], { pii: 1 }),
      f('voucher_no', 'Chứng từ / số hóa đơn', 'Text', ['chung tu', 'invoice', 'invoice number', 'so hoa don', 'document', 'invoice no']),
      f('operator', 'Người vận hành (không lưu)', 'Text', ['nguoi van hanh', 'operator', 'operated by'], { pii: 1 }),
      f('status', 'Trạng thái', 'Text', ['trang thai', 'status']),
      f('money_type', 'Loại tiền', 'Text', ['loai tien', 'fund type', 'payment type']),
      f('amount', 'Số tiền', 'Money', ['so tien', 'amount'], { req: 1 }),
      f('currency', 'Tiền tệ', 'Text', ['tien te', 'currency']),
      f('pay_method', 'Phương thức thanh toán (chỉ loại, không lưu số thẻ)', 'Text', [])] });

  ds({ key: 'invoice', label: 'Chi tiết hóa đơn TikTok (Ads / phí sàn / hoa hồng)', source: 'TikTok Shop / TikTok Ads → Hóa đơn → Tải chi tiết (invoice_<số>_detail.xlsx)',
    desc: 'Tiền hóa đơn, thuế suất, tiền thuế, tiền trước thuế. Tên/MST/địa chỉ nhà sáng tạo không được lưu.', signature: ['invoice_no', 'amount'], keyFields: ['invoice_no', 'bill_id', 'order_id'], noPeriodKey: true,
    fields: [f('invoice_no', 'Số hóa đơn / mã hồ sơ', 'Text', ['invoice application number', 'invoice number', 'invoice no', 'so hoa don', 'ma hoa don', 'ky hieu so hoa don'], { req: 1 }),
      f('bill_id', 'Bill ID', 'Text', ['bill id', 'ma bill']), f('tax_type', 'Loại thuế', 'Text', ['tax type', 'loai thue']), f('order_id', 'Order ID (hóa đơn)', 'Text', ['order id', 'ma don']),
      f('description', 'Diễn giải', 'Text', ['invoice description', 'mo ta hoa don', 'noi dung', 'dien giai', 'description']), f('expense_type', 'Loại chi phí', 'Text', ['expense type', 'loai chi phi']),
      f('invoice_date', 'Ngày hóa đơn', 'Date', ['invoice date', 'ngay hoa don', 'ngay lap', 'ngay phat hanh']),
      f('amount', 'Tổng tiền hóa đơn', 'Money', ['invoice amount', 'total amount', 'tong tien', 'so tien hoa don', 'tong tien thanh toan', 'amount'], { req: 1 }),
      f('tax_rate', 'Thuế suất', 'Ratio', ['tax rate', 'thue suat']), f('tax', 'Tiền thuế', 'Money', ['tax amount', 'tien thue', 'thue gtgt', 'vat amount', 'vat'], { miss: 'Không thể hiện riêng phần thuế' }),
      f('net', 'Tiền trước thuế', 'Money', ['net amount', 'tien truoc thue', 'thanh tien truoc thue', 'net']), f('pit', 'Thuế TNCN đã khấu trừ', 'Money', ['personal income tax withheld', 'thue tncn', 'thue tncn khau tru']),
      f('payable', 'Số tiền phải trả', 'Money', ['payable amount', 'so tien phai tra']), f('currency', 'Tiền tệ', 'Text', ['currency', 'tien te'])] });

  ds({ key: 'video_daily', label: 'Hiệu quả video theo ngày (Video performance)', source: 'Seller Center → Phân tích → Video → Key metrics (Video performance Key metrics_*.xlsx)',
    desc: 'GMV và đơn hàng SKU đến từ video theo ngày; kỳ ở dòng đầu “[Phạm vi ngày]”; có phạm vi kênh.', dateField: 'date', signature: ['date', 'gmv_total'], keyFields: ['date'], hasScope: true, totalLabelFields: ['date'], coverage: true,
    fields: [f('date', 'Ngày', 'Date', ['thoi gian', 'ngay', 'date'], { req: 1 }), f('gmv_total', 'GMV đến từ video', 'Money', ['gmv den tu video', 'video attributed gmv', 'gmv from videos'], { req: 1 }),
      f('gmv_direct', 'GMV video (trực tiếp)', 'Money', ['gmv video', 'video gmv']), f('gmv_indirect', 'GMV gián tiếp của video', 'Money', ['gmv gian tiep cua video', 'indirect video gmv']),
      f('vv', 'Lượt xem video (VV)', 'Int', ['vv', 'video views', 'luot xem video']), f('gpm', 'GPM', 'Money', ['gpm'], { na: 1 }),
      f('sku_orders', 'Đơn hàng SKU đã ghi nhận', 'Int', ['don hang sku da ghi nhan', 'sku orders']), f('sku_direct', 'Đơn hàng SKU từ video', 'Int', ['don hang sku tu video']),
      f('sku_indirect', 'Đơn hàng SKU gián tiếp từ video', 'Int', ['don hang sku gian tiep tu video']), f('buyers_avg', 'Số khách TB mỗi ngày', 'Num', ['so khach tb moi ngay'], { na: 1 }),
      f('product_viewers', 'Người xem sản phẩm trong video', 'Int', ['nguoi xem san pham trong video']), f('impressions', 'Lượt hiển thị sản phẩm', 'Int', ['luot hien thi san pham']),
      f('clicks', 'Lượt nhấp vào sản phẩm', 'Int', ['luot nhap vao san pham']), f('ctr', 'Tỷ lệ nhấp (Video)', 'Ratio', ['ty le nhap'], { na: 1 }), f('ctor', 'CTOR (đơn hàng SKU)', 'Ratio', ['ctor'], { na: 1 })] });

  ds({ key: 'shop_daily', label: 'Phân tích shop – chỉ số chính theo ngày (Shop Analytics)', source: 'Seller Center → Phân tích → Phân tích cửa hàng → Chỉ số chính (Shop Analytics_Key metrics_*.xlsx)',
    desc: 'GMV toàn shop, đơn hàng, đơn hàng SKU, hoàn tiền, lượt xem… theo ngày, kèm GMV theo kênh. Kỳ ở dòng 1 “Ngày phân tích”; bảng “Tổng giá trị” dùng để đối chiếu.', dateField: 'date', signature: ['date', 'gmv', 'orders'], keyFields: ['date'], totalLabelFields: ['date'], coverage: true,
    fields: [f('date', 'Ngày', 'Date', ['ngay', 'date', 'thoi gian'], { req: 1 }), f('gmv', 'GMV toàn shop', 'Money', ['gmv'], { req: 1 }), f('orders', 'Đơn hàng', 'Int', ['don hang', 'orders']),
      f('customers', 'Khách hàng (duy nhất trong ngày)', 'Int', ['khach hang', 'customers', 'buyers'], { na: 1 }), f('items_sold', 'Số món bán ra', 'Int', ['so mon ban ra', 'items sold']),
      f('refund', 'Hoàn tiền (theo ngày phát sinh hoàn)', 'Money', ['hoan tien', 'refunds']), f('sku_orders', 'Đơn hàng SKU', 'Int', ['don hang sku', 'sku orders']),
      f('total_revenue', 'Tổng doanh thu (theo Phân tích shop)', 'Money', ['tong doanh thu', 'total revenue']), f('page_views', 'Lượt xem trang', 'Int', ['luot xem trang', 'page views']),
      f('visitors', 'Khách truy cập (duy nhất trong ngày)', 'Int', ['khach truy cap', 'visitors'], { na: 1 }), f('cvr', 'Tỷ lệ chuyển đổi', 'Ratio', ['ty le chuyen doi', 'conversion rate'], { na: 1 }),
      f('impressions', 'Lượt hiển thị sản phẩm', 'Int', ['luot hien thi san pham', 'product impressions']), f('unique_impressions', 'Lượt hiển thị sản phẩm độc nhất', 'Int', ['luot hien thi san pham doc nhat'], { na: 1 }),
      f('clicks', 'Lượt nhấp vào sản phẩm', 'Int', ['luot nhap vao san pham', 'product clicks']), f('unique_clicks', 'Lượt nhấp độc nhất', 'Int', ['luot nhap doc nhat'], { na: 1 }),
      f('aov', 'AOV', 'Money', ['aov'], { na: 1 }),
      f('gmv_creator_live', 'GMV nhờ LIVE của nhà sáng tạo', 'Money', ['gmv nho buoi live cua nha sang tao']), f('gmv_creator_live_direct', 'GMV LIVE của nhà sáng tạo (trực tiếp)', 'Money', ['gmv live cua nha sang tao']),
      f('gmv_creator_live_indirect', 'GMV gián tiếp từ LIVE của nhà sáng tạo', 'Money', ['gmv gian tiep tu buoi live cua nha sang tao']), f('gmv_seller_live', 'GMV nhờ LIVE của tài khoản kết nối', 'Money', ['gmv nho buoi live cua tai khoan ket noi']),
      f('gmv_seller_live_direct', 'GMV LIVE của người bán (trực tiếp)', 'Money', ['gmv live cua nguoi ban']), f('gmv_seller_live_indirect', 'GMV gián tiếp từ LIVE của người bán', 'Money', ['gmv gian tiep tu buoi live cua nguoi ban']),
      f('gmv_product_card', 'GMV thẻ sản phẩm', 'Money', ['gmv the san pham']), f('gmv_creator_video', 'GMV đến từ video liên kết (nhà sáng tạo)', 'Money', ['gmv den tu video lien ket']),
      f('gmv_creator_video_direct', 'GMV video của nhà sáng tạo (trực tiếp)', 'Money', ['gmv video cua nha sang tao']), f('gmv_creator_video_indirect', 'GMV gián tiếp từ video của nhà sáng tạo', 'Money', ['gmv gian tiep tu video cua nha sang tao']),
      f('gmv_seller_video', 'GMV nhờ video của tài khoản kết nối', 'Money', ['gmv nho video cua tai khoan ket noi']), f('gmv_seller_video_direct', 'GMV video của người bán (trực tiếp)', 'Money', ['gmv video cua nguoi ban']),
      f('gmv_seller_video_indirect', 'GMV gián tiếp từ video của người bán', 'Money', ['gmv gian tiep tu video cua nguoi ban'])] });

  ds({ key: 'affiliate_period', label: 'Liên kết – chỉ số cốt lõi theo kỳ (Affiliate)', source: 'TikTok Shop → Liên kết → Phân tích giao dịch (Transaction_Analysis_Core_Metrics_<từ>-<đến>.xlsx)',
    desc: 'Một dòng tổng cho cả kỳ; kỳ lấy từ tên file. Chỉ báo cáo ở cấp shop × kỳ.', signature: ['gmv', 'commission'], keyFields: [], coverage: true,
    fields: [f('gmv', 'GMV nhờ nhà sáng tạo', 'Money', ['gmv nho nha sang tao', 'creator gmv', 'affiliate gmv'], { req: 1 }), f('items_sold', 'Số món bán ra nhờ nhà sáng tạo', 'Int', ['so mon ban ra nho nha sang tao', 'items sold']),
      f('refund', 'Hoàn tiền', 'Money', ['hoan tien', 'refunds']), f('items_refunded', 'Số món đã hoàn tiền', 'Int', ['so mon da hoan tien', 'refunded items']), f('aov', 'AOV', 'Money', ['aov'], { na: 1 }),
      f('ctor', 'CTOR', 'Ratio', ['ctor'], { na: 1 }), f('videos', 'Video', 'Int', ['video', 'videos']), f('lives', 'Buổi LIVE', 'Int', ['buoi live', 'lives', 'live']),
      f('sample_content', 'Tổng nội dung có hàng mẫu', 'Int', ['tong noi dung co hang mau']), f('ctr', 'CTR', 'Ratio', ['ctr'], { na: 1 }),
      f('creators', 'Nhà sáng tạo trong hoạt động cộng tác', 'Int', ['nha sang tao trong hoat dong cong tac']), f('commission', 'Hoa hồng ước tính', 'Money', ['hoa hong uoc tinh', 'estimated commission'], { req: 1 }),
      f('samples_shipped', 'Hàng mẫu đã vận chuyển', 'Int', ['hang mau da van chuyen', 'samples shipped'])] });

  ds({ key: 'orders', label: 'Đơn hàng TikTok Shop (cấp dòng SKU)', source: 'Seller Center → Đơn hàng → Quản lý đơn hàng → Xuất đơn hàng',
    desc: 'Mỗi dòng là 1 SKU trong 1 đơn. Số đơn hàng duy nhất ≠ số đơn SKU. Tên, SĐT, địa chỉ khách không được lưu.', dateField: 'created_time', signature: ['order_id', 'created_time'],
    keyFields: ['order_id', 'sku_id'], allowDupKey: true, totalLabelFields: ['order_id'], noPeriodKey: true,
    fields: [f('order_id', 'Mã đơn hàng', 'Text', ['order id', 'id don hang', 'ma don hang', 'ma dh', 'so don hang'], { req: 1 }),
      f('status', 'Trạng thái đơn hàng', 'Text', ['order status', 'trang thai don hang', 'trang thai'], { miss: 'Không tính được tỷ lệ hủy/hoàn và doanh số sau hoàn/hủy' }),
      f('substatus', 'Trạng thái phụ', 'Text', ['order substatus', 'trang thai phu', 'trang thai phu cua don hang']),
      f('cancel_return_type', 'Loại hủy/trả hàng', 'Text', ['cancelation return type', 'cancellation return type', 'loai huy tra hang', 'loai huy hoan', 'loai huy hoan tra']),
      f('sku_id', 'SKU ID', 'Text', ['sku id', 'id sku', 'ma sku']), f('seller_sku', 'SKU người bán', 'Text', ['seller sku', 'sku nguoi ban', 'ma sku nguoi ban']),
      f('product_name', 'Tên sản phẩm', 'Text', ['product name', 'ten san pham']), f('variation', 'Biến thể', 'Text', ['variation', 'bien the', 'phan loai']),
      f('quantity', 'Số lượng', 'Int', ['quantity', 'so luong']), f('return_qty', 'SL trả hàng', 'Int', ['sku quantity of return', 'so luong tra hang', 'so luong sku tra lai']),
      f('unit_price', 'Đơn giá gốc SKU', 'Money', ['sku unit original price', 'don gia goc sku', 'don gia']), f('subtotal_before', 'Tạm tính SKU trước giảm giá', 'Money', ['sku subtotal before discount', 'tong phu sku truoc giam gia']),
      f('platform_discount', 'Giảm giá của nền tảng (SKU)', 'Money', ['sku platform discount', 'giam gia cua nen tang']), f('seller_discount', 'Giảm giá của người bán (SKU)', 'Money', ['sku seller discount', 'giam gia cua nguoi ban']),
      f('subtotal_after', 'Tạm tính SKU sau giảm giá', 'Money', ['sku subtotal after discount', 'tong phu sku sau giam gia', 'thanh tien sau giam gia']),
      f('shipping_after', 'Phí vận chuyển sau giảm giá', 'Money', ['shipping fee after discount', 'phi van chuyen sau giam gia']),
      f('order_amount', 'Số tiền đơn hàng (cấp đơn)', 'Money', ['order amount', 'so tien don hang', 'tong tien don hang', 'gia tri don hang'], { miss: 'Không tính được giá trị đơn và doanh số sau hoàn/hủy' }),
      f('order_refund', 'Số tiền hoàn của đơn (cấp đơn)', 'Money', ['order refund amount', 'so tien hoan lai cua don hang', 'so tien hoan tien', 'so tien hoan lai']),
      f('created_time', 'Thời gian tạo đơn', 'DateTime', ['created time', 'thoi gian tao', 'thoi gian tao don', 'ngay tao don', 'order created time', 'thoi gian dat hang'], { req: 1 }),
      f('paid_time', 'Thời gian thanh toán', 'DateTime', ['paid time', 'thoi gian thanh toan']), f('shipped_time', 'Thời gian gửi hàng', 'DateTime', ['shipped time', 'thoi gian gui hang']),
      f('delivered_time', 'Thời gian giao thành công', 'DateTime', ['delivered time', 'thoi gian giao hang', 'thoi gian giao hang thanh cong']),
      f('cancelled_time', 'Thời gian hủy', 'DateTime', ['cancelled time', 'canceled time', 'thoi gian huy']), f('cancel_by', 'Hủy bởi', 'Text', ['cancel by', 'huy boi']),
      f('cancel_reason', 'Lý do hủy', 'Text', ['cancel reason', 'ly do huy']), f('payment_method', 'Phương thức thanh toán', 'Text', ['payment method', 'phuong thuc thanh toan'])] });

  ds({ key: 'settlement', label: 'Quyết toán / Thu nhập (Tài chính TikTok Shop)', source: 'Seller Center → Tài chính → Thu nhập / Quyết toán → Xuất',
    desc: 'Tiền quyết toán theo đơn hàng / điều chỉnh, theo thời gian quyết toán.', dateField: 'settled_time', signature: ['ref_id', 'settlement_amount'],
    keyFields: ['ref_id', 'type', 'settled_time'], totalLabelFields: ['ref_id'], noPeriodKey: true,
    fields: [f('ref_id', 'Mã đơn hàng / điều chỉnh', 'Text', ['order adjustment id', 'id don hang dieu chinh', 'ma don hang dieu chinh', 'statement id', 'order id', 'id don hang'], { req: 1 }),
      f('type', 'Loại', 'Text', ['type', 'loai', 'loai giao dich']), f('order_created', 'Thời gian tạo đơn', 'DateTime', ['order created time', 'thoi gian tao don hang', 'thoi gian tao don']),
      f('settled_time', 'Thời gian quyết toán', 'DateTime', ['order settled time', 'settled time', 'settlement time', 'thoi gian quyet toan', 'thoi gian quyet toan don hang', 'ngay quyet toan', 'statement date'], { req: 1 }),
      f('currency', 'Tiền tệ', 'Text', ['currency', 'tien te', 'don vi tien te']),
      f('settlement_amount', 'Tổng tiền quyết toán', 'Money', ['total settlement amount', 'settlement amount', 'tong so tien quyet toan', 'so tien quyet toan', 'tong tien quyet toan'], { req: 1 }),
      f('revenue', 'Tổng doanh thu (file tài chính)', 'Money', ['total revenue', 'tong doanh thu']), f('fees', 'Tổng phí', 'Money', ['total fees', 'tong phi']),
      f('related_order_id', 'Mã đơn liên quan', 'Text', ['related order id', 'ma don hang lien quan'])] });

  // chuẩn hóa: thêm cột thông tin cá nhân để chủ động loại bỏ, tập tên đã bỏ dấu
  S.all.forEach(function (d) {
    var present = {}; d.fields.forEach(function (x) { x.syn.forEach(function (s) { present[K.norm(s)] = 1; }); });
    var n = 0;
    PII.forEach(function (p) { if (!present[K.norm(p)]) d.fields.push(f('_pii' + (n++), 'Thông tin cá nhân (không lưu)', 'Text', [p], { pii: 1 })); });
    d.fields.forEach(function (x) { x.normSyn = {}; x.syn.forEach(function (s) { x.normSyn[K.norm(s)] = 1; }); });
    d.F = {}; d.fields.forEach(function (x) { d.F[x.key] = x; });
    d.stored = d.fields.filter(function (x) { return !x.pii; });
    d.signature = d.signature || []; d.keyFields = d.keyFields || []; d.entityFields = d.entityFields || []; d.totalLabelFields = d.totalLabelFields || [];
  });
  S.get = function (k) { for (var i = 0; i < S.all.length; i++) if (S.all[i].key === k) return S.all[i]; return null; };
  root.TTSS = S;
})(typeof window !== 'undefined' ? window : self);
