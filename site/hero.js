(function () {
  "use strict";
  var canvas = document.getElementById("shader");
  if (!canvas) return;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var gl = canvas.getContext("webgl", { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: "low-power", preserveDrawingBuffer: false });
  if (!gl) { canvas.remove(); return; }

  var VS = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
  var FS = [
    "precision highp float;",
    "uniform vec2 u_res;uniform float u_time;uniform vec2 u_mouse;uniform float u_scroll;uniform float u_light;",
    "vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}",
    "vec2 mod289(vec2 x){return x-floor(x*(1.0/289.0))*289.0;}",
    "vec3 permute(vec3 x){return mod289(((x*34.0)+1.0)*x);}",
    "float snoise(vec2 v){",
    " const vec4 C=vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);",
    " vec2 i=floor(v+dot(v,C.yy));vec2 x0=v-i+dot(i,C.xx);",
    " vec2 i1=(x0.x>x0.y)?vec2(1.0,0.0):vec2(0.0,1.0);",
    " vec4 x12=x0.xyxy+C.xxzz;x12.xy-=i1;i=mod289(i);",
    " vec3 p=permute(permute(i.y+vec3(0.0,i1.y,1.0))+i.x+vec3(0.0,i1.x,1.0));",
    " vec3 m=max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.0);m=m*m;m=m*m;",
    " vec3 x=2.0*fract(p*C.www)-1.0;vec3 h=abs(x)-0.5;vec3 ox=floor(x+0.5);vec3 a0=x-ox;",
    " m*=1.79284291400159-0.85373472095314*(a0*a0+h*h);",
    " vec3 g;g.x=a0.x*x0.x+h.x*x0.y;g.yz=a0.yz*x12.xz+h.yz*x12.yw;return 130.0*dot(m,g);}",
    "float fbm(vec2 p){float f=0.0;float a=0.5;for(int i=0;i<3;i++){f+=a*snoise(p);p=p*1.9+vec2(1.7,9.2);a*=0.5;}return f;}",
    "vec3 pal(float t){return 0.5+0.4*cos(6.28318*(vec3(0.8,0.9,1.0)*t+vec3(0.0,0.15,0.3)));}",
    "void main(){",
    " vec2 uv=(gl_FragCoord.xy-0.5*u_res)/min(u_res.x,u_res.y);",
    " vec2 m=(u_mouse-0.5*u_res)/min(u_res.x,u_res.y);",
    " float t=u_time*0.05;",
    " vec2 p=uv*0.9;p.y+=u_scroll*0.4;",
    " vec2 q=vec2(fbm(p+vec2(0.0,t*0.6)),fbm(p+vec2(3.1,1.7)-t*0.4));",
    " vec2 r=vec2(fbm(p+1.6*q+vec2(1.7,9.2)+t*0.25),fbm(p+1.6*q+vec2(8.3,2.8)-t*0.2));",
    " float f=fbm(p+1.4*r)*0.5+0.5;",
    " float d=length(uv-m);f+=0.18*exp(-d*d*4.0);",
    " vec3 col=pal(f*0.7+0.1+u_scroll*0.1);",
    " float lum=dot(col,vec3(0.299,0.587,0.114));col=mix(vec3(lum),col,0.75);",
    " col+=0.12*pow(clamp(r.x*0.5+0.5,0.0,1.0),6.0);",
    " vec3 dark=col*0.62+0.05;vec3 light=mix(col,vec3(1.0),0.6);col=mix(dark,light,u_light);",
    " float vig=smoothstep(1.35,0.3,length(uv*vec2(0.85,1.1)));",
    " vec3 base=mix(vec3(0.07,0.07,0.09),vec3(0.975,0.97,0.96),u_light);",
    " col=mix(base,col,vig*0.9);",
    " gl_FragColor=vec4(col,1.0);}"
  ].join("\n");

  function shader(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
    return s;
  }
  var vs = shader(gl.VERTEX_SHADER, VS), fs = shader(gl.FRAGMENT_SHADER, FS);
  if (!vs || !fs) { canvas.remove(); return; }
  var prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.remove(); return; }
  gl.useProgram(prog);

  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  var U = {};
  ["u_res", "u_time", "u_mouse", "u_scroll", "u_light"].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });

  var scale = Math.min(window.devicePixelRatio || 1, 1.5) * 0.6;
  var W = 0, H = 0;
  function resize() {
    var r = canvas.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width * scale));
    H = Math.max(1, Math.round(r.height * scale));
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; gl.viewport(0, 0, W, H); }
  }

  var mouse = [0.5, 0.35], target = [0.5, 0.35];
  var light = 0, lightTarget = 0, scroll = 0, start = performance.now();
  var visible = true, running = false, raf = 0;

  function themeIsLight() { return document.documentElement.getAttribute("data-theme") === "light"; }
  lightTarget = light = themeIsLight() ? 1 : 0;
  new MutationObserver(function () { lightTarget = themeIsLight() ? 1 : 0; kick(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  var hero = canvas.parentElement;
  hero.addEventListener("pointermove", function (e) {
    var r = canvas.getBoundingClientRect();
    target = [(e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height];
  }, { passive: true });

  function frame(now) {
    raf = 0;
    resize();
    mouse[0] += (target[0] - mouse[0]) * 0.06;
    mouse[1] += (target[1] - mouse[1]) * 0.06;
    light += (lightTarget - light) * 0.08;
    var sc = Math.min(1, Math.max(0, window.scrollY / Math.max(1, window.innerHeight)));
    scroll += (sc - scroll) * 0.1;
    gl.uniform2f(U.u_res, W, H);
    gl.uniform1f(U.u_time, reduce ? 12.0 : (now - start) / 1000);
    gl.uniform2f(U.u_mouse, mouse[0] * W, mouse[1] * H);
    gl.uniform1f(U.u_scroll, scroll);
    gl.uniform1f(U.u_light, light);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    var settling = Math.abs(light - lightTarget) > 0.005 || Math.abs(sc - scroll) > 0.002;
    if ((!reduce && visible && running) || settling) raf = requestAnimationFrame(frame);
  }
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (en) {
      visible = en[0].isIntersecting;
      running = visible && !document.hidden;
      if (running) kick();
    }, { threshold: 0.02 }).observe(hero);
  } else { running = true; }
  document.addEventListener("visibilitychange", function () { running = visible && !document.hidden; if (running) kick(); });
  window.addEventListener("resize", function () { resize(); kick(); }, { passive: true });
  window.addEventListener("scroll", function () { if (reduce) kick(); }, { passive: true });

  running = true;
  kick();
})();
