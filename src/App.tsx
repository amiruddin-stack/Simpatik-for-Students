import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { StudentPortalPage } from './pages/StudentPortalPage';

function StudentAppContent() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F7FBF8]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-emerald-100 border-t-emerald-700" />
          <p className="text-sm font-medium text-slate-500">SIMPATIK for Students sedang dipersiapkan…</p>
        </div>
      </main>
    );
  }

  return <StudentPortalPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <StudentAppContent />
      </DataProvider>
    </AuthProvider>
  );
}
