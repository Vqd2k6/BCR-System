import React, { useState } from 'react';
import type { GisParcel } from '../../../../components/gis/LeafletSweepMap';
import {
  Clock,
  PlayCircle,
  Eye,
  CheckCircle2,
  Calendar,
  User,
} from 'lucide-react';
import {
  filterParcelsByWorkProgress,
  type WorkProgressItem,
} from '../utils/surveyorWorkProgressHelpers';

import type { User as DomainUser } from '../../../../core/types/domain.types';

interface SurveyorWorkProgressCardsProps {
  parcels: GisParcel[];
  onStartPhase1: (parcel: GisParcel, readOnly?: boolean) => void;
  currentUser?: DomainUser | null;
}

export const SurveyorWorkProgressCards: React.FC<SurveyorWorkProgressCardsProps> = ({
  parcels,
  onStartPhase1,
  currentUser,
}) => {
  const {
    inProgressToday,
    inProgressThisWeek,
    completedToday,
    completedThisWeek,
  } = filterParcelsByWorkProgress(parcels, currentUser);

  const [completedTab, setCompletedTab] = useState<'TODAY' | 'WEEK'>('TODAY');

  const activeCompletedList = completedTab === 'TODAY' ? completedToday : completedThisWeek;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      {/* ─── MỤC 1: ĐANG LÀM DỞ HÔM NAY ────────────────────────────────────── */}
      <div
        className="card"
        style={{
          background: '#ffffff',
          border: '1px solid #fed7aa',
          borderLeft: '4px solid #f97316',
          borderRadius: '12px',
          padding: '0.9rem 1rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.65rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '999px',
                backgroundColor: '#f97316',
                display: 'inline-block',
              }}
            />
            <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: '#9a3412' }}>
              Đang làm dở hôm nay
            </h3>
          </div>
          <span
            style={{
              fontSize: '0.725rem',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '999px',
              backgroundColor: inProgressToday.length > 0 ? '#ffedd5' : '#f1f5f9',
              color: inProgressToday.length > 0 ? '#c2410c' : '#64748b',
              border: `1px solid ${inProgressToday.length > 0 ? '#fed7aa' : '#e2e8f0'}`,
            }}
          >
            {inProgressToday.length} lô
          </span>
        </div>

        {inProgressToday.length === 0 ? (
          <div
            style={{
              padding: '0.75rem',
              backgroundColor: '#fffaf5',
              borderRadius: '8px',
              border: '1px dashed #fdba74',
              textAlign: 'center',
              fontSize: '0.75rem',
              color: '#9a3412',
            }}
          >
            ✓ Chưa có lô nào đang làm dở hôm nay
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.6rem' }}>
            {inProgressToday.map((item) => (
              <div
                key={item.parcel.id}
                style={{
                  backgroundColor: '#fffaf5',
                  border: '1px solid #ffedd5',
                  borderRadius: '8px',
                  padding: '0.65rem 0.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '0.45rem',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 800, color: '#c2410c', fontFamily: 'monospace' }}>
                      {item.parcel.projectParcelCode || item.parcel.project_parcel_code || 'Lô chưa có mã'}
                    </span>
                    <span
                      style={{
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        color: '#b45309',
                        backgroundColor: '#fef3c7',
                        padding: '1px 5px',
                        borderRadius: '4px',
                        border: '1px solid #fde68a',
                      }}
                    >
                      Đang dở
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e293b', marginTop: '2px' }}>
                    Số {item.parcel.houseNumber || item.parcel.house_number || '---'} {item.parcel.street}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                    Chủ hộ: <strong>{item.parcel.ownerName || item.parcel.owner_name || 'Chưa cập nhật'}</strong>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px' }}>
                    <User size={11} color={item.isCurrentUser ? '#0284c7' : '#d97706'} />
                    <span>Phụ trách: </span>
                    <strong style={{ color: item.isCurrentUser ? '#0284c7' : '#1e293b' }}>
                      {item.isCurrentUser ? `Bạn (${item.surveyorName})` : item.surveyorName}
                    </strong>
                    {item.surveyorCode && (
                      <span
                        style={{
                          fontSize: '0.625rem',
                          color: item.isCurrentUser ? '#0369a1' : '#b45309',
                          backgroundColor: item.isCurrentUser ? '#e0f2fe' : '#fef3c7',
                          border: `1px solid ${item.isCurrentUser ? '#bae6fd' : '#fde68a'}`,
                          padding: '0px 4px',
                          borderRadius: '3px',
                          fontWeight: 700,
                          fontFamily: 'monospace',
                        }}
                      >
                        {item.surveyorCode}
                      </span>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '0.4rem',
                    borderTop: '1px dashed #fed7aa',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.675rem',
                      color: '#9a3412',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px',
                      fontWeight: 600,
                    }}
                  >
                    <Clock size={11} color="#f97316" />
                    {item.formattedTime}
                  </span>

                  <button
                    type="button"
                    onClick={() => onStartPhase1(item.parcel)}
                    style={{
                      backgroundColor: '#ea580c',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '3px 8px',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <PlayCircle size={12} />
                    Tiếp tục
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── MỤC 2: ĐANG LÀM DỞ TUẦN NÀY ───────────────────────────────────── */}
      <div
        className="card"
        style={{
          background: '#ffffff',
          border: '1px solid #fed7aa',
          borderLeft: '4px solid #f59e0b',
          borderRadius: '12px',
          padding: '0.9rem 1rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.65rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <Calendar size={15} color="#d97706" />
            <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: '#92400e' }}>
              Đang làm dở tuần này
            </h3>
          </div>
          <span
            style={{
              fontSize: '0.725rem',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '999px',
              backgroundColor: inProgressThisWeek.length > 0 ? '#fef3c7' : '#f1f5f9',
              color: inProgressThisWeek.length > 0 ? '#b45309' : '#64748b',
              border: `1px solid ${inProgressThisWeek.length > 0 ? '#fde68a' : '#e2e8f0'}`,
            }}
          >
            {inProgressThisWeek.length} lô
          </span>
        </div>

        {inProgressThisWeek.length === 0 ? (
          <div
            style={{
              padding: '0.75rem',
              backgroundColor: '#fffbeb',
              borderRadius: '8px',
              border: '1px dashed #fde68a',
              textAlign: 'center',
              fontSize: '0.75rem',
              color: '#92400e',
            }}
          >
            ✓ Không có lô nào đang làm dở từ các ngày trước trong tuần
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.6rem' }}>
            {inProgressThisWeek.map((item) => (
              <div
                key={item.parcel.id}
                style={{
                  backgroundColor: '#fffbeb',
                  border: '1px solid #fef3c7',
                  borderRadius: '8px',
                  padding: '0.65rem 0.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '0.45rem',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 800, color: '#b45309', fontFamily: 'monospace' }}>
                      {item.parcel.projectParcelCode || item.parcel.project_parcel_code || 'Lô chưa có mã'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e293b', marginTop: '2px' }}>
                    Số {item.parcel.houseNumber || item.parcel.house_number || '---'} {item.parcel.street}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                    Chủ hộ: <strong>{item.parcel.ownerName || item.parcel.owner_name || 'Chưa cập nhật'}</strong>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px' }}>
                    <User size={11} color={item.isCurrentUser ? '#0284c7' : '#d97706'} />
                    <span>Phụ trách: </span>
                    <strong style={{ color: item.isCurrentUser ? '#0284c7' : '#1e293b' }}>
                      {item.isCurrentUser ? `Bạn (${item.surveyorName})` : item.surveyorName}
                    </strong>
                    {item.surveyorCode && (
                      <span
                        style={{
                          fontSize: '0.625rem',
                          color: item.isCurrentUser ? '#0369a1' : '#b45309',
                          backgroundColor: item.isCurrentUser ? '#e0f2fe' : '#fef3c7',
                          border: `1px solid ${item.isCurrentUser ? '#bae6fd' : '#fde68a'}`,
                          padding: '0px 4px',
                          borderRadius: '3px',
                          fontWeight: 700,
                          fontFamily: 'monospace',
                        }}
                      >
                        {item.surveyorCode}
                      </span>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '0.4rem',
                    borderTop: '1px dashed #fde68a',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.675rem',
                      color: '#92400e',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px',
                      fontWeight: 600,
                    }}
                  >
                    <Clock size={11} color="#d97706" />
                    {item.formattedTime}
                  </span>

                  <button
                    type="button"
                    onClick={() => onStartPhase1(item.parcel)}
                    style={{
                      backgroundColor: '#d97706',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '3px 8px',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <PlayCircle size={12} />
                    Tiếp tục
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── MỤC 3: ĐÃ XONG HÔM NAY / ĐÃ XONG TRONG TUẦN ──────────────────── */}
      <div
        className="card"
        style={{
          background: '#ffffff',
          border: '1px solid #bbf7d0',
          borderLeft: '4px solid #10b981',
          borderRadius: '12px',
          padding: '0.9rem 1rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.65rem',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <CheckCircle2 size={16} color="#10b981" />
            <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: '#065f46' }}>
              Đã xong hôm nay / Đã xong trong tuần
            </h3>
          </div>

          {/* Pill Tabs chuyển đổi giữa Hôm nay & Tuần này */}
          <div
            style={{
              display: 'flex',
              backgroundColor: '#f1f5f9',
              padding: '2px',
              borderRadius: '8px',
              gap: '2px',
            }}
          >
            <button
              type="button"
              onClick={() => setCompletedTab('TODAY')}
              style={{
                border: 'none',
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '0.7rem',
                fontWeight: completedTab === 'TODAY' ? 800 : 600,
                backgroundColor: completedTab === 'TODAY' ? '#ffffff' : 'transparent',
                color: completedTab === 'TODAY' ? '#047857' : '#64748b',
                boxShadow: completedTab === 'TODAY' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                cursor: 'pointer',
              }}
            >
              Hôm nay ({completedToday.length})
            </button>

            <button
              type="button"
              onClick={() => setCompletedTab('WEEK')}
              style={{
                border: 'none',
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '0.7rem',
                fontWeight: completedTab === 'WEEK' ? 800 : 600,
                backgroundColor: completedTab === 'WEEK' ? '#ffffff' : 'transparent',
                color: completedTab === 'WEEK' ? '#047857' : '#64748b',
                boxShadow: completedTab === 'WEEK' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                cursor: 'pointer',
              }}
            >
              Trong tuần ({completedThisWeek.length})
            </button>
          </div>
        </div>

        {activeCompletedList.length === 0 ? (
          <div
            style={{
              padding: '0.75rem',
              backgroundColor: '#f0fdf4',
              borderRadius: '8px',
              border: '1px dashed #bbf7d0',
              textAlign: 'center',
              fontSize: '0.75rem',
              color: '#065f46',
            }}
          >
            {completedTab === 'TODAY'
              ? 'Chưa có hồ sơ nào nộp hoặc hoàn tất hôm nay'
              : 'Chưa có hồ sơ nào hoàn tất trong tuần này'}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.6rem' }}>
            {activeCompletedList.map((item) => {
              const isApproved = item.status === 'APPROVED' || item.status === 'PHASE2_COMPLETED' || item.status === 'APPROVED_PHASE2';
              return (
                <div
                  key={item.parcel.id}
                  style={{
                    backgroundColor: '#f0fdf4',
                    border: '1px solid #dcfce7',
                    borderRadius: '8px',
                    padding: '0.65rem 0.75rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '0.45rem',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 800, color: '#047857', fontFamily: 'monospace' }}>
                        {item.parcel.projectParcelCode || item.parcel.project_parcel_code || 'Lô chưa có mã'}
                      </span>
                      <span
                        style={{
                          fontSize: '0.65rem',
                          fontWeight: 800,
                          color: isApproved ? '#047857' : '#0369a1',
                          backgroundColor: isApproved ? '#d1fae5' : '#e0f2fe',
                          border: `1px solid ${isApproved ? '#a7f3d0' : '#bae6fd'}`,
                          padding: '1px 5px',
                          borderRadius: '4px',
                        }}
                      >
                        {isApproved ? 'Đã duyệt [✓]' : 'Đã nộp [✓]'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e293b', marginTop: '2px' }}>
                      Số {item.parcel.houseNumber || item.parcel.house_number || '---'} {item.parcel.street}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                      Chủ hộ: <strong>{item.parcel.ownerName || item.parcel.owner_name || 'Chưa cập nhật'}</strong>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px' }}>
                      <User size={11} color="#059669" />
                      <span>Phụ trách: </span>
                      <strong style={{ color: item.isCurrentUser ? '#047857' : '#1e293b' }}>
                        {item.isCurrentUser ? `Bạn (${item.surveyorName})` : item.surveyorName}
                      </strong>
                      {item.surveyorCode && (
                        <span
                          style={{
                            fontSize: '0.625rem',
                            color: '#047857',
                            backgroundColor: '#d1fae5',
                            border: '1px solid #a7f3d0',
                            padding: '0px 4px',
                            borderRadius: '3px',
                            fontWeight: 700,
                            fontFamily: 'monospace',
                          }}
                        >
                          {item.surveyorCode}
                        </span>
                      )}
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingTop: '0.4rem',
                      borderTop: '1px dashed #bbf7d0',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.675rem',
                        color: '#065f46',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        fontWeight: 600,
                      }}
                    >
                      <Clock size={11} color="#10b981" />
                      {item.formattedTime}
                    </span>

                    <button
                      type="button"
                      onClick={() => onStartPhase1(item.parcel, true)}
                      style={{
                        backgroundColor: '#ecfdf5',
                        color: '#047857',
                        border: '1px solid #a7f3d0',
                        borderRadius: '6px',
                        padding: '3px 8px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Eye size={12} color="#047857" />
                      Xem lại
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
