'use strict';
(() => {
 const fields=['genres','moods','atmospheres','tropes','dynamics','relationships'],N=s=>BookCore.normalize(s),VERSION=1;
 const rules={
  genres:{'Romance':['romance','romance fiction','romantic fiction','fiction romance'],'Dark romance':['dark romance','dark mm romance','dark m m romance','dark ff romance','dark f f romance','dark mf romance','dark m f romance'],'Fantasy':['fantasy','fantasy fiction','fiction fantasy'],'Science fiction':['science fiction','sci fi','fiction science fiction'],'Dystopian':['dystopian','dystopia','dystopian fiction'],'Mystery':['mystery','mystery fiction','fiction mystery detective'],'Thriller':['thriller','thrillers'],'Horror':['horror'],'Historical fiction':['historical fiction'],'Contemporary romance':['contemporary romance','fiction romance contemporary'],'Fantasy romance':['fantasy romance','romantasy'],'Paranormal romance':['paranormal romance'],'Romantic comedy':['romantic comedy'],'Romantic suspense':['romantic suspense'],'Gothic romance':['gothic romance']},
  atmospheres:{'Dark academia':['dark academia'],'College':['college'],'University':['university'],'Small town':['small town'],'Boarding school':['boarding school'],'English countryside':['english countryside'],'Dystopian':['dystopian']},
  tropes:{'BDSM':['bdsm'],'Professor/student':['professor student','teacher student'],'Mafia':['mafia'],'Stalker':['stalker'],'Revenge':['revenge'],'Kidnapping':['kidnapping'],'Hidden identity':['hidden identity'],'Enemies-to-lovers':['enemies to lovers'],'Friends-to-lovers':['friends to lovers'],'Slow burn':['slow burn'],'Forbidden romance':['forbidden romance'],'Age gap':['age gap'],'Fake dating':['fake dating'],'Forced proximity':['forced proximity'],'Marriage of convenience':['marriage of convenience'],'Second chance':['second chance romance','second chance'],'Found family':['found family'],'Secret society':['secret society'],'Dark humor':['dark humor','dark humour'],'Grumpy × sunshine':['grumpy sunshine','grumpy x sunshine']},
  dynamics:{'Serial killer':['serial killer'],'Mafia boss':['mafia boss'],'Bodyguard':['bodyguard'],'Doctor':['doctor'],'Lawyer':['lawyer'],'Billionaire':['billionaire'],'Law student':['law student'],'Professor':['professor'],'Teacher':['teacher'],'Assassin':['assassin'],'Librarian':['librarian'],'Bookseller':['bookseller'],'Witch':['witch'],'Vampire':['vampire'],'Detective':['detective'],'Soldier':['soldier']},
  relationships:{'M/M':['m m romance','mm romance','male male romance','m m love story'],'F/F':['f f romance','ff romance','female female romance','f f love story'],'M/F':['m f romance','mf romance','male female romance']}
 };
 function validate(raw){const list=unpack(raw);if(!Array.isArray(list)||list.length>12)throw Error('Invalid automatic classifications.');return ApprovedMetadata.validate(list).map((c,i)=>{const assignment=list[i].assignment;if(!/^[a-f0-9]{32}$/.test(assignment||''))throw Error('Invalid automatic assignment.');return {...c,assignment};});}
 function unpack(raw){if(raw===undefined)return [];if(Array.isArray(raw))return raw;if(!raw||raw.v!==VERSION||!['s','q','j','c'].every(k=>Array.isArray(raw[k]))||raw.c.length>12||raw.s.length>12||raw.q.length>12||raw.j.length>12)throw Error('Invalid automatic metadata backup.');return raw.c.map(c=>{if(!Array.isArray(c)||c.length!==6||![c[0],c[2],c[3],c[4],c[5]].every(Number.isInteger))throw Error('Invalid automatic metadata reference.');return {field:fields[c[0]],label:c[1],source:raw.s[c[2]],quote:raw.q[c[3]],assignment:raw.j[c[4]],origin:c[5]===1?'ai':'catalog'};});}
 function pack(list){if(!list?.length)return undefined;const out={v:VERSION,s:[],q:[],j:[],c:[]};const index=(key,value)=>{let i=out[key].indexOf(value);if(i<0)i=out[key].push(value)-1;return i;};for(const c of list)out.c.push([fields.indexOf(c.field),c.label,index('s',c.source),index('q',c.quote),index('j',c.assignment),c.origin==='ai'?1:0]);return out;}
 function packedState(state){return {...state,entries:state.entries.map(e=>({...e,automaticMetadata:pack(e.automaticMetadata)}))};}
 function fingerprint(c){const value=c.field+'|'+N(c.label);let hash=2166136261;for(const ch of value)hash=Math.imul(hash^ch.codePointAt(0),16777619);return (hash>>>0).toString(16);}
 function suppressed(raw){if(raw===undefined)return [];if(!Array.isArray(raw)||raw.length>500||raw.some(x=>typeof x!=='string'||!/^[a-f0-9]{1,8}$/.test(x)))throw Error('Invalid automatic-label corrections.');return [...new Set(raw)];}
 function screen(report){
  const prepared=MetadataReview.prepare(report);prepared.options.push(...(window.BookDetails?.options(report)||[]));const book=PersonalLibrary.books.find(b=>b.id===prepared.entry.id),candidates=[],held=[];
  for(const rawOption of prepared.options){
   let option=rawOption;
   if(option.origin==='catalog'){const n=N(option.label);outer:for(const [field,table] of Object.entries(rules)){for(const [label,aliases] of Object.entries(table)){if([label,...aliases].some(value=>N(value)===n)){option={...option,field,label};break outer;}}}}

   const table=option.field==='moods'?(window.BookDetails?.moods||{}):option.field==='atmospheres'?{...rules.atmospheres,...(window.BookDetails?.atmospheres||{})}:rules[option.field]||{},match=Object.entries(table).find(([label,aliases])=>[label,...aliases].some(v=>N(v)===N(option.label)));
   if(!match){held.push(option);continue;}
   const [label,aliases]=match,q=N(option.quote),phrase=aliases.find(p=>(' '+q+' ').includes(' '+N(p)+' '));
   // Literal support only; no connected plot inference; mood phrases are impressions.
   if(!phrase||/\b(?:not|no|never|without|except|unlike|isnt|arent|wasnt|werent|dont|doesnt|didnt|cant|cannot|wont|wouldnt|couldnt|maybe|perhaps|might|allegedly|supposed|pretending|lying|if|wish|wishes)\b/.test(q)||option.quote.length>1200||option.quote.includes('?')){held.push(option);continue;}
   
   if(option.origin==='ai'&&option.field==='genres'){
    const p=N(phrase),marker=['novel','series','book','fiction','romance','adventure','story'].some(word=>(' '+q+' ').includes(' '+p+' '+word+' '));
    const explicitRomance=p==='romance'&&/\b(?:mm|m m|ff|f f|mf|m f|dark|contemporary|paranormal|gothic|historical|fantasy) romance\b/.test(q);
    const subtype=p.endsWith(' romance')||p==='romantic comedy'||p==='romantic suspense';
    if(!marker&&!explicitRomance&&!subtype){held.push(option);continue;}
   }
   if(window.BookDetails?.blocked(prepared.entry,option.field,label))continue;const existing=book[option.field]||[];
   if(existing.some(v=>N(v)===N(label)))continue;
   if(option.field==='relationships'&&existing.some(v=>['m m','m f','f f'].includes(N(v))&&N(v)!==N(label))){held.push(option);continue;}
   // Keep compact, exact source excerpts; complete reports remain on disk.
   const words=option.quote.split(/(?<=[.!?])\s+/),sentence=words.find(s=>(' '+N(s)+' ').includes(' '+N(phrase)+' '))||option.quote;
   const pos=sentence.toLowerCase().indexOf(phrase.toLowerCase());const start=pos>30?pos-30:0;const quote=sentence.slice(start,start+64);
   // If punctuation/normalization defeated excerpt positioning, defer it.
   if(!(' '+N(quote)+' ').includes(' '+N(phrase)+' ')){held.push(option);continue;}
   candidates.push({...option,label,quote});
  }
  const relationLabels=new Set(candidates.filter(c=>c.field==='relationships').map(c=>c.label));
  const unique=new Map();for(const c of candidates){if(c.field==='relationships'&&relationLabels.size>1){held.push(c);continue;}const key=c.field+'|'+N(c.label);if(!unique.has(key))unique.set(key,c);}
  // Round-robin the categories before additional labels, capped for browser size.
  const accepted=[],remaining=[...unique.values()];for(const field of ['moods','atmospheres','genres','relationships','tropes','dynamics']){const i=remaining.findIndex(c=>c.field===field);if(i>=0)accepted.push(...remaining.splice(i,1));}const slots=12-accepted.length,overflow=Math.max(0,remaining.length-slots);accepted.push(...remaining.slice(0,slots));
  return {entry:prepared.entry,claims:accepted,held:held.length+overflow};
 }
 function enrich(book,entry){
  const claims=entry.automaticMetadata||[];book.sources=[...new Set([...(book.sources||[]),...claims.map(c=>c.source)])];
  for(const field of fields){const own=claims.filter(c=>c.field===field);if(!own.length)continue;book[field]=[...new Set([...(book[field]||[]),...own.map(c=>c.label)])];book.verification.fields['auto_'+field]={value:own.map(c=>c.label),status:['moods','atmospheres'].includes(field)?'interpretation':'automatic-assigned',rationale:['moods','atmospheres'].includes(field)?'Automatic reading impression based on the cited description; subjective, not a factual guarantee. Your corrections take precedence.':'Automatically assigned from a matched catalog record and a literal supporting passage. Not independently verified; you can undo these labels.',evidence:[...new Set(own.map(c=>c.source))]};}
  if(claims.length&&book.metadataStatus==='imported'){book.note='Selected labels assigned automatically from matched catalog passages; remaining details may be unknown.';book.blurb='A full synopsis is not available here. Explore the recorded themes and source links below.';}book.automaticMetadata=claims;return book;
 }
 window.AutomaticMetadata={validate,pack,unpack,packedState,fingerprint,suppressed,screen,enrich};
})();
