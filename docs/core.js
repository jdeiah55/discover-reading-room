(function(root){
'use strict';
const catalog=typeof module!=='undefined'?require('./catalog.js'):root.BookCatalog;
const {books,choices}=catalog;
// Recognize established concepts consistently even when the current shelf lacks them.
const requestVocabulary=Object.fromEntries(Object.entries(choices).map(([field,values])=>[field,Array.isArray(values)?values.slice():[]]));
function emptyCriteria(){return {genre:'',mood:'',atmosphere:'',trope:'',dynamic:'',relationship:'',shelf:'',query:'',author:'',format:'',maxPages:null,exclude:[]};}
const normalizationCache=new Map();
function normalize(s){const raw=String(s);if(normalizationCache.has(raw))return normalizationCache.get(raw);const text=raw.toLowerCase();const result=(/^[\x00-\x7f]*$/.test(text)?text.replace(/'/g,'').replace(/[^a-z0-9]+/g,' '):text.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').normalize('NFC').replace(/[’']/g,'').replace(/[^\p{L}\p{N}\p{M}]+/gu,' ')).trim();if(raw.length<=4000){normalizationCache.set(raw,result);if(normalizationCache.size>6000)normalizationCache.delete(normalizationCache.keys().next().value);}return result;}
function literalPattern(phrase){return new RegExp('(?<![\\p{L}\\p{N}\\p{M}])'+phrase.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?![\\p{L}\\p{N}\\p{M}])','gu');}
function isNegatedPrefix(prefix){return /\b(?:(?:not|no|without|avoid|excluding)(?:\s+(?:any|a|an|the))?(?:\s+(?:books?|stories?))?(?:\s+(?:with|about|containing))?|(?:dont|do not) want(?:\s+(?:any|a|an|the))?|not looking for(?:\s+(?:any|a|an|the))?|anything but)\s+$/.test(prefix);}
const labelAliases={dynamic:{'revenge seeking heroine':'Heroine seeking revenge','heroine seeking revenge':'Heroine seeking revenge'},genre:{'horror romance':'Horror romance','vampire romance':'Vampire romance','monster romance':'Monster romance','historical romance':'Historical romance'},trope:{'age gap':'Age gap','forbidden romance':'Forbidden romance','workplace romance':'Workplace romance','one bed':'One bed','hidden identity':'Hidden identity','dark humor':'Dark humor','grumpy sunshine':'Grumpy × sunshine','grumpy x sunshine':'Grumpy × sunshine','captive x captor':'Captive/captor','captive captor':'Captive/captor','touch her and die':'Touch her and die','witty banter':'Witty banter','insta obsession':'Insta-obsession','he falls first':'He falls first'}};
function canonicalLabel(field,value){const keys={genres:'genre',tropes:'trope',dynamics:'dynamic'};const f=keys[field]||field;if(f==='format'&&normalize(value)==='standalone within a series')return 'Interconnected standalones';return labelAliases[f]?.[normalize(value)]||value;}
function filterAliases(field,value){const aliases=labelAliases[field]||{};return Object.keys(aliases).filter(key=>normalize(aliases[key])===normalize(canonicalLabel(field,value)));}
function supports(book,field,value){
 const fields={genre:'genres',mood:'moods',atmosphere:'atmospheres',trope:'tropes',dynamic:'dynamics',relationship:'relationships',shelf:'sourceShelves'};
 if(field==='author')return [book.author,...book.additionalAuthors].some(a=>normalize(a)===normalize(value));
 const normalizedValue=normalize(canonicalLabel(field,value));
 if(!normalizedValue){const literal=String(value).normalize('NFKC').toLowerCase();return (book[fields[field]]||[]).some(v=>String(v).normalize('NFKC').toLowerCase()===literal);}
 if(['mafia','organized crime'].includes(normalizedValue)&&['genre','trope','atmosphere'].includes(field)){const crimeTags=[...book.genres,...book.tropes,...book.atmospheres].map(normalize),allowed=normalizedValue==='mafia'?['mafia','mafia romance']:['organized crime','mafia','mafia romance'];return allowed.some(v=>crimeTags.includes(v));}
 if(normalizedValue==='college'&&['trope','atmosphere'].includes(field))return [...book.tropes,...book.atmospheres].some(v=>normalize(v)==='college');
 const tags=[...(book[fields[field]]||[]),...(book.metadataStatus==='reviewed'?[]:book.externalSubjects||[])].map(v=>normalize(canonicalLabel(field,v)));
 if(field==='trope'&&normalizedValue==='survival stakes')return tags.some(v=>['survival stakes','survival','fight for survival'].includes(v));
 const aliases={'mafia':['mafia','mafia romance','organized crime'],'professor student':['professor student','teacher student'],'romance':['romance','dark romance','contemporary romance','fantasy romance','gothic romance','paranormal romance','historical romance','horror romance','monster romance','vampire romance','romantic comedy','romantic suspense'],'fantasy':['fantasy','fantasy romance','urban fantasy','dark fantasy','epic fantasy','high fantasy']};
 return (aliases[normalize(canonicalLabel(field,value))]||[normalize(canonicalLabel(field,value))]).some(v=>tags.includes(v));
}
function evaluate(book,c){
 const checks=[];
 for(const [field,actual] of [['genre',book.genres],['mood',book.moods],['atmosphere',book.atmospheres],['trope',book.tropes],['author',book.author],['shelf',book.sourceShelves],['relationship',book.relationships],['dynamic',book.dynamics]]){
  if(c[field])checks.push({field,value:c[field],pass:supports(book,field,c[field]),unknown:field!=='author'&&field!=='shelf'&&(book.metadataStatus==='pending'||!supports(book,field,c[field]))});
 }
 if(c.format&&root.StoryStructure?.match(book,c.format)){const result=root.StoryStructure.match(book,c.format);checks.push({field:'format',value:c.format,pass:result.pass,unknown:result.unknown});}else if(c.format){const within=c.format==='Standalone within a series';const audit=book.verification?.fields?.[within?'standaloneReadable':'format'];const established=!audit||['verified-direct','supported-summary','catalog-stated','reader-corrected'].includes(audit.status);const actual=established&&(within?book.standaloneReadable===true&&Boolean(book.series):c.format==='Standalone'?book.format==='Standalone'&&!book.series:c.format==='Series'?!book.structureConflict&&(book.format==='Series'||Boolean(book.series&&book.seriesEvidenceStatus)):book.format===c.format);checks.push({field:'format',value:c.format,pass:actual,unknown:!established||(within?(book.standaloneReadable===null||!book.series):book.format===null)});}
 if(c.query){const haystack=normalize(book.rawTitle+' '+book.author+' '+book.additionalAuthors.join(' '));checks.push({field:'query',value:c.query,pass:normalize(c.query).split(' ').every(t=>haystack.includes(t)),unknown:false});}
 if(c.maxPages!==null&&c.maxPages!==undefined)checks.push({field:'maxPages',value:`≤ ${c.maxPages} pages`,pass:Number.isFinite(book.pages)&&book.pages<=c.maxPages,unknown:!Number.isFinite(book.pages)});
 for(const value of c.exclude||[])checks.push({field:'exclude',value:`Without ${value} tag`,pass:(book.verifiedAbsentTags||[]).includes(value),unknown:!(book.verifiedAbsentTags||[]).includes(value)});
 const matched=checks.filter(x=>x.pass),missing=checks.filter(x=>!x.pass);
 return {book,checks,matched,missing,exact:missing.length===0,score:checks.length?matched.length/checks.length:1};
}
function excludedIds(profile){const ids=new Set([profile.current,...profile.finished.map(x=>x.id),...profile.dnf.map(x=>x.id)].filter(Boolean));const works=new Set(books.filter(b=>ids.has(b.id)).map(b=>b.workKey));return new Set(books.filter(b=>works.has(b.workKey)).map(b=>b.id));}
function feedbackBlockedWorks(){return new Set(root.ReaderFeedback?books.filter(b=>(!root.PersonalLibrary||root.PersonalLibrary.contains(b.id))&&!root.ReaderFeedback.eligible(b.id)).map(b=>b.workKey):[]);}
function personalScore(b,profile){return ([b.author,...b.additionalAuthors].some(a=>profile.favoriteAuthors.includes(a))?40:0)+b.tropes.filter(t=>profile.favoriteTropes.includes(t)).length*20+b.atmospheres.filter(t=>profile.favoriteAtmospheres.includes(t)).length*10+(profile.favoriteGenres||[]).filter(g=>supports(b,'genre',g)).length*12+b.moods.filter(m=>(profile.favoriteMoods||[]).includes(m)).length*8;}
function compareMatchRows(a,b,profile){const taste=row=>(row.affinity??=(root.DiscoverLearning?.affinity(row.book,profile)||{score:0,reasons:[]})).score;const quality=b=>['reviewed','primary-reviewed'].includes(b.metadataStatus)?1:0;return Number(b.exact)-Number(a.exact)||b.score-a.score||b.matched.length-a.matched.length||taste(b)-taste(a)||(b.personal||0)-(a.personal||0)||quality(b.book)-quality(a.book)||a.book.title.localeCompare(b.book.title);}
function recommendations(profile,c,{includeRead=false}={}){
 const omitted=includeRead?new Set():excludedIds(profile),blockedWorks=feedbackBlockedWorks();
 const ranked=books.filter(b=>(!root.PersonalLibrary||root.PersonalLibrary.contains(b.id))&&!omitted.has(b.id)&&!blockedWorks.has(b.workKey)).map(b=>{
  const result=evaluate(b,c);
  const personal=personalScore(b,profile);
  return {...result,personal};
 }).sort((a,b)=>compareMatchRows(a,b,profile));
 const seen=new Set();return ranked.filter(r=>{if(seen.has(r.book.workKey))return false;seen.add(r.book.workKey);return true;});
}
function chooseRandom(items,lastId,rng=Math.random){
 if(!items.length)return {book:null,repeated:false};
 const previous=books.find(b=>b.id===lastId);const alternatives=items.filter(b=>previous?b.workKey!==previous.workKey:b.id!==lastId);const pool=alternatives.length?alternatives:items;
 const value=rng();if(!Number.isFinite(value)||value<0||value>=1)throw new Error('Random value must be in [0,1).');
 const book=pool[Math.floor(value*pool.length)];return {book,repeated:previous?book.workKey===previous.workKey:book.id===lastId};
}
function parseRequest(text,profile){
 const c=emptyCriteria(),warnings=[],recognized=[];let working=normalize(text);
 function take(field,value,regex){if(regex.test(working)){if(c[field]&&c[field]!==value)warnings.push(`Multiple ${field} preferences: review the selected value.`);c[field]=value;recognized.push(value);working=working.replace(regex,' ');}}
 // Negations become exclusions rather than positive matches.
 for(const v of [...choices.genre,...choices.mood,...choices.atmosphere,...choices.trope].sort((a,b)=>b.length-a.length)){
  const key=normalize(v),pattern=new RegExp('\\b(?:not|no|without|avoid|excluding)\\s+(?:any\\s+)?'+key+'\\b','g');
  if(pattern.test(working)){c.exclude.push(v);recognized.push(`Without ${v}`);working=working.replace(pattern,' ');}
 }
 take('dynamic','Villainous heroine × good-hearted hero',/\b(?:girl|woman|female lead|heroine)\s+(?:is\s+)?(?:the\s+|a\s+)?villain\b/);
 take('dynamic','Villainous heroine × good-hearted hero',/\bvillainous (?:heroine|female lead)\b/);
 if(c.dynamic){working=working.replace(/\b(?:and\s+)?(?:the\s+)?(?:guy|man|male lead|hero)\s+(?:is\s+)?(?:a\s+|the\s+)?(?:good guy|good hearted|good)\b/g,' ');warnings.push('This character dynamic is not verified for any book in the current catalog.');}
 for(const field of ['atmosphere','trope','genre','mood','format','dynamic','relationship'])for(const v of [...choices[field]].sort((a,b)=>b.length-a.length)){
  const key=normalize(v);take(field,v,new RegExp('\\b'+key+'\\b','g'));
 }
 if(/\brivals? to lovers\b/.test(working)){c.dynamic=c.dynamic||'Rivals-to-lovers (unverified)';recognized.push('Rivals-to-lovers (unverified)');working=working.replace(/\brivals? to lovers\b/g,' ');}
 if(/\benemies to lovers\b/.test(working)){warnings.push('Enemies-to-lovers is not verified in this catalog.');c.dynamic=c.dynamic||'Enemies-to-lovers (unverified)';recognized.push('Enemies-to-lovers (unverified)');working=working.replace(/\benemies to lovers\b/g,' ');}
 // Do not equate academic rivals with a confirmed romance arc.
 if(/\brivals? to lovers\b/.test(normalize(text)))warnings.push('Academic rivalry is supported for some titles; a rivals-to-lovers romance is not verified.');
 const authors=[...new Set(books.flatMap(b=>[b.author,...b.additionalAuthors]))].sort((a,b)=>b.length-a.length);
 for(const author of authors)take('author',author,new RegExp('\\b'+normalize(author)+'\\b','g'));
 if(/\bfavou?rite author\b/.test(working)){c.author=profile.favoriteAuthors[0]||'';recognized.push(c.author||'No favorite author set');working=working.replace(/\b(?:my )?favou?rite author\b/g,' ');if(!c.author)warnings.push('Choose a favorite author in your reading profile; shelf frequency alone does not confirm a favorite.');}
 const raw=normalize(text);let page=raw.match(/\b(?:under|less than|fewer than) (\d+) pages?\b/);
 if(page)c.maxPages=Number(page[1])-1;
 else {page=raw.match(/\b(?:up to|at most|no more than|maximum|max) (\d+)(?: pages?)?\b/);if(page)c.maxPages=Number(page[1]);}
 if(page){recognized.push(`≤ ${c.maxPages} pages`);working=working.replace(page[0],' ');}
 if(/\b(?:short|quick|long|immersive)\b/.test(working))warnings.push('Reading speed varies. Choose an explicit page limit instead of assuming short or long.');
 if(c.exclude.some(v=>Object.values(c).includes(v)))warnings.push('A preference is both requested and excluded; edit it before searching.');
 const ignored=new Set('i im am in the mood for a an book books where with and or vibes vibe want looking read reading me something please give find by of that is to my feels like set at'.split(' '));
 const remainder=working.split(/\s+/).filter(w=>w&&!ignored.has(w));
 if(remainder.length)warnings.push('Not interpreted: '+[...new Set(remainder)].join(' ')+'. Only the displayed filters will be applied.');
 return {criteria:c,warnings:[...new Set(warnings)],recognized:[...new Set(recognized)].filter(Boolean)};
}
function personalReasons(book,profile){const r=[];
 for(const author of [book.author,...book.additionalAuthors])if(profile.favoriteAuthors.includes(author))r.push(`${author} is an author you explicitly selected as a favorite.`);
 const tropes=book.tropes.filter(x=>profile.favoriteTropes.includes(x));if(tropes.length)r.push(`Shares your preferred ${tropes.join(' / ').toLowerCase()} tags.`);
 const atmos=book.atmospheres.filter(x=>profile.favoriteAtmospheres.includes(x));if(atmos.length)r.push(`Fits your ${atmos.join(' / ').toLowerCase()} preference.`);
 const current=books.find(x=>x.id===profile.current);if(current&&current.series&&current.volume!==null&&book.series===current.series&&book.volume===current.volume+1)r.unshift(`The next cataloged volume after your selected current read, ${current.title}.`);
 for(const finished of profile.finished.filter(x=>x.rating>=4)){const liked=books.find(b=>b.id===finished.id);if(liked&&(liked.author===book.author||book.tropes.some(t=>liked.tropes.includes(t)))){r.push(`Shares an author or editorial trope with ${liked.title}, which you explicitly rated ${finished.rating}/5.`);break;}}
 const genres=(profile.favoriteGenres||[]).filter(g=>supports(book,'genre',g));if(genres.length)r.push('Shares your preferred '+genres.join(' / ')+' genres.');const moods=book.moods.filter(m=>(profile.favoriteMoods||[]).includes(m));if(moods.length)r.push('Fits your '+moods.join(' / ')+' reading mood.');return r.length?r:['A title from your imported library. Choose preferences or search ingredients for a more personal match.'];
}
// Free-description discovery is separate from the strict curated-filter form.
// Multiple preferences in one field are retained and ranked, not overwritten.
function descriptionTerms(text,profile){
 // Alternatives are bounded to complete recognized ingredients. Commas keep
 // shared requirements explicit; multi-ingredient branches stay unconfirmed.
 if(/\bor\b/i.test(text)){
  const groups=String(text).split(/[,;\n]+/).filter(x=>x.trim()),out=[];let unsupported=false;
  for(const group of groups){if(!/\bor\b/i.test(group)){out.push(...descriptionTerms(group,profile));continue;}
   const branches=group.split(/\bor\b/i).map(x=>descriptionTerms(x.replace(/\beither\b/ig,''),profile));
   if(/[()]/.test(group)||branches.some(ts=>ts.length!==1||ts[0].negative||ts[0].freeText||ts[0].author||ts[0].format||ts[0].maxPages!==undefined)){unsupported=true;out.push(...branches.flat());continue;}
   const alternatives=branches.map(ts=>ts[0]),categories=alternatives.map(t=>root.StoryInterpreter?.category(t)||'story-detail');out.push({label:alternatives.map(t=>t.label).join(' or '),raw:group.trim(),need:[],alternatives,category:categories.every(c=>c===categories[0])?categories[0]:'story-detail',weight:Math.max(...alternatives.map(t=>root.StoryInterpreter?.weight(t)||1)),relational:alternatives.every(t=>t.relational),negative:false});
  }
  if(unsupported)out.push({label:'Alternative wording',raw:'or',need:[],freeText:true,unsupported:true});
  return [...new Map(out.map(t=>[t.label+'|'+Boolean(t.negative),t])).values()];
 }
 const prepared=root.StoryInterpreter?.prepare(text);const source=normalize(prepared?.remaining??text);let remaining=source;const terms=[...(prepared?.terms||[])];
 const lexicon=[
  {label:'Both leads are serial killers',aliases:['they are both serial killers','both serial killers','both are serial killers','two serial killers'],need:['Both leads are serial killers']},
  {label:'Both leads are killers',aliases:['they are both killers','both are killers','both killers'],need:['Both leads are killers']},

  {label:'Good-girl / innocent heroine',aliases:['good girl','goodgirl','innocent girl','innocent heroine','innocent fmc'],need:['Innocent heroine']},
  {label:'Bad-boy / dangerous hero',aliases:['bad boy','badboy','bad guy','dangerous hero'],need:['Dangerous hero']},
  {label:'Villainous hero',aliases:['villainous hero','villain mmc','male villain'],need:['Villainous hero']},
  {label:'Unhinged hero',aliases:['unhinged mmc','unhinged hero'],need:['Unhinged hero']},
  {label:'Villainous heroine',aliases:['girl is the villain','girl is a villain','villainous heroine','female villain','villain fmc'],need:['Villainous heroine']},
  {label:'Good-hearted hero',aliases:['good hearted hero','good hearted guy','guy is a good guy','good guy','morally good hero'],need:['Good-hearted hero']},
  {label:'Mafia',aliases:['mafia','mob'],need:['Mafia romance','Mafia']},
  {label:'Organized crime',aliases:['organized crime'],need:['Organized crime']},
  {label:'Why choose',aliases:['reverse harem','why choose'],need:['Why choose']},
  {label:'Multiple love interests',aliases:['multiple love interests'],need:['Why choose','Love triangle']},
  {label:'Grumpy × sunshine',aliases:['grumpy and sunshine','grumpy x sunshine','grumpy sunshine'],need:['Grumpy × sunshine']},
  {label:'Professor/student',aliases:['professor student','teacher student','student teacher','one student other professor','one is a student and the other is a professor','one student and one professor','student and professor'],need:['Professor/student']}
 ];
 // Recognize structural requirements even when the current library has no match.
 for(const format of ['Standalone within a series','Interconnected standalones','Series, length unknown','Longer series','Trilogy','Duet','Standalone','Series'])lexicon.push({label:format,aliases:format==='Standalone'?['standalone','standalones','stand alone']:format==='Duet'?['duet','duets','duology','duologies']:format==='Trilogy'?['trilogy','trilogies']:format==='Longer series'?['longer series','long series']:format==='Interconnected standalones'?['interconnected standalones','interconnected standalone']:[normalize(format)],need:[],format});
 for(const label of ['Adventurous','Bittersweet','Cozy','Dark','Dreamy','Heartwarming','Hopeful','Mysterious','Reflective','Romantic','Whimsical','Witty','Kidnapping','Assassin hero','Ex-military heroine']){
  if(!lexicon.some(x=>x.aliases.includes(normalize(label))))lexicon.push({label,aliases:[normalize(label)],need:[label]});
 }
 for(const field of ['atmosphere','trope','genre','mood','dynamic','relationship'])for(const value of new Set([...(requestVocabulary[field]||[]),...choices[field]])){
  if(!lexicon.some(x=>x.aliases.includes(normalize(value))))lexicon.push({label:value,aliases:[...new Set([normalize(value),...filterAliases(field,value)])],need:[value]});
 }
 const authors=[...new Set(books.flatMap(b=>[b.author,...b.additionalAuthors]))];for(const author of authors)lexicon.push({label:author,aliases:[normalize(author)],need:[],author});
 const moodPhrases={Cozy:['cosy','comforting'],Heartwarming:['heart warming','feel good'],Hopeful:['uplifting','optimistic'],Reflective:['introspective','thought provoking'],Witty:['witty and funny']};
 for(const item of lexicon)if(moodPhrases[item.label])item.aliases=[...new Set([...item.aliases,...moodPhrases[item.label]])];
 // Rank actual phrases, not a rule's longest unrelated alias.
 const phrases=lexicon.flatMap(item=>item.aliases.map(phrase=>({item,phrase}))).filter(x=>x.phrase).sort((a,b)=>b.phrase.length-a.phrase.length);
 const occupied=[],literalChunks=String(text).split(/[,;\n]+/).map(normalize);
 for(const {item,phrase}of phrases){if(!literalChunks.some(chunk=>chunk.includes(phrase)))continue;const pattern=literalPattern(phrase);let match;
  while((match=pattern.exec(source))!==null){const start=match.index,end=start+match[0].length;if(occupied.some(([a,b])=>start<b&&end>a))continue;
   const prefix=source.slice(Math.max(0,start-22),start),negative=isNegatedPrefix(prefix);
   terms.push({...item,negative,raw:match[0]});occupied.push([start,end]);
  }
 }
 const page=source.match(/\b(under|less than|fewer than|up to|at most|no more than) (\d+) pages?\b/);
 if(page){const max=Number(page[2])-( ['under','less than','fewer than'].includes(page[1])?1:0);terms.push({label:`Up to ${max} pages`,maxPages:max,need:[],raw:page[0]});const start=page.index;occupied.push([start,start+page[0].length]);}
 let chars=[...source];for(const [a,b] of occupied)for(let i=a;i<b;i++)chars[i]=' ';remaining=chars.join('');
 const stop=new Set('i im am in the mood for a an book books where with and or vibes vibe want looking read reading me something please give find by of that is to my feels like set at id love about has having some preferably would really featuring plus it be not no without avoid excluding just much very but craving recommend recommendation could you need tonight'.split(' '));
 const leftover=remaining.split(/\s+/).filter(x=>x&&!stop.has(x));
 // Unknown specifics remain part of the request, rather than disappearing.
 if(leftover.length)terms.push({label:leftover.join(' '),need:[],raw:leftover.join(' '),freeText:true,negative:/\b(?:without|avoid|excluding|dont want|do not want|not looking for|anything but)\b/.test(remaining)||/\bno (?!one\b|body\b|longer\b)/.test(remaining)||/\bnot (?!only\b)/.test(remaining)});
 const seen=new Set(),unique=terms.filter(t=>{const key=t.label+'|'+Boolean(t.negative);if(seen.has(key))return false;seen.add(key);return true;});
 return unique;
}
function describeRecommendations(profile,text,{includeRead=false}={}){
 const terms=descriptionTerms(text,profile),omitted=includeRead?new Set():excludedIds(profile),blockedWorks=feedbackBlockedWorks();
 if(terms.some(t=>t.unsupported))return {terms,rows:[],unsupported:'Use single ingredients around “or”, and commas for shared details: romance, cozy or hopeful.'};
 const rows=books.filter(b=>(!root.PersonalLibrary||root.PersonalLibrary.contains(b.id))&&!omitted.has(b.id)&&!blockedWorks.has(b.workKey)).map(book=>{
  const tags=[...book.genres,...book.moods,...book.atmospheres,...book.tropes,...book.dynamics,...book.relationships,...(book.externalSubjects||[])];
  const normalized=tags.map(normalize),description=normalize(book.rawTitle+' '+book.author+' '+(book.searchDescription||''));
  const checkTerm=term=>{
   if(term.alternatives){const alternatives=term.alternatives.map(checkTerm),match=alternatives.find(c=>c.pass);return {field:'description',value:term.label,pass:Boolean(match),unknown:!match,excluded:false,evidence:match?'Matches alternative: '+match.value:'No alternative is established',term};}
   let pass=false,unknown=false,evidence='';
   if(term.maxPages!==undefined){pass=Number.isFinite(book.pages)&&book.pages<=term.maxPages;unknown=!Number.isFinite(book.pages);evidence=pass?'Source-checked edition page count':'';}
   else if(term.author){pass=supports(book,'author',term.author);evidence=pass?'Author in the discovery catalog':'';}
   else if(term.format){const structure=evaluate(book,{...emptyCriteria(),format:term.format}).checks.find(c=>c.field==='format');pass=structure?.pass===true;unknown=!pass;evidence=pass?'Established story structure; independently readable series entries remain distinct':'';}
   else if(term.factId){const fact=(book.storyFacts||[]).find(f=>f.concept===term.factId),concept=root.LibraryMetadata?.storyCatalog?.concepts.find(c=>c.id===term.factId),labels=[term.label,...(concept?.aliases||[])].map(normalize),readerClaim=['dynamics','tropes','atmospheres'].some(field=>(book.verification?.fields?.['reader_'+field]?.value||[]).some(v=>labels.includes(normalize(canonicalLabel(field,v)))));pass=Boolean(fact)||readerClaim;unknown=!pass;evidence=fact?'Documented connection: '+fact.subject+' -> '+fact.object:readerClaim?'Your explicit classification; not independently source-verified':'';}
   else if(term.freeText){pass=description.includes(normalize(term.raw));unknown=!pass;evidence=pass?'Phrase found in the title or sourced description':'';}
   else {pass=term.need.some(value=>normalized.includes(normalize(value))||supports(book,'genre',value)||supports(book,'trope',value));unknown=!pass;evidence=pass?'Recorded catalog classification; editorial judgments are labeled in book details':'';}
   // Exclusions are hard constraints. Unknown content is not evidence of absence.
   const excluded=Boolean(term.negative)&&pass;
   if(term.negative){pass=false;unknown=true;evidence=excluded?'Excluded tag is present':'Absence is not verified';}
   return {field:'description',value:(term.negative?'Without ':'')+term.label,pass,unknown,excluded,evidence,term};
  };const checks=terms.map(checkTerm);
  const positive=checks.filter(x=>!x.term.negative),matched=positive.filter(x=>x.pass),missing=positive.filter(x=>!x.pass),hardFail=checks.some(x=>x.excluded)||checks.some(x=>(x.term.maxPages!==undefined||x.term.author)&&!x.pass);
  return {book,checks,matched,missing,exact:terms.length>0&&missing.length===0&&!checks.some(x=>x.term.negative)&&!hardFail,score:positive.length?matched.length/positive.length:0,hardFail,personal:personalScore(book,profile)};
 }).filter(r=>!r.hardFail&&r.matched.length>0).sort((a,b)=>compareMatchRows(a,b,profile));
 const seen=new Set();return {terms,rows:rows.filter(r=>{if(seen.has(r.book.workKey))return false;seen.add(r.book.workKey);return true;})};
}
const api={literalPattern,isNegatedPrefix,canonicalLabel,filterAliases,emptyCriteria,evaluate,recommendations,chooseRandom,parseRequest,personalReasons,excludedIds,normalize,supports,descriptionTerms,describeRecommendations};if(typeof module!=='undefined')module.exports=api;else root.BookCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);
