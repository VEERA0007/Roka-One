/* Live wind statistics against known distributions. Run from the repository root. */
global.window={};require('../gensolar-android-project/gensolar-android/app/src/main/assets/epc-livewind.js');
const L=window.EPCLiveWind;let fail=0;const ok=(n,c,i)=>{if(!c){fail++;console.log('FAIL',n,i===undefined?'':i)}else console.log('ok',n,i===undefined?'':i)};
/* exact Gumbel quantiles (mu 25, beta 3) as 25 "yearly maxima": the fit must return mu and beta closely */
const mu=25,be=3,N=25,mx=[];for(let i=1;i<=N;i++){const p=(i-0.5)/N;mx.push(mu-be*Math.log(-Math.log(p)))}
const g=L.gumbel(mx,50);ok('Gumbel fit recovers the scale and location within 8 %',Math.abs(g.beta-be)/be<0.08&&Math.abs(g.mu-mu)<1,g.mu.toFixed(2)+' '+g.beta.toFixed(2));
const true50=mu-be*Math.log(-Math.log(1-1/50));ok('50-year level is within 6 % of the true value '+true50.toFixed(2),Math.abs(g.T50-true50)/true50<0.06,g.T50);
ok('return level rises with the period',g.level(100)>g.T50&&g.T50>g.level(10));
ok('fewer than 8 years: no fit',L.gumbel([20,21,22],50)===null);
/* build a daily record: 25 years x 365 days, yearly peak set, plus directions */
function daily(peaks,dirFn){const time=[],gu=[],dr=[];peaks.forEach((p,k)=>{const y=2000+k;for(let d=0;d<365;d++){const dt=new Date(Date.UTC(y,0,1+d));time.push(dt.toISOString().slice(0,10));gu.push(d===100?p:(d<19?15+d*0.1:5+(d%7)));dr.push(d===100||d<19?225:90)}});return {time,wind_gusts_10m_max:gu,wind_direction_10m_dominant:dr}}
const a=L.analyse(daily(mx));ok('analysis uses complete years and finds the highest gust',a.state==='ok'&&a.years===25&&Math.abs(a.maxObserved-Math.max(...mx))<1e-9,JSON.stringify([a.years,a.maxObserved]));
ok('highest-gust date is the day of that peak',/^\d{4}-04-1\d$/.test(a.maxDate),a.maxDate);
ok('annual list has one entry per year',a.annual.length===25&&a.annual[0][0]===2000);
ok('strongest days come from the south-west',a.dirs&&a.dirs.top==='SW',JSON.stringify(a.dirs&&a.dirs.counts));
/* incomplete years are dropped */
const part=daily(mx);part.time=part.time.slice(0,part.time.length-40);part.wind_gusts_10m_max=part.wind_gusts_10m_max.slice(0,part.time.length);part.wind_direction_10m_dominant=part.wind_direction_10m_dominant.slice(0,part.time.length);
ok('a partial last year is not used',L.analyse(part).years===24);
ok('too little data gives an error, not a number',L.analyse({time:['2020-01-01'],wind_gusts_10m_max:[9]}).state==='error');
ok('missing values (null) are ignored',L.analyse({time:daily(mx).time,wind_gusts_10m_max:daily(mx).wind_gusts_10m_max.map((v,i)=>i%50===0?null:v)}).state==='ok');
/* sector binning at the 360/0 boundary: 350 and 10 degrees are both north */
const sp=[],dr=[];for(let i=0;i<100;i++){sp.push(30-i*0.1);dr.push(i%2?350:10)}const sc=L.sectors(sp,dr,0.2);ok('north wraps round 0/360',sc.top==='N'&&sc.counts[0]===sc.n,JSON.stringify(sc.counts));
/* comparison wording */
ok('warns when the model is above the code value',/WARNING/.test(L.compare({state:'ok',gust50:46},44)));
ok('does not claim confirmation when it is below',/does not confirm/.test(L.compare({state:'ok',gust50:30},44))&&!/WARNING/.test(L.compare({state:'ok',gust50:30},44)));
/* fetch builds the right request and passes errors on */
let url='';L.fetchData(17.385,78.4867,u=>{url=u;return Promise.resolve({ok:true,json:()=>Promise.resolve({daily:daily(mx)})})}).then(r=>{
  ok('request carries the site, the gust variable, metres per second and 25 years',url.includes('latitude=17.3850')&&url.includes('longitude=78.4867')&&url.includes('wind_gusts_10m_max')&&url.includes('wind_speed_unit=ms'));
  ok('fetch returns the analysis',r.state==='ok'&&r.years===25);
  return L.fetchData(1,1,()=>Promise.resolve({ok:false,status:429}))}).then(()=>{ok('an HTTP error is not swallowed',false)},e=>{ok('an HTTP error is not swallowed',/429/.test(e.message));console.log(fail?'FAILED '+fail:'all passed');process.exit(fail?1:0)});
