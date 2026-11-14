/* Auto-fill rules: wind lookup, k2 table, bolt capacities, blocks, OSM footprint. Run from the repository root. */
global.window={};
require(require('node:path').resolve('gensolar-android-project/gensolar-android/app/src/main/assets/epc-auto.js'));
const A=window.EPCAuto;let fail=0;
const ok=(n,c,i)=>{if(!c){fail++;console.log('FAIL',n,i)}else console.log('ok',n,i===undefined?'':i)};
var w;const near=(a,b,t)=>Math.abs(a-b)<=t;
/* wind */
ok('Hyderabad pin -> 44 m/s',A.windSpeed(17.385,78.4867).vb===44);
ok('conservative: highest of the cities within 150 km (a point between Vijayawada 50 and Hyderabad 44)',A.windSpeed(16.9,79.6).vb===50,JSON.stringify(A.windSpeed(16.9,79.6)));
ok('remote point: 50 m/s with a note',(w=>w.vb===50&&/conservative/.test(w.note))(A.windSpeed(32,92)));
/* k2 table and interpolation */
ok('k2 cat 2 at 10 m',A.k2(10,2)===1.00);ok('k2 below 10 m uses the 10 m value',A.k2(6,2)===1.00);
ok('k2 interpolates (cat 2, 15 m = 1.025)',near(A.k2(15,2),1.025,1e-12),A.k2(15,2));
ok('k2 cat 3 at 25 m = 0.99',near(A.k2(25,3),0.99,1e-12));ok('k2 above 50 m is NaN (out of table)',isNaN(A.k2(60,2)));ok('k2 bad category NaN',isNaN(A.k2(12,9)));
/* bolts: IS 800 cl 10.3 by hand */
const b=A.bolt('M16','4.6');ok('M16 4.6 tension 0.9*400*157/1.25 = 45.216 kN',near(b.tcap,45.216,1e-9),b.tcap);ok('M16 4.6 shear 400*157/(sqrt3*1.25) = 29.006 kN',near(b.vcap,29.0060775,1e-6),b.vcap);
ok('M20 stronger than M16',A.bolt('M20','4.6').tcap>b.tcap);ok('unknown bolt -> null',A.bolt('M99','4.6')===null);
/* tilt */
ok('tilt Hyderabad 13, bounded 8..22',A.tiltFor(17.4)===13&&A.tiltFor(8)===8&&A.tiltFor(35)===22);
/* blocks */
let bl=A.blocks(21.26,550,2,600);ok('21.26 kWp / 550 Wp -> 39 modules, 2 blocks, never fewer than required',bl.n===39&&bl.modules>=39&&bl.list.length===2,JSON.stringify(bl));
bl=A.blocks(10,550,2,600);ok('10 kWp -> 19 modules in one block 2x10',bl.list.length===1&&bl.list[0].rows===2&&bl.list[0].perRow===10&&bl.modules===20,JSON.stringify(bl));
ok('zero capacity gives no blocks',A.blocks(0,550,2,600).n===0);
ok('every block within 14 per row',A.blocks(120,550,2,600).list.every(x=>x.perRow<=14));
/* ladder strictly heavier */
['pur','raf','col','brc'].forEach(k=>{const L=A.LAD[k];ok(k+' ladder has 7 levels and grows',L.length===7&&L.every((x,i)=>i===0||x[0]>=L[i-1][0]));});
/* OSM footprint: 20 m x 10 m rectangle around the pin, 4 floors */
const lat=17.385,lon=78.4867,kx=1/(111412.84*Math.cos(lat*Math.PI/180)-93.5*Math.cos(3*lat*Math.PI/180)),ky=1/(111132.92-559.82*Math.cos(2*lat*Math.PI/180)+1.175*Math.cos(4*lat*Math.PI/180));
const rect=(x0,y0,x1,y1)=>[[x0,y0],[x1,y0],[x1,y1],[x0,y1],[x0,y0]].map(p=>({lat:lat+p[1]*ky,lon:lon+p[0]*kx}));
const j={elements:[{type:'way',id:1,tags:{building:'yes','building:levels':'4'},geometry:rect(-10,-5,10,5)},{type:'way',id:2,tags:{building:'yes'},geometry:rect(40,40,80,90)}]};
const f=A.footprint(j,lat,lon);ok('footprint picks the building containing the pin',f&&f.id===1&&f.inside,JSON.stringify(f));
ok('footprint area ~ 200 m2 (within 0.5 %)',near(f.area,200,1),f.area);ok('perimeter ~ 60 m',near(f.perimeter,60,0.3),f.perimeter);ok('height from levels 4 x 3.2 = 12.8',near(f.height,12.8,1e-9));
const out=A.footprint({elements:[j.elements[1]]},lat,lon);ok('pin outside any building: nearest is reported with its distance',out&&!out.inside&&out.dist>40,JSON.stringify(out));
ok('no buildings -> null',A.footprint({elements:[]},lat,lon)===null);
ok('usable area = (200 - 60 x 1) m2 = 140 m2 = 1506.9 sq ft',near(A.usableSqft(200,60,1),140*10.7639104167,1e-6));ok('setback bigger than the roof -> 0',A.usableSqft(10,30,1)===0);
/* inset polygon */
const R=(x0,y0,x1,y1)=>[[x0,y0],[x1,y0],[x1,y1],[x0,y1]].map(p=>[lat+p[1]*ky,lon+p[0]*kx]);
let q=A.inset(R(-10,-6,10,6),1);ok('rectangle 20x12 inset 1 m -> 18x10 = 180 m2',q&&near(q.area,180,0.5),q&&q.area);
q=A.inset(R(-10,-6,10,6).reverse(),1);ok('clockwise polygon gives the same inward result',q&&near(q.area,180,0.5),q&&q.area);
/* L shape (concave): area 20x12 minus 10x6 corner = 180 m2, perimeter 64; inward offset by 1 m = A - P*1 + (convex corners 5 - reflex 1)*... exact: 180-64+ (5-1)*... use known value 118+? computed by rectangle decomposition below */
const Lp=[[-10,-6],[10,-6],[10,0],[0,0],[0,6],[-10,6]].map(p=>[lat+p[1]*ky,lon+p[0]*kx]);
q=A.inset(Lp,1);ok('L-shaped roof (concave) inset 1 m: area = 180 - 64 + 4 = 120 m2 (mitred: A - P d + (convex-reflex) d2)',q&&near(q.area,120,0.5),q&&q.area);
q=A.inset(R(-15,-0.75,15,0.75),1);ok('a strip 1.5 m wide collapses -> null',q===null);
q=A.inset(R(-10,-6,10,6),0);ok('zero offset -> null',q===null);
ok('inset polygon stays inside the original (all vertices)',(()=>{const r=A.inset(R(-10,-6,10,6),1);return r.poly.every(p=>{const x=(p[1]-lon)/kx,y=(p[0]-lat)/ky;return x>-10&&x<10&&y>-6&&y<6})})());
console.log(fail?'FAILED '+fail:'all passed');process.exit(fail?1:0);
