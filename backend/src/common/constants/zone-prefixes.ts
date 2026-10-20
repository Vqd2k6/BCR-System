export interface ZonePrefixMeta {
  zoneCode: string;
  type: 'C&C' | 'POR' | 'ELV' | 'DEP';
  seq: number;
  prefix: string;
  slugPrefix: string;
  name: string;
  zoiBufferMeters: number;
}

export const ZONE_SEGMENT_PREFIX_MAP: Record<string, ZonePrefixMeta> = {
  ZONE_01: { zoneCode: 'ZONE_01', type: 'C&C', seq: 1, prefix: 'C&C-01', slugPrefix: 'CC-01', name: 'Zone 1: Ga S1 Bến Thành (C&C)', zoiBufferMeters: 50 },
  ZONE_02: { zoneCode: 'ZONE_02', type: 'POR', seq: 1, prefix: 'POR-01', slugPrefix: 'POR-01', name: 'Zone 2: Hầm TBM Bến Thành -> Tao Đàn (POR)', zoiBufferMeters: 35 },
  ZONE_03: { zoneCode: 'ZONE_03', type: 'C&C', seq: 2, prefix: 'C&C-02', slugPrefix: 'CC-02', name: 'Zone 3: Ga S2 Tao Đàn (C&C)', zoiBufferMeters: 50 },
  ZONE_04: { zoneCode: 'ZONE_04', type: 'POR', seq: 2, prefix: 'POR-02', slugPrefix: 'POR-02', name: 'Zone 4: Hầm TBM Tao Đàn -> Dân Chủ (POR)', zoiBufferMeters: 35 },
  ZONE_05: { zoneCode: 'ZONE_05', type: 'C&C', seq: 3, prefix: 'C&C-03', slugPrefix: 'CC-03', name: 'Zone 5: Ga S3 Dân Chủ (C&C)', zoiBufferMeters: 50 },
  ZONE_06: { zoneCode: 'ZONE_06', type: 'POR', seq: 3, prefix: 'POR-03', slugPrefix: 'POR-03', name: 'Zone 6: Hầm TBM Dân Chủ -> Hòa Hưng (POR)', zoiBufferMeters: 35 },
  ZONE_07: { zoneCode: 'ZONE_07', type: 'C&C', seq: 4, prefix: 'C&C-04', slugPrefix: 'CC-04', name: 'Zone 7: Ga S4 Hòa Hưng (C&C)', zoiBufferMeters: 50 },
  ZONE_08: { zoneCode: 'ZONE_08', type: 'POR', seq: 4, prefix: 'POR-04', slugPrefix: 'POR-04', name: 'Zone 8: Hầm TBM Hòa Hưng -> Lê Thị Riêng (POR)', zoiBufferMeters: 35 },
  ZONE_09: { zoneCode: 'ZONE_09', type: 'C&C', seq: 5, prefix: 'C&C-05', slugPrefix: 'CC-05', name: 'Zone 9: Ga S5 Lê Thị Riêng (C&C)', zoiBufferMeters: 50 },
  ZONE_10: { zoneCode: 'ZONE_10', type: 'POR', seq: 5, prefix: 'POR-05', slugPrefix: 'POR-05', name: 'Zone 10: Hầm TBM Lê Thị Riêng -> Phạm Văn Hai (POR)', zoiBufferMeters: 35 },
  ZONE_11: { zoneCode: 'ZONE_11', type: 'C&C', seq: 6, prefix: 'C&C-06', slugPrefix: 'CC-06', name: 'Zone 11: Ga S6 Phạm Văn Hai (C&C)', zoiBufferMeters: 50 },
  ZONE_12: { zoneCode: 'ZONE_12', type: 'POR', seq: 6, prefix: 'POR-06', slugPrefix: 'POR-06', name: 'Zone 12: Hầm TBM Phạm Văn Hai -> Bảy Hiền (POR)', zoiBufferMeters: 35 },
  ZONE_13: { zoneCode: 'ZONE_13', type: 'C&C', seq: 7, prefix: 'C&C-07', slugPrefix: 'CC-07', name: 'Zone 13: Ga S7 Bảy Hiền (C&C)', zoiBufferMeters: 50 },
  ZONE_14: { zoneCode: 'ZONE_14', type: 'POR', seq: 7, prefix: 'POR-07', slugPrefix: 'POR-07', name: 'Zone 14: Hầm TBM Bảy Hiền -> Nguyễn Hồng Đào (POR)', zoiBufferMeters: 35 },
  ZONE_15: { zoneCode: 'ZONE_15', type: 'C&C', seq: 8, prefix: 'C&C-08', slugPrefix: 'CC-08', name: 'Zone 15: Ga S8 Nguyễn Hồng Đào (C&C)', zoiBufferMeters: 50 },
  ZONE_16: { zoneCode: 'ZONE_16', type: 'POR', seq: 8, prefix: 'POR-08', slugPrefix: 'POR-08', name: 'Zone 16: Hầm TBM Nguyễn Hồng Đào -> Bà Quẹo (POR)', zoiBufferMeters: 35 },
  ZONE_17: { zoneCode: 'ZONE_17', type: 'C&C', seq: 9, prefix: 'C&C-09', slugPrefix: 'CC-09', name: 'Zone 17: Ga S9 Bà Quẹo (C&C)', zoiBufferMeters: 50 },
  ZONE_18: { zoneCode: 'ZONE_18', type: 'POR', seq: 9, prefix: 'POR-09', slugPrefix: 'POR-09', name: 'Zone 18: Hầm TBM Bà Quẹo -> Phạm Văn Bạch (POR)', zoiBufferMeters: 35 },
  ZONE_19: { zoneCode: 'ZONE_19', type: 'C&C', seq: 10, prefix: 'C&C-10', slugPrefix: 'CC-10', name: 'Zone 19: Ga S10 Phạm Văn Bạch (C&C)', zoiBufferMeters: 50 },
  ZONE_20: { zoneCode: 'ZONE_20', type: 'POR', seq: 10, prefix: 'POR-10', slugPrefix: 'POR-10', name: 'Zone 20: Hầm TBM & Portal S10 -> S11 (POR)', zoiBufferMeters: 35 },
  ZONE_21: { zoneCode: 'ZONE_21', type: 'C&C', seq: 11, prefix: 'C&C-11', slugPrefix: 'CC-11', name: 'Zone 21: Ga S11 Tân Bình (C&C)', zoiBufferMeters: 50 },
  ZONE_22: { zoneCode: 'ZONE_22', type: 'DEP', seq: 1, prefix: 'DEP-01', slugPrefix: 'DEP-01', name: 'Zone 22: Depot Tham Lương (DEP)', zoiBufferMeters: 15 },
};
