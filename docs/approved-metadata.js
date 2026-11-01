'use strict';
// Optional reviewed additions live inside the existing library backup/storage.
(() => {
 const fields=['genres','moods','atmospheres','tropes','dynamics','relationships'];
 function validate(claims){
  if(claims===undefined)return [];
  if(!Array.isArray(claims)||claims.length>60)throw Error('Invalid approved metadata.');
  return claims.map(c=>{
   if(!c||!fields.includes(c.field)||typeof c.label!=='string'||!c.label.trim()||c.label.length>120||typeof c.quote!=='string'||c.quote.length>4000||typeof c.source!=='string')throw Error('Invalid approved metadata label.');
   let u;try{u=new URL(c.source);}catch{throw Error('Invalid metadata source.');}
   if(u.protocol!=='https:'||!['openlibrary.org','books.google.com'].includes(u.hostname)||u.username||u.password)throw Error('Unsupported metadata source.');
   return {field:c.field,label:c.label.trim(),source:u.href,quote:c.quote,origin:c.origin==='ai'?'ai':'catalog'};
  });
 }
 function enrich(book,entry){
  for(const field of fields){
   const claims=(entry.approvedMetadata||[]).filter(c=>c.field===field);if(!claims.length)continue;
   book[field]=[...new Set([...(book[field]||[]),...claims.map(c=>c.label)])];
   book.userClassified=true;
   const prior=book.verification.fields['reader_'+field];
   book.verification.fields['reader_'+field]={value:[...new Set([...(prior?.value||[]),...claims.map(c=>c.label)])],status:'reader-provided',rationale:'Your approved catalog/AI-assisted classifications; not an independent story audit.',evidence:[...new Set(claims.map(c=>c.source))]};
  }
  book.approvedMetadata=entry.approvedMetadata||[];
  return book;
 }
 window.ApprovedMetadata={validate,enrich};
})();
