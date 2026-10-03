import api from './api';
import { UserRole } from '../core/types/domain.types';

export interface AdminUser {
  id: string;
  username: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  role: UserRole;
  assignedZoneId?: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'LOCKED';
  statusReason?: string | null;
  surveyorCode?: string | null;
  signatureImageUrl?: string | null;
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

export const userService = {
  listUsers: async (params?: ListUsersParams): Promise<ListUsersResponse> => {
    const res = await api.get('/admin/users', { params });
    return res.data;
  },

  getUserById: async (id: string): Promise<AdminUser> => {
    const res = await api.get(`/admin/users/${id}`);
    return res.data?.data;
  },

  createUser: async (payload: CreateUserPayload): Promise<AdminUser> => {
    const res = await api.post('/admin/users', payload);
    return res.data?.data;
  },

  updateUser: async (id: string, payload: UpdateUserPayload): Promise<AdminUser> => {
    const res = await api.put(`/admin/users/${id}`, payload);
    return res.data?.data;
  },

  updateStatus: async (
    id: string,
    status: 'ACTIVE' | 'SUSPENDED' | 'LOCKED',
    reason?: string
  ): Promise<AdminUser> => {
    const res = await api.put(`/admin/users/${id}/status`, { status, reason });
    return res.data?.data;
  },

  resetPassword: async (id: string, newPassword: string): Promise<{ message: string }> => {
    const res = await api.post(`/admin/users/${id}/reset-password`, { newPassword });
    return res.data;
  },

  deleteUser: async (id: string): Promise<{ message: string }> => {
    const res = await api.delete(`/admin/users/${id}`);
    return res.data;
  },

  cleanResetDatabase: async (): Promise<{
    success: boolean;
    message: string;
    stats: {
      totalParcels: number;
      unstartedParcels: number;
      totalReports: number;
      totalZones: number;
      totalUsers: number;
      totalStandardized: number;
    };
    adminAccount: {
      username: string;
      role: string;
      note: string;
    };
  }> => {
    const res = await api.post('/admin/maintenance/clean-reset');
    return res.data;
  },
};

export default userService;
