/* redesign2/nav.js — the shared top bar for every page of the redesign preview.
   Include near the top of <body>:
     <script src="<path-to>/nav.js" data-root="<relative path to redesign2 root, no trailing slash>"></script>
   Injects its own CSS + the bar, and exposes window.RD2 (team/league registry
   + shared helpers) so pages don't each carry their own copy of the data.

   The bar is the same 14 items everywhere:
     Portal | NZIHL + its 6 clubs | NZWIHL + its 4 clubs | (spacer) Ops
   = the 13 destination links Mat asked for, plus the Ops (diagnostics) link
   pinned at the far right, visually separated from the 13. */
(function(){
  const ASSETS = "https://matchavez.com/nzihl-broadcast-assets";
  const enc = encodeURIComponent;
  const script = document.currentScript;
  const ROOT = (script && script.getAttribute('data-root')) || '.';

  /* Registry — one copy of the club data for the whole preview.
     TLAs are the canonical codes from the 2026 Style Guide.
     Ordered by TLA within league (the bar shows TLAs, so it sorts by them). */
  const LEAGUES = [
    {key:"nzihl",  tla:"NZIHL",  logo:"NZIHL-White-2000.png"},
    {key:"nzwihl", tla:"NZWIHL", logo:"NZWIHL-Logo-White-1000px.png"},
  ];
  const TEAMS = [
    {lg:"nzihl", tla:"ADM", slug:"pure-nz-admirals",      nm:"Pure NZ Admirals",      nick:"Admirals",   logo:"Pure-NZ-Admirals-2000x2000.png", up:"Pure NZ Admirals",      dvd:"PureNZAdmirals",      roster:"nzihl-broadcast-rosters",  active:true},
    {lg:"nzihl", tla:"BSW", slug:"botany-swarm",          nm:"Botany Swarm",          nick:"Swarm",      logo:"Botany Swarm 2000x2000.png",     up:"Botany Swarm",          dvd:"BotanySwarm",         roster:"nzihl-broadcast-rosters",  active:true},
    {lg:"nzihl", tla:"CRD", slug:"canterbury-red-devils", nm:"Canterbury Red Devils", nick:"Red Devils", logo:"Red Devils 2000x2000r.png",      up:"Red Devils",            dvd:"CanterburyRedDevils", roster:"nzihl-broadcast-rosters",  active:true},
    {lg:"nzihl", tla:"DUN", slug:"dunedin-thunder",       nm:"Dunedin Thunder",       nick:"Thunder",    logo:"Dunedin_Thunder.png",            up:"Dunedin Thunder",       dvd:"DunedinThunder",      roster:"nzihl-broadcast-rosters",  active:true},
    {lg:"nzihl", tla:"MKO", slug:"auckland-mako",         nm:"Auckland Mako",         nick:"Mako",       logo:"Auckland Mako 2000x2000.png",    up:"Auckland Mako",         dvd:"AucklandMako",        roster:"nzihl-broadcast-rosters",  active:false},
    {lg:"nzihl", tla:"SCS", slug:"skycity-stampede",      nm:"SkyCity Stampede",      nick:"Stampede",   logo:"Skycity Stampede 2000x2000.png", up:"SkyCity Stampede",      dvd:"SkyCityStampede",     roster:"nzihl-broadcast-rosters",  active:true},
    {lg:"nzwihl", tla:"AST", slug:"auckland-steel",        nm:"Auckland Steel",        nick:"Steel",      logo:"Auckland-Steel-White.png",       up:"Auckland Steel",        dvd:"AucklandSteel",        roster:"nzwihl-broadcast-rosters", active:true},
    {lg:"nzwihl", tla:"CIN", slug:"canterbury-inferno",    nm:"Canterbury Inferno",    nick:"Inferno",    logo:"Inferno-White.png",              up:"Canterbury Inferno",    dvd:"CanterburyInferno",    roster:"nzwihl-broadcast-rosters", active:true},
    {lg:"nzwihl", tla:"DTW", slug:"dunedin-thunder-women", nm:"Dunedin Thunder Women", nick:"Thunder",    logo:"thunder-women-white.png",        up:"Dunedin Thunder Women", dvd:"DunedinThunderWomen",  roster:"nzwihl-broadcast-rosters", active:true},
    {lg:"nzwihl", tla:"WLD", slug:"wakatipu-wild",         nm:"Wakatipu Wild",         nick:"Wild",       logo:"Wakatipu-wild-white.png",        up:"Wakatipu Wild",         dvd:"WakatipuWild",         roster:"nzwihl-broadcast-rosters", active:true},
  ];
  const logoUrl = t => `${ASSETS}/assets/logos/${enc(t.logo)}`;
  const leagueLogoUrl = l => `${ASSETS}/assets/league/${enc(l.logo)}`;
  const bySlug = Object.fromEntries(TEAMS.map(t=>[t.slug,t]));
  const byName = Object.fromEntries(TEAMS.map(t=>[t.nm,t]));
  byName["Red Devils"] = bySlug["canterbury-red-devils"];        // early-season archive drift
  window.RD2 = { ASSETS, LEAGUES, TEAMS, logoUrl, leagueLogoUrl, bySlug, byName, ROOT };

  /* ---- which item is "current"? derived from the URL ---- */
  const qs = new URLSearchParams(location.search);
  let cur = "portal";
  if(/\/ops\/?(index\.html)?$/.test(location.pathname)) cur = "ops";
  else if(location.pathname.includes("/team/"))   cur = "team:"   + (qs.get("team")   || "");
  else if(location.pathname.includes("/league/")) cur = "league:" + (qs.get("league") || "");

  /* ---- shared design-system bits every page needs ----
     .gh     = GitHub-destination marker (octocat glyph replaces the ↗)
     .gcode  = esportsdesk game-code pill for game-specific links */
  const OCTO = "M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z";
  const octoMask = `url("data:image/svg+xml,${enc(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><path d='${OCTO}'/></svg>`)}") center/contain no-repeat`;

  const css = document.createElement('style');
  css.textContent = `
  nav.topbar{ position:sticky; top:0; z-index:40; background:rgba(10,11,13,.93);
    backdrop-filter:blur(10px); border-bottom:1px solid var(--line,#2a2e34); }
  nav.topbar .tb-wrap{ max-width:1080px; margin:0 auto; display:flex; align-items:stretch;
    gap:1px; padding:0 10px; overflow-x:auto; scrollbar-width:none; -ms-overflow-style:none; }
  nav.topbar .tb-wrap::-webkit-scrollbar{ display:none; }
  a.tb-item{ flex:0 0 auto; display:inline-flex; align-items:center; gap:6px;
    padding:10px 8px 8px; font-size:10.5px; font-weight:800; letter-spacing:.05em;
    color:#9aa3ad; text-decoration:none; border-bottom:2px solid transparent;
    transition:color .15s, border-color .15s, background .15s; white-space:nowrap; }
  a.tb-item img{ width:18px; height:18px; object-fit:contain;
    filter:drop-shadow(0 1px 2px rgba(0,0,0,.6)); }
  a.tb-item svg{ width:15px; height:15px; }
  a.tb-item.lgx img{ width:26px; }
  a.tb-item:hover{ color:#f3f4f6; background:rgba(255,255,255,.045); }
  a.tb-item.on{ color:#f7be11; border-bottom-color:#f7be11; }
  a.tb-item.w.on{ color:#3aa0ff; border-bottom-color:#3aa0ff; }
  .tb-div{ flex:0 0 auto; width:1px; align-self:center; height:18px;
    background:var(--line,#2a2e34); margin:0 6px; }
  .tb-spacer{ flex:1 1 auto; min-width:8px; }
  a.tb-item.opsx{ align-self:center; border:1px solid var(--line,#2a2e34);
    border-radius:999px; padding:4px 11px; margin-left:6px; font-size:10px; border-bottom-width:1px; }
  a.tb-item.opsx:hover{ border-color:#3a3f47; }
  a.tb-item.opsx.on{ color:#f7be11; border-color:rgba(247,190,17,.55); background:rgba(247,190,17,.07); }
  .gh::before{ content:"" !important; display:inline-block; width:11px; height:11px;
    margin-right:5px; background:currentColor; opacity:.75;
    -webkit-mask:${octoMask}; mask:${octoMask}; }
  .gcode{ font-family:ui-monospace,Menlo,monospace; font-size:10px; font-weight:600;
    letter-spacing:.02em; padding:2px 8px; border-radius:999px;
    border:1px solid var(--line,#2a2e34); color:#9aa3ad; background:rgba(255,255,255,.035);
    display:inline-flex; align-items:center; gap:4px; vertical-align:1px; }
  .gcode b{ font-weight:800; color:#6f7883; }`;
  document.head.appendChild(css);

  /* ---- build the bar ---- */
  const PORTAL_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="2" y="5" width="20" height="14" rx="6"/><line x1="12" y1="5" x2="12" y2="19"/>
    <circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/></svg>`;
  const OPS_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`;

  const on = k => cur === k ? " on" : "";
  const items = [];
  items.push(`<a class="tb-item${on("portal")}" href="${ROOT}/" title="Main portal">${PORTAL_ICON}Portal</a>`);
  for(const l of LEAGUES){
    items.push(`<span class="tb-div"></span>`);
    items.push(`<a class="tb-item lgx${l.key==="nzwihl"?" w":""}${on("league:"+l.key)}" href="${ROOT}/../league/?league=${l.key}" title="${l.tla} league page">
      <img loading="lazy" src="${leagueLogoUrl(l)}" alt="">${l.tla}</a>`);
    for(const t of TEAMS.filter(t=>t.lg===l.key)){
      items.push(`<a class="tb-item${l.key==="nzwihl"?" w":""}${on("team:"+t.slug)}" href="${ROOT}/team/?team=${t.slug}" title="${t.nm}">
        <img loading="lazy" src="${logoUrl(t)}" alt="">${t.tla}</a>`);
    }
  }
  items.push(`<span class="tb-spacer"></span>`);
  items.push(`<a class="tb-item opsx${on("ops")}" href="${ROOT}/ops/" title="Diagnostics, QA & data tooling">${OPS_ICON}Ops</a>`);

  const bar = document.createElement('nav');
  bar.className = "topbar";
  bar.setAttribute('aria-label', 'Portal, leagues, teams and Ops');
  bar.innerHTML = `<div class="tb-wrap">${items.join("")}</div>`;
  document.body.prepend(bar);

  /* keep the current item scrolled into view on narrow screens */
  const onEl = bar.querySelector('a.tb-item.on');
  if(onEl && onEl.scrollIntoView) requestAnimationFrame(()=>{ try{
    onEl.scrollIntoView({inline:"center", block:"nearest"}); }catch(_){}});
})();
