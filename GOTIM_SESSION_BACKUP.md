# 🗂️ GO TÍM — BACKUP PHIÊN LÀM VIỆC (2026-07-07)

> **Mục đích:** Đọc file này là nối lại được tiến trình, kể cả khi đổi tài khoản Claude / máy khác.
> File nằm trên ổ đĩa nên không phụ thuộc bộ nhớ `~/.claude` (bộ nhớ không theo tài khoản).
> **Đọc kèm:** `.brain/SHARED/EXECUTION_LOG.md`, và 2 file bộ nhớ gốc (chép lại ở mục 6 bên dưới).
> **Đổi tài khoản?** Bảo phiên mới: *"đọc GOTIM_SESSION_BACKUP.md"* — xem ngay khối 🔴 dưới đây.

---

## 🔴 TRẠNG THÁI HIỆN TẠI (cập nhật mỗi bước — đọc đầu tiên)

**Cập nhật lúc:** 2026-07-08

**Đang ở đâu:** TOÀN BỘ CODE ĐÃ XONG + verify chạy thật + **đã git commit backup** (local, chưa push). Đang **chờ người dùng chạy 2 file SQL trong Supabase** (sandbox không có mạng nên Claude không tự chạy được).

**Mốc git đã lưu (khôi phục được):** scratch repo (`master`) → xem `git log`; Thuc hanh repo (`main`) → `3ed5c608`. Cơ chế: commit local theo mốc, KHÔNG push. Muốn khôi phục: `git checkout <hash> -- <file>`.

**Vừa làm gần nhất:** Số áo tài xế — luật từ 9 trở lên + không trùng (validate + gợi ý số trống). Đã verify. Commit scratch tiếp theo.

**▶ VIỆC KẾ TIẾP NGAY (làm theo thứ tự):**
1. ⬜ Chạy **1 file** `scratch/tools/gotim_real_data.sql` trong Supabase SQL Editor (đã GỘP: tạo bảng zalo_violations + cột hồ sơ/áo + nạp 23 tài xế + doanh thu + công nợ). ⚠️ File này XÓA tài xế mẫu.
2. ⬜ Mở app trên máy có mạng → test: sửa 1 tài xế, F5 lại xem còn không (chứng minh cloud OK).
3. ⬜ Deploy: `cd scratch && git push` (Vercel tự build) HOẶC `vercel --prod`. CHỈ deploy SAU bước 1.
4. ⬜ Chạy `python .brain/SHARED/gotim_backfill.py --from 2026-04-27 --to 2026-05-07` (nạp vi phạm cũ).
5. ⬜ Nhập số áo/ràng buộc lịch trực thật trong app.
6. ⬜ Bật bot 24/7 — CHƯA, hỏi Sếp trước (rủi ro khóa acc Zalo).
7. 🔴 **BẢO MẬT:** GitHub token (`ghp_...`) đang lộ trong git remote của scratch → thu hồi + gắn credential helper.

git backup: đã commit local (scratch `02f2e20`→`a9bb865`, Thuc hanh `3ed5c608`), CHƯA push.

**Đang chờ Sếp quyết:** có git commit không; có nhập ràng buộc/áo thật giúp không.

**Việc code còn có thể làm tiếp (chưa bắt đầu):** bảng xếp hạng tài xế tháng (đọc `driver_monthly_stats`); form chọn chiết khấu 10/20% trong sửa tài xế; set quỹ = 10k/ngày trong Cài đặt quỹ; nhập lịch trực điểm từ sheet LICHTRUCNHAT.

---

## 1. TÓM TẮT: đang làm gì

Xây **app quản lý Go Tím** (xe ôm/giao hàng Phước Long–Bạc Liêu) — mở rộng app **Tím Go** có sẵn (Vercel + Supabase free), admin-only. Gồm 3 mảng:
1. **Bot Zalo** (`.brain/SHARED/`) — nghe 3 nhóm qua `zca` CLI, bắt vi phạm, ghi Supabase.
2. **App Tím Go** (`C:\Users\Admin\.gemini\antigravity\scratch\`) — dashboard admin: Zalo Audit, hồ sơ/áo tài xế, lịch trực + AI xếp lịch, tài chính.
3. **Nhập dữ liệu thật** từ file Excel báo cáo T7.

Nền tảng: Vercel (host free) + Supabase (project `kallatsgzplndkjsxdqh`, dùng chung anon key với app). Live: scratch-two-delta.vercel.app. Admin login: `0948505077` / `Tamthinh123`.

---

## 2. ĐÃ LÀM XONG (code + verify)

### A. Bot Zalo (`D:\canva\Antigravity\Thuc hanh\.brain\SHARED\`)
- `gotim_schedule.py` — ca trực bot: Sáng 6-17 / Chiều 17-23 / Khuya 23+ (khuya chạy MỌI ngày, bỏ giới hạn cuối tuần). Xóa hàm `is_weekend` thừa.
- `gotim_listener.py` — thêm nhãn `HUY_*` (hủy cuốc, bắt "hủy/huỷ/huy"), nhãn `LAI_HO`/`DI_CHO_HO`; ghi vi phạm vào Supabase realtime.
- `gotim_daily.py` — nhãn mới + giá tiền LUÔN ×1000 (bỏ điều kiện <200); thêm `import os` (fix bug crash); `build_violation_rows()`; ghi Supabase cuối báo cáo.
- `gotim_supabase.py` (MỚI) — bridge ghi bảng `zalo_violations`, tự đọc key từ `scratch/.env`.
- `gotim_replay_check.py` (MỚI) — chạy lại logic trên dữ liệu thật 27/04-07/05 (đã verify: 30 cuốc, không false-positive geo).
- `gotim_backfill.py` (MỚI) — nạp vi phạm lịch sử vào Supabase (dry-run OK: 30 cuốc/16 vi phạm).
- `supabase_migration_zalo_violations.sql` (MỚI) — tạo bảng `zalo_violations`.

### B. App Tím Go (`scratch/`)
- `supabase.js` — đọc/ghi `zalo_violations`, `dbResolveViolation`, `dbBackfillViolationDriver`; `mapUserToDB` thêm field: dob, deposit_note, uniform_note, **ao_so, ao_size, ao_soluong**.
- `main.js` (nhiều phần):
  - Tab **Zalo Audit** (`scr-a-zalo-audit`) — feed vi phạm, nút Phạt/Cộng quỹ/Bỏ qua.
  - Màn **Ánh xạ tài xế Zalo** (`scr-a-zalo-mapping`) — gán zalo_id vào tài xế.
  - **Quản lý áo** tài xế — số áo/size/số lượng, hiện số áo trên thẻ tài xế (tra khi có vấn đề). Chi tiết tài xế thêm: CCCD, ngày sinh, cọc, tiền áo, trạng thái "tạm nghỉ".
  - Menu Cài đặt chia 2 nhóm: **🛣️ Hành trình** (Zalo Audit, Ánh xạ) và **💰 Tài chính & Lịch trực**.
  - **Lịch trực** (`scr-a-duty`) — 3 suất/ngày × 7 thứ; gán/gỡ; nút 🔄 báo nghỉ → gợi ý 2-3 người thay; ⚙️ ràng buộc người×thứ×ca.
  - **🤖 AI xếp lịch cả tuần** (`aiAutoFillRoster`) — tự phủ đủ suất, tôn trọng ràng buộc + luật xoay (tối→hôm sau trễ) + cân bằng ca. ĐÃ VERIFY: ràng buộc Ngô đúng, số lượng 2/8/4, xoay 4/4.
- `tools/build_import_sql.py` (MỚI) — đọc Excel → sinh `tools/gotim_real_data.sql`.
- `tools/gotim_real_data.sql` (MỚI, sinh tự động) — nạp 23 tài xế + doanh thu T7 + 85 công nợ + cột hồ sơ/áo.

**Verify:** tất cả test qua `preview` (Vite dev) đăng nhập admin thật. Lỗi đỏ console chỉ là Supabase sync fail do sandbox không có mạng — logic local đúng.

---

## 3. ⚠️ VIỆC NGƯỜI DÙNG CẦN LÀM (chưa làm được từ sandbox — không có mạng tới Supabase)

Theo thứ tự:
1. **Chạy** `.brain/SHARED/supabase_migration_zalo_violations.sql` trong Supabase SQL Editor (tạo bảng `zalo_violations`).
2. **Chạy** `scratch/tools/gotim_real_data.sql` trong Supabase SQL Editor — ⚠️ file này **XÓA tài xế mẫu** rồi nạp 23 tài xế thật + cột hồ sơ/áo + doanh thu + công nợ. Kiểm tra trước khi chạy.
3. **Chạy** `python .brain/SHARED/gotim_backfill.py --from 2026-04-27 --to 2026-05-07` (nạp vi phạm lịch sử).
4. Vào app → nhập số/size/số lượng áo thật cho từng tài xế (Excel chưa có).
5. Nhập ràng buộc lịch trực thật (VD anh Ngô cấm ca tối T2-T5 — chưa set sẵn).
6. **Bot 24/7:** tài khoản Zalo (Tâm Thịnh) VẪN đăng nhập sẵn, còn trong đúng 3 nhóm (Chiết Khấu `2110802780341652731`, Đơn `3901305611070113940`, Chat `4941719454714785`). Muốn chạy lại: `python .brain/SHARED/gotim_listener.py`. ⚠️ CHƯA bật — rủi ro khóa acc khi chạy 24/7 + gửi cảnh báo thật cho tài xế. Hỏi Sếp trước khi bật.

---

## 4. QUYẾT ĐỊNH ĐÃ CHỐT (spec)

**Tài chính:** chiết khấu 2 mốc **10%/20%** đặt riêng từng tài xế (admin chọn, hỗ trợ tài xế). **Phí nền tảng = tiền quỹ = 10k × số ngày hoạt động**. 1 quỹ chung (bỏ quỹ marketing). Phạt vào quỹ. Giá tiền LUÔN ×1000.

**Nhập Excel:** ghép doanh thu↔hồ sơ THEO TÊN (2 sheet đánh số khác nhau). Bỏ tài xế "TÍNH" (có doanh thu, không hồ sơ). Người nghỉ T7 → status "paused".

**Lịch trực (3 suất/ngày):**
| Suất | Giờ | Số người |
|---|---|---|
| Ca ngày sớm | Vào 6h30 → về 22h | 2 |
| Ca ngày trễ | Vào 9h30 → tối | Đầy đủ full-ca còn lại |
| Ca tối | Có mặt 17h–18h30 → 24h | 4 |

Luật xoay: trực tối hôm nay → hôm sau vào trễ 9h30. Xếp thay: gợi ý 2-3 người (rảnh + không vướng ràng buộc + ít ca), admin chọn. Không tìm được → báo xử lý tay. Ràng buộc người×thứ×ca do admin nhập trong app.

**Phân biệt quan trọng:** "lịch trực điểm" (module app này) KHÁC "ca chạy xe" mà bot dùng để bắt sai ca.

---

## 5. HOÃN / NGOÀI PHẠM VI
- Zalo OAuth login cho tài xế (`zalo-auth.js` có sẵn 80%) — để sau.
- Bật bot 24/7 trên Fly.io — hỏi Sếp trước.
- AI ngôn ngữ giải thích lý do xếp lịch — hiện dùng bộ xếp deterministic (chắc chắn, miễn phí).
- Module lịch trực điểm nhập sẵn từ Excel LICHTRUCNHAT — chưa nhập.

---

## 6. FILE ĐÃ ĐỌC PHÂN TÍCH
`D:\canva\Tim Go\file bao cao 47\BAOCAOTHUE2026_07 - Copy.xlsx` — 8 sheet: DSTX (23 tài xế), LICHTRUCNHAT (lịch trực điểm), DANHTHU2026 + "7" (doanh thu T7 ~9.198tr), QUYGOIM (quỹ + phạt), QUYMAKETTING, CNo + DS CN (công nợ 25 khách).

---

*Cập nhật: 2026-07-07 — Claude Code. Bộ nhớ gốc: `~/.claude/projects/D--canva-Antigravity-Thuc-hanh/memory/gotim_finance_model.md` + `gotim_lich_truc.md` + `gotim_bot_state.md`.*
