import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Setting } from '@/lib/types';
import {
  Settings as SettingsIcon, Loader2, RefreshCw, Save, Search,
} from 'lucide-react';

export function SettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('settings').select('*').order('category').order('key');
    setSettings(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const categories = ['all', ...Array.from(new Set(settings.map((s) => s.category)))];

  const filtered = settings.filter((s) => {
    const matchesSearch = !search || s.key.toLowerCase().includes(search.toLowerCase()) ||
      (s.description || '').toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === 'all' || s.category === category;
    return matchesSearch && matchesCategory;
  });

  const getDisplayValue = (s: Setting): string => {
    if (editValues[s.key] !== undefined) return editValues[s.key];
    if (typeof s.value === 'string') return s.value.replace(/"/g, '');
    if (typeof s.value === 'boolean') return String(s.value);
    if (typeof s.value === 'number') return String(s.value);
    return JSON.stringify(s.value);
  };

  const saveSetting = async (s: Setting) => {
    setSavingKey(s.key);
    const rawValue = editValues[s.key] ?? getDisplayValue(s);
    let parsedValue: any = rawValue;

    if (typeof s.value === 'boolean') {
      parsedValue = rawValue === 'true' || rawValue === true;
    } else if (typeof s.value === 'number') {
      parsedValue = parseInt(rawValue) || 0;
    } else if (typeof s.value === 'string') {
      parsedValue = rawValue;
    }

    await supabase.from('settings').update({ value: parsedValue }).eq('id', s.id);
    setSavingKey(null);
    setEditValues({ ...editValues, [s.key]: undefined });
    load();
  };

  const categoryColors: Record<string, string> = {
    general: 'bg-blue-500/10 text-blue-400',
    security: 'bg-red-500/10 text-red-400',
    sports: 'bg-orange-500/10 text-orange-400',
    ads: 'bg-purple-500/10 text-purple-400',
    remote: 'bg-cyan-500/10 text-cyan-400',
    vpn: 'bg-green-500/10 text-green-400',
    features: 'bg-emerald-500/10 text-emerald-400',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Settings</h2>
          <p className="text-slate-400 text-sm mt-1">{settings.length} configuration keys</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <input
            type="text" placeholder="Search settings..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />
        </div>
        <select
          value={category} onChange={(e) => setCategory(e.target.value)}
          className="px-4 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
        >
          {categories.map((c) => (
            <option key={c} value={c}>{c === 'all' ? 'All Categories' : c.charAt(0).toUpperCase() + c.slice(1)}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><Loader2 className="w-8 h-8 text-emerald-500 animate-spin" /></div>
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => {
            const isBoolean = typeof s.value === 'boolean';
            const isEditing = editValues[s.key] !== undefined;
            return (
              <div key={s.id} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-40">
                    <div className="flex items-center gap-2 mb-1">
                      <code className="text-white text-sm font-mono">{s.key}</code>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${categoryColors[s.category] || 'bg-slate-500/10 text-slate-400'}`}>
                        {s.category}
                      </span>
                      {s.is_public && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-500/10 text-emerald-400">public</span>
                      )}
                    </div>
                    {s.description && <p className="text-slate-500 text-xs">{s.description}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {isBoolean ? (
                      <button
                        onClick={() => {
                          setEditValues({ ...editValues, [s.key]: String(!s.value) });
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          s.value
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-slate-700/30 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {s.value ? 'Enabled' : 'Disabled'}
                      </button>
                    ) : (
                      <input
                        type="text"
                        value={getDisplayValue(s)}
                        onChange={(e) => setEditValues({ ...editValues, [s.key]: e.target.value })}
                        className="px-3 py-1.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 min-w-32"
                      />
                    )}
                    {isEditing && (
                      <button
                        onClick={() => saveSetting(s)}
                        disabled={savingKey === s.key}
                        className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm"
                      >
                        {savingKey === s.key ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        Save
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
