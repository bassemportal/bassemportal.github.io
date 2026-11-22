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
 const hostDown=result?.online===false;
 const macNotWorking=result?.account_result==="MAC_NOT_WORKING";
 const modalTitle=hostDown?"Stalker host appears down":macNotWorking?"Stalker MAC is not working":"Stalker account could not be verified";
 const explanation=hostDown
  ?"The Stalker host did not respond successfully (or its handshake failed). It may be down or unreachable."
  :macNotWorking
   ?"The host responded, but the account information did not contain a phone/expiry value. This MAC is being treated as not working."
   :"The Stalker host/account check did not return a verified online result.";
 return new Promise(resolve=>{
  playlistCheckResolver=resolve;
  openModal(modalTitle,`
   <div class="form-grid">
    <p class="span-2">${explanation} Playlist: <b>${esc(name)}</b>.</p>
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
 const filteredAssignments=state.assignments.filter(a=>String(a.device_mac||"").toLowerCase().includes(aq));
 const rows=filteredAssignments.map(a=>{
  const key=assignmentKey(a),checked=state.selectedAssignmentKeys.has(key),p=playlistLookup.get(String(a.playlist_id));
  return [
   `<input type="checkbox" class="assignment-row-check" data-assignment-key="${esc(key)}" ${checked?"checked":""} aria-label="Select ${esc(a.device_mac)} playlist assignment">`,
   esc(a.device_mac),
   esc(p?.name||("#"+a.playlist_id)),
   esc(p?formatPlaylistExpiry(p):"—"),
   esc(a.assigned_at?new Date(a.assigned_at).toLocaleString():"—"),
   `<button class="btn" data-unassign-device="${esc(a.device_mac)}" data-unassign-playlist="${Number(a.playlist_id)}">Unassign</button>`
  ];
 });
 $("assignmentTable").innerHTML=table(["","Device MAC","Playlist","Expiration","Assigned","Action"],rows);
 const allSelected=filteredAssignments.length>0&&filteredAssignments.every(a=>state.selectedAssignmentKeys.has(assignmentKey(a)));
 const someSelected=filteredAssignments.some(a=>state.selectedAssignmentKeys.has(assignmentKey(a)));
 const allCtl=$("selectAllAssignments");if(allCtl){allCtl.checked=allSelected;allCtl.indeterminate=!allSelected&&someSelected;}
 const selectedCount=state.selectedAssignmentKeys.size;
 $("currentAssignmentSelectionCount").textContent=`${selectedCount} selected`;
 $("bulkUnassignAssignments").disabled=selectedCount===0;
}
async function bulkUnassignAssignments(){
 const selected=state.assignments.filter(a=>state.selectedAssignmentKeys.has(assignmentKey(a)));
 if(!selected.length)return;
 const byMac=new Map();
 selected.forEach(a=>{const mac=String(a.device_mac);if(!byMac.has(mac))byMac.set(mac,[]);byMac.get(mac).push(a.playlist_id);});
 const summary=[...byMac.entries()].map(([mac,ids])=>`${mac}: ${ids.length} playlist(s)`).join("\\n");
 if(!confirm(`Unassign ${selected.length} selected playlist assignment(s)?\\n\\n${summary}\\n\\nThe playlists and devices will not be deleted.`))return;
 try{
  for(const [mac,ids] of byMac){
   const {error}=await state.sb.from("playlist_assignments").delete().eq("device_mac",mac).in("playlist_id",[...new Set(ids)]);
   if(error)throw error;
  }
  state.selectedAssignmentKeys.clear();
  await loadData();
  msg(`${selected.length} playlist assignment(s) unassigned. Playlists and devices were kept.`);
 }catch(e){fail(e);}
}
async function unassignPlaylist(deviceMac, playlistId){
 const playlist=state.playlists.find(p=>String(p.id)===String(playlistId));
 const label=playlist?.name||("Playlist #"+playlistId);
 if(!confirm(`Unassign "${label}" from device ${deviceMac}? The playlist itself will remain in the dashboard, and assignments on other devices will not change.`))return;
 try{
  const {error}=await state.sb.from("playlist_assignments").delete().eq("device_mac",deviceMac).eq("playlist_id",playlistId);
  if(error)throw error;
  await loadData();
  msg(`"${label}" was unassigned from ${deviceMac}. The playlist was not deleted.`);
 }catch(e){fail(e);}
}
function refreshSelectionCount(){const np=state.selectedPlaylistIds.size,nd=state.selectedDeviceMacs.size;$("assignmentCount").textContent=`${np} playlists × ${nd} devices = ${np*nd} possible links`;const visible=state.playlists.filter(p=>p.name.toLowerCase().includes(($("playlistSearch").value||"").toLowerCase()));const all=visible.length>0&&visible.every(p=>state.selectedPlaylistIds.has(String(p.id)));const ctl=$("selectAllPlaylists");if(ctl){ctl.checked=all;ctl.indeterminate=!all&&visible.some(p=>state.selectedPlaylistIds.has(String(p.id)));}}
function openModal(title,html){$("modalTitle").textContent=title;$("modalBody").innerHTML=html;$("modal").classList.remove("hidden");}
function closeModal(){if(playlistCheckResolver){const resolve=playlistCheckResolver;playlistCheckResolver=null;resolve(false);} $("modal").classList.add("hidden");}
function serverRows(type){return state.servers.filter(s=>Number(s.enabled)!==0&&String(s.type||"").toLowerCase()===type);}
function renderServerPicker(type){
 const search=$(type+"ServerSearch"),results=$(type+"ServerResults"),selected=$(type+"ServerSelected"),hidden=$(type+"ServerId");
 if(!search||!results)return;
 const chosen=state.selectedServers[type];
 if(chosen){hidden.value=String(chosen.id);selected.innerHTML=`Selected: <b>${esc(chosen.name)}</b> — ${esc(chosen.url)} <button type="button" class="link-btn" data-clear-server="${type}">Change</button>`;}
 else{hidden.value="";selected.textContent="No server selected";}
 const q=search.value.trim().toLowerCase();
 const matches=serverRows(type).filter(x=>(String(x.name)+" "+String(x.url)).toLowerCase().includes(q)).slice(0,100);
 results.innerHTML=matches.map(x=>`<button type="button" class="server-picker-option ${chosen&&String(chosen.id)===String(x.id)?"selected":""}" data-pick-server="${type}" data-server-id="${esc(x.id)}"><b>${esc(x.name)}</b><small>${esc(x.url)}</small></button>`).join("")||'<div class="empty">No matching '+type+' servers</div>';
}
function getPlaylistHost(type){
 const custom=$(type+"CustomHost").value.trim();
 const saved=state.selectedServers[type];
 if(!custom&&saved&&!serverRows(type).some(x=>String(x.id)===String(saved.id)))throw Error("The selected saved server is no longer available. Choose another server or enter a one-time host URL.");
 const raw=custom||String(saved?.url||"").trim();
 if(!raw)throw Error("Choose a saved "+type+" server or enter a one-time host URL.");
 let parsed;try{parsed=new URL(raw);}catch{throw Error("Enter a valid "+type+" host URL.");}
 if(!["http:","https:"].includes(parsed.protocol)||!parsed.hostname)throw Error("The host must use HTTP or HTTPS.");
 return {url:raw,name:custom?"One-time host":String(saved?.name||raw)};
}
function setPlaylistMode(mode){state.playlistMode=mode;const stalker=mode==="stalker";$("stalkerFields").classList.toggle("hidden",!stalker);$("xtreamFields").classList.toggle("hidden",stalker);$("stalkerModeBtn").classList.toggle("primary",stalker);$("xtreamModeBtn").classList.toggle("primary",!stalker);$("createPlaylistBtn").textContent=stalker?"Create Stalker playlists":"Create Xtream playlist";$("playlistMacs").required=stalker;$("xtreamUsername").required=!stalker;$("xtreamPassword").required=!stalker;updatePreview();}
async function testPlaylistHost(type){
 const button=$(type==="stalker"?"testStalkerHostBtn":"testXtreamHostBtn");
 const status=$(type+"HostTestStatus");
 try{
  const host=getPlaylistHost(type);
  const url=new URL(host.url);
  if(!["http:","https:"].includes(url.protocol))throw Error("Only HTTP and HTTPS hosts can be tested.");
  button.disabled=true;button.textContent="Testing…";status.className="host-test-status muted";status.textContent="Checking whether the host responds…";
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),10000);
  try{
   // no-cors allows a basic reachability check without requiring the IPTV host to enable browser CORS.
   // The opaque response deliberately does not reveal the remote HTTP status or validate credentials.
   await fetch(url.href,{method:"GET",mode:"no-cors",cache:"no-store",redirect:"follow",credentials:"omit",signal:controller.signal});
   status.className="host-test-status host-test-ok";
   status.textContent="Host responded. HTTP status and account credentials cannot be verified by this browser check.";
  }finally{clearTimeout(timeout);}
 }catch(e){
  status.className="host-test-status host-test-warn";
  status.textContent=e?.name==="AbortError"?"Timed out after 10 seconds. Host may be slow or unreachable.":(e?.message||"Request blocked by browser or network. This does not prove the host is offline.");
 }finally{button.disabled=false;button.textContent="Test host";}
}
async function createPlaylists(e){
 e.preventDefault();
 try{
  const mode=state.playlistMode,server=getPlaylistHost(mode);
  const devices=selectedValues($("playlistDevices"));
  const existing=new Set(state.playlists.map(p=>p.name));
  const rows=[];
  if(mode==="stalker"){
   const macs=[...new Set($("playlistMacs").value.split(/\r?\n/).map(normalizeMac).filter(Boolean))];
   if(!macs.length)throw Error("Enter at least one MAC address.");
   const invalid=macs.filter(m=>!validMac(m));if(invalid.length)throw Error("Invalid MAC address(es): "+invalid.join(", "));
   const host=hostIdentifier(server.url);
   const pending=[];
   // Verify every MAC before inserting anything. Cancel on any failed verification
   // leaves the entire batch uninserted.
   for(const mac of macs){
    const name=`${host}_${mac}`;
    if(existing.has(name))continue;
    existing.add(name);
    let checkResult;
    try{
     checkResult=await callStalkerCheck(server.url,mac);
    }catch(error){
     checkResult={online:false,authenticated:false,error:error?.message||String(error),stage:"request"};
    }
    const verified=checkResult?.online===true&&checkResult?.authenticated===true&&checkResult?.account_result==="ACCOUNT_INFO_RECEIVED";
    let expirationDate=null;
    if(verified){
     const candidate=Number(checkResult.expiration_timestamp);
     if(Number.isFinite(candidate)&&candidate>0)expirationDate=Math.floor(candidate);
    }else{
     const addAnyway=await confirmAddUnverifiedPlaylist(name,checkResult);
     if(!addAnyway)throw Error("Playlist insertion cancelled. No playlists were inserted.");
     expirationDate=null;
    }
    pending.push({name,url:playlistPayload(server,mac),metadata:{...META,is_expanded:0,is_expanded_in_movies:0,is_expanded_in_series:0,expiration_date:expirationDate}});
   }
   rows.push(...pending);
  }else{
   const username=$("xtreamUsername").value.trim(),password=$("xtreamPassword").value;
   if(!username||!password)throw Error("Enter both Xtream username and password.");
   const host=String(server.url||"").trim();if(!/^https?:\/\//i.test(host))throw Error("The selected Xtream server must have an HTTP or HTTPS host URL.");
   const name=`${hostIdentifier(host)}_${username}`;
   if(existing.has(name))throw Error("A playlist named "+name+" already exists.");
   const url="xc:"+JSON.stringify({h:host,u:username,p:password,o:"ts"});
   const metadata={...META,is_expanded:0,is_expanded_in_movies:0,is_expanded_in_series:0,stalker_token:null};
   rows.push({name,url,metadata});
  }
  if(!rows.length)throw Error("All generated playlist names already exist.");
  const {data,error}=await state.sb.from("playlists").insert(rows).select("id,name");
  if(error)throw error;
  let assigned=0,assignError=null;
  if(devices.length){
   const links=[];for(const p of data)for(const mac of devices)links.push({device_mac:mac,playlist_id:p.id});
   const r=await state.sb.from("playlist_assignments").upsert(links,{onConflict:"device_mac,playlist_id",ignoreDuplicates:true});
   assignError=r.error;assigned=links.length;
  }
  if(mode==="stalker")$("playlistMacs").value="";
  else{$("xtreamUsername").value="";$("xtreamPassword").value="";}
  $(mode+"CustomHost").value="";
  [...$("playlistDevices").options].forEach(o=>o.selected=false);
  await loadData();
  msg(`${data.length} ${mode} playlist(s) created${devices.length?`. Assignment links processed: ${assigned}.`:"."}${assignError?" Assignment error: "+assignError.message:""}`,!!assignError);
 }catch(e){
  fail(e);
 }
}
async function callNewDevicesApi(payload={}){
 const {data,error}=await state.sb.auth.getSession();if(error)throw error;
 const token=data.session?.access_token;if(!token)throw Error("Your session expired. Please sign in again.");
 const response=await fetch(`${cfg.SUPABASE_URL}/functions/v1/admin-new-devices`,{
  method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`,"apikey":cfg.SUPABASE_ANON_KEY},body:JSON.stringify(payload)
 });
 let result={};try{result=await response.json();}catch{}
 if(!response.ok||result.success===false)throw Error(result.error||`New Devices API failed (${response.status}).`);
 return result;
}
async function loadNewDevices(){
 $("newDevicesTable").innerHTML='<div class="empty">Loading new devices…</div>';
 const result=await callNewDevicesApi({action:"list"});state.newDevices=result.devices||[];renderNewDevices();
}
function renderNewDevices(){
 const rows=state.newDevices.map((d,i)=>[
  `<strong>${esc(d.mac)}</strong>`,esc(d.last_request?new Date(d.last_request).toLocaleString():"—"),
  `<button class="btn primary" type="button" data-register-new-device="${i}">Register</button>`
 ]);
 $("newDevicesTable").innerHTML=table(["MAC address","Last request","Action"],rows);
}
function openRegisterNewDevice(index){
 const d=state.newDevices[index];if(!d)return;
 const serverOptions='<option value="">No server</option>'+state.servers.map(x=>`<option value="${esc(x.id)}">${esc(x.name)} — ${esc(x.url)}</option>`).join("");
 openModal("Register new device",`<form id="registerNewDeviceForm" class="form-grid">
  <label class="span-2">MAC address<input id="newRegMac" value="${esc(d.mac)}" readonly required></label>
  <label class="span-2">Name<input id="newRegName" placeholder="Device name"></label>
  <label class="span-2">Server<select id="newRegServer">${serverOptions}</select></label>
  <label>Username<input id="newRegUsername" autocomplete="off"></label><label>Password<input id="newRegPassword" type="text" autocomplete="off"></label>
  <label>App version<input id="newRegAppver"></label><label>Device model<input id="newRegModel"></label>
  <p id="newRegError" class="error span-2" aria-live="polite"></p>
  <div class="span-2"><button id="newRegSubmit" class="btn primary" type="submit">Register Device</button></div>
 </form>`);
 $("registerNewDeviceForm").onsubmit=async e=>{
  e.preventDefault();const button=$("newRegSubmit"),errorEl=$("newRegError");button.disabled=true;errorEl.textContent="Registering device…";
  try{
   const rawMac=$("newRegMac").value;
   await callNewDevicesApi({action:"register",mac:rawMac,name:$("newRegName").value.trim(),server_id:$("newRegServer").value||null,username:$("newRegUsername").value,password:$("newRegPassword").value,last_appver:$("newRegAppver").value.trim(),last_model:$("newRegModel").value.trim()});
   state.newDevices=state.newDevices.filter(x=>normalizeMac(x.mac)!==normalizeMac(rawMac));closeModal();renderNewDevices();
   try{await loadData();msg(`Device ${rawMac} registered successfully.`);}catch(refreshError){msg(`Device ${rawMac} was registered, but the Devices page could not refresh: ${refreshError.message}`,true);}
  }catch(err){errorEl.textContent=err?.message||String(err);}
  finally{button.disabled=false;}
 };
}

async function addDevice(e){
 e.preventDefault();try{const mac=normalizeMac($("deviceMac").value);if(!validMac(mac))throw Error("Enter a valid 12-character MAC address.");
 const row={mac};const name=$("deviceName").value.trim(),server=$("deviceServer").value,username=$("deviceUsername").value,password=$("devicePassword").value,appver=$("deviceAppver").value.trim(),model=$("deviceModel").value.trim();
 if(name)row.name=name;if(server)row.server_id=Number(server);if(username)row.username=username;if(password)row.password=password;if(appver)row.last_appver=appver;if(model)row.last_model=model;
 const {error}=await state.sb.from("mac_devices").insert(row);if(error)throw error;$("deviceForm").reset();await loadData();msg("Device added.");
 }catch(e){fail(e);}
}
async function assignBulk(){try{const ps=[...state.selectedPlaylistIds].map(Number),ds=[...state.selectedDeviceMacs];if(!ps.length||!ds.length)throw Error("Select at least one playlist and one device.");
 const links=[];ps.forEach(p=>ds.forEach(d=>links.push({device_mac:d,playlist_id:p})));
 const {error}=await state.sb.from("playlist_assignments").upsert(links,{onConflict:"device_mac,playlist_id",ignoreDuplicates:true});if(error)throw error;state.selectedPlaylistIds.clear();state.selectedDeviceMacs.clear();state.playlistAnchor=null;await loadData();msg(`Processed ${links.length} assignment combination(s). Existing assignments were left unchanged.`);
 }catch(e){fail(e);}}
async function deleteDevice(id){const d=state.devices.find(x=>String(x.id)===String(id));if(!d||!confirm(`Delete device ${d.mac}? Its playlist assignments will also be deleted.`))return;try{
 let r=await state.sb.from("playlist_assignments").delete().eq("device_mac",d.mac);if(r.error)throw r.error;r=await state.sb.from("mac_devices").delete().eq("id",id);if(r.error)throw r.error;await loadData();msg("Device and its assignments deleted.");
 }catch(e){fail(e);}}
async function deletePlaylist(id){const p=state.playlists.find(x=>String(x.id)===String(id));if(!p||!confirm(`Delete playlist "${p.name}"?`))return;try{const {error}=await state.sb.from("playlists").delete().eq("id",id);if(error)throw error;await loadData();msg("Playlist deleted.");}catch(e){fail(e);}}
function editPlaylist(id){
 const p=state.playlists.find(x=>String(x.id)===String(id));if(!p)return;const parts=playlistParts(p);
 if(parts.type==="xtream"){
  openModal("Edit Xtream playlist",`<form id="editPlaylistForm" class="form-grid"><label class="span-2">Name<input id="editPName" required value="${esc(p.name)}"></label><label class="span-2">Host<input id="editPHost" required value="${esc(parts.host)}"></label><label>Username<input id="editPUser" required value="${esc(parts.username)}"></label><label>Password<input id="editPPass" type="password" required value="${esc(parts.password)}"></label><p class="muted span-2">The Xtream option remains set to ts. Playlist metadata is preserved.</p><div class="span-2"><button class="btn primary">Save changes</button></div></form>`);
  $("editPlaylistForm").onsubmit=async e=>{e.preventDefault();try{const obj={...parts.obj,h:$("editPHost").value.trim(),u:$("editPUser").value.trim(),p:$("editPPass").value,o:"ts"};const {error}=await state.sb.from("playlists").update({name:$("editPName").value.trim(),url:"xc:"+JSON.stringify(obj)}).eq("id",id);if(error)throw error;closeModal();await loadData();msg("Xtream playlist updated.");}catch(e){fail(e);}};return;
 }
 openModal("Edit Stalker playlist",`<form id="editPlaylistForm" class="form-grid"><label class="span-2">Name<input id="editPName" required value="${esc(p.name)}"></label><label class="span-2">Host<input id="editPHost" required value="${esc(parts.host)}"></label><label class="span-2">MAC<input id="editPMac" required value="${esc(parts.mac)}" maxlength="17"></label><p class="muted span-2">Only name, host and MAC are editable here. Other playlist configuration is preserved.</p><div class="span-2"><button class="btn primary">Save changes</button></div></form>`);
 $("editPlaylistForm").onsubmit=async e=>{e.preventDefault();try{if(!parts.obj)throw Error("Playlist data format could not be parsed; refusing to overwrite it.");const mac=normalizeMac($("editPMac").value);if(!validMac(mac))throw Error("Enter a valid 12-character MAC address.");parts.obj.s=$("editPHost").value.trim();parts.obj.m=colonMac(mac);const {error}=await state.sb.from("playlists").update({name:$("editPName").value.trim(),url:"s:"+JSON.stringify(parts.obj)}).eq("id",id);if(error)throw error;closeModal();await loadData();msg("Stalker playlist updated.");}catch(e){fail(e);}};
}
function editServer(id){const s=state.servers.find(x=>String(x.id)===String(id));if(!s)return;$("serverId").value=s.id;$("serverName").value=s.name;$("serverUrl").value=s.url;$("serverType").value=s.type;$("serverSort").value=s.sort_order;$("serverSubmit").textContent="Save server";$("serverCancel").classList.remove("hidden");showPage("servers");}
async function saveServer(e){e.preventDefault();try{const id=$("serverId").value;const row={name:$("serverName").value.trim(),url:$("serverUrl").value.trim(),type:$("serverType").value,sort_order:Number($("serverSort").value||0)};const r=id?await state.sb.from("servers").update(row).eq("id",id):await state.sb.from("servers").insert(row);if(r.error)throw r.error;$("serverForm").reset();$("serverId").value="";$("serverSort").value="0";$("serverSubmit").textContent="Add server";$("serverCancel").classList.add("hidden");await loadData();msg(id?"Server updated.":"Server added.");}catch(e){fail(e);}}
async function actionClick(e){
 const t=e.target.closest("button");if(!t)return;
 if(t.dataset.playlistCheckChoice){finishPlaylistCheck(t.dataset.playlistCheckChoice==="add");return;}
 if(t.dataset.registerNewDevice!==undefined)openRegisterNewDevice(Number(t.dataset.registerNewDevice));
 if(t.dataset.unassignDevice&&t.dataset.unassignPlaylist)await unassignPlaylist(t.dataset.unassignDevice,t.dataset.unassignPlaylist);
 if(t.dataset.editPlaylist)editPlaylist(t.dataset.editPlaylist);
 if(t.dataset.deletePlaylist)deletePlaylist(t.dataset.deletePlaylist);
 if(t.dataset.deleteDevice)deleteDevice(t.dataset.deleteDevice);
 if(t.dataset.deviceDetails)showDeviceDetails(t.dataset.deviceDetails);
 if(t.dataset.deviceAssignments)showDeviceAssignments(t.dataset.deviceAssignments);
 if(t.dataset.toggleDevice){const d=state.devices.find(x=>String(x.id)===t.dataset.toggleDevice);try{const {error}=await state.sb.from("mac_devices").update({enabled:Number(d.enabled)?0:1}).eq("id",d.id);if(error)throw error;await loadData();}catch(e){fail(e);}}
 if(t.dataset.editServer)editServer(t.dataset.editServer);
 if(t.dataset.toggleServer){const s=state.servers.find(x=>String(x.id)===t.dataset.toggleServer);try{const {error}=await state.sb.from("servers").update({enabled:Number(s.enabled)?0:1}).eq("id",s.id);if(error)throw error;await loadData();}catch(e){fail(e);}}
 if(t.dataset.deleteServer){const s=state.servers.find(x=>String(x.id)===t.dataset.deleteServer);if(s&&confirm(`Delete server "${s.name}"? Devices linked to it will have server_id set to null.`)){try{const {error}=await state.sb.from("servers").delete().eq("id",s.id);if(error)throw error;await loadData();msg("Server deleted.");}catch(e){fail(e);}}}
}
function showAuthView(id){
 ["loginForm","registerForm","resetView","newPasswordView"].forEach(x=>$(x).classList.toggle("hidden",x!==id));
 $("loginError").textContent="";$("registerMessage").textContent="";$("resetMessage").textContent="";$("newPasswordMessage").textContent="";
}
function authMessage(id,text,bad=false){$(id).textContent=text;$(id).classList.toggle("success-text",!bad);}
async function getMyProfile(){
 const {data,error}=await state.sb.from("dashboard_users").select("user_id,email,full_name,role,status").eq("user_id",state.user.id).maybeSingle();
 if(error)throw error;
 return data;
}
async function acceptSession(user, freshLogin = false){
 state.user=user;
 let profile;
 try{profile=await getMyProfile();}catch(e){await state.sb.auth.signOut();throw e;}
 if(!profile){await state.sb.auth.signOut();throw Error("Your administrator profile was not found. Contact the Super Admin.");}
 if(profile.status!=="active"){
   const statusText=profile.status==="pending"?"Your registration is awaiting Super Admin approval.":profile.status==="rejected"?"Your administrator registration was rejected.":"Your administrator account is disabled. Contact the Super Admin.";
   await state.sb.auth.signOut();
   $("loginView").classList.remove("hidden");$("appView").classList.add("hidden");showAuthView("loginForm");$("loginError").textContent=statusText;
   return false;
 }
 state.profile=profile;
 if (freshLogin) {
  state.lastActivity = Date.now();
  try {
    localStorage.setItem("bassemtv_last_activity", String(state.lastActivity));
  } catch {}
}
 await enterApp();
 return true;
}
async function loadDashboardUsers(){
 if(state.profile?.role!=="superadmin")throw Error("Super Admin access required.");
 const {data,error}=await state.sb.from("dashboard_users").select("user_id,email,full_name,role,status,created_at,approved_at").order("created_at",{ascending:false});
 if(error)throw error;state.dashboardUsers=data||[];renderDashboardUsers();
}
function renderDashboardUsers(){
 const rows=state.dashboardUsers.map(u=>{
   const status=esc(u.status);let actions="—";
   if(u.role!=="superadmin"){
     const btn=[];
     if(u.status!=="active")btn.push(`<button class="btn" data-user-status="active" data-user-id="${u.user_id}">Approve</button>`);
     if(u.status!=="disabled")btn.push(`<button class="btn" data-user-status="disabled" data-user-id="${u.user_id}">Disable</button>`);
     if(u.status!=="rejected")btn.push(`<button class="btn" data-user-status="rejected" data-user-id="${u.user_id}">Reject</button>`);
     actions=`<div class="table-actions">${btn.join("")}</div>`;
   }
   return [esc(u.full_name||"—"),esc(u.email),esc(u.role),`<span class="pill">${status}</span>`,new Date(u.created_at).toLocaleDateString(),actions];
 });
 $("usersTable").innerHTML=table(["Name","Email","Role","Status","Registered","Actions"],rows);
}

async function loadLoginHistory(){
 if(state.profile?.role!=="superadmin")throw Error("Super Admin access required.");
 const {data:sessionData,error:sessionError}=await state.sb.auth.getSession();
 if(sessionError)throw sessionError;
 const token=sessionData?.session?.access_token;
 if(!token)throw Error("Your session expired. Please sign in again.");
 const response=await fetch(`${cfg.SUPABASE_URL}/functions/v1/admin_login_history`,{
  method:"GET",headers:{"Authorization":`Bearer ${token}`,"apikey":cfg.SUPABASE_ANON_KEY||cfg.SUPABASE_PUBLISHABLE_KEY||cfg.ANON_KEY||""}
 });
 let payload={};try{payload=await response.json();}catch{}
 if(!response.ok||payload.success===false)throw Error(payload.message||`Could not load login history (${response.status}).`);
 state.loginHistory=Array.isArray(payload.records)?payload.records:[];
 renderLoginHistory();
}
function renderLoginHistory(){
 const status=$("loginHistoryStatus")?.value||"all";
 const query=($("loginHistorySearch")?.value||"").trim().toLowerCase();
 const filtered=state.loginHistory.filter(r=>{
  const statusOk=status==="all"||r.status===status;
  const text=`${r.email||""} ${r.ip_address||""}`.toLowerCase();
  return statusOk&&text.includes(query);
 });
 const rows=filtered.map(r=>{
  const when=r.created_at?new Date(r.created_at).toLocaleString():"—";
  const result=r.status==="success"?"Success":r.status==="failure"?"Failed":"Blocked";
  const reason=r.reason==="invalid_credentials"?"Incorrect credentials":r.reason==="rate_limited"?"Rate limit":r.reason==="dashboard_account_inactive_or_missing"?"Inactive / unauthorized account":r.reason||"—";
  return [esc(when),esc(r.email||"—"),`<span class="pill login-status-${esc(r.status)}">${result}</span>`,esc(r.ip_address||"Unknown"),esc(reason),esc(r.event_type||"password_login")];
 });
 $("loginHistoryTable").innerHTML=table(["Date & time","Email","Result","IP address","Reason","Method"],rows);
 $("loginHistoryMeta").textContent=`Showing ${filtered.length} of ${state.loginHistory.length} records (latest 300 loaded).`;
}

async function updateDashboardUser(id,status){
 if(state.profile?.role!=="superadmin")throw Error("Super Admin access required.");
 const {error}=await state.sb.rpc("manage_dashboard_user",{p_user_id:id,p_status:status});
 if(error)throw error;await loadDashboardUsers();msg(`Administrator status changed to ${status}.`);
}
function setPasskeyMessage(id,text,bad=false){const el=$(id);if(!el)return;el.textContent=text;el.classList.toggle("error",bad);}
function passkeySupported(){return !!(window.PublicKeyCredential&&navigator.credentials&&state.sb?.auth?.registerPasskey&&state.sb?.auth?.signInWithPasskey);}
async function loadPasskeys(){
 const list=$("passkeyList");if(!list)return;
 if(!passkeySupported()){list.innerHTML='<p class="muted">This browser does not support passkeys. Open BassemTV in Chrome on Android.</p>';return;}
 const {data,error}=await state.sb.auth.passkey.list();if(error)throw error;
 const items=Array.isArray(data)?data:[];
 if(!items.length){list.innerHTML='<p class="muted">No passkeys registered for this account yet.</p>';return;}
 list.innerHTML=items.map(k=>`<div class="passkey-item"><div><strong>${esc(k.friendly_name||"Passkey")}</strong><small>Added ${k.created_at?new Date(k.created_at).toLocaleDateString():"—"}${k.last_used_at?` · Last used ${new Date(k.last_used_at).toLocaleDateString()}`:""}</small></div><button class="btn" type="button" data-delete-passkey="${esc(k.id)}">Remove</button></div>`).join("");
}
async function registerPasskey(){
 if(!state.user)throw Error("Sign in with your password before registering a passkey.");
 if(!passkeySupported())throw Error("Passkeys are not supported by this browser. Use Chrome on Android.");
 const {data,error}=await state.sb.auth.registerPasskey();if(error)throw error;
 setPasskeyMessage("passkeySettingsMessage","Passkey registered on this phone.");await loadPasskeys();
}
async function signInPasskey(){
 const button=$("passkeyLoginBtn"),label=$("passkeyLoginMessage");
 if(!passkeySupported()){setPasskeyMessage("passkeyLoginMessage","Passkeys are not available in this browser. Open this PWA in Chrome on Android.",true);return;}
 button.disabled=true;setPasskeyMessage("passkeyLoginMessage","Waiting for your phone's fingerprint or screen-lock confirmation…");
 try{
  const {data,error}=await state.sb.auth.signInWithPasskey();if(error)throw error;
  if(!data?.user)throw Error("Passkey sign-in did not return a user.");
  await acceptSession(data.user, true);
 }catch(e){setPasskeyMessage("passkeyLoginMessage",e.message||String(e),true);}
 finally{button.disabled=false;}
}
async function boot(){
  try{
    if(!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY||cfg.SUPABASE_ANON_KEY.includes("PASTE_YOUR")){
      $("loginError").textContent="First add your Supabase publishable/anon key in config.js.";
      return;
    }
    state.sb=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY,{auth:{experimental:{passkey:true}}});
    const {data,error}=await state.sb.auth.getSession();
    if(error)throw error;
    if(data.session){
      try{await acceptSession(data.session.user);}
      catch(e){$("loginError").textContent=e.message;}
    }
    state.sb.auth.onAuthStateChange((event,session)=>{
      if(event==="PASSWORD_RECOVERY"){
        $("loginView").classList.remove("hidden");
        $("appView").classList.add("hidden");
        showAuthView("newPasswordView");
        return;
      }
      if(!session){
        stopIdleTimer();
        state.user=null;state.profile=null;state.dashboardUsers=[];
        $("appView").classList.add("hidden");
        $("loginView").classList.remove("hidden");
        showAuthView("loginForm");
      }
    });
  }catch(e){
    console.error(e);
    $("loginError").textContent=e?.message||String(e);
  }finally{
    document.documentElement.classList.remove("auth-pending");
    $("authLoading")?.remove();
  }
}
async function enterApp(){
 startIdleProtection();
 $("loginView").classList.add("hidden");$("appView").classList.remove("hidden");
 $("userEmail").textContent=state.user.email||"";$("settingsEmail").textContent=state.user.email||"";
 $("usersNav").classList.toggle("hidden",state.profile?.role!=="superadmin");
 $("loginHistoryNav").classList.toggle("hidden",state.profile?.role!=="superadmin");
 try{
  await loadData();
  const savedPage=sessionStorage.getItem("bassemtv_current_page")||"overview";
  showPage(savedPage);
}catch(e){
  fail(e);
}
}
$("passkeyLoginBtn").addEventListener("click",signInPasskey);
$("registerPasskeyBtn").addEventListener("click",async()=>{const b=$("registerPasskeyBtn");b.disabled=true;setPasskeyMessage("passkeySettingsMessage","Starting passkey registration…");try{await registerPasskey();}catch(e){setPasskeyMessage("passkeySettingsMessage",e.message||String(e),true);}finally{b.disabled=false;}});
$("refreshPasskeysBtn").addEventListener("click",()=>loadPasskeys().catch(e=>setPasskeyMessage("passkeySettingsMessage",e.message,true)));
$("passkeyList").addEventListener("click",async e=>{const b=e.target.closest("[data-delete-passkey]");if(!b)return;if(!confirm("Remove this passkey from your account?"))return;b.disabled=true;try{const {error}=await state.sb.auth.passkey.delete({passkeyId:b.dataset.deletePasskey});if(error)throw error;setPasskeyMessage("passkeySettingsMessage","Passkey removed.");await loadPasskeys();}catch(err){setPasskeyMessage("passkeySettingsMessage",err.message,true);}finally{b.disabled=false;}});
const LOGIN_FAIL_KEY="bassemtv_login_failures_v1";
const LOGIN_LOCK_KEY="bassemtv_login_lock_until_v1";
const LOGIN_MAX_FAILURES=5;
const LOGIN_LOCK_MS=15*60*1000;
let loginRequestPending=false;
function getLoginLockUntil(){try{return Number(localStorage.getItem(LOGIN_LOCK_KEY)||0)||0;}catch{return 0;}}
function setLoginLockMessage(){
 const until=getLoginLockUntil(),remaining=until-Date.now();
 const button=$("loginForm").querySelector('button[type="submit"]');
 if(remaining>0){
  const total=Math.ceil(remaining/1000),m=Math.floor(total/60),sec=total%60;
  $("loginError").textContent=`Too many failed attempts. Try again in ${m}:${String(sec).padStart(2,"0")} minutes.`;
  if(button)button.disabled=true;
  return true;
 }
 if(until){try{localStorage.removeItem(LOGIN_LOCK_KEY);localStorage.removeItem(LOGIN_FAIL_KEY);}catch{}}
 if(button)button.disabled=loginRequestPending;
 return false;
}
function recordLoginFailure(){
 let count=0;try{count=Number(localStorage.getItem(LOGIN_FAIL_KEY)||0)||0;}catch{}
 count++;
 if(count>=LOGIN_MAX_FAILURES){
  try{localStorage.setItem(LOGIN_LOCK_KEY,String(Date.now()+LOGIN_LOCK_MS));localStorage.setItem(LOGIN_FAIL_KEY,"0");}catch{}
  setLoginLockMessage();
 }else{
  try{localStorage.setItem(LOGIN_FAIL_KEY,String(count));}catch{}
  $("loginError").textContent=`Invalid login credentials. ${LOGIN_MAX_FAILURES-count} attempt(s) remaining before a 15-minute lockout.`;
 }
}
function clearLoginFailures(){try{localStorage.removeItem(LOGIN_FAIL_KEY);localStorage.removeItem(LOGIN_LOCK_KEY);}catch{}}
setInterval(()=>{if(getLoginLockUntil())setLoginLockMessage();},1000);
$("loginForm").addEventListener("submit",async e=>{
 e.preventDefault();$("loginError").textContent="";
 if(setLoginLockMessage())return;
 const email=$("loginEmail").value.trim(),password=$("loginPassword").value;
 if(!email||!password){$("loginError").textContent="Enter your email and password.";return;}
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){$("loginError").textContent="Enter a valid email address.";return;}
 const button=$("loginForm").querySelector('button[type="submit"]');
 loginRequestPending=true;if(button)button.disabled=true;
 try{
  const response=await fetch(`${cfg.SUPABASE_URL}/functions/v1/admin-login`,{
   method:"POST",
   headers:{"Content-Type":"application/json","apikey":cfg.SUPABASE_ANON_KEY},
   body:JSON.stringify({email,password})
  });
  let result={};try{result=await response.json();}catch{}
  if(!response.ok||result.success!==true){
   const message=result.message||`Login failed (${response.status}).`;
   const lower=String(message).toLowerCase();
   if(response.status===401||/invalid login credentials|invalid credentials|incorrect password|email or password/i.test(lower))recordLoginFailure();
   else $("loginError").textContent=message;
   return;
  }
  if(!result.session?.access_token||!result.session?.refresh_token)throw Error("Login service did not return a valid session.");
  clearLoginFailures();
  const {data,error}=await state.sb.auth.setSession({
   access_token:result.session.access_token,
   refresh_token:result.session.refresh_token
  });
  if(error)throw error;
  await acceptSession(result.user||data.user, true);
 }catch(e){$("loginError").textContent=e?.message||String(e);}
 finally{loginRequestPending=false;if(button)button.disabled=false;setLoginLockMessage();}
});
$("registerForm").addEventListener("submit",async e=>{e.preventDefault();authMessage("registerMessage","Creating account…");try{
 const {data,error}=await state.sb.auth.signUp({email:$("registerEmail").value.trim(),password:$("registerPassword").value,options:{data:{full_name:$("registerName").value.trim()},emailRedirectTo:location.origin+location.pathname}});
 if(error)throw error;
 if(data.session){await state.sb.auth.signOut();}
 authMessage("registerMessage","Registration submitted. Your account is pending Super Admin approval. If email confirmation is enabled, confirm your email first.");
 $("registerForm").reset();
 }catch(e){authMessage("registerMessage",e.message,true);}});
$("resetView").addEventListener("submit",async e=>{e.preventDefault();authMessage("resetMessage","Sending recovery email…");try{
 const {error}=await state.sb.auth.resetPasswordForEmail($("resetEmail").value.trim(),{redirectTo:new URL("reset-password.html",location.href).href});if(error)throw error;
 authMessage("resetMessage","If the address is registered, a password recovery email has been sent.");
 }catch(e){authMessage("resetMessage",e.message,true);}});
$("newPasswordView").addEventListener("submit",async e=>{e.preventDefault();authMessage("newPasswordMessage","Updating password…");try{
 const {error}=await state.sb.auth.updateUser({password:$("newPassword").value});if(error)throw error;
 await state.sb.auth.signOut();showAuthView("loginForm");$("loginError").textContent="Password updated. You can now sign in.";
 }catch(e){authMessage("newPasswordMessage",e.message,true);}});
document.querySelectorAll("[data-auth-view]").forEach(b=>b.addEventListener("click",()=>showAuthView(b.dataset.authView)));
$("logoutBtn").onclick=async()=>{stopIdleTimer();await state.sb.auth.signOut();state.user=null;state.profile=null;};
$("idleTimeoutSelect").addEventListener("change",()=>{const n=Number($("idleTimeoutSelect").value);if(![5,10,15,30,60].includes(n))return;localStorage.setItem(IDLE_KEY,String(n));recordActivity();msg("Automatic logout set to "+n+" minutes.");});
$("refreshUsersBtn").onclick=()=>loadDashboardUsers().catch(fail);
$("refreshLoginHistoryBtn").onclick=()=>loadLoginHistory().catch(fail);
$("loginHistoryStatus").addEventListener("change",renderLoginHistory);
$("loginHistorySearch").addEventListener("input",renderLoginHistory);
$("usersTable").addEventListener("click",e=>{const b=e.target.closest("[data-user-status]");if(!b)return;const status=b.dataset.userStatus,id=b.dataset.userId;if(confirm(`Change this administrator's status to ${status}?`))updateDashboardUser(id,status).catch(fail);});

$("refreshBtn").onclick=async()=>{
  const currentPage=state.page;
  try{
    await loadData();
    showPage(currentPage);
    msg("Data refreshed.");
  }catch(e){
    fail(e);
  }
};
$("refreshNewDevicesBtn").onclick=()=>loadNewDevices().catch(fail);
$("nav").onclick=e=>{const b=e.target.closest("[data-page]");if(b)showPage(b.dataset.page);};
document.addEventListener("click",e=>{const b=e.target.closest("[data-go]");if(b)showPage(b.dataset.go);actionClick(e);});
$("playlistForm").addEventListener("submit",createPlaylists);$("testStalkerHostBtn").onclick=()=>testPlaylistHost("stalker");$("testXtreamHostBtn").onclick=()=>testPlaylistHost("xtream");setPlaylistMode("stalker");$("deviceForm").addEventListener("submit",addDevice);$("assignBtn").onclick=assignBulk;$("serverForm").addEventListener("submit",saveServer);
$("serverCancel").onclick=()=>{$("serverForm").reset();$("serverId").value="";$("serverSort").value="0";$("serverSubmit").textContent="Add server";$("serverCancel").classList.add("hidden");};
$("modalClose").onclick=closeModal;$("modal").onclick=e=>{if(e.target===$("modal"))closeModal();};
["playlistSearch","deviceSearch","currentAssignmentSearch"].forEach(id=>$(id).addEventListener("input",renderAssignments));
$("assignmentTable").addEventListener("change",e=>{const box=e.target.closest(".assignment-row-check");if(!box)return;const key=box.dataset.assignmentKey;if(box.checked)state.selectedAssignmentKeys.add(key);else state.selectedAssignmentKeys.delete(key);renderAssignments();});
$("selectAllAssignments").addEventListener("change",e=>{const q=($("currentAssignmentSearch").value||"").trim().toLowerCase();state.assignments.filter(a=>String(a.device_mac||"").toLowerCase().includes(q)).forEach(a=>{const key=assignmentKey(a);if(e.target.checked)state.selectedAssignmentKeys.add(key);else state.selectedAssignmentKeys.delete(key);});renderAssignments();});
$("bulkUnassignAssignments").onclick=bulkUnassignAssignments;
["playlistTableSearch","deviceTableSearch"].forEach(id=>$(id).addEventListener("input",id==="playlistTableSearch"?renderPlaylists:renderDevices));
$("deviceInactiveFilter").addEventListener("change",renderDevices);
$("deviceTable").addEventListener("change",e=>{const box=e.target.closest("[data-device-select]");if(!box)return;const id=String(box.dataset.deviceSelect);if(box.checked)state.selectedDeviceIds.add(id);else state.selectedDeviceIds.delete(id);renderDevices();});
$("selectAllDevices").addEventListener("change",e=>{const q=($("deviceTableSearch").value||"").toLowerCase(),inactive=$("deviceInactiveFilter").value,cutoff=Date.now()-(Number(inactive)||0)*86400000;const visible=state.devices.filter(d=>(d.mac+" "+d.name+" "+(d.last_model||"")).toLowerCase().includes(q)&&(inactive==="all"||!d.last_seen||new Date(d.last_seen).getTime()<cutoff));visible.forEach(d=>{if(e.target.checked)state.selectedDeviceIds.add(String(d.id));else state.selectedDeviceIds.delete(String(d.id));});renderDevices();});
$("bulkEnableDevices").onclick=()=>bulkDeviceAction("enable");$("bulkDisableDevices").onclick=()=>bulkDeviceAction("disable");$("bulkDeleteDevices").onclick=()=>bulkDeviceAction("delete");
$("assignPlaylists").addEventListener("click",e=>{const box=e.target.closest('input[name="ap"]');if(!box)return;const visible=[...$("assignPlaylists").querySelectorAll('input[name="ap"]')];const index=visible.indexOf(box);if(e.shiftKey&&state.playlistAnchor!==null){e.preventDefault();const start=Math.min(state.playlistAnchor,index),end=Math.max(state.playlistAnchor,index),target=!state.selectedPlaylistIds.has(box.value);visible.slice(start,end+1).forEach(el=>{if(target)state.selectedPlaylistIds.add(el.value);else state.selectedPlaylistIds.delete(el.value);el.checked=target;});refreshSelectionCount();}else{state.playlistAnchor=index;}});
$("assignPlaylists").addEventListener("change",e=>{const box=e.target.closest('input[name="ap"]');if(!box)return;if(box.checked)state.selectedPlaylistIds.add(box.value);else state.selectedPlaylistIds.delete(box.value);refreshSelectionCount();});
$("assignDevices").addEventListener("change",e=>{const box=e.target.closest('input[name="ad"]');if(!box)return;if(box.checked)state.selectedDeviceMacs.add(box.value);else state.selectedDeviceMacs.delete(box.value);refreshSelectionCount();});
$("selectAllPlaylists").addEventListener("change",e=>{const visible=state.playlists.filter(p=>p.name.toLowerCase().includes(($("playlistSearch").value||"").toLowerCase()));visible.forEach(p=>{if(e.target.checked)state.selectedPlaylistIds.add(String(p.id));else state.selectedPlaylistIds.delete(String(p.id));});renderAssignments();});
$("stalkerModeBtn").onclick=()=>setPlaylistMode("stalker");$("xtreamModeBtn").onclick=()=>setPlaylistMode("xtream");
["stalker","xtream"].forEach(type=>$(type+"ServerSearch").addEventListener("input",()=>renderServerPicker(type)));
$("stalkerServerResults").addEventListener("click",pickServer);$("xtreamServerResults").addEventListener("click",pickServer);
document.addEventListener("click",e=>{const clear=e.target.closest("[data-clear-server]");if(clear){const type=clear.dataset.clearServer;state.selectedServers[type]=null;$(type+"ServerSearch").value="";$(type+"HostTestStatus").textContent="Not tested";$(type+"HostTestStatus").className="host-test-status muted";renderServerPicker(type);updatePreview();}});
function pickServer(e){const b=e.target.closest("[data-pick-server]");if(!b)return;const type=b.dataset.pickServer;state.selectedServers[type]=state.servers.find(x=>String(x.id)===String(b.dataset.serverId))||null;$(type+"ServerSearch").value="";$(type+"HostTestStatus").textContent="Not tested";$(type+"HostTestStatus").className="host-test-status muted";renderServerPicker(type);updatePreview();}
["playlistMacs","xtreamUsername","stalkerCustomHost","xtreamCustomHost"].forEach(id=>$(id).addEventListener("input",()=>{updatePreview();if(id.includes("stalker")){$("stalkerHostTestStatus").textContent="Not tested";$("stalkerHostTestStatus").className="host-test-status muted";}if(id.includes("xtream")){$("xtreamHostTestStatus").textContent="Not tested";$("xtreamHostTestStatus").className="host-test-status muted";}}));
function updatePreview(){const type=state.playlistMode;let name="Choose a saved server or enter a one-time host URL.";try{const host=getPlaylistHost(type);if(type==="stalker"){const mac=normalizeMac($("playlistMacs").value.split(/\r?\n/)[0]);if(validMac(mac))name=`${hostIdentifier(host.url)}_${mac}`;}else{const u=$("xtreamUsername").value.trim();if(u)name=`${hostIdentifier(host.url)}_${u}`;}}catch{}$("namePreview").textContent=name;}
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
boot();
})();
