import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { MacDevice, Server } from '@/lib/types';
import {
  Smartphone, Plus, Search, Trash2, Ban, CheckCircle, XCircle,
  Loader2, RefreshCw, Edit3, X, Save,
} from 'lucide-react';

export function DevicesPage() {
  const [devices, setDevices] = useState<MacDevice[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<MacDevice | null>(null);
  const [newMac, setNewMac] = useState('');
  const [newName, setNewName] = useState('');
  const [newServer, setNewServer] = useState('');

  const loadDevices = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('mac_devices').select('*').order('created_at', { ascending: false });
    if (search) {
      query = query.or(`mac_address.ilike.%${search}%,device_name.ilike.%${search}%`);
    }
    const { data } = await query;
    setDevices(data || []);

    const { data: srvs } = await supabase.from('servers').select('*').order('sort_order');
    setServers(srvs || []);
    setLoading(false);
  }, [search]);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  const toggleAuthorized = async (device: MacDevice) => {
    await supabase.from('mac_devices').update({ is_authorized: !device.is_authorized }).eq('id', device.id);
    loadDevices();
  };

  const toggleBlocked = async (device: MacDevice) => {
    await supabase.from('mac_devices').update({ is_blocked: !device.is_blocked }).eq('id', device.id);
    loadDevices();
  };

  const deleteDevice = async (device: MacDevice) => {
    if (!confirm(`Delete device ${device.mac_address}?`)) return;
    await supabase.from('mac_devices').delete().eq('id', device.id);
    loadDevices();
  };

  const addDevice = async () => {
    if (!newMac.trim()) return;
    const normalized = newMac.toUpperCase().trim();
    await supabase.from('mac_devices').insert({
      mac_address: normalized,
      device_name: newName.trim() || null,
      server_id: newServer || null,
      is_authorized: true,
    });
    setNewMac('');
    setNewName('');
    setNewServer('');
    setShowAdd(false);
    loadDevices();
  };

  const saveEdit = async () => {
    if (!editing) return;
    await supabase.from('mac_devices').update({
      device_name: editing.device_name,
      server_id: editing.server_id,
      xtream_username: editing.xtream_username,
      xtream_password: editing.xtream_password,
      expires_at: editing.expires_at,
    }).eq('id', editing.id);
    setEditing(null);
    loadDevices();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">MAC Devices</h2>
          <p className="text-slate-400 text-sm mt-1">Manage authorized devices</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadDevices}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-all"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm transition-all shadow-lg shadow-emerald-500/25"
          >
            <Plus className="w-4 h-4" /> Add Device
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 space-y-4">
          <h3 className="text-white font-medium">Add New Device</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              placeholder="MAC Address (AA:BB:CC:DD:EE:FF)"
              value={newMac}
              onChange={(e) => setNewMac(e.target.value)}
              className="px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
            <input
              type="text"
              placeholder="Device Name (optional)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
            <select
              value={newServer}
              onChange={(e) => setNewServer(e.target.value)}
              className="px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              <option value="">No Server</option>
              {servers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={addDevice} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm">
              Save Device
            </button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
        <input
          type="text"
          placeholder="Search by MAC or name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
        </div>
      ) : devices.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-slate-500">
          <Smartphone className="w-10 h-10 mb-3 opacity-50" />
          <p>No devices found</p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-slate-800/30 border border-slate-700/50 rounded-xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/50">
                <th className="text-left px-4 py-3 text-slate-400 font-medium">MAC Address</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Name</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Status</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium hidden md:table-cell">Last Seen</th>
                <th className="text-right px-4 py-3 text-slate-400 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((device) => (
                <tr key={device.id} className="border-b border-slate-700/30 last:border-0 hover:bg-slate-700/20">
                  <td className="px-4 py-3 text-white font-mono text-xs">{device.mac_address}</td>
                  <td className="px-4 py-3 text-slate-300">{device.device_name || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 flex-wrap">
                      {device.is_authorized ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-xs rounded-full">
                          <CheckCircle className="w-3 h-3" /> Authorized
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-500/10 text-slate-400 text-xs rounded-full">
                          <XCircle className="w-3 h-3" /> Pending
                        </span>
                      )}
                      {device.is_blocked && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-500/10 text-red-400 text-xs rounded-full">
                          <Ban className="w-3 h-3" /> Blocked
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs hidden md:table-cell">
                    {device.last_seen_at ? new Date(device.last_seen_at).toLocaleString() : 'Never'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setEditing({ ...device })}
                        className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all"
                        title="Edit"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => toggleAuthorized(device)}
                        className={`p-1.5 rounded-lg transition-all ${
                          device.is_authorized
                            ? 'text-emerald-400 hover:bg-emerald-500/10'
                            : 'text-slate-500 hover:bg-slate-500/10'
                        }`}
                        title={device.is_authorized ? 'Deauthorize' : 'Authorize'}
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => toggleBlocked(device)}
                        className={`p-1.5 rounded-lg transition-all ${
                          device.is_blocked
                            ? 'text-red-400 hover:bg-red-500/10'
                            : 'text-slate-500 hover:bg-red-500/10'
                        }`}
                        title={device.is_blocked ? 'Unblock' : 'Block'}
                      >
                        <Ban className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteDevice(device)}
                        className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold">Edit Device</h3>
              <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">MAC Address</label>
              <p className="text-white font-mono text-sm px-3 py-2 bg-slate-900/50 rounded-lg">{editing.mac_address}</p>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Device Name</label>
              <input
                type="text"
                value={editing.device_name || ''}
                onChange={(e) => setEditing({ ...editing, device_name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Server</label>
              <select
                value={editing.server_id || ''}
                onChange={(e) => setEditing({ ...editing, server_id: e.target.value || null })}
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              >
                <option value="">No Server</option>
                {servers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Xtream User</label>
                <input
                  type="text"
                  value={editing.xtream_username || ''}
                  onChange={(e) => setEditing({ ...editing, xtream_username: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Xtream Pass</label>
                <input
                  type="text"
                  value={editing.xtream_password || ''}
                  onChange={(e) => setEditing({ ...editing, xtream_password: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Expires At</label>
              <input
                type="datetime-local"
                value={editing.expires_at ? editing.expires_at.slice(0, 16) : ''}
                onChange={(e) => setEditing({ ...editing, expires_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={saveEdit} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm">
                <Save className="w-4 h-4" /> Save
              </button>
              <button onClick={() => setEditing(null)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
