import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { MacDevice, ActivityLog } from '@/lib/types';
import {
  Smartphone, Activity as ActivityIcon, Server, Trophy,
  TrendingUp, Clock, Wifi, WifiOff, Users, AlertCircle,
} from 'lucide-react';

export function DashboardPage() {
  const [stats, setStats] = useState({
    totalDevices: 0,
    activeDevices: 0,
    blockedDevices: 0,
    totalServers: 0,
    activeServers: 0,
    totalActivity: 0,
    todayActivity: 0,
    sportsLeagues: 0,
  });
  const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlineMacs, setOnlineMacs] = useState<MacDevice[]>([]);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);

    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [devicesRes, serversRes, leaguesRes, activityRes, todayActivityRes, onlineRes] = await Promise.all([
      supabase.from('mac_devices').select('*', { count: 'exact', head: false }),
      supabase.from('servers').select('*', { count: 'exact', head: false }),
      supabase.from('sports_leagues').select('*', { count: 'exact', head: true }),
      supabase.from('activity').select('*', { count: 'exact', head: true }),
      supabase.from('activity').select('*', { count: 'exact', head: true }).gte('created_at', todayStart.toISOString()),
      supabase.from('mac_devices').select('*').gte('last_seen_at', fiveMinAgo).eq('is_authorized', true).eq('is_blocked', false),
    ]);

    const devices = devicesRes.data || [];
    const servers = serversRes.data || [];

    setStats({
      totalDevices: devicesRes.count || 0,
      activeDevices: devices.filter((d: MacDevice) => d.is_authorized && !d.is_blocked).length,
      blockedDevices: devices.filter((d: MacDevice) => d.is_blocked).length,
      totalServers: serversRes.count || 0,
      activeServers: servers.filter((s: any) => s.is_active).length,
      totalActivity: activityRes.count || 0,
      todayActivity: todayActivityRes.count || 0,
      sportsLeagues: leaguesRes.count || 0,
    });

    setOnlineMacs(onlineRes.data || []);

    const { data: recent } = await supabase
      .from('activity')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    setRecentActivity(recent || []);

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const statCards = [
    { label: 'Total Devices', value: stats.totalDevices, icon: Smartphone, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
    { label: 'Active Devices', value: stats.activeDevices, icon: Wifi, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    { label: 'Blocked Devices', value: stats.blockedDevices, icon: WifiOff, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
    { label: 'Servers', value: `${stats.activeServers}/${stats.totalServers}`, icon: Server, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
    { label: 'Today Activity', value: stats.todayActivity, icon: TrendingUp, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
    { label: 'Total Activity', value: stats.totalActivity, icon: ActivityIcon, color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
    { label: 'Sports Leagues', value: stats.sportsLeagues, icon: Trophy, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
    { label: 'Online Now', value: onlineMacs.length, icon: Users, color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Dashboard</h2>
        <p className="text-slate-400 text-sm mt-1">Overview of your panel status</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className={`rounded-xl border ${card.border} ${card.bg} p-5 backdrop-blur-sm transition-all hover:scale-[1.02]`}
            >
              <div className="flex items-center justify-between mb-3">
                <Icon className={`w-6 h-6 ${card.color}`} />
              </div>
              <p className="text-3xl font-bold text-white">{card.value}</p>
              <p className="text-slate-400 text-sm mt-1">{card.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-400" /> Recent Activity
          </h3>
          {recentActivity.length === 0 ? (
            <p className="text-slate-500 text-sm">No activity recorded yet.</p>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {recentActivity.map((act) => (
                <div key={act.id} className="flex items-center gap-3 py-2 border-b border-slate-700/30 last:border-0">
                  <div className={`w-2 h-2 rounded-full ${
                    act.action === 'register' ? 'bg-blue-400' :
                    act.action === 'heartbeat' ? 'bg-emerald-400' :
                    act.action === 'blocked' ? 'bg-red-400' : 'bg-slate-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{act.device_identifier}</p>
                    <p className="text-xs text-slate-500">{act.action}</p>
                  </div>
                  <span className="text-xs text-slate-500 shrink-0">
                    {new Date(act.created_at).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Wifi className="w-5 h-5 text-emerald-400" /> Online Devices
          </h3>
          {onlineMacs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <AlertCircle className="w-8 h-8 text-slate-600 mb-2" />
              <p className="text-slate-500 text-sm">No devices online (seen in last 5 min)</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {onlineMacs.map((device) => (
                <div key={device.id} className="flex items-center gap-3 py-2 border-b border-slate-700/30 last:border-0">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{device.mac_address}</p>
                    <p className="text-xs text-slate-500">{device.device_name || 'Unnamed'}</p>
                  </div>
                  <span className="text-xs text-slate-500 shrink-0">
                    {device.last_seen_at ? new Date(device.last_seen_at).toLocaleTimeString() : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
