import React from 'react';
import { Button } from '../../../../core/components/ui/Button';
import { ArrowRight } from 'lucide-react';

interface Step1BottomNavProps {
  isCondoMaster?: boolean;
  currentCase: string;
  onNextStep: () => void;
}

export const Step1BottomNav: React.FC<Step1BottomNavProps> = ({
  isCondoMaster,
  currentCase,
  onNextStep,
}) => {
  if (isCondoMaster) {
    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200">
        <div className="text-xs text-slate-500 font-medium">
          Bước 1 / 8: Xác nhận định danh khối tháp Chung cư & Ngoại quan
        </div>
        <Button
          size="lg"
          onClick={onNextStep}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
          icon={<ArrowRight className="w-4 h-4" />}
        >
          Tiếp tục: Bước 2 (Phỏng vấn BQL Tòa nhà & Nền móng) ➔
        </Button>
      </div>
    );
  }

  if (currentCase === 'NORMAL') {
    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200">
        <div className="text-xs text-slate-500 font-medium">
          Bước 1 / 8: Định danh công trình & Ngoại quan
        </div>
        <Button size="lg" onClick={onNextStep} icon={<ArrowRight className="w-4 h-4" />}>
          Tiếp tục: Bước 2 (Phỏng vấn chủ hộ) ➔
        </Button>
      </div>
    );
  }

  return null;
};
