'use strict';
// Retired research compatibility shim. Old reports do not modify the library.
// Prior cached data is left untouched; no lookup or paid provider is called.
(() => {
 const ready=Promise.resolve({configured:false,free:true});
 window.DiscoverResearch={ready,async run(){return null;},cancel(){},accept(){return [];},get configured(){return false;}};
})();
