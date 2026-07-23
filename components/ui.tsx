import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { clsx } from "clsx";

export function cn(...values: Array<string | false | null | undefined>) {
  return clsx(values);
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm shadow-slate-900/5 transition-all duration-200 hover:border-amber-300/80 hover:shadow-md hover:shadow-amber-500/5",
        className
      )}
      {...props}
    />
  );
}

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" | "gold" }) {
  return (
    <button
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold tracking-wide transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
        (variant === "primary" || variant === "gold") &&
          "bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 text-white shadow-md shadow-amber-500/20 hover:from-amber-600 hover:to-amber-700 hover:shadow-lg hover:shadow-amber-500/30",
        variant === "secondary" && "border border-slate-200 bg-white text-slate-800 shadow-sm hover:border-amber-300 hover:bg-amber-50/50 hover:text-amber-900",
        variant === "ghost" && "text-slate-600 hover:bg-amber-50/60 hover:text-amber-900",
        variant === "danger" && "bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-md shadow-rose-600/20 hover:from-rose-700 hover:to-red-700",
        className
      )}
      {...props}
    />
  );
}

export function Badge({
  children,
  tone = "blue"
}: {
  children: React.ReactNode;
  tone?: "blue" | "orange" | "red" | "green" | "gray" | "purple" | "amber";
}) {
  const styles = {
    blue: "bg-sky-50 text-sky-800 border-sky-200",
    orange: "bg-amber-50 text-amber-800 border-amber-200",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
    red: "bg-rose-50 text-rose-800 border-rose-200",
    green: "bg-emerald-50 text-emerald-800 border-emerald-200",
    gray: "bg-slate-100 text-slate-700 border-slate-200",
    purple: "bg-purple-50 text-purple-800 border-purple-200"
  };

  const dotColors = {
    blue: "bg-sky-500",
    orange: "bg-amber-500",
    amber: "bg-amber-500",
    red: "bg-rose-500",
    green: "bg-emerald-500",
    gray: "bg-slate-400",
    purple: "bg-purple-500"
  };

  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold shadow-2xs", styles[tone])}>
      <span className={cn("h-1.5 w-1.5 rounded-full animate-pulse", dotColors[tone])} />
      {children}
    </span>
  );
}

export function Field({
  label,
  error,
  children
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-extrabold uppercase tracking-wider text-slate-700">
      <span>{label}</span>
      {children}
      {error ? <span className="text-xs font-semibold normal-case tracking-normal text-rose-600">{error}</span> : null}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "min-h-11 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-all duration-200 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20",
        props.className
      )}
      {...props}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "min-h-11 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 transition-all duration-200 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20",
        props.className
      )}
      {...props}
    />
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-all duration-200 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20",
        props.className
      )}
      {...props}
    />
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-8 text-center">
      <p className="text-base font-bold text-slate-800">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
  );
}
