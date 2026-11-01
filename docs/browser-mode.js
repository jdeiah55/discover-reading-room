'use strict';
(() => {
 const query=new URLSearchParams(location.search),mode=query.get('demo')==='1'?'demo':query.get('mode')==='previous'?'previous':'personal';
 const prefix=mode==='demo'?'discover-demo-v1:':mode==='personal'?'discover-personal-v2:':'';
 window.DiscoverStorage={scope:prefix,mode,getItem:key=>localStorage.getItem(prefix+key),setItem:(key,value)=>localStorage.setItem(prefix+key,value),removeItem:key=>localStorage.removeItem(prefix+key)};
 window.addEventListener('DOMContentLoaded',()=>{
  const host=document.getElementById('library-import');if(!host)return;
  const row=document.createElement('p');row.className='small-muted';row.id='library-mode';
  const label=document.createElement('strong');label.textContent=mode==='demo'?'Demonstration library':mode==='previous'?'Previous saved library':'Your personal library';row.append(label,document.createTextNode(' · '));
  const link=(text,params)=>{const a=document.createElement('a');const u=new URL(location.href);u.hash='';u.search='';for(const [key,value] of Object.entries(params))u.searchParams.set(key,value);const version=query.get('v');if(version)u.searchParams.set('v',version);a.href=u.href;a.textContent=text;return a;};
  row.append(mode==='demo'?link('Open personal mode',{}):link('Open demo mode',{demo:'1'}));
  try{if(mode!=='previous'&&localStorage.getItem('discover-personal-library-v1'))row.append(document.createTextNode(' · '),link('Previous saved library',{mode:'previous'}));}catch{}
  host.prepend(row);
 });
})();
