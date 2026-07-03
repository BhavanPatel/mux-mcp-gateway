"use client";

// Galaxy background from ReactBits (https://reactbits.dev/backgrounds/galaxy)
// Uses OGL WebGL with GLSL shader for parallax starfield with pointer interactions

import { Renderer, Program, Mesh, Color, Triangle } from "ogl";
import { useEffect, useRef } from "react";

const vertex = `attribute vec2 uv;attribute vec2 position;varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position,0,1);}`;

const fragment = `precision highp float;
uniform float uTime;uniform vec3 uResolution;uniform vec2 uFocal;uniform vec2 uRotation;
uniform float uStarSpeed;uniform float uDensity;uniform float uHueShift;uniform float uSpeed;
uniform vec2 uMouse;uniform float uGlowIntensity;uniform float uSaturation;
uniform bool uMouseRepulsion;uniform float uTwinkleIntensity;uniform float uRotationSpeed;
uniform float uRepulsionStrength;uniform float uMouseActiveFactor;uniform float uAutoCenterRepulsion;
uniform bool uTransparent;varying vec2 vUv;
#define NL 4.0
#define SC 0.2
#define M45 mat2(0.7071,-0.7071,0.7071,0.7071)
#define P 3.0
float H21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float tri(float x){return abs(fract(x)*2.0-1.0);}
float tris(float x){float t=fract(x);return 1.0-smoothstep(0.0,1.0,abs(2.0*t-1.0));}
float trisn(float x){float t=fract(x);return 2.0*(1.0-smoothstep(0.0,1.0,abs(2.0*t-1.0)))-1.0;}
vec3 hsv2rgb(vec3 c){vec4 K=vec4(1.0,2.0/3.0,1.0/3.0,3.0);vec3 p=abs(fract(c.xxx+K.xyz)*6.0-K.www);return c.z*mix(K.xxx,clamp(p-K.xxx,0.0,1.0),c.y);}
float Star(vec2 uv,float f){float d=length(uv);float m=(0.05*uGlowIntensity)/d;float r=smoothstep(0.0,1.0,1.0-abs(uv.x*uv.y*1000.0));m+=r*f*uGlowIntensity;uv*=M45;r=smoothstep(0.0,1.0,1.0-abs(uv.x*uv.y*1000.0));m+=r*0.3*f*uGlowIntensity;m*=smoothstep(1.0,0.2,d);return m;}
vec3 SL(vec2 uv){vec3 col=vec3(0.0);vec2 gv=fract(uv)-0.5;vec2 id=floor(uv);for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 o=vec2(float(x),float(y));vec2 si=id+o;float s=H21(si);float sz=fract(s*345.32);float gl=tri(uStarSpeed/(P*s+1.0));float fs=smoothstep(0.9,1.0,sz)*gl;float r=smoothstep(SC,1.0,H21(si+1.0))+SC;float b=smoothstep(SC,1.0,H21(si+3.0))+SC;float g=min(r,b)*s;vec3 base=vec3(r,g,b);float h=atan(base.g-base.r,base.b-base.r)/(6.28318)+0.5;h=fract(h+uHueShift/360.0);float sat=length(base-vec3(dot(base,vec3(0.299,0.587,0.114))))*uSaturation;float v=max(max(base.r,base.g),base.b);base=hsv2rgb(vec3(h,sat,v));vec2 pad=vec2(tris(s*34.0+uTime*uSpeed/10.0),tris(s*38.0+uTime*uSpeed/30.0))-0.5;float star=Star(gv-o-pad,fs);float tw=trisn(uTime*uSpeed+s*6.2831)*0.5+1.0;tw=mix(1.0,tw,uTwinkleIntensity);star*=tw;col+=star*sz*base;}return col;}
void main(){vec2 fp=uFocal*uResolution.xy;vec2 uv=(vUv*uResolution.xy-fp)/uResolution.y;vec2 mn=uMouse-vec2(0.5);if(uAutoCenterRepulsion>0.0){vec2 c=vec2(0.0);float cd=length(uv-c);vec2 rep=normalize(uv-c)*(uAutoCenterRepulsion/(cd+0.1));uv+=rep*0.05;}else if(uMouseRepulsion){vec2 mp=(uMouse*uResolution.xy-fp)/uResolution.y;float md=length(uv-mp);vec2 rep=normalize(uv-mp)*(uRepulsionStrength/(md+0.1));uv+=rep*0.05*uMouseActiveFactor;}else{uv+=mn*0.1*uMouseActiveFactor;}float ar=uTime*uRotationSpeed;mat2 rm=mat2(cos(ar),-sin(ar),sin(ar),cos(ar));uv=rm*uv;uv=mat2(uRotation.x,-uRotation.y,uRotation.y,uRotation.x)*uv;vec3 col=vec3(0.0);for(float i=0.0;i<1.0;i+=1.0/NL){float d=fract(i+uStarSpeed*uSpeed);float sc=mix(20.0*uDensity,0.5*uDensity,d);float fd=d*smoothstep(1.0,0.9,d);col+=SL(uv*sc+i*453.32)*fd;}if(uTransparent){float a=length(col);a=smoothstep(0.0,0.3,a);gl_FragColor=vec4(col,min(a,1.0));}else{gl_FragColor=vec4(col,1.0);}}`;

export default function Galaxy() {
  const ref = useRef<HTMLDivElement>(null);
  const mouse = useRef({ x: 0.5, y: 0.5 });
  const smoothMouse = useRef({ x: 0.5, y: 0.5 });
  const active = useRef(0.0);
  const smoothActive = useRef(0.0);

  useEffect(() => {
    if (!ref.current) return;
    const ctn = ref.current;
    const renderer = new Renderer({ alpha: true, premultipliedAlpha: false });
    const gl = renderer.gl;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    let program: Program;

    function resize() {
      renderer.setSize(ctn.offsetWidth, ctn.offsetHeight);
      if (program) program.uniforms.uResolution.value = new Color(gl.canvas.width, gl.canvas.height, gl.canvas.width / gl.canvas.height);
    }
    window.addEventListener("resize", resize);
    resize();

    const geometry = new Triangle(gl);
    program = new Program(gl, {
      vertex, fragment,
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: new Color(gl.canvas.width, gl.canvas.height, gl.canvas.width / gl.canvas.height) },
        uFocal: { value: new Float32Array([0.5, 0.5]) },
        uRotation: { value: new Float32Array([1.0, 0.0]) },
        uStarSpeed: { value: 0.5 },
        uDensity: { value: 0.8 },
        uHueShift: { value: 200 },
        uSpeed: { value: 0.8 },
        uMouse: { value: new Float32Array([0.5, 0.5]) },
        uGlowIntensity: { value: 0.3 },
        uSaturation: { value: 0.2 },
        uMouseRepulsion: { value: true },
        uTwinkleIntensity: { value: 0.4 },
        uRotationSpeed: { value: 0.05 },
        uRepulsionStrength: { value: 2.0 },
        uMouseActiveFactor: { value: 0.0 },
        uAutoCenterRepulsion: { value: 0.0 },
        uTransparent: { value: true },
      },
    });

    const mesh = new Mesh(gl, { geometry, program });
    let id: number;

    function loop(t: number) {
      id = requestAnimationFrame(loop);
      program.uniforms.uTime.value = t * 0.001;
      program.uniforms.uStarSpeed.value = (t * 0.001 * 0.5) / 10.0;
      smoothMouse.current.x += (mouse.current.x - smoothMouse.current.x) * 0.05;
      smoothMouse.current.y += (mouse.current.y - smoothMouse.current.y) * 0.05;
      smoothActive.current += (active.current - smoothActive.current) * 0.05;
      program.uniforms.uMouse.value[0] = smoothMouse.current.x;
      program.uniforms.uMouse.value[1] = smoothMouse.current.y;
      program.uniforms.uMouseActiveFactor.value = smoothActive.current;
      renderer.render({ scene: mesh });
    }
    id = requestAnimationFrame(loop);
    ctn.appendChild(gl.canvas);
    gl.canvas.style.width = "100%";
    gl.canvas.style.height = "100%";

    const onMove = (e: MouseEvent) => {
      const r = ctn.getBoundingClientRect();
      mouse.current = { x: (e.clientX - r.left) / r.width, y: 1 - (e.clientY - r.top) / r.height };
      active.current = 1.0;
    };
    const onLeave = () => { active.current = 0.0; };
    ctn.addEventListener("mousemove", onMove);
    ctn.addEventListener("mouseleave", onLeave);

    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", resize);
      ctn.removeEventListener("mousemove", onMove);
      ctn.removeEventListener("mouseleave", onLeave);
      if (ctn.contains(gl.canvas)) ctn.removeChild(gl.canvas);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  return <div ref={ref} className="fixed inset-0 w-full h-full z-0 pointer-events-auto" />;
}
