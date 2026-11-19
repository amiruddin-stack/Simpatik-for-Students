import React from 'react';
import { AuthProvider } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { StudentPortalPage } from './pages/StudentPortalPage';

export default function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <StudentPortalPage />
      </DataProvider>
    </AuthProvider>
  );
}
