import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { LoginView } from '../../views/auth/LoginView';
import { SurveyorHomeView } from '../../views/surveyor/SurveyorHomeView';
import { TimekeepingCheckInView } from '../../views/surveyor/TimekeepingCheckInView';
import { SurveyPhase1Page } from '../../features/survey-phase1/views/SurveyPhase1Page';
import { SurveyPhase2View } from '../../views/surveyor/SurveyPhase2View';
import { ZoneManagerDashboardPage } from '../../features/zone-management/views/ZoneManagerDashboardPage';
import { AdminDashboardPage } from '../../features/admin-portal/views/AdminDashboardPage';
import { PublicCitizenPortalPage } from '../../features/guest-portal/views/PublicCitizenPortalPage';
import { useAuth } from '../../context/AuthContext';

export const AppRoutes: React.FC = () => {
  const { isAuthenticated, user } = useAuth();

  return (
    <Routes>
      {/* Public Citizen Portal */}
      <Route path="/portal/lookup" element={<PublicCitizenPortalPage />} />

      {/* Auth */}
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <LoginView />}
      />

      {/* Zone Manager Portal */}
      <Route
        path="/zone-manager"
        element={
          isAuthenticated ? <ZoneManagerDashboardPage /> : <Navigate to="/login" replace />
        }
      />

      {/* Super Admin Portal */}
      <Route
        path="/admin"
        element={
          isAuthenticated ? <AdminDashboardPage /> : <Navigate to="/login" replace />
        }
      />

      {/* Default fallback route */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
