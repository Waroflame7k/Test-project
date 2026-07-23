"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Check, Search, User, Building2, BadgeDollarSign, FileText } from "lucide-react";
import { useApp, useCurrentUser } from "@/features/app-shell/app-context";
import { CASE_STATUSES, SERVICE_TYPES } from "@/lib/constants";
import { todayIso } from "@/lib/date";
import { formatVnd } from "@/lib/money";
import type { Priority, ServiceType } from "@/types/domain";

const TOTAL_STEPS = 4;
const PREPARING_STATUS = CASE_STATUSES[1];
const DEFAULT_PRIORITY = "Trung bình" as Priority;

interface WizardState {
  customerId: string;
  newCustomer: {
    fullName: string;
    phone: string;
    zalo: string;
    email: string;
    address: string;
  };
  property: {
    mapSheetNumber: string;
    parcelNumber: string;
    address: string;
    area: string;
    landType: string;
    certificateOwner: string;
  };
  serviceType: ServiceType | "";
  serviceFee: number;
  estimatedCost: number;
  description: string;
}

const initialState: WizardState = {
  customerId: "",
  newCustomer: { fullName: "", phone: "", zalo: "", email: "", address: "" },
  property: {
    mapSheetNumber: "",
    parcelNumber: "",
    address: "",
    area: "",
    landType: "",
    certificateOwner: "",
  },
  serviceType: "",
  serviceFee: 0,
  estimatedCost: 0,
  description: "",
};

export function CreateCaseWizard() {
  const { data, navigate, createCase, addCustomer, addProperty, attachPropertyToCase, addActivityLog } = useApp();
  const currentUser = useCurrentUser();

  const [step, setStep] = useState(1);
  const [state, setState] = useState<WizardState>(initialState);
  const [customerSearch, setCustomerSearch] = useState("");
  const [useNewCustomer, setUseNewCustomer] = useState(false);

  function set<K extends keyof WizardState>(key: K, value: WizardState[K]) {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  function setCustomerField(key: keyof WizardState["newCustomer"], value: string) {
    setState((prev) => ({ ...prev, newCustomer: { ...prev.newCustomer, [key]: value } }));
  }

  function setPropertyField(key: keyof WizardState["property"], value: string) {
    setState((prev) => ({ ...prev, property: { ...prev.property, [key]: value } }));
  }

  const filteredCustomers = useMemo(() => {
    return data.customers.filter((customer) => {
      if (!customerSearch.trim()) return true;
      const query = customerSearch.toLowerCase();
      return (
        customer.fullName.toLowerCase().includes(query) ||
        customer.phone.includes(query) ||
        customer.customerCode.toLowerCase().includes(query)
      );
    });
  }, [customerSearch, data.customers]);

  const selectedCustomer = data.customers.find((customer) => customer.id === state.customerId);

  function canProceed(): boolean {
    switch (step) {
      case 1:
        if (useNewCustomer) return Boolean(state.newCustomer.fullName.trim() && state.newCustomer.phone.trim());
        return Boolean(state.customerId);
      case 2:
        return Boolean(state.property.address.trim());
      case 3:
        return Boolean(state.serviceType);
      case 4:
        return state.serviceFee > 0;
      default:
        return false;
    }
  }

  function handleSubmit() {
    let resolvedCustomerId = state.customerId;

    if (useNewCustomer) {
      const newCustomer = addCustomer({
        organizationId: currentUser.organizationId,
        customerCode: `KH-${String(data.customers.length + 1).padStart(4, "0")}`,
        fullName: state.newCustomer.fullName.trim(),
        phone: state.newCustomer.phone.trim(),
        zalo: state.newCustomer.zalo.trim() || undefined,
        email: state.newCustomer.email.trim() || undefined,
        address: state.newCustomer.address.trim(),
        createdBy: currentUser.id,
      });
      resolvedCustomerId = newCustomer.id;
    }

    const customerName = useNewCustomer
      ? state.newCustomer.fullName.trim()
      : data.customers.find((customer) => customer.id === resolvedCustomerId)?.fullName ?? "";

    const newCase = createCase({
      organizationId: currentUser.organizationId,
      customerId: resolvedCustomerId,
      title: `${state.serviceType} - ${customerName}`,
      serviceType: state.serviceType as ServiceType,
      status: PREPARING_STATUS,
      priority: DEFAULT_PRIORITY,
      assignedTo: "",
      receivedDate: todayIso(),
      internalDueDate: "",
      promisedDate: "",
      serviceFee: state.serviceFee,
      estimatedCost: state.estimatedCost,
      description: state.description.trim() || undefined,
      createdBy: currentUser.id,
    });

    if (state.property.address.trim()) {
      const property = addProperty({
        organizationId: currentUser.organizationId,
        province: "",
        ward: "",
        address: state.property.address.trim(),
        mapSheetNumber: state.property.mapSheetNumber.trim(),
        parcelNumber: state.property.parcelNumber.trim(),
        area: Number(state.property.area) || 0,
        landType: state.property.landType.trim(),
        certificateNumber: "",
        certificateOwner: state.property.certificateOwner.trim(),
        notes: state.description.trim() || undefined,
      });
      attachPropertyToCase({ caseId: newCase.id, propertyId: property.id });
    }

    addActivityLog({
      organizationId: currentUser.organizationId,
      caseId: newCase.id,
      actorId: currentUser.id,
      action: "Tạo hồ sơ khách hàng",
      entityType: "cases",
      entityId: newCase.id,
      newValue: newCase.caseCode,
    });

    navigate("case-detail", { caseId: newCase.id });
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center gap-1">
          {Array.from({ length: TOTAL_STEPS }, (_, index) => index + 1).map((item) => (
            <div key={item} className="flex items-center flex-1">
              <div
                className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0 ${
                  item < step
                    ? "bg-green-500 text-white"
                    : item === step
                    ? "bg-[#ea580c] text-white"
                    : "bg-gray-200 text-gray-400"
                }`}
              >
                {item < step ? <Check size={12} /> : item}
              </div>
              {item < TOTAL_STEPS && (
                <div className={`h-0.5 flex-1 ${item < step ? "bg-green-400" : "bg-gray-200"}`} />
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">Bước {step}/{TOTAL_STEPS}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2 pb-6">
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold text-[#1a3a8a]">Thông tin khách hàng</h2>
              <p className="text-xs text-gray-400 mt-1">Tạo hồ sơ khách hàng trước, chưa cần phụ trách hay hẹn trả.</p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setUseNewCustomer(false)}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                  !useNewCustomer ? "bg-[#1a3a8a] text-white border-[#1a3a8a]" : "border-gray-200 text-gray-600"
                }`}
              >
                Chọn khách có sẵn
              </button>
              <button
                onClick={() => setUseNewCustomer(true)}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                  useNewCustomer ? "bg-[#1a3a8a] text-white border-[#1a3a8a]" : "border-gray-200 text-gray-600"
                }`}
              >
                Tạo khách mới
              </button>
            </div>

            {!useNewCustomer ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 bg-gray-50 rounded-xl border border-gray-200 px-3 py-2.5">
                  <Search size={15} className="text-gray-400" />
                  <input
                    type="text"
                    placeholder="Tìm khách hàng..."
                    value={customerSearch}
                    onChange={(event) => setCustomerSearch(event.target.value)}
                    className="flex-1 outline-none text-sm bg-transparent"
                  />
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {filteredCustomers.map((customer) => (
                    <button
                      key={customer.id}
                      onClick={() => set("customerId", customer.id)}
                      className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
                        state.customerId === customer.id
                          ? "border-[#ea580c] bg-orange-50"
                          : "border-gray-100 bg-white hover:border-gray-300"
                      }`}
                    >
                      <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                        <User size={15} className="text-[#1a3a8a]" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{customer.fullName}</p>
                        <p className="text-xs text-gray-400">
                          {customer.phone} · {customer.customerCode}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {[
                  { key: "fullName" as const, label: "Họ và tên *", type: "text", icon: User },
                  { key: "phone" as const, label: "Số điện thoại *", type: "tel", icon: User },
                  { key: "zalo" as const, label: "Zalo", type: "tel", icon: User },
                  { key: "email" as const, label: "Email", type: "email", icon: User },
                  { key: "address" as const, label: "Địa chỉ", type: "text", icon: Building2 },
                ].map((field) => {
                  const Icon = field.icon;
                  return (
                    <label key={field.key} className="block">
                      <span className="text-xs text-gray-400 mb-1 block">{field.label}</span>
                      <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2.5 bg-white">
                        <Icon size={15} className="text-gray-400 shrink-0" />
                        <input
                          type={field.type}
                          value={state.newCustomer[field.key]}
                          onChange={(event) => setCustomerField(field.key, event.target.value)}
                          className="flex-1 text-sm outline-none bg-transparent"
                        />
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <div>
              <h2 className="text-base font-bold text-[#1a3a8a]">Thông tin bất động sản</h2>
              <p className="text-xs text-gray-400 mt-1">Lưu thông tin nền của hồ sơ để dùng cho các biên nhận sau.</p>
            </div>

            {[
              { key: "mapSheetNumber" as const, label: "Số tờ" },
              { key: "parcelNumber" as const, label: "Số thửa" },
              { key: "address" as const, label: "Địa chỉ thửa đất *" },
              { key: "area" as const, label: "Diện tích (m²)" },
              { key: "landType" as const, label: "Loại đất" },
              { key: "certificateOwner" as const, label: "Chủ sổ / người đứng tên" },
            ].map((field) => (
              <label key={field.key} className="block">
                <span className="text-xs text-gray-400 mb-1 block">{field.label}</span>
                <input
                  type="text"
                  value={state.property[field.key]}
                  onChange={(event) => setPropertyField(field.key, event.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
                />
              </label>
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <div>
              <h2 className="text-base font-bold text-[#1a3a8a]">Loại dịch vụ</h2>
              <p className="text-xs text-gray-400 mt-1">Chọn nhóm công việc chính của hồ sơ khách hàng.</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {SERVICE_TYPES.map((serviceType) => (
                <button
                  key={serviceType}
                  onClick={() => set("serviceType", serviceType)}
                  className={`py-3 px-4 rounded-xl text-sm font-semibold border text-center transition-colors ${
                    state.serviceType === serviceType
                      ? "bg-[#1a3a8a] text-white border-[#1a3a8a]"
                      : "bg-white text-gray-700 border-gray-200 hover:border-[#1a3a8a]"
                  }`}
                >
                  {serviceType}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold text-[#1a3a8a]">Phí và ghi chú</h2>
              <p className="text-xs text-gray-400 mt-1">Đây là bước cuối để tạo hồ sơ khách hàng nền.</p>
            </div>

            <div className="space-y-3">
              <label className="block">
                <span className="text-xs text-gray-400 mb-1 block">Phí dịch vụ (VND) *</span>
                <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2.5 bg-white">
                  <BadgeDollarSign size={16} className="text-gray-400 shrink-0" />
                  <input
                    type="number"
                    placeholder="Ví dụ: 15000000"
                    value={state.serviceFee || ""}
                    onChange={(event) => set("serviceFee", Number(event.target.value) || 0)}
                    className="flex-1 text-sm outline-none bg-transparent"
                  />
                </div>
                {state.serviceFee > 0 && <p className="text-xs text-[#ea580c] mt-1">{formatVnd(state.serviceFee)}</p>}
              </label>

              <label className="block">
                <span className="text-xs text-gray-400 mb-1 block">Chi phí ước tính (VND)</span>
                <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2.5 bg-white">
                  <BadgeDollarSign size={16} className="text-gray-400 shrink-0" />
                  <input
                    type="number"
                    placeholder="Ví dụ: 3000000"
                    value={state.estimatedCost || ""}
                    onChange={(event) => set("estimatedCost", Number(event.target.value) || 0)}
                    className="flex-1 text-sm outline-none bg-transparent"
                  />
                </div>
                {state.estimatedCost > 0 && <p className="text-xs text-gray-400 mt-1">{formatVnd(state.estimatedCost)}</p>}
              </label>

              <label className="block">
                <span className="text-xs text-gray-400 mb-1 block">Ghi chú hồ sơ</span>
                <div className="flex items-start gap-2 border border-gray-200 rounded-xl px-3 py-2.5 bg-white">
                  <FileText size={16} className="text-gray-400 shrink-0 mt-0.5" />
                  <textarea
                    rows={4}
                    placeholder="Mô tả thêm về hồ sơ khách hàng..."
                    value={state.description}
                    onChange={(event) => set("description", event.target.value)}
                    className="flex-1 text-sm outline-none bg-transparent resize-none"
                  />
                </div>
              </label>
            </div>

            <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-100 overflow-hidden">
              <SummaryRow label="Khách hàng" value={useNewCustomer ? state.newCustomer.fullName : selectedCustomer?.fullName ?? "—"} />
              <SummaryRow label="Địa chỉ BĐS" value={state.property.address || "—"} />
              <SummaryRow label="Dịch vụ" value={state.serviceType || "—"} />
              <SummaryRow label="Phí dịch vụ" value={state.serviceFee > 0 ? formatVnd(state.serviceFee) : "—"} />
            </div>

            <button
              onClick={handleSubmit}
              className="w-full bg-[#ea580c] hover:bg-orange-600 text-white font-bold rounded-2xl py-4 transition-colors text-base"
            >
              Tạo hồ sơ khách hàng
            </button>
          </div>
        )}
      </div>

      <div className="px-4 py-4 bg-white border-t border-gray-100 flex gap-3">
        <button
          onClick={() => {
            if (step > 1) setStep((currentStep) => currentStep - 1);
            else navigate("cases");
          }}
          className="flex items-center gap-1 px-5 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600"
        >
          <ChevronLeft size={16} /> {step > 1 ? "Trước" : "Quay lại"}
        </button>

        {step < TOTAL_STEPS && (
          <button
            onClick={() => canProceed() && setStep((currentStep) => currentStep + 1)}
            disabled={!canProceed()}
            className="flex-1 flex items-center justify-center gap-1 py-3 rounded-xl bg-[#1a3a8a] text-white font-semibold text-sm disabled:opacity-50 transition-colors"
          >
            Tiếp theo <ChevronRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 gap-4">
      <span className="text-xs text-gray-400">{label}</span>
      <span className="text-sm font-semibold text-gray-800 text-right max-w-[60%]">{value}</span>
    </div>
  );
}
