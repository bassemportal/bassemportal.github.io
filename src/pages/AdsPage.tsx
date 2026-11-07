import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { MenuAd } from '@/lib/types';
import {
  Image, Plus, Trash2, Loader2, RefreshCw, X, Save, Power, ExternalLink,
} from 'lucide-react';

const emptyAd = {
  title: '', image_url: '', click_url: '', position: 'sidebar',
  is_active: true, sort_order: 0, starts_at: '', ends_at: '',
};

export function AdsPage() {
  const [ads, setAds] = useState<MenuAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [formData, setFormData] = useState(emptyAd);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('menu_ads').select('*').order('sort_order');
    setAds(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!formData.title.trim() || !formData.image_url.trim()) return;
    await supabase.from('menu_ads').insert({
      title: formData.title, image_url: formData.image_url,
      click_url: formData.click_url || null, position: formData.position,
      is_active: formData.is_active, sort_order: formData.sort_order,
      starts_at: formData.starts_at ? new Date(formData.starts_at).toISOString() : null,
      ends_at: formData.ends_at ? new Date(formData.ends_at).toISOString() : null,
    });
    setFormData(emptyAd);
    setShowAdd(false);
    load();
  };

  const toggle = async (ad: MenuAd) => {
    await supabase.from('menu_ads').update({ is_active: !ad.is_active }).eq('id', ad.id);
    load();
  };

  const remove = async (ad: MenuAd) => {
    if (!confirm(`Delete ad "${ad.title}"?`)) return;
    await supabase.from('menu_ads').delete().eq('id', ad.id);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Menu Ads</h2>
          <p className="text-slate-400 text-sm mt-1">Manage advertisement banners</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button onClick={() => { setFormData(emptyAd); setShowAdd(!showAdd); }}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm shadow-lg shadow-emerald-500/25">
            <Plus className="w-4 h-4" /> Add Ad
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-medium">New Advertisement</h3>
            <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input type="text" placeholder="Title" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
            <select value={formData.position} onChange={(e) => setFormData({ ...formData, position: e.target.value })}
              className="px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50">
              <option value="sidebar">Sidebar</option>
              <option value="topbar">Top Bar</option>
              <option value="bottombar">Bottom Bar</option>
              <option value="fullscreen">Fullscreen</option>
            </select>
            <input type="text" placeholder="Image URL" value={formData.image_url} onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
              className="px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
            <input type="text" placeholder="Click URL (optional)" value={formData.click_url} onChange={(e) => setFormData({ ...formData, click_url: e.target.value })}
              className="px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
            <input type="datetime-local" placeholder="Start" value={formData.starts_at} onChange={(e) => setFormData({ ...formData, starts_at: e.target.value })}
              className="px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
            <input type="datetime-local" placeholder="End" value={formData.ends_at} onChange={(e) => setFormData({ ...formData, ends_at: e.target.value })}
              className="px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
          </div>
          <button onClick={save} className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm">
            <Save className="w-4 h-4" /> Save Ad
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48"><Loader2 className="w-8 h-8 text-emerald-500 animate-spin" /></div>
      ) : ads.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-slate-500">
          <Image className="w-10 h-10 mb-3 opacity-50" />
          <p>No advertisements configured</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ads.map((ad) => (
            <div key={ad.id} className={`bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden ${!ad.is_active ? 'opacity-50' : ''}`}>
              <div className="aspect-video bg-slate-900/50 flex items-center justify-center overflow-hidden">
                {ad.image_url ? (
                  <img src={ad.image_url} alt={ad.title} className="w-full h-full object-cover" />
                ) : (
                  <Image className="w-8 h-8 text-slate-600" />
                )}
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-white font-medium text-sm">{ad.title}</h3>
                  <span className="px-2 py-0.5 text-xs rounded-full bg-slate-700/50 text-slate-400">{ad.position}</span>
                </div>
                {ad.click_url && (
                  <a href={ad.click_url} target="_blank" rel="noopener noreferrer" className="text-emerald-400/70 text-xs flex items-center gap-1 mb-2">
                    <ExternalLink className="w-3 h-3" /> {ad.click_url}
                  </a>
                )}
                <div className="flex items-center gap-1 pt-2 border-t border-slate-700/30">
                  <button onClick={() => toggle(ad)} className={`p-1.5 rounded-lg ${ad.is_active ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-slate-500 hover:bg-slate-500/10'}`}>
                    <Power className="w-4 h-4" />
                  </button>
                  <div className="flex-1" />
                  <button onClick={() => remove(ad)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
