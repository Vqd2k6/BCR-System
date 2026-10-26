import type { CompanionRecord } from '@/components/attendance/companion/types';

export type { CompanionRecord };

export interface AttendanceRecord {
  id?: string;
  zone_id?: string;
  checkin_time: string | Date;
  distance_to_zone_center_meters?: number;
  distance_meters?: number;
  is_out_of_bounds?: boolean;
  is_within_zone_boundary?: boolean;
  selfie_photo_url?: string | null;
  photo_selfie_url?: string | null;
  selfiePhotoUrl?: string | null;
  verification_status?: string;
  is_companion?: boolean;
  companion_name?: string | null;
  companion_role?: string | null;
  companion_phone?: string | null;
  notes?: string | null;
  gps_latitude?: number | string;
  gps_longitude?: number | string;
}

export interface CheckInDetails {
  time?: string;
  distance?: number;
  status?: string;
  selfiePhotoUrl?: string;
  notes?: string | null;
  coordinates?: { lat: number; lng: number; accuracy: number };
  zoneName?: string;
}
