/* Source-backed series size, independent of shelf ownership. */
(function(root){
 'use strict';
 const series=typeof module!=='undefined'?require('./series.js'):root.BookSeries;
 const norm=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim();
 const canonical=value=>value==='Standalone within a series'?'Interconnected standalones':value;
 const auditOK=a=>!a||['verified-direct','supported-summary','catalog-stated','reader-corrected'].includes(a.status);
 const direct=[{author:'H.D. Carlton',names:['Cat and Mouse','Cat and Mouse Duet','Cat & Mouse Duet'],titles:['Haunting Adeline','Hunting Adeline'],name:'Cat and Mouse Duet',type:'Duet',count:2,source:'https://www.penguinrandomhouse.com/books/814766/hunting-adeline-by-hd-carlton/',checked:'2026-10-31'}];
 for(const row of direct)if(!series.catalog.some(s=>norm(s.author)===norm(row.author)&&norm(s.name)===norm(row.name)))series.catalog.push({name:row.name,author:row.author,source:row.source,checked:row.checked,status:'source-roster-reviewed',complete:false,scope:'Confirmed two-book main story only; prequels and companions are excluded from this roster.',entries:row.titles.map((title,i)=>({title,volume:i+1,readingOrder:i+1,kind:'main novel',source:row.source,libraryIds:[],rosterOnly:true}))});
 const index=new Map();for(const row of series.catalog){const key=norm(row.author)+'|'+norm(row.name);if(!index.has(key))index.set(key,row);}
 function info(book){
  const known=Boolean(book.series&&!book.structureConflict&&auditOK(book.verification?.fields?.format)&&(book.format==='Series'||book.seriesEvidenceStatus));
  const independentlyReadable=Boolean(book.series&&book.standaloneReadable===true&&auditOK(book.verification?.fields?.standaloneReadable));if(!known)return {known:false,type:null,count:null,minimum:null,source:null,interconnected:independentlyReadable};
  const order=index.get(norm(book.author)+'|'+norm(book.series));
  const explicit=direct.find(s=>norm(s.author)===norm(book.author)&&s.names.some(name=>norm(name)===norm(book.series)));
  const declared=book.catalogSeriesClaim&&norm(book.catalogSeriesClaim.name)===norm(book.series)?book.catalogSeriesClaim:null;const declaredType=declared&&/\bduet$/.test(norm(declared.name))?'Duet':declared&&/\btrilogy$/.test(norm(declared.name))?'Trilogy':null;let type=explicit?.type||declaredType,count=explicit?.count||(declaredType==='Duet'?2:declaredType==='Trilogy'?3:null),minimum=null;
  // Explicit author/publisher series names establish intended main-story size;
  // neither a two/three-title partial roster nor owned-copy count does.
  const trusted=order&&['author-publisher-checked','source-roster-reviewed'].includes(order.status);
  if(explicit||declaredType){}
  else if(trusted&&/\bduet\b/.test(norm(order.name))){type='Duet';count=2;}
  else if(trusted&&/\btrilogy\b/.test(norm(order.name))){type='Trilogy';count=3;}
  else if(trusted){const main=new Set(order.entries.filter(e=>e.kind==='main novel'&&Number.isInteger(e.volume)&&e.volume>=1&&!/\b(?:epilogue|bonus|novella|prequel|omnibus|boxset)\b/.test(norm(e.title))).map(e=>norm(e.title)));if(main.size>=4){type='Longer series';minimum=main.size;}}
  const interconnected=book.standaloneReadable===true&&auditOK(book.verification?.fields?.standaloneReadable);
  return {known:true,type,count,minimum,source:explicit?.source||(trusted?order.source:null)||declared?.source||null,checked:explicit?.checked||order?.checked||null,interconnected};
 }
 function values(book){const s=info(book);return [...new Set([...(book.format?[book.format]:[]),...(s.known?[s.type||'Series, length unknown']:[]),...(s.interconnected?['Interconnected standalones']:[])])];}
 function match(book,value){const s=info(book),v=canonical(value);if(v==='Interconnected standalones')return {pass:s.interconnected,unknown:!auditOK(book.verification?.fields?.standaloneReadable)||!book.series||book.standaloneReadable==null};if(['Duet','Trilogy','Longer series'].includes(v))return {pass:s.type===v,unknown:!s.known||!s.type};if(v==='Series, length unknown')return {pass:s.known&&!s.type,unknown:!s.known};return null;}
 function enrich(book){
  const directMember=direct.find(s=>norm(s.author)===norm(book.author)&&s.titles.some(t=>[book.title,book.rawTitle,...(book.aliases||[])].some(value=>norm(String(value||'').replace(/\s*\([^)]*\)\s*$/,''))===norm(t))));
  if(directMember&&!book.structureConflict&&!book.series&&!book.format){book.series=directMember.name;book.format='Series';book.volume=directMember.titles.findIndex(t=>[book.title,book.rawTitle,...(book.aliases||[])].some(value=>norm(String(value||'').replace(/\s*\([^)]*\)\s*$/,''))===norm(t)))+1||null;book.seriesEvidenceStatus='source-reviewed';book.sources=[...new Set([...(book.sources||[]),directMember.source])];for(const [field,value] of Object.entries({series:book.series,format:'Series',volume:book.volume}))book.verification.fields[field]={value,status:'supported-summary',rationale:'Publisher identifies Haunting Adeline as the first book and Hunting Adeline as the second and final main installment.',evidence:[directMember.source]};}
  const s=info(book);book.storyStructure=s.type;if(s.type&&s.source){book.verification.fields.seriesStructure={value:s.type,status:book.userSeriesCorrected?'reader-corrected':book.catalogSeriesClaim&&!index.has(norm(book.author)+'|'+norm(book.series))?'catalog-stated':'supported-summary',rationale:s.count?`Author/publisher names this a ${s.type.toLowerCase()} (${s.count} main books). Prequels, novellas, bonus books and shelf ownership do not determine this count.`:`Source-listed sequence establishes at least ${s.minimum} numbered main novels; no final total is claimed.`,evidence:[s.source]};}return book;
 }
 const api={info,values,match,enrich,canonical};if(typeof module!=='undefined')module.exports=api;else root.StoryStructure=api;
})(typeof globalThis!=='undefined'?globalThis:this);
