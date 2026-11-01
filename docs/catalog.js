(function(root){
const library=typeof module!=='undefined'?require('./library.js'):root.BookLibrary;
const books=library.books;
const values=key=>[...new Set(books.flatMap(b=>b[key]))].sort();
const choices={genre:values('genres'),mood:values('moods'),atmosphere:values('atmospheres'),trope:values('tropes'),dynamic:values('dynamics'),relationship:values('relationships'),format:['Standalone','Series',...(books.some(b=>b.series&&b.standaloneReadable===true)?['Standalone within a series']:[])],shelf:[...new Set(books.map(b=>b.sourceShelf))].sort()};
const api={books,choices,demoProfile:library.profile,initialProfile:library.profile,libraryStats:library.stats};
if(typeof module!=='undefined')module.exports=api;else root.BookCatalog=api;
})(typeof globalThis!=='undefined'?globalThis:this);
