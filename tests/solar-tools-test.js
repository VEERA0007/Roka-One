/* Solar Tools calculations against known sun geometry and hand calculations. Run from the repository root. */
const T=require('../gensolar-android-project/gensolar-android/app/src/main/assets/solar-tools.js');let fail=0;
const ok=(n,c,i)=>{if(!c){fail++;console.log('FAIL',n,i===undefined?'':i)}else console.log('ok',n,i===undefined?'':i)},near=(a,b,t)=>Math.abs(a-b)<=t;
const lat=17.385,lon=78.4867;
ok('day of year: 21 March = 80, 31 Dec = 365',T.dayOfYear(2026,3,21)===80&&T.dayOfYear(2026,12,31)===365);
ok('declination: about +23.4 deg at the June solstice, -23.4 at December, ~0 at the equinox',near(T.decl(T.dayOfYear(2026,6,21))/(Math.PI/180),23.44,0.3)&&near(T.decl(T.dayOfYear(2026,12,21))/(Math.PI/180),-23.44,0.3)&&near(T.decl(80)/(Math.PI/180),0,0.6));
ok('equation of time stays within the known -14.3..+16.5 minutes',(()=>{let lo=1e9,hi=-1e9;for(let n=1;n<=365;n++){const e=T.eot(n);lo=Math.min(lo,e);hi=Math.max(hi,e)}return lo>-15&&lo<-13.5&&hi>15.5&&hi<17.5})());
ok('equinox solar noon: sun height = 90 - latitude',near(T.sunAt(lat,80,12).alt,90-lat,0.8),T.sunAt(lat,80,12).alt);
ok('21 June solar noon at 17.4N: 90-17.4+23.4 > 90 so sun is 83.9 deg high and north of overhead',near(T.sunAt(lat,172,12).alt,90-Math.abs(lat-23.44),0.4)&&near(T.sunAt(lat,172,12).az,0,1)||near(T.sunAt(lat,172,12).az,360,1),JSON.stringify(T.sunAt(lat,172,12)));
ok('21 December solar noon: 49.2 deg high, due south',near(T.sunAt(lat,355,12).alt,90-lat-23.44,0.4)&&near(T.sunAt(lat,355,12).az,180,1),JSON.stringify(T.sunAt(lat,355,12)));
ok('morning sun is in the east half, afternoon in the west half',T.sunAt(lat,80,9).az<180&&T.sunAt(lat,80,9).az>60&&T.sunAt(lat,80,15).az>180&&T.sunAt(lat,80,15).az<300);
ok('sun is below the horizon at solar midnight',T.sunAt(lat,80,0).alt<-50);
const eq=T.dayInfo(lat,lon,80,5.5),ju=T.dayInfo(lat,lon,172,5.5),de=T.dayInfo(lat,lon,355,5.5);
ok('equinox: day length about 12.1 h; sunrise before 06:30 and sunset after 18:00 clock time at Hyderabad',near(eq.length,12.1,0.2)&&eq.sunrise<6.5&&eq.sunset>18,JSON.stringify(eq));
ok('June day is longer than December, near 13.2 h and 11.0 h',near(ju.length,13.2,0.25)&&near(de.length,11.0,0.25),ju.length+' '+de.length);
ok('solar noon at Hyderabad is about 12:07 clock time (78.49E vs 82.5E meridian)',near(eq.noon,12.0+(82.5-lon)*4/60,0.3),eq.noon);
ok('polar night and midnight sun are reported, not turned into NaN',T.dayInfo(80,0,355,0).polar==='night'&&T.dayInfo(80,0,172,0).polar==='day');
ok('time text',T.hhmm(6.5)==='06:30'&&T.hhmm(18.999)==='19:00'&&T.hhmm(NaN)==='–');
/* shadow: same numbers as the Kotlin ShadowGeometryEngine */
const s=T.shadowCheck(3,5,17.4);ok('shadow check 3 m at 5 m, 17.4N: angle 31.0, winter sun 49.15 (shown to 0.1), shadow 2.59 m, clearance 2.98, not shaded',s.obstacleAngle===31&&near(s.winterAlt,49.15,0.06)&&near(s.shadowLen,2.59,0.02)&&near(s.minClearance,2.98,0.02)&&s.shaded===false,JSON.stringify(s));
ok('closer than the shadow length is shaded',T.shadowCheck(3,2,17.4).shaded===true);
ok('very high latitudes use the 8 degree floor and never divide by zero',isFinite(T.shadowCheck(3,5,80).shadowLen)&&T.shadowCheck(3,5,80).winterAlt===8);
ok('negative or zero inputs are clamped',isFinite(T.shadowCheck(0,0,17).shadowLen));
/* appliances */
const a=T.applianceTotals([{qty:2,watts:70,hours:8},{qty:5,watts:10,hours:6},{qty:1,watts:1500,hours:6}],5.2,0.78);
ok('appliance energy: 2x70x8 + 5x10x6 + 1500x6 = 10 420 Wh a day',a.dailyWh===10420,a.dailyWh);
ok('monthly units = 10.42 x 30 = 312.6 and connected load 1.69 kW',near(a.monthlyKwh,312.6,1e-9)&&near(a.connectedKw,1.69,1e-9));
ok('rough size = monthly / (30 x 5.2 x 0.78) = 2.57 kWp',near(a.kwp,312.6/(30*5.2*0.78),1e-9),a.kwp);
ok('empty list gives zeros',T.applianceTotals([],5.2,0.78).monthlyKwh===0);
/* existing plant */
const p=T.systemPerformance(5,600,30,5.2);ok('5 kWp, 600 kWh in 30 days at 5.2 PSH: yield 120 kWh/kWp, PR 76.9 %, CUF 16.7 %, good',near(p.yieldPerKwp,120,1e-9)&&near(p.pr,600/(5*5.2*30),1e-12)&&near(p.cuf,600/(5*24*30),1e-12)&&p.verdict==='good',JSON.stringify(p));
ok('PR 0.70 is fair, 0.5 is low',T.systemPerformance(5,0.70*5*5.2*30,30,5.2).verdict==='fair'&&T.systemPerformance(5,0.5*5*5.2*30,30,5.2).verdict==='low');
ok('missing or zero inputs give no result',T.systemPerformance(0,600,30,5.2)===null&&T.systemPerformance(5,600,0,5.2)===null&&T.systemPerformance(5,NaN,30,5.2)===null);
/* maintenance */
const today=new Date(2026,10,15);
ok('due in 1 day is "soon"',(()=>{const d=T.dueInfo({date:'2026-11-01',interval:15},today);return d.left===1&&d.status==='soon'&&d.dueDate==='2026-11-16'})());
ok('past due date is overdue',(()=>{const d=T.dueInfo({date:'2026-10-01',interval:15},today);return d.left===-30&&d.status==='overdue'})());
ok('due in two months is ok',T.dueInfo({date:'2026-11-10',interval:60},today).status==='ok');
ok('due today is "soon" with 0 days left',T.dueInfo({date:'2026-11-01',interval:14},today).left===0);
console.log(fail?'FAILED '+fail:'all passed');process.exit(fail?1:0);
