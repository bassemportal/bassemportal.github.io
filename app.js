(() => {
"use strict";
const cfg=window.BASSEM_CONFIG||{};
const $=id=>document.getElementById(id);
let playlistCheckResolver = null;
const state={sb:null,user:null,profile:null,idleTimer:null,lastActivity:0,playlistMode:"stalker",selectedServers:{stalker:null,xtream:null},servers:[],playlists:[],devices:[],assignments:[],dashboardUsers:[],loginHistory:[],page:"overview",selectedPlaylistIds:new Set(),selectedDeviceMacs:new Set(),selectedDeviceIds:new Set(),selectedAssignmentKeys:new Set(),playlistAnchor:null,newDevices:[]};
const META={
 is_vod:0,position:null,tvg_urls:"",tvg_shift:0,is_enabled:1,user_agent:null,auto_update:0,include_vod:1,is_expanded:0,
 movie_count:0,catchup_type:2,series_count:0,catchup_hours:72,channel_count:0,
 stalker_token:"123456789123DFFDDF223D2D2D2DS2Q2",catchup_source:null,groups_sorting:1,logos_priority:1,
 expiration_date:null,max_connections:null,server_timezone:null,last_update_time:1794309903421,
 user_catchup_type:null,user_catchup_hours:null,include_tv_channels:1,prev_groups_sorting:1,
 movie_groups_sorting:1,is_expanded_in_movies:0,is_expanded_in_series:0,series_groups_sorting:1,
 update_interval_hours:24,are_new_groups_visible:1,are_new_movie_groups_visible:1,are_new_series_groups_visible:1,
 user_catchup_time_offset:null,prev_movie_groups_sorting:1,is_visible_in_all_channels:1,
 prev_series_groups_sorting:1,is_visible_in_all_favorites:1
};
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function msg(s,bad=false){$("notice").textContent=s;$("notice").classList.toggle("hidden",!s);$("notice").classList.toggle("bad",bad);if(s)setTimeout(()=>$("notice").classList.add("hidden"),6500);}
function fail(e){console.error(e);msg(e?.message||String(e),true);}
function normalizeMac(v){return String(v||"").toUpperCase().replace(/[^0-9A-F]/g,"");}
function validMac(v){return /^[0-9A-F]{12}$/.test(v);}
function colonMac(v){return v.match(/.{2}/g).join(":");}

function playlistExpiryTimestamp(p){
 const raw=p?.metadata?.expiration_date ?? p?.expiration_date ?? null;
 const value=Number(raw);
 return Number.isFinite(value)&&value>0?Math.floor(value):null;
}
function formatPlaylistExpiry(p){
 const timestamp=playlistExpiryTimestamp(p);
 if(!timestamp)return "—";
 const d=new Date(timestamp*1000);
 return `${String(d.getUTCDate()).padStart(2,"0")}/${String(d.getUTCMonth()+1).padStart(2,"0")}/${d.getUTCFullYear()}`;
}
const STALKER_CHECK_URL="https://xytstddhsouoeuwnuwzz.supabase.co/functions/v1/check-stalker";
async function callStalkerCheck(host,mac){
 const response=await fetch(STALKER_CHECK_URL,{
  method:"POST",
  headers:{"Content-Type":"application/json"},
  body:JSON.stringify({host,mac:colonMac(mac)})
 });
 let result={};
 try{result=await response.json();}catch{}
 if(!response.ok){
  return {...result,online:false,authenticated:false,http_status:response.status,error:result.error||`check-stalker failed (${response.status})`};
 }
 return result;
}
function finishPlaylistCheck(accepted){
 const resolve=playlistCheckResolver;
 playlistCheckResolver=null;
 closeModal();
 if(resolve)resolve(accepted);
}
function confirmAddUnverifiedPlaylist(name,result){
 const details=result?.account_result||result?.error||result?.stage||"Portal could not be verified";
 const status=result?.account_status||result?.handshake_status||result?.http_status||"No HTTP response";
 return new Promise(resolve=>{
  playlistCheckResolver=resolve;
  openModal("Playlist could not be verified",`
   <div class="form-grid">
    <p class="span-2">The Stalker host/account check did not return a verified online result for <b>${esc(name)}</b>.</p>
    <p class="muted span-2">Result: ${esc(details)} · HTTP ${esc(status)}</p>
    <p class="span-2">If you continue, this playlist will be inserted with no expiration date (<b>null</b>). Otherwise, cancel to insert nothing.</p>
    <div class="span-2" style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap">
     <button type="button" class="btn" data-playlist-check-choice="cancel">Cancel</button>
     <button type="button" class="btn primary" data-playlist-check-choice="add">Add anyway</button>
    </div>
   </div>`);
 });
}
function hostIdentifier(raw){const u=new URL(raw);const p=u.hostname.toLowerCase().split(".");return p.length>1?p.slice(0,-1).join("."):p[0];}
function portalUrl(raw){const u=new URL(raw);const path=u.pathname.replace(/\/+$/,"");return u.origin+(path&&path!=="/"?path:"/c");}
function playlistPayload(server,mac){
 const obj={s:portalUrl(server.url),rs:"",ua:1,l:"this.portal_protocol+'://'+this.portal_ip+'/portal.php'",sv:"",m:colonMac(mac),u:"",p:"",di:"",di2:"",sn:"007255N967172",adid:"eec3d2a615d9169e6d703904b89ec3d0"};
 return "s:"+JSON.stringify(obj);
}
function selectedValues(sel){return [...sel.selectedOptions].map(o=>o.value);}
function newestFirst(rows,field){
 return [...(rows||[])].sort((a,b)=>{
  const ta=Date.parse(a?.[field]||"");
  const tb=Date.parse(b?.[field]||"");
  const va=Number.isFinite(ta)?ta:0;
  const vb=Number.isFinite(tb)?tb:0;
  return vb-va;
 });
}
async function loadData(){
 const names=["servers","playlists","mac_devices","playlist_assignments"];
 const results=await Promise.all(names.map(t=>state.sb.from(t).select("*").limit(5000)));
 results.forEach((r,i)=>{if(r.error)throw new Error(names[i]+": "+r.error.message);});
 const [servers,playlists,devices,assignments]=results.map(r=>r.data||[]);
 state.servers=newestFirst(servers,"created_at");
 state.playlists=newestFirst(playlists,"created_at");
 state.devices=newestFirst(devices,"created_at");
 state.assignments=newestFirst(assignments,"assigned_at");
 renderAll();
}
const IDLE_KEY="bassemtv_idle_minutes";
function idleMinutes(){const n=Number(localStorage.getItem(IDLE_KEY)||15);return [5,10,15,30,60].includes(n)?n:15;}
function updateIdleSetting(){const el=$("idleTimeoutSelect");if(el)el.value=String(idleMinutes());}
function stopIdleTimer(){if(state.idleTimer)clearTimeout(state.idleTimer);state.idleTimer=null;}
function recordActivity(){if(!state.user)return;state.lastActivity=Date.now();try{localStorage.setItem("bassemtv_last_activity",String(state.lastActivity));}catch{};armIdleTimer();}
function armIdleTimer(){stopIdleTimer();if(!state.user)return;const remaining=idleMinutes()*60000-(Date.now()-state.lastActivity);if(remaining<=0){expireIdleSession();return;}state.idleTimer=setTimeout(expireIdleSession,remaining);}
async function expireIdleSession(){stopIdleTimer();if(!state.user)return;try{await state.sb.auth.signOut();}catch(e){console.error(e);}state.user=null;state.profile=null;$("loginView").classList.remove("hidden");$("appView").classList.add("hidden");showAuthView("loginForm");$("loginError").textContent="You were signed out after being inactive for "+idleMinutes()+" minutes.";}
function startIdleProtection(){if(!state.user)return;let last=0;try{last=Number(localStorage.getItem("bassemtv_last_activity")||0);}catch{}state.lastActivity=last||Date.now();if(Date.now()-state.lastActivity>=idleMinutes()*60000){expireIdleSession();return;}recordActivity();}
["pointerdown","keydown","touchstart","scroll","click"].forEach(evt=>document.addEventListener(evt,()=>{if(state.user)recordActivity();},{passive:true}));
window.addEventListener("storage",e=>{if(e.key==="bassemtv_last_activity"&&state.user){state.lastActivity=Number(e.newValue)||Date.now();armIdleTimer();}});
function showPage(page){
 if((page==="users"||page==="login-history")&&state.profile?.role!=="superadmin")return;
 state.page=page;
 try{
  sessionStorage.setItem("bassemtv_current_page",page);
}catch{}
 document.querySelectorAll(".page").forEach(x=>x.classList.toggle("hidden",x.id!=="page-"+page));
 document.querySelectorAll("#nav button[data-page]").forEach(x=>x.classList.toggle("active",x.dataset.page===page));
 $("pageTitle").textContent=({overview:"Overview","add-playlist":"Add playlists",assignments:"Assignments",playlists:"Playlists",devices:"Devices","new-devices":"New Devices",servers:"Servers",settings:"Settings",users:"Dashboard users","login-history":"Login history"})[page]||page;
 if(page==="assignments")renderAssignments();
 if(page==="new-devices")loadNewDevices().catch(fail);
 if(page==="users")loadDashboardUsers().catch(fail);
 if(page==="login-history")loadLoginHistory().catch(fail);
 if(page==="settings"&&state.user){loadPasskeys().catch(e=>setPasskeyMessage("passkeySettingsMessage",e.message,true));updateIdleSetting();}
}
function renderAll(){
 $("statServers").textContent=state.servers.length;$("statPlaylists").textContent=state.playlists.length;$("statDevices").textContent=state.devices.length;$("statAssignments").textContent=state.assignments.length;
 $("userEmail").textContent=state.user?.email||"";$("settingsEmail").textContent=state.user?.email||"";$("projectUrl").textContent=cfg.SUPABASE_URL||"";
 renderServerPicker("stalker");renderServerPicker("xtream");
 $("deviceServer").innerHTML='<option value="">No server</option>'+state.servers.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join("");
 $("playlistDevices").innerHTML=state.devices.map(d=>`<option value="${esc(d.mac)}">${esc(d.name||d.mac)} — ${esc(d.mac)}</option>`).join("");
 $("recentDevices").innerHTML=table(["MAC","Name","Model","Last seen"],state.devices.slice().sort((a,b)=>String(b.last_seen||"").localeCompare(String(a.last_seen||""))).slice(0,8).map(d=>[esc(d.mac),esc(d.name),esc(d.last_model||"—"),esc(d.last_seen||"—")]));
 renderPlaylists();renderDevices();renderServers();renderAssignments();
}
function table(headers,rows){if(!rows.length)return '<div class="empty">No records found.</div>';return `<table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;}
function playlistParts(p){
 try{const raw=String(p.url||"");if(raw.startsWith("xc:")){const obj=JSON.parse(raw.slice(3));return {type:"xtream",host:String(obj.h||""),username:String(obj.u||""),password:String(obj.p||""),mac:"",obj};}const payload=raw.startsWith("s:")?raw.slice(2):raw;const obj=JSON.parse(payload);return {type:"stalker",host:String(obj.s||""),username:"",password:"",mac:String(obj.m||"").replace(/[^0-9A-Fa-f]/g,"").toUpperCase(),obj};}
 catch{return {type:"unknown",host:"",username:"",password:"",mac:"",obj:null};}
}
function renderPlaylists(){
 const q=($("playlistTableSearch")?.value||"").toLowerCase();
 const rows=state.playlists.filter(p=>{const parts=playlistParts(p);return (p.name+" "+parts.host+" "+parts.mac+" "+parts.username).toLowerCase().includes(q);}).map(p=>{const parts=playlistParts(p);return [esc(p.name),esc(parts.type),esc(parts.host||"—"),esc(parts.mac||parts.username||"—"),esc(formatPlaylistExpiry(p)),`<div class="table-actions"><button class="btn" data-edit-playlist="${p.id}">Edit</button><button class="btn" data-delete-playlist="${p.id}">Delete</button></div>`];});
 $("playlistTable").innerHTML=table(["Name","Type","Host","MAC / Username","Expiration","Actions"],rows);
}
function renderDevices(){
 const q=($("deviceTableSearch")?.value||"").toLowerCase();
 const inactive=$("deviceInactiveFilter")?.value||"all";
 const cutoff=Date.now()-(Number(inactive)||0)*86400000;
 const filtered=state.devices.filter(d=>{
  const matches=(d.mac+" "+d.name+" "+(d.last_model||"")).toLowerCase().includes(q);
  const seen=d.last_seen?new Date(d.last_seen).getTime():0;
  const isInactive=inactive==="all"||!seen||seen<cutoff;
  return matches&&isInactive;
 });
 const rows=filtered.map(d=>{
  const seen=d.last_seen?new Date(d.last_seen).toLocaleString():"Never connected";
  const checked=state.selectedDeviceIds.has(String(d.id))?"checked":"";
  return [`<input class="device-row-check" type="checkbox" data-device-select="${d.id}" ${checked} aria-label="Select ${esc(d.mac)}">`,esc(d.mac),esc(d.name),esc(d.last_model||"—"),esc(seen),Number(d.enabled)?"<span class=pill>Enabled</span>":"<span class=pill>Disabled</span>",`<div class="table-actions"><button class="btn" data-device-details="${d.id}">Details</button><button class="btn" data-toggle-device="${d.id}">${Number(d.enabled)?"Disable":"Enable"}</button><button class="btn" data-delete-device="${d.id}">Delete</button></div>`];
 });
 $("deviceTable").innerHTML=table(["","MAC","Name","Model","Last connection","Status","Actions"],rows);
 const all=filtered.length>0&&filtered.every(d=>state.selectedDeviceIds.has(String(d.id)));
 const some=filtered.some(d=>state.selectedDeviceIds.has(String(d.id)));
 const allBox=$("selectAllDevices");if(allBox){allBox.checked=all;allBox.indeterminate=!all&&some;}
 $("deviceSelectionCount").textContent=`${state.selectedDeviceIds.size} selected`;
 ["bulkEnableDevices","bulkDisableDevices","bulkDeleteDevices"].forEach(id=>{const b=$(id);if(b)b.disabled=!state.selectedDeviceIds.size;});
}
async function showDeviceAssignments(id){
 const d=state.devices.find(x=>String(x.id)===String(id));if(!d)return;
 openModal(`Playlist history — ${d.mac}`,"<div class='empty'>Loading assignment history…</div>");
 try{
  const {data,error}=await state.sb.from("playlist_assignment_history").select("device_mac,playlist_id,action,changed_at").eq("device_mac",d.mac).order("changed_at",{ascending:false}).limit(500);
  if(error)throw error;
  const lookup=new Map(state.playlists.map(p=>[String(p.id),p]));
  const rows=(data||[]).map(a=>{const pl=lookup.get(String(a.playlist_id));return [esc(pl?.name||("Playlist #"+a.playlist_id)),esc(a.action==="unassigned"?"Unassigned":"Assigned"),esc(a.changed_at?new Date(a.changed_at).toLocaleString():"—")];});
  $("modalBody").innerHTML=table(["Playlist","Action","Date"],rows);
 }catch(e){$("modalBody").innerHTML=`<p class="error">Could not load playlist history: ${esc(e.message)}. Apply the included SQL migration in Supabase first.</p>`;}
}
async function showDeviceDetails(id){
 const d=state.devices.find(x=>String(x.id)===String(id));if(!d)return;
 const server=state.servers.find(x=>String(x.id)===String(d.server_id));
 const assigned=state.assignments.filter(a=>String(a.device_mac).toUpperCase()===String(d.mac).toUpperCase());
 const playlistMap=new Map(state.playlists.map(p=>[String(p.id),p]));
 const assignedRows=assigned.map(a=>{const p=playlistMap.get(String(a.playlist_id));const parts=p?playlistParts(p):null;return [esc(p?.name||("Playlist #"+a.playlist_id)),esc(parts?.type||"—"),esc(parts?.host||"—"),esc(a.assigned_at?new Date(a.assigned_at).toLocaleString():"—")];});
 const title=`Device details — ${d.mac}`;
 openModal(title,`<div class="device-detail-grid">
  <div><small>Device name</small><strong>${esc(d.name||"—")}</strong></div>
  <div><small>MAC address</small><strong>${esc(d.mac)}</strong></div>
  <div><small>Authorization</small><strong class="${Number(d.enabled)?"detail-enabled":"detail-disabled"}">${Number(d.enabled)?"Enabled":"Disabled"}</strong></div>
  <div><small>Device model</small><strong>${esc(d.last_model||"—")}</strong></div>
  <div><small>App version</small><strong>${esc(d.last_appver||"—")}</strong></div>
  <div><small>Last seen</small><strong>${esc(d.last_seen?new Date(d.last_seen).toLocaleString():"Never connected")}</strong></div>
  <div><small>Registered</small><strong>${esc(d.created_at?new Date(d.created_at).toLocaleString():"—")}</strong></div>
  <div><small>Linked server</small><strong>${esc(server?.name||"No server")}</strong><small>${esc(server?.url||"")}</small></div>
 </div>
 <div class="detail-section"><h3>Current playlists (${assigned.length})</h3><div class="table-wrap">${table(["Playlist","Type","Host","Assigned"],assignedRows)}</div></div>
 <div class="detail-section"><h3>Assignment history</h3><div id="deviceDetailHistory" class="table-wrap"><div class="empty">Loading history…</div></div></div>`);
 try{
  const {data,error}=await state.sb.from("playlist_assignment_history").select("device_mac,playlist_id,action,changed_at").eq("device_mac",d.mac).order("changed_at",{ascending:false}).limit(100);
  if(error)throw error;
  const historyRows=(data||[]).map(a=>[esc(playlistMap.get(String(a.playlist_id))?.name||("Playlist #"+a.playlist_id)),esc(a.action||"—"),esc(a.changed_at?new Date(a.changed_at).toLocaleString():"—")]);
  if($("modalTitle").textContent===title&&!$("modal").classList.contains("hidden"))$("deviceDetailHistory").innerHTML=table(["Playlist","Action","Date"],historyRows);
 }catch(e){if($("modalTitle").textContent===title&&!$("modal").classList.contains("hidden"))$("deviceDetailHistory").innerHTML=`<p class="muted">Assignment history could not be loaded: ${esc(e.message)}</p>`;}
}
async function bulkDeviceAction(action){
 const ids=[...state.selectedDeviceIds];if(!ids.length)return;
 const chosen=state.devices.filter(d=>ids.includes(String(d.id)));
 if(action==="delete"){
  if(!confirm(`Delete ${chosen.length} selected device(s) and all their playlist assignments? This cannot be undone.`))return;
  try{
   const macs=chosen.map(d=>d.mac);
   const a=await state.sb.from("playlist_assignments").delete().in("device_mac",macs);if(a.error)throw a.error;
   const r=await state.sb.from("mac_devices").delete().in("id",ids);if(r.error)throw r.error;
  }catch(e){fail(e);return;}
 }else{
  const label=action==="enable"?"enable":"disable";
  if(!confirm(`${label[0].toUpperCase()+label.slice(1)} ${chosen.length} selected device(s)?`))return;
  try{const {error}=await state.sb.from("mac_devices").update({enabled:action==="enable"?1:0}).in("id",ids);if(error)throw error;}
  catch(e){fail(e);return;}
 }
 state.selectedDeviceIds.clear();await loadData();msg(action==="delete"?`${chosen.length} device(s) deleted.`:`${chosen.length} device(s) ${action}d.`);
}
function renderServers(){
 const rows=state.servers.map(s=>[esc(s.name),esc(s.url),esc(s.type),Number(s.enabled)?"<span class=pill>Enabled</span>":"Disabled",`<div class="table-actions"><button class="btn" data-edit-server="${s.id}">Edit</button><button class="btn" data-toggle-server="${s.id}">${Number(s.enabled)?"Disable":"Enable"}</button><button class="btn" data-delete-server="${s.id}">Delete</button></div>`]);
 $("serverTable").innerHTML=table(["Name","URL","Type","Status","Actions"],rows);
}
function assignmentKey(a){return String(a.device_mac)+"::"+String(a.playlist_id);}
function renderAssignments(){
 if(!$("assignPlaylists"))return;
 const pq=($("playlistSearch")?.value||"").toLowerCase(),dq=($("deviceSearch")?.value||"").toLowerCase();
 const visiblePlaylists=state.playlists.filter(p=>p.name.toLowerCase().includes(pq));
 const visibleDevices=state.devices.filter(d=>(d.mac+" "+d.name).toLowerCase().includes(dq));
 $("assignPlaylists").innerHTML=visiblePlaylists.map(p=>`<label class="check-row"><input type="checkbox" name="ap" value="${p.id}" ${state.selectedPlaylistIds.has(String(p.id))?"checked":""}><span>${esc(p.name)} <small class="muted">· Expires: ${esc(formatPlaylistExpiry(p))}</small></span></label>`).join("")||'<div class=empty>No playlists</div>';
 $("assignDevices").innerHTML=visibleDevices.map(d=>`<label class="check-row"><input type="checkbox" name="ad" value="${esc(d.mac)}" ${state.selectedDeviceMacs.has(d.mac)?"checked":""}><span>${esc(d.name||d.mac)} <small>${esc(d.mac)}</small></span></label>`).join("")||'<div class=empty>No devices</div>';
 const allVisible=visiblePlaylists.length>0&&visiblePlaylists.every(p=>state.selectedPlaylistIds.has(String(p.id)));
 const selectAll=$("selectAllPlaylists");if(selectAll){selectAll.checked=allVisible;selectAll.indeterminate=!allVisible&&visiblePlaylists.some(p=>state.selectedPlaylistIds.has(String(p.id)));}
 const np=state.selectedPlaylistIds.size,nd=state.selectedDeviceMacs.size;
 $("assignmentCount").textContent=`${np} playlists × ${nd} devices = ${np*nd} possible links`;
 const playlistLookup=new Map(state.playlists.map(p=>[String(p.id),p]));
 const aq=($("currentAssignmentSearch")?.value||"").trim().toLowerCase();
 const filteredAssignments=state.assignments.filter(a=>String(a.device_mac||"").toLowerC
