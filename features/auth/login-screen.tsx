"use client";

import { Eye, EyeOff, Lock, Mail, Sparkles } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/features/app-shell/app-context";
import { DEMO_ACCOUNTS, ROLE_LABELS } from "@/lib/constants";
import { demoData } from "@/services/demo-data";
import type { UserRole } from "@/types/domain";

export function LoginScreen() {
  const { login } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      login(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đăng nhập thất bại.");
    } finally {
      setLoading(false);
    }
  }

  function handleQuickLogin(demoEmail: string) {
    setEmail(demoEmail);
    setPassword("demo123");
    setError("");
    try {
      login(demoEmail, "demo123");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi đăng nhập.");
    }
  }

  const demoProfiles = demoData.profiles.filter((profile) => DEMO_ACCOUNTS.includes(profile.email));

  return (
    <div className="min-h-screen px-4 py-5 md:px-8 md:py-8 flex items-center justify-center">
      <div className="w-full max-w-[1180px] grid lg:grid-cols-[0.95fr_1.05fr] gap-5">
        <section className="luxe-panel-strong rounded-[2.2rem] p-7 md:p-10 lg:p-12 relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-[radial-gradient(circle,rgba(214,175,95,0.22),transparent_68%)]" />
          <div className="absolute -bottom-16 -left-10 w-40 h-40 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.9),transparent_70%)]" />

          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 luxe-badge text-xs font-semibold mb-6">
              <Sparkles size={14} />
              Trải nghiệm trắng vàng sang trọng
            </div>

            <div className="w-16 h-16 rounded-[1.4rem] gold-gradient-bg text-white flex items-center justify-center luxe-ring mb-6">
              <span className="text-2xl font-extrabold">HS</span>
            </div>

            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-[#352311] leading-[1.05]">
              Hồ Sơ BĐS
            </h1>
            <p className="text-lg md:text-xl text-[#8b7656] mt-3 max-w-lg">
              Giao diện tinh gọn cho quản lý hồ sơ bất động sản, biên nhận và luồng xử lý nội bộ.
            </p>

            <div className="grid sm:grid-cols-3 gap-3 mt-8">
              {[
                { label: "Hồ sơ", value: "Cấu trúc gọn" },
                { label: "Biên nhận", value: "OCR + nhập tay" },
                { label: "Điều phối", value: "Theo dõi tiến độ" },
              ].map((item) => (
                <div key={item.label} className="luxe-card rounded-[1.5rem] p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-[#a48757]">{item.label}</p>
                  <p className="text-sm font-semibold text-[#3b2915] mt-2">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="luxe-panel rounded-[2.2rem] p-5 md:p-7 lg:p-9">
          <div className="mb-6">
            <p className="text-xs uppercase tracking-[0.24em] text-[#a48757] mb-2">Đăng nhập hệ thống</p>
            <h2 className="text-2xl md:text-3xl font-extrabold text-[#352311]">Chào mừng quay lại</h2>
            <p className="text-sm text-[#8b7656] mt-2">Sử dụng tài khoản nội bộ hoặc chọn nhanh tài khoản demo bên dưới.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="rounded-2xl border border-[#e7b4a3] bg-[#fff4f0] px-4 py-3 text-sm text-[#b15d47]">{error}</div>}

            <label className="block">
              <span className="text-xs font-semibold text-[#8b7656] mb-2 block">Email công ty</span>
              <div className="flex items-center gap-3 luxe-input rounded-2xl px-4 py-3">
                <Mail size={18} className="text-[#b4882e] shrink-0" />
                <input
                  type="email"
                  placeholder="name@hosobds.local"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="flex-1 bg-transparent outline-none text-sm"
                  autoComplete="email"
                  required
                />
              </div>
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-[#8b7656] mb-2 block">Mật khẩu</span>
              <div className="flex items-center gap-3 luxe-input rounded-2xl px-4 py-3">
                <Lock size={18} className="text-[#b4882e] shrink-0" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Nhập mật khẩu"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="flex-1 bg-transparent outline-none text-sm"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="text-[#9f8b6c] hover:text-[#7a5b25] transition-colors"
                >
                  {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                </button>
              </div>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full luxe-button-primary rounded-2xl py-4 text-base font-bold transition-all disabled:opacity-60"
            >
              {loading ? "Đang đăng nhập..." : "Đăng nhập"}
            </button>

            <div className="flex items-center justify-between text-sm">
              <button type="button" className="text-[#8b7656] hover:text-[#7a5b25] transition-colors">
                Quên mật khẩu?
              </button>
              <span className="text-[#aa936f]">Mật khẩu demo: `demo123`</span>
            </div>
          </form>

          <div className="mt-7">
            <div className="relative mb-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[rgba(198,152,53,0.16)]" />
              </div>
              <div className="relative flex justify-center">
                <span className="px-4 text-xs uppercase tracking-[0.18em] text-[#a18d6b] bg-[rgba(255,250,241,0.96)]">
                  Đăng nhập nhanh
                </span>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              {demoProfiles.map((profile) => (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => handleQuickLogin(profile.email)}
                  className="luxe-card rounded-[1.4rem] px-4 py-3 text-left"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#3a2914]">{profile.fullName}</p>
                      <p className="text-xs text-[#8b7656] mt-1">{ROLE_LABELS[profile.role as UserRole]}</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-[rgba(255,244,219,0.95)] border border-[rgba(198,152,53,0.16)] flex items-center justify-center text-sm font-bold text-[#8b6418] shrink-0">
                      {profile.fullName.charAt(0)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
