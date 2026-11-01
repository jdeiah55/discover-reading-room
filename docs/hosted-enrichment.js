'use strict';
(() => {
 const panel=document.getElementById('metadata-review'),box=document.createElement('div');box.className='enrichment-batch';
 box.innerHTML='<h3>A richer shelf, without the paperwork.</h3><p>Automatically add clearly supported details across your library. Uncertain suggestions stay aside; your own notes and reviewed data are kept.</p><label class="batch-ai-choice"><input type="checkbox" id="batch-use-ai" checked> Find more story details with AI</label><label class="batch-ai-choice"><input type="checkbox" id="batch-auto-new"> Keep new books updated after I add them</label><div class="batch-actions"><button type="button" id="enrich-library" class="gold-button">Automatically enrich my library ✧</button><button type="button" id="batch-pause" class="outline-button" hidden>Pause</button><button type="button" id="batch-resume" class="outline-button" hidden>Resume library queue</button><button type="button" id="batch-undo" class="text-button" hidden>Undo automatic labels from this run</button></div><p id="batch-status" role="status" aria-live="polite"></p><progress id="batch-progress" max="5" value="0" hidden aria-label="Library enrichment progress"></progress><label id="batch-history-label" hidden>Earlier results <select id="batch-history"></select></label><div id="batch-results"></div>';
 panel.querySelector('p').after(box);
 const $=id=>document.getElementById(id),KEY='discover-enrichment-batches-v1';
 let saved={job:null,done:[],autoDone:[],reviewed:[],history:[],processed:{},held:{},disabledRuns:[],itemKeys:{},identityVersion:2,automationVersion:1,autoNew:true,queue:null},job=null,poll=null,nextTimer=null,csrf=(window.DiscoverStorage||localStorage).getItem('discover-hosted-token:'+window.DiscoverMetadataOrigin)||'',busy=false,applying=false,advancing=false,notice='',ownsWriter=false,writerAttempt=null,autoTimer=null;
 const identity=b=>BookCore.normalize(String(b.title).replace(/\s*\([^)]*(?:#\d|book\s*\d)[^)]*\)\s*$/i,''))+'|'+BookCore.normalize(b.author);
 const validID=s=>typeof s==='string'&&/^[a-f0-9]{32}$/.test(s);
 const strings=x=>Array.isArray(x)?x.filter(v=>typeof v==='string').slice(0,10000):[];
 try{
  const raw=JSON.parse((window.DiscoverStorage||localStorage).getItem(KEY)||'null');if(raw){
   saved.autoNew=raw.automationVersion===1?raw.autoNew!==false:true;saved.disabledRuns=strings(raw.disabledRuns).filter(validID);for(const k of ['done','autoDone','reviewed'])saved[k]=strings(raw[k]);saved.job=validID(raw.job)?raw.job:null;saved.history=strings(raw.history).filter(validID).slice(-1000);
   if(raw.processed&&typeof raw.processed==='object')for(const [id,list] of Object.entries(raw.processed))if(validID(id))saved.processed[id]=strings(list).slice(0,5);
   if(raw.held&&typeof raw.held==='object')for(const [key,n] of Object.entries(raw.held))if(Number.isInteger(n)&&n>=0&&n<=100)saved.held[key]=n;
   if(raw.itemKeys&&typeof raw.itemKeys==='object')for(const [id,keys] of Object.entries(raw.itemKeys))if(validID(id)&&keys&&typeof keys==='object')saved.itemKeys[id]=Object.fromEntries(Object.entries(keys).filter(([k,v])=>typeof v==='string'&&k.length<1000&&v.length<1000).slice(0,5));if(raw.identityVersion!==2&&saved.job)delete saved.processed[saved.job];
   const q=raw.queue;if(q&&validID(q.id)&&Array.isArray(q.remaining)&&Number.isInteger(q.total)&&q.total>=0&&q.total<=10000)saved.queue={id:q.id,remaining:strings(q.remaining),total:q.total,skipped:Number.isInteger(q.skipped)?q.skipped:0,currentJob:validID(q.currentJob)?q.currentJob:null,paused:true,large:q.large===true,useAI:q.useAI!==false};
  }
 }catch{}
 const automaticToggle=$('batch-auto-new');automaticToggle.parentElement.lastChild.textContent=' Automatically enrich imported and newly added books';
 const privacy=document.createElement('p');privacy.className='small-muted';privacy.textContent='Book titles and authors are looked up online automatically. Pause here or turn this off at any time; your notes and preferences stay in this browser.';automaticToggle.parentElement.after(privacy);
 const summary=document.createElement('p');summary.id='auto-enrichment-status';summary.className='small-muted';summary.setAttribute('role','status');$('import-status').after(summary);
 new MutationObserver(()=>{summary.textContent=$('batch-status').textContent;}).observe($('batch-status'),{childList:true,subtree:true,characterData:true});
 async function ensureWriter(){
  if(ownsWriter)return true;if(writerAttempt)return writerAttempt;if(!navigator.locks){ownsWriter=true;return true;}
  writerAttempt=new Promise(resolve=>{navigator.locks.request('discover-automatic-metadata-writer'+(window.DiscoverStorage?.scope||''),{ifAvailable:true},async lock=>{if(!lock){resolve(false);return;}ownsWriter=true;resolve(true);await new Promise(()=>{});}).catch(()=>resolve(false));}).finally(()=>{writerAttempt=null;});return writerAttempt;
 }
 const persist=()=>{if(job?.automatic&&!ownsWriter)return true;try{(window.DiscoverStorage||localStorage).setItem(KEY,JSON.stringify(saved));return true;}catch{return false;}};
 async function request(path,data){
  if(!/^https?:$/.test(location.protocol))throw Error('Start Discover locally to enrich your shelf. Saved recommendations still work offline.');
  const response=await fetch(window.DiscoverMetadataOrigin+'/api/enrichment/'+path,{method:data?'POST':'GET',headers:{...(data?{'Content-Type':'application/json'}:{}),'X-Discover-Token':csrf},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(path==='config'?120000:20000)});
  let result;try{result=await response.json();}catch{throw Error('Restart Discover to enable automatic enrichment.');}
  if(!response.ok)throw Error(response.status===403?'Batch not found. Reconnect and resume your saved queue.':result.error||'The queue could not be opened.');return result;
 }
 async function configure(useAI){const config=await request('config');csrf=config.csrf;(window.DiscoverStorage||localStorage).setItem('discover-hosted-token:'+window.DiscoverMetadataOrigin,csrf);if(!config.googleBooks)throw Error('Save your Google Books key using API setup first.');if(useAI&&!config.gemini)throw Error('Save your Gemini key and model, or turn off AI extraction.');}
 const findBook=item=>PersonalLibrary.books.find(b=>[b.title,b.rawTitle,PersonalLibrary.entry(b.id)?.title,...(b.aliases||[])].filter(Boolean).some(title=>identity({title,author:b.author})===identity(item)));
 const itemKey=item=>saved.itemKeys[job?.id]?.[identity(item)]||(findBook(item)?identity(findBook(item)):identity(item));
 function hasAutomatic(assignment,id=null){return PersonalLibrary.books.some(b=>(!id||b.id===id)&&(b.automaticMetadata||[]).some(c=>c.assignment===assignment));}
 const eligible=b=>!saved.autoDone.includes(identity(b))||b.metadataDetailsVersion<BookDetails.VERSION;
 function buttons(){
  const active=job&&['running','pausing'].includes(job.state),q=saved.queue,pending=q?.remaining.length>0,hasNew=PersonalLibrary.books.some(eligible);
  $('enrich-library').disabled=busy||advancing||active||Boolean(saved.job&&!job)||!PersonalLibrary.loaded||Boolean(pending)||!hasNew;
  $('enrich-library').textContent=q&&!pending?(hasNew?'Update book details ✧':'Library checked ✓'):'Automatically enrich my library ✧';
  $('enrich-library').hidden=saved.autoNew;
  $('batch-pause').hidden=!active&&!(pending&&!q.paused);$('batch-pause').disabled=busy||job?.state==='pausing';
  $('batch-resume').hidden=!(pending&&q.paused)&&job?.state!=='paused';$('batch-resume').disabled=busy||advancing;
  $('batch-undo').hidden=!job?.automatic||!hasAutomatic(job.assignment||job.id);$('batch-undo').disabled=busy||advancing;
  $('batch-use-ai').disabled=Boolean(pending||active);
 }
 function applyAvailable(){
  if(!ownsWriter||!job?.automatic||applying||saved.disabledRuns.includes(job.assignment||job.id))return;
  if(PersonalLibrary.summary?.persistent===false){if(saved.queue)saved.queue.paused=true;notice='Browser storage could not save your latest changes. Download a backup before continuing.';return;}const processed=saved.processed[job.id]||[],updates=[],finished=[];let unresolved=false;if(processed.includes('*'))return;
  for(const item of job.items){
   const key=itemKey(item);if(item.state!=='done'||processed.includes(key))continue;
   const book=findBook(item);if(book&&item.report){try{const result=AutomaticMetadata.screen(item.report);updates.push({id:book.id,details:BookDetails.extract(item.report),claims:result.claims.map(c=>({...c,assignment:job.assignment||job.id}))});saved.held[key]=result.held;}catch{saved.held[key]=1;}}
   finished.push({key,owned:Boolean(book)});
  }
  if(!finished.length)return;
  applying=true;
  try{
   const result=updates.length?PersonalLibrary.assignAutomatic(updates):{persistent:true,added:0};
   for(const item of finished){processed.push(item.key);if(item.owned&&!saved.autoDone.includes(item.key))saved.autoDone.push(item.key);
    const q=saved.queue;if(q&&q.id===(job.assignment||job.id)){const index=q.remaining.indexOf(item.key);if(index>=0){q.remaining.splice(index,1);if(!item.owned)q.skipped++;}else if(!item.owned&&q.remaining.length)unresolved=true;}
   }
   if(unresolved){saved.queue.paused=true;notice='This lookup could not be reconciled to your shelf. Your progress is kept; no repeated lookup was started.';}saved.processed[job.id]=job.items.every(item=>item.state==='done')?['*']:processed;
   if(!result.persistent||!persist()){
    if(saved.queue)saved.queue.paused=true;notice='Browser storage is full. Download a complete backup before closing this page; enrichment has paused.';
    if(['running','pausing'].includes(job.state))request('jobs/'+job.id+'/pause',{}).catch(()=>{});
   }
  }finally{applying=false;}
 }
 function render(){
  applyAvailable();buttons();if(!job)return;
  if(!saved.history.includes(job.id))saved.history.push(job.id);
  $('batch-history-label').hidden=saved.history.length<2;const history=$('batch-history');history.replaceChildren();for(const [i,id] of saved.history.entries()){const option=document.createElement('option');option.value=id;option.textContent='Results '+(i+1);history.append(option);}history.value=job.id;
  history.disabled=Boolean(saved.queue?.remaining.length&&!saved.queue.paused);
  const completed=job.items.filter(i=>i.state==='done');if(!job.automatic)for(const item of completed){const key=identity(item);if(!saved.done.includes(key))saved.done.push(key);}persist();
  const q=saved.queue,ownQueue=q&&q.id===(job.assignment||job.id),total=ownQueue?q.total:job.items.length,done=ownQueue?q.total-q.remaining.length-q.skipped:completed.length;
  const count=PersonalLibrary.books.reduce((n,b)=>n+(b.automaticMetadata?.length||0),0);
  $('batch-progress').hidden=false;$('batch-progress').max=total||1;$('batch-progress').value=done+(ownQueue?q.skipped:0);
  const stateText=job.message||(ownQueue&&q.paused&&q.remaining.length?'Paused. Your place is saved.':ownQueue&&!q.remaining.length?'Your shelf is ready. Uncertain details can be reviewed whenever you like.':job.state==='complete'?'These results are ready.':'Finding the details between the lines…');
  $('batch-status').textContent=notice||`${done} of ${total} books checked · ${count} automatic labels on your shelf. ${ownQueue&&q.skipped?q.skipped+' unavailable books skipped. ':''}${stateText}`;
  const results=$('batch-results');results.replaceChildren();
  for(const item of job.items){
   const row=document.createElement('div');row.className='batch-book';const title=document.createElement('strong');title.textContent=item.title;const info=document.createElement('span');info.textContent=item.author+' · '+(item.state==='done'?'Checked':item.state==='running'?'Looking up…':'Waiting');row.append(title,info);
   const book=findBook(item),held=saved.held[itemKey(item)]||0;
   if(item.report){const review=document.createElement('button');review.type='button';review.className='text-button';review.textContent=held?'Optional details and sources ↗':'View details and sources ↗';review.disabled=!book;if(!book)review.textContent='No longer on your shelf';review.onclick=()=>{try{MetadataReview.show(item.report);$('metadata-review-body').scrollIntoView({behavior:'smooth',block:'start'});}catch(e){notice=e.message;render();}};row.append(review);}
   if(book&&job.automatic&&hasAutomatic(job.assignment||job.id,book.id)){const undo=document.createElement('button');undo.type='button';undo.className='text-button';undo.textContent='Undo automatic labels for this book';undo.onclick=()=>undoLabels(job.assignment||job.id,book.id);row.append(undo);}
   if(item.report?.classificationStatus){const note=document.createElement('small');note.textContent=item.report.classificationStatus;row.append(note);}results.append(row);
  }
 }
 async function undoLabels(assignment,id=null){if(!await ensureWriter()){notice='Another Discover tab is managing these labels. Close that tab before changing them here.';render();return;}if(!id&&saved.queue?.id===assignment){saved.queue.paused=true;if(!saved.disabledRuns.includes(assignment))saved.disabledRuns.push(assignment);persist();await control('pause');}applying=true;try{const result=PersonalLibrary.undoAutomatic(assignment,id);notice=result.persistent?'Automatic labels removed. Your notes and reviewed classifications are kept.':'Removed for this visit only; save a backup before closing this page.';}finally{applying=false;}render();}
 function schedule(){clearTimeout(poll);clearTimeout(nextTimer);if(job&&['running','pausing'].includes(job.state))poll=setTimeout(refresh,1800);else if(job?.state==='complete'&&saved.queue&&!saved.queue.paused&&saved.queue.remaining.length&&job.id===saved.queue.currentJob)nextTimer=setTimeout(nextChunk,800);else if(saved.autoNew&&job?.state==='complete'&&!saved.queue?.remaining.length&&PersonalLibrary.books.some(eligible))nextTimer=setTimeout(()=>$('enrich-library').click(),800);}
 async function refresh(){try{job=await request('jobs/'+saved.job);notice='';if(job.automatic&&!await ensureWriter())notice='Another Discover tab is managing these automatic labels. Close that tab before resuming here.';render();schedule();}catch(e){if(/Batch not found/.test(e.message)){saved.job=null;job=null;csrf='';(window.DiscoverStorage||localStorage).removeItem('discover-hosted-token:'+window.DiscoverMetadataOrigin);if(saved.queue){saved.queue.currentJob=null;saved.queue.paused=true;}persist();}notice=e.message+' Resume to reconnect; applied labels are kept.';$('batch-status').textContent=notice;buttons();}}
 async function nextChunk(){
  if(advancing||!saved.queue||saved.queue.paused)return;advancing=true;buttons();
  const start=async()=>{if(!await ensureWriter())throw Error('Another Discover tab is managing this queue. Close that tab before continuing here.');
   // Web Locks serializes queue advancement across tabs on localhost.
   try{const raw=JSON.parse((window.DiscoverStorage||localStorage).getItem(KEY)||'null');if(raw?.queue?.id===saved.queue.id&&raw.queue.currentJob!==saved.queue.currentJob){saved.queue=raw.queue;saved.job=raw.job;await refresh();return;}}catch{}
   const q=saved.queue,owned=new Map(PersonalLibrary.books.map(b=>[identity(b),b]));const valid=q.remaining.filter(key=>owned.has(key));q.skipped+=q.remaining.length-valid.length;q.remaining=valid;
   if(!q.remaining.length){persist();render();return;}
   const books=q.remaining.slice(0,5).map(key=>owned.get(key));
   const previous=Object.values(saved.itemKeys[q.currentJob]||{}).sort().join('\n'),next=books.map(identity).sort().join('\n');if(job?.state==='complete'&&job.id===q.currentJob&&previous&&previous===next)throw Error('The completed lookup could not advance this queue. Processing paused to avoid repeating it. Your earlier progress is kept.');
   await configure(q.useAI);job=await request('jobs',{books:books.map(b=>({title:b.rawTitle||b.title,author:b.author})),useAI:q.useAI,automatic:true,cachedOpenLibrary:q.large,assignment:q.id});
   if(job.automatic!==true)throw Error('Restart Discover to enable automatic assignments before continuing.');saved.itemKeys[job.id]=Object.fromEntries(books.map(b=>[identity({title:b.rawTitle||b.title,author:b.author}),identity(b)]));saved.job=job.id;q.currentJob=job.id;persist();notice='';render();schedule();
  };
  try{if(navigator.locks)await navigator.locks.request('discover-enrichment-queue'+(window.DiscoverStorage?.scope||''),start);else await start();}
  catch(e){if(saved.queue)saved.queue.paused=true;persist();notice=e.message;$('batch-status').textContent=notice;}
  finally{advancing=false;buttons();}
 }
 $('enrich-library').onclick=async()=>{
  if(busy||advancing)return;busy=true;notice='';buttons();
  try{
   const fields=['genres','atmospheres','tropes','dynamics','relationships'];const candidates=PersonalLibrary.books.filter(eligible).sort((a,b)=>fields.filter(f=>!(b[f]||[]).length).length-fields.filter(f=>!(a[f]||[]).length).length||a.title.localeCompare(b.title));
   if(!candidates.length)throw Error('Every book has been checked for automatic labels. Add new books to continue.');
   if(PersonalLibrary.summary?.persistent===false)throw Error('Save a complete backup and resolve browser storage before starting automatic enrichment.');if(!await ensureWriter())throw Error('Another Discover tab is managing this queue. Close that tab before continuing here.');await configure($('batch-use-ai').checked);const id=Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');
   saved.queue={id,remaining:candidates.map(identity),total:candidates.length,skipped:0,currentJob:null,paused:false,large:candidates.length>5,useAI:$('batch-use-ai').checked};
   if(!persist())throw Error('Browser storage could not save the queue. Download a backup and free some space before continuing.');await nextChunk();
  }catch(e){notice=e.message;$('batch-status').textContent=notice;}finally{busy=false;buttons();}
 };
 async function control(action){
  if(busy)return;busy=true;notice='';clearTimeout(nextTimer);buttons();
  try{
   if(!await ensureWriter())throw Error('Another Discover tab is managing this queue. Close that tab before continuing here.');const q=saved.queue;if(q){q.paused=action==='pause';if(action==='resume')saved.disabledRuns=saved.disabledRuns.filter(id=>id!==q.id);}persist();
   if(action==='resume'&&q){const keys=new Set(PersonalLibrary.books.map(identity)),remaining=q.remaining.filter(key=>keys.has(key));q.skipped+=q.remaining.length-remaining.length;q.remaining=remaining;if(!remaining.length){q.paused=true;persist();render();return;}if(!q.currentJob){await nextChunk();render();schedule();return;}}
   if(q?.currentJob){saved.job=q.currentJob;job=await request('jobs/'+saved.job);} 
   if(action==='pause'){if(job&&['running','pausing'].includes(job.state)){if(!csrf)await configure(job.useAI);job=await request('jobs/'+job.id+'/pause',{});}}
   else if(job?.state==='paused'){await configure(job.useAI);job=await request('jobs/'+job.id+'/resume',{});}
   else if(q?.remaining.length&&(!job||job.state==='complete'))await nextChunk();
   render();schedule();
  }catch(e){if(saved.queue)saved.queue.paused=true;persist();notice=e.message;$('batch-status').textContent=notice;}finally{busy=false;buttons();}
 }
 $('batch-pause').onclick=()=>control('pause');$('batch-resume').onclick=()=>control('resume');$('batch-undo').onclick=()=>undoLabels(job.assignment||job.id);
 $('batch-history').onchange=async e=>{clearTimeout(poll);clearTimeout(nextTimer);saved.job=e.target.value;persist();await refresh();};
 window.addEventListener('metadata-reviewed',()=>{if(!applying)render();});
 function queueAutomatic(){
  clearTimeout(autoTimer);if(!saved.autoNew||!PersonalLibrary.loaded)return;
  autoTimer=setTimeout(async()=>{
   if(!saved.autoNew||!PersonalLibrary.loaded)return;
   if(busy||advancing||applying){queueAutomatic();return;}
   const pending=PersonalLibrary.books.filter(eligible),q=saved.queue;
   if(q?.remaining.length||job&&['running','pausing','paused'].includes(job.state)){
    if(q){const known=new Set(q.remaining);for(const b of pending){const key=identity(b);if(!known.has(key)){q.remaining.push(key);known.add(key);q.total++;}}persist();render();}return;
   }
   if(!pending.length)return;
   // Do not silently restart a queue the reader explicitly paused or undid.
   if(q?.paused||saved.disabledRuns.includes(q?.id))return;
   $('enrich-library').onclick();
  },400);
 }
 $('batch-auto-new').checked=saved.autoNew;$('batch-auto-new').onchange=()=>{saved.autoNew=$('batch-auto-new').checked;persist();if(saved.autoNew)queueAutomatic();else{clearTimeout(autoTimer);if(saved.queue?.remaining.length)control('pause');}buttons();};
 window.addEventListener('personal-library-change',()=>{if(applying)return;
  if(!PersonalLibrary.loaded){clearTimeout(autoTimer);if(saved.queue?.remaining.length)control('pause');buttons();return;}
  if(!['automatic','remove'].includes(PersonalLibrary.change))queueAutomatic();
  buttons();if(job)render();
 });
 panel.addEventListener('toggle',()=>{if(panel.open&&saved.job&&!job)refresh();});
 buttons();if(saved.job)refresh();else queueAutomatic();
})();
