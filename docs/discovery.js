(function(root){
'use strict';
const catalog=typeof module!=='undefined'?require('./catalog.js'):root.BookCatalog,C=typeof module!=='undefined'?require('./core.js'):root.BookCore;
const {books}=catalog;
const starterTitles=['Nocticadia','Butcher & Blackbird','Book Lovers','Legends & Lattes','A Psalm for the Wild-Built'];
function hasTaste(p){return ['favoriteAuthors','favoriteGenres','favoriteMoods','favoriteTropes','favoriteAtmospheres','favoriteDynamics','favoriteRelationships','favoriteFormats'].some(k=>(p[k]||[]).length)||(p.recentRequests||[]).length>0||(p.searchHistory||[]).length>0||(p.saved||[]).length>0||Boolean(root.ReaderFeedback?.hasTaste);}
let cachedKey=null,cachedRows=null;
function ranked(p){
 const key=JSON.stringify(p)+'|'+(root.ReaderFeedback?.revision||0)+'|'+books.length+'|'+(root.DiscoverLearning?.revision||0)+'|'+(root.PersonalLibrary?.revision||0);if(key===cachedKey&&cachedRows)return cachedRows.slice();
 const recent=(p.recentRequests||[]).slice(-6),saved=(p.saved||[]).map(id=>books.find(b=>b.id===id)).filter(Boolean);const evidence=new Map();
 recent.forEach((request,i)=>{const weight=12+(i+1)*2;const rows=request.kind==='description'?C.describeRecommendations(p,request.query).rows:C.recommendations(p,{...C.emptyCriteria(),...request.criteria});for(const r of rows){if(r.hardFail||!r.matched.length)continue;const list=evidence.get(r.book.id)||[];list.push({score:weight*r.score,reason:'Your recent search: '+r.matched.slice(0,3).map(x=>x.value).join(' · ')});evidence.set(r.book.id,list);}});
 const personalized=hasTaste(p);const result=C.recommendations(p,C.emptyCriteria()).map(r=>{const b=r.book,reasons=[];let score=r.personal;const learned=r.affinity||root.DiscoverLearning?.affinity(b,p);if(learned){score+=learned.score;reasons.push(...learned.reasons);}
 if(r.personal>0)reasons.push(...C.personalReasons(b,p).filter(x=>!x.startsWith('A title from')));
 const matches=evidence.get(b.id)||[];if(matches.length){score+=matches.reduce((n,x)=>n+x.score,0);reasons.push(matches.at(-1).reason);}
 let best=null;for(const s of saved){if(s.id===b.id)continue;const tropes=b.tropes.filter(t=>s.tropes.includes(t)),moods=b.moods.filter(t=>s.moods.includes(t));const value=(b.author===s.author?10:0)+Math.min(tropes.length*3,12)+Math.min(moods.length*2,6);if(value&&(!best||value>best.value))best={value,reason:(b.author===s.author?'Shares an author':tropes.length?'Shares '+tropes.slice(0,2).join(' / '):'Shares '+moods.slice(0,2).join(' / ')+' moods')+' with '+s.title+', which you saved.'};}
 if(best){score+=best.value;reasons.push(best.reason);}const starter=starterTitles.indexOf(b.title);if(!personalized&&starter>=0)score=100-starter;
 return {book:b,score,reasons:reasons.length?reasons:[personalized?'A different direction to explore alongside your recent choices.':'An editorial starting point: '+(b.genres[0]||'a new story')+'.'],starter:!personalized&&starter>=0};
 }).sort((a,b)=>b.score-a.score||a.book.title.localeCompare(b.book.title));cachedKey=key;cachedRows=result;return result.slice();
}
function diverse(rows,limit=5){const selected=[],writers=new Set(),seen=new Set();for(const row of rows){if(writers.has(row.book.author))continue;selected.push(row);writers.add(row.book.author);seen.add(row.book.id);if(selected.length===limit)return selected;}for(const row of rows){if(seen.has(row.book.id))continue;selected.push(row);if(selected.length===limit)break;}return selected;}
function explore(p,mode='broad'){
 const rows=ranked(p);if(mode==='title')return rows.sort((a,b)=>a.book.title.localeCompare(b.book.title));if(mode==='taste')return rows;if(mode==='different'&&hasTaste(p))return rows.sort((a,b)=>a.score-b.score||a.book.title.localeCompare(b.book.title));
 // Interleave authors for broad browsing, retaining the complete shared collection.
 const queues=new Map();for(const row of rows){if(!queues.has(row.book.author))queues.set(row.book.author,[]);queues.get(row.book.author).push(row);}const mixed=[];while(mixed.length<rows.length)for(const queue of queues.values())if(queue.length)mixed.push(queue.shift());return mixed;
}
const api={ranked,diverse,explore,hasTaste};if(typeof module!=='undefined')module.exports=api;else root.DiscoveryFeed=api;
})(typeof globalThis!=='undefined'?globalThis:this);
