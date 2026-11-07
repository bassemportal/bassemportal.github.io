import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { SportsLeague, SportsManualEvent } from '@/lib/types';
import {
  Trophy, Plus, Trash2, Search, Loader2, RefreshCw,
  Edit3, X, Save, CalendarPlus, Power,
} from 'lucide-react';

type Tab = 'leagues' | 'manual' | 'overrides';

export function SportsPage() {
  const [tab, setTab] = useState<Tab>('leagues');
  const [leagues, setLeagues] = useState<SportsLeague[]>([]);
  const [events, setEvents] = useState<SportsManualEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const [newLeague, setNewLeague] = useState({
    name: '', sport: 'Soccer', country: '', thesportsdb_league_id: '', logo_url: '',
  });
  const [newEvent, setNewEvent] = useState({
    home_team: '', away_team: '', sport: 'Soccer', league_id: '',
    event_time: '', stream_url: '', logo_home_url: '', logo_away_url: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    if (tab === 'leagues') {
      let q = supabase.from('sports_leagues').select('*').order('sort_order');
      if (search) q = q.or(`name.ilike.%${search}%,sport.ilike.%${search}%,country.ilike.%${search}%`);
      const { data } = await q;
      setLeagues(data || []);
    } else if (tab === 'manual') {
      const { data } = await supabase.from('sports_manual_events').select('*').order('event_time', { ascending: false });
      setEvents(data || []);
    }
    setLoading(false);
  }, [tab, search]);

  useEffect(() => { load(); }, [load]);

  const addLeague = async () => {
    if (!newLeague.name.trim()) return;
    await supabase.from('sports_leagues').insert({
      name: newLeague.name, sport: newLeague.sport, country: newLeague.country || null,
      thesportsdb_league_id: newLeague.thesportsdb_league_id || null,
      logo_url: newLeague.logo_url || null, is_active: true,
    });
    setNewLeague({ name: '', sport: 'Soccer', country: '', thesportsdb_league_id: '', logo_url: '' });
    setShowAdd(false);
    load();
  };

  const toggleLeague = async (l: SportsLeague) => {
    await supabase.from('sports_leagues').update({ is_active: !l.is_active }).eq('id', l.id);
    load();
  };

  const deleteLeague = async (l: SportsLeague) => {
    if (!confirm(`Delete league "${l.name}"?`)) return;
    await supabase.from('sports_leagues').delete().eq('id', l.id);
    load();
  };

  const addEvent = async () => {
    if (!newEvent.home_team.trim() || !newEvent.away_team.trim() || !newEvent.event_time) return;
    await supabase.from('sports_manual_events').insert({
      home_team: newEvent.home_team, away_team: newEvent.away_team,
      sport: newEvent.sport, league_id: newEvent.league_id || null,
      event_time: new Date(newEvent.event_time).toISOString(),
      stream_url: newEvent.stream_url || null,
      logo_home_url: newEvent.logo_home_url || null,
      logo_away_url: newEvent.logo_away_url || null,
    });
    setNewEvent({ home_team: '', away_team: '', sport: 'Soccer', league_id: '', event_time: '', stream_url: '', logo_home_url: '', logo_away_url: '' });
    setShowAdd(false);
    load();
  };

  const deleteEvent = async (e: SportsManualEvent) => {
    if (!confirm(`Delete event "${e.home_team} vs ${e.away_team}"?`)) return;
    await supabase.from('sports_manual_events').delete().eq('id', e.id);
    load();
  };

  const toggleEvent = async (e: SportsManualEvent) => {
    await supabase.from('sports_manual_events').update({ is_active: !e.is_active }).eq('id', e.id);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Sports Guide</h2>
          <p className="text-slate-400 text-sm mt-1">Manage leagues and manual events</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-all">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="flex gap-2 p-1 bg-slate-800/50 rounded-lg w-fit">
        {([['leagues', 'Leagues'], ['manual', 'Manual Events'], ['overrides', 'Overrides']] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => { setTab(t); setSearch(''); }}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              tab === t ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'leagues' && (
        <>
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="text" placeholder="Search leagues..." value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>
            <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm">
              <Plus className="w-4 h-4" /> Add League
            </button>
          </div>

          {showAdd && (
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input type="text" placeholder="League Name" value={newLeague.name} onChange={(e) => setNewLeague({ ...newLeague, name: e.target.value })}
                  className="px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
                <select value={newLeague.sport} onChange={(e) => setNewLeague({ ...newLeague, sport: e.target.value })}
                  className="px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50">
                  <option>Soccer</option><option>Basketball</option><option>Tennis</option>
                  <option>F1</option><option>Boxing</option><option>Cricket</option>
                  <option>Baseball</option><option>American Football</option><option>Other</option>
                </select>
                <input type="text" placeholder="Country" value={newLeague.country} onChange={(e) => setNewLeague({ ...newLeague, country: e.target.value })}
                  className="px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
                <input type="text" placeholder="TheSportsDB League ID" value={newLeague.thesportsdb_league_id} onChange={(e) => setNewLeague({ ...newLeague, thesportsdb_league_id: e.target.value })}
                  className="px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
              </div>
              <div className="flex gap-2">
                <button onClick={addLeague} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm">Save</button>
                <button onClick={() => setShowAdd(false)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm">Cancel</button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-48"><Loader2 className="w-8 h-8 text-emerald-500 animate-spin" /></div>
          ) : (
            <div className="overflow-x-auto bg-slate-800/30 border border-slate-700/50 rounded-xl">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700/50">
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Name</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Sport</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium hidden md:table-cell">Country</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium hidden lg:table-cell">TSDB ID</th>
                    <th className="text-right px-4 py-3 text-slate-400 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {leagues.map((l) => (
                    <tr key={l.id} className="border-b border-slate-700/30 last:border-0 hover:bg-slate-700/20">
                      <td className="px-4 py-3 text-white">{l.name}</td>
                      <td className="px-4 py-3 text-slate-300">{l.sport}</td>
                      <td className="px-4 py-3 text-slate-300 hidden md:table-cell">{l.country || '-'}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs hidden lg:table-cell font-mono">{l.thesportsdb_league_id || '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => toggleLeague(l)} className={`p-1.5 rounded-lg ${l.is_active ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-slate-500 hover:bg-slate-500/10'}`}>
                            <Power className="w-4 h-4" />
                          </button>
                          <button onClick={() => deleteLeague(l)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg">
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
        </>
      )}

      {tab === 'manual' && (
        <>
          <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm">
            <CalendarPlus className="w-4 h-4" /> Add Event
          </button>

          {showAdd && (
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input type="text" placeholder="Home Team" value={newEvent.home_team} onChange={(e) => setNewEvent({ ...newEvent, home_team: e.target.value })}
                  className="px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
                <input type="text" placeholder="Away Team" value={newEvent.away_team} onChange={(e) => setNewEvent({ ...newEvent, away_team: e.target.value })}
                  className="px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
                <select value={newEvent.sport} onChange={(e) => setNewEvent({ ...newEvent, sport: e.target.value })}
                  className="px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50">
                  <option>Soccer</option><option>Basketball</option><option>Tennis</option>
                  <option>F1</option><option>Boxing</option><option>Other</option>
                </select>
                <input type="datetime-local" value={newEvent.event_time} onChange={(e) => setNewEvent({ ...newEvent, event_time: e.target.value })}
                  className="px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
                <input type="text" placeholder="Stream URL" value={newEvent.stream_url} onChange={(e) => setNewEvent({ ...newEvent, stream_url: e.target.value })}
                  className="px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
                <input type="text" placeholder="League ID (optional)" value={newEvent.league_id} onChange={(e) => setNewEvent({ ...newEvent, league_id: e.target.value })}
                  className="px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
              </div>
              <div className="flex gap-2">
                <button onClick={addEvent} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm">Save Event</button>
                <button onClick={() => setShowAdd(false)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm">Cancel</button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-48"><Loader2 className="w-8 h-8 text-emerald-500 animate-spin" /></div>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-500">
              <Trophy className="w-10 h-10 mb-3 opacity-50" />
              <p>No manual events</p>
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((e) => (
                <div key={e.id} className={`bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 flex items-center gap-4 ${!e.is_active ? 'opacity-50' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium">{e.home_team} vs {e.away_team}</p>
                    <p className="text-slate-500 text-sm">{e.sport} — {new Date(e.event_time).toLocaleString()}</p>
                    {e.stream_url && <p className="text-emerald-400/70 text-xs mt-1 truncate">{e.stream_url}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => toggleEvent(e)} className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg">
                      <Power className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteEvent(e)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'overrides' && (
        <div className="flex flex-col items-center justify-center h-48 text-slate-500">
          <Trophy className="w-10 h-10 mb-3 opacity-50" />
          <p>Fixture overrides manage automatic fixture corrections.</p>
          <p className="text-sm mt-1">Use the API to programmatically add overrides.</p>
        </div>
      )}
    </div>
  );
}
