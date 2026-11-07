import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Server } from '@/lib/types';
import {
  Server as ServerIcon, Plus, Trash2, Loader2, RefreshCw,
  Edit3, X, Save, Power, ArrowUp, ArrowDown,
} from 'lucide-react';

const emptyServer: Omit<Server, 'id' | 'created_at' | 'updated_at'> = {
  name: '', host: '', port: 8080, username: '', password: '',
  server_type: 'xtream', is_active: true, sort_order: 0,
};

export function ServersPage() {
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Server | null>(null);
  const [formData, setFormData] = useState(emptyServer);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('servers').select('*').order('sort_order');
    setServers(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!formData.name.trim() || !formData.host.trim()) return;
    if (editing) {
      await supabase.from('servers').update(formData).eq('id', editing.id);
    } else {
      await supabase.from('servers').insert(formData);
    }
    setFormData(emptyServer);
    setEditing(null);
    setShowAdd(false);
    load();
  };

  const edit = (s: Server) => {
    setEditing(s);
    setFormData({
      name: s.name, host: s.host, port: s.port,
      username: s.username || '', password: s.password || '',
      server_type: s.server_type, is_active: s.is_active, sort_order: s.sort_order,
    });
    setShowAdd(true);
  };

  const remove = async (s: Server) => {
    if (!confirm(`Delete server "${s.name}"?`)) return;
    await supabase.from('servers').delete().eq('id', s.id);
    load();
  };

  const toggleActive = async (s: Server) => {
    await supabase.from('servers').update({ is_active: !s.is_active }).eq('id', s.id);
    load();
  };

  const moveOrder = async (s: Server, dir: -1 | 1) => {
    await supabase.from('servers').update({ sort_order: s.sort_order + dir }).eq('id', s.id);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Servers</h2>
          <p className="text-slate-400 text-sm mt-1">Manage IPTV server connections</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-all">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button
            onClick={() => { setFormData(emptyServer); setEditing(null); setShowAdd(!showAdd); }}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm transition-all shadow-lg shadow-emerald-500/25"
          >
            <Plus className="w-4 h-4" /> {editing ? 'Edit Server' : 'Add Server'}
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-medium">{editing ? 'Edit Server' : 'Add New Server'}</h3>
            <button onClick={() => { setShowAdd(false); setEditing(null); }} className="text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Name</label>
              <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Type</label>
              <select value={formData.server_type} onChange={(e) => setFormData({ ...formData, server_type: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50">
                <option value="xtream">Xtream</option>
                <option value="m3u">M3U</option>
                <option value="portal">Portal</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Host</label>
              <input type="text" value={formData.host} onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Port</label>
              <input type="number" value={formData.port} onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Username</label>
              <input type="text" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Password</label>
              <input type="text" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={formData.is_active} onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-4 h-4 rounded accent-emerald-500" />
            Active
          </label>
          <button onClick={save} className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm">
            <Save className="w-4 h-4" /> {editing ? 'Update' : 'Save'}
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
        </div>
      ) : servers.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-slate-500">
          <ServerIcon className="w-10 h-10 mb-3 opacity-50" />
          <p>No servers configured</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {servers.map((s, i) => (
            <div key={s.id} className={`rounded-xl border p-5 transition-all ${
              s.is_active
                ? 'bg-slate-800/50 border-slate-700/50'
                : 'bg-slate-800/20 border-slate-700/20 opacity-60'
            }`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    s.is_active ? 'bg-emerald-500/10' : 'bg-slate-600/10'
                  }`}>
                    <ServerIcon className={`w-5 h-5 ${s.is_active ? 'text-emerald-400' : 'text-slate-500'}`} />
                  </div>
                  <div>
                    <h3 className="text-white font-medium text-sm">{s.name}</h3>
                    <p className="text-slate-500 text-xs">{s.server_type}</p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 text-xs rounded-full ${
                  s.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400'
                }`}>
                  {s.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="space-y-1 text-sm">
                <p className="text-slate-400"><span className="text-slate-500">Host:</span> {s.host}</p>
                {s.username && <p className="text-slate-400"><span className="text-slate-500">User:</span> {s.username}</p>}
              </div>
              <div className="flex items-center gap-1 mt-4 pt-4 border-t border-slate-700/30">
                <button onClick={() => moveOrder(s, -1)} disabled={i === 0} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700/30 rounded-lg disabled:opacity-30">
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button onClick={() => moveOrder(s, 1)} disabled={i === servers.length - 1} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700/30 rounded-lg disabled:opacity-30">
                  <ArrowDown className="w-4 h-4" />
                </button>
                <div className="flex-1" />
                <button onClick={() => toggleActive(s)} className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg" title="Toggle active">
                  <Power className="w-4 h-4" />
                </button>
                <button onClick={() => edit(s)} className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg">
                  <Edit3 className="w-4 h-4" />
                </button>
                <button onClick={() => remove(s)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg">
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
