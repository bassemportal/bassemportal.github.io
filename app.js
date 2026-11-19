(() => {
"use strict";
const cfg=window.BASSEM_CONFIG||{};
const $=id=>document.getElementById(id);
const state={sb:null,user:null,profile:null,servers:[],playlists:[],devices:[],assignments:[],dashboardUsers:[],page:"overview",selectedPlaylistIds:new Set(),selectedDeviceMacs:new Set(),playlistAnchor:null};
const META={
 is_vod:0,position:null,tvg_urls:"",tvg_shift:0,is_enabled:1,user_agent:null,auto_update:0,include_vod:1,is_expanded:0,
 movie_count:0,catchup_type:2,series_count:0,catchup_hours:72,channel_count:0,
 stalker_token:"123456789123DFFDDF223D2D2D2DS2Q2",catchup_source:null,groups_sorting:1,logos_priority:1,
 expiration_date:null,max_connections:null,server_timezone:null,last_update_time:1794309903421,
 user_catchup_type:null,user_catchup_hours:null,include_tv_channels:1,prev_groups_sorting:1,
 movie_groups_sorting:1,is_expanded_in_movies:1,is_expanded_in_series:1,series_groups_sorting:1,
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
function hostIdentifier(raw){const u=new URL(raw);const p=u.hostname.toLowerCase().split(".");return p.length>1?p.slice(0,-1).join("."):p[0];}
function portalUrl(raw){const u=new URL(raw);const path=u.pathname.replace(/\/+$/,"");return u.origin+(path&&path!=="/"?path:"/c");}
function playlistPayload(server,mac){
 const obj={s:portalUrl(server.url),rs:"",ua:1,l:"this.portal_protocol+'://'+this.portal_ip+'/portal.php'",sv:"",m:colonMac(mac),u:"",p:"",di:"",di2:"",sn:"007255N967172",adid:"eec3d2a615d9169e6d703904b89ec3d0"};
 return "s:"+JSON.stringify(obj);
}
function selectedValues(sel){return [...sel.selectedOptions].map(o=>o.value);}
async function loadData(){
 const names=["servers","playlists","mac_devices","playlist_assignments"];
 const results=await Promise.all(names.map(t=>state.sb.from(t).select("*").limit(5000)));
 results.forEach((r,i)=>{if(r.error)throw new Error(names[i]+": "+r.error.message);});
 [state.servers,state.playlists,state.devices,state.assignments]=results.map(r=>r.data||[]);
 renderAll();
}
function showPage(page){
 if(page==="users"&&state.profile?.role!=="superadmin")return;
 state.page=page;
 document.querySelectorAll(".page").forEach(x=>x.classList.toggle("hidden",x.id!=="page-"+page));
 document.querySelectorAll("#nav button[data-page]").forEach(x=>x.classList.toggle("active",x.dataset.page===page));
 $("pageTitle").textContent=({overview:"Overview","add-playlist":"Add playlists",assignments:"Assignments",playlists:"Playlists",devices:"Devices",servers:"Servers",settings:"Settings",users:"Dashboard users"})[page]||page;
 if(page==="assignments")renderAssignments();
 if(page==="users")loadDashboardUsers().catch(fail);
 if(page==="settings"&&state.user)loadPasskeys().catch(e=>setPasskeyMessage("passkeySettingsMessage",e.message,true));
}
function renderAll(){
 $("statServers").textContent=state.servers.length;$("statPlaylists").textContent=state.playlists.length;$("statDevices").textContent=state.devices.length;$("statAssignments").textContent=state.assignments.length;
 $("userEmail").textContent=state.user?.email||"";$("settingsEmail").textContent=state.user?.email||"";$("projectUrl").textContent=cfg.SUPABASE_URL||"";
 $("playlistServer").innerHTML='<option value="">Select server…</option>'+state.servers.filter(s=>Number(s.enabled)!==0).map(s=>`<option value="${s.id}">${esc(s.name)} — ${esc(s.url)}</option>`).join("");
 $("deviceServer").innerHTML='<option value="">No server</option>'+state.servers.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join("");
 $("playlistDevices").innerHTML=state.devices.map(d=>`<option value="${esc(d.mac)}">${esc(d.name||d.mac)} — ${esc(d.mac)}</option>`).join("");
 $("recentDevices").innerHTML=table(["MAC","Name","Model","Last seen"],state.devices.slice().sort((a,b)=>String(b.last_seen||"").localeCompare(String(a.last_seen||""))).slice(0,8).map(d=>[esc(d.mac),esc(d.name),esc(d.last_model||"—"),esc(d.last_seen||"—")]));
 renderPlaylists();renderDevices();renderServers();renderAssignments();
}
function table(headers,rows){if(!rows.length)return '<div class="empty">No records found.</div>';return `<table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;}
function playlistParts(p){
 try{const raw=String(p.url||"");const payload=raw.startsWith("s:")?raw.slice(2):raw;const obj=JSON.parse(payload);return {host:String(obj.s||""),mac:String(obj.m||"").replace(/[^0-9A-Fa-f]/g,"").toUpperCase(),obj};}
 catch{return {host:"",mac:"",obj:null};}
}
function renderPlaylists(){
 const q=($("playlistTableSearch")?.value||"").toLowerCase();
 const rows=state.playlists.filter(p=>{const parts=playlistParts(p);return (p.name+" "+parts.host+" "+parts.mac).toLowerCase().includes(q);}).map(p=>{const parts=playlistParts(p);return [esc(p.name),esc(parts.host||"—"),esc(parts.mac||"—"),`<div class="table-actions"><button class="btn" data-edit-playlist="${p.id}">Edit</button><button class="btn" data-delete-playlist="${p.id}">Delete</button></div>`];});
 $("playlistTable").innerHTML=table(["Name","Host","MAC","Actions"],rows);
}
function renderDevices(){
 const q=($("deviceTableSearch")?.value||"").toLowerCase();
 const rows=state.devices.filter(d=>(d.mac+" "+d.name+" "+d.last_model).toLowerCase().includes(q)).map(d=>[esc(d.mac),esc(d.name),esc(d.last_model||"—"),Number(d.enabled)?"<span class=pill>Enabled</span>":"<span class=pill>Disabled</span>",`<div class="table-actions"><button class="btn" data-toggle-device="${d.id}">${Number(d.enabled)?"Disable":"Enable"}</button><button class="btn" data-delete-device="${d.id}">Delete</button></div>`]);
 $("deviceTable").innerHTML=table(["MAC","Name","Model","Status","Actions"],rows);
}
function renderServers(){
 const rows=state.servers.map(s=>[esc(s.name),esc(s.url),esc(s.type),Number(s.enabled)?"<span class=pill>Enabled</span>":"Disabled",`<div class="table-actions"><button class="btn" data-edit-server="${s.id}">Edit</button><button class="btn" data-toggle-server="${s.id}">${Number(s.enabled)?"Disable":"Enable"}</button><button class="btn" data-delete-server="${s.id}">Delete</button></div>`]);
 $("serverTable").innerHTML=table(["Name","URL","Type","Status","Actions"],rows);
}
function renderAssignments(){
 if(!$("assignPlaylists"))return;
 const pq=($("playlistSearch")?.value||"").toLowerCase(),dq=($("deviceSearch")?.value||"").toLowerCase();
 const visiblePlaylists=state.playlists.filter(p=>p.name.toLowerCase().includes(pq));
 const visibleDevices=state.devices.filter(d=>(d.mac+" "+d.name).toLowerCase().includes(dq));
 $("assignPlaylists").innerHTML=visiblePlaylists.map(p=>`<label class="check-row"><input type="checkbox" name="ap" value="${p.id}" ${state.selectedPlaylistIds.has(String(p.id))?"checked":""}><span>${esc(p.name)}</span></label>`).join("")||'<div class=empty>No playlists</div>';
 $("assignDevices").innerHTML=visibleDevices.map(d=>`<label class="check-row"><input type="checkbox" name="ad" value="${esc(d.mac)}" ${state.selectedDeviceMacs.has(d.mac)?"checked":""}><span>${esc(d.name||d.mac)} <small>${esc(d.mac)}</small></span></label>`).join("")||'<div class=empty>No devices</div>';
 const allVisible=visiblePlaylists.length>0&&visiblePlaylists.every(p=>state.selectedPlaylistIds.has(String(p.id)));
 const selectAll=$("selectAllPlaylists");if(selectAll){selectAll.checked=allVisible;selectAll.indeterminate=!allVisible&&visiblePlaylists.some(p=>state.selectedPlaylistIds.has(String(p.id)));}
 const np=state.selectedPlaylistIds.size,nd=state.selectedDeviceMacs.size;
 $("assignmentCount").textContent=`${np} playlists × ${nd} devices = ${np*nd} possible links`;
 const lookup=new Map(state.playlists.map(p=>[String(p.id),p.name]));
 $("assignmentTable").innerHTML=table(["Device MAC","Playlist","Assigned"],state.assignments.map(a=>[esc(a.device_mac),esc(lookup.get(String(a.playlist_id))||("#"+a.playlist_id)),esc(a.assigned_at||"—")]));
}
function refreshSelectionCount(){const np=state.selectedPlaylistIds.size,nd=state.selectedDeviceMacs.size;$("assignmentCount").textContent=`${np} playlists × ${nd} devices = ${np*nd} possible links`;const visible=state.playlists.filter(p=>p.name.toLowerCase().includes(($("playlistSearch").value||"").toLowerCase()));const all=visible.length>0&&visible.every(p=>state.selectedPlaylistIds.has(String(p.id)));const ctl=$("selectAllPlaylists");if(ctl){ctl.checked=all;ctl.indeterminate=!all&&visible.some(p=>state.selectedPlaylistIds.has(String(p.id)));}}
function openModal(title,html){$("modalTitle").textContent=title;$("modalBody").innerHTML=html;$("modal").classList.remove("hidden");}
function closeModal(){$("modal").classList.add("hidden");}
async function createPlaylists(e){
 e.preventDefault();try{
 const sid=$("playlistServer").value,server=state.servers.find(s=>String(s.id)===sid);if(!server)throw Error("Choose a server.");
 const macs=[...new Set($("playlistMacs").value.split(/\r?\n/).map(normalizeMac).filter(Boolean))];
 if(!macs.length)throw Error("Enter at least one MAC address.");
 const invalid=macs.filter(m=>!validMac(m));if(invalid.length)throw Error("Invalid MAC address(es): "+invalid.join(", "));
 const devices=selectedValues($("playlistDevices"));const host=hostIdentifier(server.url);
 const existing=new Set(state.playlists.map(p=>p.name));const rows=[];
 for(const mac of macs){const name=`${host}_${mac}`;if(existing.has(name))continue;existing.add(name);rows.push({name,url:playlistPayload(server,mac),metadata:{...META}});}
 if(!rows.length)throw Error("All generated playlist names already exist.");
 const {data,error}=await state.sb.from("playlists").insert(rows).select("id,name");if(error)throw error;
 let assigned=0,assignError=null;
 if(devices.length){const links=[];for(const p of data)for(const mac of devices)links.push({device_mac:mac,playlist_id:p.id});
 const r=await state.sb.from("playlist_assignments").upsert(links,{onConflict:"device_mac,playlist_id",ignoreDuplicates:true});assignError=r.error;assigned=links.length;}
 $("playlistMacs").value="";[...$("playlistDevices").options].forEach(o=>o.selected=false);
 await loadData();msg(`${data.length} playlist(s) created${devices.length?`. Assignment links processed: ${assigned}.`:"."}${assignError?" Assignment error: "+assignError.message:""}`,!!assignError);
 }catch(e){fail(e);}
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
 openModal("Edit playlist",`<form id="editPlaylistForm" class="form-grid"><label class="span-2">Name<input id="editPName" required value="${esc(p.name)}"></label><label class="span-2">Host<input id="editPHost" required value="${esc(parts.host)}"></label><label class="span-2">MAC<input id="editPMac" required value="${esc(parts.mac)}" maxlength="17"></label><p class="muted span-2">Only name, host and MAC are editable here. Other playlist configuration is preserved.</p><div class="span-2"><button class="btn primary">Save changes</button></div></form>`);
 $("editPlaylistForm").onsubmit=async e=>{e.preventDefault();try{if(!parts.obj)throw Error("Playlist data format could not be parsed; refusing to overwrite it.");const mac=normalizeMac($("editPMac").value);if(!validMac(mac))throw Error("Enter a valid 12-character MAC address.");parts.obj.s=$("editPHost").value.trim();parts.obj.m=colonMac(mac);const {error}=await state.sb.from("playlists").update({name:$("editPName").value.trim(),url:"s:"+JSON.stringify(parts.obj)}).eq("id",id);if(error)throw error;closeModal();await loadData();msg("Playlist updated.");}catch(e){fail(e);}};
}
function editServer(id){const s=state.servers.find(x=>String(x.id)===String(id));if(!s)return;$("serverId").value=s.id;$("serverName").value=s.name;$("serverUrl").value=s.url;$("serverType").value=s.type;$("serverSort").value=s.sort_order;$("serverSubmit").textContent="Save server";$("serverCancel").classList.remove("hidden");showPage("servers");}
async function saveServer(e){e.preventDefault();try{const id=$("serverId").value;const row={name:$("serverName").value.trim(),url:$("serverUrl").value.trim(),type:$("serverType").value,sort_order:Number($("serverSort").value||0)};const r=id?await state.sb.from("servers").update(row).eq("id",id):await state.sb.from("servers").insert(row);if(r.error)throw r.error;$("serverForm").reset();$("serverId").value="";$("serverSort").value="0";$("serverSubmit").textContent="Add server";$("serverCancel").classList.add("hidden");await loadData();msg(id?"Server updated.":"Server added.");}catch(e){fail(e);}}
async function actionClick(e){
 const t=e.target.closest("button");if(!t)return;
 if(t.dataset.editPlaylist)editPlaylist(t.dataset.editPlaylist);
 if(t.dataset.deletePlaylist)deletePlaylist(t.dataset.deletePlaylist);
 if(t.dataset.deleteDevice)deleteDevice(t.dataset.deleteDevice);
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
async function acceptSession(user){
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
  await acceptSession(data.user);
 }catch(e){setPasskeyMessage("passkeyLoginMessage",e.message||String(e),true);}
 finally{button.disabled=false;}
}
async function boot(){
 if(!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY||cfg.SUPABASE_ANON_KEY.includes("PASTE_YOUR")){$("loginError").textContent="First add your Supabase publishable/anon key in config.js.";return;}
 state.sb=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY,{auth:{experimental:{passkey:true}}});
 const {data}=await state.sb.auth.getSession();
 if(data.session){try{await acceptSession(data.session.user);}catch(e){$("loginError").textContent=e.message;}}
 state.sb.auth.onAuthStateChange((event,session)=>{
   if(event==="PASSWORD_RECOVERY"){ $("loginView").classList.remove("hidden");$("appView").classList.add("hidden");showAuthView("newPasswordView");return; }
   if(!session){state.user=null;state.profile=null;state.dashboardUsers=[];$("appView").classList.add("hidden");$("loginView").classList.remove("hidden");showAuthView("loginForm");}
 });
}
async function enterApp(){
 $("loginView").classList.add("hidden");$("appView").classList.remove("hidden");
 $("userEmail").textContent=state.user.email||"";$("settingsEmail").textContent=state.user.email||"";
 $("usersNav").classList.toggle("hidden",state.profile?.role!=="superadmin");
 try{await loadData();}catch(e){fail(e);}
}
$("passkeyLoginBtn").addEventListener("click",signInPasskey);
$("registerPasskeyBtn").addEventListener("click",async()=>{const b=$("registerPasskeyBtn");b.disabled=true;setPasskeyMessage("passkeySettingsMessage","Starting passkey registration…");try{await registerPasskey();}catch(e){setPasskeyMessage("passkeySettingsMessage",e.message||String(e),true);}finally{b.disabled=false;}});
$("refreshPasskeysBtn").addEventListener("click",()=>loadPasskeys().catch(e=>setPasskeyMessage("passkeySettingsMessage",e.message,true)));
$("passkeyList").addEventListener("click",async e=>{const b=e.target.closest("[data-delete-passkey]");if(!b)return;if(!confirm("Remove this passkey from your account?"))return;b.disabled=true;try{const {error}=await state.sb.auth.passkey.delete({passkeyId:b.dataset.deletePasskey});if(error)throw error;setPasskeyMessage("passkeySettingsMessage","Passkey removed.");await loadPasskeys();}catch(err){setPasskeyMessage("passkeySettingsMessage",err.message,true);}finally{b.disabled=false;}});
$("loginForm").addEventListener("submit",async e=>{e.preventDefault();$("loginError").textContent="";try{const {data,error}=await state.sb.auth.signInWithPassword({email:$("loginEmail").value,password:$("loginPassword").value});if(error)throw error;await acceptSession(data.user);}catch(e){$("loginError").textContent=e.message;}});
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
$("logoutBtn").onclick=async()=>{await state.sb.auth.signOut();state.user=null;state.profile=null;};
$("refreshUsersBtn").onclick=()=>loadDashboardUsers().catch(fail);
$("usersTable").addEventListener("click",e=>{const b=e.target.closest("[data-user-status]");if(!b)return;const status=b.dataset.userStatus,id=b.dataset.userId;if(confirm(`Change this administrator's status to ${status}?`))updateDashboardUser(id,status).catch(fail);});

$("refreshBtn").onclick=async()=>{try{await loadData();msg("Data refreshed.");}catch(e){fail(e);}};
$("nav").onclick=e=>{const b=e.target.closest("[data-page]");if(b)showPage(b.dataset.page);};
document.addEventListener("click",e=>{const b=e.target.closest("[data-go]");if(b)showPage(b.dataset.go);actionClick(e);});
$("playlistForm").addEventListener("submit",createPlaylists);$("deviceForm").addEventListener("submit",addDevice);$("assignBtn").onclick=assignBulk;$("serverForm").addEventListener("submit",saveServer);
$("serverCancel").onclick=()=>{$("serverForm").reset();$("serverId").value="";$("serverSort").value="0";$("serverSubmit").textContent="Add server";$("serverCancel").classList.add("hidden");};
$("modalClose").onclick=closeModal;$("modal").onclick=e=>{if(e.target===$("modal"))closeModal();};
["playlistSearch","deviceSearch"].forEach(id=>$(id).addEventListener("input",renderAssignments));
["playlistTableSearch","deviceTableSearch"].forEach(id=>$(id).addEventListener("input",id==="playlistTableSearch"?renderPlaylists:renderDevices));
$("assignPlaylists").addEventListener("click",e=>{const box=e.target.closest('input[name="ap"]');if(!box)return;const visible=[...$("assignPlaylists").querySelectorAll('input[name="ap"]')];const index=visible.indexOf(box);if(e.shiftKey&&state.playlistAnchor!==null){e.preventDefault();const start=Math.min(state.playlistAnchor,index),end=Math.max(state.playlistAnchor,index),target=!state.selectedPlaylistIds.has(box.value);visible.slice(start,end+1).forEach(el=>{if(target)state.selectedPlaylistIds.add(el.value);else state.selectedPlaylistIds.delete(el.value);el.checked=target;});refreshSelectionCount();}else{state.playlistAnchor=index;}});
$("assignPlaylists").addEventListener("change",e=>{const box=e.target.closest('input[name="ap"]');if(!box)return;if(box.checked)state.selectedPlaylistIds.add(box.value);else state.selectedPlaylistIds.delete(box.value);refreshSelectionCount();});
$("assignDevices").addEventListener("change",e=>{const box=e.target.closest('input[name="ad"]');if(!box)return;if(box.checked)state.selectedDeviceMacs.add(box.value);else state.selectedDeviceMacs.delete(box.value);refreshSelectionCount();});
$("selectAllPlaylists").addEventListener("change",e=>{const visible=state.playlists.filter(p=>p.name.toLowerCase().includes(($("playlistSearch").value||"").toLowerCase()));visible.forEach(p=>{if(e.target.checked)state.selectedPlaylistIds.add(String(p.id));else state.selectedPlaylistIds.delete(String(p.id));});renderAssignments();});
$("playlistServer").addEventListener("change",updatePreview);$("playlistMacs").addEventListener("input",updatePreview);
function updatePreview(){const s=state.servers.find(x=>String(x.id)===$("playlistServer").value);const mac=normalizeMac($("playlistMacs").value.split(/\r?\n/)[0]);$("namePreview").textContent=s&&validMac(mac)?`${hostIdentifier(s.url)}_${mac}`:"Select a server and enter a valid MAC.";}
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
boot();
})();