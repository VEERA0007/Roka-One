/* Sheet tracing maths: scale, pixel to metre (y flips), boxes and circles. Run from the repository root. */
global.window={};
const S=require(require('node:path').resolve('gensolar-android-project/gensolar-android/app/src/main/assets/epc-sheet.js'));
let fail=0;const ok=(n,c,i)=>{if(!c){fail++;console.log('FAIL',n,i)}else console.log('ok',n,i===undefined?'':i)};const near=(a,b,t)=>Math.abs(a-b)<=t;
ok('scale: 500 px for 25 m = 20 px/m',near(S.setScale([100,500],[600,500],25),20,1e-12));
ok('scale: diagonal taps use the true distance (300,400 px = 500 px)',near(S.setScale([0,0],[300,400],25),20,1e-12));
ok('scale refuses taps on the same spot',isNaN(S.setScale([10,10],[11,10],5)));ok('scale refuses a zero distance',isNaN(S.setScale([0,0],[100,0],0)));
const H=600,ppm=20;
ok('pixel to metre flips y',JSON.stringify(S.toM([100,500],ppm,H))==='[5,5]'&&JSON.stringify(S.toM([0,600],ppm,H))==='[0,0]');
ok('metre to pixel inverts it',JSON.stringify(S.toPx([5,5],ppm,H))==='[100,500]');
let r=S.rect([100,500],[700,100],ppm,H);ok('box: 600 x 400 px = 30 x 20 m at (5,5)',r&&r.x===5&&r.y===5&&r.w===30&&r.d===20,JSON.stringify(r));
r=S.rect([700,100],[100,500],ppm,H);ok('box: corner order does not matter',r&&r.x===5&&r.y===5&&r.w===30&&r.d===20);
ok('box smaller than 0.1 m is refused',S.rect([100,100],[101,300],ppm,H)===null);
let c=S.circle([220,400],[240,400],ppm,H);ok('circle: radius 20 px = 1 m, centre (11,10) -> corner (10,9), diameter 2',c&&c.x===10&&c.y===9&&c.w===2,JSON.stringify(c));
c=S.circle([220,400],[220,430],ppm,H);ok('circle: edge point below the centre gives the same kind of result',c&&c.w===3,JSON.stringify(c));
ok('circle with the edge on the centre is refused',S.circle([5,5],[5,5],ppm,H)===null);
/* round trip: every tap lands within half a centimetre of itself after the two conversions */
let worst=0;for(let i=0;i<200;i++){const p=[Math.random()*1000,Math.random()*600],m=[p[0]/ppm,(H-p[1])/ppm],q=S.toPx(m,ppm,H);worst=Math.max(worst,Math.hypot(q[0]-p[0],q[1]-p[1]))}ok('round trip is exact',worst<1e-9,worst);
ok('rounding to 1 cm: 0.123 m tap -> 0.12',S.toM([2.46,H],20,H)[0]===0.12);
console.log(fail?'FAILED '+fail:'all passed');process.exit(fail?1:0);
