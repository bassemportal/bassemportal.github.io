import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Remote } from '@/lib/types';
import {
  Gamepad2, Trash2, Loader2, RefreshCw, QrCode, Power, Smartphone,
} from 'lucide-react';

export function RemotesPage() {
  const [remotes, setRemotes] = useState<Remote[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('remotes').select('*').order('created_at', { ascending: false });
    setRemotes(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (r: Remote) => {
    await supabase.from('remotes').update({ is_active: !r.is_active }).eq('id', r.id);
    load();
  };

  const remove = async (r: Remote) => {
    if (!confirm(`Delete remote pairing "${r.pairing_code}"?`)) return;
    await supabase.from('remotes').delete().eq('id', r.id);
    load();
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'paired': return 'bg-emerald-500/10 text-emerald-400';
      case 'pending': return 'bg-amber-500/10 text-amber-400';
      case 'expired': return 'bg-red-500/10 text-red-400';
      default: return 'bg-slate-500/10 text-slate-400';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Remote Control</h2>
          <p className="text-slate-400 text-sm mt-1">QR pairing sessions and remote devices</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><Loader2 className="w-8 h-8 text-emerald-500 animate-spin" /></div>
      ) : remotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-slate-500">
          <Gamepad2 className="w-10 h-10 mb-3 opacity-50" />
          <p>No remote pairing sessions</p>
          <p className="text-sm mt-1">Pairing codes are created from the Android app.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {remotes.map((r) => (
            <div key={r.id} className={`bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 ${!r.is_active ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <QrCode className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-white font-mono text-sm font-bold">{r.pairing_code}</p>
                    <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full ${statusColor(r.status)}`}>
                      {r.status}
                    </span>
                  </div>
                </div>
              </div>
              <div className="space-y-1 text-sm text-slate-400">
                {r.device_mac && <p><span className="text-slate-500">Device:</span> {r.device_mac}</p>}
                {r.device_name && <p><span className="text-slate-500">Name:</span> {r.device_name}</p>}
                {r.phone_name && <p className="flex items-center gap-1"><Smartphone className="w-3 h-3" /> {r.phone_name}</p>}
                {r.paired_at && <p><span className="text-slate-500">Paired:</span> {new Date(r.paired_at).toLocaleString()}</p>}
                {r.last_used_at && <p><span className="text-slate-500">Last used:</span> {new Date(r.last_used_at).toLocaleString()}</p>}
                {r.expires_at && <p><span className="text-slate-500">Expires:</span> {new Date(r.expires_at).toLocaleString()}</p>}
              </div>
              <div className="flex items-center gap-1 mt-4 pt-4 border-t border-slate-700/30">
                <button onClick={() => toggle(r)} className={`p-1.5 rounded-lg ${r.is_active ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-slate-500 hover:bg-slate-500/10'}`}>
                  <Power className="w-4 h-4" />
                </button>
                <div className="flex-1" />
                <button onClick={() => remove(r)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
