'use strict';
(function(root){
 const quote=value=>'"'+String(value).replace(/"/g,'""')+'"';
 function delimited(text,delimiter){
  const rows=[];let row=[],value='',quoted=false;
  for(let i=0;i<text.length;i++){
   const ch=text[i];
   if(ch==='"'){if(quoted&&text[i+1]==='"'){value+='"';i++;}else if(quoted||!value)quoted=!quoted;else value+=ch;}
   else if(ch===delimiter&&!quoted){row.push(value);value='';}
   else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(value);if(row.some(v=>v.trim()))rows.push(row);row=[];value='';}
   else value+=ch;
  }
  if(quoted)throw Error('A quoted field is unfinished. Close its quotation mark and try again.');
  row.push(value);if(row.some(v=>v.trim()))rows.push(row);
  return rows;
 }
 function convert(text,filename='library.csv'){
  if(typeof text!=='string'||text.length>10*1024*1024)throw Error('Choose a book list smaller than 10 MB.');
  text=text.replace(/^\uFEFF/,'');const extension=String(filename).split('.').pop().toLowerCase();
  if(extension==='csv')return text;
  if(extension==='tsv'){
   const rows=delimited(text,'\t');if(!rows.length)throw Error('This book list is empty.');
   const headers=rows[0].map(v=>v.trim().toLowerCase());
   if(!headers.includes('title')||!headers.includes('author'))rows.unshift(['Title','Author']);
   if(rows.some(row=>row.length!==rows[0].length))throw Error('Each TSV row must have the same number of columns.');
   return rows.map(row=>row.map(quote).join(',')).join('\n');
  }
  if(extension!=='txt')throw Error('Choose a CSV, TSV or TXT book list.');
  const rows=[['Title','Author']];
  for(const [index,raw] of text.split(/\r?\n|\r/).entries()){
   const line=raw.trim();if(!line)continue;
   const separators=['\t',' — ',' | ',' by '];let parts=null;
   for(const separator of separators){const at=line.lastIndexOf(separator);if(at>0){parts=[line.slice(0,at).trim(),line.slice(at+separator.length).trim()];break;}}
   if(!parts||!parts.every(Boolean))throw Error('Line '+(index+1)+': use Title — Author, Title | Author, or Title by Author.');
   if(rows.length===1&&parts[0].toLowerCase()==='title'&&parts[1].toLowerCase()==='author')continue;
   rows.push(parts);if(rows.length>10001)throw Error('Import up to 10,000 books at a time.');
  }
  if(rows.length===1)throw Error('This book list is empty.');
  return rows.map(row=>row.map(quote).join(',')).join('\n');
 }
 const api={convert};if(typeof module!=='undefined')module.exports=api;else root.LibraryImport=api;
})(typeof globalThis!=='undefined'?globalThis:this);
