const $ = (id) => document.getElementById(id);
const socket = io();
const home = $("home"), room = $("room");
let roomId = null, myName = "", selfId = null, peers = new Map(), localStream = null, micStream = null;
let participants = new Map(), toastTimer = null, renaming = false;

function randomCode(){ return Math.random().toString(36).slice(2,8).toUpperCase(); }
function makeRoomId(){ return randomCode(); }
function initials(name){ return (name || "?").trim().split(/\s+/).slice(0,2).map(x=>x[0]||"").join("").toUpperCase(); }
function showToast(msg){ const el=$("toast"); el.textContent=msg; el.classList.remove("hidden"); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.add("hidden"),2600); }
function getRoomFromUrl(){ const match=location.pathname.match(/^\/sala\/([A-Za-z0-9_-]+)/); return match?match[1]:null; }
function goToRoom(id){ history.pushState({}, "", `/sala/${encodeURIComponent(id)}`); roomId=id; showNameModal(); }
function showNameModal(){ $("nameModal").classList.remove("hidden"); $("displayName").value=myName; setTimeout(()=>$("displayName").focus(),80); }
function enterRoom(name){
  myName=(name||"Participante").trim().slice(0,28)||"Participante";
  $("nameModal").classList.add("hidden"); home.classList.add("hidden"); room.classList.remove("hidden");
  $("roomTitle").textContent=roomId; $("roomCode").textContent=roomId; $("controlRoomName").textContent=`Sala ${roomId}`;
  $("participants").innerHTML=""; participants.clear();
  socket.emit("room:join",{roomId,name:myName});
}
function setParticipant(id,name,isSelf=false){
  participants.set(id,{id,name,isSelf});
  renderParticipants();
}
function renderParticipants(){
  const list=$("participants"); list.innerHTML="";
  const all=[...participants.values()];
  all.forEach(p=>{
    const el=document.createElement("div"); el.className="person";
    const av=document.createElement("div"); av.className="avatar"; av.textContent=initials(p.name);
    const info=document.createElement("div"); info.className="person-info";
    const nm=document.createElement("div"); nm.className="person-name"; nm.textContent=p.name;
    if(p.isSelf){const tag=document.createElement("span");tag.className="you-tag";tag.textContent=" (você)";nm.append(tag);}
    const state=document.createElement("div");state.className="person-state";state.textContent=p.isSelf?"Você está na sala":"Conectado";
    info.append(nm,state);el.append(av,info);list.append(el);
  });
  const count=all.length; $("peopleCount").textContent=count; $("stageCount").textContent=`${count} ${count===1?"participante":"participantes"}`;
}
function createPeer(id){
  if(peers.has(id))return peers.get(id);
  const pc=new RTCPeerConnection({iceServers:[{urls:"stun:stun.l.google.com:19302"}]});
  pc.onicecandidate=e=>{if(e.candidate)socket.emit("webrtc:ice",{to:id,candidate:e.candidate});};
  pc.ontrack=e=>{
    const video=$("remoteVideo"); video.srcObject=e.streams[0]; video.style.display="block";
    $("stageEmpty").classList.add("hidden"); $("shareBadge").classList.remove("hidden");
    $("connectionState").textContent="Tela recebida de outro participante";
  };
  if(localStream) localStream.getTracks().forEach(track=>pc.addTrack(track,localStream));
  if(micStream) micStream.getTracks().forEach(track=>pc.addTrack(track,micStream));
  peers.set(id,pc); return pc;
}
async function callPeer(id){
  const pc=createPeer(id);
  try{const offer=await pc.createOffer();await pc.setLocalDescription(offer);socket.emit("webrtc:offer",{to:id,offer});}
  catch(e){console.error(e);showToast("Não foi possível conectar com esse participante.");}
}
function removePeer(id){const pc=peers.get(id);if(pc)pc.close();peers.delete(id);participants.delete(id);renderParticipants();}
async function startScreenShare(){
  if(!navigator.mediaDevices?.getDisplayMedia){showToast("Seu navegador não permite compartilhar a tela.");return;}
  try{
    localStream=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:30},audio:true});
    const videoTrack=localStream.getVideoTracks()[0];
    $("remoteVideo").srcObject=localStream;$("remoteVideo").style.display="block";$("stageEmpty").classList.add("hidden");
    $("shareBadge").classList.remove("hidden");$("stopShare").disabled=false;$("shareScreen").innerHTML="<span>▣</span><b>Tela ativa</b>";
    $("connectionState").textContent="Você está compartilhando sua tela";
    for(const [id,pc] of peers.entries()){
      const sender=pc.getSenders().find(s=>s.track?.kind==="video");
      if(sender) await sender.replaceTrack(videoTrack); else pc.addTrack(videoTrack,localStream);
      const offer=await pc.createOffer();await pc.setLocalDescription(offer);socket.emit("webrtc:offer",{to:id,offer});
    }
    videoTrack.onended=stopScreenShare;
  }catch(e){if(e.name!=="AbortError")showToast("O compartilhamento foi cancelado ou não pôde ser iniciado.");}
}
async function stopScreenShare(){
  if(localStream){localStream.getTracks().forEach(t=>t.stop());localStream=null;}
  $("stopShare").disabled=true;$("shareScreen").innerHTML="<span>▣</span><b>Compartilhar tela</b>";
  $("shareBadge").classList.add("hidden");$("remoteVideo").srcObject=null;$("remoteVideo").style.display="none";$("stageEmpty").classList.remove("hidden");
  $("connectionState").textContent="Compartilhamento encerrado";
  for(const [id,pc] of peers.entries()){
    const sender=pc.getSenders().find(s=>s.track?.kind==="video");
    if(sender) await sender.replaceTrack(null).catch(()=>{});
  }
}
async function toggleMic(){
  if(micStream){micStream.getTracks().forEach(t=>t.stop());micStream=null;$("shareAudio").innerHTML="<span>♫</span><b>Ativar microfone</b>";showToast("Microfone desligado.");return;}
  try{
    micStream=await navigator.mediaDevices.getUserMedia({audio:true});
    for(const [id,pc] of peers.entries()){micStream.getTracks().forEach(track=>pc.addTrack(track,micStream));const offer=await pc.createOffer();await pc.setLocalDescription(offer);socket.emit("webrtc:offer",{to:id,offer});}
    $("shareAudio").innerHTML="<span>♫</span><b>Microfone ligado</b>";showToast("Microfone ligado.");
  }catch(e){showToast("Permita o acesso ao microfone no navegador.");}
}
function copyInvite(){navigator.clipboard.writeText(location.href).then(()=>showToast("Link da sala copiado!")).catch(()=>showToast("Não foi possível copiar. Copie o link da barra do navegador."));}
function leaveRoom(){if(localStream)localStream.getTracks().forEach(t=>t.stop());if(micStream)micStream.getTracks().forEach(t=>t.stop());peers.forEach(pc=>pc.close());peers.clear();socket.disconnect();location.href="/";}
$("createRoom").addEventListener("click",()=>{roomId=makeRoomId();goToRoom(roomId);});
$("headerCreate").addEventListener("click",()=>{$("roomName").focus();$("createCard").scrollIntoView({behavior:"smooth",block:"center"});});
$("roomName").addEventListener("keydown",e=>{if(e.key==="Enter")$("createRoom").click();});
$("nameForm").addEventListener("submit",e=>{
  e.preventDefault();
  if(renaming){
    myName=$("displayName").value.trim().slice(0,28)||"Participante";
    $("nameModal").classList.add("hidden");
    socket.emit("participant:rename",{name:myName});
    setParticipant(selfId,myName,true);
    renaming=false;
  } else {
    enterRoom($("displayName").value);
  }
});
$("copyLink").addEventListener("click",copyInvite);$("copyLinkSide").addEventListener("click",copyInvite);
$("shareScreen").addEventListener("click",startScreenShare);$("stopShare").addEventListener("click",stopScreenShare);$("shareAudio").addEventListener("click",toggleMic);
$("moreButton").addEventListener("click",()=>$("moreMenu").classList.toggle("hidden"));
$("renameButton").addEventListener("click",()=>{ $("moreMenu").classList.add("hidden");renaming=true;showNameModal(); });
$("leaveButton").addEventListener("click",leaveRoom);$("leaveButtonBottom").addEventListener("click",leaveRoom);
socket.on("room:joined",async data=>{selfId=data.selfId;setParticipant(selfId,myName,true);data.participants.forEach(p=>{setParticipant(p.id,p.name);callPeer(p.id);});});
socket.on("participant:joined",p=>{setParticipant(p.id,p.name);$("connectionState").textContent=`${p.name} entrou na sala`;});
socket.on("participant:left",({id})=>{removePeer(id);showToast("Um participante saiu da sala.");});
socket.on("participant:renamed",p=>{if(p.id!==selfId)setParticipant(p.id,p.name);});
socket.on("webrtc:offer",async({from,offer})=>{const pc=createPeer(from);try{await pc.setRemoteDescription(offer);const answer=await pc.createAnswer();await pc.setLocalDescription(answer);socket.emit("webrtc:answer",{to:from,answer});}catch(e){console.error(e);}});
socket.on("webrtc:answer",async({from,answer})=>{const pc=peers.get(from);if(pc)try{await pc.setRemoteDescription(answer);}catch(e){console.error(e);}});
socket.on("webrtc:ice",async({from,candidate})=>{const pc=peers.get(from);if(pc)try{await pc.addIceCandidate(candidate);}catch(e){console.error(e);}});

const invitedRoom=getRoomFromUrl();
if(invitedRoom){roomId=invitedRoom;showNameModal();}
