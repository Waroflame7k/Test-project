# Ke hoach mo rong quan ly ho so

## Muc tieu

Bo sung cac man hinh quan ly de nguoi dung xu ly ho so hang ngay nhanh hon, quan tri theo doi duoc thu chi, va bao cao khong lam roi man hinh Tong quan.

## Pham vi da xac nhan

1. Tong quan: them phan cac khoan da thu. và bỏ các dữ liệu như tròn và cột
2. Chi tiet ho so: hien day du Lan nop, Cong viec, Tai lieu ban chinh va lich su nguoi dang giu. đồng bộ với hồ sơ được không kiểu nhập biên nhận nó tự động thêm ảnh chụp vào lần nộp
3. Thu chi: chi nguoi dung co quyen quan tri/tai chinh duoc xem va ghi nhan.
4. Bao cao: them thanh menu rieng, bao gom cac so lieu ho so va cong viec dang co tren Tong quan.
5. Cong viec: tach Lich cong viec thanh mot trang rieng, co che do tuan va thang ro rang.

## Thiet ke man hinh

### 1. Tong quan

- Giu lai cac the van hanh: ho so dang xu ly, sap han, qua han, cho bo sung va viec den han.
- Them the `Da thu trong thang` cho quan tri/ke toan; bam vao de mo man hinh Thu chi voi bo loc thang hien tai.
- Them bang ngan `Cac khoan da thu gan day`: khach hang, ma ho so, noi dung thu, so tien, ngay thu va nguoi ghi nhan.
- Khong hien so lieu thu chi voi vai tro khong co quyen tai chinh.

### 2. Chi tiet ho so

- Hien lai hai tab dang bi an: `Lan nop` va `Cong viec`.
- Tab `Lan nop`: danh sach tung lan nop theo thoi gian, ma bien nhan, co quan tiep nhan, ngay nop, hen tra, ket qua va ghi chu; cho phep them lan nop khi co quyen.
- Tab `Cong viec`: danh sach viec cua rieng ho so, nguoi phu trach, han, uu tien va trang thai; cho phep tao/cap nhat khi co quyen.
- Tab `Tai lieu`: chia thanh `Ban chinh dang giu` va `Ban sao/ban scan`.
- Moi tai lieu ban chinh hien ro: nguoi dang giu, vi tri luu, ngay nhan, lan ban giao gan nhat va nut xem lich su ban giao.
- Van giu nguyen audit log; moi lan nop, cong viec, thu chi va ban giao tai lieu phai ghi nhat ky.

### 3. Thu chi cho quan tri

- Tao man hinh `Thu chi` rieng trong menu desktop va dieu huong tu Tong quan/Bao cao.
- Chi `admin`, `manager` co quyen tai chinh va `accountant` duoc truy cap; nhan vien phap ly khong xem duoc tong thu chi.
- Bo loc: khoang ngay, loai giao dich (Thu/Chi/Chi ho), khach hang, ho so, nguoi ghi nhan va phuong thuc thanh toan.
- Chi so: tong thu, tong chi, chi ho, dong tien thuan va khoan con phai thu.
- Bang giao dich mo duoc chi tiet ho so, co nut ghi nhan giao dich moi va xem chung tu neu co.

### 4. Bao cao

- Tao menu `Bao cao` rieng; Tong quan chi con phuc vu theo doi va xu ly hang ngay.
- Bao cao ho so: tong ho so theo trang thai, dich vu, khu vuc/co quan nop, ho so sap/qua han, ho so da ban giao va tien do theo thang.
- Bao cao cong viec: viec dung han, sap han, qua han, hoan thanh, theo nguoi phu trach va theo tuan/thang.
- Bao cao tai chinh: tong thu/chi/chi ho, cong no theo ho so va cac khoan da thu gan day (chi vai tro duoc phep).
- Bo loc chung: khoang thoi gian, nguoi phu trach, dich vu va khu vuc nop; cho phep xem theo thang va xuat CSV trong dot sau.

### 5. Cong viec va Lich cong viec

- Man hinh `Cong viec` hien tai uu tien danh sach viec, bo loc va thao tac hoan thanh.
- Them o/nut `Mo lich cong viec` de dieu huong den trang `Lich cong viec` rieng, khong chen lich nho trong danh sach.
- Trang Lich co hai che do:
  - `Tuan`: 7 cot ngay, khung gio, viec hien theo gio hoac ca ngay; bam vao viec mo chi tiet ho so.
  - `Thang`: luoi ngay, huy hieu so viec, mau theo muc do uu tien/trang thai; bam ngay de xem danh sach viec cua ngay do.
- Dieu huong truoc/sau va nut `Hom nay`; bo loc nguoi phu trach va trang thai duoc dung chung voi man hinh Cong viec.

## Du lieu va phan quyen

- Tai lieu, lan nop, cong viec, phieu ban giao va giao dich da co collection/type hien tai; uu tien tai su dung, khong tao bang trung lap.
- Bo sung ham tong hop thu chi va bao cao o lop `lib` de Tong quan, Thu chi va Bao cao dung cung mot phep tinh.
- Kiem tra quyen o ca giao dien va thao tac ghi du lieu: `view_finance`, `edit_finance`, `view_reports`, `add_submissions`, `add_documents`, `update_progress`.

## Thu tu trien khai

1. Chinh navigation va route man hinh moi: Thu chi, Bao cao, Lich cong viec.
2. Mo cac tab Lan nop/Cong viec trong chi tiet ho so va hoan thien khu Tai lieu ban chinh.
3. Tao man hinh Thu chi, bo loc va cac chi so tong hop.
4. Tach Bao cao khoi Tong quan; ket noi bo loc va bieu do ho so/cong viec/tai chinh.
5. Tach Lich cong viec theo tuan/thang khoi man hinh danh sach.
6. Them test ham tong hop, test quyen va kiem tra giao dien desktop/mobile.

## Tieu chi nghiem thu

- Quan tri thay duoc `Da thu trong thang` va danh sach khoan thu gan day tren Tong quan; vai tro khong co quyen khong thay.
- Mot ho so hien duoc nhieu lan nop, cong viec va danh sach tai lieu ban chinh kem nguoi dang giu.
- Menu co `Thu chi` va `Bao cao` rieng, dung phan quyen.
- Lich cong viec mo o trang rieng, chuyen duoc giua tuan/thang va mo duoc ho so tu mot cong viec.
- Lint, typecheck, test va production build deu dat truoc khi deploy.
và cho thêm tính năng tắt mở các chức năng trên trong setting và chỉ có quản trị viên được tắt mở
