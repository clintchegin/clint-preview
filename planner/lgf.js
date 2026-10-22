window.mountLetsGetFired=function(root){if(!root||root.__lgfLive)return;root.__lgfLive=1;const CHAT_ENDPOINT="https://lets-get-fired-chat.clintchegin.workers.dev/chat";const ROOT=root;// Calculator fields: [id, label, type, unit, min, max, group]. Shared by the page and (via gen_schema.mjs) the worker schema.
const FIELDS=[
 ['age','Current age','integer','years',18,90,'core'],
 ['inv','Invested assets (retirement + brokerage accounts)','number','USD',0,1e9,'core'],
 ['spend','Annual spending','number','USD/yr',0,5e6,'core'],
 ['contrib','Yearly contributions to investments','number','USD/yr',0,5e6,'core'],
 ['ret','Retire at (age)','integer','years',19,100,'core'],
 ['cash','Cash & savings','number','USD',0,1e8,'more'],['inccash','Count cash as invested','boolean'],
 ['inc','Take-home income','number','USD/yr',0,1e7,'more'],
 ['r','Real return before retirement','number','%',-5,15,'asm'],['rp','Real return after retirement','number','%',-5,15,'asm'],
 ['wr','Withdrawal rate','number','%',0.5,10,'asm'],['tax','Tax on withdrawals','number','%',0,99,'asm'],
 ['mtgon','I have a mortgage','boolean'],['mp','Mortgage payment (inside annual spending)','number','USD/month',0,1e5,'mtg'],['my','Years left on mortgage','integer','years',0,40,'mtg'],
 ['sson','Include Social Security','boolean'],['ssm','Estimated Social Security benefit at claiming age (today\'s $)','number','USD/month',0,1e4,'ss'],['ssa','Social Security claiming age','integer','years',62,70,'ss'],
 ['pt','Barista FIRE part-time income','number','USD/yr',0,1e6,'tier'],['pte','Barista FIRE: work part-time until age','integer','years',19,100,'tier'],
 ['leanS','Lean FIRE spending','number','USD/yr',0,1e6,'tier'],['chubS','Chubby FIRE spending','number','USD/yr',0,5e6,'tier'],['fatS','Fat FIRE spending','number','USD/yr',0,5e6,'tier']];
// Used when a field is blank. These are modelling assumptions, not anyone's data.
const ASSUME={r:5,rp:4,wr:4,tax:0,ssa:67,pt:30000,pte:60,leanS:40000,chubS:100000,fatS:150000};
const REQUIRED=['age','inv','spend','contrib','ret'];
if(typeof module!=='undefined')module.exports={FIELDS,ASSUME,REQUIRED};
// ===== FIRE calculator engine + UI. No personal data; inputs live only in this browser's localStorage. =====
const $=i=>ROOT.querySelector('#'+CSS.escape(i)),SK='lgf.inputs.v1',UK='lgf.ui.v1';
const focused=()=>{const n=ROOT.getRootNode();return n&&'activeElement'in n?n.activeElement:document.activeElement};
const CF=Object.fromEntries(FIELDS.map(f=>[f[0],{label:f[1],type:f[2],unit:f[3],min:f[4],max:f[5],group:f[6]}]));
// "Use typical numbers": U.S. national figures, rounded. Clearly labelled as an example in the UI.
const TYPICAL={
 age:40,        // Median age of U.S. adults is about 39-40 (U.S. Census Bureau, 2023 population estimates; median age of all residents 39.1)
 inv:87000,     // Median retirement-account balance for families that have one: $87,000 (Federal Reserve, Survey of Consumer Finances 2022)
 cash:8000,     // Median transaction-account (checking/savings) balance: $8,000 (Federal Reserve, Survey of Consumer Finances 2022)
 spend:77280,   // Average annual household expenditures: $77,280 (BLS Consumer Expenditure Survey, 2023)
 inc:87869,     // Average household income after taxes: $87,869 (BLS Consumer Expenditure Survey, 2023)
 contrib:9400,  // ~11.7% average total 401(k) contribution rate incl. employer (Vanguard, How America Saves 2024) x $80,610 median household income (U.S. Census Bureau, 2023)
 ret:65,        // Average expected retirement age of U.S. workers: 65 (Gallup Economy and Personal Finance survey, 2024)
 sson:true,ssm:1976, // Average retired-worker Social Security benefit: about $1,976/month (SSA, January 2025 COLA fact sheet)
 ssa:67,        // Full retirement age for anyone born 1960 or later (SSA)
 mtgon:false
};
let V={},example=false,skipped=false;
function load(){try{const s=JSON.parse(localStorage.getItem(SK)||'null');if(s){V=s.v||{};example=!!s.example}const u=JSON.parse(localStorage.getItem(UK)||'null');if(u)skipped=!!u.skipped}catch(_){}}
function save(){try{localStorage.setItem(SK,JSON.stringify({v:V,example}));localStorage.setItem(UK,JSON.stringify({skipped}))}catch(_){}}
const has=k=>V[k]!==undefined&&V[k]!==null&&V[k]!=='';
const num=k=>has(k)?+V[k]:(k in ASSUME?ASSUME[k]:NaN);
const missing=()=>REQUIRED.filter(k=>!has(k));
const fmt=x=>'$'+Math.round(x).toLocaleString('en-US'),fk=x=>Math.abs(x)>=1e6?'$'+(x/1e6).toFixed(2)+'M':Math.abs(x)>=1e4?'$'+Math.round(x/1e3)+'K':fmt(x);
const age1=x=>isFinite(x)?(Math.round(x*10)/10).toString():'not before 100';
// ---------- engine (annual steps, real dollars) ----------
function base(){const a=num('age'),R=num('ret'),Sc=num('spend'),M=V.mtgon&&has('mp')?num('mp')*12:0,pa=V.mtgon&&has('my')?a+num('my'):Infinity;
 return{a,R,Sc,M:M,pa,P:num('inv')+(V.inccash&&has('cash')?num('cash'):0),C:num('contrib'),I:has('inc')?num('inc'):0,r:num('r')/100,rp:num('rp')/100,wr:num('wr')/100,tx:Math.min(num('tax'),99)/100,
  ss:V.sson&&has('ssm')?num('ssm')*12:0,ssa:Math.min(Math.max(num('ssa'),62),70)}}
const retSpend=(b,R=b.R)=>Math.max(b.Sc-(b.pa<=R?b.M:0),0); // mortgage drops out of spending once paid off
const gross=(b,x)=>Math.max(x,0)/(1-b.tx);
function fireT(b,sp,R=b.R){const ss=Math.min(b.ss,sp),k=Math.max(b.ssa-R,0),bridge=b.rp?(1-Math.pow(1+b.rp,-k))/b.rp*(1+b.rp):k; // SS bridge: pay the SS share yourself until claiming
 return gross(b,sp-ss)/b.wr+gross(b,ss)*bridge}
function sim(b,years,contribUntil=999){let v=b.P,c=0,gr=0;const rows=[];for(let y=1;y<=years;y++){const age=b.a+y,cy=age<=contribUntil?b.C+(age>b.pa?b.M:0):0,gy=v*b.r;v+=gy+cy;c+=cy;gr+=gy;rows.push({age,v,c,gr})}return rows}
const valAt=(b,R,cu)=>R<=b.a?b.P:sim(b,R-b.a,cu)[R-b.a-1].v;
function ageReach(b,spF){let prev=b.P-fireT(b,spF(b.a),b.a);if(prev>=0)return b.a;for(const x of sim(b,100-b.a)){const d=x.v-fireT(b,spF(x.age),x.age);if(d>=0)return x.age-1+(-prev)/(d-prev);prev=d}return Infinity}
function drawdown(b,start,pt=0,pte=0){let v=start,dep=null;const rows=[];for(let age=b.R;age<95;age++){const need=b.Sc-(age>=b.pa?b.M:0)-(age>=b.ssa?b.ss:0)-(age<pte?pt:0);v=(v-gross(b,need))*(1+b.rp);if(v<0&&dep===null)dep=age+1;rows.push({age:age+1,v:Math.max(v,0)})}return{rows,dep}}
function compute(){if(missing().length)return null;const b=base();if(b.R<=b.a)return{err:'Retirement age needs to be later than your current age.'};
 const atR=valAt(b,b.R),S=retSpend(b),Fn=fireT(b,S),fa=ageReach(b,a=>retSpend(b,a)),noC=valAt({...b,C:0,M:0},b.R),dd=drawdown(b,atR);
 const tiers=[['Lean',num('leanS')],['Chubby',num('chubS')],['Fat',num('fatS')]].map(([n,sp])=>({n,sp,T:fireT(b,sp)}));
 const top=[...tiers].reverse().find(t=>atR>=t.T);
 const ptNeed=Math.ceil(Math.max(S-(atR*b.wr*(1-b.tx)),0)/100)*100,pdd=drawdown(b,atR,num('pt'),num('pte'));
 const end=Math.min(Math.max(b.R,Math.ceil(isFinite(fa)?fa:b.R))+2,100);
 return{b,atR,S,Fn,pct:Math.round(atR/Fn*100),fa,noC,dd,tiers,top,ptNeed,pdd,rows:sim(b,end-b.a),sr:b.I>0?b.C/b.I*100:null}}
// Everything Ledger may quote, preformatted the way the page shows it.
function outputs(o){if(!o)return null;if(o.err)return{Problem:o.err};const b=o.b;return{'Retirement age':b.R,'Balance at retirement':fk(o.atR),'Full FIRE number':fk(o.Fn),'% of full FIRE number':o.pct+'%','Retirement spending per year':fk(o.S),'Full FIRE age':isFinite(o.fa)?age1(o.fa):'not reached by 100',
 'Money lasts':o.dd.dep?'runs out at age '+o.dd.dep:'lasts past 95','Highest tier reached at retirement':o.top?o.top.n+' FIRE':'none yet (below Lean FIRE)',
 'Tier comparisons':o.tiers.map(t=>({Tier:t.n+' FIRE','Spending per year':fk(t.sp),Target:fk(t.T),'% of target funded':Math.round(o.atR/t.T*100)+'%'})),
 'Coast FIRE: balance at retirement if contributions stop now':fk(o.noC),'Coast FIRE: % of full FIRE number':Math.round(o.noC/o.Fn*100)+'%',
 'Barista FIRE: part-time income needed per year at retirement':o.ptNeed?fk(o.ptNeed):'none needed',
 [`Barista FIRE: money lasts with ${fk(num('pt'))}/yr part-time until ${num('pte')}`]:o.pdd.dep?'runs out at age '+o.pdd.dep:'lasts past 95',
 'Savings rate':o.sr===null?'add take-home income to see it':Math.round(o.sr)+'%','Social Security per month':b.ss?fk(b.ss/12)+' from age '+b.ssa:'not included',
 Note:"All $ are today's dollars. Return, withdrawal and tier assumptions apply where the person left them blank."}}
// ---------- charts ----------
function lineSVG(pts,opt={}){const W=600,H=220,p=32,xs=pts.map(d=>d[0]),ys=pts.map(d=>d[1]),x0=Math.min(...xs),x1=Math.max(...xs),y1=Math.max(...ys,opt.target||0)*1.08||1;
 const X=x=>p+(x-x0)/((x1-x0)||1)*(W-p-8),Y=y=>H-22-y/y1*(H-40),d=pts.map((q,i)=>(i?'L':'M')+X(q[0]).toFixed(1)+','+Y(q[1]).toFixed(1)).join('');
 return`<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><path d="${d}L${X(x1)},${H-22}L${X(x0)},${H-22}Z" class="area"/><path d="${d}" class="ln"/>${opt.target?`<line x1="${p}" x2="${W-8}" y1="${Y(opt.target)}" y2="${Y(opt.target)}" class="tline"/>`:''}</svg>`}
const SAMPLE=lineSVG(Array.from({length:30},(_,i)=>[i,Math.pow(1.07,i)*10+i*3]),{target:60});
const preview=(msg)=>`<div class="preview"><div class="ghost">${SAMPLE}</div><p>${msg}</p></div>`;
const need=ks=>'Lights up when you add: '+ks.map(k=>CF[k].label.replace(/ \(.*/,'').toLowerCase()).join(', ')+'.';
const cv=n=>getComputedStyle(ROOT).getPropertyValue(n).trim();
const charts={};
function mkChart(id,cfg){if(charts[id])charts[id].destroy();if(!window.Chart||!$(id))return;Chart.defaults.color=cv('--fg2');Chart.defaults.borderColor=cv('--grid');Chart.defaults.font.family='system-ui,sans-serif';
 charts[id]=new Chart($(id),{...cfg,options:{responsive:true,maintainAspectRatio:false,animation:false,interaction:{mode:'index',intersect:false},
  plugins:{legend:{position:'bottom',labels:{boxWidth:12}},tooltip:{callbacks:{label:c=>c.dataset.label+': '+fk(c.parsed.y)}}},
  scales:{x:{stacked:true,grid:{display:false},title:{display:true,text:'Age'}},y:{stacked:true,beginAtZero:true,ticks:{callback:v=>fk(v)}}}}})}
function growthChart(o){const b=o.b,L=[b.a,...o.rows.map(r=>r.age)];
 mkChart('c1',{data:{labels:L,datasets:[{type:'line',label:'Your FIRE number '+fk(o.Fn),data:L.map(()=>o.Fn),borderColor:cv('--e2'),borderWidth:1.5,borderDash:[6,4],pointRadius:0,stack:'t'},
  {type:'bar',label:'Starting balance',data:L.map(()=>b.P),backgroundColor:cv('--s1'),stack:'s'},{type:'bar',label:'Contributions',data:[0,...o.rows.map(r=>r.c)],backgroundColor:cv('--s2'),stack:'s'},
  {type:'bar',label:'Growth',data:[0,...o.rows.map(r=>r.gr)],backgroundColor:cv('--s3'),stack:'s'}]}})}
function ddChart(o){const L=[o.b.R,...o.dd.rows.map(r=>r.age)],v=[o.atR,...o.dd.rows.map(r=>r.v)];
 mkChart('c2',{data:{labels:L,datasets:[{type:'bar',label:'Portfolio in retirement',data:v,backgroundColor:L.map(a=>o.dd.dep&&a>=o.dd.dep?cv('--bad'):cv('--s2')),stack:'s'}]}})}
function dialSVG(rate){const ang=Math.PI*(1-Math.min(Math.max(rate,0),70)/70);
 return`<svg viewBox="0 0 220 152" role="img" aria-label="Savings rate ${Math.round(rate)}%"><defs><linearGradient id="dg" x1="0" x2="1"><stop offset="0" stop-color="#dc2626"/><stop offset=".45" stop-color="#eab308"/><stop offset="1" stop-color="#16a34a"/></linearGradient></defs><path d="M20 115 A90 90 0 0 1 200 115" fill="none" stroke="url(#dg)" stroke-width="18" stroke-linecap="round"/><line x1="110" y1="115" x2="${(110+62*Math.cos(ang)).toFixed(1)}" y2="${(115-62*Math.sin(ang)).toFixed(1)}" class="needle" stroke-width="4" stroke-linecap="round"/><circle cx="110" cy="115" r="7" class="hub"/><text x="110" y="148" text-anchor="middle" font-size="22" font-weight="800" class="dt">${Math.round(rate)}%</text><text x="20" y="132" font-size="10" text-anchor="middle" class="dt">0%</text><text x="200" y="132" font-size="10" text-anchor="middle" class="dt">70%</text></svg>`}
// ---------- inputs UI ----------
const GROUPS=[['core','The basics'],['more','Also helpful'],['mtg','Mortgage (optional)'],['ss','Social Security (optional)'],['asm','Assumptions'],['tier','FIRE tier targets']];
function inputHTML(id){const f=CF[id],ph=id in ASSUME?(f.unit&&f.unit.startsWith('USD')?fmt(ASSUME[id]):ASSUME[id]+(f.unit&&f.unit.startsWith('%')?'%':'')):'';
 if(f.type==='boolean')return`<label class="chk"><input type="checkbox" id="${id}"> ${f.label}</label>`;
 const u=f.unit&&f.unit.startsWith('USD')?' ($'+(f.unit.includes('/')?'/'+f.unit.split('/')[1]:'')+')':f.unit==='%'?' (%)':'';
 return`<label for="${id}">${f.label}${u}</label><input id="${id}" ${f.unit&&f.unit.startsWith('USD')?'class="money" inputmode="decimal"':'inputmode="decimal"'} type="text" autocomplete="off"${ph?` placeholder="${ph}${id in ASSUME?' (assumed)':''}"`:''}><div class="warn" id="${id}-w"></div>`}
function buildInputs(){let h='';for(const[g,t]of GROUPS){if(g==='asm')h+='<details id="finetune"><summary>Fine-tune <span class="note">(returns, withdrawal rate, tier targets)</span></summary>';const ids=FIELDS.filter(f=>f[6]===g||(g==='more'&&f[0]==='inccash')).map(f=>f[0]),pre=g==='mtg'?'mtgon':g==='ss'?'sson':null;
  h+=`<fieldset class="grp g-${g}"><legend>${t}</legend>${pre?inputHTML(pre)+`<div class="sub" id="sub-${g}">`:''}${ids.map(inputHTML).join('')}${pre?'</div>':''}${g==='ss'?'<div class="note">Get your estimate at <a href="https://www.ssa.gov/myaccount/" target="_blank" rel="noopener">ssa.gov/myaccount</a>.</div>':''}</fieldset>`}
 $('fields').innerHTML=h+'</details>';
 ROOT.querySelectorAll('#fields input').forEach(e=>{e.addEventListener(e.type==='checkbox'?'change':'input',()=>{setVal(e.id,e.type==='checkbox'?e.checked:e.value,true)});
  if(e.classList.contains('money'))e.addEventListener('blur',()=>{if(has(e.id))e.value=(+V[e.id]).toLocaleString('en-US')})})}
function parseNum(s){s=String(s).trim().replace(/[,$\s]/g,'');const m=s.match(/^(-?\d*\.?\d+)([km])?$/i);if(!m)return NaN;return+m[1]*(m[2]?(m[2].toLowerCase()==='k'?1e3:1e6):1)}
// returns error string or '' ; manual=true when typed in the form
function setVal(id,raw,manual){const f=CF[id];let err='';
 if(f.type==='boolean'){V[id]=!!raw}
 else if(raw===null||raw===''){delete V[id]}
 else{const n=parseNum(raw);if(!isFinite(n))err='Not a number';else if(n<f.min||n>f.max)err=`Must be between ${f.min.toLocaleString()} and ${f.max.toLocaleString()}`;else if(f.type==='integer'&&n!==Math.round(n))err='Use a whole number';else V[id]=n;if(err&&manual)delete V[id]}
 if(manual){const w=$(id+'-w');if(w)w.textContent=err;if(example){example=false}}
 if(!err){save();render()}return err}
function syncForm(){for(const id in CF){const e=$(id);if(!e||e===focused())continue;if(CF[id].type==='boolean')e.checked=!!V[id];else e.value=has(id)?(e.classList.contains('money')?(+V[id]).toLocaleString('en-US'):V[id]):''}}
// ---------- results UI ----------
const kp=(k,v,c='',sub='')=>`<div class="tile"><div class="k">${k}</div><div class="v ${c}">${v}</div>${sub?`<div class="s">${sub}</div>`:''}</div>`;
function ladder(o){let i=0;const r=(n,sub,T,v,tip,mine,foot)=>{const pc=T?Math.round(v/T*100):null,id='rt'+(i++);return`<div class="rung${mine?' mine':pc>=100?' met':''}" tabindex="0" aria-describedby="${id}"><div class="n">${n}${mine?' <span class="youb">You</span>':''}</div><div class="b">${sub}</div>${pc!==null?`<div class="bar"><i style="width:${Math.min(pc,100)}%"></i></div><div class="b">${fk(T)} · ${pc}%</div>`:`<div class="b">${foot}</div>`}<span role="tooltip" class="tip" id="${id}">${tip}</span></div>`};
 const t=o.tiers,b=o.b,bt=o.ptNeed?`Barista FIRE: part-time work covers the gap. At ${b.R} you'd need about ${fk(o.ptNeed)}/yr on top of a ${num('wr')}% withdrawal; with ${fk(num('pt'))}/yr until ${num('pte')} your money ${o.pdd.dep?'runs out at '+o.pdd.dep:'lasts past 95'}.`:`Barista FIRE: part-time work covers the gap. At ${b.R} you wouldn't need any.`;
 const tt=x=>`${x.n} FIRE: ${x.n==='Lean'?'a frugal':x.n==='Chubby'?'a comfortable':'a lavish'} retirement on ${fk(x.sp)}/yr, which needs ${fk(x.T)}.${x.sp<o.S?` That's less than your ${fk(o.S)}/yr.`:''}`;
 return`<div class="ladhd">How your ${fk(o.atR)} at ${b.R} compares <span class="note">(hover or tap a tier)</span></div><div class="ladder">${r('Coast','no more saving',o.Fn,o.noC,`Coast FIRE: stop saving today and growth alone takes your ${fk(b.P)} to ${fk(o.noC)} by ${b.R}.`)}${r('Lean',fk(t[0].sp)+'/yr',t[0].T,o.atR,tt(t[0]))}${r('Barista',o.ptNeed?'part-time income':'no part-time needed',0,0,bt,false,o.ptNeed?`needs ${fk(o.ptNeed)}/yr`:'covered')}${r('Chubby',fk(t[1].sp)+'/yr',t[1].T,o.atR,tt(t[1]))}${r('Fat',fk(t[2].sp)+'/yr',t[2].T,o.atR,tt(t[2]))}${r('Your plan',fk(o.S)+'/yr',o.Fn,o.atR,`Your plan: your own spending of ${fk(o.S)}/yr needs ${fk(o.Fn)}.`,true)}</div>`}
function render(){syncForm();const m=missing(),o=compute(),ok=o&&!o.err;
 ROOT.classList.toggle('has-plan',!!ok);ROOT.classList.toggle('welcome',!ok&&!skipped&&!Object.keys(V).some(has));
 $('exbanner').hidden=!example;$('sub-mtg').hidden=!V.mtgon;$('sub-ss').hidden=!V.sson;
 $('progress').textContent=ok?'':`${REQUIRED.length-m.length} of ${REQUIRED.length} basics filled in`;
 $('bandwrap').hidden=!ok;$('bandprev').hidden=!!ok;
 if(!ok){$('bandprev').innerHTML=preview(o&&o.err?o.err:'Answer a few questions to see your plan'+(m.length<REQUIRED.length?`<br><small>${need(m)}</small>`:''));Object.keys(charts).forEach(k=>{charts[k].destroy();delete charts[k]})}
 else{const b=o.b;
  $('answer').innerHTML=`At <b class="ember">${fk(o.S)}/yr</b>, your money ${o.dd.dep?`<span class="bad">runs out at ${o.dd.dep}</span>`:'<span class="good">lasts past 95</span>'}.<span class="sep">·</span>You'd need ${fk(o.Fn)}; you're at <b class="ember">${o.pct}%</b>.`;
  $('tiles').innerHTML=kp('Balance at '+b.R,fk(o.atR))+kp('Your FIRE number',fk(o.Fn),'',`${o.pct}% funded at ${b.R}`)+kp('Full FIRE age',isFinite(o.fa)?age1(o.fa):'not by 100','',isFinite(o.fa)&&o.fa>b.R?'if you keep working':'')+kp('Money lasts',o.dd.dep?'to '+o.dd.dep:'past 95',o.dd.dep?'bad':'good');
  $('dial').innerHTML=o.sr===null?`<div class="incprompt"><label for="inc2">Add take-home income to see your savings rate</label><div class="incrow"><input id="inc2" type="text" class="money" inputmode="decimal" autocomplete="off" placeholder="$ per year"><button type="button" id="inc2b">Add</button></div><div class="warn" id="inc2-w"></div></div>`:`<div class="dialc">${dialSVG(o.sr)}<div class="note">Saving <b>${fk(b.C)}/yr</b> of ${fk(b.I)} take-home: <b>${Math.round(o.sr)}%</b>.</div></div>`;
  if($('inc2')){const go=()=>{const e=setVal('inc',$('inc2').value,false);const w=$('inc2-w');if(w)w.textContent=e};$('inc2b').onclick=go;$('inc2').onkeydown=ev=>{if(ev.key==='Enter')go()}}
  $('ladderwrap').innerHTML=ladder(o);growthChart(o);ddChart(o);
  $('ddnote').innerHTML=`${o.dd.dep?'<span class="bad">Money runs out at age '+o.dd.dep+'.</span>':'<span class="good">Money lasts past 95.</span>'} Spending ${fk(o.S)}/yr${b.ss?', Social Security from '+b.ssa:''}.`}
 $('ddwrap').hidden=!ok;$('ddprev').hidden=!!ok;if(!ok)$('ddprev').innerHTML=preview(need(m.length?m:REQUIRED));
 $('sscard').hidden=!V.sson;if(V.sson)$('ssbody').innerHTML=has('ssm')?(ok?`<p>${fk(num('ssm'))}/mo from age ${num('ssa')} lowers the savings you need. Your FIRE number already accounts for it.</p>`:'<p class="note">'+need(m)+'</p>'):preview('Add your estimated monthly benefit to include it.');
 window.__ok=!!ok;if(window.chatStateChanged)chatStateChanged()}
function init(){load();buildInputs();
 $('typical').onclick=()=>{V={...TYPICAL};example=true;skipped=true;save();render();if(window.chatNote)chatNote('Loaded example numbers. Tell me your real ones any time and I\'ll swap them in.')};
 $('skip').onclick=e=>{e.preventDefault();skipped=true;save();render();$('inputs').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'start'});$('age').focus({preventScroll:true})};
 $('clear').onclick=()=>{if(!confirm('Clear everything you entered on this device?'))return;V={};example=false;skipped=false;try{localStorage.removeItem(SK);localStorage.removeItem(UK)}catch(_){}ROOT.querySelectorAll('.warn').forEach(w=>w.textContent='');render();if(window.chatReset)chatReset()};
 $('trustbtn').onclick=e=>{const x=$('trustfull').hidden;$('trustfull').hidden=!x;e.currentTarget.setAttribute('aria-expanded',x)};
 const onScheme=()=>render();ROOT.__onScheme=onScheme;matchMedia('(prefers-color-scheme: dark)').addEventListener('change',onScheme);
 render()}
init();// ===== Ledger chat: the model only proposes input values via set_inputs; the page validates, applies and computes =====
const chatOn=/^https:\/\/|^http:\/\/localhost/.test(CHAT_ENDPOINT);
const GREET="Hi, I'm Ledger. I'll help you build a FIRE plan, one question at a time. You never need to share your name or account details.\n\n**First: how old are you, and roughly how much do you have invested for retirement?**";
let CHAT=[],busy=false,batchN=0;
const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const md=t=>esc(t).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/\n/g,'<br>');
const fv=(k,v)=>CF[k].type==='boolean'?(v?'on':'off'):CF[k].unit&&CF[k].unit.startsWith('USD')?fk(v)+(CF[k].unit.includes('/')?'/'+CF[k].unit.split('/')[1].replace('month','mo'):''):v+(CF[k].unit==='%'?'%':'');
function bubble(cls,html){const d=document.createElement('div');d.className='cmsg '+cls;d.innerHTML=html;$('chatlog').appendChild(d);$('chatlog').scrollTop=1e9;return d}
function chatContext(){const inputs={};for(const k in CF)if(has(k))inputs[CF[k].label]=V[k];return JSON.stringify({inputs,stillMissing:missing().map(k=>CF[k].label),exampleNumbersLoaded:example,outputs:outputs(compute())})}
function applyInputs(args){const applied={},rejected={},prev={};
 for(const[k,v]of Object.entries(args||{})){if(!CF[k]){rejected[k]='unknown field';continue}
  if(CF[k].type==='boolean'&&typeof v!=='boolean'&&v!==null){rejected[k]='expected true/false';continue}
  prev[k]=V[k];const e=setVal(k,v===null?'':(CF[k].type==='boolean'?v:String(v)),false);if(e){rejected[k]=e;continue}if(example){example=false;save();render()}applied[k]=V[k]}
 return{applied,rejected,prev}}
function changeNote(r){const ks=Object.keys(r.applied),rj=Object.entries(r.rejected);if(!ks.length&&!rj.length)return;
 const d=bubble('cnote',ks.map(k=>`Set ${esc(CF[k].label)} to <b>${esc(r.applied[k]===undefined?'blank':fv(k,r.applied[k]))}</b>`).join('<br>')+(rj.length?'<br><span class="warn">'+rj.map(([k,v])=>`Couldn't set ${esc(CF[k]?.label||k)}: ${esc(v)}`).join('<br>')+'</span>':'')+(ks.length?' <button type="button" class="undo">Undo</button>':''));
 ks.forEach(k=>{const e=$(k);if(e&&e.closest('#finetune'))$('finetune').open=true;if(e){e.classList.remove('aiflash');void e.offsetWidth;e.classList.add('aiflash')}});
 const u=d.querySelector('.undo');if(u)u.onclick=()=>{ks.forEach(k=>{if(r.prev[k]===undefined)delete V[k];else V[k]=r.prev[k]});save();render();u.disabled=true;u.textContent='Undone';CHAT.push({role:'user',content:'(I clicked Undo on the last change.)'})}}
async function chatSend(text){if(busy||!text.trim()||!chatOn)return;busy=true;$('chatsend').disabled=true;bubble('cuser',esc(text));CHAT.push({role:'user',content:text});const th=bubble('cbot cthink','Ledger is thinking…');
 try{for(let round=0;round<3;round++){const r=await fetch(CHAT_ENDPOINT,{method:'POST',referrerPolicy:'no-referrer-when-downgrade',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:CHAT.slice(-30),context:chatContext(),final:round>=2})});
  if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.error==='rate_limited'?`Too many messages; try again in ${Math.ceil((e.retry_after||60)/60)} min.`:'Chat unavailable right now.')}
  const d=await r.json(),m=d.message;CHAT.push(m);
  if(m.tool_calls&&m.tool_calls.length){for(const tc of m.tool_calls){let a={};try{a=JSON.parse(tc.function.arguments||'{}')}catch(_){}const res=applyInputs(a);changeNote(res);
    CHAT.push({role:'tool',tool_call_id:tc.id,content:JSON.stringify({applied:Object.fromEntries(Object.entries(res.applied).map(([k,v])=>[CF[k].label,v===undefined?null:fv(k,v)])),rejected:res.rejected,stillMissing:missing().map(k=>CF[k].label),outputs:outputs(compute())})})}continue}
  th.remove();const b=bubble('cbot',md(m.content||'(no reply)'));$('chatlive').textContent=b.textContent;break}}
 catch(err){bubble('cbot cerr',esc(err.message&&!/fetch/i.test(err.message)?err.message:'Chat unavailable right now. You can still fill in the form.'))}
 finally{th.remove();busy=false;$('chatsend').disabled=false;$('chatin').focus()}}
window.chatNote=t=>{bubble('cbot',md(t));CHAT.push({role:'assistant',content:t})};
window.chatReset=()=>{CHAT=[];$('chatlog').innerHTML='';bubble('cbot',md(GREET));CHAT.push({role:'assistant',content:GREET})};
window.chatStateChanged=()=>{};
$('chatform').onsubmit=e=>{e.preventDefault();const t=$('chatin').value;$('chatin').value='';chatSend(t)};
$('chatin').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('chatform').requestSubmit()}});
chatReset();if(!chatOn){$('chatin').disabled=$('chatsend').disabled=true;bubble('cbot cerr','Chat is offline. You can still fill in the form.')}
return function(){try{Object.keys(charts).forEach(function(k){charts[k].destroy();delete charts[k]})}catch(e){}if(ROOT.__onScheme){try{matchMedia('(prefers-color-scheme: dark)').removeEventListener('change',ROOT.__onScheme)}catch(e){}ROOT.__onScheme=null}root.__lgfLive=0};};
