/* Zorro y la Gallina — juego venezolano
   HTML5 puro, sin dependencias. Compatible PC + móvil + minijuegos.com
   Tablero: cruz 7x7 sin esquinas 2x2 = 33 puntos. Gallinero: x=2..4, y=0..2.
*/
(function(){
"use strict";

var canvas = document.getElementById("tablero");
var ctx = canvas.getContext("2d");
var elTurno = document.getElementById("turno");
var elContador = document.getElementById("contador");
var elMensaje = document.getElementById("mensaje");
var elMenu = document.getElementById("menu");
var elSoplo = document.getElementById("btn-soplo");
var elSoplados = document.getElementById("soplados");
var elSopladosTxt = document.getElementById("soplados-txt");
var elHistorial = document.getElementById("historial");

var W = 7, H = 7;

function valida(x, y){
  if(x < 0 || x > 6 || y < 0 || y > 6) return false;
  if((x < 2 || x > 4) && (y < 2 || y > 4)) return false;
  return true;
}
function esGallinero(x, y){
  return x >= 2 && x <= 4 && y >= 0 && y <= 2;
}
function clave(x, y){ return x + "," + y; }

// Vecinos según líneas dibujadas: ortogonal siempre, diagonal solo si el
// cuadrado 2x2 está completo (evita diagonales por las esquinas recortadas).
var VECINOS = {};
(function(){
  var dirsO = [[1,0],[-1,0],[0,1],[0,-1]];
  var dirsD = [[1,1],[1,-1],[-1,1],[-1,-1]];
  for(var y=0;y<7;y++) for(var x=0;x<7;x++){
    if(!valida(x,y)) continue;
    var lista = [];
    for(var i=0;i<dirsO.length;i++){
      var nx=x+dirsO[i][0], ny=y+dirsO[i][1];
      if(valida(nx,ny)) lista.push({x:nx,y:ny,dx:dirsO[i][0],dy:dirsO[i][1]});
    }
    for(var j=0;j<dirsD.length;j++){
      var dx=dirsD[j][0], dy=dirsD[j][1];
      var mx=x+dx, my=y+dy;
      if(!valida(mx,my)) continue;
      // el 2x2 debe estar completo para que exista la diagonal
      if(valida(x+dx,y) && valida(x,y+dy) && valida(mx,my)){
        lista.push({x:mx,y:my,dx:dx,dy:dy});
      }
    }
    VECINOS[clave(x,y)] = lista;
  }
})();

function vecinos(x,y){ return VECINOS[clave(x,y)] || []; }

// ---------- Estado ----------
var tablero = {};   // "x,y" -> "g" | "z"
var turno = "g";
var seleccionado = null;      // {x,y}
var legalesSel = [];          // movimientos del seleccionado
var capturasZorroInicio = []; // capturas disponibles al empezar turno zorro
var soploDisponible = false;
var zorroASoplar = null;      // {x,y} del zorro que omitió captura
var suspendidos = 0;          // zorros soplados fuera del tablero
var soplosTotal = 0;          // estadística de soplos en la partida
var historial = [];           // últimos eventos (soplos, retornos, capturas)
function log(txt){
  historial.unshift(txt);
  if(historial.length>5) historial.pop();
  if(!elHistorial) return;
  elHistorial.innerHTML="";
  for(var i=0;i<historial.length;i++){
    var d=document.createElement("div");
    d.textContent=historial[i];
    elHistorial.appendChild(d);
  }
}
var enCadena = null;          // {x,y} zorro que debe seguir capturando
var colocandoSuspendido = false;
var fin = null;               // {ganador:"g"|"z", motivo}
var modo = "2p";              // 2p | gallinas (humano gallinas) | zorros
var dificultad = "moderado";
var iaPensando = false;

function mensaje(t){ elMensaje.textContent = t || ""; }

function iniciar(){
  tablero = {};
  for(var y=0;y<7;y++) for(var x=0;x<7;x++){
    if(!valida(x,y)) continue;
    tablero[clave(x,y)] = null;
  }
  // Zorros en las esquinas del gallinero (entrada)
  tablero[clave(2,2)] = "z";
  tablero[clave(4,2)] = "z";
  // 20 gallinas en y>=3
  for(var y2=3;y2<7;y2++) for(var x2=0;x2<7;x2++){
    if(!valida(x2,y2)) continue;
    tablero[clave(x2,y2)] = "g";
  }
  turno = "g"; // empiezan gallinas
  seleccionado = null; legalesSel = [];
  capturasZorroInicio = [];
  soploDisponible = false; zorroASoplar = null;
  suspendidos = 0; enCadena = null; colocandoSuspendido = false;
  soplosTotal = 0; historial = []; if(elHistorial) elHistorial.innerHTML="";
  fin = null; iaPensando = false;
  elSoplo.hidden = true;
  mensaje("");
  actualizar();
  pedirIA(); // si la IA mueve primero (p. ej. humano=zorro), despertarla
}

function contarGallinas(){
  var n=0;
  for(var k in tablero) if(tablero[k]==="g") n++;
  return n;
}
function contarZorros(){
  var n=0;
  for(var k in tablero) if(tablero[k]==="z") n++;
  return n;
}
function gallineroCompleto(){
  for(var y=0;y<=2;y++) for(var x=2;x<=4;x++){
    if(tablero[clave(x,y)]!=="g") return false;
  }
  return true;
}

// ---------- Movimientos ----------
function movsGallinaDesde(x,y){
  var res=[];
  var vs=vecinos(x,y);
  for(var i=0;i<vs.length;i++){
    var dy=vs[i].y-y;
    if(dy>0) continue; // nunca retroceden (sur = +y)
    if(tablero[clave(vs[i].x,vs[i].y)]===null){
      res.push({deX:x,deY:y,aX:vs[i].x,aY:vs[i].y});
    }
  }
  return res;
}
function todosMovsGallina(){
  var res=[];
  for(var y=0;y<7;y++) for(var x=0;x<7;x++){
    if(!valida(x,y)) continue;
    if(tablero[clave(x,y)]!=="g") continue;
    var m=movsGallinaDesde(x,y);
    for(var i=0;i<m.length;i++) res.push(m[i]);
  }
  return res;
}
// Capturas de un zorro en (x,y): salto sobre 1 gallina a vacío justo detrás.
// No puede saltar dos gallinas seguidas (solo un salto simple por captura).
function capturasZorroEn(x,y){
  var res=[];
  var vs=vecinos(x,y);
  for(var i=0;i<vs.length;i++){
    var mx=vs[i].x, my=vs[i].y;
    if(tablero[clave(mx,my)]!=="g") continue;
    var dx=vs[i].dx, dy=vs[i].dy;
    var lx=mx+dx, ly=my+dy;
    if(!valida(lx,ly)) continue;
    if(tablero[clave(lx,ly)]!==null) continue;
    // el aterrizaje debe ser vecino del medio en la misma dirección
    // (garantiza seguir la línea del tablero)
    var ok=false;
    var vm=vecinos(mx,my);
    for(var j=0;j<vm.length;j++){
      if(vm[j].x===lx && vm[j].y===ly && vm[j].dx===dx && vm[j].dy===dy){ ok=true; break; }
    }
    if(!ok) continue;
    res.push({deX:x,deY:y,midX:mx,midY:my,aX:lx,aY:ly});
  }
  return res;
}
function simplesZorroEn(x,y){
  var res=[];
  var vs=vecinos(x,y);
  for(var i=0;i<vs.length;i++){
    if(tablero[clave(vs[i].x,vs[i].y)]===null)
      res.push({deX:x,deY:y,aX:vs[i].x,aY:vs[i].y});
  }
  return res;
}
function todasCapturasZorro(){
  var res=[];
  for(var y=0;y<7;y++) for(var x=0;x<7;x++){
    if(!valida(x,y)) continue;
    if(tablero[clave(x,y)]!=="z") continue;
    var c=capturasZorroEn(x,y);
    for(var i=0;i<c.length;i++) res.push(c[i]);
  }
  return res;
}
function zorroTieneMovimientos(){
  for(var y=0;y<7;y++) for(var x=0;x<7;x++){
    if(!valida(x,y)) continue;
    if(tablero[clave(x,y)]!=="z") continue;
    if(simplesZorroEn(x,y).length>0) return true;
    if(capturasZorroEn(x,y).length>0) return true;
  }
  return false;
}

// ---------- Fin del juego ----------
function revisarFin(){
  if(fin) return true;
  var g=contarGallinas();
  if(g<=8){ fin={ganador:"z",motivo:"Quedan "+g+" gallinas (8 o menos). ¡Los zorros ganan!"}; return true; }
  if(gallineroCompleto()){ fin={ganador:"g",motivo:"¡Las 9 casillas del gallinero están ocupadas! ¡Ganan las gallinas!"}; return true; }
  return false;
}

// ---------- Audio procedural (sin archivos, apto minijuegos) ----------
var audioCtx=null, sonidoOn=true;
function ctxAudio(){
  try{
    if(!audioCtx) audioCtx=new (window.AudioContext||window.webkitAudioContext)();
    if(audioCtx.state==="suspended") audioCtx.resume();
  }catch(e){}
  return audioCtx;
}
function beep(freq,dur,tipo){
  if(!sonidoOn) return;
  try{
    var ac=ctxAudio(); if(!ac) return;
    var o=ac.createOscillator(), gn=ac.createGain();
    o.type=tipo||"sine"; o.frequency.value=freq||440;
    gn.gain.value=0.08;
    o.connect(gn); gn.connect(ac.destination);
    o.start(); gn.gain.exponentialRampToValueAtTime(0.0001,ac.currentTime+(dur||0.12));
    o.stop(ac.currentTime+(dur||0.12));
  }catch(e){}
}
function ruidoBurst(dur,filtroFreq,gan){
  if(!sonidoOn) return;
  try{
    var ac=ctxAudio(); if(!ac) return;
    var n=Math.floor(ac.sampleRate*dur);
    var buf=ac.createBuffer(1,n,ac.sampleRate);
    var d=buf.getChannelData(0);
    for(var i=0;i<n;i++) d[i]=(Math.random()*2-1)*(1-i/n);
    var src=ac.createBufferSource(); src.buffer=buf;
    var f=ac.createBiquadFilter(); f.type="lowpass"; f.frequency.value=filtroFreq||1200;
    var g=ac.createGain(); g.gain.value=gan||0.25;
    src.connect(f); f.connect(g); g.connect(ac.destination);
    src.start();
  }catch(e){}
}
// ¡cocorocó! de vez en cuando: dos cloqueos descendentes
function sonidoGallina(){
  if(!sonidoOn) return;
  try{
    var ac=ctxAudio(); if(!ac) return;
    [0,0.13].forEach(function(dt,j){
      var o=ac.createOscillator(), g=ac.createGain();
      o.type="square";
      var t0=ac.currentTime+dt;
      o.frequency.setValueAtTime(j?620:760,t0);
      o.frequency.exponentialRampToValueAtTime(j?420:520,t0+0.1);
      g.gain.setValueAtTime(0.0001,t0);
      g.gain.exponentialRampToValueAtTime(0.12,t0+0.015);
      g.gain.exponentialRampToValueAtTime(0.0001,t0+0.11);
      o.connect(g); g.connect(ac.destination);
      o.start(t0); o.stop(t0+0.13);
    });
  }catch(e){}
}
// Rugido/g gruñido grave del zorro con vibrato
function sonidoZorro(){
  if(!sonidoOn) return;
  try{
    var ac=ctxAudio(); if(!ac) return;
    var t0=ac.currentTime;
    var o=ac.createOscillator(), g=ac.createGain(), f=ac.createBiquadFilter();
    o.type="sawtooth";
    o.frequency.setValueAtTime(110,t0);
    o.frequency.linearRampToValueAtTime(75,t0+0.45);
    var lfo=ac.createOscillator(), lg=ac.createGain();
    lfo.type="sine"; lfo.frequency.value=9; lg.gain.value=18;
    lfo.connect(lg); lg.connect(o.frequency);
    f.type="lowpass"; f.frequency.value=500;
    g.gain.setValueAtTime(0.0001,t0);
    g.gain.exponentialRampToValueAtTime(0.22,t0+0.05);
    g.gain.exponentialRampToValueAtTime(0.0001,t0+0.55);
    o.connect(f); f.connect(g); g.connect(ac.destination);
    o.start(t0); lfo.start(t0); o.stop(t0+0.6); lfo.stop(t0+0.6);
  }catch(e){}
}
// ¡ñam ñam! crujido doble al comer
function sonidoComer(){
  if(!sonidoOn) return;
  ruidoBurst(0.16,900,0.35);
  setTimeout(function(){ ruidoBurst(0.2,700,0.3); },130);
  beep(140,0.18,"triangle");
}
// Silbido de viento para el soplo 💨 (barrido descendente)
function sonidoSoplo(){
  if(!sonidoOn) return;
  try{
    var ac=ctxAudio(); if(!ac) return;
    var dur=0.7, n=Math.floor(ac.sampleRate*dur);
    var buf=ac.createBuffer(1,n,ac.sampleRate);
    var d=buf.getChannelData(0);
    for(var i=0;i<n;i++) d[i]=(Math.random()*2-1)*(1-i/n);
    var src=ac.createBufferSource(); src.buffer=buf;
    var f=ac.createBiquadFilter(); f.type="bandpass"; f.Q.value=1.2;
    f.frequency.setValueAtTime(2400,ac.currentTime);
    f.frequency.exponentialRampToValueAtTime(350,ac.currentTime+dur);
    var g=ac.createGain();
    g.gain.setValueAtTime(0.0001,ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.3,ac.currentTime+0.08);
    g.gain.exponentialRampToValueAtTime(0.0001,ac.currentTime+dur);
    src.connect(f); f.connect(g); g.connect(ac.destination);
    src.start();
  }catch(e){}
}
// Ambiente: gallina de vez en cuando, zorro más raro
setInterval(function(){
  if(!sonidoOn || fin) return;
  var r=Math.random();
  if(r<0.35 && contarGallinas()>0) sonidoGallina();
  else if(r<0.45 && contarZorros()>0) sonidoZorro();
},9000);

// ---------- Ejecutar jugadas ----------
function moverGallina(m){
  if(enCadena) return; // cadena de zorro pendiente: las gallinas deben esperar
  tablero[clave(m.deX,m.deY)]=null;
  tablero[clave(m.aX,m.aY)]="g";
  animarMov(m.deX,m.deY,m.aX,m.aY,"g");
  beep(520,0.08);
  if(Math.random()<0.25) setTimeout(sonidoGallina,150);
  soploDisponible=false; zorroASoplar=null; elSoplo.hidden=true;
  seleccionado=null; legalesSel=[];
  if(revisarFin()){ actualizar(); return; }
  // ¿zorros inmovilizados?
  if(!zorroTieneMovimientos() && contarZorros()>0){
    fin={ganador:"g",motivo:"¡Zorros inmovilizados por completo! ¡Ganan las gallinas!"};
    actualizar(); return;
  }
  if(contarZorros()===0){
    fin={ganador:"g",motivo:"¡No quedan zorros en el tablero! ¡Ganan las gallinas!"};
    actualizar(); return;
  }
  turno="z";
  enCadena=null;
  capturasZorroInicio=todasCapturasZorro();
  // si gallinas no tienen salida en su próximo turno se detectará luego;
  // si zorros no tienen captura ni movimiento ya se declaró arriba.
  actualizar();
  pedirIA();
}

function moverZorroSimple(deX,deY,aX,aY){
  var habiaCaptura = capturasZorroInicio.length>0;
  tablero[clave(deX,deY)]=null;
  tablero[clave(aX,aY)]="z";
  animarMov(deX,deY,aX,aY,"z");
  beep(300,0.09);
  if(habiaCaptura){
    // Se sopla el que PODÍA COMER, no el que se movió:
    // si el zorro movido era uno de los que podía capturar, ese (en su nueva casilla);
    // si movió al otro, se sopla al que se quedó sin comer (sigue en su casilla original).
    var movidoPodia=false;
    for(var i=0;i<capturasZorroInicio.length;i++){
      if(capturasZorroInicio[i].deX===deX && capturasZorroInicio[i].deY===deY){ movidoPodia=true; break; }
    }
    if(movidoPodia) zorroASoplar={x:aX,y:aY};
    else zorroASoplar={x:capturasZorroInicio[0].deX, y:capturasZorroInicio[0].deY};
    soploDisponible=true;
  } else { soploDisponible=false; zorroASoplar=null; }
  seleccionado=null; legalesSel=[];
  turno="g";
  // ¿gallinas sin movimientos? -> ganan zorros (bloqueo total)
  if(todosMovsGallina().length===0){
    fin={ganador:"z",motivo:"Las gallinas no tienen ningún movimiento. ¡Ganan los zorros!"};
  }
  revisarFin();
  actualizar();
  pedirIA();
}

function moverZorroCaptura(cap){
  tablero[clave(cap.midX,cap.midY)]=null; // gallina comida
  tablero[clave(cap.deX,cap.deY)]=null;
  tablero[clave(cap.aX,cap.aY)]="z";
  animarMov(cap.deX,cap.deY,cap.aX,cap.aY,"z");
  var pm=aPx(cap.midX,cap.midY); puff(pm.x,pm.y,"#fff",10); puff(pm.x,pm.y,"#e02b2b",6);
  // animación de comer: plumas + ¡Ñam! + boca abierta + sonidos
  var pa=aPx(cap.aX,cap.aY);
  puff(pm.x,pm.y,"#fffdf6",14); puff(pm.x,pm.y,"#f7ead0",8);
  textos.push({x:pa.x,y:pa.y-46,txt:"¡Ñam! 🍗",t0:performance.now()});
  COMIENDO_HASTA = performance.now()+900;
  sonidoComer(); setTimeout(sonidoZorro,250);
  beep(180,0.15,"sawtooth");
  soploDisponible=false; zorroASoplar=null;
  if(revisarFin()){ actualizar(); return; }
  // cadena obligatoria: ¿puede seguir capturando?
  // El turno NO pasa a las gallinas hasta terminar: enCadena bloquea
  // cualquier jugada de gallinas o soplo (ver guardias en moverGallina/aplicarSoplo).
  var mas=capturasZorroEn(cap.aX,cap.aY);
  if(mas.length>0){
    enCadena={x:cap.aX,y:cap.aY};
    seleccionado={x:cap.aX,y:cap.aY};
    legalesSel=[]; // sin pistas: el jugador debe encontrar el salto (sin X)
    mensaje("¡Se comió una! Si puede seguir comiendo, DEBE seguir con el mismo zorro. Busca el salto.");
    actualizar();
    pedirIA(); // por si es IA, que continúe
    return;
  }
  enCadena=null; seleccionado=null; legalesSel=[];
  // Sin retorno: el zorro soplado queda fuera hasta el final.
  turno="g";
  if(todosMovsGallina().length===0){
    fin={ganador:"z",motivo:"Las gallinas no tienen ningún movimiento. ¡Ganan los zorros!"};
  }
  actualizar();
  pedirIA();
}

function aplicarSoplo(){
  if(enCadena) return; // no se puede soplar a mitad de una cadena
  if(!soploDisponible || !zorroASoplar || fin) return;
  if(tablero[clave(zorroASoplar.x,zorroASoplar.y)]!=="z") return;
  var ps=aPx(zorroASoplar.x,zorroASoplar.y);
  // viento: ráfaga hacia la derecha-arriba + nube gris
  puff(ps.x,ps.y,"#9e9e9e",12);
  for(var i=0;i<14;i++){
    particulas.push({x:ps.x-20+Math.random()*40,y:ps.y-10+Math.random()*20,
      vx:180+Math.random()*220,vy:-60-Math.random()*120,vida:1,color:"#bcd7f0"});
  }
  textos.push({x:ps.x,y:ps.y-52,txt:"💨 ¡Soplado!",t0:performance.now()});
  tablero[clave(zorroASoplar.x,zorroASoplar.y)]=null;
  suspendidos++; soplosTotal++;
  sonidoSoplo();
  log("💨 Soplo #"+soplosTotal+": un zorro fuera hasta el final. Queda(n) "+contarZorros()+" en juego.");
  mensaje("💨 ¡Soplado! Ese zorro queda fuera hasta el final. (Turno consumido)");
  soploDisponible=false; zorroASoplar=null; elSoplo.hidden=true;
  seleccionado=null; legalesSel=[];
  // soplar consume el turno de gallinas
  if(contarZorros()===0){
    fin={ganador:"g",motivo:"¡Los dos zorros fueron soplados! ¡Ganan las gallinas!"};
    actualizar(); return;
  }
  if(!zorroTieneMovimientos()){
    fin={ganador:"g",motivo:"¡Zorros inmovilizados! ¡Ganan las gallinas!"};
    actualizar(); return;
  }
  turno="z";
  capturasZorroInicio=todasCapturasZorro();
  actualizar();
  pedirIA();
}

// ---------- IA sencilla ----------
function esTurnoIA(){
  if(fin || colocandoSuspendido) return false;
  if(modo==="2p") return false;
  if(modo==="gallinas" && turno==="z") return true;
  if(modo==="zorros" && turno==="g") return true;
  return false;
}
function pedirIA(){
  if(!esTurnoIA()) return;
  if(iaPensando) return;
  iaPensando=true;
  mensaje("La IA está pensando…");
  setTimeout(function(){
    iaPensando=false;
    if(fin) { actualizar(); return; }
    if(turno==="z") iaZorro();
    else iaGallina();
  }, 450);
}
function aleatorio(a){ return a[Math.floor(Math.random()*a.length)]; }

// ---------- Niveles IA: facil | moderado | dificil | imposible ----------
function ruidoIA(){
  if(dificultad==="facil") return 8;
  if(dificultad==="moderado") return 1.6;
  if(dificultad==="dificil") return 0.4;
  return 0; // imposible: sin azar
}
function probSoploIA(){
  if(dificultad==="facil") return 0.3;
  if(dificultad==="moderado") return 0.7;
  if(dificultad==="dificil") return 0.95;
  return 1; // imposible siempre sopla
}
// Puntuación pro-gallinas (más alto = mejor para 🐔). Ojo: es heurística.
function evaluarPos(){
  var s=contarGallinas()*10 + suspendidos*25;
  for(var y=0;y<7;y++) for(var x=0;x<7;x++){
    if(!valida(x,y)||tablero[clave(x,y)]!=="g") continue;
    if(esGallinero(x,y)) s+=18;
    s+=(6-y)*0.6;
  }
  var mov=0;
  for(var y2=0;y2<7;y2++) for(var x2=0;x2<7;x2++){
    if(!valida(x2,y2)||tablero[clave(x2,y2)]!=="z") continue;
    mov+=simplesZorroEn(x2,y2).length+capturasZorroEn(x2,y2).length;
  }
  s-=mov*1.2;
  s-=todasCapturasZorro().length*6; // gallinas a punto de ser comidas
  return s;
}
function probarM(m){ // aplica el movimiento y devuelve función para deshacer
  var k1=clave(m.deX,m.deY), k2=clave(m.aX,m.aY), v=tablero[k1];
  tablero[k1]=null; tablero[k2]=v;
  return function(){ tablero[k1]=v; tablero[k2]=null; };
}
function probarC(cap){ // aplica la captura y devuelve función para deshacer
  var km=clave(cap.midX,cap.midY), k1=clave(cap.deX,cap.deY), k2=clave(cap.aX,cap.aY);
  var mid=tablero[km];
  tablero[km]=null; tablero[k1]=null; tablero[k2]="z";
  return function(){ tablero[km]=mid; tablero[k1]="z"; tablero[k2]=null; };
}
function todosSimplesZorro(){
  var res=[];
  for(var y=0;y<7;y++) for(var x=0;x<7;x++){
    if(!valida(x,y)||tablero[clave(x,y)]!=="z") continue;
    var s=simplesZorroEn(x,y);
    for(var i=0;i<s.length;i++) res.push(s[i]);
  }
  return res;
}
// Mejor respuesta gallina tras jugada de zorro (las gallinas maximizan)
function respuestaGallina(){
  var movs=todosMovsGallina();
  if(movs.length===0) return -1e9; // gallinas bloqueadas: perfecto para el zorro
  var ord=movs.map(function(m){ return {m:m,s:notaRapidaGallina(m)}; });
  ord.sort(function(a,b){ return b.s-a.s; });
  var top=ord.slice(0,14), best=-1e9;
  for(var i=0;i<top.length;i++){
    var des=probarM(top[i].m);
    var v=evaluarPos();
    des();
    if(v>best) best=v;
  }
  return best;
}
// Mejor respuesta zorro tras jugada de gallina (el zorro minimiza)
function respuestaZorro(){
  var caps=todasCapturasZorro();
  if(caps.length>0){
    var peor=1e9;
    for(var i=0;i<caps.length;i++){
      var des=probarC(caps[i]);
      var v=evaluarPos()-capturasTras(caps[i].aX,caps[i].aY,1)*4;
      des();
      if(v<peor) peor=v;
    }
    return peor;
  }
  var movs=todosSimplesZorro();
  if(movs.length===0) return 1e9; // zorros inmóviles: perfecto para gallinas
  var p2=1e9;
  for(var j=0;j<movs.length;j++){
    var d2=probarM(movs[j]);
    var v2=evaluarPos();
    d2();
    if(v2<p2) p2=v2;
  }
  return p2;
}

function iaZorro(){
  var imp=(dificultad==="imposible");
  // 1) cadena en curso con el mismo zorro
  if(enCadena){
    var caps=capturasZorroEn(enCadena.x,enCadena.y);
    if(caps.length===0){ enCadena=null; turno="g"; actualizar(); pedirIA(); return; }
    var mejor=caps[0];
    if(imp){
      var bv=1e9;
      for(var i=0;i<caps.length;i++){
        var des=probarC(caps[i]);
        var v=respuestaGallina();
        des();
        if(v<bv){bv=v;mejor=caps[i];}
      }
    } else {
      var mejorN=-1;
      for(var k=0;k<caps.length;k++){
        var n=1+capturasTras(caps[k].aX,caps[k].aY,2);
        if(n>mejorN || (dificultad==="facil" && Math.random()<0.25)){mejorN=n;mejor=caps[k];}
      }
    }
    moverZorroCaptura(mejor);
    return;
  }
  var capsT=todasCapturasZorro();
  // En fácil el zorro a veces "se distrae" y no come (¡lo pueden soplar!)
  var distraido=capsT.length>0 && dificultad==="facil" && Math.random()<0.30;
  if(capsT.length>0 && !distraido){
    var b=capsT[0];
    if(imp){
      var bb=1e9;
      for(var q=0;q<capsT.length;q++){
        var d3=probarC(capsT[q]);
        var v3=respuestaGallina();
        d3();
        if(v3<bb){bb=v3;b=capsT[q];}
      }
    } else {
      var bn=-1;
      for(var r=0;r<capsT.length;r++){
        var nn=1+capturasTras(capsT[r].aX,capsT[r].aY,2);
        var extra=esGallinero(capsT[r].aX,capsT[r].aY)?0.5:0;
        if(nn+extra>bn || (dificultad==="facil" && Math.random()<0.25)){bn=nn+extra;b=capsT[r];}
      }
    }
    // posicionar selección para animar
    seleccionado={x:b.deX,y:b.deY};
    moverZorroCaptura(b);
    return;
  }
  // 2) movimiento simple: acercarse a gallinas y tapar entrada del gallinero
  var cand=todosSimplesZorro();
  if(cand.length===0){ fin={ganador:"g",motivo:"¡Zorros inmovilizados! ¡Ganan las gallinas!"}; actualizar(); return; }
  var mejorM=cand[0];
  if(imp){
    var bm=1e9;
    for(var c2=0;c2<cand.length;c2++){
      var d4=probarM(cand[c2]);
      var v4=respuestaGallina();
      d4();
      if(v4<bm){bm=v4;mejorM=cand[c2];}
    }
  } else {
    var mejorS=-1e9;
    for(var c=0;c<cand.length;c++){
      var m=cand[c], sc=Math.random()*ruidoIA();
      // tapar gallinero: cercanía a (3,2)/(3,1)
      sc-=(Math.abs(m.aX-3)+Math.abs(m.aY-2))*1.2;
      // cercanía a gallinas
      var dmin=99;
      for(var yy=0;yy<7;yy++) for(var xx=0;xx<7;xx++){
        if(valida(xx,yy)&&tablero[clave(xx,yy)]==="g"){
          var d=Math.abs(xx-m.aX)+Math.abs(yy-m.aY);
          if(d<dmin)dmin=d;
        }
      }
      sc+=(6-dmin)*0.8;
      if(esGallinero(m.aX,m.aY)) sc+=1.5;
      if(dificultad==="dificil") sc+=capturasZorroEn(m.aX,m.aY).length*2.5; // armar horquillas
      if(sc>mejorS){mejorS=sc;mejorM=m;}
    }
  }
  capturasZorroInicio=capsT;
  moverZorroSimple(mejorM.deX,mejorM.deY,mejorM.aX,mejorM.aY);
}
function capturasTras(x,y,prof){
  if(prof<=0) return 0;
  // simula: cuenta máxima de capturas encadenadas (estimación)
  var caps=capturasZorroEn(x,y);
  if(caps.length===0) return 0;
  var mx=0;
  for(var i=0;i<caps.length;i++){
    // evita recursión con estado real: aproximación por cercanía
    mx=Math.max(mx,1);
  }
  return mx;
}
function gallinaEnPeligro(x,y){
  // ¿un zorro podría capturar una gallina si estuviera en (x,y)?
  // hay zorro adyacente con vacío detrás en línea recta
  for(var yy=0;yy<7;yy++) for(var xx=0;xx<7;xx++){
    if(!valida(xx,yy)||tablero[clave(xx,yy)]!=="z") continue;
    var vs=vecinos(xx,yy);
    for(var i=0;i<vs.length;i++){
      if(vs[i].x===x&&vs[i].y===y){
        var lx=x+vs[i].dx, ly=y+vs[i].dy;
        if(valida(lx,ly)&&tablero[clave(lx,ly)]===null) return true;
        var lx2=xx-vs[i].dx, ly2=yy-vs[i].dy; // zorro salta desde otro lado (x es aterrizaje)
        // captura donde (x,y) es el medio: zorro en (xx,yy), medio (x,y), aterrizaje vacío
        // ya cubierto arriba. También (x,y) como origen no aplica (gallina no captura).
      }
    }
  }
  return false;
}
function notaRapidaGallina(m){
  var s=(6-m.aY)*1.6;
  if(esGallinero(m.aX,m.aY)) s+=8;
  s-=Math.abs(m.aX-3)*0.5;
  if(gallinaEnPeligro(m.aX,m.aY)) s-=9;
  return s;
}
function iaGallina(){
  if(enCadena) return; // el zorro debe terminar su cadena
  var movs=todosMovsGallina();
  if(movs.length===0){ fin={ganador:"z",motivo:"Las gallinas no tienen movimientos. ¡Ganan los zorros!"}; actualizar(); return; }
  // si hay soplo disponible, la IA decide según nivel
  if(soploDisponible && modo==="zorros" && Math.random()<probSoploIA()){
    aplicarSoplo(); return;
  }
  var mejor=movs[0];
  if(dificultad==="imposible"){
    var ord=movs.map(function(m){ return {m:m,s:notaRapidaGallina(m)}; });
    ord.sort(function(a,b){ return b.s-a.s; });
    var top=ord.slice(0,14), bs=-1e9;
    for(var i=0;i<top.length;i++){
      var des=probarM(top[i].m);
      var v=respuestaZorro();
      des();
      if(v>bs){bs=v;mejor=top[i].m;}
    }
  } else {
    var castigo=(dificultad==="dificil")?14:9;
    var mejorS=-1e9;
    for(var j=0;j<movs.length;j++){
      var mm=movs[j], s=Math.random()*ruidoIA();
      s+=(6-mm.aY)*1.6;                    // avanzar al norte (gallinero arriba)
      if(esGallinero(mm.aX,mm.aY)) s+=6;   // entrar al gallinero vale mucho
      if(mm.aY<=2 && mm.aX>=2 && mm.aX<=4) s+=2;
      s-=Math.abs(mm.aX-3)*0.5;            // centrarse
      if(gallinaEnPeligro(mm.aX,mm.aY)) s-=castigo; // evitar ser comida
      if(s>mejorS){mejorS=s;mejor=mm;}
    }
  }
  seleccionado={x:mejor.deX,y:mejor.deY};
  moverGallina(mejor);
}

// ---------- Sprites animados (procedurales, sin PNG) ----------
// Ventaja para minijuegos.com y móvil: cero archivos externos, todo vector.
// Si luego quieres PNG, cambia dibujarGallina/dibujarZorro por drawImage.
var OX=165, OY=85, STEP=105;
function aPx(x,y){ return {x:OX+x*STEP, y:OY+y*STEP}; }

var animMov = null;      // {x0,y0,x1,y1,t0,dur,pieza:"g"|"z"}
var particulas = [];     // {x,y,vx,vy,vida,color}
var textos = [];         // {x,y,txt,t0}
var COMIENDO_HASTA = 0;  // timestamp: boca del zorro abierta al comer
var ULTIMO_T = 0;
function animarMov(deX,deY,aX,aY,pieza){
  animMov = {x0:deX,y0:deY,x1:aX,y1:aY,t0:performance.now(),dur:220,pieza:pieza};
}
function puff(px,py,color,n){
  for(var i=0;i<(n||10);i++){
    var a=Math.random()*Math.PI*2, v=60+Math.random()*160;
    particulas.push({x:px,y:py,vx:Math.cos(a)*v,vy:Math.sin(a)*v-60,vida:1,color:color});
  }
}
function parpadea(t, offset){
  var c=(t+offset)%3400;
  return c>3150; // ojos cerrados 250ms cada 3.4s
}
function dibujarGallina(px,py,t,sel){
  // Perfil 3/4 mirando a la izquierda, como la referencia del usuario:
  // pico en la esquina izquierda de la cara, ala ovalada al costado derecho.
  var bob=Math.sin(t/280+px/50)*2.5;
  var esc=sel?1.12:1;
  ctx.save(); ctx.translate(px,py+bob); ctx.scale(esc,esc);
  var BORDE="#b35c00";
  // sombra
  ctx.fillStyle="rgba(0,0,0,.25)";
  ctx.beginPath(); ctx.ellipse(0,28-bob,24,7,0,0,7); ctx.fill();
  // patas (detrás del cuerpo)
  ctx.strokeStyle="#f39c12"; ctx.lineWidth=5; ctx.lineCap="round";
  var pas=Math.sin(t/160)*2.5;
  ctx.beginPath(); ctx.moveTo(-7,22); ctx.lineTo(-7,32+pas); ctx.moveTo(7,22); ctx.lineTo(7,32-pas); ctx.stroke();
  // cuerpo redondo blanco con borde marrón grueso
  ctx.fillStyle="#fffdf6";
  ctx.strokeStyle=BORDE; ctx.lineWidth=5;
  ctx.beginPath(); ctx.ellipse(0,8,26,24,0,0,7); ctx.fill(); ctx.stroke();
  // colita a la derecha
  ctx.fillStyle="#fffdf6"; ctx.strokeStyle=BORDE; ctx.lineWidth=4;
  ctx.beginPath();
  ctx.moveTo(20,-2); ctx.lineTo(33,-10); ctx.lineTo(31,4); ctx.closePath();
  ctx.fill(); ctx.stroke();
  // ALA al costado derecho: óvalo beige con borde, inclinada
  var al=Math.sin(t/220)*2;
  ctx.save(); ctx.translate(13,10+al*0.4); ctx.rotate(0.5);
  ctx.fillStyle="#f7ead0";
  ctx.strokeStyle=BORDE; ctx.lineWidth=3.5;
  ctx.beginPath(); ctx.ellipse(0,0,11,15,0,0,7); ctx.fill(); ctx.stroke();
  ctx.restore();
  // cabeza arriba, levemente a la izquierda
  ctx.fillStyle="#fffdf6"; ctx.strokeStyle=BORDE; ctx.lineWidth=4.5;
  ctx.beginPath(); ctx.arc(-2,-18,18,0,7); ctx.fill(); ctx.stroke();
  // cresta roja arriba
  ctx.fillStyle="#e52323";
  ctx.beginPath();
  ctx.arc(-12,-35,7,0,7); ctx.arc(-3,-39,8,0,7); ctx.arc(6,-35,7,0,7);
  ctx.fill();
  ctx.strokeStyle="#b01313"; ctx.lineWidth=2; ctx.stroke();
  // PICO en la esquina izquierda de la cara (triángulo hacia la izquierda)
  ctx.fillStyle="#f5a623";
  ctx.strokeStyle="#d17f0a"; ctx.lineWidth=2;
  ctx.beginPath();
  ctx.moveTo(-17,-16); ctx.lineTo(-34,-10); ctx.lineTo(-17,-5);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // línea del pico
  ctx.strokeStyle="#d17f0a"; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(-18,-10.5); ctx.lineTo(-30,-10.5); ctx.stroke();
  // ojo grande arriba del pico (con parpadeo)
  if(parpadea(t,px)){ ctx.strokeStyle="#222"; ctx.lineWidth=3;
    ctx.beginPath(); ctx.moveTo(-12,-22); ctx.lineTo(-2,-22); ctx.stroke();
  } else { ctx.fillStyle="#141414"; ctx.beginPath(); ctx.arc(-7,-21,5.2,0,7); ctx.fill();
    ctx.fillStyle="#fff"; ctx.beginPath(); ctx.arc(-5.5,-22.5,1.8,0,7); ctx.fill(); }
  ctx.restore();
}
function dibujarZorro(px,py,t,sel){
  var bob=Math.sin(t/320+py/60)*2;
  var cola=Math.sin(t/240)*0.35;
  var esc=sel?1.12:1;
  ctx.save(); ctx.translate(px,py+bob); ctx.scale(esc,esc);
  // sombra
  ctx.fillStyle="rgba(0,0,0,.28)";
  ctx.beginPath(); ctx.ellipse(0,28-bob,28,8,0,0,7); ctx.fill();
  // cola grande con punta blanca (menea)
  ctx.save(); ctx.rotate(cola*0.4);
  ctx.fillStyle="#e2701d"; ctx.strokeStyle="#7a0d0d"; ctx.lineWidth=3.5;
  ctx.beginPath(); ctx.ellipse(24,12,18,11,0.5,0,7); ctx.fill(); ctx.stroke();
  ctx.fillStyle="#fff";
  ctx.beginPath(); ctx.ellipse(36,17,8,6,0.5,0,7); ctx.fill();
  ctx.restore();
  // cuerpo
  ctx.fillStyle="#ef7d22";
  ctx.strokeStyle="#7a0d0d"; ctx.lineWidth=4;
  ctx.beginPath(); ctx.ellipse(0,8,22,20,0,0,7); ctx.fill(); ctx.stroke();
  // pecho
  ctx.fillStyle="#ffe0b3";
  ctx.beginPath(); ctx.ellipse(0,14,11,13,0,0,7); ctx.fill();
  // patas
  ctx.fillStyle="#7a0d0d";
  ctx.fillRect(-14,24,8,8); ctx.fillRect(6,24,8,8);
  // orejas
  ctx.fillStyle="#ef7d22"; ctx.strokeStyle="#7a0d0d"; ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(-16,-22); ctx.lineTo(-20,-42); ctx.lineTo(-4,-28); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(16,-22); ctx.lineTo(20,-42); ctx.lineTo(4,-28); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle="#7a0d0d";
  ctx.beginPath(); ctx.moveTo(-17,-28); ctx.lineTo(-19,-38); ctx.lineTo(-9,-29); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(17,-28); ctx.lineTo(19,-38); ctx.lineTo(9,-29); ctx.closePath(); ctx.fill();
  // cabeza
  ctx.fillStyle="#ef7d22"; ctx.strokeStyle="#7a0d0d"; ctx.lineWidth=3.5;
  ctx.beginPath(); ctx.arc(0,-14,17,0,7); ctx.fill(); ctx.stroke();
  // hocico (se abre al comer)
  var comiendo = (typeof performance!=="undefined" && performance.now()<COMIENDO_HASTA);
  ctx.fillStyle="#ffe0b3";
  ctx.beginPath(); ctx.ellipse(0,-6,10,comiendo?11:8,0,0,7); ctx.fill();
  if(comiendo){
    ctx.fillStyle="#7a0d0d";
    ctx.beginPath(); ctx.ellipse(0,-4,6,5,0,0,7); ctx.fill();
    ctx.fillStyle="#fff";
    ctx.fillRect(-4,-9,8,4); // dientes
  }
  ctx.fillStyle="#1c1c1c";
  ctx.beginPath(); ctx.arc(0,-3,3.6,0,7); ctx.fill();
  // ojos (parpadeo)
  if(parpadea(t,py)){ ctx.strokeStyle="#1c1c1c"; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.moveTo(-12,-16); ctx.lineTo(-5,-16); ctx.moveTo(5,-16); ctx.lineTo(12,-16); ctx.stroke();
  } else { ctx.fillStyle="#1c1c1c";
    ctx.beginPath(); ctx.arc(-8.5,-16,3.4,0,7); ctx.arc(8.5,-16,3.4,0,7); ctx.fill();
    ctx.fillStyle="#fff"; ctx.beginPath(); ctx.arc(-7.5,-17,1.1,0,7); ctx.arc(9.5,-17,1.1,0,7); ctx.fill(); }
  ctx.restore();
}

// ---------- Gallinero con look de corral (paja, nidos, cerca, cartel) ----------
function rectRed(x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}
function dibujarNido(nx,ny){
  ctx.fillStyle="#a06828";
  ctx.beginPath(); ctx.ellipse(nx,ny,22,12,0,0,7); ctx.fill();
  ctx.fillStyle="#7a4a1f";
  ctx.beginPath(); ctx.ellipse(nx,ny-2,15,7,0,0,7); ctx.fill();
  ctx.fillStyle="#fffdf6";
  ctx.strokeStyle="#c9a86a"; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.arc(nx-6,ny-7,6,0,7); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(nx+6,ny-7,6,0,7); ctx.fill(); ctx.stroke();
}
function marcoGallinero(p1,p2){
  return {x0:p1.x-STEP*0.55, y0:p1.y-STEP*0.55,
          x1:p2.x+STEP*0.55, y1:p2.y+STEP*0.55,
          cx:(p1.x+p2.x)/2};
}
function dibujarBaseGallinero(p1,p2){
  var m=marcoGallinero(p1,p2);
  // base de paja
  ctx.fillStyle="rgba(216,182,96,.55)";
  ctx.fillRect(m.x0,m.y0,m.x1-m.x0,m.y1-m.y0);
  // briznas (pseudoaleatorio fijo para no parpadear)
  ctx.lineWidth=2; ctx.lineCap="round";
  for(var i=0;i<46;i++){
    var h1=Math.sin(i*127.1)*43758.55; h1-=Math.floor(h1);
    var h2=Math.sin(i*269.5)*12543.34; h2-=Math.floor(h2);
    var sx=m.x0+h1*(m.x1-m.x0), sy=m.y0+h2*(m.y1-m.y0);
    var an=h1*6.28, ln=6+h2*8;
    ctx.strokeStyle=h1>0.5?"rgba(160,120,40,.5)":"rgba(245,225,150,.6)";
    ctx.beginPath(); ctx.moveTo(sx,sy);
    ctx.lineTo(sx+Math.cos(an)*ln,sy+Math.sin(an)*ln); ctx.stroke();
  }
  // nidos con huevos en las esquinas de arriba (las fichas los tapan al ocupar)
  dibujarNido(m.x0+32,m.y0+30);
  dibujarNido(m.x1-32,m.y0+30);
}
function dibujarCercaGallinero(p1,p2){
  var m=marcoGallinero(p1,p2);
  var MAD="#7a4a1f", OSC="#4a2a0d";
  function poste(px,py,alto){
    ctx.fillStyle=MAD; ctx.strokeStyle=OSC; ctx.lineWidth=2;
    ctx.fillRect(px-8,py-alto,16,alto);
    ctx.strokeRect(px-8,py-alto,16,alto);
    ctx.beginPath();
    ctx.moveTo(px-8,py-alto); ctx.lineTo(px,py-alto-10); ctx.lineTo(px+8,py-alto);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  // rieles: arriba y lados completos, abajo con hueco de puerta al centro
  ctx.strokeStyle=MAD; ctx.lineWidth=7; ctx.lineCap="round";
  ctx.beginPath(); ctx.moveTo(m.x0,m.y0+10); ctx.lineTo(m.x1,m.y0+10); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(m.x0+5,m.y0); ctx.lineTo(m.x0+5,m.y1); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(m.x1-5,m.y0); ctx.lineTo(m.x1-5,m.y1); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(m.x0,m.y1-8); ctx.lineTo(m.cx-44,m.y1-8); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(m.cx+44,m.y1-8); ctx.lineTo(m.x1,m.y1-8); ctx.stroke();
  // postes: esquinas, medios y puerta
  poste(m.x0,m.y1,42); poste(m.x1,m.y1,42);
  poste(m.x0,m.y0+12,42); poste(m.x1,m.y0+12,42);
  poste(m.cx,m.y0+12,42);
  poste((m.x0+m.cx-44)/2,m.y1,36); poste((m.x1+m.cx+44)/2,m.y1,36);
  poste(m.cx-44,m.y1,48); poste(m.cx+44,m.y1,48);
  // cartel de madera clavado sobre el riel de arriba
  ctx.fillStyle="#5a3413"; ctx.strokeStyle=OSC; ctx.lineWidth=3;
  rectRed(m.cx-105,m.y0-4,210,34,8); ctx.fill(); ctx.stroke();
  ctx.fillStyle="#3a2208";
  ctx.beginPath(); ctx.arc(m.cx-95,m.y0+13,3,0,7); ctx.fill();
  ctx.beginPath(); ctx.arc(m.cx+95,m.y0+13,3,0,7); ctx.fill();
  ctx.fillStyle="#ffe1a8"; ctx.font="bold 21px sans-serif"; ctx.textAlign="center";
  ctx.fillText("🐔 GALLINERO",m.cx,m.y0+21);
}

function dibujar(now){
  var t=now||0;
  var dt=Math.min(50,(now-ULTIMO_T)||16); ULTIMO_T=now;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  // gallinero con look de corral: base de paja + nidos (la cerca va tras las líneas)
  var p1=aPx(2,0), p2=aPx(4,2);
  dibujarBaseGallinero(p1,p2);

  // líneas
  ctx.strokeStyle="#6b1d1d"; ctx.lineWidth=4; ctx.lineCap="round";
  var vistas={};
  for(var y=0;y<7;y++) for(var x=0;x<7;x++){
    if(!valida(x,y)) continue;
    var vs=vecinos(x,y);
    for(var i=0;i<vs.length;i++){
      var a=clave(x,y), b=clave(vs[i].x,vs[i].y);
      var id=a<b?a+"|"+b:b+"|"+a;
      if(vistas[id]) continue; vistas[id]=1;
      var A=aPx(x,y), B=aPx(vs[i].x,vs[i].y);
      ctx.beginPath(); ctx.moveTo(A.x,A.y); ctx.lineTo(B.x,B.y); ctx.stroke();
    }
  }
  // puntos
  for(var yy=0;yy<7;yy++) for(var xx=0;xx<7;xx++){
    if(!valida(xx,yy)) continue;
    var P=aPx(xx,yy);
    ctx.fillStyle="#4a1414";
    ctx.beginPath(); ctx.arc(P.x,P.y,6,0,7); ctx.fill();
  }
  // cerca del gallinero con puerta abajo + cartel (encima de las líneas, debajo de fichas)
  dibujarCercaGallinero(p1,p2);
  // destinos legales (pulso)
  var pul=1+Math.sin(t/250)*0.12;
  for(var l=0;l<legalesSel.length;l++){
    var D=aPx(legalesSel[l].aX,legalesSel[l].aY);
    var esCap = !!legalesSel[l].cap;
    ctx.fillStyle=esCap?"rgba(216,31,31,.9)":"rgba(46,125,50,.9)";
    ctx.beginPath(); ctx.arc(D.x,D.y,(esCap?16:12)*pul,0,7); ctx.fill();
    ctx.fillStyle="#fff";
    ctx.font="bold 16px sans-serif";
    ctx.fillText(esCap?"✕":"•",D.x,D.y+6);
  }
  // pieza en movimiento (interpolada)
  var ocultar=null;
  if(animMov){
    var k=(now-animMov.t0)/animMov.dur;
    if(k>=1){ animMov=null; }
    else{
      ocultar=clave(animMov.x1,animMov.y1);
      var A0=aPx(animMov.x0,animMov.y0), B0=aPx(animMov.x1,animMov.y1);
      var e=1-Math.pow(1-k,3); // ease-out
      var mx=A0.x+(B0.x-A0.x)*e, my=A0.y+(B0.y-A0.y)*e - Math.sin(k*Math.PI)*26; // saltito
      if(animMov.pieza==="g") dibujarGallina(mx,my,t,false);
      else dibujarZorro(mx,my,t,false);
    }
  }
  // fichas (sprites)
  for(var y3=0;y3<7;y3++) for(var x3=0;x3<7;x3++){
    if(!valida(x3,y3)) continue;
    if(ocultar===clave(x3,y3)) continue; // se dibuja en vuelo
    var v=tablero[clave(x3,y3)];
    if(!v) continue;
    var C=aPx(x3,y3);
    var sel=seleccionado && seleccionado.x===x3 && seleccionado.y===y3;
    if(sel){
      ctx.strokeStyle="#ffeb3b"; ctx.lineWidth=5;
      ctx.beginPath(); ctx.arc(C.x,C.y,40+Math.sin(t/200)*3,0,7); ctx.stroke();
    }
    if(v==="g") dibujarGallina(C.x,C.y,t,!!sel);
    else dibujarZorro(C.x,C.y,t,!!sel);
  }
  // partículas
  for(var pi=particulas.length-1;pi>=0;pi--){
    var p=particulas[pi];
    p.vida-=dt/450; p.x+=p.vx*dt/1000; p.y+=p.vy*dt/1000; p.vy+=300*dt/1000;
    if(p.vida<=0){ particulas.splice(pi,1); continue; }
    ctx.globalAlpha=Math.max(0,p.vida);
    ctx.fillStyle=p.color;
    ctx.beginPath(); ctx.arc(p.x,p.y,5*p.vida+2,0,7); ctx.fill();
    ctx.globalAlpha=1;
  }
  // textos flotantes (¡Ñam!)
  for(var ti=textos.length-1;ti>=0;ti--){
    var tx=textos[ti];
    var k2=(now-tx.t0)/900;
    if(k2>=1){ textos.splice(ti,1); continue; }
    ctx.globalAlpha=1-k2;
    ctx.font="bold 30px sans-serif"; ctx.textAlign="center";
    ctx.fillStyle="#7a0d0d";
    ctx.fillText(tx.txt,tx.x,tx.y-k2*40);
    ctx.globalAlpha=1;
  }
  if(fin){
    ctx.fillStyle="rgba(0,0,0,.55)";
    ctx.fillRect(0,canvas.height/2-90,canvas.width,180);
    ctx.fillStyle="#ffb347"; ctx.font="bold 34px sans-serif";
    ctx.fillText(fin.ganador==="g"?"🏆 ¡Ganan las Gallinas!":"🏆 ¡Ganan los Zorros!",canvas.width/2,canvas.height/2-20);
    ctx.fillStyle="#fff"; ctx.font="20px sans-serif";
    ctx.fillText(fin.motivo,canvas.width/2,canvas.height/2+25);
    ctx.font="17px sans-serif"; ctx.fillStyle="#ffe1a8";
    ctx.fillText("Pulsa Reiniciar para jugar otra vez.",canvas.width/2,canvas.height/2+55);
  }
  requestAnimationFrame(dibujar);
}

function actualizar(){
  var g=contarGallinas(), z=contarZorros();
  elContador.textContent="🐔 "+g+" · 🦊 "+z+(suspendidos>0?" (💨 fuera: "+suspendidos+")":"");
  // Panel de soplados: visible cuando hay zorros fuera (quedan fuera hasta el final)
  if(elSoplados){
    if(suspendidos>0){
      elSoplados.hidden=false;
      elSopladosTxt.textContent=suspendidos+" fuera hasta el final 🕳️ (soplos totales: "+soplosTotal+"). En juego: "+z+".";
    } else elSoplados.hidden=true;
  }
  if(fin){ elTurno.textContent="Fin del juego"; elSoplo.hidden=true; return; }
  if(colocandoSuspendido){ elTurno.textContent="🐔 Gallinas: coloca el zorro soplado en una casilla vacía"; elSoplo.hidden=true; return; }
  if(enCadena){ elTurno.textContent="🦊 Zorros: ¡sigue capturando en cadena!"; }
  else if(turno==="g") elTurno.textContent="🐔 Turno: Gallinas"+(soploDisponible?" — ¡puedes SOPLAR!":"");
  else elTurno.textContent="🦊 Turno: Zorros"+(capturasZorroInicio.length>0?" — ¡hay captura! (si no capturas te pueden soplar)":"");
  // botón soplo: solo en turno gallina humano, cuando hay omisión
  var humanoGallinas = (modo==="2p"||modo==="gallinas");
  elSoplo.hidden = !(soploDisponible && turno==="g" && humanoGallinas && !colocandoSuspendido && !fin);
}

// ---------- Entrada ----------
function casillaDeEvento(e){
  var r=canvas.getBoundingClientRect();
  var cx=(e.clientX-r.left)*(canvas.width/r.width);
  var cy=(e.clientY-r.top)*(canvas.height/r.height);
  var mejor=null, md=1e9;
  for(var y=0;y<7;y++) for(var x=0;x<7;x++){
    if(!valida(x,y)) continue;
    var P=aPx(x,y);
    var d=Math.hypot(P.x-cx,P.y-cy);
    if(d<md){md=d;mejor={x:x,y:y};}
  }
  if(md>STEP*0.55) return null;
  return mejor;
}

canvas.addEventListener("pointerdown", function(e){
  e.preventDefault();
  if(fin || iaPensando) return;
  if(esTurnoIA()) return;
  var c=casillaDeEvento(e);
  if(!c) return;
  var k=clave(c.x,c.y);

  if(colocandoSuspendido){
    // Legado sin retorno: no debería ocurrir; se resetea por seguridad.
    colocandoSuspendido=false;
    turno="g"; actualizar(); pedirIA();
    return;
  }

  if(turno==="g"){
    if(soploDisponible){
      // si toca el zorro a soplar, atajo: soplar directo
      if(zorroASoplar && c.x===zorroASoplar.x && c.y===zorroASoplar.y){ aplicarSoplo(); return; }
    }
    if(enCadena){ return; }
    var v=tablero[k];
    if(seleccionado && c.x===seleccionado.x && c.y===seleccionado.y){
      seleccionado=null; legalesSel=[]; actualizar(); return;
    }
    // ¿es destino?
    if(seleccionado){
      for(var i=0;i<legalesSel.length;i++){
        if(legalesSel[i].aX===c.x && legalesSel[i].aY===c.y){
          moverGallina({deX:seleccionado.x,deY:seleccionado.y,aX:c.x,aY:c.y});
          return;
        }
      }
    }
    if(v==="g"){
      seleccionado={x:c.x,y:c.y};
      var ms=movsGallinaDesde(c.x,c.y);
      legalesSel=ms.map(function(m){return {aX:m.aX,aY:m.aY};});
      if(ms.length===0) mensaje("Esa gallina no tiene movimientos hacia adelante.");
      else mensaje("");
      actualizar();
    } else if(v==="z" && soploDisponible && zorroASoplar && c.x===zorroASoplar.x && c.y===zorroASoplar.y){
      aplicarSoplo();
    } else {
      mensaje("Selecciona una gallina 🐔.");
    }
  } else {
    // turno zorro
    if(enCadena){
      // Sin pistas: el salto hay que encontrarlo tocando la casilla de aterrizaje.
      var capsC=capturasZorroEn(enCadena.x,enCadena.y);
      for(var j=0;j<capsC.length;j++){
        if(capsC[j].aX===c.x && capsC[j].aY===c.y){
          moverZorroCaptura(capsC[j]);
          return;
        }
      }
      mensaje("Se comió una y puede seguir: DEBE seguir con el mismo zorro. Busca el salto.");
      return;
    }
    if(seleccionado && c.x===seleccionado.x && c.y===seleccionado.y){
      seleccionado=null; legalesSel=[]; actualizar(); return;
    }
    if(seleccionado){
      // ¿captura?
      var caps=capturasZorroEn(seleccionado.x,seleccionado.y);
      for(var a=0;a<caps.length;a++){
        if(caps[a].aX===c.x && caps[a].aY===c.y){ moverZorroCaptura(caps[a]); return; }
      }
      // ¿simple?
      var sm=simplesZorroEn(seleccionado.x,seleccionado.y);
      for(var b=0;b<sm.length;b++){
        if(sm[b].aX===c.x && sm[b].aY===c.y){ moverZorroSimple(sm[b].deX,sm[b].deY,sm[b].aX,sm[b].aY); return; }
      }
    }
    if(tablero[k]==="z"){
      seleccionado={x:c.x,y:c.y};
      var cc=capturasZorroEn(c.x,c.y), ss=simplesZorroEn(c.x,c.y);
      // Sin X de captura: solo se marcan los pasos simples (puntos verdes).
      // El salto hay que descubrirlo: toca la casilla vacía justo detrás de la gallina.
      legalesSel=[];
      for(var w=0;w<ss.length;w++) legalesSel.push({aX:ss[w].aX,aY:ss[w].aY});
      mensaje(cc.length>0?"¡Este zorro puede comer! Encuentra el salto tú mismo (sin pista). Si mueves sin comer, te pueden soplar.":(capturasZorroInicio.length>0?"⚠️ Hay comida en otro zorro: si no comes te pueden soplar.":""));
      actualizar();
    } else {
      mensaje("Selecciona un zorro 🦊.");
    }
  }
});

// ---------- Botones ----------
document.getElementById("btn-jugar").addEventListener("click", function(){
  ctxAudio();
  modo=document.getElementById("modo").value;
  dificultad=document.getElementById("dificultad").value;
  elMenu.classList.add("oculto");
  iniciar();
});
document.getElementById("btn-menu").addEventListener("click", function(){
  elMenu.classList.remove("oculto");
});
document.getElementById("btn-reiniciar").addEventListener("click", function(){
  elMenu.classList.add("oculto");
  iniciar();
});
document.getElementById("btn-sonido").addEventListener("click", function(){
  sonidoOn=!sonidoOn;
  this.textContent=sonidoOn?"🔊 Sonido":"🔇 Silencio";
  if(sonidoOn){ ctxAudio(); sonidoGallina(); }
});
elSoplo.addEventListener("click", aplicarSoplo);
window.addEventListener("keydown", function(e){
  if(e.key==="r"||e.key==="R"){ elMenu.classList.add("oculto"); iniciar(); }
  if(e.key==="m"||e.key==="M"){ sonidoOn=!sonidoOn; }
});
window.addEventListener("pointerdown", function(){ ctxAudio(); }, {once:true});

// estado inicial: tablero armado tras el menú + loop de animación
iniciar();
requestAnimationFrame(dibujar);
})();
