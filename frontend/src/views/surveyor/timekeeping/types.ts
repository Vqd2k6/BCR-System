import type { CompanionRecord } from '@/components/attendance/companion/types';

export type { CompanionRecord };

export interface AttendanceRecord {
  id?: string;
  zone_id?: string;
  checkin_time: string | Date;
  checkout_time?: string | Date | null;
  distance_to_zone_center_meters?: number;
  distance_meters?: number;
  checkout_distance_to_zone_center_meters?: number | null;
  is_out_of_bounds?: boolean;
  is_within_zone_boundary?: boolean;
  selfie_photo_url?: string | null;
  photo_selfie_url?: string | null;
  selfiePhotoUrl?: string | null;
  checkout_selfie_photo_url?: string | null;
  checkout_notes?: string | null;
  work_duration_minutes?: number | null;
  verification_status?: string;
  is_companion?: boolean;
  companion_name?: string | null;
  companion_role?: string | null;
  companion_phone?: string | null;
  notes?: string | null;
  gps_latitude?: number | string;
  gps_longitude?: number | string;
  checkout_gps_latitude?: number | string | null;
  checkout_gps_longitude?: number | string | null;
}

export interface CheckInDetails {
  checkInId?: string;
  time?: string;
  checkInIso?: string;
  checkOutTime?: string;
  checkOutIso?: string;
  checkOutDistance?: number;
  checkOutSelfiePhotoUrl?: string;
  checkOutNotes?: string | null;
  workDurationMinutes?: number;
  distance?: number;
  status?: string;
  selfiePhotoUrl?: string;
  notes?: string | null;
  coordinates?: { lat: number; lng: number; accuracy: number };
  checkOutCoordinates?: { lat: number; lng: number; accuracy: number };
  zoneName?: string;
}
