import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import type { Page } from '@/lib/types';
import {
  Tv, LayoutDashboard, Smartphone, Server, Settings,
  Trophy, Image, Gamepad2, Activity, LogOut, Menu, X,
} from 'lucide-react';
import { DashboardPage } from '@/pages/DashboardPage';
import { DevicesPage } from '@/pages/DevicesPage';
import { ServersPage } from '@/pages/ServersPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { SportsPage } from '@/pages/SportsPage';
import { AdsPage } from '@/pages/AdsPage';
import { RemotesPage } from '@/pages/RemotesPage';
import { ActivityPage } from '@/pages/ActivityPage';

const navItems: { page: Page; label: string; icon: typeof LayoutDashboard }[] = [
  { page: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { page: 'devices', label: 'Devices', icon: Smartphone },
  { page: 'servers', label: 'Servers', icon: Server },
  { page: 'sports', label: 'Sports Guide', icon: Trophy },
  { page: 'ads', label: 'Menu Ads', icon: Image },
  { page: 'remotes', label: 'Remote Control', icon: Gamepad2 },
  { page: 'activity', label: 'Activity Log', icon: Activity },
  { page: 'settings', label: 'Settings', icon: Settings },
];

export function AppLayout() {
  const { user, signOut } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <DashboardPage />;
      case 'devices': return <DevicesPage />;
      case 'servers': return <ServersPage />;
      case 'sports': return <SportsPage />;
      case 'ads': return <AdsPage />;
      case 'remotes': return <RemotesPage />;
      case 'activity': return <ActivityPage />;
      case 'settings': return <SettingsPage />;
      default: return <DashboardPage />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:sticky top-0 left-0 h-screen w-64 bg-slate-800/95 backdrop-blur-xl
        border-r border-slate-700/50 z-40 transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        flex flex-col
      `}>
        <div className="p-5 border-b border-slate-700/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Tv className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-white font-bold text-sm">Bassem TV</h1>
              <p className="text-slate-500 text-xs">Panel Admin</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = currentPage === item.page;
            return (
              <button
                key={item.page}
                onClick={() => {
                  setCurrentPage(item.page);
                  setSidebarOpen(false);
                }}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                  transition-all
                  ${active
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/30'}
                `}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-700/50">
          <div className="px-3 py-2 mb-2">
            <p className="text-slate-500 text-xs truncate">{user?.email}</p>
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-20 bg-slate-800/95 backdrop-blur-xl border-b border-slate-700/50 px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-slate-400 hover:text-white"
          >
            <Menu className="w-6 h-6" />
          </button>
          <span className="text-white font-medium text-sm">Bassem TV Panel</span>
          <div className="w-6" />
        </header>

        <main className="flex-1 p-4 lg:p-8 overflow-x-hidden">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}
