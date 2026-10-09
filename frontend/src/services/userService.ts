import api from './api';
import type { UserRole } from '../core/types/domain.types';

export interface AdminUser {
  id: string;
  username: string;
  fullName: string;
  full_name?: string;
  email?: string | null;
  phone?: string | null;
  role: UserRole;
  assignedZoneId?: string | null;
  assigned_zone_id?: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'LOCKED';
  statusReason?: string | null;
  surveyorCode?: string | null;
  surveyor_code?: string | null;
  signatureImageUrl?: string | null;
  signature_image_url?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ListUsersParams {
  role?: string;
  zoneId?: string;
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ListUsersResponse {
  success: boolean;
  data: AdminUser[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

export interface CreateUserPayload {
  username: string;
  password: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  role: UserRole;
  assignedZoneId?: string | null;
  signatureImageUrl?: string | null;
}

export interface UpdateUserPayload {
  fullName?: string;
  email?: string | null;
  phone?: string | null;
  role?: UserRole;
  assignedZoneId?: string | null;
  signatureImageUrl?: string | null;
}

export interface RawAdminUser {
  id: string;
  username: string;
  fullName?: string;
  full_name?: string;
  email?: string | null;
  phone?: string | null;
  role: UserRole;
  assignedZoneId?: string | null;
  assigned_zone_id?: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'LOCKED';
  statusReason?: string | null;
  status_reason?: string | null;
  surveyorCode?: string | null;
  surveyor_code?: string | null;
  signatureImageUrl?: string | null;
  signature_image_url?: string | null;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
}

function normalizeAdminUser(u: RawAdminUser): AdminUser {
  return {
    id: u.id,
    username: u.username,
    fullName: u.fullName || u.full_name || '',
    email: u.email || null,
    phone: u.phone || null,
    role: u.role,
    assignedZoneId: u.assignedZoneId || u.assigned_zone_id || null,
    status: u.status,
    statusReason: u.statusReason || u.status_reason || null,
    surveyorCode: u.surveyorCode || u.surveyor_code || null,
    signatureImageUrl: u.signatureImageUrl || u.signature_image_url || null,
    createdAt: u.createdAt || u.created_at,
    updatedAt: u.updatedAt || u.updated_at,
  };
}

export const userService = {
  listUsers: async (params?: ListUsersParams): Promise<ListUsersResponse> => {
    const res = await api.get('/admin/users', { params });
    const rawData = res.data?.data || [];
    return {
      success: res.data?.success ?? true,
      data: rawData.map(normalizeAdminUser),
      pagination: res.data?.pagination || {
        total: rawData.length,
        limit: params?.limit || 20,
        offset: params?.offset || 0,
      },
    };
  },

  getUserById: async (id: string): Promise<AdminUser> => {
    const res = await api.get(`/admin/users/${id}`);
    return normalizeAdminUser(res.data?.data);
  },

  createUser: async (payload: CreateUserPayload): Promise<AdminUser> => {
    const res = await api.post('/admin/users', payload);
    return normalizeAdminUser(res.data?.data);
  },

  updateUser: async (id: string, payload: UpdateUserPayload): Promise<AdminUser> => {
    const res = await api.put(`/admin/users/${id}`, payload);
    return normalizeAdminUser(res.data?.data);
  },

  updateStatus: async (
    id: string,
    status: 'ACTIVE' | 'SUSPENDED' | 'LOCKED',
    reason?: string
  ): Promise<AdminUser> => {
    const res = await api.put(`/admin/users/${id}/status`, { status, reason });
    return normalizeAdminUser(res.data?.data);
  },

  resetPassword: async (id: string, newPassword: string): Promise<{ message: string }> => {
    const res = await api.post(`/admin/users/${id}/reset-password`, { newPassword });
    return res.data;
  },

  deleteUser: async (id: string): Promise<{ message: string }> => {
    const res = await api.delete(`/admin/users/${id}`);
    return res.data;
  },
};

export default userService;

