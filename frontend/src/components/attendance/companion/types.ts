export interface CompanionRecord {
  id: string;
  name: string;
  role: string;
  phone?: string;
  selfieUrl?: string;
  time?: string;
  date?: string;
  checkin_time?: string;
  checkout_time?: string | null;
  checkOutTime?: string;
  checkOutDistance?: number;
  checkOutSelfieUrl?: string;
  checkOutNotes?: string;
  workDurationMinutes?: number;
  zone_id?: string;
  distance?: number;
  distance_meters?: number;
  coordinates?: { lat: number; lng: number; accuracy: number } | null;
  notes?: string;
  status?: 'PENDING_VERIFICATION' | 'APPROVED' | 'FLAGGED_WARNING' | 'REJECTED' | string;
}

export interface CompanionCheckInModalProps {
  isOpen: boolean;
  zoneId?: string;
  onClose: () => void;
  onSuccess?: (data: CompanionRecord) => void;
}
