import { AuthProvider, useAuth } from '@/lib/auth';
import { LoginPage } from '@/pages/LoginPage';
import { AppLayout } from '@/pages/AppLayout';
import { Loader2 } from 'lucide-react';

function AppContent() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return session ? <AppLayout /> : <LoginPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
