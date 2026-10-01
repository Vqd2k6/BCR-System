import React, { useState, useEffect, useId } from 'react';
import { ShieldAlert, RotateCw, CheckCircle2, AlertTriangle, KeyRound } from 'lucide-react';

interface Props {
  onValidityChange: (isValid: boolean, enteredCode: string) => void;
  actionDescription?: string;
  className?: string;
}

export const AdminSecurityChallengeConfirm: React.FC<Props> = ({
  onValidityChange,
  actionDescription = 'thao tác tác động dữ liệu thửa đất',
  className = '',
}) => {
  const inputId = useId();

  // Sinh ngẫu nhiên 6 chữ số (100000 -> 999999)
  const generateRandomCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const [challengeCode, setChallengeCode] = useState<string>(generateRandomCode);
  const [enteredCode, setEnteredCode] = useState<string>('');

  // Làm mới mã ngẫu nhiên
  const handleRefresh = () => {
    const newCode = generateRandomCode();
    setChallengeCode(newCode);
    setEnteredCode('');
    onValidityChange(false, '');
  };

  // Xử lý khi admin nhập liệu
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Chỉ cho phép nhập số, tối đa 6 ký tự
    const cleanVal = e.target.value.replace(/\D/g, '').slice(0, 6);
    setEnteredCode(cleanVal);

    const isValid = cleanVal.length === 6 && cleanVal === challengeCode;
    onValidityChange(isValid, cleanVal);
  };

  // Reset khi unmount hoặc đổi action
  useEffect(() => {
    onValidityChange(false, '');
  }, []);

  const isMatched = enteredCode.length === 6 && enteredCode === challengeCode;
  const isMismatch = enteredCode.length > 0 && !isMatched;

  return (
    <div className={`p-4 rounded-xl border border-amber-200 bg-amber-50/70 space-y-3 ${className}`}>
      {/* Header cảnh báo an toàn */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-lg bg-amber-500 text-white">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <span className="text-xs font-black uppercase text-amber-950 tracking-wider">
            Xác Thực Bảo Mật 6 Số (Bắt Buộc)
          </span>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          className="text-[11px] font-bold text-amber-800 hover:text-amber-950 flex items-center gap-1 p-1 rounded hover:bg-amber-200/60 transition-colors cursor-pointer"
          title="Đổi mã ngẫu nhiên khác"
        >
          <RotateCw className="w-3 h-3" />
          <span>Đổi mã</span>
        </button>
      </div>

      <p className="text-[11px] text-amber-900 leading-relaxed">
        Để ngăn chặn việc ấn nhầm khi <span className="font-bold underline">{actionDescription}</span>, vui lòng nhập chính xác 6 chữ số ngẫu nhiên bên dưới để mở khóa:
      </p>

      {/* Khối hiển thị mã 6 số ngẫu nhiên */}
      <div className="flex items-center justify-center gap-2 py-2 px-3 bg-white rounded-xl border border-amber-300 shadow-inner select-none">
        {challengeCode.split('').map((digit, idx) => (
          <span
            key={idx}
            className="w-8 h-10 flex items-center justify-center font-mono font-black text-xl text-slate-800 bg-amber-100/60 rounded-lg border border-amber-200 shadow-xs"
          >
            {digit}
          </span>
        ))}
      </div>

      {/* Ô nhập xác nhận 6 số */}
      <div className="space-y-1">
        <div className="relative">
          <input
            id={inputId}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="Nhập lại chính xác 6 số trên..."
            value={enteredCode}
            onChange={handleInputChange}
            className={`w-full py-2.5 px-3 font-mono font-black text-center text-sm tracking-widest bg-white border rounded-xl transition-all focus:outline-hidden focus:ring-2 ${
              isMatched
                ? 'border-emerald-500 text-emerald-800 bg-emerald-50/50 focus:ring-emerald-500'
                : isMismatch
                ? 'border-red-400 text-red-800 bg-red-50/30 focus:ring-red-500'
                : 'border-slate-300 text-slate-800 focus:ring-amber-500'
            }`}
          />
          <div className="absolute right-3 top-3">
            {isMatched ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 animate-in zoom-in" />
            ) : isMismatch ? (
              <AlertTriangle className="w-4 h-4 text-red-500 animate-in zoom-in" />
            ) : (
              <KeyRound className="w-4 h-4 text-slate-400" />
            )}
          </div>
        </div>

        {/* Trạng thái xác thực */}
        <div className="min-h-[18px]">
          {isMatched ? (
            <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Đã khớp mã xác thực! Nút xác nhận đã được mở khóa.
            </span>
          ) : isMismatch ? (
            <span className="text-[11px] font-bold text-red-600 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              Mã chưa khớp. Vui lòng nhập đúng 6 số được hiển thị bên trên ({enteredCode.length}/6 số).
            </span>
          ) : (
            <span className="text-[10px] text-slate-500">
              Chưa nhập mã xác nhận (Nút thực thi vẫn đang khóa).
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
