import React from 'react';
import { Button } from '../../../../core/components/ui/Button';

interface Step3BottomNavProps {
  onPrev: () => void;
  onNext: () => void;
}

export const Step3BottomNav: React.FC<Step3BottomNavProps> = ({ onPrev, onNext }) => {
  return (
    <div className="flex justify-between pt-4">
      <Button variant="outline" onClick={onPrev}>
        ⬅️ Quay lại Bước 2
      </Button>
      <Button onClick={onNext}>
        Tiếp tục: Bước 4 (Chốt Burland & Cờ KC) ➔
      </Button>
    </div>
  );
};
