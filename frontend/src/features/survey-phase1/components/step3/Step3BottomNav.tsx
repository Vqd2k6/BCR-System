import React from 'react';
import { Button } from '../../../../core/components/ui/Button';

interface Step3BottomNavProps {
  onPrev: () => void;
  onNext: () => void;
}

export const Step3BottomNav: React.FC<Step3BottomNavProps> = ({ onPrev, onNext }) => {
  return (
    <div className="flex flex-col-reverse sm:flex-row gap-2.5 justify-between pt-4 w-full">
      <Button variant="outline" onClick={onPrev} className="w-full sm:w-auto">
        ⬅️ Quay lại Bước 2
      </Button>
      <Button onClick={onNext} className="w-full sm:w-auto">
        Tiếp tục: Bước 4 (Chốt Burland & Cờ KC) ➔
      </Button>
    </div>
  );
};
