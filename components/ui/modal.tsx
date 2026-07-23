"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center px-0 md:px-6">
      <div className="absolute inset-0 bg-[rgba(57,41,16,0.28)] backdrop-blur-[5px]" onClick={onClose} />
      <div className="relative w-full md:max-w-[560px] rounded-t-[2rem] md:rounded-[2rem] luxe-panel-strong max-h-[92vh] flex flex-col overflow-hidden">
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b luxe-divider">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-[#a3885b]">Chi tiết</p>
              <h2 className="text-base md:text-lg font-bold text-[#3a2914]">{title}</h2>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-full luxe-button-ghost transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        )}
        <div className="overflow-y-auto flex-1 p-5 md:p-6">{children}</div>
      </div>
    </div>
  );
}
