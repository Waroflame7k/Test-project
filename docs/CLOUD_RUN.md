# Deploy Hồ Sơ BĐS lên Google Cloud Run

Tài khoản Google Cloud có credit dùng được cho Cloud Run. Bản chuẩn bị này đóng gói app Next.js bằng Dockerfile và chạy trên cổng `8080`, đúng mặc định của Cloud Run.

## 1. Chuẩn bị Google Cloud

Trong Google Cloud Console:

1. Chọn đúng project.
2. Bật Billing cho project.
3. Vào **APIs & Services** và bật:
   - Cloud Run API
   - Cloud Build API
   - Artifact Registry API
4. Vào **Artifact Registry** tạo Docker repository:
   - Name: `ho-so-bds`
   - Format: Docker
   - Region: `asia-southeast1` hoặc region gần Việt Nam anh muốn dùng.
5. Vào **Billing > Budgets & alerts** tạo cảnh báo ngân sách.

## 2. Build local để kiểm tra

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
```

Nếu máy có Docker Desktop:

```bash
docker build -t ho-so-bds:local .
docker run --rm -p 8080:8080 ho-so-bds:local
```

Mở `http://localhost:8080`.

## 3. Deploy bằng gcloud

Cài và đăng nhập Google Cloud CLI, sau đó chạy:

```bash
gcloud auth login
gcloud config set project PROJECT_ID
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
gcloud artifacts repositories create ho-so-bds --repository-format=docker --location=asia-southeast1 --description="Hồ Sơ BĐS containers"
gcloud builds submit --config cloudbuild.yaml --substitutions=_REGION=asia-southeast1,_SERVICE=ho-so-bds,_REPOSITORY=ho-so-bds
```

Sau khi deploy xong, Cloud Run sẽ trả về URL HTTPS. Mở URL đó trên điện thoại rồi chọn **Thêm vào màn hình chính**.

## 3A. Deploy bằng Google Cloud Shell nếu máy chưa có Docker/gcloud

Máy hiện tại không bắt buộc phải cài Docker hoặc Google Cloud CLI. Có thể dùng **Cloud Shell** ngay trong Google Cloud Console:

1. Bấm biểu tượng **Activate Cloud Shell** ở góc trên bên phải Google Cloud Console.
2. Upload source code của app lên Cloud Shell, hoặc đưa source lên GitHub rồi clone trong Cloud Shell.
3. Trong Cloud Shell, vào thư mục app.
4. Chạy các lệnh ở mục **Deploy bằng gcloud**.

Cloud Shell đã có sẵn `gcloud`, Docker và quyền project sau khi anh đăng nhập Google Cloud Console.

## 4. Deploy bằng giao diện Google Cloud

1. Vào **Cloud Run**.
2. Chọn **Create service**.
3. Chọn **Deploy one revision from an existing container image** nếu đã build/push image bằng Cloud Build.
4. Chọn image trong Artifact Registry.
5. Service name: `ho-so-bds`.
6. Region: `asia-southeast1`.
7. Authentication: chọn **Allow unauthenticated invocations** nếu muốn mở app công khai.
8. Container port: `8080`.
9. Memory: `512Mi`, CPU: `1`, min instances: `0`, max instances: `3`.
10. Deploy.

## 5. Biến môi trường production

Hiện app chạy được bằng demo mode:

```bash
NEXT_PUBLIC_APP_MODE=demo
```

Khi nối Supabase thật, cần cung cấp khi build Docker image:

```bash
NEXT_PUBLIC_APP_MODE=production
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_SITE_URL=https://DOMAIN_CUA_ANH
```

Lưu ý: biến `NEXT_PUBLIC_*` của Next.js được đóng vào bundle khi build. Nếu đổi Supabase URL hoặc site URL, cần build/deploy lại image.

Không đưa Supabase service role key hoặc secret thật vào frontend.

## 6. Domain và điện thoại

Sau khi Cloud Run có URL:

1. Có thể dùng URL mặc định dạng `https://...run.app`.
2. Nếu muốn domain riêng, vào **Cloud Run > Manage custom domains**.
3. Trên iPhone/Android mở URL HTTPS.
4. Chọn **Add to Home Screen / Thêm vào màn hình chính**.

## 7. Lưu ý chi phí

Cloud Run có thể scale về 0 khi không dùng nếu `min instances = 0`. Dù vậy, Cloud Build, Artifact Registry, egress hoặc các dịch vụ khác vẫn có thể phát sinh phí. Nên bật budget alert trước khi public.
