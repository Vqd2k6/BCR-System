export interface CompanionRecord {
  id: string;
  name: string;
  role: string;
  phone?: string;
  selfieUrl?: string;
  time?: string;
  date?: string;
  checkin_time?: string;
  distance?: number;
  distance_meters?: number;
  coordinates?: { lat: number; lng: number; accuracy: number } | null;
  notes?: string;
  status?: 'APPROVED' | 'FLAGGED_WARNING' | string;
}

export interface CompanionCheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (data: any) => void;
}
