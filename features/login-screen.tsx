"use client";

import { Building2, KeyRound, Lock, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Field, Input } from "@/components/ui";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/constants";
import type { Profile } from "@/types/domain";

const loginSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  password: z.string().min(1, "Vui lòng nhập mật khẩu")
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginScreen({
  onLogin,
  error
}: {
  onLogin: (email: string, password: string) => void;
  error?: string;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "admin@hosobds.local", password: DEMO_PASSWORD }
  });

  return (
    <main className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-slate-50 px-4 py-12">
      {/* Background Ambient Glow Effects */}
      <div className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-amber-400/10 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-yellow-500/10 blur-[120px]" />

      <div className="relative w-full max-w-md">
        {/* Brand Header */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="relative mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 via-amber-600 to-yellow-500 p-0.5 shadow-xl shadow-amber-500/25">
            <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-white">
              <Building2 className="h-8 w-8 text-amber-600" />
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3.5 py-1 text-xs font-extrabold text-amber-800 shadow-2xs">
            <Sparkles className="h-3.5 w-3.5 text-amber-600" /> NGUYỄN KHOA BĐS
          </span>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900">Hồ Sơ BĐS</h1>
          <p className="mt-1 text-sm font-semibold text-slate-500">Hệ thống quản lý hồ sơ bất động sản cao cấp</p>
        </div>

        {/* Main Form White-Gold Card */}
        <div className="rounded-3xl border border-amber-200/70 bg-white p-8 shadow-2xl shadow-amber-500/10">
          <form className="grid gap-5" onSubmit={handleSubmit((values) => onLogin(values.email, values.password))}>
            <Field label="Email nhân sự" error={errors.email?.message}>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-3 h-5 w-5 text-slate-400" aria-hidden="true" />
                <Input className="pl-11" autoComplete="email" placeholder="email@hosobds.local" {...register("email")} />
              </div>
            </Field>

            <Field label="Mật khẩu truy cập" error={errors.password?.message}>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-3 h-5 w-5 text-slate-400" aria-hidden="true" />
                <Input className="pl-11" type="password" autoComplete="current-password" placeholder="••••••••" {...register("password")} />
              </div>
            </Field>

            {error ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">
                {error}
              </div>
            ) : null}

            <Button type="submit" variant="gold" disabled={isSubmitting} className="mt-1 h-12 text-base">
              <KeyRound className="h-5 w-5" /> Đăng nhập hệ thống
            </Button>
          </form>

          {/* Quick Demo Accounts Selection */}
          <div className="mt-8 rounded-2xl border border-amber-200/60 bg-amber-50/40 p-4">
            <div className="flex items-center justify-between text-xs font-extrabold uppercase tracking-wider text-slate-700">
              <span className="flex items-center gap-1.5 text-amber-700">
                <ShieldCheck className="h-4 w-4 text-amber-600" /> Tài khoản Demo
              </span>
              <span className="text-[10px] text-slate-500">Mật khẩu: {DEMO_PASSWORD}</span>
            </div>

            <div className="mt-3 grid gap-1.5">
              {DEMO_ACCOUNTS.map((email) => {
                const roleName = email.split("@")[0].toUpperCase();
                return (
                  <button
                    type="button"
                    key={email}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-left text-xs font-bold text-slate-700 transition-all hover:border-amber-400 hover:bg-amber-50/80 hover:text-amber-900 shadow-2xs"
                    onClick={() => {
                      setValue("email", email);
                      setValue("password", DEMO_PASSWORD);
                    }}
                  >
                    <span>{email}</span>
                    <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800">{roleName}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-xs font-semibold text-slate-500">
          © 2026 Nguyễn Khoa BĐS · Công ty TNHH Xây Dựng & Địa Ốc Trường Phát
        </p>
      </div>
    </main>
  );
}

export function welcomeName(profile: Profile): string {
  return profile.fullName.split(" ").slice(-1).join(" ");
}
