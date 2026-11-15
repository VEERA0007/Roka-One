/* EPC live wind check: past daily wind gusts at the site (latitude and longitude) from the free Open-Meteo archive (ERA5 reanalysis),
   turned into a 50-year extreme-gust estimate (Gumbel fit to the yearly maxima) and the directions the strongest winds come from.
   This is a CROSS-CHECK only. ERA5 is a ~9 km model, so it smooths local gusts and reads LOWER than a real 3-second gust.
   The design value stays the IS 875 (Part 3) Vb that the engineer confirms; nothing here is written into the design. */
(function(){
  'use strict';
  var EULER=0.5772156649;
  function mean(a){var s=0;a.forEach(function(x){s+=x});return s/a.length}
  function sd(a){var m=mean(a),s=0;a.forEach(function(x){s+=(x-m)*(x-m)});return Math.sqrt(s/(a.length-1))}
  /* Gumbel (method of moments) return level for period T years */
  function gumbel(maxima,T){
    if(!maxima||maxima.length<8)return null;
    var m=mean(maxima),s=sd(maxima),b=s*Math.sqrt(6)/Math.PI,mu=m-EULER*b;
    return {mu:mu,beta:b,level:function(t){return mu-b*Math.log(-Math.log(1-1/t))},T50:mu-b*Math.log(-Math.log(1-1/(T||50)))};
  }
  var SECT=['N','NE','E','SE','S','SW','W','NW'];
  /* direction (degrees the wind comes FROM) counts for the strongest days */
  function sectors(speed,dir,frac){
    var idx=[],i;for(i=0;i<speed.length;i++)if(isFinite(speed[i])&&isFinite(dir[i]))idx.push(i);
    if(idx.length<30)return null;
    idx.sort(function(a,b){return speed[b]-speed[a]});
    var n=Math.max(10,Math.round(idx.length*(frac||0.05))),c=[0,0,0,0,0,0,0,0];
    for(i=0;i<n;i++){var d=((dir[idx[i]]%360)+360)%360;c[Math.floor(((d+22.5)%360)/45)]++}
    return {n:n,counts:c,names:SECT,top:c.map(function(v,k){return [SECT[k],v]}).sort(function(a,b){return b[1]-a[1]})[0][0],thresh:speed[idx[n-1]]};
  }
  /* d = Open-Meteo daily object {time:[...],wind_gusts_10m_max:[...],wind_speed_10m_max:[...],wind_direction_10m_dominant:[...]} */
  function analyse(d){
    if(!d||!d.time||!d.wind_gusts_10m_max)return {state:'error',msg:'The wind service returned no daily gust data.'};
    var byY={},cnt={},i;
    for(i=0;i<d.time.length;i++){var y=+String(d.time[i]).slice(0,4),g=d.wind_gusts_10m_max[i];if(!isFinite(g)||g===null)continue;cnt[y]=(cnt[y]||0)+1;if(!(y in byY)||g>byY[y])byY[y]=g}
    var years=Object.keys(byY).map(Number).filter(function(y){return cnt[y]>=330}).sort(),mx=years.map(function(y){return byY[y]});
    if(years.length<8)return {state:'error',msg:'Fewer than 8 complete years of data came back, so no extreme-value fit is made.'};
    var G=gumbel(mx,50),all=d.wind_gusts_10m_max.filter(isFinite),peakI=d.wind_gusts_10m_max.indexOf(Math.max.apply(null,all));
    return {state:'ok',years:years.length,from:years[0],to:years[years.length-1],maxObserved:Math.max.apply(null,mx),maxDate:d.time[peakI],
      meanAnnualMax:mean(mx),gust50:G.T50,gust100:G.level(100),annual:years.map(function(y,k){return [y,mx[k]]}),
      dirs:sectors(d.wind_gusts_10m_max,d.wind_direction_10m_dominant||[],0.05)};
  }
  function fetchData(lat,lon,fx){
    var f=fx||window.fetch,y1=new Date().getFullYear()-1,y0=y1-24;
    var u='https://archive-api.open-meteo.com/v1/archive?latitude='+lat.toFixed(4)+'&longitude='+lon.toFixed(4)+'&start_date='+y0+'-01-01&end_date='+y1+'-12-31&daily=wind_gusts_10m_max,wind_speed_10m_max,wind_direction_10m_dominant&wind_speed_unit=ms&timezone=auto';
    return f(u).then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json()}).then(function(j){if(j&&j.error)throw new Error(j.reason||'service error');return analyse(j.daily)});
  }
  /* wording next to the code value: never replaces it */
  function compare(a,vbCode){
    if(!a||a.state!=='ok')return '';
    var r=a.gust50;
    if(!(vbCode>0))return 'No code value to compare with.';
    if(r>vbCode)return 'WARNING: the reanalysis 50-year gust ('+r.toFixed(1)+' m/s) is ABOVE the basic wind speed in use ('+vbCode+' m/s), although reanalysis normally reads low. Do not proceed until the IS 875-3 value for this site is confirmed.';
    return 'The reanalysis 50-year gust ('+r.toFixed(1)+' m/s) is below the basic wind speed in use ('+vbCode+' m/s). That is expected: the model smooths local gusts, so this does not confirm the code value.';
  }
  window.EPCLiveWind={analyse:analyse,gumbel:gumbel,sectors:sectors,fetchData:fetchData,compare:compare};
  if(typeof module!=='undefined')module.exports=window.EPCLiveWind;
})();
