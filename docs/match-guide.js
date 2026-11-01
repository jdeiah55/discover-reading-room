'use strict';
(() => {
 const C=BookCore;
 const signature=t=>JSON.stringify([C.normalize(t.label),Boolean(t.negative),t.maxPages??null,t.author||'',Boolean(t.freeText),t.format||'']);
 function writtenOptions(profile,query){const original=C.descriptionTerms(query,profile);if(original.length<2||original.some(t=>t.unsupported))return [];const out=[];for(let index=0;index<original.length;index++){const dropped=original[index];if(dropped.negative)continue;const retained=original.filter((_,i)=>i!==index);if(!retained.some(t=>!t.negative))continue;const revised=retained.map(t=>(t.negative?'without ':'')+t.raw).join(', '),parsed=C.descriptionTerms(revised,profile);if(JSON.stringify(parsed.map(signature).sort())!==JSON.stringify(retained.map(signature).sort()))continue;const count=C.describeRecommendations(profile,revised).rows.filter(r=>r.exact).length;if(count)out.push({kind:'description',label:dropped.label,query:revised,count});}return out.sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label));}
 function curatedOptions(profile,criteria){const labels={genre:'Genre',mood:'Mood',atmosphere:'Atmosphere',trope:'Trope',dynamic:'Character dynamic',author:'Author',format:'Story structure',relationship:'Relationship',maxPages:'Page limit',query:'Title / author search',shelf:'Shelf'};const active=Object.entries(criteria).filter(([k,v])=>k!=='exclude'&&v!==''&&v!==null&&v!==undefined);if(active.length<2)return [];return active.map(([field,value])=>{const revised={...criteria,[field]:field==='maxPages'?null:''};return {kind:'curated',label:labels[field]+': '+(field==='maxPages'?'up to '+value+' pages':value),criteria:revised,count:C.recommendations(profile,revised).filter(r=>r.exact).length};}).filter(x=>x.count>0).sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label));}
 const list=values=>values.length<2?values[0]||'':values.length===2?values.join(' and '):values.slice(0,-1).join(', ')+', and '+values.at(-1);
 function explain(book,result,fallback=''){
  const matched=(result?.matched||[]).filter(r=>r.pass!==false&&!r.term?.negative&&r.field!=='exclude');
  const values=[...new Map(matched.map(r=>[C.normalize(r.value),r.value])).values()];
  if(!values.length)return fallback||'From your library.';
  return 'Matches: '+list(values.slice(0,4))+(values.length>4?' and more':'')+'.'+(result.exact?'':' Some requested details remain unconfirmed.');
 }

 window.MatchGuide={writtenOptions,curatedOptions,explain};
})();
