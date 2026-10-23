/**
 * ============================================================================
 * REPORT SNAPSHOT SERVICE (FACADE)
 * Điều phối đóng băng dữ liệu bất biến tại thời điểm APPROVE (`APPROVED_RELEASE`),
 * truy xuất theo từng Revision (`?rev=N`), và áp ngược snapshot khi xuất báo cáo.
 * ============================================================================
 */

import type { PoolClient } from 'pg';
import { Database } from '../../../database/db';
import {
  ReportSnapshotSchema,
  type ReportSnapshot,
  type ReportSnapshotScores,
} from '../schemas/report-snapshot.schema';
import {
  resolveFrozenScores,
  computeDeepLegalHash,
  computeContentHash,
  buildApprovedSnapshot,
  stableStringify,
  sha256Hex,
  type RiskCardRow,
} from './snapshot-builder';
import { applySnapshotToReportData } from './snapshot-applier';
import { writeApprovedReleaseRecord, runAutoBackfillApprovedSnapshots } from './snapshot-backfill';

export { stableStringify, sha256Hex };

export class ReportSnapshotService {
  public static resolveScores(
    surveyJsonRaw: unknown,
    card: RiskCardRow | null,
    burlandMaxGrade: number | null
  ): ReportSnapshotScores {
    return resolveFrozenScores(surveyJsonRaw, card, burlandMaxGrade);
  }

  public static computeDeepLegalHash(
    scores: ReportSnapshotScores,
    surveyJson?: any,
    frozenParcel?: any
  ): string {
    return computeDeepLegalHash(scores, surveyJson, frozenParcel);
  }

  public static computeContentHash(scores: ReportSnapshotScores, surveyJson?: any, frozenParcel?: any): string {
    return computeContentHash(scores, surveyJson, frozenParcel);
  }

  public static async buildSnapshot(
    client: PoolClient,
    reportId: string,
    approvedByUserId: string,
    approvedAt: Date,
    exportRevision?: number
  ): Promise<ReportSnapshot> {
    return buildApprovedSnapshot(client, reportId, approvedByUserId, approvedAt, exportRevision);
  }

  public static async writeApprovedRelease(
    client: PoolClient,
    reportId: string,
    adminId: string,
    approvedAt: Date,
    title: string,
    exportRevision?: number
  ): Promise<{ versionId: string; versionNumber: number; snapshot: ReportSnapshot }> {
    return writeApprovedReleaseRecord(client, reportId, adminId, approvedAt, title, exportRevision);
  }

  public static async getLatestApprovedSnapshot(
    reportId: string
  ): Promise<{ versionId: string; snapshot: ReportSnapshot } | null> {
    const res = await Database.query<{ id: string; snapshot_data: unknown }>(
      `SELECT id, snapshot_data FROM survey_report_versions
       WHERE report_id = $1 AND version_tag = 'APPROVED_RELEASE'
       ORDER BY version_number DESC LIMIT 1;`,
      [reportId]
    );
    const row = res.rows[0];
    if (!row) return null;
    const parsed = ReportSnapshotSchema.safeParse(row.snapshot_data);
    if (!parsed.success) {
      console.error('[ReportSnapshotService] Snapshot APPROVED_RELEASE không hợp lệ:', reportId, parsed.error.flatten());
      return null;
    }
    return { versionId: row.id, snapshot: parsed.data };
  }

  public static async getSnapshotForRevision(
    reportId: string,
    revision?: number
  ): Promise<{ versionId: string; snapshot: ReportSnapshot } | null> {
    if (revision === undefined || revision === null || !Number.isFinite(Number(revision))) {
      return this.getLatestApprovedSnapshot(reportId);
    }

    const revNum = Math.max(0, Math.floor(Number(revision)));
    const relRes = await Database.query<{
      snapshot_version_id: string | null;
      revision: number;
      snapshot_data: unknown;
    }>(
      `SELECT rr.snapshot_version_id, rr.revision, v.snapshot_data
       FROM report_releases rr
       LEFT JOIN survey_report_versions v ON v.id = rr.snapshot_version_id
       WHERE rr.report_id = $1 AND rr.revision = $2 AND rr.deleted_at IS NULL
       LIMIT 1;`,
      [reportId, revNum]
    );

    const relRow = relRes.rows[0];
    if (relRow?.snapshot_data) {
      const parsed = ReportSnapshotSchema.safeParse(relRow.snapshot_data);
      if (parsed.success) {
        return {
          versionId: relRow.snapshot_version_id || '',
          snapshot: { ...parsed.data, exportRevision: relRow.revision ?? revNum },
        };
      }
    }

    const verRes = await Database.query<{ id: string; snapshot_data: unknown }>(
      `SELECT id, snapshot_data
       FROM survey_report_versions
       WHERE report_id = $1
         AND version_tag = 'APPROVED_RELEASE'
         AND COALESCE((snapshot_data->>'exportRevision')::int, 0) = $2
       ORDER BY version_number DESC
       LIMIT 1;`,
      [reportId, revNum]
    );
    if (verRes.rows[0]?.snapshot_data) {
      const parsed = ReportSnapshotSchema.safeParse(verRes.rows[0].snapshot_data);
      if (parsed.success) {
        return {
          versionId: verRes.rows[0].id,
          snapshot: { ...parsed.data, exportRevision: revNum },
        };
      }
    }

    const latest = await this.getLatestApprovedSnapshot(reportId);
    if (!latest) return null;
    return {
      versionId: latest.versionId,
      snapshot: { ...latest.snapshot, exportRevision: revNum },
    };
  }

  public static applySnapshotToReport<T extends Record<string, unknown>>(
    rawReport: T,
    snapshot: ReportSnapshot
  ): T {
    return applySnapshotToReportData(rawReport, snapshot);
  }

  public static async autoBackfillApprovedSnapshots(): Promise<void> {
    return runAutoBackfillApprovedSnapshots();
  }
}

