/* GenSolar Pro in-app notification inbox. Backend events can call GenSolarNotifications.notify(). */
(function(){
  'use strict';
  if(window.GenSolarNotifications) return;
  const KEY='gs_notifications_v1';
  let notices=[];
  const safeRead=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch(_){return []}};
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(notices.slice(0,100)))}catch(_){};render()};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const unread=()=>notices.filter(n=>!n.read).length;
  function render(){
    const count=document.getElementById('gsNotificationCount');
    if(count){const n=unread();count.textContent=n>99?'99+':String(n);count.hidden=n===0}
    const list=document.getElementById('gsNotificationList'),empty=document.getElementById('gsNotificationEmpty');
    if(!list)return;
    list.innerHTML=notices.length?notices.map(n=>'<article class="gs-notice '+(n.read?'':'unread')+'" data-id="'+esc(n.id)+'"><div class="gs-notice-copy"><strong>'+esc(n.title)+'</strong><p>'+esc(n.body)+'</p><time>'+esc(new Date(n.createdAt).toLocaleString())+'</time></div><div><button type="button" data-action="open" data-id="'+esc(n.id)+'">Open</button><button type="button" data-action="read" data-id="'+esc(n.id)+'">'+(n.read?'Read':'Mark read')+'</button></div></article>').join(''):'';
    if(empty)empty.hidden=notices.length>0;
  }
  function open(){const layer=document.getElementById('gsNotificationLayer');if(layer){layer.classList.add('open');layer.setAttribute('aria-hidden','false');render();document.getElementById('gsNotificationClose')?.focus()}}
  function close(){const layer=document.getElementById('gsNotificationLayer');if(layer){layer.classList.remove('open');layer.setAttribute('aria-hidden','true');document.getElementById('gsNotificationButton')?.focus()}}
  function notify(data){
    const n={id:(crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random()),title:String(data?.title||'GenSolar update'),body:String(data?.body||''),type:String(data?.type||'general'),href:String(data?.href||''),createdAt:Date.now(),read:false};
    notices.unshift(n);save();
    if('Notification' in window && Notification.permission==='granted' && document.visibilityState==='hidden'){
      try{new Notification(n.title,{body:n.body,tag:n.id})}catch(_){}
    }
    window.dispatchEvent(new CustomEvent('gensolar:notification-added',{detail:n}));
    return n.id;
  }
  function mount(){
    const head=document.querySelector('#app .ahead');
    if(head&&!document.getElementById('gsNotificationButton')){
      const button=document.createElement('button');button.id='gsNotificationButton';button.type='button';button.setAttribute('aria-label','Open notifications');button.setAttribute('aria-expanded','false');
      button.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg><span id="gsNotificationCount" hidden></span>';
      button.addEventListener('click',open);head.appendChild(button);
    }
    if(!document.getElementById('gsNotificationLayer')){
      const layer=document.createElement('div');layer.id='gsNotificationLayer';layer.setAttribute('aria-hidden','true');
      layer.innerHTML='<div id="gsNotificationScrim"></div><section id="gsNotificationPanel" role="dialog" aria-modal="true" aria-labelledby="gsNotificationTitle"><header><h2 id="gsNotificationTitle">Notifications</h2><button id="gsNotificationClose" type="button" aria-label="Close notifications">×</button></header><div id="gsNotificationActions"><button id="gsMarkAllRead" type="button">Mark all as read</button><button id="gsEnableNotifications" type="button">Enable device notifications</button><button id="gsClearNotifications" type="button">Clear inbox</button></div><div id="gsNotificationList"></div><div id="gsNotificationEmpty">You’re all caught up. New lead assignments, follow-ups and project updates will appear here.</div></section>';
      document.body.appendChild(layer);
      layer.querySelector('#gsNotificationScrim').addEventListener('click',close);
      layer.querySelector('#gsNotificationClose').addEventListener('click',close);
      layer.querySelector('#gsMarkAllRead').addEventListener('click',()=>{notices=notices.map(n=>({...n,read:true}));save()});
      layer.querySelector('#gsClearNotifications').addEventListener('click',()=>{notices=[];save()});
      layer.querySelector('#gsEnableNotifications').addEventListener('click',async()=>{if(!('Notification'in window)){alert('Device notifications are not supported in this browser.');return}try{const p=await Notification.requestPermission();alert(p==='granted'?'Device notifications enabled.':'Notification permission was not granted.')}catch(_){alert('Could not request notification permission.')}});
      layer.querySelector('#gsNotificationList').addEventListener('click',e=>{const b=e.target.closest('button[data-action]');if(!b)return;const n=notices.find(x=>x.id===b.dataset.id);if(!n)return;if(b.dataset.action==='read'){n.read=true;save()}else{n.read=true;save();close();if(n.href)location.href=n.href}});
      document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
    }
    render();
  }
  notices=safeRead();
  window.GenSolarNotifications={notify,open,close,markAllRead(){notices=notices.map(n=>({...n,read:true}));save()},getAll(){return notices.slice()}};
  window.addEventListener('gensolar:notification',e=>notify(e.detail||{}));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
