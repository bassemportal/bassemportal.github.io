import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { ActivityLog } from '@/lib/types';
import {
  Activity as ActivityIcon, Search, Loader2, RefreshCw, Trash2,
} from 'lucide-react';

export function ActivityPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [count, setCount] = useState(0);
  const pageSize = 50;

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('activity').select('*', { count: 'exact' });

    if (search) {
      q = q.or(`device_identifier.ilike.%${search}%,mac_address.ilike.%${search}%`);
    }
    if (actionFilter !== 'all') {
      q = q.eq('action', actionFilter);
    }

    q = q.order('created_at', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    const { data, count: totalCount } = await q;
    setLogs(data || []);
    setCount(totalCount || 0);
    setLoading(false);
  }, [search, actionFilter, page]);

  useEffect(() => { load(); }, [load]);

  const clearAll = async () => {
    if (!confirm('Delete ALL activity logs? This cannot be undone.')) return;
    await supabase.from('activity').delete().neq('id', 0);
    load();
  };

  const totalPages = Math.ceil(count / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Activity Log</h2>
          <p className="text-slate-400 text-sm mt-1">{count} total records</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button onClick={clearAll} className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm border border-red-500/20">
            <Trash2 className="w-4 h-4" /> Clear All
          </button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <input
            type="text" placeholder="Search by device..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />
        </div>
        <select
          value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(0); }}
          className="px-4 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
        >
          <option value="all">All Actions</option>
          <option value="register">Register</option>
          <option value="heartbeat">Heartbeat</option>
          <option value="resolve">Resolve</option>
          <option value="blocked">Blocked</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><Loader2 className="w-8 h-8 text-emerald-500 animate-spin" /></div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-slate-500">
          <ActivityIcon className="w-10 h-10 mb-3 opacity-50" />
          <p>No activity records</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto bg-slate-800/30 border border-slate-700/50 rounded-xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/50">
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Device</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Action</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium hidden md:table-cell">IP</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium hidden lg:table-cell">User Agent</th>
                  <th className="text-right px-4 py-3 text-slate-400 font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-slate-700/30 last:border-0 hover:bg-slate-700/20">
                    <td className="px-4 py-3 text-white font-mono text-xs">{log.device_identifier}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${
                        log.action === 'register' ? 'bg-blue-500/10 text-blue-400' :
                        log.action === 'heartbeat' ? 'bg-emerald-500/10 text-emerald-400' :
                        log.action === 'blocked' ? 'bg-red-500/10 text-red-400' :
                        'bg-slate-500/10 text-slate-400'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs hidden md:table-cell">{log.ip_address || '-'}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs hidden lg:table-cell max-w-48 truncate">{log.user_agent || '-'}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs text-right">{new Date(log.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm disabled:opacity-30"
              >
                Previous
              </button>
              <span className="text-slate-400 text-sm">
                Page {page + 1} of {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm disabled:opacity-30"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
