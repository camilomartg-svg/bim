const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./auth-viewpoints.test-OmETf-1K.js","./viewpoints-manager-D7jMu0iY.js"])))=>i.map(i=>d[i]);
import{S as mf,a as Zo,U as Cd,V as zs,b as Jo,c as ee,M as ki,W as Ds,d as $a,i as bf,O as _a,e as Ad,G as kd,C as as,f as Al,F as gf,L as Vi,B as Ut,g as qi,h as xa,j as Rs,k as js,l as nt,n as Ns,m as yf,I as Ea,T as Dt,R as wo,o as Ht,p as vn,q as zt,r as hi,s as vf,t as Sa,u as $i,v as wf,H as $f,w as _f,x as xf,D as jr,y as Ef,z as en,A as _i,E as Sf,J as kl,K as Gi,N as Cf,P as Af}from"./viewpoints-manager-D7jMu0iY.js";(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const n of document.querySelectorAll('link[rel="modulepreload"]'))o(n);new MutationObserver(n=>{for(const s of n)if(s.type==="childList")for(const r of s.addedNodes)r.tagName==="LINK"&&r.rel==="modulepreload"&&o(r)}).observe(document,{childList:!0,subtree:!0});function i(n){const s={};return n.integrity&&(s.integrity=n.integrity),n.referrerPolicy&&(s.referrerPolicy=n.referrerPolicy),n.crossOrigin==="use-credentials"?s.credentials="include":n.crossOrigin==="anonymous"?s.credentials="omit":s.credentials="same-origin",s}function o(n){if(n.ep)return;n.ep=!0;const s=i(n);fetch(n.href,s)}})();const kf="modulepreload",Tf=function(t,e){return new URL(t,e).href},Tl={},Of=function(e,i,o){let n=Promise.resolve();if(i&&i.length>0){const r=document.getElementsByTagName("link"),a=document.querySelector("meta[property=csp-nonce]"),l=a?.nonce||a?.getAttribute("nonce");n=Promise.allSettled(i.map(c=>{if(c=Tf(c,o),c in Tl)return;Tl[c]=!0;const d=c.endsWith(".css"),u=d?'[rel="stylesheet"]':"";if(!!o)for(let m=r.length-1;m>=0;m--){const g=r[m];if(g.href===c&&(!d||g.rel==="stylesheet"))return}else if(document.querySelector(`link[href="${c}"]${u}`))return;const p=document.createElement("link");if(p.rel=d?"stylesheet":kf,d||(p.as="script"),p.crossOrigin="",p.href=c,l&&p.setAttribute("nonce",l),document.head.appendChild(p),d)return new Promise((m,g)=>{p.addEventListener("load",m),p.addEventListener("error",()=>g(new Error(`Unable to preload CSS for ${c}`)))})}))}function s(r){const a=new Event("vite:preloadError",{cancelable:!0});if(a.payload=r,window.dispatchEvent(a),!a.defaultPrevented)throw r}return n.then(r=>{for(const a of r||[])a.status==="rejected"&&s(a.reason);return e().catch(s)})};Jo.line={worldUnits:{value:1},linewidth:{value:1},resolution:{value:new zs(1,1)},dashOffset:{value:0},dashScale:{value:1},dashSize:{value:1},gapSize:{value:1}};Zo.line={uniforms:Cd.merge([Jo.common,Jo.fog,Jo.line]),vertexShader:`
		#include <common>
		#include <color_pars_vertex>
		#include <fog_pars_vertex>
		#include <logdepthbuf_pars_vertex>
		#include <clipping_planes_pars_vertex>

		uniform float linewidth;
		uniform vec2 resolution;

		attribute vec3 instanceStart;
		attribute vec3 instanceEnd;

		attribute vec3 instanceColorStart;
		attribute vec3 instanceColorEnd;

		#ifdef WORLD_UNITS

			varying vec4 worldPos;
			varying vec3 worldStart;
			varying vec3 worldEnd;

			#ifdef USE_DASH

				varying vec2 vUv;

			#endif

		#else

			varying vec2 vUv;

		#endif

		#ifdef USE_DASH

			uniform float dashScale;
			attribute float instanceDistanceStart;
			attribute float instanceDistanceEnd;
			varying float vLineDistance;

		#endif

		void trimSegment( const in vec4 start, inout vec4 end ) {

			// trim end segment so it terminates between the camera plane and the near plane

			// conservative estimate of the near plane
			float a = projectionMatrix[ 2 ][ 2 ]; // 3nd entry in 3th column
			float b = projectionMatrix[ 3 ][ 2 ]; // 3nd entry in 4th column
			float nearEstimate = - 0.5 * b / a;

			float alpha = ( nearEstimate - start.z ) / ( end.z - start.z );

			end.xyz = mix( start.xyz, end.xyz, alpha );

		}

		void main() {

			#ifdef USE_COLOR

				vColor.xyz = ( position.y < 0.5 ) ? instanceColorStart : instanceColorEnd;

			#endif

			#ifdef USE_DASH

				vLineDistance = ( position.y < 0.5 ) ? dashScale * instanceDistanceStart : dashScale * instanceDistanceEnd;
				vUv = uv;

			#endif

			float aspect = resolution.x / resolution.y;

			// camera space
			vec4 start = modelViewMatrix * vec4( instanceStart, 1.0 );
			vec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );

			#ifdef WORLD_UNITS

				worldStart = start.xyz;
				worldEnd = end.xyz;

			#else

				vUv = uv;

			#endif

			// special case for perspective projection, and segments that terminate either in, or behind, the camera plane
			// clearly the gpu firmware has a way of addressing this issue when projecting into ndc space
			// but we need to perform ndc-space calculations in the shader, so we must address this issue directly
			// perhaps there is a more elegant solution -- WestLangley

			bool perspective = ( projectionMatrix[ 2 ][ 3 ] == - 1.0 ); // 4th entry in the 3rd column

			if ( perspective ) {

				if ( start.z < 0.0 && end.z >= 0.0 ) {

					trimSegment( start, end );

				} else if ( end.z < 0.0 && start.z >= 0.0 ) {

					trimSegment( end, start );

				}

			}

			// clip space
			vec4 clipStart = projectionMatrix * start;
			vec4 clipEnd = projectionMatrix * end;

			// ndc space
			vec3 ndcStart = clipStart.xyz / clipStart.w;
			vec3 ndcEnd = clipEnd.xyz / clipEnd.w;

			// direction
			vec2 dir = ndcEnd.xy - ndcStart.xy;

			// account for clip-space aspect ratio
			dir.x *= aspect;
			dir = normalize( dir );

			#ifdef WORLD_UNITS

				vec3 worldDir = normalize( end.xyz - start.xyz );
				vec3 tmpFwd = normalize( mix( start.xyz, end.xyz, 0.5 ) );
				vec3 worldUp = normalize( cross( worldDir, tmpFwd ) );
				vec3 worldFwd = cross( worldDir, worldUp );
				worldPos = position.y < 0.5 ? start: end;

				// height offset
				float hw = linewidth * 0.5;
				worldPos.xyz += position.x < 0.0 ? hw * worldUp : - hw * worldUp;

				// don't extend the line if we're rendering dashes because we
				// won't be rendering the endcaps
				#ifndef USE_DASH

					// cap extension
					worldPos.xyz += position.y < 0.5 ? - hw * worldDir : hw * worldDir;

					// add width to the box
					worldPos.xyz += worldFwd * hw;

					// endcaps
					if ( position.y > 1.0 || position.y < 0.0 ) {

						worldPos.xyz -= worldFwd * 2.0 * hw;

					}

				#endif

				// project the worldpos
				vec4 clip = projectionMatrix * worldPos;

				// shift the depth of the projected points so the line
				// segments overlap neatly
				vec3 clipPose = ( position.y < 0.5 ) ? ndcStart : ndcEnd;
				clip.z = clipPose.z * clip.w;

			#else

				vec2 offset = vec2( dir.y, - dir.x );
				// undo aspect ratio adjustment
				dir.x /= aspect;
				offset.x /= aspect;

				// sign flip
				if ( position.x < 0.0 ) offset *= - 1.0;

				// endcaps
				if ( position.y < 0.0 ) {

					offset += - dir;

				} else if ( position.y > 1.0 ) {

					offset += dir;

				}

				// adjust for linewidth
				offset *= linewidth;

				// adjust for clip-space to screen-space conversion // maybe resolution should be based on viewport ...
				offset /= resolution.y;

				// select end
				vec4 clip = ( position.y < 0.5 ) ? clipStart : clipEnd;

				// back to clip space
				offset *= clip.w;

				clip.xy += offset;

			#endif

			gl_Position = clip;

			vec4 mvPosition = ( position.y < 0.5 ) ? start : end; // this is an approximation

			#include <logdepthbuf_vertex>
			#include <clipping_planes_vertex>
			#include <fog_vertex>

		}
		`,fragmentShader:`
		uniform vec3 diffuse;
		uniform float opacity;
		uniform float linewidth;

		#ifdef USE_DASH

			uniform float dashOffset;
			uniform float dashSize;
			uniform float gapSize;

		#endif

		varying float vLineDistance;

		#ifdef WORLD_UNITS

			varying vec4 worldPos;
			varying vec3 worldStart;
			varying vec3 worldEnd;

			#ifdef USE_DASH

				varying vec2 vUv;

			#endif

		#else

			varying vec2 vUv;

		#endif

		#include <common>
		#include <color_pars_fragment>
		#include <fog_pars_fragment>
		#include <logdepthbuf_pars_fragment>
		#include <clipping_planes_pars_fragment>

		vec2 closestLineToLine(vec3 p1, vec3 p2, vec3 p3, vec3 p4) {

			float mua;
			float mub;

			vec3 p13 = p1 - p3;
			vec3 p43 = p4 - p3;

			vec3 p21 = p2 - p1;

			float d1343 = dot( p13, p43 );
			float d4321 = dot( p43, p21 );
			float d1321 = dot( p13, p21 );
			float d4343 = dot( p43, p43 );
			float d2121 = dot( p21, p21 );

			float denom = d2121 * d4343 - d4321 * d4321;

			float numer = d1343 * d4321 - d1321 * d4343;

			mua = numer / denom;
			mua = clamp( mua, 0.0, 1.0 );
			mub = ( d1343 + d4321 * ( mua ) ) / d4343;
			mub = clamp( mub, 0.0, 1.0 );

			return vec2( mua, mub );

		}

		void main() {

			#include <clipping_planes_fragment>

			#ifdef USE_DASH

				if ( vUv.y < - 1.0 || vUv.y > 1.0 ) discard; // discard endcaps

				if ( mod( vLineDistance + dashOffset, dashSize + gapSize ) > dashSize ) discard; // todo - FIX

			#endif

			float alpha = opacity;

			#ifdef WORLD_UNITS

				// Find the closest points on the view ray and the line segment
				vec3 rayEnd = normalize( worldPos.xyz ) * 1e5;
				vec3 lineDir = worldEnd - worldStart;
				vec2 params = closestLineToLine( worldStart, worldEnd, vec3( 0.0, 0.0, 0.0 ), rayEnd );

				vec3 p1 = worldStart + lineDir * params.x;
				vec3 p2 = rayEnd * params.y;
				vec3 delta = p1 - p2;
				float len = length( delta );
				float norm = len / linewidth;

				#ifndef USE_DASH

					#ifdef USE_ALPHA_TO_COVERAGE

						float dnorm = fwidth( norm );
						alpha = 1.0 - smoothstep( 0.5 - dnorm, 0.5 + dnorm, norm );

					#else

						if ( norm > 0.5 ) {

							discard;

						}

					#endif

				#endif

			#else

				#ifdef USE_ALPHA_TO_COVERAGE

					// artifacts appear on some hardware if a derivative is taken within a conditional
					float a = vUv.x;
					float b = ( vUv.y > 0.0 ) ? vUv.y - 1.0 : vUv.y + 1.0;
					float len2 = a * a + b * b;
					float dlen = fwidth( len2 );

					if ( abs( vUv.y ) > 1.0 ) {

						alpha = 1.0 - smoothstep( 1.0 - dlen, 1.0 + dlen, len2 );

					}

				#else

					if ( abs( vUv.y ) > 1.0 ) {

						float a = vUv.x;
						float b = ( vUv.y > 0.0 ) ? vUv.y - 1.0 : vUv.y + 1.0;
						float len2 = a * a + b * b;

						if ( len2 > 1.0 ) discard;

					}

				#endif

			#endif

			vec4 diffuseColor = vec4( diffuse, alpha );

			#include <logdepthbuf_fragment>
			#include <color_fragment>

			gl_FragColor = vec4( diffuseColor.rgb, alpha );

			#include <tonemapping_fragment>
			#include <colorspace_fragment>
			#include <fog_fragment>
			#include <premultiplied_alpha_fragment>

		}
		`};class If extends mf{constructor(e){super({type:"LineMaterial",uniforms:Cd.clone(Zo.line.uniforms),vertexShader:Zo.line.vertexShader,fragmentShader:Zo.line.fragmentShader,clipping:!0}),this.isLineMaterial=!0,this.setValues(e)}get color(){return this.uniforms.diffuse.value}set color(e){this.uniforms.diffuse.value=e}get worldUnits(){return"WORLD_UNITS"in this.defines}set worldUnits(e){e===!0?this.defines.WORLD_UNITS="":delete this.defines.WORLD_UNITS}get linewidth(){return this.uniforms.linewidth.value}set linewidth(e){this.uniforms.linewidth&&(this.uniforms.linewidth.value=e)}get dashed(){return"USE_DASH"in this.defines}set dashed(e){e===!0!==this.dashed&&(this.needsUpdate=!0),e===!0?this.defines.USE_DASH="":delete this.defines.USE_DASH}get dashScale(){return this.uniforms.dashScale.value}set dashScale(e){this.uniforms.dashScale.value=e}get dashSize(){return this.uniforms.dashSize.value}set dashSize(e){this.uniforms.dashSize.value=e}get dashOffset(){return this.uniforms.dashOffset.value}set dashOffset(e){this.uniforms.dashOffset.value=e}get gapSize(){return this.uniforms.gapSize.value}set gapSize(e){this.uniforms.gapSize.value=e}get opacity(){return this.uniforms.opacity.value}set opacity(e){this.uniforms&&(this.uniforms.opacity.value=e)}get resolution(){return this.uniforms.resolution.value}set resolution(e){this.uniforms.resolution.value.copy(e)}get alphaToCoverage(){return"USE_ALPHA_TO_COVERAGE"in this.defines}set alphaToCoverage(e){this.defines&&(e===!0!==this.alphaToCoverage&&(this.needsUpdate=!0),e===!0?this.defines.USE_ALPHA_TO_COVERAGE="":delete this.defines.USE_ALPHA_TO_COVERAGE)}}var Pf=Object.defineProperty,Lf=(t,e,i)=>e in t?Pf(t,e,{enumerable:!0,configurable:!0,writable:!0,value:i}):t[e]=i,ai=(t,e,i)=>(Lf(t,typeof e!="symbol"?e+"":e,i),i);const tn=Math.min,kt=Math.max,ls=Math.round,Vt=t=>({x:t,y:t}),Mf={left:"right",right:"left",bottom:"top",top:"bottom"},zf={start:"end",end:"start"};function Ol(t,e,i){return kt(t,tn(e,i))}function $o(t,e){return typeof t=="function"?t(e):t}function It(t){return t.split("-")[0]}function Bs(t){return t.split("-")[1]}function Td(t){return t==="x"?"y":"x"}function Od(t){return t==="y"?"height":"width"}const Df=new Set(["top","bottom"]);function Ct(t){return Df.has(It(t))?"y":"x"}function Id(t){return Td(Ct(t))}function Rf(t,e,i){i===void 0&&(i=!1);const o=Bs(t),n=Id(t),s=Od(n);let r=n==="x"?o===(i?"end":"start")?"right":"left":o==="start"?"bottom":"top";return e.reference[s]>e.floating[s]&&(r=cs(r)),[r,cs(r)]}function jf(t){const e=cs(t);return[Nr(t),e,Nr(e)]}function Nr(t){return t.replace(/start|end/g,e=>zf[e])}const Il=["left","right"],Pl=["right","left"],Nf=["top","bottom"],Bf=["bottom","top"];function Ff(t,e,i){switch(t){case"top":case"bottom":return i?e?Pl:Il:e?Il:Pl;case"left":case"right":return e?Nf:Bf;default:return[]}}function Uf(t,e,i,o){const n=Bs(t);let s=Ff(It(t),i==="start",o);return n&&(s=s.map(r=>r+"-"+n),e&&(s=s.concat(s.map(Nr)))),s}function cs(t){return t.replace(/left|right|bottom|top/g,e=>Mf[e])}function Hf(t){return{top:0,right:0,bottom:0,left:0,...t}}function Pd(t){return typeof t!="number"?Hf(t):{top:t,right:t,bottom:t,left:t}}function nn(t){const{x:e,y:i,width:o,height:n}=t;return{width:o,height:n,top:i,left:e,right:e+o,bottom:i+n,x:e,y:i}}function Ll(t,e,i){let{reference:o,floating:n}=t;const s=Ct(e),r=Id(e),a=Od(r),l=It(e),c=s==="y",d=o.x+o.width/2-n.width/2,u=o.y+o.height/2-n.height/2,h=o[a]/2-n[a]/2;let p;switch(l){case"top":p={x:d,y:o.y-n.height};break;case"bottom":p={x:d,y:o.y+o.height};break;case"right":p={x:o.x+o.width,y:u};break;case"left":p={x:o.x-n.width,y:u};break;default:p={x:o.x,y:o.y}}switch(Bs(e)){case"start":p[r]-=h*(i&&c?-1:1);break;case"end":p[r]+=h*(i&&c?-1:1);break}return p}const Vf=async(t,e,i)=>{const{placement:o="bottom",strategy:n="absolute",middleware:s=[],platform:r}=i,a=s.filter(Boolean),l=await(r.isRTL==null?void 0:r.isRTL(e));let c=await r.getElementRects({reference:t,floating:e,strategy:n}),{x:d,y:u}=Ll(c,o,l),h=o,p={},m=0;for(let g=0;g<a.length;g++){const{name:f,fn:v}=a[g],{x:y,y:b,data:$,reset:C}=await v({x:d,y:u,initialPlacement:o,placement:h,strategy:n,middlewareData:p,rects:c,platform:r,elements:{reference:t,floating:e}});d=y??d,u=b??u,p={...p,[f]:{...p[f],...$}},C&&m<=50&&(m++,typeof C=="object"&&(C.placement&&(h=C.placement),C.rects&&(c=C.rects===!0?await r.getElementRects({reference:t,floating:e,strategy:n}):C.rects),{x:d,y:u}=Ll(c,h,l)),g=-1)}return{x:d,y:u,placement:h,strategy:n,middlewareData:p}};async function Ld(t,e){var i;e===void 0&&(e={});const{x:o,y:n,platform:s,rects:r,elements:a,strategy:l}=t,{boundary:c="clippingAncestors",rootBoundary:d="viewport",elementContext:u="floating",altBoundary:h=!1,padding:p=0}=$o(e,t),m=Pd(p),g=a[h?u==="floating"?"reference":"floating":u],f=nn(await s.getClippingRect({element:(i=await(s.isElement==null?void 0:s.isElement(g)))==null||i?g:g.contextElement||await(s.getDocumentElement==null?void 0:s.getDocumentElement(a.floating)),boundary:c,rootBoundary:d,strategy:l})),v=u==="floating"?{x:o,y:n,width:r.floating.width,height:r.floating.height}:r.reference,y=await(s.getOffsetParent==null?void 0:s.getOffsetParent(a.floating)),b=await(s.isElement==null?void 0:s.isElement(y))?await(s.getScale==null?void 0:s.getScale(y))||{x:1,y:1}:{x:1,y:1},$=nn(s.convertOffsetParentRelativeRectToViewportRelativeRect?await s.convertOffsetParentRelativeRectToViewportRelativeRect({elements:a,rect:v,offsetParent:y,strategy:l}):v);return{top:(f.top-$.top+m.top)/b.y,bottom:($.bottom-f.bottom+m.bottom)/b.y,left:(f.left-$.left+m.left)/b.x,right:($.right-f.right+m.right)/b.x}}const qf=function(t){return t===void 0&&(t={}),{name:"flip",options:t,async fn(e){var i,o;const{placement:n,middlewareData:s,rects:r,initialPlacement:a,platform:l,elements:c}=e,{mainAxis:d=!0,crossAxis:u=!0,fallbackPlacements:h,fallbackStrategy:p="bestFit",fallbackAxisSideDirection:m="none",flipAlignment:g=!0,...f}=$o(t,e);if((i=s.arrow)!=null&&i.alignmentOffset)return{};const v=It(n),y=Ct(a),b=It(a)===a,$=await(l.isRTL==null?void 0:l.isRTL(c.floating)),C=h||(b||!g?[cs(a)]:jf(a)),E=m!=="none";!h&&E&&C.push(...Uf(a,g,m,$));const A=[a,...C],P=await Ld(e,f),M=[];let O=((o=s.flip)==null?void 0:o.overflows)||[];if(d&&M.push(P[v]),u){const I=Rf(n,r,$);M.push(P[I[0]],P[I[1]])}if(O=[...O,{placement:n,overflows:M}],!M.every(I=>I<=0)){var U,z;const I=(((U=s.flip)==null?void 0:U.index)||0)+1,H=A[I];if(H&&(!(u==="alignment"&&y!==Ct(H))||O.every(Z=>Ct(Z.placement)===y?Z.overflows[0]>0:!0)))return{data:{index:I,overflows:O},reset:{placement:H}};let ne=(z=O.filter(Z=>Z.overflows[0]<=0).sort((Z,V)=>Z.overflows[1]-V.overflows[1])[0])==null?void 0:z.placement;if(!ne)switch(p){case"bestFit":{var X;const Z=(X=O.filter(V=>{if(E){const q=Ct(V.placement);return q===y||q==="y"}return!0}).map(V=>[V.placement,V.overflows.filter(q=>q>0).reduce((q,fe)=>q+fe,0)]).sort((V,q)=>V[1]-q[1])[0])==null?void 0:X[0];Z&&(ne=Z);break}case"initialPlacement":ne=a;break}if(n!==ne)return{reset:{placement:ne}}}return{}}}};function Md(t){const e=tn(...t.map(s=>s.left)),i=tn(...t.map(s=>s.top)),o=kt(...t.map(s=>s.right)),n=kt(...t.map(s=>s.bottom));return{x:e,y:i,width:o-e,height:n-i}}function Gf(t){const e=t.slice().sort((n,s)=>n.y-s.y),i=[];let o=null;for(let n=0;n<e.length;n++){const s=e[n];!o||s.y-o.y>o.height/2?i.push([s]):i[i.length-1].push(s),o=s}return i.map(n=>nn(Md(n)))}const Wf=function(t){return t===void 0&&(t={}),{name:"inline",options:t,async fn(e){const{placement:i,elements:o,rects:n,platform:s,strategy:r}=e,{padding:a=2,x:l,y:c}=$o(t,e),d=Array.from(await(s.getClientRects==null?void 0:s.getClientRects(o.reference))||[]),u=Gf(d),h=nn(Md(d)),p=Pd(a);function m(){if(u.length===2&&u[0].left>u[1].right&&l!=null&&c!=null)return u.find(f=>l>f.left-p.left&&l<f.right+p.right&&c>f.top-p.top&&c<f.bottom+p.bottom)||h;if(u.length>=2){if(Ct(i)==="y"){const O=u[0],U=u[u.length-1],z=It(i)==="top",X=O.top,I=U.bottom,H=z?O.left:U.left,ne=z?O.right:U.right,Z=ne-H,V=I-X;return{top:X,bottom:I,left:H,right:ne,width:Z,height:V,x:H,y:X}}const f=It(i)==="left",v=kt(...u.map(O=>O.right)),y=tn(...u.map(O=>O.left)),b=u.filter(O=>f?O.left===y:O.right===v),$=b[0].top,C=b[b.length-1].bottom,E=y,A=v,P=A-E,M=C-$;return{top:$,bottom:C,left:E,right:A,width:P,height:M,x:E,y:$}}return h}const g=await s.getElementRects({reference:{getBoundingClientRect:m},floating:o.floating,strategy:r});return n.reference.x!==g.reference.x||n.reference.y!==g.reference.y||n.reference.width!==g.reference.width||n.reference.height!==g.reference.height?{reset:{rects:g}}:{}}}},Yf=new Set(["left","top"]);async function Xf(t,e){const{placement:i,platform:o,elements:n}=t,s=await(o.isRTL==null?void 0:o.isRTL(n.floating)),r=It(i),a=Bs(i),l=Ct(i)==="y",c=Yf.has(r)?-1:1,d=s&&l?-1:1,u=$o(e,t);let{mainAxis:h,crossAxis:p,alignmentAxis:m}=typeof u=="number"?{mainAxis:u,crossAxis:0,alignmentAxis:null}:{mainAxis:u.mainAxis||0,crossAxis:u.crossAxis||0,alignmentAxis:u.alignmentAxis};return a&&typeof m=="number"&&(p=a==="end"?m*-1:m),l?{x:p*d,y:h*c}:{x:h*c,y:p*d}}const Ca=function(t){return{name:"offset",options:t,async fn(e){var i,o;const{x:n,y:s,placement:r,middlewareData:a}=e,l=await Xf(e,t);return r===((i=a.offset)==null?void 0:i.placement)&&(o=a.arrow)!=null&&o.alignmentOffset?{}:{x:n+l.x,y:s+l.y,data:{...l,placement:r}}}}},Zf=function(t){return t===void 0&&(t={}),{name:"shift",options:t,async fn(e){const{x:i,y:o,placement:n}=e,{mainAxis:s=!0,crossAxis:r=!1,limiter:a={fn:f=>{let{x:v,y}=f;return{x:v,y}}},...l}=$o(t,e),c={x:i,y:o},d=await Ld(e,l),u=Ct(It(n)),h=Td(u);let p=c[h],m=c[u];if(s){const f=h==="y"?"top":"left",v=h==="y"?"bottom":"right",y=p+d[f],b=p-d[v];p=Ol(y,p,b)}if(r){const f=u==="y"?"top":"left",v=u==="y"?"bottom":"right",y=m+d[f],b=m-d[v];m=Ol(y,m,b)}const g=a.fn({...e,[h]:p,[u]:m});return{...g,data:{x:g.x-i,y:g.y-o,enabled:{[h]:s,[u]:r}}}}}};function Fs(){return typeof window<"u"}function qt(t){return zd(t)?(t.nodeName||"").toLowerCase():"#document"}function Re(t){var e;return(t==null||(e=t.ownerDocument)==null?void 0:e.defaultView)||window}function Zt(t){var e;return(e=(zd(t)?t.ownerDocument:t.document)||window.document)==null?void 0:e.documentElement}function zd(t){return Fs()?t instanceof Node||t instanceof Re(t).Node:!1}function mt(t){return Fs()?t instanceof Element||t instanceof Re(t).Element:!1}function bt(t){return Fs()?t instanceof HTMLElement||t instanceof Re(t).HTMLElement:!1}function Ml(t){return!Fs()||typeof ShadowRoot>"u"?!1:t instanceof ShadowRoot||t instanceof Re(t).ShadowRoot}const Jf=new Set(["inline","contents"]);function _o(t){const{overflow:e,overflowX:i,overflowY:o,display:n}=qe(t);return/auto|scroll|overlay|hidden|clip/.test(e+o+i)&&!Jf.has(n)}const Kf=new Set(["table","td","th"]);function Qf(t){return Kf.has(qt(t))}const em=[":popover-open",":modal"];function tm(t){return em.some(e=>{try{return t.matches(e)}catch{return!1}})}const im=["transform","translate","scale","rotate","perspective"],nm=["transform","translate","scale","rotate","perspective","filter"],om=["paint","layout","strict","content"];function Aa(t){const e=ka(),i=mt(t)?qe(t):t;return im.some(o=>i[o]?i[o]!=="none":!1)||(i.containerType?i.containerType!=="normal":!1)||!e&&(i.backdropFilter?i.backdropFilter!=="none":!1)||!e&&(i.filter?i.filter!=="none":!1)||nm.some(o=>(i.willChange||"").includes(o))||om.some(o=>(i.contain||"").includes(o))}function sm(t){let e=on(t);for(;bt(e)&&!Us(e);){if(Aa(e))return e;if(tm(e))return null;e=on(e)}return null}function ka(){return typeof CSS>"u"||!CSS.supports?!1:CSS.supports("-webkit-backdrop-filter","none")}const rm=new Set(["html","body","#document"]);function Us(t){return rm.has(qt(t))}function qe(t){return Re(t).getComputedStyle(t)}function Hs(t){return mt(t)?{scrollLeft:t.scrollLeft,scrollTop:t.scrollTop}:{scrollLeft:t.scrollX,scrollTop:t.scrollY}}function on(t){if(qt(t)==="html")return t;const e=t.assignedSlot||t.parentNode||Ml(t)&&t.host||Zt(t);return Ml(e)?e.host:e}function Dd(t){const e=on(t);return Us(e)?t.ownerDocument?t.ownerDocument.body:t.body:bt(e)&&_o(e)?e:Dd(e)}function Rd(t,e,i){var o;e===void 0&&(e=[]);const n=Dd(t),s=n===((o=t.ownerDocument)==null?void 0:o.body),r=Re(n);return s?(am(r),e.concat(r,r.visualViewport||[],_o(n)?n:[],[])):e.concat(n,Rd(n,[]))}function am(t){return t.parent&&Object.getPrototypeOf(t.parent)?t.frameElement:null}function jd(t){const e=qe(t);let i=parseFloat(e.width)||0,o=parseFloat(e.height)||0;const n=bt(t),s=n?t.offsetWidth:i,r=n?t.offsetHeight:o,a=ls(i)!==s||ls(o)!==r;return a&&(i=s,o=r),{width:i,height:o,$:a}}function Nd(t){return mt(t)?t:t.contextElement}function Wi(t){const e=Nd(t);if(!bt(e))return Vt(1);const i=e.getBoundingClientRect(),{width:o,height:n,$:s}=jd(e);let r=(s?ls(i.width):i.width)/o,a=(s?ls(i.height):i.height)/n;return(!r||!Number.isFinite(r))&&(r=1),(!a||!Number.isFinite(a))&&(a=1),{x:r,y:a}}const lm=Vt(0);function Bd(t){const e=Re(t);return!ka()||!e.visualViewport?lm:{x:e.visualViewport.offsetLeft,y:e.visualViewport.offsetTop}}function cm(t,e,i){return e===void 0&&(e=!1),!i||e&&i!==Re(t)?!1:e}function Qn(t,e,i,o){e===void 0&&(e=!1),i===void 0&&(i=!1);const n=t.getBoundingClientRect(),s=Nd(t);let r=Vt(1);e&&(o?mt(o)&&(r=Wi(o)):r=Wi(t));const a=cm(s,i,o)?Bd(s):Vt(0);let l=(n.left+a.x)/r.x,c=(n.top+a.y)/r.y,d=n.width/r.x,u=n.height/r.y;if(s){const h=Re(s),p=o&&mt(o)?Re(o):o;let m=h,g=m.frameElement;for(;g&&o&&p!==m;){const f=Wi(g),v=g.getBoundingClientRect(),y=qe(g),b=v.left+(g.clientLeft+parseFloat(y.paddingLeft))*f.x,$=v.top+(g.clientTop+parseFloat(y.paddingTop))*f.y;l*=f.x,c*=f.y,d*=f.x,u*=f.y,l+=b,c+=$,m=Re(g),g=m.frameElement}}return nn({width:d,height:u,x:l,y:c})}const dm=[":popover-open",":modal"];function Fd(t){return dm.some(e=>{try{return t.matches(e)}catch{return!1}})}function um(t){let{elements:e,rect:i,offsetParent:o,strategy:n}=t;const s=n==="fixed",r=Zt(o),a=e?Fd(e.floating):!1;if(o===r||a&&s)return i;let l={scrollLeft:0,scrollTop:0},c=Vt(1);const d=Vt(0),u=bt(o);if((u||!u&&!s)&&((qt(o)!=="body"||_o(r))&&(l=Hs(o)),bt(o))){const h=Qn(o);c=Wi(o),d.x=h.x+o.clientLeft,d.y=h.y+o.clientTop}return{width:i.width*c.x,height:i.height*c.y,x:i.x*c.x-l.scrollLeft*c.x+d.x,y:i.y*c.y-l.scrollTop*c.y+d.y}}function hm(t){return Array.from(t.getClientRects())}function Ud(t){return Qn(Zt(t)).left+Hs(t).scrollLeft}function pm(t){const e=Zt(t),i=Hs(t),o=t.ownerDocument.body,n=kt(e.scrollWidth,e.clientWidth,o.scrollWidth,o.clientWidth),s=kt(e.scrollHeight,e.clientHeight,o.scrollHeight,o.clientHeight);let r=-i.scrollLeft+Ud(t);const a=-i.scrollTop;return qe(o).direction==="rtl"&&(r+=kt(e.clientWidth,o.clientWidth)-n),{width:n,height:s,x:r,y:a}}function fm(t,e){const i=Re(t),o=Zt(t),n=i.visualViewport;let s=o.clientWidth,r=o.clientHeight,a=0,l=0;if(n){s=n.width,r=n.height;const c=ka();(!c||c&&e==="fixed")&&(a=n.offsetLeft,l=n.offsetTop)}return{width:s,height:r,x:a,y:l}}function mm(t,e){const i=Qn(t,!0,e==="fixed"),o=i.top+t.clientTop,n=i.left+t.clientLeft,s=bt(t)?Wi(t):Vt(1),r=t.clientWidth*s.x,a=t.clientHeight*s.y,l=n*s.x,c=o*s.y;return{width:r,height:a,x:l,y:c}}function zl(t,e,i){let o;if(e==="viewport")o=fm(t,i);else if(e==="document")o=pm(Zt(t));else if(mt(e))o=mm(e,i);else{const n=Bd(t);o={...e,x:e.x-n.x,y:e.y-n.y}}return nn(o)}function Hd(t,e){const i=on(t);return i===e||!mt(i)||Us(i)?!1:qe(i).position==="fixed"||Hd(i,e)}function bm(t,e){const i=e.get(t);if(i)return i;let o=Rd(t,[]).filter(a=>mt(a)&&qt(a)!=="body"),n=null;const s=qe(t).position==="fixed";let r=s?on(t):t;for(;mt(r)&&!Us(r);){const a=qe(r),l=Aa(r);!l&&a.position==="fixed"&&(n=null),(s?!l&&!n:!l&&a.position==="static"&&n&&["absolute","fixed"].includes(n.position)||_o(r)&&!l&&Hd(t,r))?o=o.filter(c=>c!==r):n=a,r=on(r)}return e.set(t,o),o}function gm(t){let{element:e,boundary:i,rootBoundary:o,strategy:n}=t;const s=[...i==="clippingAncestors"?bm(e,this._c):[].concat(i),o],r=s[0],a=s.reduce((l,c)=>{const d=zl(e,c,n);return l.top=kt(d.top,l.top),l.right=tn(d.right,l.right),l.bottom=tn(d.bottom,l.bottom),l.left=kt(d.left,l.left),l},zl(e,r,n));return{width:a.right-a.left,height:a.bottom-a.top,x:a.left,y:a.top}}function ym(t){const{width:e,height:i}=jd(t);return{width:e,height:i}}function vm(t,e,i){const o=bt(e),n=Zt(e),s=i==="fixed",r=Qn(t,!0,s,e);let a={scrollLeft:0,scrollTop:0};const l=Vt(0);if(o||!o&&!s)if((qt(e)!=="body"||_o(n))&&(a=Hs(e)),o){const u=Qn(e,!0,s,e);l.x=u.x+e.clientLeft,l.y=u.y+e.clientTop}else n&&(l.x=Ud(n));const c=r.left+a.scrollLeft-l.x,d=r.top+a.scrollTop-l.y;return{x:c,y:d,width:r.width,height:r.height}}function Dl(t,e){return!bt(t)||qe(t).position==="fixed"?null:e?e(t):t.offsetParent}function Vd(t,e){const i=Re(t);if(!bt(t)||Fd(t))return i;let o=Dl(t,e);for(;o&&Qf(o)&&qe(o).position==="static";)o=Dl(o,e);return o&&(qt(o)==="html"||qt(o)==="body"&&qe(o).position==="static"&&!Aa(o))?i:o||sm(t)||i}const wm=async function(t){const e=this.getOffsetParent||Vd,i=this.getDimensions;return{reference:vm(t.reference,await e(t.floating),t.strategy),floating:{x:0,y:0,...await i(t.floating)}}};function $m(t){return qe(t).direction==="rtl"}const _m={convertOffsetParentRelativeRectToViewportRelativeRect:um,getDocumentElement:Zt,getClippingRect:gm,getOffsetParent:Vd,getElementRects:wm,getClientRects:hm,getDimensions:ym,getScale:Wi,isElement:mt,isRTL:$m},Ta=Zf,Oa=qf,Ia=Wf,Pa=(t,e,i)=>{const o=new Map,n={platform:_m,...i},s={...n.platform,_c:o};return Vf(t,e,{...n,platform:s})};/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Ko=globalThis,La=Ko.ShadowRoot&&(Ko.ShadyCSS===void 0||Ko.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,Ma=Symbol(),Rl=new WeakMap;let qd=class{constructor(e,i,o){if(this._$cssResult$=!0,o!==Ma)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=e,this.t=i}get styleSheet(){let e=this.o;const i=this.t;if(La&&e===void 0){const o=i!==void 0&&i.length===1;o&&(e=Rl.get(i)),e===void 0&&((this.o=e=new CSSStyleSheet).replaceSync(this.cssText),o&&Rl.set(i,e))}return e}toString(){return this.cssText}};const xm=t=>new qd(typeof t=="string"?t:t+"",void 0,Ma),te=(t,...e)=>{const i=t.length===1?t[0]:e.reduce((o,n,s)=>o+(r=>{if(r._$cssResult$===!0)return r.cssText;if(typeof r=="number")return r;throw Error("Value passed to 'css' function must be a 'css' function result: "+r+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(n)+t[s+1],t[0]);return new qd(i,t,Ma)},Em=(t,e)=>{if(La)t.adoptedStyleSheets=e.map(i=>i instanceof CSSStyleSheet?i:i.styleSheet);else for(const i of e){const o=document.createElement("style"),n=Ko.litNonce;n!==void 0&&o.setAttribute("nonce",n),o.textContent=i.cssText,t.appendChild(o)}},jl=La?t=>t:t=>t instanceof CSSStyleSheet?(e=>{let i="";for(const o of e.cssRules)i+=o.cssText;return xm(i)})(t):t;/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const{is:Sm,defineProperty:Cm,getOwnPropertyDescriptor:Am,getOwnPropertyNames:km,getOwnPropertySymbols:Tm,getPrototypeOf:Om}=Object,sn=globalThis,Nl=sn.trustedTypes,Im=Nl?Nl.emptyScript:"",Bl=sn.reactiveElementPolyfillSupport,Un=(t,e)=>t,ds={toAttribute(t,e){switch(e){case Boolean:t=t?Im:null;break;case Object:case Array:t=t==null?t:JSON.stringify(t)}return t},fromAttribute(t,e){let i=t;switch(e){case Boolean:i=t!==null;break;case Number:i=t===null?null:Number(t);break;case Object:case Array:try{i=JSON.parse(t)}catch{i=null}}return i}},za=(t,e)=>!Sm(t,e),Fl={attribute:!0,type:String,converter:ds,reflect:!1,useDefault:!1,hasChanged:za};Symbol.metadata??(Symbol.metadata=Symbol("metadata")),sn.litPropertyMetadata??(sn.litPropertyMetadata=new WeakMap);let Ni=class extends HTMLElement{static addInitializer(e){this._$Ei(),(this.l??(this.l=[])).push(e)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(e,i=Fl){if(i.state&&(i.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(e)&&((i=Object.create(i)).wrapped=!0),this.elementProperties.set(e,i),!i.noAccessor){const o=Symbol(),n=this.getPropertyDescriptor(e,o,i);n!==void 0&&Cm(this.prototype,e,n)}}static getPropertyDescriptor(e,i,o){const{get:n,set:s}=Am(this.prototype,e)??{get(){return this[i]},set(r){this[i]=r}};return{get:n,set(r){const a=n?.call(this);s?.call(this,r),this.requestUpdate(e,a,o)},configurable:!0,enumerable:!0}}static getPropertyOptions(e){return this.elementProperties.get(e)??Fl}static _$Ei(){if(this.hasOwnProperty(Un("elementProperties")))return;const e=Om(this);e.finalize(),e.l!==void 0&&(this.l=[...e.l]),this.elementProperties=new Map(e.elementProperties)}static finalize(){if(this.hasOwnProperty(Un("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(Un("properties"))){const i=this.properties,o=[...km(i),...Tm(i)];for(const n of o)this.createProperty(n,i[n])}const e=this[Symbol.metadata];if(e!==null){const i=litPropertyMetadata.get(e);if(i!==void 0)for(const[o,n]of i)this.elementProperties.set(o,n)}this._$Eh=new Map;for(const[i,o]of this.elementProperties){const n=this._$Eu(i,o);n!==void 0&&this._$Eh.set(n,i)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(e){const i=[];if(Array.isArray(e)){const o=new Set(e.flat(1/0).reverse());for(const n of o)i.unshift(jl(n))}else e!==void 0&&i.push(jl(e));return i}static _$Eu(e,i){const o=i.attribute;return o===!1?void 0:typeof o=="string"?o:typeof e=="string"?e.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){var e;this._$ES=new Promise(i=>this.enableUpdating=i),this._$AL=new Map,this._$E_(),this.requestUpdate(),(e=this.constructor.l)==null||e.forEach(i=>i(this))}addController(e){var i;(this._$EO??(this._$EO=new Set)).add(e),this.renderRoot!==void 0&&this.isConnected&&((i=e.hostConnected)==null||i.call(e))}removeController(e){var i;(i=this._$EO)==null||i.delete(e)}_$E_(){const e=new Map,i=this.constructor.elementProperties;for(const o of i.keys())this.hasOwnProperty(o)&&(e.set(o,this[o]),delete this[o]);e.size>0&&(this._$Ep=e)}createRenderRoot(){const e=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return Em(e,this.constructor.elementStyles),e}connectedCallback(){var e;this.renderRoot??(this.renderRoot=this.createRenderRoot()),this.enableUpdating(!0),(e=this._$EO)==null||e.forEach(i=>{var o;return(o=i.hostConnected)==null?void 0:o.call(i)})}enableUpdating(e){}disconnectedCallback(){var e;(e=this._$EO)==null||e.forEach(i=>{var o;return(o=i.hostDisconnected)==null?void 0:o.call(i)})}attributeChangedCallback(e,i,o){this._$AK(e,o)}_$ET(e,i){var o;const n=this.constructor.elementProperties.get(e),s=this.constructor._$Eu(e,n);if(s!==void 0&&n.reflect===!0){const r=(((o=n.converter)==null?void 0:o.toAttribute)!==void 0?n.converter:ds).toAttribute(i,n.type);this._$Em=e,r==null?this.removeAttribute(s):this.setAttribute(s,r),this._$Em=null}}_$AK(e,i){var o,n;const s=this.constructor,r=s._$Eh.get(e);if(r!==void 0&&this._$Em!==r){const a=s.getPropertyOptions(r),l=typeof a.converter=="function"?{fromAttribute:a.converter}:((o=a.converter)==null?void 0:o.fromAttribute)!==void 0?a.converter:ds;this._$Em=r;const c=l.fromAttribute(i,a.type);this[r]=c??((n=this._$Ej)==null?void 0:n.get(r))??c,this._$Em=null}}requestUpdate(e,i,o,n=!1,s){var r;if(e!==void 0){const a=this.constructor;if(n===!1&&(s=this[e]),o??(o=a.getPropertyOptions(e)),!((o.hasChanged??za)(s,i)||o.useDefault&&o.reflect&&s===((r=this._$Ej)==null?void 0:r.get(e))&&!this.hasAttribute(a._$Eu(e,o))))return;this.C(e,i,o)}this.isUpdatePending===!1&&(this._$ES=this._$EP())}C(e,i,{useDefault:o,reflect:n,wrapped:s},r){o&&!(this._$Ej??(this._$Ej=new Map)).has(e)&&(this._$Ej.set(e,r??i??this[e]),s!==!0||r!==void 0)||(this._$AL.has(e)||(this.hasUpdated||o||(i=void 0),this._$AL.set(e,i)),n===!0&&this._$Em!==e&&(this._$Eq??(this._$Eq=new Set)).add(e))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(i){Promise.reject(i)}const e=this.scheduleUpdate();return e!=null&&await e,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){var e;if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??(this.renderRoot=this.createRenderRoot()),this._$Ep){for(const[s,r]of this._$Ep)this[s]=r;this._$Ep=void 0}const n=this.constructor.elementProperties;if(n.size>0)for(const[s,r]of n){const{wrapped:a}=r,l=this[s];a!==!0||this._$AL.has(s)||l===void 0||this.C(s,void 0,r,l)}}let i=!1;const o=this._$AL;try{i=this.shouldUpdate(o),i?(this.willUpdate(o),(e=this._$EO)==null||e.forEach(n=>{var s;return(s=n.hostUpdate)==null?void 0:s.call(n)}),this.update(o)):this._$EM()}catch(n){throw i=!1,this._$EM(),n}i&&this._$AE(o)}willUpdate(e){}_$AE(e){var i;(i=this._$EO)==null||i.forEach(o=>{var n;return(n=o.hostUpdated)==null?void 0:n.call(o)}),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(e)),this.updated(e)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(e){return!0}update(e){this._$Eq&&(this._$Eq=this._$Eq.forEach(i=>this._$ET(i,this[i]))),this._$EM()}updated(e){}firstUpdated(e){}};Ni.elementStyles=[],Ni.shadowRootOptions={mode:"open"},Ni[Un("elementProperties")]=new Map,Ni[Un("finalized")]=new Map,Bl?.({ReactiveElement:Ni}),(sn.reactiveElementVersions??(sn.reactiveElementVersions=[])).push("2.1.2");/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const us=globalThis,Ul=t=>t,hs=us.trustedTypes,Hl=hs?hs.createPolicy("lit-html",{createHTML:t=>t}):void 0,Gd="$lit$",Rt=`lit$${Math.random().toFixed(9).slice(2)}$`,Wd="?"+Rt,Pm=`<${Wd}>`,xi=document,eo=()=>xi.createComment(""),to=t=>t===null||typeof t!="object"&&typeof t!="function",Da=Array.isArray,Lm=t=>Da(t)||typeof t?.[Symbol.iterator]=="function",yr=`[ 	
\f\r]`,Mn=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,Vl=/-->/g,ql=/>/g,li=RegExp(`>|${yr}(?:([^\\s"'>=/]+)(${yr}*=${yr}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),Gl=/'/g,Wl=/"/g,Yd=/^(?:script|style|textarea|title)$/i,Mm=t=>(e,...i)=>({_$litType$:t,strings:e,values:i}),T=Mm(1),Ei=Symbol.for("lit-noChange"),oe=Symbol.for("lit-nothing"),Yl=new WeakMap,pi=xi.createTreeWalker(xi,129);function Xd(t,e){if(!Da(t)||!t.hasOwnProperty("raw"))throw Error("invalid template strings array");return Hl!==void 0?Hl.createHTML(e):e}const zm=(t,e)=>{const i=t.length-1,o=[];let n,s=e===2?"<svg>":e===3?"<math>":"",r=Mn;for(let a=0;a<i;a++){const l=t[a];let c,d,u=-1,h=0;for(;h<l.length&&(r.lastIndex=h,d=r.exec(l),d!==null);)h=r.lastIndex,r===Mn?d[1]==="!--"?r=Vl:d[1]!==void 0?r=ql:d[2]!==void 0?(Yd.test(d[2])&&(n=RegExp("</"+d[2],"g")),r=li):d[3]!==void 0&&(r=li):r===li?d[0]===">"?(r=n??Mn,u=-1):d[1]===void 0?u=-2:(u=r.lastIndex-d[2].length,c=d[1],r=d[3]===void 0?li:d[3]==='"'?Wl:Gl):r===Wl||r===Gl?r=li:r===Vl||r===ql?r=Mn:(r=li,n=void 0);const p=r===li&&t[a+1].startsWith("/>")?" ":"";s+=r===Mn?l+Pm:u>=0?(o.push(c),l.slice(0,u)+Gd+l.slice(u)+Rt+p):l+Rt+(u===-2?a:p)}return[Xd(t,s+(t[i]||"<?>")+(e===2?"</svg>":e===3?"</math>":"")),o]};let Br=class Zd{constructor({strings:e,_$litType$:i},o){let n;this.parts=[];let s=0,r=0;const a=e.length-1,l=this.parts,[c,d]=zm(e,i);if(this.el=Zd.createElement(c,o),pi.currentNode=this.el.content,i===2||i===3){const u=this.el.content.firstChild;u.replaceWith(...u.childNodes)}for(;(n=pi.nextNode())!==null&&l.length<a;){if(n.nodeType===1){if(n.hasAttributes())for(const u of n.getAttributeNames())if(u.endsWith(Gd)){const h=d[r++],p=n.getAttribute(u).split(Rt),m=/([.?@])?(.*)/.exec(h);l.push({type:1,index:s,name:m[2],strings:p,ctor:m[1]==="."?Rm:m[1]==="?"?jm:m[1]==="@"?Nm:Vs}),n.removeAttribute(u)}else u.startsWith(Rt)&&(l.push({type:6,index:s}),n.removeAttribute(u));if(Yd.test(n.tagName)){const u=n.textContent.split(Rt),h=u.length-1;if(h>0){n.textContent=hs?hs.emptyScript:"";for(let p=0;p<h;p++)n.append(u[p],eo()),pi.nextNode(),l.push({type:2,index:++s});n.append(u[h],eo())}}}else if(n.nodeType===8)if(n.data===Wd)l.push({type:2,index:s});else{let u=-1;for(;(u=n.data.indexOf(Rt,u+1))!==-1;)l.push({type:7,index:s}),u+=Rt.length-1}s++}}static createElement(e,i){const o=xi.createElement("template");return o.innerHTML=e,o}};function rn(t,e,i=t,o){var n,s;if(e===Ei)return e;let r=o!==void 0?(n=i._$Co)==null?void 0:n[o]:i._$Cl;const a=to(e)?void 0:e._$litDirective$;return r?.constructor!==a&&((s=r?._$AO)==null||s.call(r,!1),a===void 0?r=void 0:(r=new a(t),r._$AT(t,i,o)),o!==void 0?(i._$Co??(i._$Co=[]))[o]=r:i._$Cl=r),r!==void 0&&(e=rn(t,r._$AS(t,e.values),r,o)),e}let Dm=class{constructor(e,i){this._$AV=[],this._$AN=void 0,this._$AD=e,this._$AM=i}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(e){const{el:{content:i},parts:o}=this._$AD,n=(e?.creationScope??xi).importNode(i,!0);pi.currentNode=n;let s=pi.nextNode(),r=0,a=0,l=o[0];for(;l!==void 0;){if(r===l.index){let c;l.type===2?c=new Ra(s,s.nextSibling,this,e):l.type===1?c=new l.ctor(s,l.name,l.strings,this,e):l.type===6&&(c=new Bm(s,this,e)),this._$AV.push(c),l=o[++a]}r!==l?.index&&(s=pi.nextNode(),r++)}return pi.currentNode=xi,n}p(e){let i=0;for(const o of this._$AV)o!==void 0&&(o.strings!==void 0?(o._$AI(e,o,i),i+=o.strings.length-2):o._$AI(e[i])),i++}},Ra=class Jd{get _$AU(){var e;return((e=this._$AM)==null?void 0:e._$AU)??this._$Cv}constructor(e,i,o,n){this.type=2,this._$AH=oe,this._$AN=void 0,this._$AA=e,this._$AB=i,this._$AM=o,this.options=n,this._$Cv=n?.isConnected??!0}get parentNode(){let e=this._$AA.parentNode;const i=this._$AM;return i!==void 0&&e?.nodeType===11&&(e=i.parentNode),e}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(e,i=this){e=rn(this,e,i),to(e)?e===oe||e==null||e===""?(this._$AH!==oe&&this._$AR(),this._$AH=oe):e!==this._$AH&&e!==Ei&&this._(e):e._$litType$!==void 0?this.$(e):e.nodeType!==void 0?this.T(e):Lm(e)?this.k(e):this._(e)}O(e){return this._$AA.parentNode.insertBefore(e,this._$AB)}T(e){this._$AH!==e&&(this._$AR(),this._$AH=this.O(e))}_(e){this._$AH!==oe&&to(this._$AH)?this._$AA.nextSibling.data=e:this.T(xi.createTextNode(e)),this._$AH=e}$(e){var i;const{values:o,_$litType$:n}=e,s=typeof n=="number"?this._$AC(e):(n.el===void 0&&(n.el=Br.createElement(Xd(n.h,n.h[0]),this.options)),n);if(((i=this._$AH)==null?void 0:i._$AD)===s)this._$AH.p(o);else{const r=new Dm(s,this),a=r.u(this.options);r.p(o),this.T(a),this._$AH=r}}_$AC(e){let i=Yl.get(e.strings);return i===void 0&&Yl.set(e.strings,i=new Br(e)),i}k(e){Da(this._$AH)||(this._$AH=[],this._$AR());const i=this._$AH;let o,n=0;for(const s of e)n===i.length?i.push(o=new Jd(this.O(eo()),this.O(eo()),this,this.options)):o=i[n],o._$AI(s),n++;n<i.length&&(this._$AR(o&&o._$AB.nextSibling,n),i.length=n)}_$AR(e=this._$AA.nextSibling,i){var o;for((o=this._$AP)==null?void 0:o.call(this,!1,!0,i);e!==this._$AB;){const n=Ul(e).nextSibling;Ul(e).remove(),e=n}}setConnected(e){var i;this._$AM===void 0&&(this._$Cv=e,(i=this._$AP)==null||i.call(this,e))}},Vs=class{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(e,i,o,n,s){this.type=1,this._$AH=oe,this._$AN=void 0,this.element=e,this.name=i,this._$AM=n,this.options=s,o.length>2||o[0]!==""||o[1]!==""?(this._$AH=Array(o.length-1).fill(new String),this.strings=o):this._$AH=oe}_$AI(e,i=this,o,n){const s=this.strings;let r=!1;if(s===void 0)e=rn(this,e,i,0),r=!to(e)||e!==this._$AH&&e!==Ei,r&&(this._$AH=e);else{const a=e;let l,c;for(e=s[0],l=0;l<s.length-1;l++)c=rn(this,a[o+l],i,l),c===Ei&&(c=this._$AH[l]),r||(r=!to(c)||c!==this._$AH[l]),c===oe?e=oe:e!==oe&&(e+=(c??"")+s[l+1]),this._$AH[l]=c}r&&!n&&this.j(e)}j(e){e===oe?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,e??"")}},Rm=class extends Vs{constructor(){super(...arguments),this.type=3}j(e){this.element[this.name]=e===oe?void 0:e}},jm=class extends Vs{constructor(){super(...arguments),this.type=4}j(e){this.element.toggleAttribute(this.name,!!e&&e!==oe)}},Nm=class extends Vs{constructor(e,i,o,n,s){super(e,i,o,n,s),this.type=5}_$AI(e,i=this){if((e=rn(this,e,i,0)??oe)===Ei)return;const o=this._$AH,n=e===oe&&o!==oe||e.capture!==o.capture||e.once!==o.once||e.passive!==o.passive,s=e!==oe&&(o===oe||n);n&&this.element.removeEventListener(this.name,this,o),s&&this.element.addEventListener(this.name,this,e),this._$AH=e}handleEvent(e){var i;typeof this._$AH=="function"?this._$AH.call(((i=this.options)==null?void 0:i.host)??this.element,e):this._$AH.handleEvent(e)}},Bm=class{constructor(e,i,o){this.element=e,this.type=6,this._$AN=void 0,this._$AM=i,this.options=o}get _$AU(){return this._$AM._$AU}_$AI(e){rn(this,e)}};const Xl=us.litHtmlPolyfillSupport;Xl?.(Br,Ra),(us.litHtmlVersions??(us.litHtmlVersions=[])).push("3.3.2");const Fr=(t,e,i)=>{const o=i?.renderBefore??e;let n=o._$litPart$;if(n===void 0){const s=i?.renderBefore??null;o._$litPart$=n=new Ra(e.insertBefore(eo(),s),s,void 0,i??{})}return n._$AI(t),n};/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const io=globalThis;let J=class extends Ni{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){var t;const e=super.createRenderRoot();return(t=this.renderOptions).renderBefore??(t.renderBefore=e.firstChild),e}update(t){const e=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=Fr(e,this.renderRoot,this.renderOptions)}connectedCallback(){var t;super.connectedCallback(),(t=this._$Do)==null||t.setConnected(!0)}disconnectedCallback(){var t;super.disconnectedCallback(),(t=this._$Do)==null||t.setConnected(!1)}render(){return Ei}};var Zl;J._$litElement$=!0,J.finalized=!0,(Zl=io.litElementHydrateSupport)==null||Zl.call(io,{LitElement:J});const Jl=io.litElementPolyfillSupport;Jl?.({LitElement:J});(io.litElementVersions??(io.litElementVersions=[])).push("4.2.2");/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Fm={attribute:!0,type:String,converter:ds,reflect:!1,hasChanged:za},Um=(t=Fm,e,i)=>{const{kind:o,metadata:n}=i;let s=globalThis.litPropertyMetadata.get(n);if(s===void 0&&globalThis.litPropertyMetadata.set(n,s=new Map),o==="setter"&&((t=Object.create(t)).wrapped=!0),s.set(i.name,t),o==="accessor"){const{name:r}=i;return{set(a){const l=e.get.call(this);e.set.call(this,a),this.requestUpdate(r,l,t,!0,a)},init(a){return a!==void 0&&this.C(r,void 0,t,a),a}}}if(o==="setter"){const{name:r}=i;return function(a){const l=this[r];e.call(this,a),this.requestUpdate(r,l,t,!0,a)}}throw Error("Unsupported decorator location: "+o)};function _(t){return(e,i)=>typeof i=="object"?Um(t,e,i):((o,n,s)=>{const r=n.hasOwnProperty(s);return n.constructor.createProperty(s,o),r?Object.getOwnPropertyDescriptor(n,s):void 0})(t,e,i)}/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */function Ti(t){return _({...t,state:!0,attribute:!1})}/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Hm=t=>t.strings===void 0;/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Kd={ATTRIBUTE:1,CHILD:2},Qd=t=>(...e)=>({_$litDirective$:t,values:e});let eu=class{constructor(e){}get _$AU(){return this._$AM._$AU}_$AT(e,i,o){this._$Ct=e,this._$AM=i,this._$Ci=o}_$AS(e,i){return this.update(e,i)}update(e,i){return this.render(...i)}};/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Hn=(t,e)=>{var i;const o=t._$AN;if(o===void 0)return!1;for(const n of o)(i=n._$AO)==null||i.call(n,e,!1),Hn(n,e);return!0},ps=t=>{let e,i;do{if((e=t._$AM)===void 0)break;i=e._$AN,i.delete(t),t=e}while(i?.size===0)},tu=t=>{for(let e;e=t._$AM;t=e){let i=e._$AN;if(i===void 0)e._$AN=i=new Set;else if(i.has(t))break;i.add(t),Gm(e)}};function Vm(t){this._$AN!==void 0?(ps(this),this._$AM=t,tu(this)):this._$AM=t}function qm(t,e=!1,i=0){const o=this._$AH,n=this._$AN;if(n!==void 0&&n.size!==0)if(e)if(Array.isArray(o))for(let s=i;s<o.length;s++)Hn(o[s],!1),ps(o[s]);else o!=null&&(Hn(o,!1),ps(o));else Hn(this,t)}const Gm=t=>{t.type==Kd.CHILD&&(t._$AP??(t._$AP=qm),t._$AQ??(t._$AQ=Vm))};let Wm=class extends eu{constructor(){super(...arguments),this._$AN=void 0}_$AT(e,i,o){super._$AT(e,i,o),tu(this),this.isConnected=e._$AU}_$AO(e,i=!0){var o,n;e!==this.isConnected&&(this.isConnected=e,e?(o=this.reconnected)==null||o.call(this):(n=this.disconnected)==null||n.call(this)),i&&(Hn(this,e),ps(this))}setValue(e){if(Hm(this._$Ct))this._$Ct._$AI(e,this);else{const i=[...this._$Ct._$AH];i[this._$Ci]=e,this._$Ct._$AI(i,this,0)}}disconnected(){}reconnected(){}};/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const an=()=>new Ym;let Ym=class{};const vr=new WeakMap,gt=Qd(class extends Wm{render(t){return oe}update(t,[e]){var i;const o=e!==this.G;return o&&this.G!==void 0&&this.rt(void 0),(o||this.lt!==this.ct)&&(this.G=e,this.ht=(i=t.options)==null?void 0:i.host,this.rt(this.ct=t.element)),oe}rt(t){if(this.isConnected||(t=void 0),typeof this.G=="function"){const e=this.ht??globalThis;let i=vr.get(e);i===void 0&&(i=new WeakMap,vr.set(e,i)),i.get(this.G)!==void 0&&this.G.call(this.ht,void 0),i.set(this.G,t),t!==void 0&&this.G.call(this.ht,t)}else this.G.value=t}get lt(){var t,e;return typeof this.G=="function"?(t=vr.get(this.ht??globalThis))==null?void 0:t.get(this.G):(e=this.G)==null?void 0:e.value}disconnected(){this.lt===this.ct&&this.rt(void 0)}reconnected(){this.rt(this.ct)}});/**
* (c) Iconify
*
* For the full copyright and license information, please view the license.txt
* files at https://github.com/iconify/iconify
*
* Licensed under MIT.
*
* @license MIT
* @version 2.0.0
*/const iu=Object.freeze({left:0,top:0,width:16,height:16}),fs=Object.freeze({rotate:0,vFlip:!1,hFlip:!1}),xo=Object.freeze({...iu,...fs}),Ur=Object.freeze({...xo,body:"",hidden:!1}),Xm=Object.freeze({width:null,height:null}),nu=Object.freeze({...Xm,...fs});function Zm(t,e=0){const i=t.replace(/^-?[0-9.]*/,"");function o(n){for(;n<0;)n+=4;return n%4}if(i===""){const n=parseInt(t);return isNaN(n)?0:o(n)}else if(i!==t){let n=0;switch(i){case"%":n=25;break;case"deg":n=90}if(n){let s=parseFloat(t.slice(0,t.length-i.length));return isNaN(s)?0:(s=s/n,s%1===0?o(s):0)}}return e}const Jm=/[\s,]+/;function Km(t,e){e.split(Jm).forEach(i=>{switch(i.trim()){case"horizontal":t.hFlip=!0;break;case"vertical":t.vFlip=!0;break}})}const ou={...nu,preserveAspectRatio:""};function Kl(t){const e={...ou},i=(o,n)=>t.getAttribute(o)||n;return e.width=i("width",null),e.height=i("height",null),e.rotate=Zm(i("rotate","")),Km(e,i("flip","")),e.preserveAspectRatio=i("preserveAspectRatio",i("preserveaspectratio","")),e}function Qm(t,e){for(const i in ou)if(t[i]!==e[i])return!0;return!1}const Vn=/^[a-z0-9]+(-[a-z0-9]+)*$/,Eo=(t,e,i,o="")=>{const n=t.split(":");if(t.slice(0,1)==="@"){if(n.length<2||n.length>3)return null;o=n.shift().slice(1)}if(n.length>3||!n.length)return null;if(n.length>1){const a=n.pop(),l=n.pop(),c={provider:n.length>0?n[0]:o,prefix:l,name:a};return e&&!Qo(c)?null:c}const s=n[0],r=s.split("-");if(r.length>1){const a={provider:o,prefix:r.shift(),name:r.join("-")};return e&&!Qo(a)?null:a}if(i&&o===""){const a={provider:o,prefix:"",name:s};return e&&!Qo(a,i)?null:a}return null},Qo=(t,e)=>t?!!((t.provider===""||t.provider.match(Vn))&&(e&&t.prefix===""||t.prefix.match(Vn))&&t.name.match(Vn)):!1;function eb(t,e){const i={};!t.hFlip!=!e.hFlip&&(i.hFlip=!0),!t.vFlip!=!e.vFlip&&(i.vFlip=!0);const o=((t.rotate||0)+(e.rotate||0))%4;return o&&(i.rotate=o),i}function Ql(t,e){const i=eb(t,e);for(const o in Ur)o in fs?o in t&&!(o in i)&&(i[o]=fs[o]):o in e?i[o]=e[o]:o in t&&(i[o]=t[o]);return i}function tb(t,e){const i=t.icons,o=t.aliases||Object.create(null),n=Object.create(null);function s(r){if(i[r])return n[r]=[];if(!(r in n)){n[r]=null;const a=o[r]&&o[r].parent,l=a&&s(a);l&&(n[r]=[a].concat(l))}return n[r]}return Object.keys(i).concat(Object.keys(o)).forEach(s),n}function ib(t,e,i){const o=t.icons,n=t.aliases||Object.create(null);let s={};function r(a){s=Ql(o[a]||n[a],s)}return r(e),i.forEach(r),Ql(t,s)}function su(t,e){const i=[];if(typeof t!="object"||typeof t.icons!="object")return i;t.not_found instanceof Array&&t.not_found.forEach(n=>{e(n,null),i.push(n)});const o=tb(t);for(const n in o){const s=o[n];s&&(e(n,ib(t,n,s)),i.push(n))}return i}const nb={provider:"",aliases:{},not_found:{},...iu};function wr(t,e){for(const i in e)if(i in t&&typeof t[i]!=typeof e[i])return!1;return!0}function ru(t){if(typeof t!="object"||t===null)return null;const e=t;if(typeof e.prefix!="string"||!t.icons||typeof t.icons!="object"||!wr(t,nb))return null;const i=e.icons;for(const n in i){const s=i[n];if(!n.match(Vn)||typeof s.body!="string"||!wr(s,Ur))return null}const o=e.aliases||Object.create(null);for(const n in o){const s=o[n],r=s.parent;if(!n.match(Vn)||typeof r!="string"||!i[r]&&!o[r]||!wr(s,Ur))return null}return e}const ms=Object.create(null);function ob(t,e){return{provider:t,prefix:e,icons:Object.create(null),missing:new Set}}function Gt(t,e){const i=ms[t]||(ms[t]=Object.create(null));return i[e]||(i[e]=ob(t,e))}function ja(t,e){return ru(e)?su(e,(i,o)=>{o?t.icons[i]=o:t.missing.add(i)}):[]}function sb(t,e,i){try{if(typeof i.body=="string")return t.icons[e]={...i},!0}catch{}return!1}function rb(t,e){let i=[];return(typeof t=="string"?[t]:Object.keys(ms)).forEach(o=>{(typeof o=="string"&&typeof e=="string"?[e]:Object.keys(ms[o]||{})).forEach(n=>{const s=Gt(o,n);i=i.concat(Object.keys(s.icons).map(r=>(o!==""?"@"+o+":":"")+n+":"+r))})}),i}let no=!1;function au(t){return typeof t=="boolean"&&(no=t),no}function oo(t){const e=typeof t=="string"?Eo(t,!0,no):t;if(e){const i=Gt(e.provider,e.prefix),o=e.name;return i.icons[o]||(i.missing.has(o)?null:void 0)}}function lu(t,e){const i=Eo(t,!0,no);if(!i)return!1;const o=Gt(i.provider,i.prefix);return sb(o,i.name,e)}function ec(t,e){if(typeof t!="object")return!1;if(typeof e!="string"&&(e=t.provider||""),no&&!e&&!t.prefix){let n=!1;return ru(t)&&(t.prefix="",su(t,(s,r)=>{r&&lu(s,r)&&(n=!0)})),n}const i=t.prefix;if(!Qo({provider:e,prefix:i,name:"a"}))return!1;const o=Gt(e,i);return!!ja(o,t)}function tc(t){return!!oo(t)}function ab(t){const e=oo(t);return e?{...xo,...e}:null}function lb(t){const e={loaded:[],missing:[],pending:[]},i=Object.create(null);t.sort((n,s)=>n.provider!==s.provider?n.provider.localeCompare(s.provider):n.prefix!==s.prefix?n.prefix.localeCompare(s.prefix):n.name.localeCompare(s.name));let o={provider:"",prefix:"",name:""};return t.forEach(n=>{if(o.name===n.name&&o.prefix===n.prefix&&o.provider===n.provider)return;o=n;const s=n.provider,r=n.prefix,a=n.name,l=i[s]||(i[s]=Object.create(null)),c=l[r]||(l[r]=Gt(s,r));let d;a in c.icons?d=e.loaded:r===""||c.missing.has(a)?d=e.missing:d=e.pending;const u={provider:s,prefix:r,name:a};d.push(u)}),e}function cu(t,e){t.forEach(i=>{const o=i.loaderCallbacks;o&&(i.loaderCallbacks=o.filter(n=>n.id!==e))})}function cb(t){t.pendingCallbacksFlag||(t.pendingCallbacksFlag=!0,setTimeout(()=>{t.pendingCallbacksFlag=!1;const e=t.loaderCallbacks?t.loaderCallbacks.slice(0):[];if(!e.length)return;let i=!1;const o=t.provider,n=t.prefix;e.forEach(s=>{const r=s.icons,a=r.pending.length;r.pending=r.pending.filter(l=>{if(l.prefix!==n)return!0;const c=l.name;if(t.icons[c])r.loaded.push({provider:o,prefix:n,name:c});else if(t.missing.has(c))r.missing.push({provider:o,prefix:n,name:c});else return i=!0,!0;return!1}),r.pending.length!==a&&(i||cu([t],s.id),s.callback(r.loaded.slice(0),r.missing.slice(0),r.pending.slice(0),s.abort))})}))}let db=0;function ub(t,e,i){const o=db++,n=cu.bind(null,i,o);if(!e.pending.length)return n;const s={id:o,icons:e,callback:t,abort:n};return i.forEach(r=>{(r.loaderCallbacks||(r.loaderCallbacks=[])).push(s)}),n}const Hr=Object.create(null);function ic(t,e){Hr[t]=e}function Vr(t){return Hr[t]||Hr[""]}function hb(t,e=!0,i=!1){const o=[];return t.forEach(n=>{const s=typeof n=="string"?Eo(n,e,i):n;s&&o.push(s)}),o}var pb={resources:[],index:0,timeout:2e3,rotate:750,random:!1,dataAfterTimeout:!1};function fb(t,e,i,o){const n=t.resources.length,s=t.random?Math.floor(Math.random()*n):t.index;let r;if(t.random){let E=t.resources.slice(0);for(r=[];E.length>1;){const A=Math.floor(Math.random()*E.length);r.push(E[A]),E=E.slice(0,A).concat(E.slice(A+1))}r=r.concat(E)}else r=t.resources.slice(s).concat(t.resources.slice(0,s));const a=Date.now();let l="pending",c=0,d,u=null,h=[],p=[];typeof o=="function"&&p.push(o);function m(){u&&(clearTimeout(u),u=null)}function g(){l==="pending"&&(l="aborted"),m(),h.forEach(E=>{E.status==="pending"&&(E.status="aborted")}),h=[]}function f(E,A){A&&(p=[]),typeof E=="function"&&p.push(E)}function v(){return{startTime:a,payload:e,status:l,queriesSent:c,queriesPending:h.length,subscribe:f,abort:g}}function y(){l="failed",p.forEach(E=>{E(void 0,d)})}function b(){h.forEach(E=>{E.status==="pending"&&(E.status="aborted")}),h=[]}function $(E,A,P){const M=A!=="success";switch(h=h.filter(O=>O!==E),l){case"pending":break;case"failed":if(M||!t.dataAfterTimeout)return;break;default:return}if(A==="abort"){d=P,y();return}if(M){d=P,h.length||(r.length?C():y());return}if(m(),b(),!t.random){const O=t.resources.indexOf(E.resource);O!==-1&&O!==t.index&&(t.index=O)}l="completed",p.forEach(O=>{O(P)})}function C(){if(l!=="pending")return;m();const E=r.shift();if(E===void 0){if(h.length){u=setTimeout(()=>{m(),l==="pending"&&(b(),y())},t.timeout);return}y();return}const A={status:"pending",resource:E,callback:(P,M)=>{$(A,P,M)}};h.push(A),c++,u=setTimeout(C,t.rotate),i(E,e,A.callback)}return setTimeout(C),v}function du(t){const e={...pb,...t};let i=[];function o(){i=i.filter(r=>r().status==="pending")}function n(r,a,l){const c=fb(e,r,a,(d,u)=>{o(),l&&l(d,u)});return i.push(c),c}function s(r){return i.find(a=>r(a))||null}return{query:n,find:s,setIndex:r=>{e.index=r},getIndex:()=>e.index,cleanup:o}}function Na(t){let e;if(typeof t.resources=="string")e=[t.resources];else if(e=t.resources,!(e instanceof Array)||!e.length)return null;return{resources:e,path:t.path||"/",maxURL:t.maxURL||500,rotate:t.rotate||750,timeout:t.timeout||5e3,random:t.random===!0,index:t.index||0,dataAfterTimeout:t.dataAfterTimeout!==!1}}const qs=Object.create(null),qo=["https://api.simplesvg.com","https://api.unisvg.com"],qr=[];for(;qo.length>0;)qo.length===1||Math.random()>.5?qr.push(qo.shift()):qr.push(qo.pop());qs[""]=Na({resources:["https://api.iconify.design"].concat(qr)});function nc(t,e){const i=Na(e);return i===null?!1:(qs[t]=i,!0)}function Gs(t){return qs[t]}function mb(){return Object.keys(qs)}function oc(){}const $r=Object.create(null);function bb(t){if(!$r[t]){const e=Gs(t);if(!e)return;const i=du(e),o={config:e,redundancy:i};$r[t]=o}return $r[t]}function uu(t,e,i){let o,n;if(typeof t=="string"){const s=Vr(t);if(!s)return i(void 0,424),oc;n=s.send;const r=bb(t);r&&(o=r.redundancy)}else{const s=Na(t);if(s){o=du(s);const r=t.resources?t.resources[0]:"",a=Vr(r);a&&(n=a.send)}}return!o||!n?(i(void 0,424),oc):o.query(e,n,i)().abort}const sc="iconify2",so="iconify",hu=so+"-count",rc=so+"-version",pu=36e5,gb=168,yb=50;function Gr(t,e){try{return t.getItem(e)}catch{}}function Ba(t,e,i){try{return t.setItem(e,i),!0}catch{}}function ac(t,e){try{t.removeItem(e)}catch{}}function Wr(t,e){return Ba(t,hu,e.toString())}function Yr(t){return parseInt(Gr(t,hu))||0}const yi={local:!0,session:!0},fu={local:new Set,session:new Set};let Fa=!1;function vb(t){Fa=t}let Go=typeof window>"u"?{}:window;function mu(t){const e=t+"Storage";try{if(Go&&Go[e]&&typeof Go[e].length=="number")return Go[e]}catch{}yi[t]=!1}function bu(t,e){const i=mu(t);if(!i)return;const o=Gr(i,rc);if(o!==sc){if(o){const a=Yr(i);for(let l=0;l<a;l++)ac(i,so+l.toString())}Ba(i,rc,sc),Wr(i,0);return}const n=Math.floor(Date.now()/pu)-gb,s=a=>{const l=so+a.toString(),c=Gr(i,l);if(typeof c=="string"){try{const d=JSON.parse(c);if(typeof d=="object"&&typeof d.cached=="number"&&d.cached>n&&typeof d.provider=="string"&&typeof d.data=="object"&&typeof d.data.prefix=="string"&&e(d,a))return!0}catch{}ac(i,l)}};let r=Yr(i);for(let a=r-1;a>=0;a--)s(a)||(a===r-1?(r--,Wr(i,r)):fu[t].add(a))}function gu(){if(!Fa){vb(!0);for(const t in yi)bu(t,e=>{const i=e.data,o=e.provider,n=i.prefix,s=Gt(o,n);if(!ja(s,i).length)return!1;const r=i.lastModified||-1;return s.lastModifiedCached=s.lastModifiedCached?Math.min(s.lastModifiedCached,r):r,!0})}}function wb(t,e){const i=t.lastModifiedCached;if(i&&i>=e)return i===e;if(t.lastModifiedCached=e,i)for(const o in yi)bu(o,n=>{const s=n.data;return n.provider!==t.provider||s.prefix!==t.prefix||s.lastModified===e});return!0}function $b(t,e){Fa||gu();function i(o){let n;if(!yi[o]||!(n=mu(o)))return;const s=fu[o];let r;if(s.size)s.delete(r=Array.from(s).shift());else if(r=Yr(n),r>=yb||!Wr(n,r+1))return;const a={cached:Math.floor(Date.now()/pu),provider:t.provider,data:e};return Ba(n,so+r.toString(),JSON.stringify(a))}e.lastModified&&!wb(t,e.lastModified)||Object.keys(e.icons).length&&(e.not_found&&(e=Object.assign({},e),delete e.not_found),i("local")||i("session"))}function lc(){}function _b(t){t.iconsLoaderFlag||(t.iconsLoaderFlag=!0,setTimeout(()=>{t.iconsLoaderFlag=!1,cb(t)}))}function xb(t,e){t.iconsToLoad?t.iconsToLoad=t.iconsToLoad.concat(e).sort():t.iconsToLoad=e,t.iconsQueueFlag||(t.iconsQueueFlag=!0,setTimeout(()=>{t.iconsQueueFlag=!1;const{provider:i,prefix:o}=t,n=t.iconsToLoad;delete t.iconsToLoad;let s;!n||!(s=Vr(i))||s.prepare(i,o,n).forEach(r=>{uu(i,r,a=>{if(typeof a!="object")r.icons.forEach(l=>{t.missing.add(l)});else try{const l=ja(t,a);if(!l.length)return;const c=t.pendingIcons;c&&l.forEach(d=>{c.delete(d)}),$b(t,a)}catch(l){console.error(l)}_b(t)})})}))}const Ua=(t,e)=>{const i=hb(t,!0,au()),o=lb(i);if(!o.pending.length){let l=!0;return e&&setTimeout(()=>{l&&e(o.loaded,o.missing,o.pending,lc)}),()=>{l=!1}}const n=Object.create(null),s=[];let r,a;return o.pending.forEach(l=>{const{provider:c,prefix:d}=l;if(d===a&&c===r)return;r=c,a=d,s.push(Gt(c,d));const u=n[c]||(n[c]=Object.create(null));u[d]||(u[d]=[])}),o.pending.forEach(l=>{const{provider:c,prefix:d,name:u}=l,h=Gt(c,d),p=h.pendingIcons||(h.pendingIcons=new Set);p.has(u)||(p.add(u),n[c][d].push(u))}),s.forEach(l=>{const{provider:c,prefix:d}=l;n[c][d].length&&xb(l,n[c][d])}),e?ub(e,o,s):lc},Eb=t=>new Promise((e,i)=>{const o=typeof t=="string"?Eo(t,!0):t;if(!o){i(t);return}Ua([o||t],n=>{if(n.length&&o){const s=oo(o);if(s){e({...xo,...s});return}}i(t)})});function Sb(t){try{const e=typeof t=="string"?JSON.parse(t):t;if(typeof e.body=="string")return{...e}}catch{}}function Cb(t,e){const i=typeof t=="string"?Eo(t,!0,!0):null;if(!i){const s=Sb(t);return{value:t,data:s}}const o=oo(i);if(o!==void 0||!i.prefix)return{value:t,name:i,data:o};const n=Ua([i],()=>e(t,i,oo(i)));return{value:t,name:i,loading:n}}function _r(t){return t.hasAttribute("inline")}let yu=!1;try{yu=navigator.vendor.indexOf("Apple")===0}catch{}function Ab(t,e){switch(e){case"svg":case"bg":case"mask":return e}return e!=="style"&&(yu||t.indexOf("<a")===-1)?"svg":t.indexOf("currentColor")===-1?"bg":"mask"}const kb=/(-?[0-9.]*[0-9]+[0-9.]*)/g,Tb=/^-?[0-9.]*[0-9]+[0-9.]*$/g;function Xr(t,e,i){if(e===1)return t;if(i=i||100,typeof t=="number")return Math.ceil(t*e*i)/i;if(typeof t!="string")return t;const o=t.split(kb);if(o===null||!o.length)return t;const n=[];let s=o.shift(),r=Tb.test(s);for(;;){if(r){const a=parseFloat(s);isNaN(a)?n.push(s):n.push(Math.ceil(a*e*i)/i)}else n.push(s);if(s=o.shift(),s===void 0)return n.join("");r=!r}}function Ob(t,e="defs"){let i="";const o=t.indexOf("<"+e);for(;o>=0;){const n=t.indexOf(">",o),s=t.indexOf("</"+e);if(n===-1||s===-1)break;const r=t.indexOf(">",s);if(r===-1)break;i+=t.slice(n+1,s).trim(),t=t.slice(0,o).trim()+t.slice(r+1)}return{defs:i,content:t}}function Ib(t,e){return t?"<defs>"+t+"</defs>"+e:e}function Pb(t,e,i){const o=Ob(t);return Ib(o.defs,e+o.content+i)}const Lb=t=>t==="unset"||t==="undefined"||t==="none";function vu(t,e){const i={...xo,...t},o={...nu,...e},n={left:i.left,top:i.top,width:i.width,height:i.height};let s=i.body;[i,o].forEach(g=>{const f=[],v=g.hFlip,y=g.vFlip;let b=g.rotate;v?y?b+=2:(f.push("translate("+(n.width+n.left).toString()+" "+(0-n.top).toString()+")"),f.push("scale(-1 1)"),n.top=n.left=0):y&&(f.push("translate("+(0-n.left).toString()+" "+(n.height+n.top).toString()+")"),f.push("scale(1 -1)"),n.top=n.left=0);let $;switch(b<0&&(b-=Math.floor(b/4)*4),b=b%4,b){case 1:$=n.height/2+n.top,f.unshift("rotate(90 "+$.toString()+" "+$.toString()+")");break;case 2:f.unshift("rotate(180 "+(n.width/2+n.left).toString()+" "+(n.height/2+n.top).toString()+")");break;case 3:$=n.width/2+n.left,f.unshift("rotate(-90 "+$.toString()+" "+$.toString()+")");break}b%2===1&&(n.left!==n.top&&($=n.left,n.left=n.top,n.top=$),n.width!==n.height&&($=n.width,n.width=n.height,n.height=$)),f.length&&(s=Pb(s,'<g transform="'+f.join(" ")+'">',"</g>"))});const r=o.width,a=o.height,l=n.width,c=n.height;let d,u;r===null?(u=a===null?"1em":a==="auto"?c:a,d=Xr(u,l/c)):(d=r==="auto"?l:r,u=a===null?Xr(d,c/l):a==="auto"?c:a);const h={},p=(g,f)=>{Lb(f)||(h[g]=f.toString())};p("width",d),p("height",u);const m=[n.left,n.top,l,c];return h.viewBox=m.join(" "),{attributes:h,viewBox:m,body:s}}function Ha(t,e){let i=t.indexOf("xlink:")===-1?"":' xmlns:xlink="http://www.w3.org/1999/xlink"';for(const o in e)i+=" "+o+'="'+e[o]+'"';return'<svg xmlns="http://www.w3.org/2000/svg"'+i+">"+t+"</svg>"}function Mb(t){return t.replace(/"/g,"'").replace(/%/g,"%25").replace(/#/g,"%23").replace(/</g,"%3C").replace(/>/g,"%3E").replace(/\s+/g," ")}function zb(t){return"data:image/svg+xml,"+Mb(t)}function wu(t){return'url("'+zb(t)+'")'}const Db=()=>{let t;try{if(t=fetch,typeof t=="function")return t}catch{}};let bs=Db();function Rb(t){bs=t}function jb(){return bs}function Nb(t,e){const i=Gs(t);if(!i)return 0;let o;if(!i.maxURL)o=0;else{let n=0;i.resources.forEach(r=>{n=Math.max(n,r.length)});const s=e+".json?icons=";o=i.maxURL-n-i.path.length-s.length}return o}function Bb(t){return t===404}const Fb=(t,e,i)=>{const o=[],n=Nb(t,e),s="icons";let r={type:s,provider:t,prefix:e,icons:[]},a=0;return i.forEach((l,c)=>{a+=l.length+1,a>=n&&c>0&&(o.push(r),r={type:s,provider:t,prefix:e,icons:[]},a=l.length),r.icons.push(l)}),o.push(r),o};function Ub(t){if(typeof t=="string"){const e=Gs(t);if(e)return e.path}return"/"}const Hb=(t,e,i)=>{if(!bs){i("abort",424);return}let o=Ub(e.provider);switch(e.type){case"icons":{const s=e.prefix,r=e.icons.join(","),a=new URLSearchParams({icons:r});o+=s+".json?"+a.toString();break}case"custom":{const s=e.uri;o+=s.slice(0,1)==="/"?s.slice(1):s;break}default:i("abort",400);return}let n=503;bs(t+o).then(s=>{const r=s.status;if(r!==200){setTimeout(()=>{i(Bb(r)?"abort":"next",r)});return}return n=501,s.json()}).then(s=>{if(typeof s!="object"||s===null){setTimeout(()=>{s===404?i("abort",s):i("next",n)});return}setTimeout(()=>{i("success",s)})}).catch(()=>{i("next",n)})},Vb={prepare:Fb,send:Hb};function cc(t,e){switch(t){case"local":case"session":yi[t]=e;break;case"all":for(const i in yi)yi[i]=e;break}}const xr="data-style";let $u="";function qb(t){$u=t}function dc(t,e){let i=Array.from(t.childNodes).find(o=>o.hasAttribute&&o.hasAttribute(xr));i||(i=document.createElement("style"),i.setAttribute(xr,xr),t.appendChild(i)),i.textContent=":host{display:inline-block;vertical-align:"+(e?"-0.125em":"0")+"}span,svg{display:block}"+$u}function _u(){ic("",Vb),au(!0);let t;try{t=window}catch{}if(t){if(gu(),t.IconifyPreload!==void 0){const e=t.IconifyPreload,i="Invalid IconifyPreload syntax.";typeof e=="object"&&e!==null&&(e instanceof Array?e:[e]).forEach(o=>{try{(typeof o!="object"||o===null||o instanceof Array||typeof o.icons!="object"||typeof o.prefix!="string"||!ec(o))&&console.error(i)}catch{console.error(i)}})}if(t.IconifyProviders!==void 0){const e=t.IconifyProviders;if(typeof e=="object"&&e!==null)for(const i in e){const o="IconifyProviders["+i+"] is invalid.";try{const n=e[i];if(typeof n!="object"||!n||n.resources===void 0)continue;nc(i,n)||console.error(o)}catch{console.error(o)}}}}return{enableCache:e=>cc(e,!0),disableCache:e=>cc(e,!1),iconLoaded:tc,iconExists:tc,getIcon:ab,listIcons:rb,addIcon:lu,addCollection:ec,calculateSize:Xr,buildIcon:vu,iconToHTML:Ha,svgToURL:wu,loadIcons:Ua,loadIcon:Eb,addAPIProvider:nc,appendCustomStyle:qb,_api:{getAPIConfig:Gs,setAPIModule:ic,sendAPIQuery:uu,setFetch:Rb,getFetch:jb,listAPIProviders:mb}}}const Zr={"background-color":"currentColor"},xu={"background-color":"transparent"},uc={image:"var(--svg)",repeat:"no-repeat",size:"100% 100%"},hc={"-webkit-mask":Zr,mask:Zr,background:xu};for(const t in hc){const e=hc[t];for(const i in uc)e[t+"-"+i]=uc[i]}function pc(t){return t?t+(t.match(/^[-0-9.]+$/)?"px":""):"inherit"}function Gb(t,e,i){const o=document.createElement("span");let n=t.body;n.indexOf("<a")!==-1&&(n+="<!-- "+Date.now()+" -->");const s=t.attributes,r=Ha(n,{...s,width:e.width+"",height:e.height+""}),a=wu(r),l=o.style,c={"--svg":a,width:pc(s.width),height:pc(s.height),...i?Zr:xu};for(const d in c)l.setProperty(d,c[d]);return o}let qn;function Wb(){try{qn=window.trustedTypes.createPolicy("iconify",{createHTML:t=>t})}catch{qn=null}}function Yb(t){return qn===void 0&&Wb(),qn?qn.createHTML(t):t}function Xb(t){const e=document.createElement("span"),i=t.attributes;let o="";i.width||(o="width: inherit;"),i.height||(o+="height: inherit;"),o&&(i.style=o);const n=Ha(t.body,i);return e.innerHTML=Yb(n),e.firstChild}function Jr(t){return Array.from(t.childNodes).find(e=>{const i=e.tagName&&e.tagName.toUpperCase();return i==="SPAN"||i==="SVG"})}function fc(t,e){const i=e.icon.data,o=e.customisations,n=vu(i,o);o.preserveAspectRatio&&(n.attributes.preserveAspectRatio=o.preserveAspectRatio);const s=e.renderedMode;let r;switch(s){case"svg":r=Xb(n);break;default:r=Gb(n,{...xo,...i},s==="mask")}const a=Jr(t);a?r.tagName==="SPAN"&&a.tagName===r.tagName?a.setAttribute("style",r.getAttribute("style")):t.replaceChild(r,a):t.appendChild(r)}function mc(t,e,i){const o=i&&(i.rendered?i:i.lastRender);return{rendered:!1,inline:e,icon:t,lastRender:o}}function Zb(t="iconify-icon"){let e,i;try{e=window.customElements,i=window.HTMLElement}catch{return}if(!e||!i)return;const o=e.get(t);if(o)return o;const n=["icon","mode","inline","observe","width","height","rotate","flip"],s=class extends i{constructor(){super(),ai(this,"_shadowRoot"),ai(this,"_initialised",!1),ai(this,"_state"),ai(this,"_checkQueued",!1),ai(this,"_connected",!1),ai(this,"_observer",null),ai(this,"_visible",!0);const a=this._shadowRoot=this.attachShadow({mode:"open"}),l=_r(this);dc(a,l),this._state=mc({value:""},l),this._queueCheck()}connectedCallback(){this._connected=!0,this.startObserver()}disconnectedCallback(){this._connected=!1,this.stopObserver()}static get observedAttributes(){return n.slice(0)}attributeChangedCallback(a){switch(a){case"inline":{const l=_r(this),c=this._state;l!==c.inline&&(c.inline=l,dc(this._shadowRoot,l));break}case"observer":{this.observer?this.startObserver():this.stopObserver();break}default:this._queueCheck()}}get icon(){const a=this.getAttribute("icon");if(a&&a.slice(0,1)==="{")try{return JSON.parse(a)}catch{}return a}set icon(a){typeof a=="object"&&(a=JSON.stringify(a)),this.setAttribute("icon",a)}get inline(){return _r(this)}set inline(a){a?this.setAttribute("inline","true"):this.removeAttribute("inline")}get observer(){return this.hasAttribute("observer")}set observer(a){a?this.setAttribute("observer","true"):this.removeAttribute("observer")}restartAnimation(){const a=this._state;if(a.rendered){const l=this._shadowRoot;if(a.renderedMode==="svg")try{l.lastChild.setCurrentTime(0);return}catch{}fc(l,a)}}get status(){const a=this._state;return a.rendered?"rendered":a.icon.data===null?"failed":"loading"}_queueCheck(){this._checkQueued||(this._checkQueued=!0,setTimeout(()=>{this._check()}))}_check(){if(!this._checkQueued)return;this._checkQueued=!1;const a=this._state,l=this.getAttribute("icon");if(l!==a.icon.value){this._iconChanged(l);return}if(!a.rendered||!this._visible)return;const c=this.getAttribute("mode"),d=Kl(this);(a.attrMode!==c||Qm(a.customisations,d)||!Jr(this._shadowRoot))&&this._renderIcon(a.icon,d,c)}_iconChanged(a){const l=Cb(a,(c,d,u)=>{const h=this._state;if(h.rendered||this.getAttribute("icon")!==c)return;const p={value:c,name:d,data:u};p.data?this._gotIconData(p):h.icon=p});l.data?this._gotIconData(l):this._state=mc(l,this._state.inline,this._state)}_forceRender(){if(!this._visible){const a=Jr(this._shadowRoot);a&&this._shadowRoot.removeChild(a);return}this._queueCheck()}_gotIconData(a){this._checkQueued=!1,this._renderIcon(a,Kl(this),this.getAttribute("mode"))}_renderIcon(a,l,c){const d=Ab(a.data.body,c),u=this._state.inline;fc(this._shadowRoot,this._state={rendered:!0,icon:a,inline:u,customisations:l,attrMode:c,renderedMode:d})}startObserver(){if(!this._observer)try{this._observer=new IntersectionObserver(a=>{const l=a.some(c=>c.isIntersecting);l!==this._visible&&(this._visible=l,this._forceRender())}),this._observer.observe(this)}catch{if(this._observer){try{this._observer.disconnect()}catch{}this._observer=null}}}stopObserver(){this._observer&&(this._observer.disconnect(),this._observer=null,this._visible=!0,this._connected&&this._forceRender())}};n.forEach(a=>{a in s.prototype||Object.defineProperty(s.prototype,a,{get:function(){return this.getAttribute(a)},set:function(l){l!==null?this.setAttribute(a,l):this.removeAttribute(a)}})});const r=_u();for(const a in r)s[a]=s.prototype[a]=r[a];return e.define(t,s),s}const Jb=Zb()||_u(),{enableCache:X_,disableCache:Z_,iconLoaded:J_,iconExists:K_,getIcon:Q_,listIcons:ex,addIcon:tx,addCollection:Kb,calculateSize:ix,buildIcon:nx,iconToHTML:ox,svgToURL:sx,loadIcons:Qb,loadIcon:rx,addAPIProvider:ax,_api:lx}=Jb,eg=te`
  ::-webkit-scrollbar {
    width: 0.4rem;
    height: 0.4rem;
    overflow: hidden;
  }

  ::-webkit-scrollbar-thumb {
    border-radius: 0.25rem;
    background-color: var(
      --bim-scrollbar--c,
      color-mix(in lab, var(--bim-ui_main-base), white 15%)
    );
  }

  ::-webkit-scrollbar-track {
    background-color: var(--bim-scrollbar--bgc, var(--bim-ui_bg-base));
  }
`,tg=te`
  :root {
    /* Grayscale Colors */
    --bim-ui_gray-0: hsl(210 10% 5%);
    --bim-ui_gray-1: hsl(210 10% 10%);
    --bim-ui_gray-2: hsl(210 10% 20%);
    --bim-ui_gray-3: hsl(210 10% 30%);
    --bim-ui_gray-4: hsl(210 10% 40%);
    --bim-ui_gray-5: hsl(210 10% 50%);
    --bim-ui_gray-6: hsl(210 10% 60%);
    --bim-ui_gray-7: hsl(210 10% 70%);
    --bim-ui_gray-8: hsl(210 10% 80%);
    --bim-ui_gray-9: hsl(210 10% 90%);
    --bim-ui_gray-10: hsl(210 10% 95%);

    /* Brand Colors */
    --bim-ui_main-base: #6528d7;
    --bim-ui_accent-base: #bcf124;

    /* Brand Colors Contrasts */
    --bim-ui_main-contrast: var(--bim-ui_gray-10);
    --bim-ui_accent-contrast: var(--bim-ui_gray-0);

    /* Sizes */
    --bim-ui_size-4xs: 0.375rem;
    --bim-ui_size-3xs: 0.5rem;
    --bim-ui_size-2xs: 0.625rem;
    --bim-ui_size-xs: 0.75rem;
    --bim-ui_size-sm: 0.875rem;
    --bim-ui_size-base: 1rem;
    --bim-ui_size-lg: 1.125rem;
    --bim-ui_size-xl: 1.25rem;
    --bim-ui_size-2xl: 1.375rem;
    --bim-ui_size-3xl: 1.5rem;
    --bim-ui_size-4xl: 1.625rem;
    --bim-ui_size-5xl: 1.75rem;
    --bim-ui_size-6xl: 1.875rem;
    --bim-ui_size-7xl: 2rem;
    --bim-ui_size-8xl: 2.125rem;
    --bim-ui_size-9xl: 2.25rem;
  }

  /* Background Colors */
  @media (prefers-color-scheme: dark) {
    :root {
      --bim-ui_bg-base: var(--bim-ui_gray-0);
      --bim-ui_bg-contrast-10: var(--bim-ui_gray-1);
      --bim-ui_bg-contrast-20: var(--bim-ui_gray-2);
      --bim-ui_bg-contrast-30: var(--bim-ui_gray-3);
      --bim-ui_bg-contrast-40: var(--bim-ui_gray-4);
      --bim-ui_bg-contrast-60: var(--bim-ui_gray-6);
      --bim-ui_bg-contrast-80: var(--bim-ui_gray-8);
      --bim-ui_bg-contrast-100: var(--bim-ui_gray-10);
    }
  }

  @media (prefers-color-scheme: light) {
    :root {
      --bim-ui_bg-base: var(--bim-ui_gray-10);
      --bim-ui_bg-contrast-10: var(--bim-ui_gray-9);
      --bim-ui_bg-contrast-20: var(--bim-ui_gray-8);
      --bim-ui_bg-contrast-30: var(--bim-ui_gray-7);
      --bim-ui_bg-contrast-40: var(--bim-ui_gray-6);
      --bim-ui_bg-contrast-60: var(--bim-ui_gray-4);
      --bim-ui_bg-contrast-80: var(--bim-ui_gray-2);
      --bim-ui_bg-contrast-100: var(--bim-ui_gray-0);
      --bim-ui_accent-base: #6528d7;
    }
  }

  .theme-transition-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    filter: drop-shadow(0 0 10px var(--bim-ui_bg-base));
    z-index: 9999;
  }

  .theme-transition-overlay > div {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: var(--bim-ui_bg-base);
  }

  html.bim-ui-dark {
    --bim-ui_bg-base: var(--bim-ui_gray-0);
    --bim-ui_bg-contrast-10: var(--bim-ui_gray-1);
    --bim-ui_bg-contrast-20: var(--bim-ui_gray-2);
    --bim-ui_bg-contrast-30: var(--bim-ui_gray-3);
    --bim-ui_bg-contrast-40: var(--bim-ui_gray-4);
    --bim-ui_bg-contrast-60: var(--bim-ui_gray-6);
    --bim-ui_bg-contrast-80: var(--bim-ui_gray-8);
    --bim-ui_bg-contrast-100: var(--bim-ui_gray-10);
  }

  html.bim-ui-light {
    --bim-ui_bg-base: var(--bim-ui_gray-10);
    --bim-ui_bg-contrast-10: var(--bim-ui_gray-9);
    --bim-ui_bg-contrast-20: var(--bim-ui_gray-8);
    --bim-ui_bg-contrast-30: var(--bim-ui_gray-7);
    --bim-ui_bg-contrast-40: var(--bim-ui_gray-6);
    --bim-ui_bg-contrast-60: var(--bim-ui_gray-4);
    --bim-ui_bg-contrast-80: var(--bim-ui_gray-2);
    --bim-ui_bg-contrast-100: var(--bim-ui_gray-0);
    --bim-ui_accent-base: #6528d7;
  }

  @keyframes toggleOverlay {
    0%,
    99% {
      display: block;
    }

    100% {
      display: none;
    }
  }

  @keyframes toggleThemeAnimation {
    0% {
      clip-path: circle(0% at center top);
    }
    45%,
    55% {
      clip-path: circle(150% at center center);
    }
    100% {
      clip-path: circle(0% at center bottom);
    }
  }

  [data-context-dialog]::backdrop {
    background-color: transparent;
  }
`,Jt={scrollbar:eg,globalStyles:tg},Eu=class W{static set config(e){this._config={...W._config,...e}}static get config(){return W._config}static addGlobalStyles(){let e=document.querySelector("style[id='bim-ui']");if(e)return;e=document.createElement("style"),e.id="bim-ui",e.textContent=Jt.globalStyles.cssText;const i=document.head.firstChild;i?document.head.insertBefore(e,i):document.head.append(e)}static preloadIcons(e,i=!1){Qb(e,(o,n,s)=>{i&&(console.log("Icons loaded:",o),n.length&&console.warn("Icons missing:",n),s.length&&console.info("Icons pending:",s))})}static addIconsCollection(e,i){Kb({prefix:i?.prefix??"bim",icons:e,width:24,height:24})}static defineCustomElement(e,i){customElements.get(e)||customElements.define(e,i)}static registerComponents(){W.init()}static init(e="",i=!0){W.addGlobalStyles(),W.defineCustomElement("bim-button",ag),W.defineCustomElement("bim-checkbox",wn),W.defineCustomElement("bim-color-input",Kt),W.defineCustomElement("bim-context-menu",es),W.defineCustomElement("bim-dropdown",st),W.defineCustomElement("bim-grid",qa),W.defineCustomElement("bim-icon",mg),W.defineCustomElement("bim-input",Co),W.defineCustomElement("bim-label",$n),W.defineCustomElement("bim-number-input",Fe),W.defineCustomElement("bim-option",ue),W.defineCustomElement("bim-panel",Ii),W.defineCustomElement("bim-panel-section",_n),W.defineCustomElement("bim-selector",xn),W.defineCustomElement("bim-table",Ue),W.defineCustomElement("bim-tabs",Pt),W.defineCustomElement("bim-tab",Pe),W.defineCustomElement("bim-table-cell",Nu),W.defineCustomElement("bim-table-children",kg),W.defineCustomElement("bim-table-group",Hu),W.defineCustomElement("bim-table-row",Pi),W.defineCustomElement("bim-text-input",Je),W.defineCustomElement("bim-toolbar",Qs),W.defineCustomElement("bim-toolbar-group",Js),W.defineCustomElement("bim-toolbar-section",Cn),W.defineCustomElement("bim-viewport",eh),W.defineCustomElement("bim-tooltip",Zg),i&&this.animateOnLoad(e)}static newRandomId(){const e="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";let i="";for(let o=0;o<10;o++){const n=Math.floor(Math.random()*e.length);i+=e.charAt(n)}return i}static animateOnLoad(e=""){const i=`
      bim-input,
      bim-button,
      bim-checkbox,
      bim-selector,
      bim-label,
      bim-table-row,
      bim-panel-section,
      bim-table-children .branch-vertical,
      .switchers
    `,o=[];function n(s,r=document,a=new Set){const l=[];return Array.from(r.querySelectorAll(s)).forEach(c=>{a.has(c)||(a.add(c),l.push(c))}),Array.from(r.querySelectorAll("*")).filter(c=>c.shadowRoot).forEach(c=>{a.has(c)||(a.add(c),l.push(...n(s,c.shadowRoot,a)))}),l}requestAnimationFrame(()=>{n(e||i).forEach(r=>{const a=r;let l="auto";l=window.getComputedStyle(a).getPropertyValue("transition"),a.style.setProperty("opacity","0"),a.style.setProperty("transition","none"),requestAnimationFrame(()=>{a.style.setProperty("transition",l)}),o.push(a)});const s=()=>{o.forEach(r=>{const a=r,l=(a.getBoundingClientRect().x+a.getBoundingClientRect().y)/(window.innerWidth+window.innerHeight),c=window.getComputedStyle(a).getPropertyValue("transform"),d=400,u=200+l*1e3;a.animate([{transform:"translateY(-20px)",opacity:"0"},{transform:"translateY(0)",opacity:"1"}],{duration:d,easing:"ease-in-out",delay:u}),setTimeout(()=>{a.style.removeProperty("opacity"),c!=="none"?a.style.setProperty("transform",c):a.style.removeProperty("transform")},u+d)})};document.readyState==="complete"?s():window.addEventListener("load",s)})}static toggleTheme(e=!0){const i=document.querySelector("html");if(!i)return;const o=()=>{i.classList.contains("bim-ui-dark")?i.classList.replace("bim-ui-dark","bim-ui-light"):i.classList.contains("bim-ui-light")?i.classList.replace("bim-ui-light","bim-ui-dark"):i.classList.add("bim-ui-light")};if(e){const n=document.createElement("div");n.classList.add("theme-transition-overlay");const s=document.createElement("div");n.appendChild(s),s.style.setProperty("transition",`background-color ${1e3/3200}s`),document.body.appendChild(n),n.style.setProperty("animation",`toggleOverlay ${1e3/1e3}s ease-in forwards`),s.style.setProperty("animation",`toggleThemeAnimation ${1e3/1e3}s ease forwards`),setTimeout(()=>{o()},1e3/4),setTimeout(()=>{document.body.querySelectorAll(".theme-transition-overlay").forEach(r=>{document.body.removeChild(r)})},1e3)}else o()}};Eu._config={sectionLabelOnVerticalToolbar:!1};let Ws=Eu,ln=class extends J{constructor(){super(...arguments),this._lazyLoadObserver=null,this._visibleElements=[],this.ELEMENTS_BEFORE_OBSERVER=20,this.useObserver=!1,this.elements=new Set,this.observe=e=>{if(!this.useObserver)return;for(const o of e)this.elements.add(o);const i=e.slice(this.ELEMENTS_BEFORE_OBSERVER);for(const o of i)o.remove();this.observeLastElement()}}set visibleElements(e){this._visibleElements=this.useObserver?e:[],this.requestUpdate()}get visibleElements(){return this._visibleElements}getLazyObserver(){if(!this.useObserver)return null;if(this._lazyLoadObserver)return this._lazyLoadObserver;const e=new IntersectionObserver(i=>{const o=i[0];if(!o.isIntersecting)return;const n=o.target;e.unobserve(n);const s=this.ELEMENTS_BEFORE_OBSERVER+this.visibleElements.length,r=[...this.elements][s];r&&(this.visibleElements=[...this.visibleElements,r],e.observe(r))},{threshold:.5});return e}observeLastElement(){const e=this.getLazyObserver();if(!e)return;const i=this.ELEMENTS_BEFORE_OBSERVER+this.visibleElements.length-1,o=[...this.elements][i];o&&e.observe(o)}resetVisibleElements(){const e=this.getLazyObserver();if(e){for(const i of this.elements)e.unobserve(i);this.visibleElements=[],this.observeLastElement()}}static create(e,i){const o=document.createDocumentFragment();if(e.length===0)return Fr(e(),o),o.firstElementChild;if(!i)throw new Error("UIComponent: Initial state is required for statefull components.");let n=i;const s=e,r=l=>(n={...n,...l},Fr(s(n,r),o),n);r(i);const a=()=>n;return[o.firstElementChild,r,a]}};const gs=(t,e={},i=!0)=>{let o={};for(const n of t.children){const s=n,r=s.getAttribute("name")||s.getAttribute("label"),a=r?e[r]:void 0;if(r){if("value"in s&&typeof s.value<"u"&&s.value!==null){const l=s.value;if(typeof l=="object"&&!Array.isArray(l)&&Object.keys(l).length===0)continue;o[r]=a?a(s.value):s.value}else if(i){const l=gs(s,e);if(Object.keys(l).length===0)continue;o[r]=a?a(l):l}}else i&&(o={...o,...gs(s,e)})}return o},Ys=t=>t==="true"||t==="false"?t==="true":t&&!isNaN(Number(t))&&t.trim()!==""?Number(t):t,ig=[">=","<=","=",">","<","?","/","#"];function bc(t){const e=ig.find(r=>t.split(r).length===2),i=t.split(e).map(r=>r.trim()),[o,n]=i,s=n.startsWith("'")&&n.endsWith("'")?n.replace(/'/g,""):Ys(n);return{key:o,condition:e,value:s}}const Kr=t=>{try{const e=[],i=t.split(/&(?![^()]*\))/).map(o=>o.trim());for(const o of i){const n=!o.startsWith("(")&&!o.endsWith(")"),s=o.startsWith("(")&&o.endsWith(")");if(n){const r=bc(o);e.push(r)}if(s){const r={operator:"&",queries:o.replace(/^(\()|(\))$/g,"").split("&").map(a=>a.trim()).map((a,l)=>{const c=bc(a);return l>0&&(c.operator="&"),c})};e.push(r)}}return e}catch{return null}},gc=(t,e,i)=>{let o=!1;switch(e){case"=":o=t===i;break;case"?":o=String(t).includes(String(i));break;case"<":(typeof t=="number"||typeof i=="number")&&(o=t<i);break;case"<=":(typeof t=="number"||typeof i=="number")&&(o=t<=i);break;case">":(typeof t=="number"||typeof i=="number")&&(o=t>i);break;case">=":(typeof t=="number"||typeof i=="number")&&(o=t>=i);break;case"/":o=String(t).startsWith(String(i));break}return o};var ng=Object.defineProperty,og=Object.getOwnPropertyDescriptor,Su=(t,e,i,o)=>{for(var n=og(e,i),s=t.length-1,r;s>=0;s--)(r=t[s])&&(n=r(e,i,n)||n);return n&&ng(e,i,n),n},$e;const Va=($e=class extends J{constructor(){super(...arguments),this._previousContainer=null,this._visible=!1}get placement(){return this._placement}set placement(t){this._placement=t,this.updatePosition()}static removeMenus(){for(const t of[...$e.dialog.children])t instanceof $e&&(t.remove(),t.visible=!1);setTimeout(()=>{$e.dialog.close(),$e.dialog.remove()},310)}get visible(){return this._visible}set visible(t){this._visible=t,t?($e.dialog.parentElement||document.body.append($e.dialog),this._previousContainer=this.parentElement,$e.dialog.style.top=`${window.scrollY||document.documentElement.scrollTop}px`,this.style.setProperty("display","flex"),$e.dialog.append(this),$e.dialog.showModal(),this.updatePosition(),this.dispatchEvent(new Event("visible"))):setTimeout(()=>{var e;(e=this._previousContainer)==null||e.append(this),this._previousContainer=null,this.style.setProperty("display","none"),this.dispatchEvent(new Event("hidden"))},310)}async updatePosition(){if(!(this.visible&&this._previousContainer))return;const t=this.placement??"right",e=await Pa(this._previousContainer,this,{placement:t,middleware:[Ca(10),Ia(),Oa(),Ta({padding:5})]}),{x:i,y:o}=e;this.style.left=`${i}px`,this.style.top=`${o}px`}connectedCallback(){super.connectedCallback(),this.visible?(this.style.setProperty("width","auto"),this.style.setProperty("height","auto")):(this.style.setProperty("display","none"),this.style.setProperty("width","0"),this.style.setProperty("height","0"))}render(){return T` <slot></slot> `}},$e.styles=[Jt.scrollbar,te`
      :host {
        pointer-events: auto;
        position: absolute;
        top: 0;
        left: 0;
        z-index: 999;
        overflow: auto;
        max-height: 20rem;
        min-width: 3rem;
        flex-direction: column;
        box-shadow: 1px 2px 8px 2px rgba(0, 0, 0, 0.15);
        padding: 0.5rem;
        border-radius: var(--bim-ui_size-4xs);
        display: flex;
        transform-origin: top left;
        transform: scale(1);
        clip-path: circle(150% at top left);
        background-color: var(--bim-ui_bg-contrast-20);
        transition:
          clip-path 0.2s cubic-bezier(0.72, 0.1, 0.43, 0.93),
          transform 0.3s cubic-bezier(0.72, 0.1, 0.45, 2.35);
      }

      :host(:not([visible])) {
        transform: scale(0.8);
        clip-path: circle(0 at top left);
      }
    `],$e.dialog=ln.create(()=>T` <dialog
      @click=${t=>{t.target===$e.dialog&&$e.removeMenus()}}
      @cancel=${()=>$e.removeMenus()}
      data-context-dialog
      style="
      width: 0;
      height: 0;
      position: relative;
      padding: 0;
      border: none;
      outline: none;
      margin: none;
      overflow: visible;
      background-color: transparent;
    "
    ></dialog>`),$e);Su([_({type:String,reflect:!0})],Va.prototype,"placement");Su([_({type:Boolean,reflect:!0})],Va.prototype,"visible");let es=Va;var sg=Object.defineProperty,rg=Object.getOwnPropertyDescriptor,ot=(t,e,i,o)=>{for(var n=o>1?void 0:o?rg(e,i):e,s=t.length-1,r;s>=0;s--)(r=t[s])&&(n=(o?r(e,i,n):r(n))||n);return o&&n&&sg(e,i,n),n},zn;const Ye=(zn=class extends J{constructor(){super(),this.labelHidden=!1,this.active=!1,this.disabled=!1,this.vertical=!1,this.tooltipVisible=!1,this._stateBeforeLoading={disabled:!1,icon:""},this._loading=!1,this._parent=an(),this._tooltip=an(),this._mouseLeave=!1,this.onClick=t=>{t.stopPropagation(),this.disabled||this.dispatchEvent(new Event("click"))},this.showContextMenu=()=>{let t=this._contextMenu;if(this.contextMenuTemplate&&(t=ln.create(()=>{const e=ln.create(this.contextMenuTemplate);return e instanceof es?T`${e}`:T`
          <bim-context-menu>${e}</bim-context-menu>
        `}),this.append(t),t.addEventListener("hidden",()=>{t?.remove()})),t){const e=this.getAttribute("data-context-group");e&&t.setAttribute("data-context-group",e),this.closeNestedContexts();const i=Ws.newRandomId();for(const o of t.children)o instanceof zn&&o.setAttribute("data-context-group",i);t.visible=!0}},this.mouseLeave=!0}set loading(t){if(this._loading=t,t)this._stateBeforeLoading={disabled:this.disabled,icon:this.icon},this.disabled=t,this.icon="eos-icons:loading";else{const{disabled:e,icon:i}=this._stateBeforeLoading;this.disabled=e,this.icon=i}}get loading(){return this._loading}set mouseLeave(t){this._mouseLeave=t,t&&(this.tooltipVisible=!1,clearTimeout(this.timeoutID))}get mouseLeave(){return this._mouseLeave}computeTooltipPosition(){const{value:t}=this._parent,{value:e}=this._tooltip;t&&e&&Pa(t,e,{placement:"bottom",middleware:[Ca(10),Ia(),Oa(),Ta({padding:5})]}).then(i=>{const{x:o,y:n}=i;Object.assign(e.style,{left:`${o}px`,top:`${n}px`})})}onMouseEnter(){if(!(this.tooltipTitle||this.tooltipText))return;this.mouseLeave=!1;const t=this.tooltipTime??700;this.timeoutID=setTimeout(()=>{this.mouseLeave||(this.computeTooltipPosition(),this.tooltipVisible=!0)},t)}closeNestedContexts(){const t=this.getAttribute("data-context-group");if(t)for(const e of es.dialog.children){const i=e.getAttribute("data-context-group");if(e instanceof es&&i===t){e.visible=!1,e.removeAttribute("data-context-group");for(const o of e.children)o instanceof zn&&(o.closeNestedContexts(),o.removeAttribute("data-context-group"))}}}click(){this.disabled||super.click()}get _contextMenu(){return this.querySelector("bim-context-menu")}connectedCallback(){super.connectedCallback(),this.addEventListener("click",this.showContextMenu)}disconnectedCallback(){super.disconnectedCallback(),this.removeEventListener("click",this.showContextMenu)}render(){const t=T`
      <div ${gt(this._tooltip)} class="tooltip">
        ${this.tooltipTitle?T`<p style="text-wrap: nowrap;">
              <strong>${this.tooltipTitle}</strong>
            </p>`:null}
        ${this.tooltipText?T`<p style="width: 9rem;">${this.tooltipText}</p>`:null}
      </div>
    `;let e=T`${this.label}`;if((this._contextMenu||this.contextMenuTemplate)&&this.label){const i=T`<svg
        xmlns="http://www.w3.org/2000/svg"
        height="1.125rem"
        viewBox="0 0 24 24"
        width="1.125rem"
        style="fill: var(--bim-label--c)"
      >
        <path d="M0 0h24v24H0V0z" fill="none" />
        <path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
      </svg>`;e=T`
        <div style="display: flex; align-items: center;">
          ${this.label}
          ${i}
        </div>
      `}return T`
      <div ${gt(this._parent)} class="parent" @click=${this.onClick}>
        ${this.label||this.icon?T`
              <div
                class="button"
                @mouseenter=${this.onMouseEnter}
                @mouseleave=${()=>this.mouseLeave=!0}
              >
                <bim-label
                  .icon=${this.icon}
                  .vertical=${this.vertical}
                  .labelHidden=${this.labelHidden}
                  >${e}</bim-label
                >
              </div>
            `:null}
        ${this.tooltipTitle||this.tooltipText?t:null}
      </div>
      <slot></slot>
    `}},zn.styles=te`
    :host {
      --bim-label--c: var(--bim-ui_bg-contrast-100, white);
      position: relative;
      display: block;
      flex: 1;
      pointer-events: none;
      background-color: var(--bim-button--bgc, var(--bim-ui_bg-contrast-20));
      border-radius: var(--bim-ui_size-4xs);
      transition: all 0.15s;
    }

    :host(:not([disabled]))::before {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      border-radius: inherit;
      background-color: var(--bim-ui_main-base);
      clip-path: circle(0 at center center);
      box-sizing: border-box;
      transition:
        clip-path 0.3s cubic-bezier(0.65, 0.05, 0.36, 1),
        transform 0.15s;
    }

    :host(:not([disabled]):hover) {
      cursor: pointer;
    }

    bim-label {
      pointer-events: none;
    }

    .parent {
      --bim-icon--c: var(--bim-label--c);
      position: relative;
      display: flex;
      height: 100%;
      user-select: none;
      row-gap: 0.125rem;
      min-height: var(--bim-ui_size-5xl);
      min-width: var(--bim-ui_size-5xl);
    }

    .button,
    .children {
      box-sizing: border-box;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: auto;
    }

    .children {
      padding: 0 0.375rem;
      position: absolute;
      height: 100%;
      right: 0;
    }

    :host(:not([label-hidden])[icon][vertical]) .parent {
      min-height: 2.5rem;
    }

    .button {
      flex-grow: 1;
      transition: transform 0.15s;
    }

    :host(:not([label-hidden])[label]) .button {
      justify-content: var(--bim-button--jc, center);
    }

    :host(:hover)::before {
      clip-path: circle(120% at center center);
    }

    :host(:hover) {
      --bim-label--c: var(--bim-ui_main-contrast);
      z-index: 2;
    }

    :host([active]) {
      background-color: var(--bim-ui_main-base);
    }

    :host(:not([disabled]):active) {
      background: transparent;
    }

    :host(:not([disabled]):active) .button,
    :host(:not([disabled]):active)::before {
      transform: scale(0.98);
    }

    :host(:not([label]):not([icon])) .children {
      flex: 1;
    }

    :host([vertical]) .parent {
      justify-content: center;
    }

    :host(:not([label-hidden])[label]) .button {
      padding: 0 0.5rem;
    }

    :host([disabled]) {
      --bim-label--c: var(--bim-ui_bg-contrast-80) !important;
      background-color: gray !important;
    }

    ::slotted(bim-button) {
      --bim-icon--fz: var(--bim-ui_size-base);
      --bim-button--bdrs: var(--bim-ui_size-4xs);
      --bim-button--olw: 0;
      --bim-button--olc: transparent;
    }

    .tooltip {
      position: absolute;
      padding: 0.75rem;
      z-index: 99;
      display: flex;
      flex-flow: column;
      row-gap: 0.375rem;
      box-shadow: 0 0 10px 3px rgba(0 0 0 / 20%);
      outline: 1px solid var(--bim-ui_bg-contrast-40);
      font-size: var(--bim-ui_size-xs);
      border-radius: var(--bim-ui_size-4xs);
      background-color: var(--bim-ui_bg-contrast-20);
      color: var(--bim-ui_bg-contrast-100);
      animation: openTooltips 0.15s ease-out forwards;
      transition: visibility 0.2s;
    }

    .tooltip p {
      margin: 0;
      padding: 0;
    }

    :host(:not([tooltip-visible])) .tooltip {
      animation: closeTooltips 0.15s ease-in forwards;
      visibility: hidden;
      display: none;
    }

    @keyframes closeTooltips {
      0% {
        display: flex;
        padding: 0.75rem;
        transform: translateY(0);
        opacity: 1;
      }
      90% {
        padding: 0.75rem;
      }
      100% {
        display: none;
        padding: 0;
        transform: translateY(-10px);
        opacity: 0;
      }
    }

    @keyframes openTooltips {
      0% {
        display: flex;
        transform: translateY(-10px);
        opacity: 0;
      }
      100% {
        transform: translateY(0);
        opacity: 1;
      }
    }
  `,zn);ot([_({type:String,reflect:!0})],Ye.prototype,"label",2);ot([_({type:Boolean,attribute:"label-hidden",reflect:!0})],Ye.prototype,"labelHidden",2);ot([_({type:Boolean,reflect:!0})],Ye.prototype,"active",2);ot([_({type:Boolean,reflect:!0,attribute:"disabled"})],Ye.prototype,"disabled",2);ot([_({type:String,reflect:!0})],Ye.prototype,"icon",2);ot([_({type:Boolean,reflect:!0})],Ye.prototype,"vertical",2);ot([_({type:Number,attribute:"tooltip-time",reflect:!0})],Ye.prototype,"tooltipTime",2);ot([_({type:Boolean,attribute:"tooltip-visible",reflect:!0})],Ye.prototype,"tooltipVisible",2);ot([_({type:String,attribute:"tooltip-title",reflect:!0})],Ye.prototype,"tooltipTitle",2);ot([_({type:String,attribute:"tooltip-text",reflect:!0})],Ye.prototype,"tooltipText",2);ot([_({type:Boolean,reflect:!0})],Ye.prototype,"loading",1);let ag=Ye;var lg=Object.defineProperty,So=(t,e,i,o)=>{for(var n=void 0,s=t.length-1,r;s>=0;s--)(r=t[s])&&(n=r(e,i,n)||n);return n&&lg(e,i,n),n};const Cu=class extends J{constructor(){super(...arguments),this.checked=!1,this.inverted=!1,this.onValueChange=new Event("change")}get value(){return this.checked}onChange(e){e.stopPropagation(),this.checked=e.target.checked,this.dispatchEvent(this.onValueChange)}render(){const e=T`
      <svg viewBox="0 0 21 21">
        <polyline points="5 10.75 8.5 14.25 16 6"></polyline>
      </svg>
    `;return T`
      <div class="parent">
        <label class="parent-label">
          ${this.label?T`<bim-label .icon="${this.icon}">${this.label}</bim-label> `:null}
          <div class="input-container">
            <input
              type="checkbox"
              aria-label=${this.label||this.name||"Checkbox Input"}
              @change="${this.onChange}"
              .checked="${this.checked}"
            />
            ${e}
          </div>
        </label>
      </div>
    `}};Cu.styles=te`
    :host {
      display: block;
    }

    .parent-label {
      --background: #fff;
      --border: #dfdfe6;
      --stroke: #fff;
      --border-hover: var(--bim-ui_main-base);
      --border-active: var(--bim-ui_main-base);
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
      width: 100%;
      height: 1.75rem;
      column-gap: 0.25rem;
      position: relative;
      cursor: pointer;
      user-select: none;
      -webkit-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
    }

    :host([inverted]) .parent-label {
      flex-direction: row-reverse;
      justify-content: start;
    }

    input,
    svg {
      width: 1rem;
      height: 1rem;
      display: block;
    }

    input {
      -webkit-appearance: none;
      -moz-appearance: none;
      position: relative;
      outline: none;
      background: var(--background);
      border: none;
      margin: 0;
      padding: 0;
      cursor: pointer;
      border-radius: 4px;
      transition: box-shadow 0.3s;
      box-shadow: inset 0 0 0 var(--s, 1px) var(--b, var(--border));
    }

    svg {
      pointer-events: none;
      fill: none;
      stroke-width: 2.2px;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke: var(--stroke, var(--border-active));
      transform: translateY(-100%) scale(0);
      position: absolute;
      width: 1rem;
      height: 1rem;
    }

    input:hover {
      --s: 2px;
      --b: var(--border-hover);
    }

    input:checked {
      --b: var(--border-active);
      --s: 11px;
    }

    input:checked + svg {
      -webkit-animation: bounce 0.4s linear forwards 0.2s;
      animation: bounce 0.4s linear forwards 0.2s;
    }

    @keyframes bounce {
      0% {
        transform: translateY(-100%) scale(0);
      }
      50% {
        transform: translateY(-100%) scale(1.2);
      }
      75% {
        transform: translateY(-100%) scale(0.9);
      }
      100% {
        transform: translateY(-100%) scale(1);
      }
    }
  `;let wn=Cu;So([_({type:String,reflect:!0})],wn.prototype,"icon");So([_({type:String,reflect:!0})],wn.prototype,"name");So([_({type:String,reflect:!0})],wn.prototype,"label");So([_({type:Boolean,reflect:!0})],wn.prototype,"checked");So([_({type:Boolean,reflect:!0})],wn.prototype,"inverted");var cg=Object.defineProperty,Oi=(t,e,i,o)=>{for(var n=void 0,s=t.length-1,r;s>=0;s--)(r=t[s])&&(n=r(e,i,n)||n);return n&&cg(e,i,n),n};const Au=class extends J{constructor(){super(...arguments),this.vertical=!1,this.color="#bcf124",this.disabled=!1,this._colorInput=an(),this._textInput=an(),this.onValueChange=new Event("input"),this.onOpacityInput=e=>{const i=e.target;this.opacity=i.value,this.dispatchEvent(this.onValueChange)}}set value(e){const{color:i,opacity:o}=e;this.color=i,o&&(this.opacity=o)}get value(){const e={color:this.color};return this.opacity&&(e.opacity=this.opacity),e}onColorInput(e){e.stopPropagation();const{value:i}=this._colorInput;i&&(this.color=i.value,this.dispatchEvent(this.onValueChange))}onTextInput(e){e.stopPropagation();const{value:i}=this._textInput;if(!i)return;const{value:o}=i;let n=o.replace(/[^a-fA-F0-9]/g,"");n.startsWith("#")||(n=`#${n}`),i.value=n.slice(0,7),i.value.length===7&&(this.color=i.value,this.dispatchEvent(this.onValueChange))}focus(){const{value:e}=this._colorInput;e&&e.click()}render(){return T`
      <div class="parent">
        <bim-input
          .label=${this.label}
          .icon=${this.icon}
          .vertical="${this.vertical}"
        >
          <div class="color-container">
            <div
              style="display: flex; align-items: center; gap: .375rem; height: 100%; flex: 1; padding: 0 0.5rem;"
            >
              <input
                ${gt(this._colorInput)}
                @input="${this.onColorInput}"
                type="color"
                aria-label=${this.label||this.name||"Color Input"}
                value="${this.color}"
                ?disabled=${this.disabled}
              />
              <div
                @click=${this.focus}
                class="sample"
                style="background-color: ${this.color}"
              ></div>
              <input
                ${gt(this._textInput)}
                @input="${this.onTextInput}"
                value="${this.color}"
                type="text"
                aria-label=${this.label||this.name||"Text Color Input"}
                ?disabled=${this.disabled}
              />
            </div>
            ${this.opacity!==void 0?T`<bim-number-input
                  @change=${this.onOpacityInput}
                  slider
                  suffix="%"
                  min="0"
                  value=${this.opacity}
                  max="100"
                ></bim-number-input>`:null}
          </div>
        </bim-input>
      </div>
    `}};Au.styles=te`
    :host {
      --bim-input--bgc: var(--bim-ui_bg-contrast-20);
      flex: 1;
      display: block;
    }

    :host(:focus) {
      --bim-input--olw: var(--bim-number-input--olw, 2px);
      --bim-input--olc: var(--bim-ui_accent-base);
    }

    .parent {
      display: flex;
      gap: 0.375rem;
    }

    .color-container {
      position: relative;
      outline: none;
      display: flex;
      height: 100%;
      gap: 0.5rem;
      justify-content: flex-start;
      align-items: center;
      flex: 1;
      border-radius: var(--bim-color-input--bdrs, var(--bim-ui_size-4xs));
    }

    .color-container input[type="color"] {
      position: absolute;
      bottom: -0.25rem;
      visibility: hidden;
      width: 0;
      height: 0;
    }

    .color-container .sample {
      width: 1rem;
      height: 1rem;
      border-radius: 0.125rem;
      background-color: #fff;
    }

    .color-container input[type="text"] {
      height: 100%;
      flex: 1;
      width: 3.25rem;
      text-transform: uppercase;
      font-size: 0.75rem;
      background-color: transparent;
      padding: 0%;
      outline: none;
      border: none;
      color: var(--bim-color-input--c, var(--bim-ui_bg-contrast-100));
    }

    :host([disabled]) .color-container input[type="text"] {
      color: var(--bim-ui_bg-contrast-60);
    }

    bim-number-input {
      flex-grow: 0;
    }
  `;let Kt=Au;Oi([_({type:String,reflect:!0})],Kt.prototype,"name");Oi([_({type:String,reflect:!0})],Kt.prototype,"label");Oi([_({type:String,reflect:!0})],Kt.prototype,"icon");Oi([_({type:Boolean,reflect:!0})],Kt.prototype,"vertical");Oi([_({type:Number,reflect:!0})],Kt.prototype,"opacity");Oi([_({type:String,reflect:!0})],Kt.prototype,"color");Oi([_({type:Boolean,reflect:!0})],Kt.prototype,"disabled");var dg=Object.defineProperty,ug=Object.getOwnPropertyDescriptor,Qt=(t,e,i,o)=>{for(var n=o>1?void 0:o?ug(e,i):e,s=t.length-1,r;s>=0;s--)(r=t[s])&&(n=(o?r(e,i,n):r(n))||n);return o&&n&&dg(e,i,n),n};const ku=class extends J{constructor(){super(...arguments),this.checked=!1,this.checkbox=!1,this.noMark=!1,this.vertical=!1}get value(){return this._value!==void 0?this._value:this.label?Ys(this.label):this.label}set value(e){this._value=e}render(){return T`
      <div class="parent" .title=${this.label??""}>
        ${this.img||this.icon||this.label?T` <div style="display: flex; column-gap: 0.375rem">
              ${this.checkbox&&!this.noMark?T`<bim-checkbox
                    style="pointer-events: none"
                    .checked=${this.checked}
                  ></bim-checkbox>`:null}
              <bim-label
                .vertical=${this.vertical}
                .icon=${this.icon}
                .img=${this.img}
                >${this.label}</bim-label
              >
            </div>`:null}
        ${!this.checkbox&&!this.noMark&&this.checked?T`<svg
              xmlns="http://www.w3.org/2000/svg"
              height="1.125rem"
              viewBox="0 0 24 24"
              width="1.125rem"
              fill="#FFFFFF"
            >
              <path d="M0 0h24v24H0z" fill="none" />
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>`:null}
        <slot></slot>
      </div>
    `}};ku.styles=te`
    :host {
      --bim-label--c: var(--bim-ui_bg-contrast-100);
      display: block;
      box-sizing: border-box;
      flex: 1;
      padding: 0rem 0.5rem;
      border-radius: var(--bim-ui_size-4xs);
      transition: all 0.15s;
    }

    :host(:hover) {
      cursor: pointer;
    }

    :host([checked]) {
      --bim-label--c: color-mix(in lab, var(--bim-ui_main-base), white 30%);
    }

    :host([checked]) svg {
      fill: color-mix(in lab, var(--bim-ui_main-base), white 30%);
    }

    .parent {
      box-sizing: border-box;
      display: flex;
      justify-content: var(--bim-option--jc, space-between);
      column-gap: 0.5rem;
      align-items: center;
      min-height: 1.75rem;
      height: 100%;
    }

    input {
      height: 1rem;
      width: 1rem;
      cursor: pointer;
      border: none;
      outline: none;
      accent-color: var(--bim-checkbox--c, var(--bim-ui_main-base));
    }

    input:focus {
      outline: var(--bim-checkbox--olw, 2px) solid
        var(--bim-checkbox--olc, var(--bim-ui_accent-base));
    }

    bim-label {
      pointer-events: none;
      z-index: 1;
    }
  `;let ue=ku;Qt([_({type:String,reflect:!0})],ue.prototype,"img",2);Qt([_({type:String,reflect:!0})],ue.prototype,"label",2);Qt([_({type:String,reflect:!0})],ue.prototype,"icon",2);Qt([_({type:Boolean,reflect:!0})],ue.prototype,"checked",2);Qt([_({type:Boolean,reflect:!0})],ue.prototype,"checkbox",2);Qt([_({type:Boolean,attribute:"no-mark",reflect:!0})],ue.prototype,"noMark",2);Qt([_({converter:{fromAttribute(t){return t&&Ys(t)}}})],ue.prototype,"value",1);Qt([_({type:Boolean,reflect:!0})],ue.prototype,"vertical",2);var hg=Object.defineProperty,pg=Object.getOwnPropertyDescriptor,wt=(t,e,i,o)=>{for(var n=o>1?void 0:o?pg(e,i):e,s=t.length-1,r;s>=0;s--)(r=t[s])&&(n=(o?r(e,i,n):r(n))||n);return o&&n&&hg(e,i,n),n};const Tu=class extends ln{constructor(){super(),this.multiple=!1,this.required=!1,this.vertical=!1,this._visible=!1,this._value=new Set,this.onValueChange=new Event("change"),this._contextMenu=an(),this.onOptionClick=e=>{const i=e.target,o=this._value.has(i);if(!this.multiple&&!this.required&&!o)this._value=new Set([i]);else if(!this.multiple&&!this.required&&o)this._value=new Set([]);else if(!this.multiple&&this.required&&!o)this._value=new Set([i]);else if(this.multiple&&!this.required&&!o)this._value=new Set([...this._value,i]);else if(this.multiple&&!this.required&&o){const n=[...this._value].filter(s=>s!==i);this._value=new Set(n)}else if(this.multiple&&this.required&&!o)this._value=new Set([...this._value,i]);else if(this.multiple&&this.required&&o){const n=[...this._value].filter(r=>r!==i),s=new Set(n);s.size!==0&&(this._value=s)}this.updateOptionsState(),this.dispatchEvent(this.onValueChange)},this.onSearch=({target:e})=>{const i=e.value.toLowerCase();for(const o of this._options)o instanceof ue&&((o.label||o.value||"").toLowerCase().includes(i)?o.style.display="":o.style.display="none")},this.useObserver=!0}set visible(e){var i;if(e){const{value:o}=this._contextMenu;if(!o)return;for(const n of this.elements)o.append(n);this._visible=!0}else{for(const n of this.elements)this.append(n);this._visible=!1,this.resetVisibleElements();for(const n of this._options)n instanceof ue&&(n.style.display="");const o=(i=this._contextMenu.value)==null?void 0:i.querySelector("bim-text-input");o&&(o.value="")}}get visible(){return this._visible}set value(e){if(this.required&&Object.keys(e).length===0)return;const i=new Set;for(const o of e){const n=this.findOption(o);if(n&&(i.add(n),!this.multiple&&Object.keys(e).length===1))break}this._value=i,this.updateOptionsState(),this.dispatchEvent(this.onValueChange)}get value(){return[...this._value].filter(e=>e instanceof ue&&e.checked).map(e=>e.value)}get _options(){const e=new Set([...this.elements]);for(const i of this.children)i instanceof ue&&e.add(i);return[...e]}onSlotChange(e){const i=e.target.assignedElements();this.observe(i);const o=new Set;for(const n of this.elements){if(!(n instanceof ue)){n.remove();continue}n.checked&&o.add(n),n.removeEventListener("click",this.onOptionClick),n.addEventListener("click",this.onOptionClick)}this._value=o}updateOptionsState(){for(const e of this._options)e instanceof ue&&(e.checked=this._value.has(e))}findOption(e){return this._options.find(i=>i instanceof ue?i.label===e||i.value===e:!1)}render(){let e,i,o;if(this._value.size===0)e=this.placeholder??"Select an option...";else if(this._value.size===1){const n=[...this._value][0];e=n?.label||n?.value,i=n?.img,o=n?.icon}else e=`Multiple (${this._value.size})`;return T`
      <bim-input
        title=${this.label??""}
        .label=${this.label}
        .icon=${this.icon}
        .vertical=${this.vertical}
      >
        <div class="input" @click=${()=>this.visible=!this.visible}>
          <bim-label
            .img=${i}
            .icon=${o}
            style="overflow: hidden;"
            >${e}</bim-label
          >
          <svg
            style="flex-shrink: 0; fill: var(--bim-dropdown--c, var(--bim-ui_bg-contrast-100))"
            xmlns="http://www.w3.org/2000/svg"
            height="1.125rem"
            viewBox="0 0 24 24"
            width="1.125rem"
            fill="#9ca3af"
          >
            <path d="M0 0h24v24H0V0z" fill="none" />
            <path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
          </svg>
          <bim-context-menu
            ${gt(this._contextMenu)}
            .visible=${this.visible}
            @hidden=${()=>{this.visible&&(this.visible=!1)}}
          >
            ${this.searchBox?T`<bim-text-input @input=${this.onSearch} placeholder="Search..." debounce=200 style="--bim-input--bgc: var(--bim-ui_bg-contrast-30)"></bim-text-input>`:oe}
            <slot @slotchange=${this.onSlotChange}></slot>
          </bim-context-menu>
        </div>
      </bim-input>
    `}};Tu.styles=[Jt.scrollbar,te`
      :host {
        --bim-input--bgc: var(
          --bim-dropdown--bgc,
          var(--bim-ui_bg-contrast-20)
        );
        --bim-input--olw: 2px;
        --bim-input--olc: transparent;
        --bim-input--bdrs: var(--bim-ui_size-4xs);
        flex: 1;
        display: block;
      }

      :host([visible]) {
        --bim-input--olc: var(--bim-ui_accent-base);
      }

      .input {
        --bim-label--fz: var(--bim-drodown--fz, var(--bim-ui_size-xs));
        --bim-label--c: var(--bim-dropdown--c, var(--bim-ui_bg-contrast-100));
        height: 100%;
        display: flex;
        flex: 1;
        overflow: hidden;
        column-gap: 0.25rem;
        outline: none;
        cursor: pointer;
        align-items: center;
        justify-content: space-between;
        padding: 0 0.5rem;
      }

      bim-label {
        pointer-events: none;
      }
    `];let st=Tu;wt([_({type:String,reflect:!0})],st.prototype,"name",2);wt([_({type:String,reflect:!0})],st.prototype,"icon",2);wt([_({type:String,reflect:!0})],st.prototype,"label",2);wt([_({type:Boolean,reflect:!0})],st.prototype,"multiple",2);wt([_({type:Boolean,reflect:!0})],st.prototype,"required",2);wt([_({type:Boolean,reflect:!0})],st.prototype,"vertical",2);wt([_({type:String,reflect:!0})],st.prototype,"placeholder",2);wt([_({type:Boolean,reflect:!0,attribute:"search-box"})],st.prototype,"searchBox",2);wt([_({type:Boolean,reflect:!0})],st.prototype,"visible",1);wt([Ti()],st.prototype,"_value",2);var fg=Object.defineProperty,Ou=(t,e,i,o)=>{for(var n=void 0,s=t.length-1,r;s>=0;s--)(r=t[s])&&(n=r(e,i,n)||n);return n&&fg(e,i,n),n};const Iu=class extends J{constructor(){super(...arguments),this.floating=!1,this._layouts={},this._elements={},this._templateIds=new Map,this._updateFunctions={},this._slotNames={notAllowed:"not-allowed",notFound:"not-found",emptyLayout:"empty-layout"},this.updateComponent={},this.emitLayoutChange=()=>{this.dispatchEvent(new Event("layoutchange"))}}set layouts(e){this._layouts=e,this._templateIds.clear()}get layouts(){return this._layouts}set elements(e){this._elements=e,this.setUpdateFunctions()}get elements(){return this._elements}getLayoutAreas(e){const{template:i}=e,o=i.split(`
`).map(n=>n.trim()).map(n=>n.split('"')[1]).filter(n=>n!==void 0).flatMap(n=>n.split(/\s+/));return[...new Set(o)].filter(n=>n!=="")}setUpdateFunctions(){const e={};for(const[i,o]of Object.entries(this.elements))"template"in o&&(e[i]=n=>{var s,r;(r=(s=this._updateFunctions)[i])==null||r.call(s,n)});this.updateComponent=e}disconnectedCallback(){super.disconnectedCallback(),this._templateIds.clear(),this._updateFunctions={},this.updateComponent={}}getTemplateId(e){let i=this._templateIds.get(e);return i||(i=Ws.newRandomId(),this._templateIds.set(e,i)),i}cleanUpdateFunctions(){if(!this.layout){this._updateFunctions={};return}const e=this.layouts[this.layout],i=this.getLayoutAreas(e);for(const o in this.elements)i.includes(o)||delete this._updateFunctions[o]}clean(){this.style.gridTemplate="";for(const e of[...this.children])Object.values(this._slotNames).some(i=>e.getAttribute("slot")===i)||e.remove();this.cleanUpdateFunctions()}emitElementCreation(e){this.dispatchEvent(new CustomEvent("elementcreated",{detail:e}))}render(){if(this.layout){const e=this.layouts[this.layout];if(e){if(!(e.guard??(()=>!0))())return this.clean(),T`<slot name=${this._slotNames.notAllowed}></slot>`;const i=this.getLayoutAreas(e).map(o=>{var n;const s=((n=e.elements)==null?void 0:n[o])||this.elements[o];if(!s)return null;if(s instanceof HTMLElement)return s.style.gridArea=o,s;if("template"in s){const{template:c,initialState:d}=s,u=this.getTemplateId(c),h=this.querySelector(`[data-grid-template-id="${u}"]`);if(h)return h;const[p,m]=ln.create(c,d);return this.emitElementCreation({name:o,element:p}),p.setAttribute("data-grid-template-id",u),p.style.gridArea=o,this._updateFunctions[o]=m,p}const r=this.getTemplateId(s),a=this.querySelector(`[data-grid-template-id="${r}"]`);if(a)return a;const l=ln.create(s);return this.emitElementCreation({name:o,element:l}),l.setAttribute("data-grid-template-id",this.getTemplateId(s)),l.style.gridArea=o,l}).filter(o=>o!==null);this.clean(),this.style.gridTemplate=e.template,this.append(...i),this.emitLayoutChange()}else return this.clean(),T`<slot name=${this._slotNames.notFound}></slot>`}else return this.clean(),this.emitLayoutChange(),T`<slot name=${this._slotNames.emptyLayout}></slot>`;return T`${T`<slot></slot>`}`}};Iu.styles=te`
    :host {
      display: grid;
      height: 100%;
      width: 100%;
      overflow: hidden;
      box-sizing: border-box;
    }

    /* :host(:not([layout])) {
      display: none;
    } */

    :host([floating]) {
      --bim-panel--bdrs: var(--bim-ui_size-4xs);
      background-color: transparent;
      padding: 1rem;
      gap: 1rem;
      position: absolute;
      pointer-events: none;
      top: 0px;
      left: 0px;
    }

    :host(:not([floating])) {
      --bim-panel--bdrs: 0;
      background-color: var(--bim-ui_bg-contrast-20);
      gap: 1px;
    }
  `;let qa=Iu;Ou([_({type:Boolean,reflect:!0})],qa.prototype,"floating");Ou([_({type:String,reflect:!0})],qa.prototype,"layout");const Qr=class extends J{render(){return T`
      <iconify-icon .icon=${this.icon} height="none"></iconify-icon>
    `}};Qr.styles=te`
    :host {
      height: var(--bim-icon--fz, var(--bim-ui_size-sm));
      width: var(--bim-icon--fz, var(--bim-ui_size-sm));
    }

    iconify-icon {
      height: var(--bim-icon--fz, var(--bim-ui_size-sm));
      width: var(--bim-icon--fz, var(--bim-ui_size-sm));
      color: var(--bim-icon--c);
      transition: all 0.15s;
      display: flex;
    }
  `,Qr.properties={icon:{type:String}};let mg=Qr;var bg=Object.defineProperty,Xs=(t,e,i,o)=>{for(var n=void 0,s=t.length-1,r;s>=0;s--)(r=t[s])&&(n=r(e,i,n)||n);return n&&bg(e,i,n),n};const Pu=class extends J{constructor(){super(...arguments),this.vertical=!1,this.onValueChange=new Event("change")}get value(){const e={};for(const i of this.children){const o=i;"value"in o?e[o.name||o.label]=o.value:"checked"in o&&(e[o.name||o.label]=o.checked)}return e}set value(e){const i=[...this.children];for(const o in e){const n=i.find(a=>{const l=a;return l.name===o||l.label===o});if(!n)continue;const s=n,r=e[o];typeof r=="boolean"?s.checked=r:s.value=r}}render(){return T`
      <div class="parent">
        ${this.label||this.icon?T`<bim-label .icon=${this.icon}>${this.label}</bim-label>`:null}
        <div class="input">
          <slot></slot>
        </div>
      </div>
    `}};Pu.styles=te`
    :host {
      flex: 1;
      display: block;
    }

    .parent {
      display: flex;
      flex-wrap: wrap;
      column-gap: 1rem;
      row-gap: 0.375rem;
      user-select: none;
      flex: 1;
    }

    :host(:not([vertical])) .parent {
      justify-content: space-between;
    }

    :host([vertical]) .parent {
      flex-direction: column;
    }

    .input {
      position: relative;
      overflow: hidden;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      min-height: 1.75rem;
      min-width: 3rem;
      gap: var(--bim-input--g, var(--bim-ui_size-4xs));
      padding: var(--bim-input--p, 0);
      background-color: var(--bim-input--bgc, transparent);
      border: var(--bim-input--olw, 2px) solid
        var(--bim-input--olc, transparent);
      border-radius: var(--bim-input--bdrs, var(--bim-ui_size-4xs));
      transition: all 0.15s;
    }

    :host(:not([vertical])) .input {
      flex: 1;
      justify-content: flex-end;
    }

    :host(:not([vertical])[label]) .input {
      max-width: fit-content;
    }
  `;let Co=Pu;Xs([_({type:String,reflect:!0})],Co.prototype,"name");Xs([_({type:String,reflect:!0})],Co.prototype,"label");Xs([_({type:String,reflect:!0})],Co.prototype,"icon");Xs([_({type:Boolean,reflect:!0})],Co.prototype,"vertical");/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */function Yi(t,e,i){return t?e(t):i?.(t)}/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const ea=t=>t??oe;var gg=Object.defineProperty,Ao=(t,e,i,o)=>{for(var n=void 0,s=t.length-1,r;s>=0;s--)(r=t[s])&&(n=r(e,i,n)||n);return n&&gg(e,i,n),n};const Lu=class extends J{constructor(){super(...arguments),this.labelHidden=!1,this.iconHidden=!1,this.vertical=!1,this._imgTemplate=()=>T`<img src=${ea(this.img)} .alt=${this.textContent||""} />`,this._iconTemplate=()=>T`<bim-icon .icon=${this.icon}></bim-icon>`}get value(){return this.textContent?Ys(this.textContent):this.textContent}render(){return T`
      <div class="parent" title=${this.textContent}>
        ${Yi(this.img,this._imgTemplate,()=>oe)}
        ${Yi(!this.iconHidden&&this.icon,this._iconTemplate,()=>oe)}
        <p><slot></slot></p>
      </div>
    `}};Lu.styles=te`
    :host {
      --bim-icon--c: var(--bim-label--ic);
      overflow: auto;
      color: var(--bim-label--c, var(--bim-ui_bg-contrast-60));
      font-size: var(--bim-label--fz, var(--bim-ui_size-xs));
      display: block;
      white-space: nowrap;
      transition: all 0.15s;
      user-select: none;
    }

    :host([icon]) {
      line-height: 1.1rem;
    }

    .parent {
      display: flex;
      align-items: center;
      column-gap: 0.25rem;
      row-gap: 0.125rem;
      height: 100%;
    }

    :host([vertical]) .parent {
      flex-direction: column;
    }

    .parent p {
      margin: 0;
      text-overflow: ellipsis;
      overflow: hidden;
    }

    :host([label-hidden]) .parent p,
    :host(:empty) .parent p {
      display: none;
    }

    img {
      height: 100%;
      aspect-ratio: 1;
      border-radius: 100%;
      margin-right: 0.125rem;
    }

    :host(:not([vertical])) img {
      max-height: var(
        --bim-label_icon--sz,
        calc(var(--bim-label--fz, var(--bim-ui_size-xs)) * 1.8)
      );
    }

    :host([vertical]) img {
      max-height: var(
        --bim-label_icon--sz,
        calc(var(--bim-label--fz, var(--bim-ui_size-xs)) * 4)
      );
    }
  `;let $n=Lu;Ao([_({type:String,reflect:!0})],$n.prototype,"img");Ao([_({type:Boolean,attribute:"label-hidden",reflect:!0})],$n.prototype,"labelHidden");Ao([_({type:String,reflect:!0})],$n.prototype,"icon");Ao([_({type:Boolean,attribute:"icon-hidden",reflect:!0})],$n.prototype,"iconHidden");Ao([_({type:Boolean,reflect:!0})],$n.prototype,"vertical");var yg=Object.defineProperty,vg=Object.getOwnPropertyDescriptor,Xe=(t,e,i,o)=>{for(var n=o>1?void 0:o?vg(e,i):e,s=t.length-1,r;s>=0;s--)(r=t[s])&&(n=(o?r(e,i,n):r(n))||n);return o&&n&&yg(e,i,n),n};const Mu=class extends J{constructor(){super(...arguments),this._value=0,this.vertical=!1,this.slider=!1,this._input=an(),this.onValueChange=new Event("change")}set value(e){this.setValue(e.toString())}get value(){return this._value}onChange(e){e.stopPropagation();const{value:i}=this._input;i&&this.setValue(i.value)}setValue(e){const{value:i}=this._input;let o=e;if(o=o.replace(/[^0-9.-]/g,""),o=o.replace(/(\..*)\./g,"$1"),o.endsWith(".")||(o.lastIndexOf("-")>0&&(o=o[0]+o.substring(1).replace(/-/g,"")),o==="-"||o==="-0"))return;let n=Number(o);Number.isNaN(n)||(n=this.min!==void 0?Math.max(n,this.min):n,n=this.max!==void 0?Math.min(n,this.max):n,this.value!==n&&(this._value=n,i&&(i.value=this.value.toString()),this.requestUpdate(),this.dispatchEvent(this.onValueChange)))}onBlur(){const{value:e}=this._input;e&&Number.isNaN(Number(e.value))&&(e.value=this.value.toString())}onSliderMouseDown(e){document.body.style.cursor="w-resize";const{clientX:i}=e,o=this.value;let n=!1;const s=l=>{var c;n=!0;const{clientX:d}=l,u=this.step??1,h=((c=u.toString().split(".")[1])==null?void 0:c.length)||0,p=1/(this.sensitivity??1),m=(d-i)/p;if(Math.floor(Math.abs(m))!==Math.abs(m))return;const g=o+m*u;this.setValue(g.toFixed(h))},r=()=>{this.slider=!0,this.removeEventListener("blur",r)},a=()=>{document.removeEventListener("mousemove",s),document.body.style.cursor="default",n?n=!1:(this.addEventListener("blur",r),this.slider=!1,requestAnimationFrame(()=>this.focus())),document.removeEventListener("mouseup",a)};document.addEventListener("mousemove",s),document.addEventListener("mouseup",a)}onFocus(e){e.stopPropagation();const i=o=>{o.key==="Escape"&&(this.blur(),window.removeEventListener("keydown",i))};window.addEventListener("keydown",i)}connectedCallback(){super.connectedCallback(),this.min&&this.min>this.value&&(this._value=this.min),this.max&&this.max<this.value&&(this._value=this.max)}focus(){const{value:e}=this._input;e&&e.focus()}render(){const e=T`
      ${this.pref||this.icon?T`<bim-label
            style="pointer-events: auto"
            @mousedown=${this.onSliderMouseDown}
            .icon=${this.icon}
            >${this.pref}</bim-label
          >`:null}
      <input
        ${gt(this._input)}
        type="text"
        aria-label=${this.label||this.name||"Number Input"}
        size="1"
        @input=${a=>a.stopPropagation()}
        @change=${this.onChange}
        @blur=${this.onBlur}
        @focus=${this.onFocus}
        .value=${this.value.toString()}
      />
      ${this.suffix?T`<bim-label
            style="pointer-events: auto"
            @mousedown=${this.onSliderMouseDown}
            >${this.suffix}</bim-label
          >`:null}
    `,i=this.min??-1/0,o=this.max??1/0,n=100*(this.value-i)/(o-i),s=T`
      <style>
        .slider-indicator {
          width: ${`${n}%`};
        }
      </style>
      <div class="slider" @mousedown=${this.onSliderMouseDown}>
        <div class="slider-indicator"></div>
        ${this.pref||this.icon?T`<bim-label
              style="z-index: 1; margin-right: 0.125rem"
              .icon=${this.icon}
              >${`${this.pref}: `}</bim-label
            >`:null}
        <bim-label style="z-index: 1;">${this.value}</bim-label>
        ${this.suffix?T`<bim-label style="z-index: 1;">${this.suffix}</bim-label>`:null}
      </div>
    `,r=`${this.label||this.name||this.pref?`${this.label||this.name||this.pref}: `:""}${this.value}${this.suffix??""}`;return T`
      <bim-input
        title=${r}
        .label=${this.label}
        .icon=${this.icon}
        .vertical=${this.vertical}
      >
        ${this.slider?s:e}
      </bim-input>
    `}};Mu.styles=te`
    :host {
      --bim-input--bgc: var(
        --bim-number-input--bgc,
        var(--bim-ui_bg-contrast-20)
      );
      --bim-input--olw: var(--bim-number-input--olw, 2px);
      --bim-input--olc: var(--bim-number-input--olc, transparent);
      --bim-input--bdrs: var(--bim-number-input--bdrs, var(--bim-ui_size-4xs));
      --bim-input--p: 0 0.375rem;
      flex: 1;
      display: block;
    }

    :host(:focus) {
      --bim-input--olw: var(--bim-number-input--olw, 2px);
      --bim-input--olc: var(
        --bim-number-input¡focus--c,
        var(--bim-ui_accent-base)
      );
    }

    :host(:not([slider])) bim-label {
      --bim-label--c: var(
        --bim-number-input_affixes--c,
        var(--bim-ui_bg-contrast-60)
      );
      --bim-label--fz: var(
        --bim-number-input_affixes--fz,
        var(--bim-ui_size-xs)
      );
    }

    p {
      margin: 0;
      padding: 0;
    }

    input {
      background-color: transparent;
      outline: none;
      border: none;
      padding: 0;
      flex-grow: 1;
      text-align: right;
      font-family: inherit;
      font-feature-settings: inherit;
      font-variation-settings: inherit;
      font-size: var(--bim-number-input--fz, var(--bim-ui_size-xs));
      color: var(--bim-number-input--c, var(--bim-ui_bg-contrast-100));
    }

    :host([suffix]:not([pref])) input {
      text-align: left;
    }

    :host([slider]) {
      --bim-input--p: 0;
    }

    :host([slider]) .slider {
      --bim-label--c: var(--bim-ui_bg-contrast-100);
    }

    .slider {
      position: relative;
      display: flex;
      justify-content: center;
      width: 100%;
      height: 100%;
      padding: 0 0.5rem;
    }

    .slider-indicator {
      height: 100%;
      background-color: var(--bim-ui_main-base);
      position: absolute;
      top: 0;
      left: 0;
      border-radius: var(--bim-input--bdrs, var(--bim-ui_size-4xs));
    }

    bim-input {
      display: flex;
    }

    bim-label {
      pointer-events: none;
    }
  `;let Fe=Mu;Xe([_({type:String,reflect:!0})],Fe.prototype,"name",2);Xe([_({type:String,reflect:!0})],Fe.prototype,"icon",2);Xe([_({type:String,reflect:!0})],Fe.prototype,"label",2);Xe([_({type:String,reflect:!0})],Fe.prototype,"pref",2);Xe([_({type:Number,reflect:!0})],Fe.prototype,"min",2);Xe([_({type:Number,reflect:!0})],Fe.prototype,"value",1);Xe([_({type:Number,reflect:!0})],Fe.prototype,"step",2);Xe([_({type:Number,reflect:!0})],Fe.prototype,"sensitivity",2);Xe([_({type:Number,reflect:!0})],Fe.prototype,"max",2);Xe([_({type:String,reflect:!0})],Fe.prototype,"suffix",2);Xe([_({type:Boolean,reflect:!0})],Fe.prototype,"vertical",2);Xe([_({type:Boolean,reflect:!0})],Fe.prototype,"slider",2);var wg=Object.defineProperty,$g=Object.getOwnPropertyDescriptor,ko=(t,e,i,o)=>{for(var n=o>1?void 0:o?$g(e,i):e,s=t.length-1,r;s>=0;s--)(r=t[s])&&(n=(o?r(e,i,n):r(n))||n);return o&&n&&wg(e,i,n),n};const zu=class extends J{constructor(){super(...arguments),this.onValueChange=new Event("change"),this._hidden=!1,this.headerHidden=!1,this.valueTransform={},this.activationButton=document.createElement("bim-button")}set hidden(e){this._hidden=e,this.activationButton.active=!e,this.dispatchEvent(new Event("hiddenchange"))}get hidden(){return this._hidden}get value(){return gs(this,this.valueTransform)}set value(e){const i=[...this.children];for(const o in e){const n=i.find(r=>{const a=r;return a.name===o||a.label===o});if(!n)continue;const s=n;s.value=e[o]}}animatePanles(){const e=[{maxHeight:"100vh",maxWidth:"100vw",opacity:1},{maxHeight:"100vh",maxWidth:"100vw",opacity:0},{maxHeight:0,maxWidth:0,opacity:0}];this.animate(e,{duration:300,easing:"cubic-bezier(0.65, 0.05, 0.36, 1)",direction:this.hidden?"normal":"reverse",fill:"forwards"})}connectedCallback(){super.connectedCallback(),this.activationButton.active=!this.hidden,this.activationButton.onclick=()=>{this.hidden=!this.hidden,this.animatePanles()}}disconnectedCallback(){super.disconnectedCallback(),this.activationButton.remove()}collapseSections(){const e=this.querySelectorAll("bim-panel-section");for(const i of e)i.collapsed=!0}expandSections(){const e=this.querySelectorAll("bim-panel-section");for(const i of e)i.collapsed=!1}render(){return this.activationButton.icon=this.icon,this.activationButton.label=this.label||this.name,this.activationButton.tooltipTitle=this.label||this.name,T`
      <div class="parent">
        ${this.label||this.name||this.icon?T`<bim-label .icon=${this.icon}>${this.label}</bim-label>`:null}
        <div class="sections">
          <slot></slot>
        </div>
      </div>
    `}};zu.styles=[Jt.scrollbar,te`
      :host {
        display: flex;
        border-radius: var(--bim-ui_size-base);
        background-color: var(--bim-ui_bg-base);
        overflow: auto;
      }

      :host([hidden]) {
        max-height: 0;
        max-width: 0;
        opacity: 0;
      }

      .parent {
        display: flex;
        flex: 1;
        flex-direction: column;
        pointer-events: auto;
        overflow: auto;
      }

      .parent bim-label {
        --bim-label--c: var(--bim-panel--c, var(--bim-ui_bg-contrast-80));
        --bim-label--fz: var(--bim-panel--fz, var(--bim-ui_size-sm));
        font-weight: 600;
        padding: 1rem;
        flex-shrink: 0;
        border-bottom: 1px solid var(--bim-ui_bg-contrast-20);
      }

      :host([header-hidden]) .parent bim-label {
        display: none;
      }

      .sections {
        height: 100%;
        display: flex;
        flex-direction: column;
        overflow: auto;
        flex: 1;
      }

      ::slotted(bim-panel-section:not(:last-child)) {
        border-bottom: 1px solid var(--bim-ui_bg-contrast-20);
      }
    `];let Ii=zu;ko([_({type:String,reflect:!0})],Ii.prototype,"icon",2);ko([_({type:String,reflect:!0})],Ii.prototype,"name",2);ko([_({type:String,reflect:!0})],Ii.prototype,"label",2);ko([_({type:Boolean,reflect:!0})],Ii.prototype,"hidden",1);ko([_({type:Boolean,attribute:"header-hidden",reflect:!0})],Ii.prototype,"headerHidden",2);var _g=Object.defineProperty,To=(t,e,i,o)=>{for(var n=void 0,s=t.length-1,r;s>=0;s--)(r=t[s])&&(n=r(e,i,n)||n);return n&&_g(e,i,n),n};const Du=class extends J{constructor(){super(...arguments),this.onValueChange=new Event("change"),this.valueTransform={},this.componentHeight=-1}get value(){const e=this.parentElement;let i;return e instanceof Ii&&(i=e.valueTransform),Object.values(this.valueTransform).length!==0&&(i=this.valueTransform),gs(this,i)}set value(e){const i=[...this.children];for(const o in e){const n=i.find(r=>{const a=r;return a.name===o||a.label===o});if(!n)continue;const s=n;s.value=e[o]}}setFlexAfterTransition(){var e;const i=(e=this.shadowRoot)==null?void 0:e.querySelector(".components");i&&setTimeout(()=>{this.collapsed?i.style.removeProperty("flex"):i.style.setProperty("flex","1")},150)}animateHeader(){var e;const i=(e=this.shadowRoot)==null?void 0:e.querySelector(".components");this.componentHeight<0&&(this.collapsed?this.componentHeight=i.clientHeight:(i.style.setProperty("transition","none"),i.style.setProperty("height","auto"),i.style.setProperty("padding","0.125rem 1rem 1rem"),this.componentHeight=i.clientHeight,requestAnimationFrame(()=>{i.style.setProperty("height","0px"),i.style.setProperty("padding","0 1rem 0"),i.style.setProperty("transition","height 0.25s cubic-bezier(0.65, 0.05, 0.36, 1), padding 0.25s cubic-bezier(0.65, 0.05, 0.36, 1)")}))),this.collapsed?(i.style.setProperty("height",`${this.componentHeight}px`),requestAnimationFrame(()=>{i.style.setProperty("height","0px"),i.style.setProperty("padding","0 1rem 0")})):(i.style.setProperty("height","0px"),i.style.setProperty("padding","0 1rem 0"),requestAnimationFrame(()=>{i.style.setProperty("height",`${this.componentHeight}px`),i.style.setProperty("padding","0.125rem 1rem 1rem")})),this.setFlexAfterTransition()}onHeaderClick(){this.fixed||(this.collapsed=!this.collapsed,this.animateHeader())}handelSlotChange(e){e.target.assignedElements({flatten:!0}).forEach((i,o)=>{const n=o*.05;i.style.setProperty("transition-delay",`${n}s`)})}handlePointerEnter(){const e=this.renderRoot.querySelector(".expand-icon");this.collapsed?e?.style.setProperty("animation","collapseAnim 0.5s"):e?.style.setProperty("animation","expandAnim 0.5s")}handlePointerLeave(){const e=this.renderRoot.querySelector(".expand-icon");e?.style.setProperty("animation","none")}render(){const e=this.label||this.icon||this.name||this.fixed,i=T`<svg
      xmlns="http://www.w3.org/2000/svg"
      height="1.125rem"
      viewBox="0 0 24 24"
      width="1.125rem"
      class="expand-icon"
    >
      <path d="M0 0h24v24H0z" fill="none" />
      <path d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z" />
    </svg>`,o=T`
      <div
        class="header"
        title=${this.label??""}
        @pointerenter=${this.handlePointerEnter}
        @pointerleave=${this.handlePointerLeave}
        @click=${this.onHeaderClick}
      >
        ${this.label||this.icon||this.name?T`<bim-label .icon=${this.icon}>${this.label}</bim-label>`:null}
        ${this.fixed?null:i}
      </div>
    `;return T`
      <div class="parent">
        ${e?o:null}
        <div class="components" style="flex: 1;">
          <div>
            <slot @slotchange=${this.handelSlotChange}></slot>
          </div>
        </div>
      </div>
    `}};Du.styles=[Jt.scrollbar,te`
      :host {
        display: block;
        pointer-events: auto;
      }

      :host .parent {
        display: flex;
        flex-direction: column;
        height: 100%;
      }

      :host(:not([fixed])) .header:hover {
        --bim-label--c: var(--bim-ui_accent-base);
        color: var(--bim-ui_accent-base);
        cursor: pointer;
      }

      :host(:not([fixed])) .header:hover .expand-icon {
        fill: var(--bim-ui_accent-base);
      }

      .header {
        --bim-label--fz: var(--bim-ui_size-sm);
        --bim-label--c: var(
          --bim-panel-section_hc,
          var(--bim-ui_bg-contrast-80)
        );
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-weight: 600;
        height: 1.5rem;
        padding: 0.75rem 1rem;
      }

      .expand-icon {
        fill: var(--bim-ui_bg-contrast-80);
        transition: transform 0.2s;
      }

      :host([collapsed]) .expand-icon {
        transform: rotateZ(-180deg);
      }

      .title {
        display: flex;
        align-items: center;
        column-gap: 0.5rem;
      }

      .title p {
        font-size: var(--bim-ui_size-sm);
      }

      .components {
        display: flex;
        flex-direction: column;
        overflow: hidden;
        row-gap: 0.75rem;
        padding: 0 1rem 1rem;
        box-sizing: border-box;
        transition:
          height 0.25s cubic-bezier(0.65, 0.05, 0.36, 1),
          padding 0.25s cubic-bezier(0.65, 0.05, 0.36, 1);
      }

      .components > div {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        flex: 1;
        overflow: auto;
      }

      :host(:not([icon]):not([label])) .components {
        padding: 1rem;
      }

      :host(:not([fixed])[collapsed]) .components {
        padding: 0 1rem 0;
        height: 0px;
      }

      bim-label {
        pointer-events: none;
      }

      ::slotted(*) {
        transition:
          transform 0.25s cubic-bezier(0.65, 0.05, 0.36, 1),
          opacity 0.25s cubic-bezier(0.65, 0.05, 0.36, 1);
      }

      :host(:not([fixed])[collapsed]) ::slotted(*) {
        transform: translateX(-20%);
        opacity: 0;
      }

      @keyframes expandAnim {
        0%,
        100% {
          transform: translateY(0%);
        }
        25% {
          transform: translateY(-30%);
        }
        50% {
          transform: translateY(10%);
        }
        75% {
          transform: translateY(-30%);
        }
      }

      @keyframes collapseAnim {
        0%,
        100% {
          transform: translateY(0%) rotateZ(-180deg);
        }
        25% {
          transform: translateY(30%) rotateZ(-180deg);
        }
        50% {
          transform: translateY(-10%) rotateZ(-180deg);
        }
        75% {
          transform: translateY(30%) rotateZ(-180deg);
        }
      }
    `];let _n=Du;To([_({type:String,reflect:!0})],_n.prototype,"icon");To([_({type:String,reflect:!0})],_n.prototype,"label");To([_({type:String,reflect:!0})],_n.prototype,"name");To([_({type:Boolean,reflect:!0})],_n.prototype,"fixed");To([_({type:Boolean,reflect:!0})],_n.prototype,"collapsed");var xg=Object.defineProperty,Oo=(t,e,i,o)=>{for(var n=void 0,s=t.length-1,r;s>=0;s--)(r=t[s])&&(n=r(e,i,n)||n);return n&&xg(e,i,n),n};const Ru=class extends J{constructor(){super(...arguments),this.vertical=!1,this.onValueChange=new Event("change"),this._canEmitEvents=!1,this._value=document.createElement("bim-option"),this.onOptionClick=e=>{this._value=e.target,this.setAnimatedBackgound(),this.dispatchEvent(this.onValueChange);for(const i of this.children)i instanceof ue&&(i.checked=i===e.target)}}get _options(){return[...this.querySelectorAll("bim-option")]}set value(e){const i=this.findOption(e);if(i){for(const o of this._options)o.checked=o===i;this._value=i,this.setAnimatedBackgound(),this._canEmitEvents&&this.dispatchEvent(this.onValueChange)}}get value(){return this._value.value}onSlotChange(e){const i=e.target.assignedElements();for(const o of i)o instanceof ue&&(o.noMark=!0,o.removeEventListener("click",this.onOptionClick),o.addEventListener("click",this.onOptionClick))}findOption(e){return this._options.find(i=>i instanceof ue?i.label===e||i.value===e:!1)}doubleRequestAnimationFrames(e){requestAnimationFrame(()=>requestAnimationFrame(e))}setAnimatedBackgound(e=!1){const i=this.renderRoot.querySelector(".animated-background"),o=this._value;requestAnimationFrame(()=>{var n,s,r,a;const l=(a=(r=(s=(n=o?.parentElement)==null?void 0:n.shadowRoot)==null?void 0:s.querySelector("bim-input"))==null?void 0:r.shadowRoot)==null?void 0:a.querySelector(".input"),c={width:o?.clientWidth,height:o?.clientHeight,top:(o?.offsetTop??0)-(l?.offsetTop??0),left:(o?.offsetLeft??0)-(l?.offsetLeft??0)};i?.style.setProperty("width",`${c.width}px`),i?.style.setProperty("height",`${c.height}px`),i?.style.setProperty("top",`${c.top}px`),i?.style.setProperty("left",`${c.left}px`)}),e&&this.doubleRequestAnimationFrames(()=>{const n="ease";i?.style.setProperty("transition",`width ${.3}s ${n}, height ${.3}s ${n}, top ${.3}s ${n}, left ${.3}s ${n}`)})}firstUpdated(){const e=[...this.children].find(i=>i instanceof ue&&i.checked);e&&(this._value=e),window.addEventListener("load",()=>{this.setAnimatedBackgound(!0)}),new ResizeObserver(()=>{this.setAnimatedBackgound()}).observe(this)}render(){return T`
      <bim-input
        .vertical=${this.vertical}
        .label=${this.label}
        .icon=${this.icon}
      >
        <div class="animated-background"></div>
        <slot @slotchange=${this.onSlotChange}></slot>
      </bim-input>
    `}};Ru.styles=te`
    :host {
      --bim-input--bgc: var(--bim-ui_bg-contrast-20);
      --bim-input--g: 0;
      --bim-option--jc: center;
      flex: 1;
      display: block;
    }

    ::slotted(bim-option) {
      position: relative;
      border-radius: 0;
      overflow: hidden;
      min-width: min-content;
      min-height: min-content;
      transition: background-color 0.2s;
    }

    .animated-background {
      position: absolute;
      background: var(--bim-ui_main-base);
      width: 0;
      height: 0;
      top: 0;
      left: 0;
    }

    ::slotted(bim-option[checked]) {
      --bim-label--c: var(--bim-ui_main-contrast);
    }

    ::slotted(bim-option:not([checked]):hover) {
      background-color: #0003;
    }
  `;let xn=Ru;Oo([_({type:String,reflect:!0})],xn.prototype,"name");Oo([_({type:String,reflect:!0})],xn.prototype,"icon");Oo([_({type:String,reflect:!0})],xn.prototype,"label");Oo([_({type:Boolean,reflect:!0})],xn.prototype,"vertical");Oo([Ti()],xn.prototype,"_value");const Eg=()=>T`
    <style>
      div {
        display: flex;
        gap: 0.375rem;
        border-radius: 0.25rem;
        min-height: 1.25rem;
      }

      [data-type="row"] {
        background-color: var(--bim-ui_bg-contrast-10);
        animation: row-loading 1s linear infinite alternate;
        padding: 0.5rem;
      }

      [data-type="cell"] {
        background-color: var(--bim-ui_bg-contrast-20);
        flex: 0.25;
      }

      @keyframes row-loading {
        0% {
          background-color: var(--bim-ui_bg-contrast-10);
        }
        100% {
          background-color: var(--bim-ui_bg-contrast-20);
        }
      }
    </style>
    <div style="display: flex; flex-direction: column;">
      <div data-type="row" style="gap: 2rem">
        <div data-type="cell" style="flex: 1"></div>
        <div data-type="cell" style="flex: 2"></div>
        <div data-type="cell" style="flex: 1"></div>
        <div data-type="cell" style="flex: 0.5"></div>
      </div>
      <div style="display: flex;">
        <div data-type="row" style="flex: 1">
          <div data-type="cell" style="flex: 0.5"></div>
        </div>
        <div data-type="row" style="flex: 2">
          <div data-type="cell" style="flex: 0.75"></div>
        </div>
        <div data-type="row" style="flex: 1">
          <div data-type="cell"></div>
        </div>
        <div data-type="row" style="flex: 0.5">
          <div data-type="cell" style="flex: 0.75"></div>
        </div>
      </div>
      <div style="display: flex;">
        <div data-type="row" style="flex: 1">
          <div data-type="cell" style="flex: 0.75"></div>
        </div>
        <div data-type="row" style="flex: 2">
          <div data-type="cell"></div>
        </div>
        <div data-type="row" style="flex: 1">
          <div data-type="cell" style="flex: 0.5"></div>
        </div>
        <div data-type="row" style="flex: 0.5">
          <div data-type="cell" style="flex: 0.5"></div>
        </div>
      </div>
      <div style="display: flex;">
        <div data-type="row" style="flex: 1">
          <div data-type="cell"></div>
        </div>
        <div data-type="row" style="flex: 2">
          <div data-type="cell" style="flex: 0.5"></div>
        </div>
        <div data-type="row" style="flex: 1">
          <div data-type="cell" style="flex: 0.75"></div>
        </div>
        <div data-type="row" style="flex: 0.5">
          <div data-type="cell" style="flex: 0.7s5"></div>
        </div>
      </div>
    </div>
  `,Sg=()=>T`
    <style>
      .loader {
        grid-area: Processing;
        position: relative;
        padding: 0.125rem;
      }
      .loader:before {
        content: "";
        position: absolute;
      }
      .loader .loaderBar {
        position: absolute;
        top: 0;
        right: 100%;
        bottom: 0;
        left: 0;
        background: var(--bim-ui_main-base);
        /* width: 25%; */
        width: 0;
        animation: borealisBar 2s linear infinite;
      }

      @keyframes borealisBar {
        0% {
          left: 0%;
          right: 100%;
          width: 0%;
        }
        10% {
          left: 0%;
          right: 75%;
          width: 25%;
        }
        90% {
          right: 0%;
          left: 75%;
          width: 25%;
        }
        100% {
          left: 100%;
          right: 0%;
          width: 0%;
        }
      }
    </style>
    <div class="loader">
      <div class="loaderBar"></div>
    </div>
  `;var Cg=Object.defineProperty,Ag=(t,e,i,o)=>{for(var n=void 0,s=t.length-1,r;s>=0;s--)(r=t[s])&&(n=r(e,i,n)||n);return n&&Cg(e,i,n),n};const ju=class extends J{constructor(){super(...arguments),this.column="",this.columnIndex=0,this.table=null,this.group=null,this.row=null,this.rowData={}}get data(){return this.column?this.rowData[this.column]:null}get dataTransform(){var e,i,o,n;const s=(i=(e=this.row)==null?void 0:e.dataTransform)==null?void 0:i[this.column],r=(o=this.table)==null?void 0:o.dataTransform[this.column],a=(n=this.table)==null?void 0:n.defaultContentTemplate;return s||r||a}get templateValue(){const{data:e,rowData:i,group:o}=this,n=this.dataTransform;if(n&&e!=null&&o){const s=n(e,i,o);return typeof s=="string"||typeof s=="boolean"||typeof s=="number"?T`<bim-label>${s}</bim-label>`:s}return e!=null?T`<bim-label>${e}</bim-label>`:oe}connectedCallback(){super.connectedCallback(),this.style.gridArea=this.column.toString()}render(){return T`${this.templateValue}`}};ju.styles=te`
    :host {
      padding: 0.375rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    :host([data-column-index="0"]) {
      justify-content: normal;
    }

    :host([data-column-index="0"]:not([data-cell-header]))
      ::slotted(bim-label) {
      text-align: left;
    }

    ::slotted(*) {
      --bim-input--bgc: transparent;
      --bim-input--olc: var(--bim-ui_bg-contrast-20);
      --bim-input--olw: 1px;
    }

    ::slotted(bim-input) {
      --bim-input--olw: 0;
    }
  `;let Nu=ju;Ag([_({type:String,reflect:!0})],Nu.prototype,"column");const Bu=class extends J{constructor(){super(...arguments),this._groups=[],this.group=this.closest("bim-table-group"),this._data=[],this.table=this.closest("bim-table")}get data(){var e;return((e=this.group)==null?void 0:e.data.children)??this._data}set data(e){this._data=e}clean(){for(const e of this._groups)e.remove();this._groups=[]}render(){return this.clean(),T`
      <slot></slot>
      ${this.data.map(e=>{const i=document.createElement("bim-table-group");return this._groups.push(i),i.table=this.table,i.data=e,i})}
    `}};Bu.styles=te`
    :host {
      --bim-button--bgc: transparent;
      position: relative;
      display: block;
      overflow: hidden;
      grid-area: Children;
    }

    :host([hidden]) {
      height: 0;
      opacity: 0;
    }

    ::slotted(.branch.branch-vertical) {
      top: 0;
      bottom: 1.125rem;
    }
  `;let kg=Bu;/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Fu="important",Tg=" !"+Fu,yc=Qd(class extends eu{constructor(t){var e;if(super(t),t.type!==Kd.ATTRIBUTE||t.name!=="style"||((e=t.strings)==null?void 0:e.length)>2)throw Error("The `styleMap` directive must be used in the `style` attribute and must be the only part in the attribute.")}render(t){return Object.keys(t).reduce((e,i)=>{const o=t[i];return o==null?e:e+`${i=i.includes("-")?i:i.replace(/(?:^(webkit|moz|ms|o)|)(?=[A-Z])/g,"-$&").toLowerCase()}:${o};`},"")}update(t,[e]){const{style:i}=t.element;if(this.ft===void 0)return this.ft=new Set(Object.keys(e)),this.render(e);for(const o of this.ft)e[o]==null&&(this.ft.delete(o),o.includes("-")?i.removeProperty(o):i[o]=null);for(const o in e){const n=e[o];if(n!=null){this.ft.add(o);const s=typeof n=="string"&&n.endsWith(Tg);o.includes("-")||s?i.setProperty(o,s?n.slice(0,-11):n,s?Fu:""):i[o]=n}}return Ei}});var Og=Object.defineProperty,Ig=(t,e,i,o)=>{for(var n=void 0,s=t.length-1,r;s>=0;s--)(r=t[s])&&(n=r(e,i,n)||n);return n&&Og(e,i,n),n};const Uu=class extends J{constructor(){super(...arguments),this.childrenHidden=!0,this.table=null,this.data={data:{}}}get rowElement(){const e=this.shadowRoot;return e?e.querySelector("bim-table-row"):null}get childrenElement(){const e=this.shadowRoot;return e?e.querySelector("bim-table-children"):null}get _isChildrenEmpty(){return!(this.data.children&&this.data.children.length!==0)}connectedCallback(){super.connectedCallback(),this.table&&this.table.expanded?this.childrenHidden=!1:this.childrenHidden=!0}disconnectedCallback(){super.disconnectedCallback(),this.data={data:{}}}toggleChildren(e){this.childrenHidden=typeof e>"u"?!this.childrenHidden:!e,this.animateTableChildren(!0)}animateTableChildren(e=!0){if(!e){requestAnimationFrame(()=>{var r;const a=this.renderRoot.querySelector(".caret"),l=this.renderRoot.querySelector(".branch-vertical"),c=(r=this.renderRoot.querySelector("bim-table-children"))==null?void 0:r.querySelector(".branch-vertical");a.style.setProperty("transform",`translateY(-50%) rotate(${this.childrenHidden?"0":"90"}deg)`),l.style.setProperty("transform",`scaleY(${this.childrenHidden?"0":"1"})`),c?.style.setProperty("transform",`scaleY(${this.childrenHidden?"0":"1"})`)});return}const i=500,o=0,n=200,s=350;requestAnimationFrame(()=>{var r;const a=this.renderRoot.querySelector("bim-table-children"),l=this.renderRoot.querySelector(".caret"),c=this.renderRoot.querySelector(".branch-vertical"),d=(r=this.renderRoot.querySelector("bim-table-children"))==null?void 0:r.querySelector(".branch-vertical"),u=()=>{var f;const v=(f=a?.renderRoot)==null?void 0:f.querySelectorAll("bim-table-group");v?.forEach((y,b)=>{y.style.setProperty("opacity","0"),y.style.setProperty("left","-30px");const $=[{opacity:"0",left:"-30px"},{opacity:"1",left:"0"}];y.animate($,{duration:i/2,delay:50+b*o,easing:"cubic-bezier(0.65, 0.05, 0.36, 1)",fill:"forwards"})})},h=()=>{const f=[{transform:"translateY(-50%) rotate(90deg)"},{transform:"translateY(-50%) rotate(0deg)"}];l?.animate(f,{duration:s,easing:"cubic-bezier(0.68, -0.55, 0.27, 1.55)",fill:"forwards",direction:this.childrenHidden?"normal":"reverse"})},p=()=>{const f=[{transform:"scaleY(1)"},{transform:"scaleY(0)"}];c?.animate(f,{duration:n,easing:"cubic-bezier(0.4, 0, 0.2, 1)",delay:o,fill:"forwards",direction:this.childrenHidden?"normal":"reverse"})},m=()=>{var f;const v=(f=this.renderRoot.querySelector("bim-table-row"))==null?void 0:f.querySelector(".branch-horizontal");if(v){v.style.setProperty("transform-origin","center right");const y=[{transform:"scaleX(0)"},{transform:"scaleX(1)"}];v.animate(y,{duration:n,easing:"cubic-bezier(0.4, 0, 0.2, 1)",fill:"forwards",direction:this.childrenHidden?"normal":"reverse"})}},g=()=>{const f=[{transform:"scaleY(0)"},{transform:"scaleY(1)"}];d?.animate(f,{duration:n*1.2,easing:"cubic-bezier(0.4, 0, 0.2, 1)",fill:"forwards",delay:(o+n)*.7})};u(),h(),p(),m(),g()})}firstUpdated(){this.renderRoot.querySelectorAll(".caret").forEach(e=>{var i,o,n;if(!this.childrenHidden){e.style.setProperty("transform","translateY(-50%) rotate(90deg)");const s=(i=e.parentElement)==null?void 0:i.querySelector(".branch-horizontal");s&&s.style.setProperty("transform","scaleX(0)");const r=(n=(o=e.parentElement)==null?void 0:o.parentElement)==null?void 0:n.querySelectorAll(".branch-vertical");r?.forEach(a=>{a.style.setProperty("transform","scaleY(1)")})}})}render(){if(!this.table)return T`${oe}`;const e=this.table.getGroupIndentation(this.data)??0;let i;if(!this.table.noIndentation){const r={left:`${e-1+(this.table.selectableRows?2.05:.5625)}rem`};i=T`<div style=${yc(r)} class="branch branch-horizontal"></div>`}const o=T`
      ${this.table.noIndentation?null:T`
            <style>
              .branch-vertical {
                left: ${e+(this.table.selectableRows?1.9375:.5625)}rem;
              }
            </style>
            <div class="branch branch-vertical"></div>
          `}
    `;let n;if(!this.table.noIndentation){const r=document.createElementNS("http://www.w3.org/2000/svg","svg");if(r.setAttribute("height","9.9"),r.setAttribute("width","7.5"),r.setAttribute("viewBox","0 0 4.6666672 7.7"),this.table.noCarets){const l=document.createElementNS("http://www.w3.org/2000/svg","circle");l.setAttribute("cx","2.3333336"),l.setAttribute("cy","3.85"),l.setAttribute("r","2.5"),r.append(l)}else{const l=document.createElementNS("http://www.w3.org/2000/svg","path");l.setAttribute("d","m 1.7470835,6.9583848 2.5899999,-2.59 c 0.39,-0.39 0.39,-1.02 0,-1.41 L 1.7470835,0.36838483 c -0.63,-0.62000003 -1.71000005,-0.18 -1.71000005,0.70999997 v 5.17 c 0,0.9 1.08000005,1.34 1.71000005,0.71 z"),r.append(l)}const a={left:`${(this.table.selectableRows?1.5:.125)+e}rem`,cursor:`${this.table.noCarets?"unset":"pointer"}`};n=T`<div @click=${l=>{var c;(c=this.table)!=null&&c.noCarets||(l.stopPropagation(),this.toggleChildren())}} style=${yc(a)} class="caret">${r}</div>`}let s;return!this._isChildrenEmpty&&!this.childrenHidden&&(s=T`
        <bim-table-children ${gt(r=>{if(!r)return;const a=r;a.table=this.table,a.group=this})}>${o}</bim-table-children>
      `),T`
      <div class="parent">
        <bim-table-row ${gt(r=>{var a;if(!r)return;const l=r;l.table=this.table,l.group=this,(a=this.table)==null||a.dispatchEvent(new CustomEvent("rowcreated",{detail:{row:l}}))})}>
          ${Yi(!this._isChildrenEmpty,()=>o)}
          ${Yi(e!==0,()=>i)}
          ${Yi(!this.table.noIndentation&&!this._isChildrenEmpty,()=>n)}
        </bim-table-row>
        ${s}
      </div>
    `}};Uu.styles=te`
    :host {
      position: relative;
    }

    .parent {
      display: grid;
      grid-template-areas: "Data" "Children";
    }

    .branch {
      position: absolute;
      z-index: 1;
    }

    .branch-vertical {
      border-left: 1px dotted var(--bim-ui_bg-contrast-40);
      transform-origin: top center;
      transform: scaleY(0);
    }

    .branch-horizontal {
      top: 50%;
      width: 1rem;
      border-bottom: 1px dotted var(--bim-ui_bg-contrast-40);
    }

    .branch-horizontal {
      transform-origin: center left;
    }

    .caret {
      position: absolute;
      z-index: 2;
      transform: translateY(-50%) rotate(0deg);
      top: 50%;
      display: flex;
      width: 0.95rem;
      height: 0.95rem;
      justify-content: center;
      align-items: center;
    }

    .caret svg {
      fill: var(--bim-ui_bg-contrast-60);
    }
  `;let Hu=Uu;Ig([_({type:Boolean,attribute:"children-hidden",reflect:!0})],Hu.prototype,"childrenHidden");var Pg=Object.defineProperty,En=(t,e,i,o)=>{for(var n=void 0,s=t.length-1,r;s>=0;s--)(r=t[s])&&(n=r(e,i,n)||n);return n&&Pg(e,i,n),n};const Vu=class extends J{constructor(){super(...arguments),this.selected=!1,this.columns=[],this.hiddenColumns=[],this.group=null,this._data={},this.isHeader=!1,this.table=null,this.onTableColumnsChange=()=>{this.table&&(this.columns=this.table.columns)},this.onTableColumnsHidden=()=>{this.table&&(this.hiddenColumns=this.table.hiddenColumns)},this._intersecting=!1,this._timeOutDelay=250,this._observer=new IntersectionObserver(e=>{window.clearTimeout(this._intersectTimeout),this._intersectTimeout=void 0,e[0].isIntersecting?this._intersectTimeout=window.setTimeout(()=>{this._intersecting=!0},this._timeOutDelay):this._intersecting=!1},{rootMargin:"36px"}),this.dataTransform=null,this._interval=null,this.clearDataTransform=()=>{this.dataTransform=null,this._interval!==null&&(clearInterval(this._interval),this._interval=null)},this._cache={}}get groupData(){var e;return(e=this.group)==null?void 0:e.data}get data(){var e;return((e=this.group)==null?void 0:e.data.data)??this._data}set data(e){this._data=e}get _columnNames(){return this.columns.filter(e=>!this.hiddenColumns.includes(e.name)).map(e=>e.name)}get _columnWidths(){return this.columns.filter(e=>!this.hiddenColumns.includes(e.name)).map(e=>e.width)}get _isSelected(){var e;return(e=this.table)==null?void 0:e.selection.has(this.data)}onSelectionChange(e){if(!this.table)return;const i=e.target;this.selected=i.value,i.value?(this.table.selection.add(this.data),this.table.dispatchEvent(new CustomEvent("rowselected",{detail:{data:this.data}}))):(this.table.selection.delete(this.data),this.table.dispatchEvent(new CustomEvent("rowdeselected",{detail:{data:this.data}})))}firstUpdated(e){super.firstUpdated(e),this._observer.observe(this)}connectedCallback(){super.connectedCallback(),this.toggleAttribute("selected",this._isSelected),this.table&&(this.columns=this.table.columns,this.hiddenColumns=this.table.hiddenColumns,this.table.addEventListener("columnschange",this.onTableColumnsChange),this.table.addEventListener("columnshidden",this.onTableColumnsHidden),this.style.gridTemplateAreas=`"${this.table.selectableRows?"Selection":""} ${this._columnNames.join(" ")}"`,this.style.gridTemplateColumns=`${this.table.selectableRows?"1.6rem":""} ${this._columnWidths.join(" ")}`)}disconnectedCallback(){super.disconnectedCallback(),this._observer.unobserve(this),this.columns=[],this.hiddenColumns=[],this.toggleAttribute("selected",!1),this.data={},this.table&&(this.table.removeEventListener("columnschange",this.onTableColumnsChange),this.table.removeEventListener("columnshidden",this.onTableColumnsHidden),this.table=null),this.clean()}applyAdaptativeDataTransform(e){this.addEventListener("pointerenter",()=>{this.dataTransform=e,this._interval=window.setInterval(()=>{this.matches(":hover")||this.clearDataTransform()},50)})}clean(){clearTimeout(this._intersectTimeout),this._intersectTimeout=void 0,this._timeOutDelay=250;for(const[,e]of Object.entries(this._cache))e.remove();this._cache={}}render(){if(!(this.table&&this._intersecting))return T`${oe}`;const e=this.table.getRowIndentation(this.data)??0,i=[];for(const o in this.data){if(this.hiddenColumns.includes(o))continue;const n=document.createElement("bim-table-cell");n.group=this.group,n.table=this.table,n.row=this,n.column=o,this._columnNames.indexOf(o)===0&&(n.style.marginLeft=`${this.table.noIndentation?0:e+.75}rem`);const s=this._columnNames.indexOf(o);n.setAttribute("data-column-index",String(s)),n.toggleAttribute("data-no-indentation",s===0&&this.table.noIndentation),n.toggleAttribute("data-cell-header",this.isHeader),n.rowData=this.data,this.table.dispatchEvent(new CustomEvent("cellcreated",{detail:{cell:n}})),i.push(n)}return this._timeOutDelay=0,T`
      ${!this.isHeader&&this.table.selectableRows?T`<bim-checkbox
            @change=${this.onSelectionChange}
            .checked=${this._isSelected??!1}
            style="align-self: center; justify-self: center"
          ></bim-checkbox>`:null}
      ${i}
      <slot></slot>
    `}};Vu.styles=te`
    :host {
      position: relative;
      grid-area: Data;
      display: grid;
      min-height: 2.25rem;
      transition: all 0.15s;
    }

    ::slotted(.branch.branch-vertical) {
      top: 50%;
      bottom: 0;
    }

    :host([selected]) {
      background-color: color-mix(
        in lab,
        var(--bim-ui_bg-contrast-20) 30%,
        var(--bim-ui_accent-base) 10%
      );
    }
  `;let Pi=Vu;En([_({type:Boolean,reflect:!0})],Pi.prototype,"selected");En([_({attribute:!1})],Pi.prototype,"columns");En([_({attribute:!1})],Pi.prototype,"hiddenColumns");En([_({type:Boolean,attribute:"is-header",reflect:!0})],Pi.prototype,"isHeader");En([Ti()],Pi.prototype,"_intersecting");En([Ti()],Pi.prototype,"dataTransform");var Lg=Object.defineProperty,Mg=Object.getOwnPropertyDescriptor,Ze=(t,e,i,o)=>{for(var n=o>1?void 0:o?Mg(e,i):e,s=t.length-1,r;s>=0;s--)(r=t[s])&&(n=(o?r(e,i,n):r(n))||n);return o&&n&&Lg(e,i,n),n};const qu=class extends J{constructor(){super(...arguments),this._filteredData=[],this.headersHidden=!1,this.minColWidth="4rem",this._columns=[],this._textDelimiters={comma:",",tab:"	"},this._queryString=null,this._data=[],this.expanded=!1,this.preserveStructureOnFilter=!1,this.indentationInText=!1,this.dataTransform={},this.selectableRows=!1,this.selection=new Set,this.noIndentation=!1,this.noCarets=!1,this.loading=!1,this._errorLoading=!1,this._onColumnsHidden=new Event("columnshidden"),this._hiddenColumns=[],this.defaultContentTemplate=e=>T`<bim-label style="white-space: normal; user-select: text;">${e}</bim-label>`,this._stringFilterFunction=(e,i)=>Object.values(i.data).some(o=>String(o).toLowerCase().includes(e.toLowerCase())),this._queryFilterFunction=(e,i)=>{let o=!1;const n=Kr(e)??[];for(const s of n){if("queries"in s){o=!1;break}const{condition:r,value:a}=s;let{key:l}=s;if(l.startsWith("[")&&l.endsWith("]")){const c=l.replace("[","").replace("]","");l=c,o=Object.keys(i.data).filter(d=>d.includes(c)).map(d=>gc(i.data[d],r,a)).some(d=>d)}else o=gc(i.data[l],r,a);if(!o)break}return o}}set columns(e){const i=[];for(const o of e){const n=typeof o=="string"?{name:o,width:`minmax(${this.minColWidth}, 1fr)`}:o;i.push(n)}this._columns=i,this.computeMissingColumns(this.data),this.dispatchEvent(new Event("columnschange"))}get columns(){return this._columns}get _headerRowData(){const e={};for(const i of this.columns){const{name:o}=i;e[o]=String(o)}return e}get value(){return this._filteredData}set queryString(e){this.toggleAttribute("data-processing",!0),this._queryString=e&&e.trim()!==""?e.trim():null,this.updateFilteredData(),this.toggleAttribute("data-processing",!1)}get queryString(){return this._queryString}set data(e){this._data=e,this.updateFilteredData(),this.computeMissingColumns(e)&&(this.columns=this._columns)}get data(){return this._data}get dataAsync(){return new Promise(e=>{setTimeout(()=>{e(this.data)})})}set hiddenColumns(e){this._hiddenColumns=e,setTimeout(()=>{this.dispatchEvent(this._onColumnsHidden)})}get hiddenColumns(){return this._hiddenColumns}updateFilteredData(){this.queryString?(Kr(this.queryString)?(this.filterFunction=this._queryFilterFunction,this._filteredData=this.filter(this.queryString)):(this.filterFunction=this._stringFilterFunction,this._filteredData=this.filter(this.queryString)),this.preserveStructureOnFilter&&(this._expandedBeforeFilter===void 0&&(this._expandedBeforeFilter=this.expanded),this.expanded=!0)):(this.preserveStructureOnFilter&&this._expandedBeforeFilter!==void 0&&(this.expanded=this._expandedBeforeFilter,this._expandedBeforeFilter=void 0),this._filteredData=this.data)}computeMissingColumns(e){let i=!1;for(const o of e){const{children:n,data:s}=o;for(const r in s)this._columns.map(a=>typeof a=="string"?a:a.name).includes(r)||(this._columns.push({name:r,width:`minmax(${this.minColWidth}, 1fr)`}),i=!0);if(n){const r=this.computeMissingColumns(n);r&&!i&&(i=r)}}return i}generateText(e="comma",i=this.value,o="",n=!0){const s=this._textDelimiters[e];let r="";const a=this.columns.map(l=>l.name);if(n){this.indentationInText&&(r+=`Indentation${s}`);const l=`${a.join(s)}
`;r+=l}for(const[l,c]of i.entries()){const{data:d,children:u}=c,h=this.indentationInText?`${o}${l+1}${s}`:"",p=a.map(g=>d[g]??""),m=`${h}${p.join(s)}
`;r+=m,u&&(r+=this.generateText(e,c.children,`${o}${l+1}.`,!1))}return r}get csv(){return this.generateText("comma")}get tsv(){return this.generateText("tab")}applyDataTransform(e){const i={};if(!e)return i;const{data:o}=e.data;for(const s of Object.keys(this.dataTransform)){const r=this.columns.find(a=>a.name===s);r&&r.forceDataTransform&&(s in o||(o[s]=""))}const n=o;for(const s in n){const r=this.dataTransform[s];r?i[s]=r(n[s],o,e):i[s]=o[s]}return i}downloadData(e="BIM Table Data",i="json"){let o=null;if(i==="json"&&(o=new File([JSON.stringify(this.value,void 0,2)],`${e}.json`)),i==="csv"&&(o=new File([this.csv],`${e}.csv`)),i==="tsv"&&(o=new File([this.tsv],`${e}.tsv`)),!o)return;const n=document.createElement("a");n.href=URL.createObjectURL(o),n.download=o.name,n.click(),URL.revokeObjectURL(n.href)}getRowIndentation(e,i=this.value,o=0){for(const n of i){if(n.data===e)return o;if(n.children){const s=this.getRowIndentation(e,n.children,o+1);if(s!==null)return s}}return null}getGroupIndentation(e,i=this.value,o=0){for(const n of i){if(n===e)return o;if(n.children){const s=this.getGroupIndentation(e,n.children,o+1);if(s!==null)return s}}return null}connectedCallback(){super.connectedCallback(),this.dispatchEvent(new Event("connected"))}disconnectedCallback(){super.disconnectedCallback(),this.dispatchEvent(new Event("disconnected"))}async loadData(e=!1){if(this._filteredData.length!==0&&!e||!this.loadFunction)return!1;this.loading=!0;try{const i=await this.loadFunction();return this.data=i,this.loading=!1,this._errorLoading=!1,!0}catch(i){if(this.loading=!1,this._filteredData.length!==0)return!1;const o=this.querySelector("[slot='error-loading']"),n=o?.querySelector("[data-table-element='error-message']");return i instanceof Error&&n&&i.message.trim()!==""&&(n.textContent=i.message),this._errorLoading=!0,!1}}filter(e,i=this.filterFunction??this._stringFilterFunction,o=this.data){const n=[];for(const s of o)if(i(e,s)){if(this.preserveStructureOnFilter){const r={data:s.data};if(s.children){const a=this.filter(e,i,s.children);a.length&&(r.children=a)}n.push(r)}else if(n.push({data:s.data}),s.children){const r=this.filter(e,i,s.children);n.push(...r)}}else if(s.children){const r=this.filter(e,i,s.children);this.preserveStructureOnFilter&&r.length?n.push({data:s.data,children:r}):n.push(...r)}return n}get _missingDataElement(){return this.querySelector("[slot='missing-data']")}render(){if(this.loading)return Eg();if(this._errorLoading)return T`<slot name="error-loading"></slot>`;if(this._filteredData.length===0&&this._missingDataElement)return T`<slot name="missing-data"></slot>`;const e=o=>{if(!o)return;const n=o;n.table=this,n.data=this._headerRowData},i=o=>{if(!o)return;const n=o;n.table=this,n.data=this.value,n.requestUpdate()};return T`
      <div class="parent">
        ${Sg()}
        ${Yi(!this.headersHidden,()=>T`<bim-table-row is-header style="grid-area: Header; position: sticky; top: 0; z-index: 5" ${gt(e)}></bim-table-row>`)} 
        <div style="overflow-x: hidden; grid-area: Body">
          <bim-table-children ${gt(i)} style="grid-area: Body; background-color: transparent"></bim-table-children>
        </div>
      </div>
    `}};qu.styles=[Jt.scrollbar,te`
      :host {
        position: relative;
        overflow: auto;
        display: block;
        pointer-events: auto;
      }

      :host(:not([data-processing])) .loader {
        display: none;
      }

      .parent {
        display: grid;
        grid-template:
          "Header" auto
          "Processing" auto
          "Body" 1fr
          "Footer" auto;
        overflow: auto;
        height: 100%;
      }

      .parent > bim-table-row[is-header] {
        color: var(--bim-table_header--c, var(--bim-ui_bg-contrast-100));
        background-color: var(
          --bim-table_header--bgc,
          var(--bim-ui_bg-contrast-20)
        );
      }

      .controls {
        display: flex;
        gap: 0.375rem;
        flex-wrap: wrap;
        margin-bottom: 0.5rem;
      }
    `];let Ue=qu;Ze([Ti()],Ue.prototype,"_filteredData",2);Ze([_({type:Boolean,attribute:"headers-hidden",reflect:!0})],Ue.prototype,"headersHidden",2);Ze([_({type:String,attribute:"min-col-width",reflect:!0})],Ue.prototype,"minColWidth",2);Ze([_({type:Array,attribute:!1})],Ue.prototype,"columns",1);Ze([_({type:Array,attribute:!1})],Ue.prototype,"data",1);Ze([_({type:Boolean,reflect:!0})],Ue.prototype,"expanded",2);Ze([_({type:Boolean,reflect:!0,attribute:"selectable-rows"})],Ue.prototype,"selectableRows",2);Ze([_({attribute:!1})],Ue.prototype,"selection",2);Ze([_({type:Boolean,attribute:"no-indentation",reflect:!0})],Ue.prototype,"noIndentation",2);Ze([_({type:Boolean,attribute:"no-carets",reflect:!0})],Ue.prototype,"noCarets",2);Ze([_({type:Boolean,reflect:!0})],Ue.prototype,"loading",2);Ze([Ti()],Ue.prototype,"_errorLoading",2);var zg=Object.defineProperty,Dg=Object.getOwnPropertyDescriptor,Sn=(t,e,i,o)=>{for(var n=o>1?void 0:o?Dg(e,i):e,s=t.length-1,r;s>=0;s--)(r=t[s])&&(n=(o?r(e,i,n):r(n))||n);return o&&n&&zg(e,i,n),n};const Gu=class extends J{constructor(){super(...arguments),this._switchers=[],this.bottom=!1,this.switchersHidden=!1,this.floating=!1,this.switchersFull=!1,this.onTabHiddenChange=e=>{const i=e.target;i instanceof Pe&&!i.hidden&&(i.removeEventListener("hiddenchange",this.onTabHiddenChange),this.tab=i.name,i.addEventListener("hiddenchange",this.onTabHiddenChange))}}set tab(e){this._tab=e;const i=[...this.children],o=i.find(n=>n instanceof Pe&&n.name===e);for(const n of i){if(!(n instanceof Pe))continue;n.hidden=o!==n;const s=this.getTabSwitcher(n.name);s&&s.toggleAttribute("data-active",!n.hidden)}o||(this._tab="hidden",this.setAttribute("tab","hidden"))}get tab(){return this._tab}getTabSwitcher(e){return this._switchers.find(i=>i.getAttribute("data-name")===e)}createSwitchers(){this._switchers=[];for(const e of this.children){if(!(e instanceof Pe))continue;const i=document.createElement("div");i.addEventListener("click",()=>{this.tab===e.name?this.toggleAttribute("tab",!1):this.tab=e.name,this.setAnimatedBackgound()}),i.setAttribute("data-name",e.name),i.className="switcher";const o=document.createElement("bim-label");o.textContent=e.label??null,o.icon=e.icon,i.append(o),this._switchers.push(i)}}updateSwitchers(){for(const e of this.children){if(!(e instanceof Pe))continue;const i=this._switchers.find(n=>n.getAttribute("data-name")===e.name);if(!i)continue;const o=i.querySelector("bim-label");o&&(o.textContent=e.label??null,o.icon=e.icon)}}onSlotChange(e){this.createSwitchers();const i=e.target.assignedElements(),o=i.find(n=>n instanceof Pe?this.tab?n.name===this.tab:!n.hidden:!1);o&&o instanceof Pe&&(this.tab=o.name);for(const n of i){if(!(n instanceof Pe)){n.remove();continue}n.removeEventListener("hiddenchange",this.onTabHiddenChange),o!==n&&(n.hidden=!0),n.addEventListener("hiddenchange",this.onTabHiddenChange)}}doubleRequestAnimationFrames(e){requestAnimationFrame(()=>requestAnimationFrame(e))}setAnimatedBackgound(e=!1){var i;const o=this.renderRoot.querySelector(".animated-background"),n=[...((i=this.renderRoot.querySelector(".switchers"))==null?void 0:i.querySelectorAll(".switcher"))||[]].filter(s=>s.hasAttribute("data-active"))[0];requestAnimationFrame(()=>{var s,r,a,l;const c=(l=(a=(r=(s=n?.parentElement)==null?void 0:s.shadowRoot)==null?void 0:r.querySelector("bim-input"))==null?void 0:a.shadowRoot)==null?void 0:l.querySelector(".input"),d={width:n?.clientWidth,height:n?.clientHeight,top:(n?.offsetTop??0)-(c?.offsetTop??0),left:(n?.offsetLeft??0)-(c?.offsetLeft??0)};n?(o?.style.setProperty("width",`${d.width}px`),o?.style.setProperty("height",`${d.height}px`),o?.style.setProperty("left",`${d.left}px`)):o?.style.setProperty("width","0"),this.bottom?(o?.style.setProperty("top","100%"),o?.style.setProperty("transform","translateY(-100%)")):o?.style.setProperty("top",`${d.top}px`)}),e&&this.doubleRequestAnimationFrames(()=>{const s="ease";o?.style.setProperty("transition",`width ${.3}s ${s}, height ${.3}s ${s}, top ${.3}s ${s}, left ${.3}s ${s}`)})}firstUpdated(){requestAnimationFrame(()=>{this.setAnimatedBackgound(!0)}),new ResizeObserver(()=>{this.setAnimatedBackgound()}).observe(this)}render(){return T`
      <div class="parent">
        <div class="switchers">
          <div class="animated-background"></div>
          ${this._switchers}
        </div>
        <div class="content">
          <slot @slotchange=${this.onSlotChange}></slot>
        </div>
      </div>
    `}};Gu.styles=[Jt.scrollbar,te`
      * {
        box-sizing: border-box;
      }

      :host {
        background-color: var(--bim-ui_bg-base);
        display: block;
        overflow: auto;
      }

      .parent {
        display: grid;
        overflow: hidden;
        position: relative;
        grid-template: "switchers" auto "content" 1fr;
        height: 100%;
      }

      :host([bottom]) .parent {
        grid-template: "content" 1fr "switchers" auto;
      }

      .switchers {
        position: relative;
        display: flex;
        height: 2.25rem;
        font-weight: 600;
        grid-area: switchers;
      }

      .switcher {
        --bim-label--c: var(--bim-ui_bg-contrast-80);
        background-color: transparent;
        position: relative;
        cursor: pointer;
        pointer-events: auto;
        padding: 0rem 0.75rem;
        display: flex;
        justify-content: center;
        z-index: 2;
        transition: all 0.15s;
      }

      .switcher:not([data-active]):hover {
        filter: brightness(150%);
      }

      :host([switchers-full]) .switcher {
        flex: 1;
      }

      .switcher[data-active] {
        --bim-label--c: var(--bim-ui_main-contrast);
      }

      .switchers bim-label {
        pointer-events: none;
      }

      :host([switchers-hidden]) .switchers {
        display: none;
      }

      .content {
        position: relative;
        display: grid;
        grid-template-columns: 1fr;
        grid-area: content;
        max-height: 100vh;
        overflow: auto;
        transition: max-height 0.2s;
      }

      :host([tab="hidden"]) .content {
        max-height: 0;
      }

      .animated-background {
        position: absolute;
        background: var(--bim-ui_main-base);
        width: 0;
        height: 0;
        top: 0;
        left: 0;
      }

      :host(:not([bottom])) .content {
        border-top: 1px solid var(--bim-ui_bg-contrast-20);
      }

      :host([bottom]) .content {
        border-bottom: 1px solid var(--bim-ui_bg-contrast-20);
      }

      :host([floating]) {
        background-color: transparent;
      }

      :host([floating]) .switchers {
        justify-self: center;
        overflow: hidden;
        background-color: var(--bim-ui_bg-base);
      }

      :host([floating]:not([bottom])) .switchers {
        border-radius: var(--bim-ui_size-2xs) var(--bim-ui_size-2xs) 0 0;
        border-top: 1px solid var(--bim-ui_bg-contrast-20);
        border-left: 1px solid var(--bim-ui_bg-contrast-20);
        border-right: 1px solid var(--bim-ui_bg-contrast-20);
      }

      :host([floating][bottom]) .switchers {
        border-radius: 0 0 var(--bim-ui_size-2xs) var(--bim-ui_size-2xs);
        border-bottom: 1px solid var(--bim-ui_bg-contrast-20);
        border-left: 1px solid var(--bim-ui_bg-contrast-20);
        border-right: 1px solid var(--bim-ui_bg-contrast-20);
      }

      :host([floating][tab="hidden"]) .switchers {
        border-radius: var(--bim-ui_size-2xs);
        border-bottom: 1px solid var(--bim-ui_bg-contrast-20);
      }

      :host([floating][bottom][tab="hidden"]) .switchers {
        border-top: 1px solid var(--bim-ui_bg-contrast-20);
      }

      :host([floating]) .content {
        border: 1px solid var(--bim-ui_bg-contrast-20);
        border-radius: var(--bim-ui_size-2xs);
        background-color: var(--bim-ui_bg-base);
      }
    `];let Pt=Gu;Sn([Ti()],Pt.prototype,"_switchers",2);Sn([_({type:Boolean,reflect:!0})],Pt.prototype,"bottom",2);Sn([_({type:Boolean,attribute:"switchers-hidden",reflect:!0})],Pt.prototype,"switchersHidden",2);Sn([_({type:Boolean,reflect:!0})],Pt.prototype,"floating",2);Sn([_({type:String,reflect:!0})],Pt.prototype,"tab",1);Sn([_({type:Boolean,attribute:"switchers-full",reflect:!0})],Pt.prototype,"switchersFull",2);var Rg=Object.defineProperty,jg=Object.getOwnPropertyDescriptor,Zs=(t,e,i,o)=>{for(var n=o>1?void 0:o?jg(e,i):e,s=t.length-1,r;s>=0;s--)(r=t[s])&&(n=(o?r(e,i,n):r(n))||n);return o&&n&&Rg(e,i,n),n};const Wu=class extends J{constructor(){super(...arguments),this._defaultName="__unnamed__",this.name=this._defaultName,this._hidden=!1}set label(e){this._label=e;const i=this.parentElement;i instanceof Pt&&i.updateSwitchers()}get label(){return this._label}set icon(e){this._icon=e;const i=this.parentElement;i instanceof Pt&&i.updateSwitchers()}get icon(){return this._icon}set hidden(e){this._hidden=e,this.dispatchEvent(new Event("hiddenchange"))}get hidden(){return this._hidden}connectedCallback(){super.connectedCallback();const{parentElement:e}=this;if(e&&this.name===this._defaultName){const i=[...e.children].indexOf(this);this.name=`${this._defaultName}${i}`}}render(){return T` <slot></slot> `}};Wu.styles=te`
    :host {
      display: block;
      height: 100%;
      grid-row-start: 1;
      grid-column-start: 1;
      animation: openAnim 3s forwards;
      transform: translateY(0);
      max-height: 100vh;
      transition:
        opacity 0.3s ease,
        max-height 0.6s ease,
        transform 0.3s ease;
    }

    :host([hidden]) {
      transform: translateY(-20px);
      max-height: 0;
      opacity: 0;
      overflow: hidden;
      visibility: hidden;
    }
  `;let Pe=Wu;Zs([_({type:String,reflect:!0})],Pe.prototype,"name",2);Zs([_({type:String,reflect:!0})],Pe.prototype,"label",1);Zs([_({type:String,reflect:!0})],Pe.prototype,"icon",1);Zs([_({type:Boolean,reflect:!0})],Pe.prototype,"hidden",1);var Ng=Object.defineProperty,Bg=Object.getOwnPropertyDescriptor,rt=(t,e,i,o)=>{for(var n=o>1?void 0:o?Bg(e,i):e,s=t.length-1,r;s>=0;s--)(r=t[s])&&(n=(o?r(e,i,n):r(n))||n);return o&&n&&Ng(e,i,n),n};const Yu=class extends J{constructor(){super(...arguments),this._inputTypes=["date","datetime-local","email","month","password","search","tel","text","time","url","week","area"],this.value="",this.vertical=!1,this.disabled=!1,this.resize="vertical",this._type="text",this.onValueChange=new Event("input")}set type(e){this._inputTypes.includes(e)&&(this._type=e)}get type(){return this._type}get query(){return Kr(this.value)}onInputChange(e){e.stopPropagation();const i=e.target;clearTimeout(this._debounceTimeoutID),this._debounceTimeoutID=setTimeout(()=>{this.value=i.value,this.dispatchEvent(this.onValueChange)},this.debounce)}focus(){setTimeout(()=>{var e;const i=(e=this.shadowRoot)==null?void 0:e.querySelector("input");i?.focus()})}render(){return T`
      <bim-input
        .name=${this.name}
        .icon=${this.icon}
        .label=${this.label}
        .vertical=${this.vertical}
      >
        ${this.type==="area"?T` <textarea
              aria-label=${this.label||this.name||"Text Input"}
              .value=${this.value}
              .rows=${this.rows??5}
              ?disabled=${this.disabled}
              placeholder=${ea(this.placeholder)}
              @input=${this.onInputChange}
              style="resize: ${this.resize};"
            ></textarea>`:T` <input
              aria-label=${this.label||this.name||"Text Input"}
              .type=${this.type}
              .value=${this.value}
              ?disabled=${this.disabled}
              placeholder=${ea(this.placeholder)}
              @input=${this.onInputChange}
            />`}
      </bim-input>
    `}};Yu.styles=[Jt.scrollbar,te`
      :host {
        --bim-input--bgc: var(--bim-ui_bg-contrast-20);
        flex: 1;
        display: block;
      }

      input,
      textarea {
        font-family: inherit;
        background-color: transparent;
        border: none;
        width: 100%;
        padding: var(--bim-ui_size-3xs);
        color: var(--bim-text-input--c, var(--bim-ui_bg-contrast-100));
      }

      input {
        outline: none;
        height: 100%;
        padding: 0 var(--bim-ui_size-3xs); /* Override padding */
        border-radius: var(--bim-text-input--bdrs, var(--bim-ui_size-4xs));
      }

      :host([disabled]) input,
      :host([disabled]) textarea {
        color: var(--bim-ui_bg-contrast-60);
      }

      textarea {
        line-height: 1.1rem;
        outline: none;
      }

      :host(:focus) {
        --bim-input--olc: var(--bim-ui_accent-base);
      }

      /* :host([disabled]) {
      --bim-input--bgc: var(--bim-ui_bg-contrast-20);
    } */
    `];let Je=Yu;rt([_({type:String,reflect:!0})],Je.prototype,"icon",2);rt([_({type:String,reflect:!0})],Je.prototype,"label",2);rt([_({type:String,reflect:!0})],Je.prototype,"name",2);rt([_({type:String,reflect:!0})],Je.prototype,"placeholder",2);rt([_({type:String,reflect:!0})],Je.prototype,"value",2);rt([_({type:Boolean,reflect:!0})],Je.prototype,"vertical",2);rt([_({type:Number,reflect:!0})],Je.prototype,"debounce",2);rt([_({type:Number,reflect:!0})],Je.prototype,"rows",2);rt([_({type:Boolean,reflect:!0})],Je.prototype,"disabled",2);rt([_({type:String,reflect:!0})],Je.prototype,"resize",2);rt([_({type:String,reflect:!0})],Je.prototype,"type",1);var Fg=Object.defineProperty,Ug=Object.getOwnPropertyDescriptor,Xu=(t,e,i,o)=>{for(var n=o>1?void 0:o?Ug(e,i):e,s=t.length-1,r;s>=0;s--)(r=t[s])&&(n=(o?r(e,i,n):r(n))||n);return o&&n&&Fg(e,i,n),n};const Zu=class extends J{constructor(){super(...arguments),this.rows=2,this._vertical=!1}set vertical(e){this._vertical=e,this.updateChildren()}get vertical(){return this._vertical}updateChildren(){const e=this.children;for(const i of e)this.vertical?i.setAttribute("label-hidden",""):i.removeAttribute("label-hidden")}render(){return T`
      <style>
        .parent {
          grid-auto-flow: ${this.vertical?"row":"column"};
          grid-template-rows: repeat(${this.rows}, 1fr);
        }
      </style>
      <div class="parent">
        <slot @slotchange=${this.updateChildren}></slot>
      </div>
    `}};Zu.styles=te`
    .parent {
      display: grid;
      gap: 0.25rem;
    }

    ::slotted(bim-button[label]:not([vertical])) {
      --bim-button--jc: flex-start;
    }

    ::slotted(bim-button) {
      --bim-label--c: var(--bim-ui_bg-contrast-80);
    }
  `;let Js=Zu;Xu([_({type:Number,reflect:!0})],Js.prototype,"rows",2);Xu([_({type:Boolean,reflect:!0})],Js.prototype,"vertical",1);var Hg=Object.defineProperty,Vg=Object.getOwnPropertyDescriptor,Ks=(t,e,i,o)=>{for(var n=o>1?void 0:o?Vg(e,i):e,s=t.length-1,r;s>=0;s--)(r=t[s])&&(n=(o?r(e,i,n):r(n))||n);return o&&n&&Hg(e,i,n),n};const Ju=class extends J{constructor(){super(...arguments),this._vertical=!1,this._labelHidden=!1}set vertical(e){this._vertical=e,this.updateChildren()}get vertical(){return this._vertical}set labelHidden(e){this._labelHidden=e,this.updateChildren()}get labelHidden(){return this._labelHidden}updateChildren(){const e=this.children;for(const i of e)i instanceof Js&&(i.vertical=this.vertical),i.toggleAttribute("label-hidden",this.vertical)}render(){return T`
      <div class="parent">
        <div class="children">
          <slot @slotchange=${this.updateChildren}></slot>
        </div>
        ${!this.labelHidden&&(this.label||this.icon)?T`<bim-label .icon=${this.icon}>${this.label}</bim-label>`:null}
      </div>
    `}};Ju.styles=te`
    :host {
      --bim-label--fz: var(--bim-ui_size-xs);
      --bim-label--c: var(--bim-ui_bg-contrast-60);
      display: block;
      flex: 1;
    }

    :host(:not([vertical])) ::slotted(bim-button[vertical]) {
      --bim-icon--fz: var(--bim-ui_size-5xl);
      min-height: 3.75rem;
    }

    .parent {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      align-items: center;
      padding: 0.5rem;
      height: 100%;
      box-sizing: border-box;
      justify-content: space-between;
    }

    :host([vertical]) .parent {
      flex-direction: row-reverse;
    }

    :host([vertical]) .parent > bim-label {
      writing-mode: tb;
    }

    .children {
      display: flex;
      gap: 0.25rem;
    }

    :host([vertical]) .children {
      flex-direction: column;
    }
  `;let Cn=Ju;Ks([_({type:String,reflect:!0})],Cn.prototype,"label",2);Ks([_({type:String,reflect:!0})],Cn.prototype,"icon",2);Ks([_({type:Boolean,reflect:!0})],Cn.prototype,"vertical",1);Ks([_({type:Boolean,attribute:"label-hidden",reflect:!0})],Cn.prototype,"labelHidden",1);var qg=Object.defineProperty,Gg=Object.getOwnPropertyDescriptor,Ga=(t,e,i,o)=>{for(var n=o>1?void 0:o?Gg(e,i):e,s=t.length-1,r;s>=0;s--)(r=t[s])&&(n=(o?r(e,i,n):r(n))||n);return o&&n&&qg(e,i,n),n};const Ku=class extends J{constructor(){super(...arguments),this.labelsHidden=!1,this._vertical=!1,this._hidden=!1}set vertical(e){this._vertical=e,this.updateSections()}get vertical(){return this._vertical}set hidden(e){this._hidden=e,this.dispatchEvent(new Event("hiddenchange"))}get hidden(){return this._hidden}updateSections(){const e=this.children;for(const i of e)i instanceof Cn&&(i.labelHidden=this.vertical&&!Ws.config.sectionLabelOnVerticalToolbar,i.vertical=this.vertical)}render(){return T`
      <div class="parent">
        <slot @slotchange=${this.updateSections}></slot>
      </div>
    `}};Ku.styles=te`
    :host {
      --bim-button--bgc: transparent;
      background-color: var(--bim-ui_bg-base);
      border-radius: var(--bim-ui_size-2xs);
      display: block;
    }

    :host([hidden]) {
      display: none;
    }

    .parent {
      display: flex;
      width: max-content;
      pointer-events: auto;
    }

    :host([vertical]) .parent {
      flex-direction: column;
    }

    :host([vertical]) {
      width: min-content;
      border-radius: var(--bim-ui_size-2xs);
      border: 1px solid var(--bim-ui_bg-contrast-20);
    }

    ::slotted(bim-toolbar-section:not(:last-child)) {
      border-right: 1px solid var(--bim-ui_bg-contrast-20);
      border-bottom: none;
    }

    :host([vertical]) ::slotted(bim-toolbar-section:not(:last-child)) {
      border-bottom: 1px solid var(--bim-ui_bg-contrast-20);
      border-right: none;
    }
  `;let Qs=Ku;Ga([_({type:String,reflect:!0})],Qs.prototype,"icon",2);Ga([_({type:Boolean,attribute:"labels-hidden",reflect:!0})],Qs.prototype,"labelsHidden",2);Ga([_({type:Boolean,reflect:!0})],Qs.prototype,"vertical",1);var Wg=Object.defineProperty,Yg=(t,e,i,o)=>{for(var n=void 0,s=t.length-1,r;s>=0;s--)(r=t[s])&&(n=r(e,i,n)||n);return n&&Wg(e,i,n),n};const Qu=class extends J{constructor(){super(),this._onResize=new Event("resize"),new ResizeObserver(()=>{setTimeout(()=>{this.dispatchEvent(this._onResize)})}).observe(this)}render(){return T`
      <div class="parent">
        <slot></slot>
      </div>
    `}};Qu.styles=te`
    :host {
      display: grid;
      min-width: 0;
      min-height: 0;
      height: 100%;
    }

    .parent {
      overflow: hidden;
      position: relative;
    }
  `;let eh=Qu;Yg([_({type:String,reflect:!0})],eh.prototype,"name");var Xg=Object.defineProperty,Wa=(t,e,i,o)=>{for(var n=void 0,s=t.length-1,r;s>=0;s--)(r=t[s])&&(n=r(e,i,n)||n);return n&&Xg(e,i,n),n},_e;const er=(_e=class extends J{constructor(){super(...arguments),this.visible=!1,this._previousContainer=null,this._showToolTip=async()=>{this.timeoutId=setTimeout(async()=>{if(this.visible=!0,!_e.container.parentElement){const t=document.querySelector("[data-context-dialog]");t?t.append(_e.container):document.body.append(_e.container)}this._previousContainer=this.parentElement,_e.container.style.top=`${window.scrollY||document.documentElement.scrollTop}px`,_e.container.append(this),await this.computePosition()},this.timeout===void 0?800:this.timeout)},this._hideToolTip=()=>{clearTimeout(this.timeoutId),this.visible=!1,this._previousContainer&&(this._previousContainer.append(this),this._previousContainer=null),_e.container.children.length===0&&_e.container.parentElement&&_e.container.remove()}}static get container(){return _e._container||(_e._container=document.createElement("div"),_e._container.style.cssText=`
        position: absolute;
        top: 0;
        left: 0;
        width: 0;
        height: 0;
        overflow: visible;
        pointer-events: none;
        z-index: 9999;
      `),_e._container}async computePosition(){const t=this._previousContainer||this.parentElement;if(!t)return;const e=this.style.display;this.style.display="block",this.style.visibility="hidden",await new Promise(requestAnimationFrame);const{x:i,y:o}=await Pa(t,this,{placement:this.placement,middleware:[Ca(10),Oa(),Ta({padding:8}),Ia()]});Object.assign(this.style,{left:`${i}px`,top:`${o}px`,display:e,visibility:""})}connectedCallback(){super.connectedCallback();const t=this.parentElement;t&&(t.addEventListener("mouseenter",this._showToolTip),t.addEventListener("mouseleave",this._hideToolTip))}disconnectedCallback(){super.disconnectedCallback();const t=this.parentElement;t&&(t.removeEventListener("mouseenter",this._showToolTip),t.removeEventListener("mouseleave",this._hideToolTip))}render(){return T`<div><slot></slot></div>`}},_e.styles=te`
    :host {
      position: absolute;
      background: var(--bim-ui_bg-contrast-20, #fff);
      color: var(--bim-ui_bg-contrast-100, #000);
      border-radius: var(--bim-ui_size-4xs, 4px);
      box-shadow: 0 0 10px 3px rgba(0, 0, 0, 0.2);
      padding: 0.75rem;
      font-size: var(--bim-ui_size-xs, 0.875rem);
      display: none;
    }
    :host([visible]) {
      display: flex;
    }
  `,_e._container=null,_e);Wa([_({type:Boolean,reflect:!0})],er.prototype,"visible");Wa([_({type:Number,reflect:!0})],er.prototype,"timeout");Wa([_({type:String,reflect:!0})],er.prototype,"placement");let Zg=er;/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const ts=globalThis,Ya=ts.ShadowRoot&&(ts.ShadyCSS===void 0||ts.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,Xa=Symbol(),vc=new WeakMap;let th=class{constructor(t,e,i){if(this._$cssResult$=!0,i!==Xa)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=e}get styleSheet(){let t=this.o;const e=this.t;if(Ya&&t===void 0){const i=e!==void 0&&e.length===1;i&&(t=vc.get(e)),t===void 0&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),i&&vc.set(e,t))}return t}toString(){return this.cssText}};const Jg=t=>new th(typeof t=="string"?t:t+"",void 0,Xa),Za=(t,...e)=>{const i=t.length===1?t[0]:e.reduce((o,n,s)=>o+(r=>{if(r._$cssResult$===!0)return r.cssText;if(typeof r=="number")return r;throw Error("Value passed to 'css' function must be a 'css' function result: "+r+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(n)+t[s+1],t[0]);return new th(i,t,Xa)},Kg=(t,e)=>{if(Ya)t.adoptedStyleSheets=e.map(i=>i instanceof CSSStyleSheet?i:i.styleSheet);else for(const i of e){const o=document.createElement("style"),n=ts.litNonce;n!==void 0&&o.setAttribute("nonce",n),o.textContent=i.cssText,t.appendChild(o)}},wc=Ya?t=>t:t=>t instanceof CSSStyleSheet?(e=>{let i="";for(const o of e.cssRules)i+=o.cssText;return Jg(i)})(t):t;/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const{is:Qg,defineProperty:ey,getOwnPropertyDescriptor:ty,getOwnPropertyNames:iy,getOwnPropertySymbols:ny,getPrototypeOf:oy}=Object,cn=globalThis,$c=cn.trustedTypes,sy=$c?$c.emptyScript:"",_c=cn.reactiveElementPolyfillSupport,Gn=(t,e)=>t,ys={toAttribute(t,e){switch(e){case Boolean:t=t?sy:null;break;case Object:case Array:t=t==null?t:JSON.stringify(t)}return t},fromAttribute(t,e){let i=t;switch(e){case Boolean:i=t!==null;break;case Number:i=t===null?null:Number(t);break;case Object:case Array:try{i=JSON.parse(t)}catch{i=null}}return i}},Ja=(t,e)=>!Qg(t,e),xc={attribute:!0,type:String,converter:ys,reflect:!1,useDefault:!1,hasChanged:Ja};Symbol.metadata??(Symbol.metadata=Symbol("metadata")),cn.litPropertyMetadata??(cn.litPropertyMetadata=new WeakMap);let Bi=class extends HTMLElement{static addInitializer(t){this._$Ei(),(this.l??(this.l=[])).push(t)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(t,e=xc){if(e.state&&(e.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(t)&&((e=Object.create(e)).wrapped=!0),this.elementProperties.set(t,e),!e.noAccessor){const i=Symbol(),o=this.getPropertyDescriptor(t,i,e);o!==void 0&&ey(this.prototype,t,o)}}static getPropertyDescriptor(t,e,i){const{get:o,set:n}=ty(this.prototype,t)??{get(){return this[e]},set(s){this[e]=s}};return{get:o,set(s){const r=o?.call(this);n?.call(this,s),this.requestUpdate(t,r,i)},configurable:!0,enumerable:!0}}static getPropertyOptions(t){return this.elementProperties.get(t)??xc}static _$Ei(){if(this.hasOwnProperty(Gn("elementProperties")))return;const t=oy(this);t.finalize(),t.l!==void 0&&(this.l=[...t.l]),this.elementProperties=new Map(t.elementProperties)}static finalize(){if(this.hasOwnProperty(Gn("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(Gn("properties"))){const e=this.properties,i=[...iy(e),...ny(e)];for(const o of i)this.createProperty(o,e[o])}const t=this[Symbol.metadata];if(t!==null){const e=litPropertyMetadata.get(t);if(e!==void 0)for(const[i,o]of e)this.elementProperties.set(i,o)}this._$Eh=new Map;for(const[e,i]of this.elementProperties){const o=this._$Eu(e,i);o!==void 0&&this._$Eh.set(o,e)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(t){const e=[];if(Array.isArray(t)){const i=new Set(t.flat(1/0).reverse());for(const o of i)e.unshift(wc(o))}else t!==void 0&&e.push(wc(t));return e}static _$Eu(t,e){const i=e.attribute;return i===!1?void 0:typeof i=="string"?i:typeof t=="string"?t.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){var t;this._$ES=new Promise(e=>this.enableUpdating=e),this._$AL=new Map,this._$E_(),this.requestUpdate(),(t=this.constructor.l)==null||t.forEach(e=>e(this))}addController(t){var e;(this._$EO??(this._$EO=new Set)).add(t),this.renderRoot!==void 0&&this.isConnected&&((e=t.hostConnected)==null||e.call(t))}removeController(t){var e;(e=this._$EO)==null||e.delete(t)}_$E_(){const t=new Map,e=this.constructor.elementProperties;for(const i of e.keys())this.hasOwnProperty(i)&&(t.set(i,this[i]),delete this[i]);t.size>0&&(this._$Ep=t)}createRenderRoot(){const t=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return Kg(t,this.constructor.elementStyles),t}connectedCallback(){var t;this.renderRoot??(this.renderRoot=this.createRenderRoot()),this.enableUpdating(!0),(t=this._$EO)==null||t.forEach(e=>{var i;return(i=e.hostConnected)==null?void 0:i.call(e)})}enableUpdating(t){}disconnectedCallback(){var t;(t=this._$EO)==null||t.forEach(e=>{var i;return(i=e.hostDisconnected)==null?void 0:i.call(e)})}attributeChangedCallback(t,e,i){this._$AK(t,i)}_$ET(t,e){var i;const o=this.constructor.elementProperties.get(t),n=this.constructor._$Eu(t,o);if(n!==void 0&&o.reflect===!0){const s=(((i=o.converter)==null?void 0:i.toAttribute)!==void 0?o.converter:ys).toAttribute(e,o.type);this._$Em=t,s==null?this.removeAttribute(n):this.setAttribute(n,s),this._$Em=null}}_$AK(t,e){var i,o;const n=this.constructor,s=n._$Eh.get(t);if(s!==void 0&&this._$Em!==s){const r=n.getPropertyOptions(s),a=typeof r.converter=="function"?{fromAttribute:r.converter}:((i=r.converter)==null?void 0:i.fromAttribute)!==void 0?r.converter:ys;this._$Em=s;const l=a.fromAttribute(e,r.type);this[s]=l??((o=this._$Ej)==null?void 0:o.get(s))??l,this._$Em=null}}requestUpdate(t,e,i,o=!1,n){var s;if(t!==void 0){const r=this.constructor;if(o===!1&&(n=this[t]),i??(i=r.getPropertyOptions(t)),!((i.hasChanged??Ja)(n,e)||i.useDefault&&i.reflect&&n===((s=this._$Ej)==null?void 0:s.get(t))&&!this.hasAttribute(r._$Eu(t,i))))return;this.C(t,e,i)}this.isUpdatePending===!1&&(this._$ES=this._$EP())}C(t,e,{useDefault:i,reflect:o,wrapped:n},s){i&&!(this._$Ej??(this._$Ej=new Map)).has(t)&&(this._$Ej.set(t,s??e??this[t]),n!==!0||s!==void 0)||(this._$AL.has(t)||(this.hasUpdated||i||(e=void 0),this._$AL.set(t,e)),o===!0&&this._$Em!==t&&(this._$Eq??(this._$Eq=new Set)).add(t))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(e){Promise.reject(e)}const t=this.scheduleUpdate();return t!=null&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){var t;if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??(this.renderRoot=this.createRenderRoot()),this._$Ep){for(const[n,s]of this._$Ep)this[n]=s;this._$Ep=void 0}const o=this.constructor.elementProperties;if(o.size>0)for(const[n,s]of o){const{wrapped:r}=s,a=this[n];r!==!0||this._$AL.has(n)||a===void 0||this.C(n,void 0,s,a)}}let e=!1;const i=this._$AL;try{e=this.shouldUpdate(i),e?(this.willUpdate(i),(t=this._$EO)==null||t.forEach(o=>{var n;return(n=o.hostUpdate)==null?void 0:n.call(o)}),this.update(i)):this._$EM()}catch(o){throw e=!1,this._$EM(),o}e&&this._$AE(i)}willUpdate(t){}_$AE(t){var e;(e=this._$EO)==null||e.forEach(i=>{var o;return(o=i.hostUpdated)==null?void 0:o.call(i)}),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(t){return!0}update(t){this._$Eq&&(this._$Eq=this._$Eq.forEach(e=>this._$ET(e,this[e]))),this._$EM()}updated(t){}firstUpdated(t){}};Bi.elementStyles=[],Bi.shadowRootOptions={mode:"open"},Bi[Gn("elementProperties")]=new Map,Bi[Gn("finalized")]=new Map,_c?.({ReactiveElement:Bi}),(cn.reactiveElementVersions??(cn.reactiveElementVersions=[])).push("2.1.2");/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const vs=globalThis,Ec=t=>t,ws=vs.trustedTypes,Sc=ws?ws.createPolicy("lit-html",{createHTML:t=>t}):void 0,ih="$lit$",jt=`lit$${Math.random().toFixed(9).slice(2)}$`,nh="?"+jt,ry=`<${nh}>`,Si=document,ro=()=>Si.createComment(""),ao=t=>t===null||typeof t!="object"&&typeof t!="function",Ka=Array.isArray,ay=t=>Ka(t)||typeof t?.[Symbol.iterator]=="function",Er=`[ 	
\f\r]`,Dn=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,Cc=/-->/g,Ac=/>/g,ci=RegExp(`>|${Er}(?:([^\\s"'>=/]+)(${Er}*=${Er}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),kc=/'/g,Tc=/"/g,oh=/^(?:script|style|textarea|title)$/i,ly=t=>(e,...i)=>({_$litType$:t,strings:e,values:i}),Qa=ly(1),dn=Symbol.for("lit-noChange"),pe=Symbol.for("lit-nothing"),Oc=new WeakMap,fi=Si.createTreeWalker(Si,129);function sh(t,e){if(!Ka(t)||!t.hasOwnProperty("raw"))throw Error("invalid template strings array");return Sc!==void 0?Sc.createHTML(e):e}const cy=(t,e)=>{const i=t.length-1,o=[];let n,s=e===2?"<svg>":e===3?"<math>":"",r=Dn;for(let a=0;a<i;a++){const l=t[a];let c,d,u=-1,h=0;for(;h<l.length&&(r.lastIndex=h,d=r.exec(l),d!==null);)h=r.lastIndex,r===Dn?d[1]==="!--"?r=Cc:d[1]!==void 0?r=Ac:d[2]!==void 0?(oh.test(d[2])&&(n=RegExp("</"+d[2],"g")),r=ci):d[3]!==void 0&&(r=ci):r===ci?d[0]===">"?(r=n??Dn,u=-1):d[1]===void 0?u=-2:(u=r.lastIndex-d[2].length,c=d[1],r=d[3]===void 0?ci:d[3]==='"'?Tc:kc):r===Tc||r===kc?r=ci:r===Cc||r===Ac?r=Dn:(r=ci,n=void 0);const p=r===ci&&t[a+1].startsWith("/>")?" ":"";s+=r===Dn?l+ry:u>=0?(o.push(c),l.slice(0,u)+ih+l.slice(u)+jt+p):l+jt+(u===-2?a:p)}return[sh(t,s+(t[i]||"<?>")+(e===2?"</svg>":e===3?"</math>":"")),o]};let ta=class rh{constructor({strings:e,_$litType$:i},o){let n;this.parts=[];let s=0,r=0;const a=e.length-1,l=this.parts,[c,d]=cy(e,i);if(this.el=rh.createElement(c,o),fi.currentNode=this.el.content,i===2||i===3){const u=this.el.content.firstChild;u.replaceWith(...u.childNodes)}for(;(n=fi.nextNode())!==null&&l.length<a;){if(n.nodeType===1){if(n.hasAttributes())for(const u of n.getAttributeNames())if(u.endsWith(ih)){const h=d[r++],p=n.getAttribute(u).split(jt),m=/([.?@])?(.*)/.exec(h);l.push({type:1,index:s,name:m[2],strings:p,ctor:m[1]==="."?uy:m[1]==="?"?hy:m[1]==="@"?py:tr}),n.removeAttribute(u)}else u.startsWith(jt)&&(l.push({type:6,index:s}),n.removeAttribute(u));if(oh.test(n.tagName)){const u=n.textContent.split(jt),h=u.length-1;if(h>0){n.textContent=ws?ws.emptyScript:"";for(let p=0;p<h;p++)n.append(u[p],ro()),fi.nextNode(),l.push({type:2,index:++s});n.append(u[h],ro())}}}else if(n.nodeType===8)if(n.data===nh)l.push({type:2,index:s});else{let u=-1;for(;(u=n.data.indexOf(jt,u+1))!==-1;)l.push({type:7,index:s}),u+=jt.length-1}s++}}static createElement(e,i){const o=Si.createElement("template");return o.innerHTML=e,o}};function un(t,e,i=t,o){var n,s;if(e===dn)return e;let r=o!==void 0?(n=i._$Co)==null?void 0:n[o]:i._$Cl;const a=ao(e)?void 0:e._$litDirective$;return r?.constructor!==a&&((s=r?._$AO)==null||s.call(r,!1),a===void 0?r=void 0:(r=new a(t),r._$AT(t,i,o)),o!==void 0?(i._$Co??(i._$Co=[]))[o]=r:i._$Cl=r),r!==void 0&&(e=un(t,r._$AS(t,e.values),r,o)),e}let dy=class{constructor(t,e){this._$AV=[],this._$AN=void 0,this._$AD=t,this._$AM=e}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(t){const{el:{content:e},parts:i}=this._$AD,o=(t?.creationScope??Si).importNode(e,!0);fi.currentNode=o;let n=fi.nextNode(),s=0,r=0,a=i[0];for(;a!==void 0;){if(s===a.index){let l;a.type===2?l=new Io(n,n.nextSibling,this,t):a.type===1?l=new a.ctor(n,a.name,a.strings,this,t):a.type===6&&(l=new fy(n,this,t)),this._$AV.push(l),a=i[++r]}s!==a?.index&&(n=fi.nextNode(),s++)}return fi.currentNode=Si,o}p(t){let e=0;for(const i of this._$AV)i!==void 0&&(i.strings!==void 0?(i._$AI(t,i,e),e+=i.strings.length-2):i._$AI(t[e])),e++}};class Io{get _$AU(){var e;return((e=this._$AM)==null?void 0:e._$AU)??this._$Cv}constructor(e,i,o,n){this.type=2,this._$AH=pe,this._$AN=void 0,this._$AA=e,this._$AB=i,this._$AM=o,this.options=n,this._$Cv=n?.isConnected??!0}get parentNode(){let e=this._$AA.parentNode;const i=this._$AM;return i!==void 0&&e?.nodeType===11&&(e=i.parentNode),e}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(e,i=this){e=un(this,e,i),ao(e)?e===pe||e==null||e===""?(this._$AH!==pe&&this._$AR(),this._$AH=pe):e!==this._$AH&&e!==dn&&this._(e):e._$litType$!==void 0?this.$(e):e.nodeType!==void 0?this.T(e):ay(e)?this.k(e):this._(e)}O(e){return this._$AA.parentNode.insertBefore(e,this._$AB)}T(e){this._$AH!==e&&(this._$AR(),this._$AH=this.O(e))}_(e){this._$AH!==pe&&ao(this._$AH)?this._$AA.nextSibling.data=e:this.T(Si.createTextNode(e)),this._$AH=e}$(e){var i;const{values:o,_$litType$:n}=e,s=typeof n=="number"?this._$AC(e):(n.el===void 0&&(n.el=ta.createElement(sh(n.h,n.h[0]),this.options)),n);if(((i=this._$AH)==null?void 0:i._$AD)===s)this._$AH.p(o);else{const r=new dy(s,this),a=r.u(this.options);r.p(o),this.T(a),this._$AH=r}}_$AC(e){let i=Oc.get(e.strings);return i===void 0&&Oc.set(e.strings,i=new ta(e)),i}k(e){Ka(this._$AH)||(this._$AH=[],this._$AR());const i=this._$AH;let o,n=0;for(const s of e)n===i.length?i.push(o=new Io(this.O(ro()),this.O(ro()),this,this.options)):o=i[n],o._$AI(s),n++;n<i.length&&(this._$AR(o&&o._$AB.nextSibling,n),i.length=n)}_$AR(e=this._$AA.nextSibling,i){var o;for((o=this._$AP)==null?void 0:o.call(this,!1,!0,i);e!==this._$AB;){const n=Ec(e).nextSibling;Ec(e).remove(),e=n}}setConnected(e){var i;this._$AM===void 0&&(this._$Cv=e,(i=this._$AP)==null||i.call(this,e))}}let tr=class{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(t,e,i,o,n){this.type=1,this._$AH=pe,this._$AN=void 0,this.element=t,this.name=e,this._$AM=o,this.options=n,i.length>2||i[0]!==""||i[1]!==""?(this._$AH=Array(i.length-1).fill(new String),this.strings=i):this._$AH=pe}_$AI(t,e=this,i,o){const n=this.strings;let s=!1;if(n===void 0)t=un(this,t,e,0),s=!ao(t)||t!==this._$AH&&t!==dn,s&&(this._$AH=t);else{const r=t;let a,l;for(t=n[0],a=0;a<n.length-1;a++)l=un(this,r[i+a],e,a),l===dn&&(l=this._$AH[a]),s||(s=!ao(l)||l!==this._$AH[a]),l===pe?t=pe:t!==pe&&(t+=(l??"")+n[a+1]),this._$AH[a]=l}s&&!o&&this.j(t)}j(t){t===pe?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,t??"")}},uy=class extends tr{constructor(){super(...arguments),this.type=3}j(t){this.element[this.name]=t===pe?void 0:t}};class hy extends tr{constructor(){super(...arguments),this.type=4}j(e){this.element.toggleAttribute(this.name,!!e&&e!==pe)}}let py=class extends tr{constructor(t,e,i,o,n){super(t,e,i,o,n),this.type=5}_$AI(t,e=this){if((t=un(this,t,e,0)??pe)===dn)return;const i=this._$AH,o=t===pe&&i!==pe||t.capture!==i.capture||t.once!==i.once||t.passive!==i.passive,n=t!==pe&&(i===pe||o);o&&this.element.removeEventListener(this.name,this,i),n&&this.element.addEventListener(this.name,this,t),this._$AH=t}handleEvent(t){var e;typeof this._$AH=="function"?this._$AH.call(((e=this.options)==null?void 0:e.host)??this.element,t):this._$AH.handleEvent(t)}},fy=class{constructor(t,e,i){this.element=t,this.type=6,this._$AN=void 0,this._$AM=e,this.options=i}get _$AU(){return this._$AM._$AU}_$AI(t){un(this,t)}};const Ic=vs.litHtmlPolyfillSupport;Ic?.(ta,Io),(vs.litHtmlVersions??(vs.litHtmlVersions=[])).push("3.3.2");const my=(t,e,i)=>{const o=i?.renderBefore??e;let n=o._$litPart$;if(n===void 0){const s=i?.renderBefore??null;o._$litPart$=n=new Io(e.insertBefore(ro(),s),s,void 0,i??{})}return n._$AI(t),n};/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const lo=globalThis;let vi=class extends Bi{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){var t;const e=super.createRenderRoot();return(t=this.renderOptions).renderBefore??(t.renderBefore=e.firstChild),e}update(t){const e=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=my(e,this.renderRoot,this.renderOptions)}connectedCallback(){var t;super.connectedCallback(),(t=this._$Do)==null||t.setConnected(!0)}disconnectedCallback(){var t;super.disconnectedCallback(),(t=this._$Do)==null||t.setConnected(!1)}render(){return dn}};var Pc;vi._$litElement$=!0,vi.finalized=!0,(Pc=lo.litElementHydrateSupport)==null||Pc.call(lo,{LitElement:vi});const Lc=lo.litElementPolyfillSupport;Lc?.({LitElement:vi});(lo.litElementVersions??(lo.litElementVersions=[])).push("4.2.2");/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const by={attribute:!0,type:String,converter:ys,reflect:!1,hasChanged:Ja},gy=(t=by,e,i)=>{const{kind:o,metadata:n}=i;let s=globalThis.litPropertyMetadata.get(n);if(s===void 0&&globalThis.litPropertyMetadata.set(n,s=new Map),o==="setter"&&((t=Object.create(t)).wrapped=!0),s.set(i.name,t),o==="accessor"){const{name:r}=i;return{set(a){const l=e.get.call(this);e.set.call(this,a),this.requestUpdate(r,l,t,!0,a)},init(a){return a!==void 0&&this.C(r,void 0,t,a),a}}}if(o==="setter"){const{name:r}=i;return function(a){const l=this[r];e.call(this,a),this.requestUpdate(r,l,t,!0,a)}}throw Error("Unsupported decorator location: "+o)};function Oe(t){return(e,i)=>typeof i=="object"?gy(t,e,i):((o,n,s)=>{const r=n.hasOwnProperty(s);return n.constructor.createProperty(s,o),r?Object.getOwnPropertyDescriptor(n,s):void 0})(t,e,i)}/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */function yy(t){return Oe({...t,state:!0,attribute:!1})}class vy extends yf{constructor(e=document.createElement("div")){super(),this.isCSS2DObject=!0,this.element=e,this.element.style.position="absolute",this.element.style.userSelect="none",this.element.setAttribute("draggable",!1),this.center=new zs(.5,.5),this.addEventListener("removed",function(){this.traverse(function(i){i.element instanceof i.element.ownerDocument.defaultView.Element&&i.element.parentNode!==null&&i.element.remove()})})}copy(e,i){return super.copy(e,i),this.element=e.element.cloneNode(!0),this.center=e.center,this}}new ee;new ki;new ki;new ee;new ee;class wy{constructor(e,i){this._group=new Al,this._frustum=new gf,this._frustumMat=new ki,this._regenerateDelay=200,this._regenerateCounter=0,this.material=new Vi({color:"#2e3338"}),this.numbers=new Al,this.maxRegenerateRetrys=4,this.gridsFactor=5,this._scaleX=1,this._scaleY=1,this._offsetX=0,this._offsetY=0,this._camera=e,this._container=i;const o=this.newGrid(-1),n=this.newGrid(-2);this.grids={main:o,secondary:n},this._group.add(n,o,this.numbers)}set scaleX(e){this._scaleX=e,this.regenerate()}get scaleX(){return this._scaleX}set scaleY(e){this._scaleY=e,this.regenerate()}get scaleY(){return this._scaleY}set offsetX(e){this._offsetX=e,this.regenerate()}get offsetX(){return this._offsetX}set offsetY(e){this._offsetY=e,this.regenerate()}get offsetY(){return this._offsetY}get(){return this._group}dispose(){const{main:e,secondary:i}=this.grids;e.removeFromParent(),i.removeFromParent(),e.geometry.dispose(),e.material.dispose(),i.geometry.dispose(),i.material.dispose()}regenerate(){if(!this.isGridReady()){if(this._regenerateCounter++,this._regenerateCounter>this.maxRegenerateRetrys)throw new Error("Grid could not be regenerated");setTimeout(()=>this.regenerate,this._regenerateDelay);return}this._regenerateCounter=0,this._camera.updateMatrix(),this._camera.updateMatrixWorld();const e=this._frustumMat.multiplyMatrices(this._camera.projectionMatrix,this._camera.matrixWorldInverse);this._frustum.setFromProjectionMatrix(e);const{planes:i}=this._frustum,o=i[0].constant*-i[0].normal.x,n=i[1].constant*-i[1].normal.x,s=i[2].constant*-i[2].normal.y,r=i[3].constant*-i[3].normal.y,a=Math.abs(o-n),l=Math.abs(r-s),{clientWidth:c,clientHeight:d}=this._container,u=Math.max(c,d),h=Math.max(a,l)/u,p=Math.ceil(Math.log10(a/this.scaleX)),m=Math.ceil(Math.log10(l/this.scaleY)),g=10**(p-2)*this.scaleX,f=10**(m-2)*this.scaleY,v=g*this.gridsFactor,y=f*this.gridsFactor,b=Math.ceil(l/y),$=Math.ceil(a/v),C=Math.ceil(l/f),E=Math.ceil(a/g),A=g*Math.ceil(n/g),P=f*Math.ceil(s/f),M=v*Math.ceil(n/v),O=y*Math.ceil(s/y),U=[...this.numbers.children];for(const le of U)le.removeFromParent();this.numbers.children=[];const z=[],X=9*h,I=1e4,H=M+this._offsetX,ne=Math.round(Math.abs(H/this.scaleX)*I)/I,Z=($-1)*v,V=Math.round(Math.abs((H+Z)/this.scaleX)*I)/I,q=Math.max(ne,V).toString().length*X;let fe=Math.ceil(q/v)*v;for(let le=0;le<$;le++){let ce=M+le*v;z.push(ce,r,0,ce,s,0),ce=Math.round(ce*I)/I,fe=Math.round(fe*I)/I;const N=ce%fe;if(!(v<1||y<1)&&Math.abs(N)>.01)continue;const j=this.newNumber((ce+this._offsetX)/this.scaleX),L=12*h;j.position.set(ce,s+L,0)}for(let le=0;le<b;le++){const ce=O+le*y;z.push(n,ce,0,o,ce,0);const N=this.newNumber(ce/this.scaleY);let j=12;N.element.textContent&&(j+=4*N.element.textContent.length);const L=j*h;N.position.set(n+L,ce,0)}const dt=[];for(let le=0;le<E;le++){const ce=A+le*g;dt.push(ce,r,0,ce,s,0)}for(let le=0;le<C;le++){const ce=P+le*f;dt.push(n,ce,0,o,ce,0)}const ve=new Ut(new Float32Array(z),3),_t=new Ut(new Float32Array(dt),3),{main:tt,secondary:ri}=this.grids;tt.geometry.setAttribute("position",ve),ri.geometry.setAttribute("position",_t)}newNumber(e){const i=document.createElement("bim-label");i.textContent=String(Math.round(e*100)/100);const o=new vy(i);return this.numbers.add(o),o}newGrid(e){const i=new qi,o=new xa(i,this.material);return o.frustumCulled=!1,o.renderOrder=e,o}isGridReady(){const e=this._camera.projectionMatrix.elements;for(let i=0;i<e.length;i++){const o=e[i];if(Number.isNaN(o))return!1}return!0}}var $y=Object.defineProperty,_y=Object.getOwnPropertyDescriptor,Po=(t,e,i,o)=>{for(var n=_y(e,i),s=t.length-1,r;s>=0;s--)(r=t[s])&&(n=r(e,i,n)||n);return n&&$y(e,i,n),n};const ah=class extends vi{constructor(){super(...arguments),this._grid=null,this._world=null,this.resize=()=>{this._world&&this._grid&&this._grid.regenerate()}}set gridColor(e){if(this._gridColor=e,!(e&&this._grid))return;const i=Number(e.replace("#","0x"));Number.isNaN(i)||this._grid.material.color.setHex(i)}get gridColor(){return this._gridColor}set gridScaleX(e){this._gridScaleX=e,e&&this._grid&&(this._grid.scaleX=e)}get gridScaleX(){return this._gridScaleX}set gridScaleY(e){this._gridScaleY=e,e&&this._grid&&(this._grid.scaleY=e)}get gridScaleY(){return this._gridScaleY}get gridOffsetX(){var e;return((e=this._grid)==null?void 0:e.offsetX)||0}set gridOffsetX(e){this._grid&&(this._grid.offsetX=e)}get gridOffsetY(){var e;return((e=this._grid)==null?void 0:e.offsetY)||0}set gridOffsetY(e){this._grid&&(this._grid.offsetY=e)}set components(e){this.dispose();const i=e.get(Ds).create();this._world=i,i.scene=new $a(e),i.scene.setup(),i.renderer=new bf(e,this);const o=new _a(e);i.camera=o;const n=new wy(o.threeOrtho,this);this._grid=n,i.scene.three.add(n.get()),o.controls.addEventListener("update",()=>n.regenerate()),setTimeout(async()=>{i.camera.updateAspect(),o.set("Plan"),await o.controls.setLookAt(0,0,100,0,0,0),await o.projection.set("Orthographic"),o.controls.dollySpeed=3,o.controls.draggingSmoothTime=.085,o.controls.maxZoom=1e3,o.controls.zoom(4)})}get world(){return this._world}dispose(){var e;(e=this.world)==null||e.dispose(),this._world=null,this._grid=null}connectedCallback(){super.connectedCallback(),new ResizeObserver(this.resize).observe(this)}disconnectedCallback(){super.disconnectedCallback(),this.dispose()}render(){return Qa`<slot></slot>`}};ah.styles=Za`
    :host {
      position: relative;
      display: flex;
      min-width: 0px;
      height: 100%;
      background-color: var(--bim-ui_bg-base);
    }
  `;let Lo=ah;Po([Oe({type:String,attribute:"grid-color",reflect:!0})],Lo.prototype,"gridColor");Po([Oe({type:Number,attribute:"grid-scale-x",reflect:!0})],Lo.prototype,"gridScaleX");Po([Oe({type:Number,attribute:"grid-scale-y",reflect:!0})],Lo.prototype,"gridScaleY");Po([Oe({type:Number,attribute:"grid-offset-x",reflect:!0})],Lo.prototype,"gridOffsetX");Po([Oe({type:Number,attribute:"grid-offset-y",reflect:!0})],Lo.prototype,"gridOffsetY");var xy=Object.defineProperty,ei=(t,e,i,o)=>{for(var n=void 0,s=t.length-1,r;s>=0;s--)(r=t[s])&&(n=r(e,i,n)||n);return n&&xy(e,i,n),n};const lh=class extends vi{constructor(){super(...arguments),this._defaults={size:60},this._cssMatrix3D="",this._matrix=new ki,this._onRightClick=new Event("rightclick"),this._onLeftClick=new Event("leftclick"),this._onTopClick=new Event("topclick"),this._onBottomClick=new Event("bottomclick"),this._onFrontClick=new Event("frontclick"),this._onBackClick=new Event("backclick"),this._camera=null,this._epsilon=e=>Math.abs(e)<1e-10?0:e}set camera(e){this._camera=e,this.updateOrientation()}get camera(){return this._camera}updateOrientation(){if(!this.camera)return;this._matrix.extractRotation(this.camera.matrixWorldInverse);const{elements:e}=this._matrix;this._cssMatrix3D=`matrix3d(
      ${this._epsilon(e[0])},
      ${this._epsilon(-e[1])},
      ${this._epsilon(e[2])},
      ${this._epsilon(e[3])},
      ${this._epsilon(e[4])},
      ${this._epsilon(-e[5])},
      ${this._epsilon(e[6])},
      ${this._epsilon(e[7])},
      ${this._epsilon(e[8])},
      ${this._epsilon(-e[9])},
      ${this._epsilon(e[10])},
      ${this._epsilon(e[11])},
      ${this._epsilon(e[12])},
      ${this._epsilon(-e[13])},
      ${this._epsilon(e[14])},
      ${this._epsilon(e[15])})
    `}render(){const e=this.size??this._defaults.size;return Qa`
      <style>
        .face,
        .cube {
          width: ${e}px;
          height: ${e}px;
          transform: translateZ(-300px) ${this._cssMatrix3D};
        }

        .face-right {
          translate: ${e/2}px 0 0;
        }

        .face-left {
          translate: ${-e/2}px 0 0;
        }

        .face-top {
          translate: 0 ${e/2}px 0;
        }

        .face-bottom {
          translate: 0 ${-e/2}px 0;
        }

        .face-front {
          translate: 0 0 ${e/2}px;
        }

        .face-back {
          translate: 0 0 ${-e/2}px;
        }
      </style>
      <div class="parent">
        <div class="cube">
          <div
            class="face x-direction face-right"
            @click=${()=>this.dispatchEvent(this._onRightClick)}
          >
            ${this.rightText}
          </div>
          <div
            class="face x-direction face-left"
            @click=${()=>this.dispatchEvent(this._onLeftClick)}
          >
            ${this.leftText}
          </div>
          <div
            class="face y-direction face-top"
            @click=${()=>this.dispatchEvent(this._onTopClick)}
          >
            ${this.topText}
          </div>
          <div
            class="face y-direction face-bottom"
            @click=${()=>this.dispatchEvent(this._onBottomClick)}
          >
            ${this.bottomText}
          </div>
          <div
            class="face z-direction face-front"
            @click=${()=>this.dispatchEvent(this._onFrontClick)}
          >
            ${this.frontText}
          </div>
          <div
            class="face z-direction face-back"
            @click=${()=>this.dispatchEvent(this._onBackClick)}
          >
            ${this.backText}
          </div>
        </div>
      </div>
    `}};lh.styles=Za`
    :host {
      position: absolute;
      z-index: 999;
      bottom: 1rem;
      right: 1rem;
    }

    .parent {
      perspective: 400px;
    }

    .cube {
      position: relative;
      transform-style: preserve-3d;
    }

    .face {
      position: absolute;
      display: flex;
      justify-content: center;
      user-select: none;
      align-items: center;
      cursor: pointer;
      text-align: center;
      transition: all 0.2s;
      color: var(--bim-view-cube--c, white);
      font-size: var(--bim-view-cube--fz, --bim-ui_size-2xl);
    }

    .x-direction {
      // background-color: var(--bim-view-cube_x--bgc, #c93830DD);
      background-color: var(--bim-view-cube_x--bgc, #01a6bcde);
    }

    .x-direction:hover {
      background-color: var(--bim-ui_accent-base, white);
    }

    .y-direction {
      // background-color: var(--bim-view-cube_y--bgc, #54ff19DD);
      background-color: var(--bim-view-cube_y--bgc, #8d0ec8de);
    }

    .y-direction:hover {
      background-color: var(--bim-ui_accent-base, white);
    }

    .z-direction {
      // background-color: var(--bim-view-cube_z--bgc, #3041c9DD);
      background-color: var(--bim-view-cube_z--bgc, #2718afde);
    }

    .z-direction:hover {
      background-color: var(--bim-ui_accent-base, white);
    }

    .face-front {
      transform: rotateX(180deg);
    }

    .face-back {
      transform: rotateZ(180deg);
    }

    .face-top {
      transform: rotateX(90deg);
    }

    .face-bottom {
      transform: rotateX(270deg);
    }

    .face-right {
      transform: rotateY(-270deg) rotateX(180deg);
    }

    .face-left {
      transform: rotateY(-90deg) rotateX(180deg);
    }
  `;let ti=lh;ei([Oe({type:Number,reflect:!0})],ti.prototype,"size");ei([Oe({type:String,attribute:"right-text",reflect:!0})],ti.prototype,"rightText");ei([Oe({type:String,attribute:"left-text",reflect:!0})],ti.prototype,"leftText");ei([Oe({type:String,attribute:"top-text",reflect:!0})],ti.prototype,"topText");ei([Oe({type:String,attribute:"bottom-text",reflect:!0})],ti.prototype,"bottomText");ei([Oe({type:String,attribute:"front-text",reflect:!0})],ti.prototype,"frontText");ei([Oe({type:String,attribute:"back-text",reflect:!0})],ti.prototype,"backText");ei([yy()],ti.prototype,"_cssMatrix3D");/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Ey=t=>t.strings===void 0;/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Sy={CHILD:2},Cy=t=>(...e)=>({_$litDirective$:t,values:e});class Ay{constructor(e){}get _$AU(){return this._$AM._$AU}_$AT(e,i,o){this._$Ct=e,this._$AM=i,this._$Ci=o}_$AS(e,i){return this.update(e,i)}update(e,i){return this.render(...i)}}/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Wn=(t,e)=>{var i;const o=t._$AN;if(o===void 0)return!1;for(const n of o)(i=n._$AO)==null||i.call(n,e,!1),Wn(n,e);return!0},$s=t=>{let e,i;do{if((e=t._$AM)===void 0)break;i=e._$AN,i.delete(t),t=e}while(i?.size===0)},ch=t=>{for(let e;e=t._$AM;t=e){let i=e._$AN;if(i===void 0)e._$AN=i=new Set;else if(i.has(t))break;i.add(t),Oy(e)}};function ky(t){this._$AN!==void 0?($s(this),this._$AM=t,ch(this)):this._$AM=t}function Ty(t,e=!1,i=0){const o=this._$AH,n=this._$AN;if(n!==void 0&&n.size!==0)if(e)if(Array.isArray(o))for(let s=i;s<o.length;s++)Wn(o[s],!1),$s(o[s]);else o!=null&&(Wn(o,!1),$s(o));else Wn(this,t)}const Oy=t=>{t.type==Sy.CHILD&&(t._$AP??(t._$AP=Ty),t._$AQ??(t._$AQ=ky))};let Iy=class extends Ay{constructor(){super(...arguments),this._$AN=void 0}_$AT(t,e,i){super._$AT(t,e,i),ch(this),this.isConnected=t._$AU}_$AO(t,e=!0){var i,o;t!==this.isConnected&&(this.isConnected=t,t?(i=this.reconnected)==null||i.call(this):(o=this.disconnected)==null||o.call(this)),e&&(Wn(this,t),$s(this))}setValue(t){if(Ey(this._$Ct))this._$Ct._$AI(t,this);else{const e=[...this._$Ct._$AH];e[this._$Ci]=t,this._$Ct._$AI(e,this,0)}}disconnected(){}reconnected(){}};/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const ia=()=>new Py;class Py{}const Sr=new WeakMap,Ly=Cy(class extends Iy{render(t){return pe}update(t,[e]){var i;const o=e!==this.G;return o&&this.G!==void 0&&this.rt(void 0),(o||this.lt!==this.ct)&&(this.G=e,this.ht=(i=t.options)==null?void 0:i.host,this.rt(this.ct=t.element)),pe}rt(t){if(this.isConnected||(t=void 0),typeof this.G=="function"){const e=this.ht??globalThis;let i=Sr.get(e);i===void 0&&(i=new WeakMap,Sr.set(e,i)),i.get(this.G)!==void 0&&this.G.call(this.ht,void 0),i.set(this.G,t),t!==void 0&&this.G.call(this.ht,t)}else this.G.value=t}get lt(){var t,e;return typeof this.G=="function"?(t=Sr.get(this.ht??globalThis))==null?void 0:t.get(this.G):(e=this.G)==null?void 0:e.value}disconnected(){this.lt===this.ct&&this.rt(void 0)}reconnected(){this.rt(this.ct)}});var My=Object.defineProperty,zy=(t,e,i,o)=>{for(var n=void 0,s=t.length-1,r;s>=0;s--)(r=t[s])&&(n=r(e,i,n)||n);return n&&My(e,i,n),n};const dh=class extends vi{constructor(){super(...arguments),this.world=null,this._components=null,this._viewport=ia()}set components(e){var i;if(this._components=e,this.components){const o=this.components.get(Ds);this.world=o.create(),this.world.name=this.name}else(i=this.world)==null||i.dispose(),this.world=null}get components(){return this._components}connectedCallback(){super.connectedCallback(),this.world&&(this.world.enabled=!0)}disconnectedCallback(){super.disconnectedCallback(),this.world&&(this.world.enabled=!1)}dispose(){this.components=null,this.remove()}firstUpdated(){const{value:e}=this._viewport;if(!(this.components&&e&&this.world))return;const i=new $a(this.components);this.world.scene=i,i.setup(),i.three.background=null;const o=new Ad(this.components,e);this.world.renderer=o;const n=new _a(this.components);this.world.camera=n;const s=this.components.get(kd).create(this.world);s.material.uniforms.uColor.value=new as(4342338),s.material.uniforms.uSize1.value=2,s.material.uniforms.uSize2.value=8}onSlotChange(){const e=new Event("slotchange");this.dispatchEvent(e)}render(){return Qa` <bim-viewport ${Ly(this._viewport)}>
      <slot @slotchange=${this.onSlotChange}></slot>
    </bim-viewport>`}};dh.styles=Za``;let Dy=dh;zy([Oe({type:String,reflect:!0})],Dy.prototype,"name");var Ry=Object.defineProperty,jy=(t,e,i)=>e in t?Ry(t,e,{enumerable:!0,configurable:!0,writable:!0,value:i}):t[e]=i,di=(t,e,i)=>(jy(t,typeof e!="symbol"?e+"":e,i),i);const hn=Math.min,Tt=Math.max,_s=Math.round,Wt=t=>({x:t,y:t}),Ny={left:"right",right:"left",bottom:"top",top:"bottom"},By={start:"end",end:"start"};function Mc(t,e,i){return Tt(t,hn(e,i))}function Mo(t,e){return typeof t=="function"?t(e):t}function Lt(t){return t.split("-")[0]}function ir(t){return t.split("-")[1]}function uh(t){return t==="x"?"y":"x"}function hh(t){return t==="y"?"height":"width"}const Fy=new Set(["top","bottom"]);function At(t){return Fy.has(Lt(t))?"y":"x"}function ph(t){return uh(At(t))}function Uy(t,e,i){i===void 0&&(i=!1);const o=ir(t),n=ph(t),s=hh(n);let r=n==="x"?o===(i?"end":"start")?"right":"left":o==="start"?"bottom":"top";return e.reference[s]>e.floating[s]&&(r=xs(r)),[r,xs(r)]}function Hy(t){const e=xs(t);return[na(t),e,na(e)]}function na(t){return t.replace(/start|end/g,e=>By[e])}const zc=["left","right"],Dc=["right","left"],Vy=["top","bottom"],qy=["bottom","top"];function Gy(t,e,i){switch(t){case"top":case"bottom":return i?e?Dc:zc:e?zc:Dc;case"left":case"right":return e?Vy:qy;default:return[]}}function Wy(t,e,i,o){const n=ir(t);let s=Gy(Lt(t),i==="start",o);return n&&(s=s.map(r=>r+"-"+n),e&&(s=s.concat(s.map(na)))),s}function xs(t){return t.replace(/left|right|bottom|top/g,e=>Ny[e])}function Yy(t){return{top:0,right:0,bottom:0,left:0,...t}}function fh(t){return typeof t!="number"?Yy(t):{top:t,right:t,bottom:t,left:t}}function pn(t){const{x:e,y:i,width:o,height:n}=t;return{width:o,height:n,top:i,left:e,right:e+o,bottom:i+n,x:e,y:i}}function Rc(t,e,i){let{reference:o,floating:n}=t;const s=At(e),r=ph(e),a=hh(r),l=Lt(e),c=s==="y",d=o.x+o.width/2-n.width/2,u=o.y+o.height/2-n.height/2,h=o[a]/2-n[a]/2;let p;switch(l){case"top":p={x:d,y:o.y-n.height};break;case"bottom":p={x:d,y:o.y+o.height};break;case"right":p={x:o.x+o.width,y:u};break;case"left":p={x:o.x-n.width,y:u};break;default:p={x:o.x,y:o.y}}switch(ir(e)){case"start":p[r]-=h*(i&&c?-1:1);break;case"end":p[r]+=h*(i&&c?-1:1);break}return p}const Xy=async(t,e,i)=>{const{placement:o="bottom",strategy:n="absolute",middleware:s=[],platform:r}=i,a=s.filter(Boolean),l=await(r.isRTL==null?void 0:r.isRTL(e));let c=await r.getElementRects({reference:t,floating:e,strategy:n}),{x:d,y:u}=Rc(c,o,l),h=o,p={},m=0;for(let g=0;g<a.length;g++){const{name:f,fn:v}=a[g],{x:y,y:b,data:$,reset:C}=await v({x:d,y:u,initialPlacement:o,placement:h,strategy:n,middlewareData:p,rects:c,platform:r,elements:{reference:t,floating:e}});d=y??d,u=b??u,p={...p,[f]:{...p[f],...$}},C&&m<=50&&(m++,typeof C=="object"&&(C.placement&&(h=C.placement),C.rects&&(c=C.rects===!0?await r.getElementRects({reference:t,floating:e,strategy:n}):C.rects),{x:d,y:u}=Rc(c,h,l)),g=-1)}return{x:d,y:u,placement:h,strategy:n,middlewareData:p}};async function mh(t,e){var i;e===void 0&&(e={});const{x:o,y:n,platform:s,rects:r,elements:a,strategy:l}=t,{boundary:c="clippingAncestors",rootBoundary:d="viewport",elementContext:u="floating",altBoundary:h=!1,padding:p=0}=Mo(e,t),m=fh(p),g=a[h?u==="floating"?"reference":"floating":u],f=pn(await s.getClippingRect({element:(i=await(s.isElement==null?void 0:s.isElement(g)))==null||i?g:g.contextElement||await(s.getDocumentElement==null?void 0:s.getDocumentElement(a.floating)),boundary:c,rootBoundary:d,strategy:l})),v=u==="floating"?{x:o,y:n,width:r.floating.width,height:r.floating.height}:r.reference,y=await(s.getOffsetParent==null?void 0:s.getOffsetParent(a.floating)),b=await(s.isElement==null?void 0:s.isElement(y))?await(s.getScale==null?void 0:s.getScale(y))||{x:1,y:1}:{x:1,y:1},$=pn(s.convertOffsetParentRelativeRectToViewportRelativeRect?await s.convertOffsetParentRelativeRectToViewportRelativeRect({elements:a,rect:v,offsetParent:y,strategy:l}):v);return{top:(f.top-$.top+m.top)/b.y,bottom:($.bottom-f.bottom+m.bottom)/b.y,left:(f.left-$.left+m.left)/b.x,right:($.right-f.right+m.right)/b.x}}const Zy=function(t){return t===void 0&&(t={}),{name:"flip",options:t,async fn(e){var i,o;const{placement:n,middlewareData:s,rects:r,initialPlacement:a,platform:l,elements:c}=e,{mainAxis:d=!0,crossAxis:u=!0,fallbackPlacements:h,fallbackStrategy:p="bestFit",fallbackAxisSideDirection:m="none",flipAlignment:g=!0,...f}=Mo(t,e);if((i=s.arrow)!=null&&i.alignmentOffset)return{};const v=Lt(n),y=At(a),b=Lt(a)===a,$=await(l.isRTL==null?void 0:l.isRTL(c.floating)),C=h||(b||!g?[xs(a)]:Hy(a)),E=m!=="none";!h&&E&&C.push(...Wy(a,g,m,$));const A=[a,...C],P=await mh(e,f),M=[];let O=((o=s.flip)==null?void 0:o.overflows)||[];if(d&&M.push(P[v]),u){const I=Uy(n,r,$);M.push(P[I[0]],P[I[1]])}if(O=[...O,{placement:n,overflows:M}],!M.every(I=>I<=0)){var U,z;const I=(((U=s.flip)==null?void 0:U.index)||0)+1,H=A[I];if(H&&(!(u==="alignment"&&y!==At(H))||O.every(Z=>At(Z.placement)===y?Z.overflows[0]>0:!0)))return{data:{index:I,overflows:O},reset:{placement:H}};let ne=(z=O.filter(Z=>Z.overflows[0]<=0).sort((Z,V)=>Z.overflows[1]-V.overflows[1])[0])==null?void 0:z.placement;if(!ne)switch(p){case"bestFit":{var X;const Z=(X=O.filter(V=>{if(E){const q=At(V.placement);return q===y||q==="y"}return!0}).map(V=>[V.placement,V.overflows.filter(q=>q>0).reduce((q,fe)=>q+fe,0)]).sort((V,q)=>V[1]-q[1])[0])==null?void 0:X[0];Z&&(ne=Z);break}case"initialPlacement":ne=a;break}if(n!==ne)return{reset:{placement:ne}}}return{}}}};function bh(t){const e=hn(...t.map(s=>s.left)),i=hn(...t.map(s=>s.top)),o=Tt(...t.map(s=>s.right)),n=Tt(...t.map(s=>s.bottom));return{x:e,y:i,width:o-e,height:n-i}}function Jy(t){const e=t.slice().sort((n,s)=>n.y-s.y),i=[];let o=null;for(let n=0;n<e.length;n++){const s=e[n];!o||s.y-o.y>o.height/2?i.push([s]):i[i.length-1].push(s),o=s}return i.map(n=>pn(bh(n)))}const Ky=function(t){return t===void 0&&(t={}),{name:"inline",options:t,async fn(e){const{placement:i,elements:o,rects:n,platform:s,strategy:r}=e,{padding:a=2,x:l,y:c}=Mo(t,e),d=Array.from(await(s.getClientRects==null?void 0:s.getClientRects(o.reference))||[]),u=Jy(d),h=pn(bh(d)),p=fh(a);function m(){if(u.length===2&&u[0].left>u[1].right&&l!=null&&c!=null)return u.find(f=>l>f.left-p.left&&l<f.right+p.right&&c>f.top-p.top&&c<f.bottom+p.bottom)||h;if(u.length>=2){if(At(i)==="y"){const O=u[0],U=u[u.length-1],z=Lt(i)==="top",X=O.top,I=U.bottom,H=z?O.left:U.left,ne=z?O.right:U.right,Z=ne-H,V=I-X;return{top:X,bottom:I,left:H,right:ne,width:Z,height:V,x:H,y:X}}const f=Lt(i)==="left",v=Tt(...u.map(O=>O.right)),y=hn(...u.map(O=>O.left)),b=u.filter(O=>f?O.left===y:O.right===v),$=b[0].top,C=b[b.length-1].bottom,E=y,A=v,P=A-E,M=C-$;return{top:$,bottom:C,left:E,right:A,width:P,height:M,x:E,y:$}}return h}const g=await s.getElementRects({reference:{getBoundingClientRect:m},floating:o.floating,strategy:r});return n.reference.x!==g.reference.x||n.reference.y!==g.reference.y||n.reference.width!==g.reference.width||n.reference.height!==g.reference.height?{reset:{rects:g}}:{}}}},Qy=new Set(["left","top"]);async function ev(t,e){const{placement:i,platform:o,elements:n}=t,s=await(o.isRTL==null?void 0:o.isRTL(n.floating)),r=Lt(i),a=ir(i),l=At(i)==="y",c=Qy.has(r)?-1:1,d=s&&l?-1:1,u=Mo(e,t);let{mainAxis:h,crossAxis:p,alignmentAxis:m}=typeof u=="number"?{mainAxis:u,crossAxis:0,alignmentAxis:null}:{mainAxis:u.mainAxis||0,crossAxis:u.crossAxis||0,alignmentAxis:u.alignmentAxis};return a&&typeof m=="number"&&(p=a==="end"?m*-1:m),l?{x:p*d,y:h*c}:{x:h*c,y:p*d}}const el=function(t){return{name:"offset",options:t,async fn(e){var i,o;const{x:n,y:s,placement:r,middlewareData:a}=e,l=await ev(e,t);return r===((i=a.offset)==null?void 0:i.placement)&&(o=a.arrow)!=null&&o.alignmentOffset?{}:{x:n+l.x,y:s+l.y,data:{...l,placement:r}}}}},tv=function(t){return t===void 0&&(t={}),{name:"shift",options:t,async fn(e){const{x:i,y:o,placement:n}=e,{mainAxis:s=!0,crossAxis:r=!1,limiter:a={fn:f=>{let{x:v,y}=f;return{x:v,y}}},...l}=Mo(t,e),c={x:i,y:o},d=await mh(e,l),u=At(Lt(n)),h=uh(u);let p=c[h],m=c[u];if(s){const f=h==="y"?"top":"left",v=h==="y"?"bottom":"right",y=p+d[f],b=p-d[v];p=Mc(y,p,b)}if(r){const f=u==="y"?"top":"left",v=u==="y"?"bottom":"right",y=m+d[f],b=m-d[v];m=Mc(y,m,b)}const g=a.fn({...e,[h]:p,[u]:m});return{...g,data:{x:g.x-i,y:g.y-o,enabled:{[h]:s,[u]:r}}}}}};function nr(){return typeof window<"u"}function Yt(t){return gh(t)?(t.nodeName||"").toLowerCase():"#document"}function je(t){var e;return(t==null||(e=t.ownerDocument)==null?void 0:e.defaultView)||window}function ii(t){var e;return(e=(gh(t)?t.ownerDocument:t.document)||window.document)==null?void 0:e.documentElement}function gh(t){return nr()?t instanceof Node||t instanceof je(t).Node:!1}function yt(t){return nr()?t instanceof Element||t instanceof je(t).Element:!1}function vt(t){return nr()?t instanceof HTMLElement||t instanceof je(t).HTMLElement:!1}function jc(t){return!nr()||typeof ShadowRoot>"u"?!1:t instanceof ShadowRoot||t instanceof je(t).ShadowRoot}const iv=new Set(["inline","contents"]);function zo(t){const{overflow:e,overflowX:i,overflowY:o,display:n}=Ge(t);return/auto|scroll|overlay|hidden|clip/.test(e+o+i)&&!iv.has(n)}const nv=new Set(["table","td","th"]);function ov(t){return nv.has(Yt(t))}const sv=[":popover-open",":modal"];function rv(t){return sv.some(e=>{try{return t.matches(e)}catch{return!1}})}const av=["transform","translate","scale","rotate","perspective"],lv=["transform","translate","scale","rotate","perspective","filter"],cv=["paint","layout","strict","content"];function tl(t){const e=il(),i=yt(t)?Ge(t):t;return av.some(o=>i[o]?i[o]!=="none":!1)||(i.containerType?i.containerType!=="normal":!1)||!e&&(i.backdropFilter?i.backdropFilter!=="none":!1)||!e&&(i.filter?i.filter!=="none":!1)||lv.some(o=>(i.willChange||"").includes(o))||cv.some(o=>(i.contain||"").includes(o))}function dv(t){let e=fn(t);for(;vt(e)&&!or(e);){if(tl(e))return e;if(rv(e))return null;e=fn(e)}return null}function il(){return typeof CSS>"u"||!CSS.supports?!1:CSS.supports("-webkit-backdrop-filter","none")}const uv=new Set(["html","body","#document"]);function or(t){return uv.has(Yt(t))}function Ge(t){return je(t).getComputedStyle(t)}function sr(t){return yt(t)?{scrollLeft:t.scrollLeft,scrollTop:t.scrollTop}:{scrollLeft:t.scrollX,scrollTop:t.scrollY}}function fn(t){if(Yt(t)==="html")return t;const e=t.assignedSlot||t.parentNode||jc(t)&&t.host||ii(t);return jc(e)?e.host:e}function yh(t){const e=fn(t);return or(e)?t.ownerDocument?t.ownerDocument.body:t.body:vt(e)&&zo(e)?e:yh(e)}function vh(t,e,i){var o;e===void 0&&(e=[]);const n=yh(t),s=n===((o=t.ownerDocument)==null?void 0:o.body),r=je(n);return s?(hv(r),e.concat(r,r.visualViewport||[],zo(n)?n:[],[])):e.concat(n,vh(n,[]))}function hv(t){return t.parent&&Object.getPrototypeOf(t.parent)?t.frameElement:null}function wh(t){const e=Ge(t);let i=parseFloat(e.width)||0,o=parseFloat(e.height)||0;const n=vt(t),s=n?t.offsetWidth:i,r=n?t.offsetHeight:o,a=_s(i)!==s||_s(o)!==r;return a&&(i=s,o=r),{width:i,height:o,$:a}}function $h(t){return yt(t)?t:t.contextElement}function Xi(t){const e=$h(t);if(!vt(e))return Wt(1);const i=e.getBoundingClientRect(),{width:o,height:n,$:s}=wh(e);let r=(s?_s(i.width):i.width)/o,a=(s?_s(i.height):i.height)/n;return(!r||!Number.isFinite(r))&&(r=1),(!a||!Number.isFinite(a))&&(a=1),{x:r,y:a}}const pv=Wt(0);function _h(t){const e=je(t);return!il()||!e.visualViewport?pv:{x:e.visualViewport.offsetLeft,y:e.visualViewport.offsetTop}}function fv(t,e,i){return e===void 0&&(e=!1),!i||e&&i!==je(t)?!1:e}function co(t,e,i,o){e===void 0&&(e=!1),i===void 0&&(i=!1);const n=t.getBoundingClientRect(),s=$h(t);let r=Wt(1);e&&(o?yt(o)&&(r=Xi(o)):r=Xi(t));const a=fv(s,i,o)?_h(s):Wt(0);let l=(n.left+a.x)/r.x,c=(n.top+a.y)/r.y,d=n.width/r.x,u=n.height/r.y;if(s){const h=je(s),p=o&&yt(o)?je(o):o;let m=h,g=m.frameElement;for(;g&&o&&p!==m;){const f=Xi(g),v=g.getBoundingClientRect(),y=Ge(g),b=v.left+(g.clientLeft+parseFloat(y.paddingLeft))*f.x,$=v.top+(g.clientTop+parseFloat(y.paddingTop))*f.y;l*=f.x,c*=f.y,d*=f.x,u*=f.y,l+=b,c+=$,m=je(g),g=m.frameElement}}return pn({width:d,height:u,x:l,y:c})}const mv=[":popover-open",":modal"];function xh(t){return mv.some(e=>{try{return t.matches(e)}catch{return!1}})}function bv(t){let{elements:e,rect:i,offsetParent:o,strategy:n}=t;const s=n==="fixed",r=ii(o),a=e?xh(e.floating):!1;if(o===r||a&&s)return i;let l={scrollLeft:0,scrollTop:0},c=Wt(1);const d=Wt(0),u=vt(o);if((u||!u&&!s)&&((Yt(o)!=="body"||zo(r))&&(l=sr(o)),vt(o))){const h=co(o);c=Xi(o),d.x=h.x+o.clientLeft,d.y=h.y+o.clientTop}return{width:i.width*c.x,height:i.height*c.y,x:i.x*c.x-l.scrollLeft*c.x+d.x,y:i.y*c.y-l.scrollTop*c.y+d.y}}function gv(t){return Array.from(t.getClientRects())}function Eh(t){return co(ii(t)).left+sr(t).scrollLeft}function yv(t){const e=ii(t),i=sr(t),o=t.ownerDocument.body,n=Tt(e.scrollWidth,e.clientWidth,o.scrollWidth,o.clientWidth),s=Tt(e.scrollHeight,e.clientHeight,o.scrollHeight,o.clientHeight);let r=-i.scrollLeft+Eh(t);const a=-i.scrollTop;return Ge(o).direction==="rtl"&&(r+=Tt(e.clientWidth,o.clientWidth)-n),{width:n,height:s,x:r,y:a}}function vv(t,e){const i=je(t),o=ii(t),n=i.visualViewport;let s=o.clientWidth,r=o.clientHeight,a=0,l=0;if(n){s=n.width,r=n.height;const c=il();(!c||c&&e==="fixed")&&(a=n.offsetLeft,l=n.offsetTop)}return{width:s,height:r,x:a,y:l}}function wv(t,e){const i=co(t,!0,e==="fixed"),o=i.top+t.clientTop,n=i.left+t.clientLeft,s=vt(t)?Xi(t):Wt(1),r=t.clientWidth*s.x,a=t.clientHeight*s.y,l=n*s.x,c=o*s.y;return{width:r,height:a,x:l,y:c}}function Nc(t,e,i){let o;if(e==="viewport")o=vv(t,i);else if(e==="document")o=yv(ii(t));else if(yt(e))o=wv(e,i);else{const n=_h(t);o={...e,x:e.x-n.x,y:e.y-n.y}}return pn(o)}function Sh(t,e){const i=fn(t);return i===e||!yt(i)||or(i)?!1:Ge(i).position==="fixed"||Sh(i,e)}function $v(t,e){const i=e.get(t);if(i)return i;let o=vh(t,[]).filter(a=>yt(a)&&Yt(a)!=="body"),n=null;const s=Ge(t).position==="fixed";let r=s?fn(t):t;for(;yt(r)&&!or(r);){const a=Ge(r),l=tl(r);!l&&a.position==="fixed"&&(n=null),(s?!l&&!n:!l&&a.position==="static"&&n&&["absolute","fixed"].includes(n.position)||zo(r)&&!l&&Sh(t,r))?o=o.filter(c=>c!==r):n=a,r=fn(r)}return e.set(t,o),o}function _v(t){let{element:e,boundary:i,rootBoundary:o,strategy:n}=t;const s=[...i==="clippingAncestors"?$v(e,this._c):[].concat(i),o],r=s[0],a=s.reduce((l,c)=>{const d=Nc(e,c,n);return l.top=Tt(d.top,l.top),l.right=hn(d.right,l.right),l.bottom=hn(d.bottom,l.bottom),l.left=Tt(d.left,l.left),l},Nc(e,r,n));return{width:a.right-a.left,height:a.bottom-a.top,x:a.left,y:a.top}}function xv(t){const{width:e,height:i}=wh(t);return{width:e,height:i}}function Ev(t,e,i){const o=vt(e),n=ii(e),s=i==="fixed",r=co(t,!0,s,e);let a={scrollLeft:0,scrollTop:0};const l=Wt(0);if(o||!o&&!s)if((Yt(e)!=="body"||zo(n))&&(a=sr(e)),o){const u=co(e,!0,s,e);l.x=u.x+e.clientLeft,l.y=u.y+e.clientTop}else n&&(l.x=Eh(n));const c=r.left+a.scrollLeft-l.x,d=r.top+a.scrollTop-l.y;return{x:c,y:d,width:r.width,height:r.height}}function Bc(t,e){return!vt(t)||Ge(t).position==="fixed"?null:e?e(t):t.offsetParent}function Ch(t,e){const i=je(t);if(!vt(t)||xh(t))return i;let o=Bc(t,e);for(;o&&ov(o)&&Ge(o).position==="static";)o=Bc(o,e);return o&&(Yt(o)==="html"||Yt(o)==="body"&&Ge(o).position==="static"&&!tl(o))?i:o||dv(t)||i}const Sv=async function(t){const e=this.getOffsetParent||Ch,i=this.getDimensions;return{reference:Ev(t.reference,await e(t.floating),t.strategy),floating:{x:0,y:0,...await i(t.floating)}}};function Cv(t){return Ge(t).direction==="rtl"}const Av={convertOffsetParentRelativeRectToViewportRelativeRect:bv,getDocumentElement:ii,getClippingRect:_v,getOffsetParent:Ch,getElementRects:Sv,getClientRects:gv,getDimensions:xv,getScale:Xi,isElement:yt,isRTL:Cv},nl=tv,ol=Zy,sl=Ky,rl=(t,e,i)=>{const o=new Map,n={platform:Av,...i},s={...n.platform,_c:o};return Xy(t,e,{...n,platform:s})};/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const is=globalThis,al=is.ShadowRoot&&(is.ShadyCSS===void 0||is.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,ll=Symbol(),Fc=new WeakMap;let Ah=class{constructor(t,e,i){if(this._$cssResult$=!0,i!==ll)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=e}get styleSheet(){let t=this.o;const e=this.t;if(al&&t===void 0){const i=e!==void 0&&e.length===1;i&&(t=Fc.get(e)),t===void 0&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),i&&Fc.set(e,t))}return t}toString(){return this.cssText}};const kv=t=>new Ah(typeof t=="string"?t:t+"",void 0,ll),ie=(t,...e)=>{const i=t.length===1?t[0]:e.reduce((o,n,s)=>o+(r=>{if(r._$cssResult$===!0)return r.cssText;if(typeof r=="number")return r;throw Error("Value passed to 'css' function must be a 'css' function result: "+r+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(n)+t[s+1],t[0]);return new Ah(i,t,ll)},Tv=(t,e)=>{if(al)t.adoptedStyleSheets=e.map(i=>i instanceof CSSStyleSheet?i:i.styleSheet);else for(const i of e){const o=document.createElement("style"),n=is.litNonce;n!==void 0&&o.setAttribute("nonce",n),o.textContent=i.cssText,t.appendChild(o)}},Uc=al?t=>t:t=>t instanceof CSSStyleSheet?(e=>{let i="";for(const o of e.cssRules)i+=o.cssText;return kv(i)})(t):t;/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const{is:Ov,defineProperty:Iv,getOwnPropertyDescriptor:Pv,getOwnPropertyNames:Lv,getOwnPropertySymbols:Mv,getPrototypeOf:zv}=Object,mn=globalThis,Hc=mn.trustedTypes,Dv=Hc?Hc.emptyScript:"",Vc=mn.reactiveElementPolyfillSupport,Yn=(t,e)=>t,Es={toAttribute(t,e){switch(e){case Boolean:t=t?Dv:null;break;case Object:case Array:t=t==null?t:JSON.stringify(t)}return t},fromAttribute(t,e){let i=t;switch(e){case Boolean:i=t!==null;break;case Number:i=t===null?null:Number(t);break;case Object:case Array:try{i=JSON.parse(t)}catch{i=null}}return i}},cl=(t,e)=>!Ov(t,e),qc={attribute:!0,type:String,converter:Es,reflect:!1,useDefault:!1,hasChanged:cl};Symbol.metadata??(Symbol.metadata=Symbol("metadata")),mn.litPropertyMetadata??(mn.litPropertyMetadata=new WeakMap);let Fi=class extends HTMLElement{static addInitializer(t){this._$Ei(),(this.l??(this.l=[])).push(t)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(t,e=qc){if(e.state&&(e.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(t)&&((e=Object.create(e)).wrapped=!0),this.elementProperties.set(t,e),!e.noAccessor){const i=Symbol(),o=this.getPropertyDescriptor(t,i,e);o!==void 0&&Iv(this.prototype,t,o)}}static getPropertyDescriptor(t,e,i){const{get:o,set:n}=Pv(this.prototype,t)??{get(){return this[e]},set(s){this[e]=s}};return{get:o,set(s){const r=o?.call(this);n?.call(this,s),this.requestUpdate(t,r,i)},configurable:!0,enumerable:!0}}static getPropertyOptions(t){return this.elementProperties.get(t)??qc}static _$Ei(){if(this.hasOwnProperty(Yn("elementProperties")))return;const t=zv(this);t.finalize(),t.l!==void 0&&(this.l=[...t.l]),this.elementProperties=new Map(t.elementProperties)}static finalize(){if(this.hasOwnProperty(Yn("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(Yn("properties"))){const e=this.properties,i=[...Lv(e),...Mv(e)];for(const o of i)this.createProperty(o,e[o])}const t=this[Symbol.metadata];if(t!==null){const e=litPropertyMetadata.get(t);if(e!==void 0)for(const[i,o]of e)this.elementProperties.set(i,o)}this._$Eh=new Map;for(const[e,i]of this.elementProperties){const o=this._$Eu(e,i);o!==void 0&&this._$Eh.set(o,e)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(t){const e=[];if(Array.isArray(t)){const i=new Set(t.flat(1/0).reverse());for(const o of i)e.unshift(Uc(o))}else t!==void 0&&e.push(Uc(t));return e}static _$Eu(t,e){const i=e.attribute;return i===!1?void 0:typeof i=="string"?i:typeof t=="string"?t.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){var t;this._$ES=new Promise(e=>this.enableUpdating=e),this._$AL=new Map,this._$E_(),this.requestUpdate(),(t=this.constructor.l)==null||t.forEach(e=>e(this))}addController(t){var e;(this._$EO??(this._$EO=new Set)).add(t),this.renderRoot!==void 0&&this.isConnected&&((e=t.hostConnected)==null||e.call(t))}removeController(t){var e;(e=this._$EO)==null||e.delete(t)}_$E_(){const t=new Map,e=this.constructor.elementProperties;for(const i of e.keys())this.hasOwnProperty(i)&&(t.set(i,this[i]),delete this[i]);t.size>0&&(this._$Ep=t)}createRenderRoot(){const t=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return Tv(t,this.constructor.elementStyles),t}connectedCallback(){var t;this.renderRoot??(this.renderRoot=this.createRenderRoot()),this.enableUpdating(!0),(t=this._$EO)==null||t.forEach(e=>{var i;return(i=e.hostConnected)==null?void 0:i.call(e)})}enableUpdating(t){}disconnectedCallback(){var t;(t=this._$EO)==null||t.forEach(e=>{var i;return(i=e.hostDisconnected)==null?void 0:i.call(e)})}attributeChangedCallback(t,e,i){this._$AK(t,i)}_$ET(t,e){var i;const o=this.constructor.elementProperties.get(t),n=this.constructor._$Eu(t,o);if(n!==void 0&&o.reflect===!0){const s=(((i=o.converter)==null?void 0:i.toAttribute)!==void 0?o.converter:Es).toAttribute(e,o.type);this._$Em=t,s==null?this.removeAttribute(n):this.setAttribute(n,s),this._$Em=null}}_$AK(t,e){var i,o;const n=this.constructor,s=n._$Eh.get(t);if(s!==void 0&&this._$Em!==s){const r=n.getPropertyOptions(s),a=typeof r.converter=="function"?{fromAttribute:r.converter}:((i=r.converter)==null?void 0:i.fromAttribute)!==void 0?r.converter:Es;this._$Em=s;const l=a.fromAttribute(e,r.type);this[s]=l??((o=this._$Ej)==null?void 0:o.get(s))??l,this._$Em=null}}requestUpdate(t,e,i,o=!1,n){var s;if(t!==void 0){const r=this.constructor;if(o===!1&&(n=this[t]),i??(i=r.getPropertyOptions(t)),!((i.hasChanged??cl)(n,e)||i.useDefault&&i.reflect&&n===((s=this._$Ej)==null?void 0:s.get(t))&&!this.hasAttribute(r._$Eu(t,i))))return;this.C(t,e,i)}this.isUpdatePending===!1&&(this._$ES=this._$EP())}C(t,e,{useDefault:i,reflect:o,wrapped:n},s){i&&!(this._$Ej??(this._$Ej=new Map)).has(t)&&(this._$Ej.set(t,s??e??this[t]),n!==!0||s!==void 0)||(this._$AL.has(t)||(this.hasUpdated||i||(e=void 0),this._$AL.set(t,e)),o===!0&&this._$Em!==t&&(this._$Eq??(this._$Eq=new Set)).add(t))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(e){Promise.reject(e)}const t=this.scheduleUpdate();return t!=null&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){var t;if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??(this.renderRoot=this.createRenderRoot()),this._$Ep){for(const[n,s]of this._$Ep)this[n]=s;this._$Ep=void 0}const o=this.constructor.elementProperties;if(o.size>0)for(const[n,s]of o){const{wrapped:r}=s,a=this[n];r!==!0||this._$AL.has(n)||a===void 0||this.C(n,void 0,s,a)}}let e=!1;const i=this._$AL;try{e=this.shouldUpdate(i),e?(this.willUpdate(i),(t=this._$EO)==null||t.forEach(o=>{var n;return(n=o.hostUpdate)==null?void 0:n.call(o)}),this.update(i)):this._$EM()}catch(o){throw e=!1,this._$EM(),o}e&&this._$AE(i)}willUpdate(t){}_$AE(t){var e;(e=this._$EO)==null||e.forEach(i=>{var o;return(o=i.hostUpdated)==null?void 0:o.call(i)}),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(t){return!0}update(t){this._$Eq&&(this._$Eq=this._$Eq.forEach(e=>this._$ET(e,this[e]))),this._$EM()}updated(t){}firstUpdated(t){}};Fi.elementStyles=[],Fi.shadowRootOptions={mode:"open"},Fi[Yn("elementProperties")]=new Map,Fi[Yn("finalized")]=new Map,Vc?.({ReactiveElement:Fi}),(mn.reactiveElementVersions??(mn.reactiveElementVersions=[])).push("2.1.2");/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Ss=globalThis,Gc=t=>t,Cs=Ss.trustedTypes,Wc=Cs?Cs.createPolicy("lit-html",{createHTML:t=>t}):void 0,kh="$lit$",Nt=`lit$${Math.random().toFixed(9).slice(2)}$`,Th="?"+Nt,Rv=`<${Th}>`,Ci=document,uo=()=>Ci.createComment(""),ho=t=>t===null||typeof t!="object"&&typeof t!="function",dl=Array.isArray,jv=t=>dl(t)||typeof t?.[Symbol.iterator]=="function",Cr=`[ 	
\f\r]`,Rn=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,Yc=/-->/g,Xc=/>/g,ui=RegExp(`>|${Cr}(?:([^\\s"'>=/]+)(${Cr}*=${Cr}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),Zc=/'/g,Jc=/"/g,Oh=/^(?:script|style|textarea|title)$/i,Nv=t=>(e,...i)=>({_$litType$:t,strings:e,values:i}),w=Nv(1),Ai=Symbol.for("lit-noChange"),se=Symbol.for("lit-nothing"),Kc=new WeakMap,mi=Ci.createTreeWalker(Ci,129);function Ih(t,e){if(!dl(t)||!t.hasOwnProperty("raw"))throw Error("invalid template strings array");return Wc!==void 0?Wc.createHTML(e):e}const Bv=(t,e)=>{const i=t.length-1,o=[];let n,s=e===2?"<svg>":e===3?"<math>":"",r=Rn;for(let a=0;a<i;a++){const l=t[a];let c,d,u=-1,h=0;for(;h<l.length&&(r.lastIndex=h,d=r.exec(l),d!==null);)h=r.lastIndex,r===Rn?d[1]==="!--"?r=Yc:d[1]!==void 0?r=Xc:d[2]!==void 0?(Oh.test(d[2])&&(n=RegExp("</"+d[2],"g")),r=ui):d[3]!==void 0&&(r=ui):r===ui?d[0]===">"?(r=n??Rn,u=-1):d[1]===void 0?u=-2:(u=r.lastIndex-d[2].length,c=d[1],r=d[3]===void 0?ui:d[3]==='"'?Jc:Zc):r===Jc||r===Zc?r=ui:r===Yc||r===Xc?r=Rn:(r=ui,n=void 0);const p=r===ui&&t[a+1].startsWith("/>")?" ":"";s+=r===Rn?l+Rv:u>=0?(o.push(c),l.slice(0,u)+kh+l.slice(u)+Nt+p):l+Nt+(u===-2?a:p)}return[Ih(t,s+(t[i]||"<?>")+(e===2?"</svg>":e===3?"</math>":"")),o]};class po{constructor({strings:e,_$litType$:i},o){let n;this.parts=[];let s=0,r=0;const a=e.length-1,l=this.parts,[c,d]=Bv(e,i);if(this.el=po.createElement(c,o),mi.currentNode=this.el.content,i===2||i===3){const u=this.el.content.firstChild;u.replaceWith(...u.childNodes)}for(;(n=mi.nextNode())!==null&&l.length<a;){if(n.nodeType===1){if(n.hasAttributes())for(const u of n.getAttributeNames())if(u.endsWith(kh)){const h=d[r++],p=n.getAttribute(u).split(Nt),m=/([.?@])?(.*)/.exec(h);l.push({type:1,index:s,name:m[2],strings:p,ctor:m[1]==="."?Uv:m[1]==="?"?Hv:m[1]==="@"?Vv:rr}),n.removeAttribute(u)}else u.startsWith(Nt)&&(l.push({type:6,index:s}),n.removeAttribute(u));if(Oh.test(n.tagName)){const u=n.textContent.split(Nt),h=u.length-1;if(h>0){n.textContent=Cs?Cs.emptyScript:"";for(let p=0;p<h;p++)n.append(u[p],uo()),mi.nextNode(),l.push({type:2,index:++s});n.append(u[h],uo())}}}else if(n.nodeType===8)if(n.data===Th)l.push({type:2,index:s});else{let u=-1;for(;(u=n.data.indexOf(Nt,u+1))!==-1;)l.push({type:7,index:s}),u+=Nt.length-1}s++}}static createElement(e,i){const o=Ci.createElement("template");return o.innerHTML=e,o}}function bn(t,e,i=t,o){var n,s;if(e===Ai)return e;let r=o!==void 0?(n=i._$Co)==null?void 0:n[o]:i._$Cl;const a=ho(e)?void 0:e._$litDirective$;return r?.constructor!==a&&((s=r?._$AO)==null||s.call(r,!1),a===void 0?r=void 0:(r=new a(t),r._$AT(t,i,o)),o!==void 0?(i._$Co??(i._$Co=[]))[o]=r:i._$Cl=r),r!==void 0&&(e=bn(t,r._$AS(t,e.values),r,o)),e}class Fv{constructor(e,i){this._$AV=[],this._$AN=void 0,this._$AD=e,this._$AM=i}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(e){const{el:{content:i},parts:o}=this._$AD,n=(e?.creationScope??Ci).importNode(i,!0);mi.currentNode=n;let s=mi.nextNode(),r=0,a=0,l=o[0];for(;l!==void 0;){if(r===l.index){let c;l.type===2?c=new Do(s,s.nextSibling,this,e):l.type===1?c=new l.ctor(s,l.name,l.strings,this,e):l.type===6&&(c=new qv(s,this,e)),this._$AV.push(c),l=o[++a]}r!==l?.index&&(s=mi.nextNode(),r++)}return mi.currentNode=Ci,n}p(e){let i=0;for(const o of this._$AV)o!==void 0&&(o.strings!==void 0?(o._$AI(e,o,i),i+=o.strings.length-2):o._$AI(e[i])),i++}}class Do{get _$AU(){var e;return((e=this._$AM)==null?void 0:e._$AU)??this._$Cv}constructor(e,i,o,n){this.type=2,this._$AH=se,this._$AN=void 0,this._$AA=e,this._$AB=i,this._$AM=o,this.options=n,this._$Cv=n?.isConnected??!0}get parentNode(){let e=this._$AA.parentNode;const i=this._$AM;return i!==void 0&&e?.nodeType===11&&(e=i.parentNode),e}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(e,i=this){e=bn(this,e,i),ho(e)?e===se||e==null||e===""?(this._$AH!==se&&this._$AR(),this._$AH=se):e!==this._$AH&&e!==Ai&&this._(e):e._$litType$!==void 0?this.$(e):e.nodeType!==void 0?this.T(e):jv(e)?this.k(e):this._(e)}O(e){return this._$AA.parentNode.insertBefore(e,this._$AB)}T(e){this._$AH!==e&&(this._$AR(),this._$AH=this.O(e))}_(e){this._$AH!==se&&ho(this._$AH)?this._$AA.nextSibling.data=e:this.T(Ci.createTextNode(e)),this._$AH=e}$(e){var i;const{values:o,_$litType$:n}=e,s=typeof n=="number"?this._$AC(e):(n.el===void 0&&(n.el=po.createElement(Ih(n.h,n.h[0]),this.options)),n);if(((i=this._$AH)==null?void 0:i._$AD)===s)this._$AH.p(o);else{const r=new Fv(s,this),a=r.u(this.options);r.p(o),this.T(a),this._$AH=r}}_$AC(e){let i=Kc.get(e.strings);return i===void 0&&Kc.set(e.strings,i=new po(e)),i}k(e){dl(this._$AH)||(this._$AH=[],this._$AR());const i=this._$AH;let o,n=0;for(const s of e)n===i.length?i.push(o=new Do(this.O(uo()),this.O(uo()),this,this.options)):o=i[n],o._$AI(s),n++;n<i.length&&(this._$AR(o&&o._$AB.nextSibling,n),i.length=n)}_$AR(e=this._$AA.nextSibling,i){var o;for((o=this._$AP)==null?void 0:o.call(this,!1,!0,i);e!==this._$AB;){const n=Gc(e).nextSibling;Gc(e).remove(),e=n}}setConnected(e){var i;this._$AM===void 0&&(this._$Cv=e,(i=this._$AP)==null||i.call(this,e))}}class rr{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(e,i,o,n,s){this.type=1,this._$AH=se,this._$AN=void 0,this.element=e,this.name=i,this._$AM=n,this.options=s,o.length>2||o[0]!==""||o[1]!==""?(this._$AH=Array(o.length-1).fill(new String),this.strings=o):this._$AH=se}_$AI(e,i=this,o,n){const s=this.strings;let r=!1;if(s===void 0)e=bn(this,e,i,0),r=!ho(e)||e!==this._$AH&&e!==Ai,r&&(this._$AH=e);else{const a=e;let l,c;for(e=s[0],l=0;l<s.length-1;l++)c=bn(this,a[o+l],i,l),c===Ai&&(c=this._$AH[l]),r||(r=!ho(c)||c!==this._$AH[l]),c===se?e=se:e!==se&&(e+=(c??"")+s[l+1]),this._$AH[l]=c}r&&!n&&this.j(e)}j(e){e===se?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,e??"")}}class Uv extends rr{constructor(){super(...arguments),this.type=3}j(e){this.element[this.name]=e===se?void 0:e}}class Hv extends rr{constructor(){super(...arguments),this.type=4}j(e){this.element.toggleAttribute(this.name,!!e&&e!==se)}}class Vv extends rr{constructor(e,i,o,n,s){super(e,i,o,n,s),this.type=5}_$AI(e,i=this){if((e=bn(this,e,i,0)??se)===Ai)return;const o=this._$AH,n=e===se&&o!==se||e.capture!==o.capture||e.once!==o.once||e.passive!==o.passive,s=e!==se&&(o===se||n);n&&this.element.removeEventListener(this.name,this,o),s&&this.element.addEventListener(this.name,this,e),this._$AH=e}handleEvent(e){var i;typeof this._$AH=="function"?this._$AH.call(((i=this.options)==null?void 0:i.host)??this.element,e):this._$AH.handleEvent(e)}}class qv{constructor(e,i,o){this.element=e,this.type=6,this._$AN=void 0,this._$AM=i,this.options=o}get _$AU(){return this._$AM._$AU}_$AI(e){bn(this,e)}}const Qc=Ss.litHtmlPolyfillSupport;Qc?.(po,Do),(Ss.litHtmlVersions??(Ss.litHtmlVersions=[])).push("3.3.2");const oa=(t,e,i)=>{const o=i?.renderBefore??e;let n=o._$litPart$;if(n===void 0){const s=i?.renderBefore??null;o._$litPart$=n=new Do(e.insertBefore(uo(),s),s,void 0,i??{})}return n._$AI(t),n};/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const fo=globalThis;let K=class extends Fi{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){var t;const e=super.createRenderRoot();return(t=this.renderOptions).renderBefore??(t.renderBefore=e.firstChild),e}update(t){const e=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=oa(e,this.renderRoot,this.renderOptions)}connectedCallback(){var t;super.connectedCallback(),(t=this._$Do)==null||t.setConnected(!0)}disconnectedCallback(){var t;super.disconnectedCallback(),(t=this._$Do)==null||t.setConnected(!1)}render(){return Ai}};var ed;K._$litElement$=!0,K.finalized=!0,(ed=fo.litElementHydrateSupport)==null||ed.call(fo,{LitElement:K});const td=fo.litElementPolyfillSupport;td?.({LitElement:K});(fo.litElementVersions??(fo.litElementVersions=[])).push("4.2.2");/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Gv={attribute:!0,type:String,converter:Es,reflect:!1,hasChanged:cl},Wv=(t=Gv,e,i)=>{const{kind:o,metadata:n}=i;let s=globalThis.litPropertyMetadata.get(n);if(s===void 0&&globalThis.litPropertyMetadata.set(n,s=new Map),o==="setter"&&((t=Object.create(t)).wrapped=!0),s.set(i.name,t),o==="accessor"){const{name:r}=i;return{set(a){const l=e.get.call(this);e.set.call(this,a),this.requestUpdate(r,l,t,!0,a)},init(a){return a!==void 0&&this.C(r,void 0,t,a),a}}}if(o==="setter"){const{name:r}=i;return function(a){const l=this[r];e.call(this,a),this.requestUpdate(r,l,t,!0,a)}}throw Error("Unsupported decorator location: "+o)};function x(t){return(e,i)=>typeof i=="object"?Wv(t,e,i):((o,n,s)=>{const r=n.hasOwnProperty(s);return n.constructor.createProperty(s,o),r?Object.getOwnPropertyDescriptor(n,s):void 0})(t,e,i)}/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */function Li(t){return x({...t,state:!0,attribute:!1})}/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Yv=t=>t.strings===void 0;/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Ph={ATTRIBUTE:1,CHILD:2},Lh=t=>(...e)=>({_$litDirective$:t,values:e});let Mh=class{constructor(t){}get _$AU(){return this._$AM._$AU}_$AT(t,e,i){this._$Ct=t,this._$AM=e,this._$Ci=i}_$AS(t,e){return this.update(t,e)}update(t,e){return this.render(...e)}};/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Xn=(t,e)=>{var i;const o=t._$AN;if(o===void 0)return!1;for(const n of o)(i=n._$AO)==null||i.call(n,e,!1),Xn(n,e);return!0},As=t=>{let e,i;do{if((e=t._$AM)===void 0)break;i=e._$AN,i.delete(t),t=e}while(i?.size===0)},zh=t=>{for(let e;e=t._$AM;t=e){let i=e._$AN;if(i===void 0)e._$AN=i=new Set;else if(i.has(t))break;i.add(t),Jv(e)}};function Xv(t){this._$AN!==void 0?(As(this),this._$AM=t,zh(this)):this._$AM=t}function Zv(t,e=!1,i=0){const o=this._$AH,n=this._$AN;if(n!==void 0&&n.size!==0)if(e)if(Array.isArray(o))for(let s=i;s<o.length;s++)Xn(o[s],!1),As(o[s]);else o!=null&&(Xn(o,!1),As(o));else Xn(this,t)}const Jv=t=>{t.type==Ph.CHILD&&(t._$AP??(t._$AP=Zv),t._$AQ??(t._$AQ=Xv))};class Kv extends Mh{constructor(){super(...arguments),this._$AN=void 0}_$AT(e,i,o){super._$AT(e,i,o),zh(this),this.isConnected=e._$AU}_$AO(e,i=!0){var o,n;e!==this.isConnected&&(this.isConnected=e,e?(o=this.reconnected)==null||o.call(this):(n=this.disconnected)==null||n.call(this)),i&&(Xn(this,e),As(this))}setValue(e){if(Yv(this._$Ct))this._$Ct._$AI(e,this);else{const i=[...this._$Ct._$AH];i[this._$Ci]=e,this._$Ct._$AI(i,this,0)}}disconnected(){}reconnected(){}}/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const gn=()=>new Qv;class Qv{}const Ar=new WeakMap,me=Lh(class extends Kv{render(t){return se}update(t,[e]){var i;const o=e!==this.G;return o&&this.G!==void 0&&this.rt(void 0),(o||this.lt!==this.ct)&&(this.G=e,this.ht=(i=t.options)==null?void 0:i.host,this.rt(this.ct=t.element)),se}rt(t){if(this.isConnected||(t=void 0),typeof this.G=="function"){const e=this.ht??globalThis;let i=Ar.get(e);i===void 0&&(i=new WeakMap,Ar.set(e,i)),i.get(this.G)!==void 0&&this.G.call(this.ht,void 0),i.set(this.G,t),t!==void 0&&this.G.call(this.ht,t)}else this.G.value=t}get lt(){var t,e;return typeof this.G=="function"?(t=Ar.get(this.ht??globalThis))==null?void 0:t.get(this.G):(e=this.G)==null?void 0:e.value}disconnected(){this.lt===this.ct&&this.rt(void 0)}reconnected(){this.rt(this.ct)}});/**
* (c) Iconify
*
* For the full copyright and license information, please view the license.txt
* files at https://github.com/iconify/iconify
*
* Licensed under MIT.
*
* @license MIT
* @version 2.0.0
*/const Dh=Object.freeze({left:0,top:0,width:16,height:16}),ks=Object.freeze({rotate:0,vFlip:!1,hFlip:!1}),Ro=Object.freeze({...Dh,...ks}),sa=Object.freeze({...Ro,body:"",hidden:!1}),e0=Object.freeze({width:null,height:null}),Rh=Object.freeze({...e0,...ks});function t0(t,e=0){const i=t.replace(/^-?[0-9.]*/,"");function o(n){for(;n<0;)n+=4;return n%4}if(i===""){const n=parseInt(t);return isNaN(n)?0:o(n)}else if(i!==t){let n=0;switch(i){case"%":n=25;break;case"deg":n=90}if(n){let s=parseFloat(t.slice(0,t.length-i.length));return isNaN(s)?0:(s=s/n,s%1===0?o(s):0)}}return e}const i0=/[\s,]+/;function n0(t,e){e.split(i0).forEach(i=>{switch(i.trim()){case"horizontal":t.hFlip=!0;break;case"vertical":t.vFlip=!0;break}})}const jh={...Rh,preserveAspectRatio:""};function id(t){const e={...jh},i=(o,n)=>t.getAttribute(o)||n;return e.width=i("width",null),e.height=i("height",null),e.rotate=t0(i("rotate","")),n0(e,i("flip","")),e.preserveAspectRatio=i("preserveAspectRatio",i("preserveaspectratio","")),e}function o0(t,e){for(const i in jh)if(t[i]!==e[i])return!0;return!1}const Zn=/^[a-z0-9]+(-[a-z0-9]+)*$/,jo=(t,e,i,o="")=>{const n=t.split(":");if(t.slice(0,1)==="@"){if(n.length<2||n.length>3)return null;o=n.shift().slice(1)}if(n.length>3||!n.length)return null;if(n.length>1){const a=n.pop(),l=n.pop(),c={provider:n.length>0?n[0]:o,prefix:l,name:a};return e&&!ns(c)?null:c}const s=n[0],r=s.split("-");if(r.length>1){const a={provider:o,prefix:r.shift(),name:r.join("-")};return e&&!ns(a)?null:a}if(i&&o===""){const a={provider:o,prefix:"",name:s};return e&&!ns(a,i)?null:a}return null},ns=(t,e)=>t?!!((t.provider===""||t.provider.match(Zn))&&(e&&t.prefix===""||t.prefix.match(Zn))&&t.name.match(Zn)):!1;function s0(t,e){const i={};!t.hFlip!=!e.hFlip&&(i.hFlip=!0),!t.vFlip!=!e.vFlip&&(i.vFlip=!0);const o=((t.rotate||0)+(e.rotate||0))%4;return o&&(i.rotate=o),i}function nd(t,e){const i=s0(t,e);for(const o in sa)o in ks?o in t&&!(o in i)&&(i[o]=ks[o]):o in e?i[o]=e[o]:o in t&&(i[o]=t[o]);return i}function r0(t,e){const i=t.icons,o=t.aliases||Object.create(null),n=Object.create(null);function s(r){if(i[r])return n[r]=[];if(!(r in n)){n[r]=null;const a=o[r]&&o[r].parent,l=a&&s(a);l&&(n[r]=[a].concat(l))}return n[r]}return Object.keys(i).concat(Object.keys(o)).forEach(s),n}function a0(t,e,i){const o=t.icons,n=t.aliases||Object.create(null);let s={};function r(a){s=nd(o[a]||n[a],s)}return r(e),i.forEach(r),nd(t,s)}function Nh(t,e){const i=[];if(typeof t!="object"||typeof t.icons!="object")return i;t.not_found instanceof Array&&t.not_found.forEach(n=>{e(n,null),i.push(n)});const o=r0(t);for(const n in o){const s=o[n];s&&(e(n,a0(t,n,s)),i.push(n))}return i}const l0={provider:"",aliases:{},not_found:{},...Dh};function kr(t,e){for(const i in e)if(i in t&&typeof t[i]!=typeof e[i])return!1;return!0}function Bh(t){if(typeof t!="object"||t===null)return null;const e=t;if(typeof e.prefix!="string"||!t.icons||typeof t.icons!="object"||!kr(t,l0))return null;const i=e.icons;for(const n in i){const s=i[n];if(!n.match(Zn)||typeof s.body!="string"||!kr(s,sa))return null}const o=e.aliases||Object.create(null);for(const n in o){const s=o[n],r=s.parent;if(!n.match(Zn)||typeof r!="string"||!i[r]&&!o[r]||!kr(s,sa))return null}return e}const Ts=Object.create(null);function c0(t,e){return{provider:t,prefix:e,icons:Object.create(null),missing:new Set}}function Xt(t,e){const i=Ts[t]||(Ts[t]=Object.create(null));return i[e]||(i[e]=c0(t,e))}function ul(t,e){return Bh(e)?Nh(e,(i,o)=>{o?t.icons[i]=o:t.missing.add(i)}):[]}function d0(t,e,i){try{if(typeof i.body=="string")return t.icons[e]={...i},!0}catch{}return!1}function u0(t,e){let i=[];return(typeof t=="string"?[t]:Object.keys(Ts)).forEach(o=>{(typeof o=="string"&&typeof e=="string"?[e]:Object.keys(Ts[o]||{})).forEach(n=>{const s=Xt(o,n);i=i.concat(Object.keys(s.icons).map(r=>(o!==""?"@"+o+":":"")+n+":"+r))})}),i}let mo=!1;function Fh(t){return typeof t=="boolean"&&(mo=t),mo}function bo(t){const e=typeof t=="string"?jo(t,!0,mo):t;if(e){const i=Xt(e.provider,e.prefix),o=e.name;return i.icons[o]||(i.missing.has(o)?null:void 0)}}function Uh(t,e){const i=jo(t,!0,mo);if(!i)return!1;const o=Xt(i.provider,i.prefix);return d0(o,i.name,e)}function od(t,e){if(typeof t!="object")return!1;if(typeof e!="string"&&(e=t.provider||""),mo&&!e&&!t.prefix){let n=!1;return Bh(t)&&(t.prefix="",Nh(t,(s,r)=>{r&&Uh(s,r)&&(n=!0)})),n}const i=t.prefix;if(!ns({provider:e,prefix:i,name:"a"}))return!1;const o=Xt(e,i);return!!ul(o,t)}function sd(t){return!!bo(t)}function h0(t){const e=bo(t);return e?{...Ro,...e}:null}function p0(t){const e={loaded:[],missing:[],pending:[]},i=Object.create(null);t.sort((n,s)=>n.provider!==s.provider?n.provider.localeCompare(s.provider):n.prefix!==s.prefix?n.prefix.localeCompare(s.prefix):n.name.localeCompare(s.name));let o={provider:"",prefix:"",name:""};return t.forEach(n=>{if(o.name===n.name&&o.prefix===n.prefix&&o.provider===n.provider)return;o=n;const s=n.provider,r=n.prefix,a=n.name,l=i[s]||(i[s]=Object.create(null)),c=l[r]||(l[r]=Xt(s,r));let d;a in c.icons?d=e.loaded:r===""||c.missing.has(a)?d=e.missing:d=e.pending;const u={provider:s,prefix:r,name:a};d.push(u)}),e}function Hh(t,e){t.forEach(i=>{const o=i.loaderCallbacks;o&&(i.loaderCallbacks=o.filter(n=>n.id!==e))})}function f0(t){t.pendingCallbacksFlag||(t.pendingCallbacksFlag=!0,setTimeout(()=>{t.pendingCallbacksFlag=!1;const e=t.loaderCallbacks?t.loaderCallbacks.slice(0):[];if(!e.length)return;let i=!1;const o=t.provider,n=t.prefix;e.forEach(s=>{const r=s.icons,a=r.pending.length;r.pending=r.pending.filter(l=>{if(l.prefix!==n)return!0;const c=l.name;if(t.icons[c])r.loaded.push({provider:o,prefix:n,name:c});else if(t.missing.has(c))r.missing.push({provider:o,prefix:n,name:c});else return i=!0,!0;return!1}),r.pending.length!==a&&(i||Hh([t],s.id),s.callback(r.loaded.slice(0),r.missing.slice(0),r.pending.slice(0),s.abort))})}))}let m0=0;function b0(t,e,i){const o=m0++,n=Hh.bind(null,i,o);if(!e.pending.length)return n;const s={id:o,icons:e,callback:t,abort:n};return i.forEach(r=>{(r.loaderCallbacks||(r.loaderCallbacks=[])).push(s)}),n}const ra=Object.create(null);function rd(t,e){ra[t]=e}function aa(t){return ra[t]||ra[""]}function g0(t,e=!0,i=!1){const o=[];return t.forEach(n=>{const s=typeof n=="string"?jo(n,e,i):n;s&&o.push(s)}),o}var y0={resources:[],index:0,timeout:2e3,rotate:750,random:!1,dataAfterTimeout:!1};function v0(t,e,i,o){const n=t.resources.length,s=t.random?Math.floor(Math.random()*n):t.index;let r;if(t.random){let E=t.resources.slice(0);for(r=[];E.length>1;){const A=Math.floor(Math.random()*E.length);r.push(E[A]),E=E.slice(0,A).concat(E.slice(A+1))}r=r.concat(E)}else r=t.resources.slice(s).concat(t.resources.slice(0,s));const a=Date.now();let l="pending",c=0,d,u=null,h=[],p=[];typeof o=="function"&&p.push(o);function m(){u&&(clearTimeout(u),u=null)}function g(){l==="pending"&&(l="aborted"),m(),h.forEach(E=>{E.status==="pending"&&(E.status="aborted")}),h=[]}function f(E,A){A&&(p=[]),typeof E=="function"&&p.push(E)}function v(){return{startTime:a,payload:e,status:l,queriesSent:c,queriesPending:h.length,subscribe:f,abort:g}}function y(){l="failed",p.forEach(E=>{E(void 0,d)})}function b(){h.forEach(E=>{E.status==="pending"&&(E.status="aborted")}),h=[]}function $(E,A,P){const M=A!=="success";switch(h=h.filter(O=>O!==E),l){case"pending":break;case"failed":if(M||!t.dataAfterTimeout)return;break;default:return}if(A==="abort"){d=P,y();return}if(M){d=P,h.length||(r.length?C():y());return}if(m(),b(),!t.random){const O=t.resources.indexOf(E.resource);O!==-1&&O!==t.index&&(t.index=O)}l="completed",p.forEach(O=>{O(P)})}function C(){if(l!=="pending")return;m();const E=r.shift();if(E===void 0){if(h.length){u=setTimeout(()=>{m(),l==="pending"&&(b(),y())},t.timeout);return}y();return}const A={status:"pending",resource:E,callback:(P,M)=>{$(A,P,M)}};h.push(A),c++,u=setTimeout(C,t.rotate),i(E,e,A.callback)}return setTimeout(C),v}function Vh(t){const e={...y0,...t};let i=[];function o(){i=i.filter(r=>r().status==="pending")}function n(r,a,l){const c=v0(e,r,a,(d,u)=>{o(),l&&l(d,u)});return i.push(c),c}function s(r){return i.find(a=>r(a))||null}return{query:n,find:s,setIndex:r=>{e.index=r},getIndex:()=>e.index,cleanup:o}}function hl(t){let e;if(typeof t.resources=="string")e=[t.resources];else if(e=t.resources,!(e instanceof Array)||!e.length)return null;return{resources:e,path:t.path||"/",maxURL:t.maxURL||500,rotate:t.rotate||750,timeout:t.timeout||5e3,random:t.random===!0,index:t.index||0,dataAfterTimeout:t.dataAfterTimeout!==!1}}const ar=Object.create(null),Wo=["https://api.simplesvg.com","https://api.unisvg.com"],la=[];for(;Wo.length>0;)Wo.length===1||Math.random()>.5?la.push(Wo.shift()):la.push(Wo.pop());ar[""]=hl({resources:["https://api.iconify.design"].concat(la)});function ad(t,e){const i=hl(e);return i===null?!1:(ar[t]=i,!0)}function lr(t){return ar[t]}function w0(){return Object.keys(ar)}function ld(){}const Tr=Object.create(null);function $0(t){if(!Tr[t]){const e=lr(t);if(!e)return;const i=Vh(e),o={config:e,redundancy:i};Tr[t]=o}return Tr[t]}function qh(t,e,i){let o,n;if(typeof t=="string"){const s=aa(t);if(!s)return i(void 0,424),ld;n=s.send;const r=$0(t);r&&(o=r.redundancy)}else{const s=hl(t);if(s){o=Vh(s);const r=t.resources?t.resources[0]:"",a=aa(r);a&&(n=a.send)}}return!o||!n?(i(void 0,424),ld):o.query(e,n,i)().abort}const cd="iconify2",go="iconify",Gh=go+"-count",dd=go+"-version",Wh=36e5,_0=168,x0=50;function ca(t,e){try{return t.getItem(e)}catch{}}function pl(t,e,i){try{return t.setItem(e,i),!0}catch{}}function ud(t,e){try{t.removeItem(e)}catch{}}function da(t,e){return pl(t,Gh,e.toString())}function ua(t){return parseInt(ca(t,Gh))||0}const wi={local:!0,session:!0},Yh={local:new Set,session:new Set};let fl=!1;function E0(t){fl=t}let Yo=typeof window>"u"?{}:window;function Xh(t){const e=t+"Storage";try{if(Yo&&Yo[e]&&typeof Yo[e].length=="number")return Yo[e]}catch{}wi[t]=!1}function Zh(t,e){const i=Xh(t);if(!i)return;const o=ca(i,dd);if(o!==cd){if(o){const a=ua(i);for(let l=0;l<a;l++)ud(i,go+l.toString())}pl(i,dd,cd),da(i,0);return}const n=Math.floor(Date.now()/Wh)-_0,s=a=>{const l=go+a.toString(),c=ca(i,l);if(typeof c=="string"){try{const d=JSON.parse(c);if(typeof d=="object"&&typeof d.cached=="number"&&d.cached>n&&typeof d.provider=="string"&&typeof d.data=="object"&&typeof d.data.prefix=="string"&&e(d,a))return!0}catch{}ud(i,l)}};let r=ua(i);for(let a=r-1;a>=0;a--)s(a)||(a===r-1?(r--,da(i,r)):Yh[t].add(a))}function Jh(){if(!fl){E0(!0);for(const t in wi)Zh(t,e=>{const i=e.data,o=e.provider,n=i.prefix,s=Xt(o,n);if(!ul(s,i).length)return!1;const r=i.lastModified||-1;return s.lastModifiedCached=s.lastModifiedCached?Math.min(s.lastModifiedCached,r):r,!0})}}function S0(t,e){const i=t.lastModifiedCached;if(i&&i>=e)return i===e;if(t.lastModifiedCached=e,i)for(const o in wi)Zh(o,n=>{const s=n.data;return n.provider!==t.provider||s.prefix!==t.prefix||s.lastModified===e});return!0}function C0(t,e){fl||Jh();function i(o){let n;if(!wi[o]||!(n=Xh(o)))return;const s=Yh[o];let r;if(s.size)s.delete(r=Array.from(s).shift());else if(r=ua(n),r>=x0||!da(n,r+1))return;const a={cached:Math.floor(Date.now()/Wh),provider:t.provider,data:e};return pl(n,go+r.toString(),JSON.stringify(a))}e.lastModified&&!S0(t,e.lastModified)||Object.keys(e.icons).length&&(e.not_found&&(e=Object.assign({},e),delete e.not_found),i("local")||i("session"))}function hd(){}function A0(t){t.iconsLoaderFlag||(t.iconsLoaderFlag=!0,setTimeout(()=>{t.iconsLoaderFlag=!1,f0(t)}))}function k0(t,e){t.iconsToLoad?t.iconsToLoad=t.iconsToLoad.concat(e).sort():t.iconsToLoad=e,t.iconsQueueFlag||(t.iconsQueueFlag=!0,setTimeout(()=>{t.iconsQueueFlag=!1;const{provider:i,prefix:o}=t,n=t.iconsToLoad;delete t.iconsToLoad;let s;!n||!(s=aa(i))||s.prepare(i,o,n).forEach(r=>{qh(i,r,a=>{if(typeof a!="object")r.icons.forEach(l=>{t.missing.add(l)});else try{const l=ul(t,a);if(!l.length)return;const c=t.pendingIcons;c&&l.forEach(d=>{c.delete(d)}),C0(t,a)}catch(l){console.error(l)}A0(t)})})}))}const ml=(t,e)=>{const i=g0(t,!0,Fh()),o=p0(i);if(!o.pending.length){let l=!0;return e&&setTimeout(()=>{l&&e(o.loaded,o.missing,o.pending,hd)}),()=>{l=!1}}const n=Object.create(null),s=[];let r,a;return o.pending.forEach(l=>{const{provider:c,prefix:d}=l;if(d===a&&c===r)return;r=c,a=d,s.push(Xt(c,d));const u=n[c]||(n[c]=Object.create(null));u[d]||(u[d]=[])}),o.pending.forEach(l=>{const{provider:c,prefix:d,name:u}=l,h=Xt(c,d),p=h.pendingIcons||(h.pendingIcons=new Set);p.has(u)||(p.add(u),n[c][d].push(u))}),s.forEach(l=>{const{provider:c,prefix:d}=l;n[c][d].length&&k0(l,n[c][d])}),e?b0(e,o,s):hd},T0=t=>new Promise((e,i)=>{const o=typeof t=="string"?jo(t,!0):t;if(!o){i(t);return}ml([o||t],n=>{if(n.length&&o){const s=bo(o);if(s){e({...Ro,...s});return}}i(t)})});function O0(t){try{const e=typeof t=="string"?JSON.parse(t):t;if(typeof e.body=="string")return{...e}}catch{}}function I0(t,e){const i=typeof t=="string"?jo(t,!0,!0):null;if(!i){const s=O0(t);return{value:t,data:s}}const o=bo(i);if(o!==void 0||!i.prefix)return{value:t,name:i,data:o};const n=ml([i],()=>e(t,i,bo(i)));return{value:t,name:i,loading:n}}function Or(t){return t.hasAttribute("inline")}let Kh=!1;try{Kh=navigator.vendor.indexOf("Apple")===0}catch{}function P0(t,e){switch(e){case"svg":case"bg":case"mask":return e}return e!=="style"&&(Kh||t.indexOf("<a")===-1)?"svg":t.indexOf("currentColor")===-1?"bg":"mask"}const L0=/(-?[0-9.]*[0-9]+[0-9.]*)/g,M0=/^-?[0-9.]*[0-9]+[0-9.]*$/g;function ha(t,e,i){if(e===1)return t;if(i=i||100,typeof t=="number")return Math.ceil(t*e*i)/i;if(typeof t!="string")return t;const o=t.split(L0);if(o===null||!o.length)return t;const n=[];let s=o.shift(),r=M0.test(s);for(;;){if(r){const a=parseFloat(s);isNaN(a)?n.push(s):n.push(Math.ceil(a*e*i)/i)}else n.push(s);if(s=o.shift(),s===void 0)return n.join("");r=!r}}function z0(t,e="defs"){let i="";const o=t.indexOf("<"+e);for(;o>=0;){const n=t.indexOf(">",o),s=t.indexOf("</"+e);if(n===-1||s===-1)break;const r=t.indexOf(">",s);if(r===-1)break;i+=t.slice(n+1,s).trim(),t=t.slice(0,o).trim()+t.slice(r+1)}return{defs:i,content:t}}function D0(t,e){return t?"<defs>"+t+"</defs>"+e:e}function R0(t,e,i){const o=z0(t);return D0(o.defs,e+o.content+i)}const j0=t=>t==="unset"||t==="undefined"||t==="none";function Qh(t,e){const i={...Ro,...t},o={...Rh,...e},n={left:i.left,top:i.top,width:i.width,height:i.height};let s=i.body;[i,o].forEach(g=>{const f=[],v=g.hFlip,y=g.vFlip;let b=g.rotate;v?y?b+=2:(f.push("translate("+(n.width+n.left).toString()+" "+(0-n.top).toString()+")"),f.push("scale(-1 1)"),n.top=n.left=0):y&&(f.push("translate("+(0-n.left).toString()+" "+(n.height+n.top).toString()+")"),f.push("scale(1 -1)"),n.top=n.left=0);let $;switch(b<0&&(b-=Math.floor(b/4)*4),b=b%4,b){case 1:$=n.height/2+n.top,f.unshift("rotate(90 "+$.toString()+" "+$.toString()+")");break;case 2:f.unshift("rotate(180 "+(n.width/2+n.left).toString()+" "+(n.height/2+n.top).toString()+")");break;case 3:$=n.width/2+n.left,f.unshift("rotate(-90 "+$.toString()+" "+$.toString()+")");break}b%2===1&&(n.left!==n.top&&($=n.left,n.left=n.top,n.top=$),n.width!==n.height&&($=n.width,n.width=n.height,n.height=$)),f.length&&(s=R0(s,'<g transform="'+f.join(" ")+'">',"</g>"))});const r=o.width,a=o.height,l=n.width,c=n.height;let d,u;r===null?(u=a===null?"1em":a==="auto"?c:a,d=ha(u,l/c)):(d=r==="auto"?l:r,u=a===null?ha(d,c/l):a==="auto"?c:a);const h={},p=(g,f)=>{j0(f)||(h[g]=f.toString())};p("width",d),p("height",u);const m=[n.left,n.top,l,c];return h.viewBox=m.join(" "),{attributes:h,viewBox:m,body:s}}function bl(t,e){let i=t.indexOf("xlink:")===-1?"":' xmlns:xlink="http://www.w3.org/1999/xlink"';for(const o in e)i+=" "+o+'="'+e[o]+'"';return'<svg xmlns="http://www.w3.org/2000/svg"'+i+">"+t+"</svg>"}function N0(t){return t.replace(/"/g,"'").replace(/%/g,"%25").replace(/#/g,"%23").replace(/</g,"%3C").replace(/>/g,"%3E").replace(/\s+/g," ")}function B0(t){return"data:image/svg+xml,"+N0(t)}function ep(t){return'url("'+B0(t)+'")'}const F0=()=>{let t;try{if(t=fetch,typeof t=="function")return t}catch{}};let Os=F0();function U0(t){Os=t}function H0(){return Os}function V0(t,e){const i=lr(t);if(!i)return 0;let o;if(!i.maxURL)o=0;else{let n=0;i.resources.forEach(r=>{n=Math.max(n,r.length)});const s=e+".json?icons=";o=i.maxURL-n-i.path.length-s.length}return o}function q0(t){return t===404}const G0=(t,e,i)=>{const o=[],n=V0(t,e),s="icons";let r={type:s,provider:t,prefix:e,icons:[]},a=0;return i.forEach((l,c)=>{a+=l.length+1,a>=n&&c>0&&(o.push(r),r={type:s,provider:t,prefix:e,icons:[]},a=l.length),r.icons.push(l)}),o.push(r),o};function W0(t){if(typeof t=="string"){const e=lr(t);if(e)return e.path}return"/"}const Y0=(t,e,i)=>{if(!Os){i("abort",424);return}let o=W0(e.provider);switch(e.type){case"icons":{const s=e.prefix,r=e.icons.join(","),a=new URLSearchParams({icons:r});o+=s+".json?"+a.toString();break}case"custom":{const s=e.uri;o+=s.slice(0,1)==="/"?s.slice(1):s;break}default:i("abort",400);return}let n=503;Os(t+o).then(s=>{const r=s.status;if(r!==200){setTimeout(()=>{i(q0(r)?"abort":"next",r)});return}return n=501,s.json()}).then(s=>{if(typeof s!="object"||s===null){setTimeout(()=>{s===404?i("abort",s):i("next",n)});return}setTimeout(()=>{i("success",s)})}).catch(()=>{i("next",n)})},X0={prepare:G0,send:Y0};function pd(t,e){switch(t){case"local":case"session":wi[t]=e;break;case"all":for(const i in wi)wi[i]=e;break}}const Ir="data-style";let tp="";function Z0(t){tp=t}function fd(t,e){let i=Array.from(t.childNodes).find(o=>o.hasAttribute&&o.hasAttribute(Ir));i||(i=document.createElement("style"),i.setAttribute(Ir,Ir),t.appendChild(i)),i.textContent=":host{display:inline-block;vertical-align:"+(e?"-0.125em":"0")+"}span,svg{display:block}"+tp}function ip(){rd("",X0),Fh(!0);let t;try{t=window}catch{}if(t){if(Jh(),t.IconifyPreload!==void 0){const e=t.IconifyPreload,i="Invalid IconifyPreload syntax.";typeof e=="object"&&e!==null&&(e instanceof Array?e:[e]).forEach(o=>{try{(typeof o!="object"||o===null||o instanceof Array||typeof o.icons!="object"||typeof o.prefix!="string"||!od(o))&&console.error(i)}catch{console.error(i)}})}if(t.IconifyProviders!==void 0){const e=t.IconifyProviders;if(typeof e=="object"&&e!==null)for(const i in e){const o="IconifyProviders["+i+"] is invalid.";try{const n=e[i];if(typeof n!="object"||!n||n.resources===void 0)continue;ad(i,n)||console.error(o)}catch{console.error(o)}}}}return{enableCache:e=>pd(e,!0),disableCache:e=>pd(e,!1),iconLoaded:sd,iconExists:sd,getIcon:h0,listIcons:u0,addIcon:Uh,addCollection:od,calculateSize:ha,buildIcon:Qh,iconToHTML:bl,svgToURL:ep,loadIcons:ml,loadIcon:T0,addAPIProvider:ad,appendCustomStyle:Z0,_api:{getAPIConfig:lr,setAPIModule:rd,sendAPIQuery:qh,setFetch:U0,getFetch:H0,listAPIProviders:w0}}}const pa={"background-color":"currentColor"},np={"background-color":"transparent"},md={image:"var(--svg)",repeat:"no-repeat",size:"100% 100%"},bd={"-webkit-mask":pa,mask:pa,background:np};for(const t in bd){const e=bd[t];for(const i in md)e[t+"-"+i]=md[i]}function gd(t){return t?t+(t.match(/^[-0-9.]+$/)?"px":""):"inherit"}function J0(t,e,i){const o=document.createElement("span");let n=t.body;n.indexOf("<a")!==-1&&(n+="<!-- "+Date.now()+" -->");const s=t.attributes,r=bl(n,{...s,width:e.width+"",height:e.height+""}),a=ep(r),l=o.style,c={"--svg":a,width:gd(s.width),height:gd(s.height),...i?pa:np};for(const d in c)l.setProperty(d,c[d]);return o}let Jn;function K0(){try{Jn=window.trustedTypes.createPolicy("iconify",{createHTML:t=>t})}catch{Jn=null}}function Q0(t){return Jn===void 0&&K0(),Jn?Jn.createHTML(t):t}function ew(t){const e=document.createElement("span"),i=t.attributes;let o="";i.width||(o="width: inherit;"),i.height||(o+="height: inherit;"),o&&(i.style=o);const n=bl(t.body,i);return e.innerHTML=Q0(n),e.firstChild}function fa(t){return Array.from(t.childNodes).find(e=>{const i=e.tagName&&e.tagName.toUpperCase();return i==="SPAN"||i==="SVG"})}function yd(t,e){const i=e.icon.data,o=e.customisations,n=Qh(i,o);o.preserveAspectRatio&&(n.attributes.preserveAspectRatio=o.preserveAspectRatio);const s=e.renderedMode;let r;switch(s){case"svg":r=ew(n);break;default:r=J0(n,{...Ro,...i},s==="mask")}const a=fa(t);a?r.tagName==="SPAN"&&a.tagName===r.tagName?a.setAttribute("style",r.getAttribute("style")):t.replaceChild(r,a):t.appendChild(r)}function vd(t,e,i){const o=i&&(i.rendered?i:i.lastRender);return{rendered:!1,inline:e,icon:t,lastRender:o}}function tw(t="iconify-icon"){let e,i;try{e=window.customElements,i=window.HTMLElement}catch{return}if(!e||!i)return;const o=e.get(t);if(o)return o;const n=["icon","mode","inline","observe","width","height","rotate","flip"],s=class extends i{constructor(){super(),di(this,"_shadowRoot"),di(this,"_initialised",!1),di(this,"_state"),di(this,"_checkQueued",!1),di(this,"_connected",!1),di(this,"_observer",null),di(this,"_visible",!0);const a=this._shadowRoot=this.attachShadow({mode:"open"}),l=Or(this);fd(a,l),this._state=vd({value:""},l),this._queueCheck()}connectedCallback(){this._connected=!0,this.startObserver()}disconnectedCallback(){this._connected=!1,this.stopObserver()}static get observedAttributes(){return n.slice(0)}attributeChangedCallback(a){switch(a){case"inline":{const l=Or(this),c=this._state;l!==c.inline&&(c.inline=l,fd(this._shadowRoot,l));break}case"observer":{this.observer?this.startObserver():this.stopObserver();break}default:this._queueCheck()}}get icon(){const a=this.getAttribute("icon");if(a&&a.slice(0,1)==="{")try{return JSON.parse(a)}catch{}return a}set icon(a){typeof a=="object"&&(a=JSON.stringify(a)),this.setAttribute("icon",a)}get inline(){return Or(this)}set inline(a){a?this.setAttribute("inline","true"):this.removeAttribute("inline")}get observer(){return this.hasAttribute("observer")}set observer(a){a?this.setAttribute("observer","true"):this.removeAttribute("observer")}restartAnimation(){const a=this._state;if(a.rendered){const l=this._shadowRoot;if(a.renderedMode==="svg")try{l.lastChild.setCurrentTime(0);return}catch{}yd(l,a)}}get status(){const a=this._state;return a.rendered?"rendered":a.icon.data===null?"failed":"loading"}_queueCheck(){this._checkQueued||(this._checkQueued=!0,setTimeout(()=>{this._check()}))}_check(){if(!this._checkQueued)return;this._checkQueued=!1;const a=this._state,l=this.getAttribute("icon");if(l!==a.icon.value){this._iconChanged(l);return}if(!a.rendered||!this._visible)return;const c=this.getAttribute("mode"),d=id(this);(a.attrMode!==c||o0(a.customisations,d)||!fa(this._shadowRoot))&&this._renderIcon(a.icon,d,c)}_iconChanged(a){const l=I0(a,(c,d,u)=>{const h=this._state;if(h.rendered||this.getAttribute("icon")!==c)return;const p={value:c,name:d,data:u};p.data?this._gotIconData(p):h.icon=p});l.data?this._gotIconData(l):this._state=vd(l,this._state.inline,this._state)}_forceRender(){if(!this._visible){const a=fa(this._shadowRoot);a&&this._shadowRoot.removeChild(a);return}this._queueCheck()}_gotIconData(a){this._checkQueued=!1,this._renderIcon(a,id(this),this.getAttribute("mode"))}_renderIcon(a,l,c){const d=P0(a.data.body,c),u=this._state.inline;yd(this._shadowRoot,this._state={rendered:!0,icon:a,inline:u,customisations:l,attrMode:c,renderedMode:d})}startObserver(){if(!this._observer)try{this._observer=new IntersectionObserver(a=>{const l=a.some(c=>c.isIntersecting);l!==this._visible&&(this._visible=l,this._forceRender())}),this._observer.observe(this)}catch{if(this._observer){try{this._observer.disconnect()}catch{}this._observer=null}}}stopObserver(){this._observer&&(this._observer.disconnect(),this._observer=null,this._visible=!0,this._connected&&this._forceRender())}};n.forEach(a=>{a in s.prototype||Object.defineProperty(s.prototype,a,{get:function(){return this.getAttribute(a)},set:function(l){l!==null?this.setAttribute(a,l):this.removeAttribute(a)}})});const r=ip();for(const a in r)s[a]=s.prototype[a]=r[a];return e.define(t,s),s}const iw=tw()||ip(),{enableCache:Rx,disableCache:jx,iconLoaded:Nx,iconExists:Bx,getIcon:Fx,listIcons:Ux,addIcon:Hx,addCollection:nw,calculateSize:Vx,buildIcon:qx,iconToHTML:Gx,svgToURL:Wx,loadIcons:ow,loadIcon:Yx,addAPIProvider:Xx,_api:Zx}=iw,sw=ie`
  ::-webkit-scrollbar {
    width: 0.4rem;
    height: 0.4rem;
    overflow: hidden;
  }

  ::-webkit-scrollbar-thumb {
    border-radius: 0.25rem;
    background-color: var(
      --bim-scrollbar--c,
      color-mix(in lab, var(--bim-ui_main-base), white 15%)
    );
  }

  ::-webkit-scrollbar-track {
    background-color: var(--bim-scrollbar--bgc, var(--bim-ui_bg-base));
  }
`,rw=ie`
  :root {
    /* Grayscale Colors */
    --bim-ui_gray-0: hsl(210 10% 5%);
    --bim-ui_gray-1: hsl(210 10% 10%);
    --bim-ui_gray-2: hsl(210 10% 20%);
    --bim-ui_gray-3: hsl(210 10% 30%);
    --bim-ui_gray-4: hsl(210 10% 40%);
    --bim-ui_gray-5: hsl(210 10% 50%);
    --bim-ui_gray-6: hsl(210 10% 60%);
    --bim-ui_gray-7: hsl(210 10% 70%);
    --bim-ui_gray-8: hsl(210 10% 80%);
    --bim-ui_gray-9: hsl(210 10% 90%);
    --bim-ui_gray-10: hsl(210 10% 95%);

    /* Brand Colors */
    --bim-ui_main-base: #6528d7;
    --bim-ui_accent-base: #bcf124;

    /* Brand Colors Contrasts */
    --bim-ui_main-contrast: var(--bim-ui_gray-10);
    --bim-ui_accent-contrast: var(--bim-ui_gray-0);

    /* Sizes */
    --bim-ui_size-4xs: 0.375rem;
    --bim-ui_size-3xs: 0.5rem;
    --bim-ui_size-2xs: 0.625rem;
    --bim-ui_size-xs: 0.75rem;
    --bim-ui_size-sm: 0.875rem;
    --bim-ui_size-base: 1rem;
    --bim-ui_size-lg: 1.125rem;
    --bim-ui_size-xl: 1.25rem;
    --bim-ui_size-2xl: 1.375rem;
    --bim-ui_size-3xl: 1.5rem;
    --bim-ui_size-4xl: 1.625rem;
    --bim-ui_size-5xl: 1.75rem;
    --bim-ui_size-6xl: 1.875rem;
    --bim-ui_size-7xl: 2rem;
    --bim-ui_size-8xl: 2.125rem;
    --bim-ui_size-9xl: 2.25rem;
  }

  /* Background Colors */
  @media (prefers-color-scheme: dark) {
    :root {
      --bim-ui_bg-base: var(--bim-ui_gray-0);
      --bim-ui_bg-contrast-10: var(--bim-ui_gray-1);
      --bim-ui_bg-contrast-20: var(--bim-ui_gray-2);
      --bim-ui_bg-contrast-30: var(--bim-ui_gray-3);
      --bim-ui_bg-contrast-40: var(--bim-ui_gray-4);
      --bim-ui_bg-contrast-60: var(--bim-ui_gray-6);
      --bim-ui_bg-contrast-80: var(--bim-ui_gray-8);
      --bim-ui_bg-contrast-100: var(--bim-ui_gray-10);
    }
  }

  @media (prefers-color-scheme: light) {
    :root {
      --bim-ui_bg-base: var(--bim-ui_gray-10);
      --bim-ui_bg-contrast-10: var(--bim-ui_gray-9);
      --bim-ui_bg-contrast-20: var(--bim-ui_gray-8);
      --bim-ui_bg-contrast-30: var(--bim-ui_gray-7);
      --bim-ui_bg-contrast-40: var(--bim-ui_gray-6);
      --bim-ui_bg-contrast-60: var(--bim-ui_gray-4);
      --bim-ui_bg-contrast-80: var(--bim-ui_gray-2);
      --bim-ui_bg-contrast-100: var(--bim-ui_gray-0);
      --bim-ui_accent-base: #6528d7;
    }
  }

  .theme-transition-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    filter: drop-shadow(0 0 10px var(--bim-ui_bg-base));
    z-index: 9999;
  }

  .theme-transition-overlay > div {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: var(--bim-ui_bg-base);
  }

  html.bim-ui-dark {
    --bim-ui_bg-base: var(--bim-ui_gray-0);
    --bim-ui_bg-contrast-10: var(--bim-ui_gray-1);
    --bim-ui_bg-contrast-20: var(--bim-ui_gray-2);
    --bim-ui_bg-contrast-30: var(--bim-ui_gray-3);
    --bim-ui_bg-contrast-40: var(--bim-ui_gray-4);
    --bim-ui_bg-contrast-60: var(--bim-ui_gray-6);
    --bim-ui_bg-contrast-80: var(--bim-ui_gray-8);
    --bim-ui_bg-contrast-100: var(--bim-ui_gray-10);
  }

  html.bim-ui-light {
    --bim-ui_bg-base: var(--bim-ui_gray-10);
    --bim-ui_bg-contrast-10: var(--bim-ui_gray-9);
    --bim-ui_bg-contrast-20: var(--bim-ui_gray-8);
    --bim-ui_bg-contrast-30: var(--bim-ui_gray-7);
    --bim-ui_bg-contrast-40: var(--bim-ui_gray-6);
    --bim-ui_bg-contrast-60: var(--bim-ui_gray-4);
    --bim-ui_bg-contrast-80: var(--bim-ui_gray-2);
    --bim-ui_bg-contrast-100: var(--bim-ui_gray-0);
    --bim-ui_accent-base: #6528d7;
  }

  @keyframes toggleOverlay {
    0%,
    99% {
      display: block;
    }

    100% {
      display: none;
    }
  }

  @keyframes toggleThemeAnimation {
    0% {
      clip-path: circle(0% at center top);
    }
    45%,
    55% {
      clip-path: circle(150% at center center);
    }
    100% {
      clip-path: circle(0% at center bottom);
    }
  }

  [data-context-dialog]::backdrop {
    background-color: transparent;
  }
`,ni={scrollbar:sw,globalStyles:rw},op=class Y{static set config(e){this._config={...Y._config,...e}}static get config(){return Y._config}static addGlobalStyles(){let e=document.querySelector("style[id='bim-ui']");if(e)return;e=document.createElement("style"),e.id="bim-ui",e.textContent=ni.globalStyles.cssText;const i=document.head.firstChild;i?document.head.insertBefore(e,i):document.head.append(e)}static preloadIcons(e,i=!1){ow(e,(o,n,s)=>{i&&(console.log("Icons loaded:",o),n.length&&console.warn("Icons missing:",n),s.length&&console.info("Icons pending:",s))})}static addIconsCollection(e,i){nw({prefix:i?.prefix??"bim",icons:e,width:24,height:24})}static defineCustomElement(e,i){customElements.get(e)||customElements.define(e,i)}static registerComponents(){Y.init()}static init(e="",i=!0){Y.addGlobalStyles(),Y.defineCustomElement("bim-button",hw),Y.defineCustomElement("bim-checkbox",An),Y.defineCustomElement("bim-color-input",oi),Y.defineCustomElement("bim-context-menu",Kn),Y.defineCustomElement("bim-dropdown",lt),Y.defineCustomElement("bim-grid",yl),Y.defineCustomElement("bim-icon",ww),Y.defineCustomElement("bim-input",Bo),Y.defineCustomElement("bim-label",kn),Y.defineCustomElement("bim-number-input",He),Y.defineCustomElement("bim-option",he),Y.defineCustomElement("bim-panel",zi),Y.defineCustomElement("bim-panel-section",Tn),Y.defineCustomElement("bim-selector",On),Y.defineCustomElement("bim-table",Ve),Y.defineCustomElement("bim-tabs",Mt),Y.defineCustomElement("bim-tab",Le),Y.defineCustomElement("bim-table-cell",vp),Y.defineCustomElement("bim-table-children",Lw),Y.defineCustomElement("bim-table-group",xp),Y.defineCustomElement("bim-table-row",Di),Y.defineCustomElement("bim-text-input",Ie),Y.defineCustomElement("bim-toolbar",fr),Y.defineCustomElement("bim-toolbar-group",hr),Y.defineCustomElement("bim-toolbar-section",Ln),Y.defineCustomElement("bim-viewport",Mp),Y.defineCustomElement("bim-tooltip",t$),i&&this.animateOnLoad(e)}static newRandomId(){const e="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";let i="";for(let o=0;o<10;o++){const n=Math.floor(Math.random()*e.length);i+=e.charAt(n)}return i}static animateOnLoad(e=""){const i=`
      bim-input,
      bim-button,
      bim-checkbox,
      bim-selector,
      bim-label,
      bim-table-row,
      bim-panel-section,
      bim-table-children .branch-vertical,
      .switchers
    `,o=[];function n(s,r=document,a=new Set){const l=[];return Array.from(r.querySelectorAll(s)).forEach(c=>{a.has(c)||(a.add(c),l.push(c))}),Array.from(r.querySelectorAll("*")).filter(c=>c.shadowRoot).forEach(c=>{a.has(c)||(a.add(c),l.push(...n(s,c.shadowRoot,a)))}),l}requestAnimationFrame(()=>{n(e||i).forEach(r=>{const a=r;let l="auto";l=window.getComputedStyle(a).getPropertyValue("transition"),a.style.setProperty("opacity","0"),a.style.setProperty("transition","none"),requestAnimationFrame(()=>{a.style.setProperty("transition",l)}),o.push(a)});const s=()=>{o.forEach(r=>{const a=r,l=(a.getBoundingClientRect().x+a.getBoundingClientRect().y)/(window.innerWidth+window.innerHeight),c=window.getComputedStyle(a).getPropertyValue("transform"),d=400,u=200+l*1e3;a.animate([{transform:"translateY(-20px)",opacity:"0"},{transform:"translateY(0)",opacity:"1"}],{duration:d,easing:"ease-in-out",delay:u}),setTimeout(()=>{a.style.removeProperty("opacity"),c!=="none"?a.style.setProperty("transform",c):a.style.removeProperty("transform")},u+d)})};document.readyState==="complete"?s():window.addEventListener("load",s)})}static toggleTheme(e=!0){const i=document.querySelector("html");if(!i)return;const o=()=>{i.classList.contains("bim-ui-dark")?i.classList.replace("bim-ui-dark","bim-ui-light"):i.classList.contains("bim-ui-light")?i.classList.replace("bim-ui-light","bim-ui-dark"):i.classList.add("bim-ui-light")};if(e){const n=document.createElement("div");n.classList.add("theme-transition-overlay");const s=document.createElement("div");n.appendChild(s),s.style.setProperty("transition",`background-color ${1e3/3200}s`),document.body.appendChild(n),n.style.setProperty("animation",`toggleOverlay ${1e3/1e3}s ease-in forwards`),s.style.setProperty("animation",`toggleThemeAnimation ${1e3/1e3}s ease forwards`),setTimeout(()=>{o()},1e3/4),setTimeout(()=>{document.body.querySelectorAll(".theme-transition-overlay").forEach(r=>{document.body.removeChild(r)})},1e3)}else o()}};op._config={sectionLabelOnVerticalToolbar:!1};let Ne=op;class be extends K{constructor(){super(...arguments),this._lazyLoadObserver=null,this._visibleElements=[],this.ELEMENTS_BEFORE_OBSERVER=20,this.useObserver=!1,this.elements=new Set,this.observe=e=>{if(!this.useObserver)return;for(const o of e)this.elements.add(o);const i=e.slice(this.ELEMENTS_BEFORE_OBSERVER);for(const o of i)o.remove();this.observeLastElement()}}set visibleElements(e){this._visibleElements=this.useObserver?e:[],this.requestUpdate()}get visibleElements(){return this._visibleElements}getLazyObserver(){if(!this.useObserver)return null;if(this._lazyLoadObserver)return this._lazyLoadObserver;const e=new IntersectionObserver(i=>{const o=i[0];if(!o.isIntersecting)return;const n=o.target;e.unobserve(n);const s=this.ELEMENTS_BEFORE_OBSERVER+this.visibleElements.length,r=[...this.elements][s];r&&(this.visibleElements=[...this.visibleElements,r],e.observe(r))},{threshold:.5});return e}observeLastElement(){const e=this.getLazyObserver();if(!e)return;const i=this.ELEMENTS_BEFORE_OBSERVER+this.visibleElements.length-1,o=[...this.elements][i];o&&e.observe(o)}resetVisibleElements(){const e=this.getLazyObserver();if(e){for(const i of this.elements)e.unobserve(i);this.visibleElements=[],this.observeLastElement()}}static create(e,i){const o=document.createDocumentFragment();if(e.length===0)return oa(e(),o),o.firstElementChild;if(!i)throw new Error("UIComponent: Initial state is required for statefull components.");let n=i;const s=e,r=l=>(n={...n,...l},oa(s(n,r),o),n);r(i);const a=()=>n;return[o.firstElementChild,r,a]}}const yo=(t,e={},i=!0)=>{let o={};for(const n of t.children){const s=n,r=s.getAttribute("name")||s.getAttribute("label"),a=r?e[r]:void 0;if(r){if("value"in s&&typeof s.value<"u"&&s.value!==null){const l=s.value;if(typeof l=="object"&&!Array.isArray(l)&&Object.keys(l).length===0)continue;o[r]=a?a(s.value):s.value}else if(i){const l=yo(s,e);if(Object.keys(l).length===0)continue;o[r]=a?a(l):l}}else i&&(o={...o,...yo(s,e)})}return o},cr=t=>t==="true"||t==="false"?t==="true":t&&!isNaN(Number(t))&&t.trim()!==""?Number(t):t,aw=[">=","<=","=",">","<","?","/","#"];function wd(t){const e=aw.find(r=>t.split(r).length===2),i=t.split(e).map(r=>r.trim()),[o,n]=i,s=n.startsWith("'")&&n.endsWith("'")?n.replace(/'/g,""):cr(n);return{key:o,condition:e,value:s}}const ma=t=>{try{const e=[],i=t.split(/&(?![^()]*\))/).map(o=>o.trim());for(const o of i){const n=!o.startsWith("(")&&!o.endsWith(")"),s=o.startsWith("(")&&o.endsWith(")");if(n){const r=wd(o);e.push(r)}if(s){const r={operator:"&",queries:o.replace(/^(\()|(\))$/g,"").split("&").map(a=>a.trim()).map((a,l)=>{const c=wd(a);return l>0&&(c.operator="&"),c})};e.push(r)}}return e}catch{return null}},$d=(t,e,i)=>{let o=!1;switch(e){case"=":o=t===i;break;case"?":o=String(t).includes(String(i));break;case"<":(typeof t=="number"||typeof i=="number")&&(o=t<i);break;case"<=":(typeof t=="number"||typeof i=="number")&&(o=t<=i);break;case">":(typeof t=="number"||typeof i=="number")&&(o=t>i);break;case">=":(typeof t=="number"||typeof i=="number")&&(o=t>=i);break;case"/":o=String(t).startsWith(String(i));break}return o};var lw=Object.defineProperty,cw=Object.getOwnPropertyDescriptor,sp=(t,e,i,o)=>{for(var n=cw(e,i),s=t.length-1,r;s>=0;s--)(r=t[s])&&(n=r(e,i,n)||n);return n&&lw(e,i,n),n},xe;const gl=(xe=class extends K{constructor(){super(...arguments),this._previousContainer=null,this._visible=!1}get placement(){return this._placement}set placement(t){this._placement=t,this.updatePosition()}static removeMenus(){for(const t of[...xe.dialog.children])t instanceof xe&&(t.remove(),t.visible=!1);setTimeout(()=>{xe.dialog.close(),xe.dialog.remove()},310)}get visible(){return this._visible}set visible(t){this._visible=t,t?(xe.dialog.parentElement||document.body.append(xe.dialog),this._previousContainer=this.parentElement,xe.dialog.style.top=`${window.scrollY||document.documentElement.scrollTop}px`,this.style.setProperty("display","flex"),xe.dialog.append(this),xe.dialog.showModal(),this.updatePosition(),this.dispatchEvent(new Event("visible"))):setTimeout(()=>{var e;(e=this._previousContainer)==null||e.append(this),this._previousContainer=null,this.style.setProperty("display","none"),this.dispatchEvent(new Event("hidden"))},310)}async updatePosition(){if(!(this.visible&&this._previousContainer))return;const t=this.placement??"right",e=await rl(this._previousContainer,this,{placement:t,middleware:[el(10),sl(),ol(),nl({padding:5})]}),{x:i,y:o}=e;this.style.left=`${i}px`,this.style.top=`${o}px`}connectedCallback(){super.connectedCallback(),this.visible?(this.style.setProperty("width","auto"),this.style.setProperty("height","auto")):(this.style.setProperty("display","none"),this.style.setProperty("width","0"),this.style.setProperty("height","0"))}render(){return w` <slot></slot> `}},xe.styles=[ni.scrollbar,ie`
      :host {
        pointer-events: auto;
        position: absolute;
        top: 0;
        left: 0;
        z-index: 999;
        overflow: auto;
        max-height: 20rem;
        min-width: 3rem;
        flex-direction: column;
        box-shadow: 1px 2px 8px 2px rgba(0, 0, 0, 0.15);
        padding: 0.5rem;
        border-radius: var(--bim-ui_size-4xs);
        display: flex;
        transform-origin: top left;
        transform: scale(1);
        clip-path: circle(150% at top left);
        background-color: var(--bim-ui_bg-contrast-20);
        transition:
          clip-path 0.2s cubic-bezier(0.72, 0.1, 0.43, 0.93),
          transform 0.3s cubic-bezier(0.72, 0.1, 0.45, 2.35);
      }

      :host(:not([visible])) {
        transform: scale(0.8);
        clip-path: circle(0 at top left);
      }
    `],xe.dialog=be.create(()=>w` <dialog
      @click=${t=>{t.target===xe.dialog&&xe.removeMenus()}}
      @cancel=${()=>xe.removeMenus()}
      data-context-dialog
      style="
      width: 0;
      height: 0;
      position: relative;
      padding: 0;
      border: none;
      outline: none;
      margin: none;
      overflow: visible;
      background-color: transparent;
    "
    ></dialog>`),xe);sp([x({type:String,reflect:!0})],gl.prototype,"placement");sp([x({type:Boolean,reflect:!0})],gl.prototype,"visible");let Kn=gl;var dw=Object.defineProperty,uw=Object.getOwnPropertyDescriptor,at=(t,e,i,o)=>{for(var n=o>1?void 0:o?uw(e,i):e,s=t.length-1,r;s>=0;s--)(r=t[s])&&(n=(o?r(e,i,n):r(n))||n);return o&&n&&dw(e,i,n),n},jn;const Ke=(jn=class extends K{constructor(){super(),this.labelHidden=!1,this.active=!1,this.disabled=!1,this.vertical=!1,this.tooltipVisible=!1,this._stateBeforeLoading={disabled:!1,icon:""},this._loading=!1,this._parent=gn(),this._tooltip=gn(),this._mouseLeave=!1,this.onClick=t=>{t.stopPropagation(),this.disabled||this.dispatchEvent(new Event("click"))},this.showContextMenu=()=>{let t=this._contextMenu;if(this.contextMenuTemplate&&(t=be.create(()=>{const e=be.create(this.contextMenuTemplate);return e instanceof Kn?w`${e}`:w`
          <bim-context-menu>${e}</bim-context-menu>
        `}),this.append(t),t.addEventListener("hidden",()=>{t?.remove()})),t){const e=this.getAttribute("data-context-group");e&&t.setAttribute("data-context-group",e),this.closeNestedContexts();const i=Ne.newRandomId();for(const o of t.children)o instanceof jn&&o.setAttribute("data-context-group",i);t.visible=!0}},this.mouseLeave=!0}set loading(t){if(this._loading=t,t)this._stateBeforeLoading={disabled:this.disabled,icon:this.icon},this.disabled=t,this.icon="eos-icons:loading";else{const{disabled:e,icon:i}=this._stateBeforeLoading;this.disabled=e,this.icon=i}}get loading(){return this._loading}set mouseLeave(t){this._mouseLeave=t,t&&(this.tooltipVisible=!1,clearTimeout(this.timeoutID))}get mouseLeave(){return this._mouseLeave}computeTooltipPosition(){const{value:t}=this._parent,{value:e}=this._tooltip;t&&e&&rl(t,e,{placement:"bottom",middleware:[el(10),sl(),ol(),nl({padding:5})]}).then(i=>{const{x:o,y:n}=i;Object.assign(e.style,{left:`${o}px`,top:`${n}px`})})}onMouseEnter(){if(!(this.tooltipTitle||this.tooltipText))return;this.mouseLeave=!1;const t=this.tooltipTime??700;this.timeoutID=setTimeout(()=>{this.mouseLeave||(this.computeTooltipPosition(),this.tooltipVisible=!0)},t)}closeNestedContexts(){const t=this.getAttribute("data-context-group");if(t)for(const e of Kn.dialog.children){const i=e.getAttribute("data-context-group");if(e instanceof Kn&&i===t){e.visible=!1,e.removeAttribute("data-context-group");for(const o of e.children)o instanceof jn&&(o.closeNestedContexts(),o.removeAttribute("data-context-group"))}}}click(){this.disabled||super.click()}get _contextMenu(){return this.querySelector("bim-context-menu")}connectedCallback(){super.connectedCallback(),this.addEventListener("click",this.showContextMenu)}disconnectedCallback(){super.disconnectedCallback(),this.removeEventListener("click",this.showContextMenu)}render(){const t=w`
      <div ${me(this._tooltip)} class="tooltip">
        ${this.tooltipTitle?w`<p style="text-wrap: nowrap;">
              <strong>${this.tooltipTitle}</strong>
            </p>`:null}
        ${this.tooltipText?w`<p style="width: 9rem;">${this.tooltipText}</p>`:null}
      </div>
    `;let e=w`${this.label}`;if((this._contextMenu||this.contextMenuTemplate)&&this.label){const i=w`<svg
        xmlns="http://www.w3.org/2000/svg"
        height="1.125rem"
        viewBox="0 0 24 24"
        width="1.125rem"
        style="fill: var(--bim-label--c)"
      >
        <path d="M0 0h24v24H0V0z" fill="none" />
        <path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
      </svg>`;e=w`
        <div style="display: flex; align-items: center;">
          ${this.label}
          ${i}
        </div>
      `}return w`
      <div ${me(this._parent)} class="parent" @click=${this.onClick}>
        ${this.label||this.icon?w`
              <div
                class="button"
                @mouseenter=${this.onMouseEnter}
                @mouseleave=${()=>this.mouseLeave=!0}
              >
                <bim-label
                  .icon=${this.icon}
                  .vertical=${this.vertical}
                  .labelHidden=${this.labelHidden}
                  >${e}</bim-label
                >
              </div>
            `:null}
        ${this.tooltipTitle||this.tooltipText?t:null}
      </div>
      <slot></slot>
    `}},jn.styles=ie`
    :host {
      --bim-label--c: var(--bim-ui_bg-contrast-100, white);
      position: relative;
      display: block;
      flex: 1;
      pointer-events: none;
      background-color: var(--bim-button--bgc, var(--bim-ui_bg-contrast-20));
      border-radius: var(--bim-ui_size-4xs);
      transition: all 0.15s;
    }

    :host(:not([disabled]))::before {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      border-radius: inherit;
      background-color: var(--bim-ui_main-base);
      clip-path: circle(0 at center center);
      box-sizing: border-box;
      transition:
        clip-path 0.3s cubic-bezier(0.65, 0.05, 0.36, 1),
        transform 0.15s;
    }

    :host(:not([disabled]):hover) {
      cursor: pointer;
    }

    bim-label {
      pointer-events: none;
    }

    .parent {
      --bim-icon--c: var(--bim-label--c);
      position: relative;
      display: flex;
      height: 100%;
      user-select: none;
      row-gap: 0.125rem;
      min-height: var(--bim-ui_size-5xl);
      min-width: var(--bim-ui_size-5xl);
    }

    .button,
    .children {
      box-sizing: border-box;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: auto;
    }

    .children {
      padding: 0 0.375rem;
      position: absolute;
      height: 100%;
      right: 0;
    }

    :host(:not([label-hidden])[icon][vertical]) .parent {
      min-height: 2.5rem;
    }

    .button {
      flex-grow: 1;
      transition: transform 0.15s;
    }

    :host(:not([label-hidden])[label]) .button {
      justify-content: var(--bim-button--jc, center);
    }

    :host(:hover)::before {
      clip-path: circle(120% at center center);
    }

    :host(:hover) {
      --bim-label--c: var(--bim-ui_main-contrast);
      z-index: 2;
    }

    :host([active]) {
      background-color: var(--bim-ui_main-base);
    }

    :host(:not([disabled]):active) {
      background: transparent;
    }

    :host(:not([disabled]):active) .button,
    :host(:not([disabled]):active)::before {
      transform: scale(0.98);
    }

    :host(:not([label]):not([icon])) .children {
      flex: 1;
    }

    :host([vertical]) .parent {
      justify-content: center;
    }

    :host(:not([label-hidden])[label]) .button {
      padding: 0 0.5rem;
    }

    :host([disabled]) {
      --bim-label--c: var(--bim-ui_bg-contrast-80) !important;
      background-color: gray !important;
    }

    ::slotted(bim-button) {
      --bim-icon--fz: var(--bim-ui_size-base);
      --bim-button--bdrs: var(--bim-ui_size-4xs);
      --bim-button--olw: 0;
      --bim-button--olc: transparent;
    }

    .tooltip {
      position: absolute;
      padding: 0.75rem;
      z-index: 99;
      display: flex;
      flex-flow: column;
      row-gap: 0.375rem;
      box-shadow: 0 0 10px 3px rgba(0 0 0 / 20%);
      outline: 1px solid var(--bim-ui_bg-contrast-40);
      font-size: var(--bim-ui_size-xs);
      border-radius: var(--bim-ui_size-4xs);
      background-color: var(--bim-ui_bg-contrast-20);
      color: var(--bim-ui_bg-contrast-100);
      animation: openTooltips 0.15s ease-out forwards;
      transition: visibility 0.2s;
    }

    .tooltip p {
      margin: 0;
      padding: 0;
    }

    :host(:not([tooltip-visible])) .tooltip {
      animation: closeTooltips 0.15s ease-in forwards;
      visibility: hidden;
      display: none;
    }

    @keyframes closeTooltips {
      0% {
        display: flex;
        padding: 0.75rem;
        transform: translateY(0);
        opacity: 1;
      }
      90% {
        padding: 0.75rem;
      }
      100% {
        display: none;
        padding: 0;
        transform: translateY(-10px);
        opacity: 0;
      }
    }

    @keyframes openTooltips {
      0% {
        display: flex;
        transform: translateY(-10px);
        opacity: 0;
      }
      100% {
        transform: translateY(0);
        opacity: 1;
      }
    }
  `,jn);at([x({type:String,reflect:!0})],Ke.prototype,"label",2);at([x({type:Boolean,attribute:"label-hidden",reflect:!0})],Ke.prototype,"labelHidden",2);at([x({type:Boolean,reflect:!0})],Ke.prototype,"active",2);at([x({type:Boolean,reflect:!0,attribute:"disabled"})],Ke.prototype,"disabled",2);at([x({type:String,reflect:!0})],Ke.prototype,"icon",2);at([x({type:Boolean,reflect:!0})],Ke.prototype,"vertical",2);at([x({type:Number,attribute:"tooltip-time",reflect:!0})],Ke.prototype,"tooltipTime",2);at([x({type:Boolean,attribute:"tooltip-visible",reflect:!0})],Ke.prototype,"tooltipVisible",2);at([x({type:String,attribute:"tooltip-title",reflect:!0})],Ke.prototype,"tooltipTitle",2);at([x({type:String,attribute:"tooltip-text",reflect:!0})],Ke.prototype,"tooltipText",2);at([x({type:Boolean,reflect:!0})],Ke.prototype,"loading",1);let hw=Ke;var pw=Object.defineProperty,No=(t,e,i,o)=>{for(var n=void 0,s=t.length-1,r;s>=0;s--)(r=t[s])&&(n=r(e,i,n)||n);return n&&pw(e,i,n),n};const rp=class extends K{constructor(){super(...arguments),this.checked=!1,this.inverted=!1,this.onValueChange=new Event("change")}get value(){return this.checked}onChange(t){t.stopPropagation(),this.checked=t.target.checked,this.dispatchEvent(this.onValueChange)}render(){const t=w`
      <svg viewBox="0 0 21 21">
        <polyline points="5 10.75 8.5 14.25 16 6"></polyline>
      </svg>
    `;return w`
      <div class="parent">
        <label class="parent-label">
          ${this.label?w`<bim-label .icon="${this.icon}">${this.label}</bim-label> `:null}
          <div class="input-container">
            <input
              type="checkbox"
              aria-label=${this.label||this.name||"Checkbox Input"}
              @change="${this.onChange}"
              .checked="${this.checked}"
            />
            ${t}
          </div>
        </label>
      </div>
    `}};rp.styles=ie`
    :host {
      display: block;
    }

    .parent-label {
      --background: #fff;
      --border: #dfdfe6;
      --stroke: #fff;
      --border-hover: var(--bim-ui_main-base);
      --border-active: var(--bim-ui_main-base);
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
      width: 100%;
      height: 1.75rem;
      column-gap: 0.25rem;
      position: relative;
      cursor: pointer;
      user-select: none;
      -webkit-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
    }

    :host([inverted]) .parent-label {
      flex-direction: row-reverse;
      justify-content: start;
    }

    input,
    svg {
      width: 1rem;
      height: 1rem;
      display: block;
    }

    input {
      -webkit-appearance: none;
      -moz-appearance: none;
      position: relative;
      outline: none;
      background: var(--background);
      border: none;
      margin: 0;
      padding: 0;
      cursor: pointer;
      border-radius: 4px;
      transition: box-shadow 0.3s;
      box-shadow: inset 0 0 0 var(--s, 1px) var(--b, var(--border));
    }

    svg {
      pointer-events: none;
      fill: none;
      stroke-width: 2.2px;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke: var(--stroke, var(--border-active));
      transform: translateY(-100%) scale(0);
      position: absolute;
      width: 1rem;
      height: 1rem;
    }

    input:hover {
      --s: 2px;
      --b: var(--border-hover);
    }

    input:checked {
      --b: var(--border-active);
      --s: 11px;
    }

    input:checked + svg {
      -webkit-animation: bounce 0.4s linear forwards 0.2s;
      animation: bounce 0.4s linear forwards 0.2s;
    }

    @keyframes bounce {
      0% {
        transform: translateY(-100%) scale(0);
      }
      50% {
        transform: translateY(-100%) scale(1.2);
      }
      75% {
        transform: translateY(-100%) scale(0.9);
      }
      100% {
        transform: translateY(-100%) scale(1);
      }
    }
  `;let An=rp;No([x({type:String,reflect:!0})],An.prototype,"icon");No([x({type:String,reflect:!0})],An.prototype,"name");No([x({type:String,reflect:!0})],An.prototype,"label");No([x({type:Boolean,reflect:!0})],An.prototype,"checked");No([x({type:Boolean,reflect:!0})],An.prototype,"inverted");var fw=Object.defineProperty,Mi=(t,e,i,o)=>{for(var n=void 0,s=t.length-1,r;s>=0;s--)(r=t[s])&&(n=r(e,i,n)||n);return n&&fw(e,i,n),n};const ap=class extends K{constructor(){super(...arguments),this.vertical=!1,this.color="#bcf124",this.disabled=!1,this._colorInput=gn(),this._textInput=gn(),this.onValueChange=new Event("input"),this.onOpacityInput=t=>{const e=t.target;this.opacity=e.value,this.dispatchEvent(this.onValueChange)}}set value(t){const{color:e,opacity:i}=t;this.color=e,i&&(this.opacity=i)}get value(){const t={color:this.color};return this.opacity&&(t.opacity=this.opacity),t}onColorInput(t){t.stopPropagation();const{value:e}=this._colorInput;e&&(this.color=e.value,this.dispatchEvent(this.onValueChange))}onTextInput(t){t.stopPropagation();const{value:e}=this._textInput;if(!e)return;const{value:i}=e;let o=i.replace(/[^a-fA-F0-9]/g,"");o.startsWith("#")||(o=`#${o}`),e.value=o.slice(0,7),e.value.length===7&&(this.color=e.value,this.dispatchEvent(this.onValueChange))}focus(){const{value:t}=this._colorInput;t&&t.click()}render(){return w`
      <div class="parent">
        <bim-input
          .label=${this.label}
          .icon=${this.icon}
          .vertical="${this.vertical}"
        >
          <div class="color-container">
            <div
              style="display: flex; align-items: center; gap: .375rem; height: 100%; flex: 1; padding: 0 0.5rem;"
            >
              <input
                ${me(this._colorInput)}
                @input="${this.onColorInput}"
                type="color"
                aria-label=${this.label||this.name||"Color Input"}
                value="${this.color}"
                ?disabled=${this.disabled}
              />
              <div
                @click=${this.focus}
                class="sample"
                style="background-color: ${this.color}"
              ></div>
              <input
                ${me(this._textInput)}
                @input="${this.onTextInput}"
                value="${this.color}"
                type="text"
                aria-label=${this.label||this.name||"Text Color Input"}
                ?disabled=${this.disabled}
              />
            </div>
            ${this.opacity!==void 0?w`<bim-number-input
                  @change=${this.onOpacityInput}
                  slider
                  suffix="%"
                  min="0"
                  value=${this.opacity}
                  max="100"
                ></bim-number-input>`:null}
          </div>
        </bim-input>
      </div>
    `}};ap.styles=ie`
    :host {
      --bim-input--bgc: var(--bim-ui_bg-contrast-20);
      flex: 1;
      display: block;
    }

    :host(:focus) {
      --bim-input--olw: var(--bim-number-input--olw, 2px);
      --bim-input--olc: var(--bim-ui_accent-base);
    }

    .parent {
      display: flex;
      gap: 0.375rem;
    }

    .color-container {
      position: relative;
      outline: none;
      display: flex;
      height: 100%;
      gap: 0.5rem;
      justify-content: flex-start;
      align-items: center;
      flex: 1;
      border-radius: var(--bim-color-input--bdrs, var(--bim-ui_size-4xs));
    }

    .color-container input[type="color"] {
      position: absolute;
      bottom: -0.25rem;
      visibility: hidden;
      width: 0;
      height: 0;
    }

    .color-container .sample {
      width: 1rem;
      height: 1rem;
      border-radius: 0.125rem;
      background-color: #fff;
    }

    .color-container input[type="text"] {
      height: 100%;
      flex: 1;
      width: 3.25rem;
      text-transform: uppercase;
      font-size: 0.75rem;
      background-color: transparent;
      padding: 0%;
      outline: none;
      border: none;
      color: var(--bim-color-input--c, var(--bim-ui_bg-contrast-100));
    }

    :host([disabled]) .color-container input[type="text"] {
      color: var(--bim-ui_bg-contrast-60);
    }

    bim-number-input {
      flex-grow: 0;
    }
  `;let oi=ap;Mi([x({type:String,reflect:!0})],oi.prototype,"name");Mi([x({type:String,reflect:!0})],oi.prototype,"label");Mi([x({type:String,reflect:!0})],oi.prototype,"icon");Mi([x({type:Boolean,reflect:!0})],oi.prototype,"vertical");Mi([x({type:Number,reflect:!0})],oi.prototype,"opacity");Mi([x({type:String,reflect:!0})],oi.prototype,"color");Mi([x({type:Boolean,reflect:!0})],oi.prototype,"disabled");var mw=Object.defineProperty,bw=Object.getOwnPropertyDescriptor,si=(t,e,i,o)=>{for(var n=o>1?void 0:o?bw(e,i):e,s=t.length-1,r;s>=0;s--)(r=t[s])&&(n=(o?r(e,i,n):r(n))||n);return o&&n&&mw(e,i,n),n};const lp=class extends K{constructor(){super(...arguments),this.checked=!1,this.checkbox=!1,this.noMark=!1,this.vertical=!1}get value(){return this._value!==void 0?this._value:this.label?cr(this.label):this.label}set value(t){this._value=t}render(){return w`
      <div class="parent" .title=${this.label??""}>
        ${this.img||this.icon||this.label?w` <div style="display: flex; column-gap: 0.375rem">
              ${this.checkbox&&!this.noMark?w`<bim-checkbox
                    style="pointer-events: none"
                    .checked=${this.checked}
                  ></bim-checkbox>`:null}
              <bim-label
                .vertical=${this.vertical}
                .icon=${this.icon}
                .img=${this.img}
                >${this.label}</bim-label
              >
            </div>`:null}
        ${!this.checkbox&&!this.noMark&&this.checked?w`<svg
              xmlns="http://www.w3.org/2000/svg"
              height="1.125rem"
              viewBox="0 0 24 24"
              width="1.125rem"
              fill="#FFFFFF"
            >
              <path d="M0 0h24v24H0z" fill="none" />
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>`:null}
        <slot></slot>
      </div>
    `}};lp.styles=ie`
    :host {
      --bim-label--c: var(--bim-ui_bg-contrast-100);
      display: block;
      box-sizing: border-box;
      flex: 1;
      padding: 0rem 0.5rem;
      border-radius: var(--bim-ui_size-4xs);
      transition: all 0.15s;
    }

    :host(:hover) {
      cursor: pointer;
    }

    :host([checked]) {
      --bim-label--c: color-mix(in lab, var(--bim-ui_main-base), white 30%);
    }

    :host([checked]) svg {
      fill: color-mix(in lab, var(--bim-ui_main-base), white 30%);
    }

    .parent {
      box-sizing: border-box;
      display: flex;
      justify-content: var(--bim-option--jc, space-between);
      column-gap: 0.5rem;
      align-items: center;
      min-height: 1.75rem;
      height: 100%;
    }

    input {
      height: 1rem;
      width: 1rem;
      cursor: pointer;
      border: none;
      outline: none;
      accent-color: var(--bim-checkbox--c, var(--bim-ui_main-base));
    }

    input:focus {
      outline: var(--bim-checkbox--olw, 2px) solid
        var(--bim-checkbox--olc, var(--bim-ui_accent-base));
    }

    bim-label {
      pointer-events: none;
      z-index: 1;
    }
  `;let he=lp;si([x({type:String,reflect:!0})],he.prototype,"img",2);si([x({type:String,reflect:!0})],he.prototype,"label",2);si([x({type:String,reflect:!0})],he.prototype,"icon",2);si([x({type:Boolean,reflect:!0})],he.prototype,"checked",2);si([x({type:Boolean,reflect:!0})],he.prototype,"checkbox",2);si([x({type:Boolean,attribute:"no-mark",reflect:!0})],he.prototype,"noMark",2);si([x({converter:{fromAttribute(t){return t&&cr(t)}}})],he.prototype,"value",1);si([x({type:Boolean,reflect:!0})],he.prototype,"vertical",2);var gw=Object.defineProperty,yw=Object.getOwnPropertyDescriptor,$t=(t,e,i,o)=>{for(var n=o>1?void 0:o?yw(e,i):e,s=t.length-1,r;s>=0;s--)(r=t[s])&&(n=(o?r(e,i,n):r(n))||n);return o&&n&&gw(e,i,n),n};const cp=class extends be{constructor(){super(),this.multiple=!1,this.required=!1,this.vertical=!1,this._visible=!1,this._value=new Set,this.onValueChange=new Event("change"),this._contextMenu=gn(),this.onOptionClick=t=>{const e=t.target,i=this._value.has(e);if(!this.multiple&&!this.required&&!i)this._value=new Set([e]);else if(!this.multiple&&!this.required&&i)this._value=new Set([]);else if(!this.multiple&&this.required&&!i)this._value=new Set([e]);else if(this.multiple&&!this.required&&!i)this._value=new Set([...this._value,e]);else if(this.multiple&&!this.required&&i){const o=[...this._value].filter(n=>n!==e);this._value=new Set(o)}else if(this.multiple&&this.required&&!i)this._value=new Set([...this._value,e]);else if(this.multiple&&this.required&&i){const o=[...this._value].filter(s=>s!==e),n=new Set(o);n.size!==0&&(this._value=n)}this.updateOptionsState(),this.dispatchEvent(this.onValueChange)},this.onSearch=({target:t})=>{const e=t.value.toLowerCase();for(const i of this._options)i instanceof he&&((i.label||i.value||"").toLowerCase().includes(e)?i.style.display="":i.style.display="none")},this.useObserver=!0}set visible(t){var e;if(t){const{value:i}=this._contextMenu;if(!i)return;for(const o of this.elements)i.append(o);this._visible=!0}else{for(const o of this.elements)this.append(o);this._visible=!1,this.resetVisibleElements();for(const o of this._options)o instanceof he&&(o.style.display="");const i=(e=this._contextMenu.value)==null?void 0:e.querySelector("bim-text-input");i&&(i.value="")}}get visible(){return this._visible}set value(t){if(this.required&&Object.keys(t).length===0)return;const e=new Set;for(const i of t){const o=this.findOption(i);if(o&&(e.add(o),!this.multiple&&Object.keys(t).length===1))break}this._value=e,this.updateOptionsState(),this.dispatchEvent(this.onValueChange)}get value(){return[...this._value].filter(t=>t instanceof he&&t.checked).map(t=>t.value)}get _options(){const t=new Set([...this.elements]);for(const e of this.children)e instanceof he&&t.add(e);return[...t]}onSlotChange(t){const e=t.target.assignedElements();this.observe(e);const i=new Set;for(const o of this.elements){if(!(o instanceof he)){o.remove();continue}o.checked&&i.add(o),o.removeEventListener("click",this.onOptionClick),o.addEventListener("click",this.onOptionClick)}this._value=i}updateOptionsState(){for(const t of this._options)t instanceof he&&(t.checked=this._value.has(t))}findOption(t){return this._options.find(e=>e instanceof he?e.label===t||e.value===t:!1)}render(){let t,e,i;if(this._value.size===0)t=this.placeholder??"Select an option...";else if(this._value.size===1){const o=[...this._value][0];t=o?.label||o?.value,e=o?.img,i=o?.icon}else t=`Multiple (${this._value.size})`;return w`
      <bim-input
        title=${this.label??""}
        .label=${this.label}
        .icon=${this.icon}
        .vertical=${this.vertical}
      >
        <div class="input" @click=${()=>this.visible=!this.visible}>
          <bim-label
            .img=${e}
            .icon=${i}
            style="overflow: hidden;"
            >${t}</bim-label
          >
          <svg
            style="flex-shrink: 0; fill: var(--bim-dropdown--c, var(--bim-ui_bg-contrast-100))"
            xmlns="http://www.w3.org/2000/svg"
            height="1.125rem"
            viewBox="0 0 24 24"
            width="1.125rem"
            fill="#9ca3af"
          >
            <path d="M0 0h24v24H0V0z" fill="none" />
            <path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
          </svg>
          <bim-context-menu
            ${me(this._contextMenu)}
            .visible=${this.visible}
            @hidden=${()=>{this.visible&&(this.visible=!1)}}
          >
            ${this.searchBox?w`<bim-text-input @input=${this.onSearch} placeholder="Search..." debounce=200 style="--bim-input--bgc: var(--bim-ui_bg-contrast-30)"></bim-text-input>`:se}
            <slot @slotchange=${this.onSlotChange}></slot>
          </bim-context-menu>
        </div>
      </bim-input>
    `}};cp.styles=[ni.scrollbar,ie`
      :host {
        --bim-input--bgc: var(
          --bim-dropdown--bgc,
          var(--bim-ui_bg-contrast-20)
        );
        --bim-input--olw: 2px;
        --bim-input--olc: transparent;
        --bim-input--bdrs: var(--bim-ui_size-4xs);
        flex: 1;
        display: block;
      }

      :host([visible]) {
        --bim-input--olc: var(--bim-ui_accent-base);
      }

      .input {
        --bim-label--fz: var(--bim-drodown--fz, var(--bim-ui_size-xs));
        --bim-label--c: var(--bim-dropdown--c, var(--bim-ui_bg-contrast-100));
        height: 100%;
        display: flex;
        flex: 1;
        overflow: hidden;
        column-gap: 0.25rem;
        outline: none;
        cursor: pointer;
        align-items: center;
        justify-content: space-between;
        padding: 0 0.5rem;
      }

      bim-label {
        pointer-events: none;
      }
    `];let lt=cp;$t([x({type:String,reflect:!0})],lt.prototype,"name",2);$t([x({type:String,reflect:!0})],lt.prototype,"icon",2);$t([x({type:String,reflect:!0})],lt.prototype,"label",2);$t([x({type:Boolean,reflect:!0})],lt.prototype,"multiple",2);$t([x({type:Boolean,reflect:!0})],lt.prototype,"required",2);$t([x({type:Boolean,reflect:!0})],lt.prototype,"vertical",2);$t([x({type:String,reflect:!0})],lt.prototype,"placeholder",2);$t([x({type:Boolean,reflect:!0,attribute:"search-box"})],lt.prototype,"searchBox",2);$t([x({type:Boolean,reflect:!0})],lt.prototype,"visible",1);$t([Li()],lt.prototype,"_value",2);var vw=Object.defineProperty,dp=(t,e,i,o)=>{for(var n=void 0,s=t.length-1,r;s>=0;s--)(r=t[s])&&(n=r(e,i,n)||n);return n&&vw(e,i,n),n};const up=class extends K{constructor(){super(...arguments),this.floating=!1,this._layouts={},this._elements={},this._templateIds=new Map,this._updateFunctions={},this._slotNames={notAllowed:"not-allowed",notFound:"not-found",emptyLayout:"empty-layout"},this.updateComponent={},this.emitLayoutChange=()=>{this.dispatchEvent(new Event("layoutchange"))}}set layouts(t){this._layouts=t,this._templateIds.clear()}get layouts(){return this._layouts}set elements(t){this._elements=t,this.setUpdateFunctions()}get elements(){return this._elements}getLayoutAreas(t){const{template:e}=t,i=e.split(`
`).map(o=>o.trim()).map(o=>o.split('"')[1]).filter(o=>o!==void 0).flatMap(o=>o.split(/\s+/));return[...new Set(i)].filter(o=>o!=="")}setUpdateFunctions(){const t={};for(const[e,i]of Object.entries(this.elements))"template"in i&&(t[e]=o=>{var n,s;(s=(n=this._updateFunctions)[e])==null||s.call(n,o)});this.updateComponent=t}disconnectedCallback(){super.disconnectedCallback(),this._templateIds.clear(),this._updateFunctions={},this.updateComponent={}}getTemplateId(t){let e=this._templateIds.get(t);return e||(e=Ne.newRandomId(),this._templateIds.set(t,e)),e}cleanUpdateFunctions(){if(!this.layout){this._updateFunctions={};return}const t=this.layouts[this.layout],e=this.getLayoutAreas(t);for(const i in this.elements)e.includes(i)||delete this._updateFunctions[i]}clean(){this.style.gridTemplate="";for(const t of[...this.children])Object.values(this._slotNames).some(e=>t.getAttribute("slot")===e)||t.remove();this.cleanUpdateFunctions()}emitElementCreation(t){this.dispatchEvent(new CustomEvent("elementcreated",{detail:t}))}render(){if(this.layout){const t=this.layouts[this.layout];if(t){if(!(t.guard??(()=>!0))())return this.clean(),w`<slot name=${this._slotNames.notAllowed}></slot>`;const e=this.getLayoutAreas(t).map(i=>{var o;const n=((o=t.elements)==null?void 0:o[i])||this.elements[i];if(!n)return null;if(n instanceof HTMLElement)return n.style.gridArea=i,n;if("template"in n){const{template:l,initialState:c}=n,d=this.getTemplateId(l),u=this.querySelector(`[data-grid-template-id="${d}"]`);if(u)return u;const[h,p]=be.create(l,c);return this.emitElementCreation({name:i,element:h}),h.setAttribute("data-grid-template-id",d),h.style.gridArea=i,this._updateFunctions[i]=p,h}const s=this.getTemplateId(n),r=this.querySelector(`[data-grid-template-id="${s}"]`);if(r)return r;const a=be.create(n);return this.emitElementCreation({name:i,element:a}),a.setAttribute("data-grid-template-id",this.getTemplateId(n)),a.style.gridArea=i,a}).filter(i=>i!==null);this.clean(),this.style.gridTemplate=t.template,this.append(...e),this.emitLayoutChange()}else return this.clean(),w`<slot name=${this._slotNames.notFound}></slot>`}else return this.clean(),this.emitLayoutChange(),w`<slot name=${this._slotNames.emptyLayout}></slot>`;return w`${w`<slot></slot>`}`}};up.styles=ie`
    :host {
      display: grid;
      height: 100%;
      width: 100%;
      overflow: hidden;
      box-sizing: border-box;
    }

    /* :host(:not([layout])) {
      display: none;
    } */

    :host([floating]) {
      --bim-panel--bdrs: var(--bim-ui_size-4xs);
      background-color: transparent;
      padding: 1rem;
      gap: 1rem;
      position: absolute;
      pointer-events: none;
      top: 0px;
      left: 0px;
    }

    :host(:not([floating])) {
      --bim-panel--bdrs: 0;
      background-color: var(--bim-ui_bg-contrast-20);
      gap: 1px;
    }
  `;let yl=up;dp([x({type:Boolean,reflect:!0})],yl.prototype,"floating");dp([x({type:String,reflect:!0})],yl.prototype,"layout");const ba=class extends K{render(){return w`
      <iconify-icon .icon=${this.icon} height="none"></iconify-icon>
    `}};ba.styles=ie`
    :host {
      height: var(--bim-icon--fz, var(--bim-ui_size-sm));
      width: var(--bim-icon--fz, var(--bim-ui_size-sm));
    }

    iconify-icon {
      height: var(--bim-icon--fz, var(--bim-ui_size-sm));
      width: var(--bim-icon--fz, var(--bim-ui_size-sm));
      color: var(--bim-icon--c);
      transition: all 0.15s;
      display: flex;
    }
  `,ba.properties={icon:{type:String}};let ww=ba;var $w=Object.defineProperty,dr=(t,e,i,o)=>{for(var n=void 0,s=t.length-1,r;s>=0;s--)(r=t[s])&&(n=r(e,i,n)||n);return n&&$w(e,i,n),n};const hp=class extends K{constructor(){super(...arguments),this.vertical=!1,this.onValueChange=new Event("change")}get value(){const t={};for(const e of this.children){const i=e;"value"in i?t[i.name||i.label]=i.value:"checked"in i&&(t[i.name||i.label]=i.checked)}return t}set value(t){const e=[...this.children];for(const i in t){const o=e.find(r=>{const a=r;return a.name===i||a.label===i});if(!o)continue;const n=o,s=t[i];typeof s=="boolean"?n.checked=s:n.value=s}}render(){return w`
      <div class="parent">
        ${this.label||this.icon?w`<bim-label .icon=${this.icon}>${this.label}</bim-label>`:null}
        <div class="input">
          <slot></slot>
        </div>
      </div>
    `}};hp.styles=ie`
    :host {
      flex: 1;
      display: block;
    }

    .parent {
      display: flex;
      flex-wrap: wrap;
      column-gap: 1rem;
      row-gap: 0.375rem;
      user-select: none;
      flex: 1;
    }

    :host(:not([vertical])) .parent {
      justify-content: space-between;
    }

    :host([vertical]) .parent {
      flex-direction: column;
    }

    .input {
      position: relative;
      overflow: hidden;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      min-height: 1.75rem;
      min-width: 3rem;
      gap: var(--bim-input--g, var(--bim-ui_size-4xs));
      padding: var(--bim-input--p, 0);
      background-color: var(--bim-input--bgc, transparent);
      border: var(--bim-input--olw, 2px) solid
        var(--bim-input--olc, transparent);
      border-radius: var(--bim-input--bdrs, var(--bim-ui_size-4xs));
      transition: all 0.15s;
    }

    :host(:not([vertical])) .input {
      flex: 1;
      justify-content: flex-end;
    }

    :host(:not([vertical])[label]) .input {
      max-width: fit-content;
    }
  `;let Bo=hp;dr([x({type:String,reflect:!0})],Bo.prototype,"name");dr([x({type:String,reflect:!0})],Bo.prototype,"label");dr([x({type:String,reflect:!0})],Bo.prototype,"icon");dr([x({type:Boolean,reflect:!0})],Bo.prototype,"vertical");/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */function Zi(t,e,i){return t?e(t):i?.(t)}/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const ga=t=>t??se;var _w=Object.defineProperty,Fo=(t,e,i,o)=>{for(var n=void 0,s=t.length-1,r;s>=0;s--)(r=t[s])&&(n=r(e,i,n)||n);return n&&_w(e,i,n),n};const pp=class extends K{constructor(){super(...arguments),this.labelHidden=!1,this.iconHidden=!1,this.vertical=!1,this._imgTemplate=()=>w`<img src=${ga(this.img)} .alt=${this.textContent||""} />`,this._iconTemplate=()=>w`<bim-icon .icon=${this.icon}></bim-icon>`}get value(){return this.textContent?cr(this.textContent):this.textContent}render(){return w`
      <div class="parent" title=${this.textContent}>
        ${Zi(this.img,this._imgTemplate,()=>se)}
        ${Zi(!this.iconHidden&&this.icon,this._iconTemplate,()=>se)}
        <p><slot></slot></p>
      </div>
    `}};pp.styles=ie`
    :host {
      --bim-icon--c: var(--bim-label--ic);
      overflow: auto;
      color: var(--bim-label--c, var(--bim-ui_bg-contrast-60));
      font-size: var(--bim-label--fz, var(--bim-ui_size-xs));
      display: block;
      white-space: nowrap;
      transition: all 0.15s;
    }

    :host([icon]) {
      line-height: 1.1rem;
    }

    .parent {
      display: flex;
      align-items: center;
      column-gap: 0.25rem;
      row-gap: 0.125rem;
      user-select: none;
      height: 100%;
    }

    :host([vertical]) .parent {
      flex-direction: column;
    }

    .parent p {
      margin: 0;
      text-overflow: ellipsis;
      overflow: hidden;
    }

    :host([label-hidden]) .parent p,
    :host(:empty) .parent p {
      display: none;
    }

    img {
      height: 100%;
      aspect-ratio: 1;
      border-radius: 100%;
      margin-right: 0.125rem;
    }

    :host(:not([vertical])) img {
      max-height: var(
        --bim-label_icon--sz,
        calc(var(--bim-label--fz, var(--bim-ui_size-xs)) * 1.8)
      );
    }

    :host([vertical]) img {
      max-height: var(
        --bim-label_icon--sz,
        calc(var(--bim-label--fz, var(--bim-ui_size-xs)) * 4)
      );
    }
  `;let kn=pp;Fo([x({type:String,reflect:!0})],kn.prototype,"img");Fo([x({type:Boolean,attribute:"label-hidden",reflect:!0})],kn.prototype,"labelHidden");Fo([x({type:String,reflect:!0})],kn.prototype,"icon");Fo([x({type:Boolean,attribute:"icon-hidden",reflect:!0})],kn.prototype,"iconHidden");Fo([x({type:Boolean,reflect:!0})],kn.prototype,"vertical");var xw=Object.defineProperty,Ew=Object.getOwnPropertyDescriptor,Qe=(t,e,i,o)=>{for(var n=o>1?void 0:o?Ew(e,i):e,s=t.length-1,r;s>=0;s--)(r=t[s])&&(n=(o?r(e,i,n):r(n))||n);return o&&n&&xw(e,i,n),n};const fp=class extends K{constructor(){super(...arguments),this._value=0,this.vertical=!1,this.slider=!1,this._input=gn(),this.onValueChange=new Event("change")}set value(t){this.setValue(t.toString())}get value(){return this._value}onChange(t){t.stopPropagation();const{value:e}=this._input;e&&this.setValue(e.value)}setValue(t){const{value:e}=this._input;let i=t;if(i=i.replace(/[^0-9.-]/g,""),i=i.replace(/(\..*)\./g,"$1"),i.endsWith(".")||(i.lastIndexOf("-")>0&&(i=i[0]+i.substring(1).replace(/-/g,"")),i==="-"||i==="-0"))return;let o=Number(i);Number.isNaN(o)||(o=this.min!==void 0?Math.max(o,this.min):o,o=this.max!==void 0?Math.min(o,this.max):o,this.value!==o&&(this._value=o,e&&(e.value=this.value.toString()),this.requestUpdate(),this.dispatchEvent(this.onValueChange)))}onBlur(){const{value:t}=this._input;t&&Number.isNaN(Number(t.value))&&(t.value=this.value.toString())}onSliderMouseDown(t){document.body.style.cursor="w-resize";const{clientX:e}=t,i=this.value;let o=!1;const n=a=>{var l;o=!0;const{clientX:c}=a,d=this.step??1,u=((l=d.toString().split(".")[1])==null?void 0:l.length)||0,h=1/(this.sensitivity??1),p=(c-e)/h;if(Math.floor(Math.abs(p))!==Math.abs(p))return;const m=i+p*d;this.setValue(m.toFixed(u))},s=()=>{this.slider=!0,this.removeEventListener("blur",s)},r=()=>{document.removeEventListener("mousemove",n),document.body.style.cursor="default",o?o=!1:(this.addEventListener("blur",s),this.slider=!1,requestAnimationFrame(()=>this.focus())),document.removeEventListener("mouseup",r)};document.addEventListener("mousemove",n),document.addEventListener("mouseup",r)}onFocus(t){t.stopPropagation();const e=i=>{i.key==="Escape"&&(this.blur(),window.removeEventListener("keydown",e))};window.addEventListener("keydown",e)}connectedCallback(){super.connectedCallback(),this.min&&this.min>this.value&&(this._value=this.min),this.max&&this.max<this.value&&(this._value=this.max)}focus(){const{value:t}=this._input;t&&t.focus()}render(){const t=w`
      ${this.pref||this.icon?w`<bim-label
            style="pointer-events: auto"
            @mousedown=${this.onSliderMouseDown}
            .icon=${this.icon}
            >${this.pref}</bim-label
          >`:null}
      <input
        ${me(this._input)}
        type="text"
        aria-label=${this.label||this.name||"Number Input"}
        size="1"
        @input=${r=>r.stopPropagation()}
        @change=${this.onChange}
        @blur=${this.onBlur}
        @focus=${this.onFocus}
        .value=${this.value.toString()}
      />
      ${this.suffix?w`<bim-label
            style="pointer-events: auto"
            @mousedown=${this.onSliderMouseDown}
            >${this.suffix}</bim-label
          >`:null}
    `,e=this.min??-1/0,i=this.max??1/0,o=100*(this.value-e)/(i-e),n=w`
      <style>
        .slider-indicator {
          width: ${`${o}%`};
        }
      </style>
      <div class="slider" @mousedown=${this.onSliderMouseDown}>
        <div class="slider-indicator"></div>
        ${this.pref||this.icon?w`<bim-label
              style="z-index: 1; margin-right: 0.125rem"
              .icon=${this.icon}
              >${`${this.pref}: `}</bim-label
            >`:null}
        <bim-label style="z-index: 1;">${this.value}</bim-label>
        ${this.suffix?w`<bim-label style="z-index: 1;">${this.suffix}</bim-label>`:null}
      </div>
    `,s=`${this.label||this.name||this.pref?`${this.label||this.name||this.pref}: `:""}${this.value}${this.suffix??""}`;return w`
      <bim-input
        title=${s}
        .label=${this.label}
        .icon=${this.icon}
        .vertical=${this.vertical}
      >
        ${this.slider?n:t}
      </bim-input>
    `}};fp.styles=ie`
    :host {
      --bim-input--bgc: var(
        --bim-number-input--bgc,
        var(--bim-ui_bg-contrast-20)
      );
      --bim-input--olw: var(--bim-number-input--olw, 2px);
      --bim-input--olc: var(--bim-number-input--olc, transparent);
      --bim-input--bdrs: var(--bim-number-input--bdrs, var(--bim-ui_size-4xs));
      --bim-input--p: 0 0.375rem;
      flex: 1;
      display: block;
    }

    :host(:focus) {
      --bim-input--olw: var(--bim-number-input--olw, 2px);
      --bim-input--olc: var(
        --bim-number-input¡focus--c,
        var(--bim-ui_accent-base)
      );
    }

    :host(:not([slider])) bim-label {
      --bim-label--c: var(
        --bim-number-input_affixes--c,
        var(--bim-ui_bg-contrast-60)
      );
      --bim-label--fz: var(
        --bim-number-input_affixes--fz,
        var(--bim-ui_size-xs)
      );
    }

    p {
      margin: 0;
      padding: 0;
    }

    input {
      background-color: transparent;
      outline: none;
      border: none;
      padding: 0;
      flex-grow: 1;
      text-align: right;
      font-family: inherit;
      font-feature-settings: inherit;
      font-variation-settings: inherit;
      font-size: var(--bim-number-input--fz, var(--bim-ui_size-xs));
      color: var(--bim-number-input--c, var(--bim-ui_bg-contrast-100));
    }

    :host([suffix]:not([pref])) input {
      text-align: left;
    }

    :host([slider]) {
      --bim-input--p: 0;
    }

    :host([slider]) .slider {
      --bim-label--c: var(--bim-ui_bg-contrast-100);
    }

    .slider {
      position: relative;
      display: flex;
      justify-content: center;
      width: 100%;
      height: 100%;
      padding: 0 0.5rem;
    }

    .slider-indicator {
      height: 100%;
      background-color: var(--bim-ui_main-base);
      position: absolute;
      top: 0;
      left: 0;
      border-radius: var(--bim-input--bdrs, var(--bim-ui_size-4xs));
    }

    bim-input {
      display: flex;
    }

    bim-label {
      pointer-events: none;
    }
  `;let He=fp;Qe([x({type:String,reflect:!0})],He.prototype,"name",2);Qe([x({type:String,reflect:!0})],He.prototype,"icon",2);Qe([x({type:String,reflect:!0})],He.prototype,"label",2);Qe([x({type:String,reflect:!0})],He.prototype,"pref",2);Qe([x({type:Number,reflect:!0})],He.prototype,"min",2);Qe([x({type:Number,reflect:!0})],He.prototype,"value",1);Qe([x({type:Number,reflect:!0})],He.prototype,"step",2);Qe([x({type:Number,reflect:!0})],He.prototype,"sensitivity",2);Qe([x({type:Number,reflect:!0})],He.prototype,"max",2);Qe([x({type:String,reflect:!0})],He.prototype,"suffix",2);Qe([x({type:Boolean,reflect:!0})],He.prototype,"vertical",2);Qe([x({type:Boolean,reflect:!0})],He.prototype,"slider",2);var Sw=Object.defineProperty,Cw=Object.getOwnPropertyDescriptor,Uo=(t,e,i,o)=>{for(var n=o>1?void 0:o?Cw(e,i):e,s=t.length-1,r;s>=0;s--)(r=t[s])&&(n=(o?r(e,i,n):r(n))||n);return o&&n&&Sw(e,i,n),n};const mp=class extends K{constructor(){super(...arguments),this.onValueChange=new Event("change"),this._hidden=!1,this.headerHidden=!1,this.valueTransform={},this.activationButton=document.createElement("bim-button")}set hidden(t){this._hidden=t,this.activationButton.active=!t,this.dispatchEvent(new Event("hiddenchange"))}get hidden(){return this._hidden}get value(){return yo(this,this.valueTransform)}set value(t){const e=[...this.children];for(const i in t){const o=e.find(s=>{const r=s;return r.name===i||r.label===i});if(!o)continue;const n=o;n.value=t[i]}}animatePanles(){const t=[{maxHeight:"100vh",maxWidth:"100vw",opacity:1},{maxHeight:"100vh",maxWidth:"100vw",opacity:0},{maxHeight:0,maxWidth:0,opacity:0}];this.animate(t,{duration:300,easing:"cubic-bezier(0.65, 0.05, 0.36, 1)",direction:this.hidden?"normal":"reverse",fill:"forwards"})}connectedCallback(){super.connectedCallback(),this.activationButton.active=!this.hidden,this.activationButton.onclick=()=>{this.hidden=!this.hidden,this.animatePanles()}}disconnectedCallback(){super.disconnectedCallback(),this.activationButton.remove()}collapseSections(){const t=this.querySelectorAll("bim-panel-section");for(const e of t)e.collapsed=!0}expandSections(){const t=this.querySelectorAll("bim-panel-section");for(const e of t)e.collapsed=!1}render(){return this.activationButton.icon=this.icon,this.activationButton.label=this.label||this.name,this.activationButton.tooltipTitle=this.label||this.name,w`
      <div class="parent">
        ${this.label||this.name||this.icon?w`<bim-label .icon=${this.icon}>${this.label}</bim-label>`:null}
        <div class="sections">
          <slot></slot>
        </div>
      </div>
    `}};mp.styles=[ni.scrollbar,ie`
      :host {
        display: flex;
        border-radius: var(--bim-ui_size-base);
        background-color: var(--bim-ui_bg-base);
        overflow: auto;
      }

      :host([hidden]) {
        max-height: 0;
        max-width: 0;
        opacity: 0;
      }

      .parent {
        display: flex;
        flex: 1;
        flex-direction: column;
        pointer-events: auto;
        overflow: auto;
      }

      .parent bim-label {
        --bim-label--c: var(--bim-panel--c, var(--bim-ui_bg-contrast-80));
        --bim-label--fz: var(--bim-panel--fz, var(--bim-ui_size-sm));
        font-weight: 600;
        padding: 1rem;
        flex-shrink: 0;
        border-bottom: 1px solid var(--bim-ui_bg-contrast-20);
      }

      :host([header-hidden]) .parent bim-label {
        display: none;
      }

      .sections {
        height: 100%;
        display: flex;
        flex-direction: column;
        overflow: auto;
        flex: 1;
      }

      ::slotted(bim-panel-section:not(:last-child)) {
        border-bottom: 1px solid var(--bim-ui_bg-contrast-20);
      }
    `];let zi=mp;Uo([x({type:String,reflect:!0})],zi.prototype,"icon",2);Uo([x({type:String,reflect:!0})],zi.prototype,"name",2);Uo([x({type:String,reflect:!0})],zi.prototype,"label",2);Uo([x({type:Boolean,reflect:!0})],zi.prototype,"hidden",1);Uo([x({type:Boolean,attribute:"header-hidden",reflect:!0})],zi.prototype,"headerHidden",2);var Aw=Object.defineProperty,Ho=(t,e,i,o)=>{for(var n=void 0,s=t.length-1,r;s>=0;s--)(r=t[s])&&(n=r(e,i,n)||n);return n&&Aw(e,i,n),n};const bp=class extends K{constructor(){super(...arguments),this.onValueChange=new Event("change"),this.valueTransform={},this.componentHeight=-1}get value(){const t=this.parentElement;let e;return t instanceof zi&&(e=t.valueTransform),Object.values(this.valueTransform).length!==0&&(e=this.valueTransform),yo(this,e)}set value(t){const e=[...this.children];for(const i in t){const o=e.find(s=>{const r=s;return r.name===i||r.label===i});if(!o)continue;const n=o;n.value=t[i]}}setFlexAfterTransition(){var t;const e=(t=this.shadowRoot)==null?void 0:t.querySelector(".components");e&&setTimeout(()=>{this.collapsed?e.style.removeProperty("flex"):e.style.setProperty("flex","1")},150)}animateHeader(){var t;const e=(t=this.shadowRoot)==null?void 0:t.querySelector(".components");this.componentHeight<0&&(this.collapsed?this.componentHeight=e.clientHeight:(e.style.setProperty("transition","none"),e.style.setProperty("height","auto"),e.style.setProperty("padding","0.125rem 1rem 1rem"),this.componentHeight=e.clientHeight,requestAnimationFrame(()=>{e.style.setProperty("height","0px"),e.style.setProperty("padding","0 1rem 0"),e.style.setProperty("transition","height 0.25s cubic-bezier(0.65, 0.05, 0.36, 1), padding 0.25s cubic-bezier(0.65, 0.05, 0.36, 1)")}))),this.collapsed?(e.style.setProperty("height",`${this.componentHeight}px`),requestAnimationFrame(()=>{e.style.setProperty("height","0px"),e.style.setProperty("padding","0 1rem 0")})):(e.style.setProperty("height","0px"),e.style.setProperty("padding","0 1rem 0"),requestAnimationFrame(()=>{e.style.setProperty("height",`${this.componentHeight}px`),e.style.setProperty("padding","0.125rem 1rem 1rem")})),this.setFlexAfterTransition()}onHeaderClick(){this.fixed||(this.collapsed=!this.collapsed,this.animateHeader())}handelSlotChange(t){t.target.assignedElements({flatten:!0}).forEach((e,i)=>{const o=i*.05;e.style.setProperty("transition-delay",`${o}s`)})}handlePointerEnter(){const t=this.renderRoot.querySelector(".expand-icon");this.collapsed?t?.style.setProperty("animation","collapseAnim 0.5s"):t?.style.setProperty("animation","expandAnim 0.5s")}handlePointerLeave(){const t=this.renderRoot.querySelector(".expand-icon");t?.style.setProperty("animation","none")}render(){const t=this.label||this.icon||this.name||this.fixed,e=w`<svg
      xmlns="http://www.w3.org/2000/svg"
      height="1.125rem"
      viewBox="0 0 24 24"
      width="1.125rem"
      class="expand-icon"
    >
      <path d="M0 0h24v24H0z" fill="none" />
      <path d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z" />
    </svg>`,i=w`
      <div
        class="header"
        title=${this.label??""}
        @pointerenter=${this.handlePointerEnter}
        @pointerleave=${this.handlePointerLeave}
        @click=${this.onHeaderClick}
      >
        ${this.label||this.icon||this.name?w`<bim-label .icon=${this.icon}>${this.label}</bim-label>`:null}
        ${this.fixed?null:e}
      </div>
    `;return w`
      <div class="parent">
        ${t?i:null}
        <div class="components" style="flex: 1;">
          <div>
            <slot @slotchange=${this.handelSlotChange}></slot>
          </div>
        </div>
      </div>
    `}};bp.styles=[ni.scrollbar,ie`
      :host {
        display: block;
        pointer-events: auto;
      }

      :host .parent {
        display: flex;
        flex-direction: column;
        height: 100%;
      }

      :host(:not([fixed])) .header:hover {
        --bim-label--c: var(--bim-ui_accent-base);
        color: var(--bim-ui_accent-base);
        cursor: pointer;
      }

      :host(:not([fixed])) .header:hover .expand-icon {
        fill: var(--bim-ui_accent-base);
      }

      .header {
        --bim-label--fz: var(--bim-ui_size-sm);
        --bim-label--c: var(
          --bim-panel-section_hc,
          var(--bim-ui_bg-contrast-80)
        );
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-weight: 600;
        height: 1.5rem;
        padding: 0.75rem 1rem;
      }

      .expand-icon {
        fill: var(--bim-ui_bg-contrast-80);
        transition: transform 0.2s;
      }

      :host([collapsed]) .expand-icon {
        transform: rotateZ(-180deg);
      }

      .title {
        display: flex;
        align-items: center;
        column-gap: 0.5rem;
      }

      .title p {
        font-size: var(--bim-ui_size-sm);
      }

      .components {
        display: flex;
        flex-direction: column;
        overflow: hidden;
        row-gap: 0.75rem;
        padding: 0 1rem 1rem;
        box-sizing: border-box;
        transition:
          height 0.25s cubic-bezier(0.65, 0.05, 0.36, 1),
          padding 0.25s cubic-bezier(0.65, 0.05, 0.36, 1);
      }

      .components > div {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        flex: 1;
        overflow: auto;
      }

      :host(:not([icon]):not([label])) .components {
        padding: 1rem;
      }

      :host(:not([fixed])[collapsed]) .components {
        padding: 0 1rem 0;
        height: 0px;
      }

      bim-label {
        pointer-events: none;
      }

      ::slotted(*) {
        transition:
          transform 0.25s cubic-bezier(0.65, 0.05, 0.36, 1),
          opacity 0.25s cubic-bezier(0.65, 0.05, 0.36, 1);
      }

      :host(:not([fixed])[collapsed]) ::slotted(*) {
        transform: translateX(-20%);
        opacity: 0;
      }

      @keyframes expandAnim {
        0%,
        100% {
          transform: translateY(0%);
        }
        25% {
          transform: translateY(-30%);
        }
        50% {
          transform: translateY(10%);
        }
        75% {
          transform: translateY(-30%);
        }
      }

      @keyframes collapseAnim {
        0%,
        100% {
          transform: translateY(0%) rotateZ(-180deg);
        }
        25% {
          transform: translateY(30%) rotateZ(-180deg);
        }
        50% {
          transform: translateY(-10%) rotateZ(-180deg);
        }
        75% {
          transform: translateY(30%) rotateZ(-180deg);
        }
      }
    `];let Tn=bp;Ho([x({type:String,reflect:!0})],Tn.prototype,"icon");Ho([x({type:String,reflect:!0})],Tn.prototype,"label");Ho([x({type:String,reflect:!0})],Tn.prototype,"name");Ho([x({type:Boolean,reflect:!0})],Tn.prototype,"fixed");Ho([x({type:Boolean,reflect:!0})],Tn.prototype,"collapsed");var kw=Object.defineProperty,Vo=(t,e,i,o)=>{for(var n=void 0,s=t.length-1,r;s>=0;s--)(r=t[s])&&(n=r(e,i,n)||n);return n&&kw(e,i,n),n};const gp=class extends K{constructor(){super(...arguments),this.vertical=!1,this.onValueChange=new Event("change"),this._canEmitEvents=!1,this._value=document.createElement("bim-option"),this.onOptionClick=t=>{this._value=t.target,this.setAnimatedBackgound(),this.dispatchEvent(this.onValueChange);for(const e of this.children)e instanceof he&&(e.checked=e===t.target)}}get _options(){return[...this.querySelectorAll("bim-option")]}set value(t){const e=this.findOption(t);if(e){for(const i of this._options)i.checked=i===e;this._value=e,this.setAnimatedBackgound(),this._canEmitEvents&&this.dispatchEvent(this.onValueChange)}}get value(){return this._value.value}onSlotChange(t){const e=t.target.assignedElements();for(const i of e)i instanceof he&&(i.noMark=!0,i.removeEventListener("click",this.onOptionClick),i.addEventListener("click",this.onOptionClick))}findOption(t){return this._options.find(e=>e instanceof he?e.label===t||e.value===t:!1)}doubleRequestAnimationFrames(t){requestAnimationFrame(()=>requestAnimationFrame(t))}setAnimatedBackgound(t=!1){const e=this.renderRoot.querySelector(".animated-background"),i=this._value;requestAnimationFrame(()=>{var o,n,s,r;const a=(r=(s=(n=(o=i?.parentElement)==null?void 0:o.shadowRoot)==null?void 0:n.querySelector("bim-input"))==null?void 0:s.shadowRoot)==null?void 0:r.querySelector(".input"),l={width:i?.clientWidth,height:i?.clientHeight,top:(i?.offsetTop??0)-(a?.offsetTop??0),left:(i?.offsetLeft??0)-(a?.offsetLeft??0)};e?.style.setProperty("width",`${l.width}px`),e?.style.setProperty("height",`${l.height}px`),e?.style.setProperty("top",`${l.top}px`),e?.style.setProperty("left",`${l.left}px`)}),t&&this.doubleRequestAnimationFrames(()=>{const o="ease";e?.style.setProperty("transition",`width ${.3}s ${o}, height ${.3}s ${o}, top ${.3}s ${o}, left ${.3}s ${o}`)})}firstUpdated(){const t=[...this.children].find(e=>e instanceof he&&e.checked);t&&(this._value=t),window.addEventListener("load",()=>{this.setAnimatedBackgound(!0)}),new ResizeObserver(()=>{this.setAnimatedBackgound()}).observe(this)}render(){return w`
      <bim-input
        .vertical=${this.vertical}
        .label=${this.label}
        .icon=${this.icon}
      >
        <div class="animated-background"></div>
        <slot @slotchange=${this.onSlotChange}></slot>
      </bim-input>
    `}};gp.styles=ie`
    :host {
      --bim-input--bgc: var(--bim-ui_bg-contrast-20);
      --bim-input--g: 0;
      --bim-option--jc: center;
      flex: 1;
      display: block;
    }

    ::slotted(bim-option) {
      position: relative;
      border-radius: 0;
      overflow: hidden;
      min-width: min-content;
      min-height: min-content;
      transition: background-color 0.2s;
    }

    .animated-background {
      position: absolute;
      background: var(--bim-ui_main-base);
      width: 0;
      height: 0;
      top: 0;
      left: 0;
    }

    ::slotted(bim-option[checked]) {
      --bim-label--c: var(--bim-ui_main-contrast);
    }

    ::slotted(bim-option:not([checked]):hover) {
      background-color: #0003;
    }
  `;let On=gp;Vo([x({type:String,reflect:!0})],On.prototype,"name");Vo([x({type:String,reflect:!0})],On.prototype,"icon");Vo([x({type:String,reflect:!0})],On.prototype,"label");Vo([x({type:Boolean,reflect:!0})],On.prototype,"vertical");Vo([Li()],On.prototype,"_value");const Tw=()=>w`
    <style>
      div {
        display: flex;
        gap: 0.375rem;
        border-radius: 0.25rem;
        min-height: 1.25rem;
      }

      [data-type="row"] {
        background-color: var(--bim-ui_bg-contrast-10);
        animation: row-loading 1s linear infinite alternate;
        padding: 0.5rem;
      }

      [data-type="cell"] {
        background-color: var(--bim-ui_bg-contrast-20);
        flex: 0.25;
      }

      @keyframes row-loading {
        0% {
          background-color: var(--bim-ui_bg-contrast-10);
        }
        100% {
          background-color: var(--bim-ui_bg-contrast-20);
        }
      }
    </style>
    <div style="display: flex; flex-direction: column;">
      <div data-type="row" style="gap: 2rem">
        <div data-type="cell" style="flex: 1"></div>
        <div data-type="cell" style="flex: 2"></div>
        <div data-type="cell" style="flex: 1"></div>
        <div data-type="cell" style="flex: 0.5"></div>
      </div>
      <div style="display: flex;">
        <div data-type="row" style="flex: 1">
          <div data-type="cell" style="flex: 0.5"></div>
        </div>
        <div data-type="row" style="flex: 2">
          <div data-type="cell" style="flex: 0.75"></div>
        </div>
        <div data-type="row" style="flex: 1">
          <div data-type="cell"></div>
        </div>
        <div data-type="row" style="flex: 0.5">
          <div data-type="cell" style="flex: 0.75"></div>
        </div>
      </div>
      <div style="display: flex;">
        <div data-type="row" style="flex: 1">
          <div data-type="cell" style="flex: 0.75"></div>
        </div>
        <div data-type="row" style="flex: 2">
          <div data-type="cell"></div>
        </div>
        <div data-type="row" style="flex: 1">
          <div data-type="cell" style="flex: 0.5"></div>
        </div>
        <div data-type="row" style="flex: 0.5">
          <div data-type="cell" style="flex: 0.5"></div>
        </div>
      </div>
      <div style="display: flex;">
        <div data-type="row" style="flex: 1">
          <div data-type="cell"></div>
        </div>
        <div data-type="row" style="flex: 2">
          <div data-type="cell" style="flex: 0.5"></div>
        </div>
        <div data-type="row" style="flex: 1">
          <div data-type="cell" style="flex: 0.75"></div>
        </div>
        <div data-type="row" style="flex: 0.5">
          <div data-type="cell" style="flex: 0.7s5"></div>
        </div>
      </div>
    </div>
  `,Ow=()=>w`
    <style>
      .loader {
        grid-area: Processing;
        position: relative;
        padding: 0.125rem;
      }
      .loader:before {
        content: "";
        position: absolute;
      }
      .loader .loaderBar {
        position: absolute;
        top: 0;
        right: 100%;
        bottom: 0;
        left: 0;
        background: var(--bim-ui_main-base);
        /* width: 25%; */
        width: 0;
        animation: borealisBar 2s linear infinite;
      }

      @keyframes borealisBar {
        0% {
          left: 0%;
          right: 100%;
          width: 0%;
        }
        10% {
          left: 0%;
          right: 75%;
          width: 25%;
        }
        90% {
          right: 0%;
          left: 75%;
          width: 25%;
        }
        100% {
          left: 100%;
          right: 0%;
          width: 0%;
        }
      }
    </style>
    <div class="loader">
      <div class="loaderBar"></div>
    </div>
  `;var Iw=Object.defineProperty,Pw=(t,e,i,o)=>{for(var n=void 0,s=t.length-1,r;s>=0;s--)(r=t[s])&&(n=r(e,i,n)||n);return n&&Iw(e,i,n),n};const yp=class extends K{constructor(){super(...arguments),this.column="",this.columnIndex=0,this.table=null,this.group=null,this.row=null,this.rowData={}}get data(){return this.column?this.rowData[this.column]:null}get dataTransform(){var t,e,i,o;const n=(e=(t=this.row)==null?void 0:t.dataTransform)==null?void 0:e[this.column],s=(i=this.table)==null?void 0:i.dataTransform[this.column],r=(o=this.table)==null?void 0:o.defaultContentTemplate;return n||s||r}get templateValue(){const{data:t,rowData:e,group:i}=this,o=this.dataTransform;if(o&&t!=null&&i){const n=o(t,e,i);return typeof n=="string"||typeof n=="boolean"||typeof n=="number"?w`<bim-label>${n}</bim-label>`:n}return t!=null?w`<bim-label>${t}</bim-label>`:se}connectedCallback(){super.connectedCallback(),this.style.gridArea=this.column.toString()}render(){return w`${this.templateValue}`}};yp.styles=ie`
    :host {
      padding: 0.375rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    :host([data-column-index="0"]) {
      justify-content: normal;
    }

    :host([data-column-index="0"]:not([data-cell-header]))
      ::slotted(bim-label) {
      text-align: left;
    }

    ::slotted(*) {
      --bim-input--bgc: transparent;
      --bim-input--olc: var(--bim-ui_bg-contrast-20);
      --bim-input--olw: 1px;
    }

    ::slotted(bim-input) {
      --bim-input--olw: 0;
    }
  `;let vp=yp;Pw([x({type:String,reflect:!0})],vp.prototype,"column");const wp=class extends K{constructor(){super(...arguments),this._groups=[],this.group=this.closest("bim-table-group"),this._data=[],this.table=this.closest("bim-table")}get data(){var t;return((t=this.group)==null?void 0:t.data.children)??this._data}set data(t){this._data=t}clean(){for(const t of this._groups)t.remove();this._groups=[]}render(){return this.clean(),w`
      <slot></slot>
      ${this.data.map(t=>{const e=document.createElement("bim-table-group");return this._groups.push(e),e.table=this.table,e.data=t,e})}
    `}};wp.styles=ie`
    :host {
      --bim-button--bgc: transparent;
      position: relative;
      display: block;
      overflow: hidden;
      grid-area: Children;
    }

    :host([hidden]) {
      height: 0;
      opacity: 0;
    }

    ::slotted(.branch.branch-vertical) {
      top: 0;
      bottom: 1.125rem;
    }
  `;let Lw=wp;/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const $p="important",Mw=" !"+$p,Ot=Lh(class extends Mh{constructor(t){var e;if(super(t),t.type!==Ph.ATTRIBUTE||t.name!=="style"||((e=t.strings)==null?void 0:e.length)>2)throw Error("The `styleMap` directive must be used in the `style` attribute and must be the only part in the attribute.")}render(t){return Object.keys(t).reduce((e,i)=>{const o=t[i];return o==null?e:e+`${i=i.includes("-")?i:i.replace(/(?:^(webkit|moz|ms|o)|)(?=[A-Z])/g,"-$&").toLowerCase()}:${o};`},"")}update(t,[e]){const{style:i}=t.element;if(this.ft===void 0)return this.ft=new Set(Object.keys(e)),this.render(e);for(const o of this.ft)e[o]==null&&(this.ft.delete(o),o.includes("-")?i.removeProperty(o):i[o]=null);for(const o in e){const n=e[o];if(n!=null){this.ft.add(o);const s=typeof n=="string"&&n.endsWith(Mw);o.includes("-")||s?i.setProperty(o,s?n.slice(0,-11):n,s?$p:""):i[o]=n}}return Ai}});var zw=Object.defineProperty,Dw=(t,e,i,o)=>{for(var n=void 0,s=t.length-1,r;s>=0;s--)(r=t[s])&&(n=r(e,i,n)||n);return n&&zw(e,i,n),n};const _p=class extends K{constructor(){super(...arguments),this.childrenHidden=!0,this.table=null,this.data={data:{}}}get rowElement(){const t=this.shadowRoot;return t?t.querySelector("bim-table-row"):null}get childrenElement(){const t=this.shadowRoot;return t?t.querySelector("bim-table-children"):null}get _isChildrenEmpty(){return!(this.data.children&&this.data.children.length!==0)}connectedCallback(){super.connectedCallback(),this.table&&this.table.expanded?this.childrenHidden=!1:this.childrenHidden=!0}disconnectedCallback(){super.disconnectedCallback(),this.data={data:{}}}toggleChildren(t){this.childrenHidden=typeof t>"u"?!this.childrenHidden:!t,this.animateTableChildren(!0)}animateTableChildren(t=!0){if(!t){requestAnimationFrame(()=>{var s;const r=this.renderRoot.querySelector(".caret"),a=this.renderRoot.querySelector(".branch-vertical"),l=(s=this.renderRoot.querySelector("bim-table-children"))==null?void 0:s.querySelector(".branch-vertical");r.style.setProperty("transform",`translateY(-50%) rotate(${this.childrenHidden?"0":"90"}deg)`),a.style.setProperty("transform",`scaleY(${this.childrenHidden?"0":"1"})`),l?.style.setProperty("transform",`scaleY(${this.childrenHidden?"0":"1"})`)});return}const e=500,i=0,o=200,n=350;requestAnimationFrame(()=>{var s;const r=this.renderRoot.querySelector("bim-table-children"),a=this.renderRoot.querySelector(".caret"),l=this.renderRoot.querySelector(".branch-vertical"),c=(s=this.renderRoot.querySelector("bim-table-children"))==null?void 0:s.querySelector(".branch-vertical"),d=()=>{var g;const f=(g=r?.renderRoot)==null?void 0:g.querySelectorAll("bim-table-group");f?.forEach((v,y)=>{v.style.setProperty("opacity","0"),v.style.setProperty("left","-30px");const b=[{opacity:"0",left:"-30px"},{opacity:"1",left:"0"}];v.animate(b,{duration:e/2,delay:50+y*i,easing:"cubic-bezier(0.65, 0.05, 0.36, 1)",fill:"forwards"})})},u=()=>{const g=[{transform:"translateY(-50%) rotate(90deg)"},{transform:"translateY(-50%) rotate(0deg)"}];a?.animate(g,{duration:n,easing:"cubic-bezier(0.68, -0.55, 0.27, 1.55)",fill:"forwards",direction:this.childrenHidden?"normal":"reverse"})},h=()=>{const g=[{transform:"scaleY(1)"},{transform:"scaleY(0)"}];l?.animate(g,{duration:o,easing:"cubic-bezier(0.4, 0, 0.2, 1)",delay:i,fill:"forwards",direction:this.childrenHidden?"normal":"reverse"})},p=()=>{var g;const f=(g=this.renderRoot.querySelector("bim-table-row"))==null?void 0:g.querySelector(".branch-horizontal");if(f){f.style.setProperty("transform-origin","center right");const v=[{transform:"scaleX(0)"},{transform:"scaleX(1)"}];f.animate(v,{duration:o,easing:"cubic-bezier(0.4, 0, 0.2, 1)",fill:"forwards",direction:this.childrenHidden?"normal":"reverse"})}},m=()=>{const g=[{transform:"scaleY(0)"},{transform:"scaleY(1)"}];c?.animate(g,{duration:o*1.2,easing:"cubic-bezier(0.4, 0, 0.2, 1)",fill:"forwards",delay:(i+o)*.7})};d(),u(),h(),p(),m()})}firstUpdated(){this.renderRoot.querySelectorAll(".caret").forEach(t=>{var e,i,o;if(!this.childrenHidden){t.style.setProperty("transform","translateY(-50%) rotate(90deg)");const n=(e=t.parentElement)==null?void 0:e.querySelector(".branch-horizontal");n&&n.style.setProperty("transform","scaleX(0)");const s=(o=(i=t.parentElement)==null?void 0:i.parentElement)==null?void 0:o.querySelectorAll(".branch-vertical");s?.forEach(r=>{r.style.setProperty("transform","scaleY(1)")})}})}render(){if(!this.table)return w`${se}`;const t=this.table.getGroupIndentation(this.data)??0;let e;if(!this.table.noIndentation){const s={left:`${t-1+(this.table.selectableRows?2.05:.5625)}rem`};e=w`<div style=${Ot(s)} class="branch branch-horizontal"></div>`}const i=w`
      ${this.table.noIndentation?null:w`
            <style>
              .branch-vertical {
                left: ${t+(this.table.selectableRows?1.9375:.5625)}rem;
              }
            </style>
            <div class="branch branch-vertical"></div>
          `}
    `;let o;if(!this.table.noIndentation){const s=document.createElementNS("http://www.w3.org/2000/svg","svg");if(s.setAttribute("height","9.9"),s.setAttribute("width","7.5"),s.setAttribute("viewBox","0 0 4.6666672 7.7"),this.table.noCarets){const a=document.createElementNS("http://www.w3.org/2000/svg","circle");a.setAttribute("cx","2.3333336"),a.setAttribute("cy","3.85"),a.setAttribute("r","2.5"),s.append(a)}else{const a=document.createElementNS("http://www.w3.org/2000/svg","path");a.setAttribute("d","m 1.7470835,6.9583848 2.5899999,-2.59 c 0.39,-0.39 0.39,-1.02 0,-1.41 L 1.7470835,0.36838483 c -0.63,-0.62000003 -1.71000005,-0.18 -1.71000005,0.70999997 v 5.17 c 0,0.9 1.08000005,1.34 1.71000005,0.71 z"),s.append(a)}const r={left:`${(this.table.selectableRows?1.5:.125)+t}rem`,cursor:`${this.table.noCarets?"unset":"pointer"}`};o=w`<div @click=${a=>{var l;(l=this.table)!=null&&l.noCarets||(a.stopPropagation(),this.toggleChildren())}} style=${Ot(r)} class="caret">${s}</div>`}let n;return!this._isChildrenEmpty&&!this.childrenHidden&&(n=w`
        <bim-table-children ${me(s=>{if(!s)return;const r=s;r.table=this.table,r.group=this})}>${i}</bim-table-children>
      `),w`
      <div class="parent">
        <bim-table-row ${me(s=>{var r;if(!s)return;const a=s;a.table=this.table,a.group=this,(r=this.table)==null||r.dispatchEvent(new CustomEvent("rowcreated",{detail:{row:a}}))})}>
          ${Zi(!this._isChildrenEmpty,()=>i)}
          ${Zi(t!==0,()=>e)}
          ${Zi(!this.table.noIndentation&&!this._isChildrenEmpty,()=>o)}
        </bim-table-row>
        ${n}
      </div>
    `}};_p.styles=ie`
    :host {
      position: relative;
    }

    .parent {
      display: grid;
      grid-template-areas: "Data" "Children";
    }

    .branch {
      position: absolute;
      z-index: 1;
    }

    .branch-vertical {
      border-left: 1px dotted var(--bim-ui_bg-contrast-40);
      transform-origin: top center;
      transform: scaleY(0);
    }

    .branch-horizontal {
      top: 50%;
      width: 1rem;
      border-bottom: 1px dotted var(--bim-ui_bg-contrast-40);
    }

    .branch-horizontal {
      transform-origin: center left;
    }

    .caret {
      position: absolute;
      z-index: 2;
      transform: translateY(-50%) rotate(0deg);
      top: 50%;
      display: flex;
      width: 0.95rem;
      height: 0.95rem;
      justify-content: center;
      align-items: center;
    }

    .caret svg {
      fill: var(--bim-ui_bg-contrast-60);
    }
  `;let xp=_p;Dw([x({type:Boolean,attribute:"children-hidden",reflect:!0})],xp.prototype,"childrenHidden");var Rw=Object.defineProperty,In=(t,e,i,o)=>{for(var n=void 0,s=t.length-1,r;s>=0;s--)(r=t[s])&&(n=r(e,i,n)||n);return n&&Rw(e,i,n),n};const Ep=class extends K{constructor(){super(...arguments),this.selected=!1,this.columns=[],this.hiddenColumns=[],this.group=null,this._data={},this.isHeader=!1,this.table=null,this.onTableColumnsChange=()=>{this.table&&(this.columns=this.table.columns)},this.onTableColumnsHidden=()=>{this.table&&(this.hiddenColumns=this.table.hiddenColumns)},this._intersecting=!1,this._timeOutDelay=250,this._observer=new IntersectionObserver(t=>{window.clearTimeout(this._intersectTimeout),this._intersectTimeout=void 0,t[0].isIntersecting?this._intersectTimeout=window.setTimeout(()=>{this._intersecting=!0},this._timeOutDelay):this._intersecting=!1},{rootMargin:"36px"}),this.dataTransform=null,this._interval=null,this.clearDataTransform=()=>{this.dataTransform=null,this._interval!==null&&(clearInterval(this._interval),this._interval=null)},this._cache={}}get groupData(){var t;return(t=this.group)==null?void 0:t.data}get data(){var t;return((t=this.group)==null?void 0:t.data.data)??this._data}set data(t){this._data=t}get _columnNames(){return this.columns.filter(t=>!this.hiddenColumns.includes(t.name)).map(t=>t.name)}get _columnWidths(){return this.columns.filter(t=>!this.hiddenColumns.includes(t.name)).map(t=>t.width)}get _isSelected(){var t;return(t=this.table)==null?void 0:t.selection.has(this.data)}onSelectionChange(t){if(!this.table)return;const e=t.target;this.selected=e.value,e.value?(this.table.selection.add(this.data),this.table.dispatchEvent(new CustomEvent("rowselected",{detail:{data:this.data}}))):(this.table.selection.delete(this.data),this.table.dispatchEvent(new CustomEvent("rowdeselected",{detail:{data:this.data}})))}firstUpdated(t){super.firstUpdated(t),this._observer.observe(this)}connectedCallback(){super.connectedCallback(),this.toggleAttribute("selected",this._isSelected),this.table&&(this.columns=this.table.columns,this.hiddenColumns=this.table.hiddenColumns,this.table.addEventListener("columnschange",this.onTableColumnsChange),this.table.addEventListener("columnshidden",this.onTableColumnsHidden),this.style.gridTemplateAreas=`"${this.table.selectableRows?"Selection":""} ${this._columnNames.join(" ")}"`,this.style.gridTemplateColumns=`${this.table.selectableRows?"1.6rem":""} ${this._columnWidths.join(" ")}`)}disconnectedCallback(){super.disconnectedCallback(),this._observer.unobserve(this),this.columns=[],this.hiddenColumns=[],this.toggleAttribute("selected",!1),this.data={},this.table&&(this.table.removeEventListener("columnschange",this.onTableColumnsChange),this.table.removeEventListener("columnshidden",this.onTableColumnsHidden),this.table=null),this.clean()}applyAdaptativeDataTransform(t){this.addEventListener("pointerenter",()=>{this.dataTransform=t,this._interval=window.setInterval(()=>{this.matches(":hover")||this.clearDataTransform()},50)})}clean(){clearTimeout(this._intersectTimeout),this._intersectTimeout=void 0,this._timeOutDelay=250;for(const[,t]of Object.entries(this._cache))t.remove();this._cache={}}render(){if(!(this.table&&this._intersecting))return w`${se}`;const t=this.table.getRowIndentation(this.data)??0,e=[];for(const i in this.data){if(this.hiddenColumns.includes(i))continue;const o=document.createElement("bim-table-cell");o.group=this.group,o.table=this.table,o.row=this,o.column=i,this._columnNames.indexOf(i)===0&&(o.style.marginLeft=`${this.table.noIndentation?0:t+.75}rem`);const n=this._columnNames.indexOf(i);o.setAttribute("data-column-index",String(n)),o.toggleAttribute("data-no-indentation",n===0&&this.table.noIndentation),o.toggleAttribute("data-cell-header",this.isHeader),o.rowData=this.data,this.table.dispatchEvent(new CustomEvent("cellcreated",{detail:{cell:o}})),e.push(o)}return this._timeOutDelay=0,w`
      ${!this.isHeader&&this.table.selectableRows?w`<bim-checkbox
            @change=${this.onSelectionChange}
            .checked=${this._isSelected??!1}
            style="align-self: center; justify-self: center"
          ></bim-checkbox>`:null}
      ${e}
      <slot></slot>
    `}};Ep.styles=ie`
    :host {
      position: relative;
      grid-area: Data;
      display: grid;
      min-height: 2.25rem;
      transition: all 0.15s;
    }

    ::slotted(.branch.branch-vertical) {
      top: 50%;
      bottom: 0;
    }

    :host([selected]) {
      background-color: color-mix(
        in lab,
        var(--bim-ui_bg-contrast-20) 30%,
        var(--bim-ui_accent-base) 10%
      );
    }
  `;let Di=Ep;In([x({type:Boolean,reflect:!0})],Di.prototype,"selected");In([x({attribute:!1})],Di.prototype,"columns");In([x({attribute:!1})],Di.prototype,"hiddenColumns");In([x({type:Boolean,attribute:"is-header",reflect:!0})],Di.prototype,"isHeader");In([Li()],Di.prototype,"_intersecting");In([Li()],Di.prototype,"dataTransform");var jw=Object.defineProperty,Nw=Object.getOwnPropertyDescriptor,et=(t,e,i,o)=>{for(var n=o>1?void 0:o?Nw(e,i):e,s=t.length-1,r;s>=0;s--)(r=t[s])&&(n=(o?r(e,i,n):r(n))||n);return o&&n&&jw(e,i,n),n};const Sp=class extends K{constructor(){super(...arguments),this._filteredData=[],this.headersHidden=!1,this.minColWidth="4rem",this._columns=[],this._textDelimiters={comma:",",tab:"	"},this._queryString=null,this._data=[],this.expanded=!1,this.preserveStructureOnFilter=!1,this.indentationInText=!1,this.dataTransform={},this.selectableRows=!1,this.selection=new Set,this.noIndentation=!1,this.noCarets=!1,this.loading=!1,this._errorLoading=!1,this._onColumnsHidden=new Event("columnshidden"),this._hiddenColumns=[],this.defaultContentTemplate=t=>w`<bim-label style="white-space: normal;">${t}</bim-label>`,this._stringFilterFunction=(t,e)=>Object.values(e.data).some(i=>String(i).toLowerCase().includes(t.toLowerCase())),this._queryFilterFunction=(t,e)=>{let i=!1;const o=ma(t)??[];for(const n of o){if("queries"in n){i=!1;break}const{condition:s,value:r}=n;let{key:a}=n;if(a.startsWith("[")&&a.endsWith("]")){const l=a.replace("[","").replace("]","");a=l,i=Object.keys(e.data).filter(c=>c.includes(l)).map(c=>$d(e.data[c],s,r)).some(c=>c)}else i=$d(e.data[a],s,r);if(!i)break}return i}}set columns(t){const e=[];for(const i of t){const o=typeof i=="string"?{name:i,width:`minmax(${this.minColWidth}, 1fr)`}:i;e.push(o)}this._columns=e,this.computeMissingColumns(this.data),this.dispatchEvent(new Event("columnschange"))}get columns(){return this._columns}get _headerRowData(){const t={};for(const e of this.columns){const{name:i}=e;t[i]=String(i)}return t}get value(){return this._filteredData}set queryString(t){this.toggleAttribute("data-processing",!0),this._queryString=t&&t.trim()!==""?t.trim():null,this.updateFilteredData(),this.toggleAttribute("data-processing",!1)}get queryString(){return this._queryString}set data(t){this._data=t,this.updateFilteredData(),this.computeMissingColumns(t)&&(this.columns=this._columns)}get data(){return this._data}get dataAsync(){return new Promise(t=>{setTimeout(()=>{t(this.data)})})}set hiddenColumns(t){this._hiddenColumns=t,setTimeout(()=>{this.dispatchEvent(this._onColumnsHidden)})}get hiddenColumns(){return this._hiddenColumns}updateFilteredData(){this.queryString?(ma(this.queryString)?(this.filterFunction=this._queryFilterFunction,this._filteredData=this.filter(this.queryString)):(this.filterFunction=this._stringFilterFunction,this._filteredData=this.filter(this.queryString)),this.preserveStructureOnFilter&&(this._expandedBeforeFilter===void 0&&(this._expandedBeforeFilter=this.expanded),this.expanded=!0)):(this.preserveStructureOnFilter&&this._expandedBeforeFilter!==void 0&&(this.expanded=this._expandedBeforeFilter,this._expandedBeforeFilter=void 0),this._filteredData=this.data)}computeMissingColumns(t){let e=!1;for(const i of t){const{children:o,data:n}=i;for(const s in n)this._columns.map(r=>typeof r=="string"?r:r.name).includes(s)||(this._columns.push({name:s,width:`minmax(${this.minColWidth}, 1fr)`}),e=!0);if(o){const s=this.computeMissingColumns(o);s&&!e&&(e=s)}}return e}generateText(t="comma",e=this.value,i="",o=!0){const n=this._textDelimiters[t];let s="";const r=this.columns.map(a=>a.name);if(o){this.indentationInText&&(s+=`Indentation${n}`);const a=`${r.join(n)}
`;s+=a}for(const[a,l]of e.entries()){const{data:c,children:d}=l,u=this.indentationInText?`${i}${a+1}${n}`:"",h=r.map(m=>c[m]??""),p=`${u}${h.join(n)}
`;s+=p,d&&(s+=this.generateText(t,l.children,`${i}${a+1}.`,!1))}return s}get csv(){return this.generateText("comma")}get tsv(){return this.generateText("tab")}applyDataTransform(t){const e={};if(!t)return e;const{data:i}=t.data;for(const n of Object.keys(this.dataTransform)){const s=this.columns.find(r=>r.name===n);s&&s.forceDataTransform&&(n in i||(i[n]=""))}const o=i;for(const n in o){const s=this.dataTransform[n];s?e[n]=s(o[n],i,t):e[n]=i[n]}return e}downloadData(t="BIM Table Data",e="json"){let i=null;if(e==="json"&&(i=new File([JSON.stringify(this.value,void 0,2)],`${t}.json`)),e==="csv"&&(i=new File([this.csv],`${t}.csv`)),e==="tsv"&&(i=new File([this.tsv],`${t}.tsv`)),!i)return;const o=document.createElement("a");o.href=URL.createObjectURL(i),o.download=i.name,o.click(),URL.revokeObjectURL(o.href)}getRowIndentation(t,e=this.value,i=0){for(const o of e){if(o.data===t)return i;if(o.children){const n=this.getRowIndentation(t,o.children,i+1);if(n!==null)return n}}return null}getGroupIndentation(t,e=this.value,i=0){for(const o of e){if(o===t)return i;if(o.children){const n=this.getGroupIndentation(t,o.children,i+1);if(n!==null)return n}}return null}connectedCallback(){super.connectedCallback(),this.dispatchEvent(new Event("connected"))}disconnectedCallback(){super.disconnectedCallback(),this.dispatchEvent(new Event("disconnected"))}async loadData(t=!1){if(this._filteredData.length!==0&&!t||!this.loadFunction)return!1;this.loading=!0;try{const e=await this.loadFunction();return this.data=e,this.loading=!1,this._errorLoading=!1,!0}catch(e){if(this.loading=!1,this._filteredData.length!==0)return!1;const i=this.querySelector("[slot='error-loading']"),o=i?.querySelector("[data-table-element='error-message']");return e instanceof Error&&o&&e.message.trim()!==""&&(o.textContent=e.message),this._errorLoading=!0,!1}}filter(t,e=this.filterFunction??this._stringFilterFunction,i=this.data){const o=[];for(const n of i)if(e(t,n)){if(this.preserveStructureOnFilter){const s={data:n.data};if(n.children){const r=this.filter(t,e,n.children);r.length&&(s.children=r)}o.push(s)}else if(o.push({data:n.data}),n.children){const s=this.filter(t,e,n.children);o.push(...s)}}else if(n.children){const s=this.filter(t,e,n.children);this.preserveStructureOnFilter&&s.length?o.push({data:n.data,children:s}):o.push(...s)}return o}get _missingDataElement(){return this.querySelector("[slot='missing-data']")}render(){if(this.loading)return Tw();if(this._errorLoading)return w`<slot name="error-loading"></slot>`;if(this._filteredData.length===0&&this._missingDataElement)return w`<slot name="missing-data"></slot>`;const t=i=>{if(!i)return;const o=i;o.table=this,o.data=this._headerRowData},e=i=>{if(!i)return;const o=i;o.table=this,o.data=this.value,o.requestUpdate()};return w`
      <div class="parent">
        ${Ow()}
        ${Zi(!this.headersHidden,()=>w`<bim-table-row is-header style="grid-area: Header; position: sticky; top: 0; z-index: 5" ${me(t)}></bim-table-row>`)} 
        <div style="overflow-x: hidden; grid-area: Body">
          <bim-table-children ${me(e)} style="grid-area: Body; background-color: transparent"></bim-table-children>
        </div>
      </div>
    `}};Sp.styles=[ni.scrollbar,ie`
      :host {
        position: relative;
        overflow: auto;
        display: block;
        pointer-events: auto;
      }

      :host(:not([data-processing])) .loader {
        display: none;
      }

      .parent {
        display: grid;
        grid-template:
          "Header" auto
          "Processing" auto
          "Body" 1fr
          "Footer" auto;
        overflow: auto;
        height: 100%;
      }

      .parent > bim-table-row[is-header] {
        color: var(--bim-table_header--c, var(--bim-ui_bg-contrast-100));
        background-color: var(
          --bim-table_header--bgc,
          var(--bim-ui_bg-contrast-20)
        );
      }

      .controls {
        display: flex;
        gap: 0.375rem;
        flex-wrap: wrap;
        margin-bottom: 0.5rem;
      }
    `];let Ve=Sp;et([Li()],Ve.prototype,"_filteredData",2);et([x({type:Boolean,attribute:"headers-hidden",reflect:!0})],Ve.prototype,"headersHidden",2);et([x({type:String,attribute:"min-col-width",reflect:!0})],Ve.prototype,"minColWidth",2);et([x({type:Array,attribute:!1})],Ve.prototype,"columns",1);et([x({type:Array,attribute:!1})],Ve.prototype,"data",1);et([x({type:Boolean,reflect:!0})],Ve.prototype,"expanded",2);et([x({type:Boolean,reflect:!0,attribute:"selectable-rows"})],Ve.prototype,"selectableRows",2);et([x({attribute:!1})],Ve.prototype,"selection",2);et([x({type:Boolean,attribute:"no-indentation",reflect:!0})],Ve.prototype,"noIndentation",2);et([x({type:Boolean,attribute:"no-carets",reflect:!0})],Ve.prototype,"noCarets",2);et([x({type:Boolean,reflect:!0})],Ve.prototype,"loading",2);et([Li()],Ve.prototype,"_errorLoading",2);var Bw=Object.defineProperty,Fw=Object.getOwnPropertyDescriptor,Pn=(t,e,i,o)=>{for(var n=o>1?void 0:o?Fw(e,i):e,s=t.length-1,r;s>=0;s--)(r=t[s])&&(n=(o?r(e,i,n):r(n))||n);return o&&n&&Bw(e,i,n),n};const Cp=class extends K{constructor(){super(...arguments),this._switchers=[],this.bottom=!1,this.switchersHidden=!1,this.floating=!1,this.switchersFull=!1,this.onTabHiddenChange=t=>{const e=t.target;e instanceof Le&&!e.hidden&&(e.removeEventListener("hiddenchange",this.onTabHiddenChange),this.tab=e.name,e.addEventListener("hiddenchange",this.onTabHiddenChange))}}set tab(t){this._tab=t;const e=[...this.children],i=e.find(o=>o instanceof Le&&o.name===t);for(const o of e){if(!(o instanceof Le))continue;o.hidden=i!==o;const n=this.getTabSwitcher(o.name);n&&n.toggleAttribute("data-active",!o.hidden)}i||(this._tab="hidden",this.setAttribute("tab","hidden"))}get tab(){return this._tab}getTabSwitcher(t){return this._switchers.find(e=>e.getAttribute("data-name")===t)}createSwitchers(){this._switchers=[];for(const t of this.children){if(!(t instanceof Le))continue;const e=document.createElement("div");e.addEventListener("click",()=>{this.tab===t.name?this.toggleAttribute("tab",!1):this.tab=t.name,this.setAnimatedBackgound()}),e.setAttribute("data-name",t.name),e.className="switcher";const i=document.createElement("bim-label");i.textContent=t.label??null,i.icon=t.icon,e.append(i),this._switchers.push(e)}}updateSwitchers(){for(const t of this.children){if(!(t instanceof Le))continue;const e=this._switchers.find(o=>o.getAttribute("data-name")===t.name);if(!e)continue;const i=e.querySelector("bim-label");i&&(i.textContent=t.label??null,i.icon=t.icon)}}onSlotChange(t){this.createSwitchers();const e=t.target.assignedElements(),i=e.find(o=>o instanceof Le?this.tab?o.name===this.tab:!o.hidden:!1);i&&i instanceof Le&&(this.tab=i.name);for(const o of e){if(!(o instanceof Le)){o.remove();continue}o.removeEventListener("hiddenchange",this.onTabHiddenChange),i!==o&&(o.hidden=!0),o.addEventListener("hiddenchange",this.onTabHiddenChange)}}doubleRequestAnimationFrames(t){requestAnimationFrame(()=>requestAnimationFrame(t))}setAnimatedBackgound(t=!1){var e;const i=this.renderRoot.querySelector(".animated-background"),o=[...((e=this.renderRoot.querySelector(".switchers"))==null?void 0:e.querySelectorAll(".switcher"))||[]].filter(n=>n.hasAttribute("data-active"))[0];requestAnimationFrame(()=>{var n,s,r,a;const l=(a=(r=(s=(n=o?.parentElement)==null?void 0:n.shadowRoot)==null?void 0:s.querySelector("bim-input"))==null?void 0:r.shadowRoot)==null?void 0:a.querySelector(".input"),c={width:o?.clientWidth,height:o?.clientHeight,top:(o?.offsetTop??0)-(l?.offsetTop??0),left:(o?.offsetLeft??0)-(l?.offsetLeft??0)};o?(i?.style.setProperty("width",`${c.width}px`),i?.style.setProperty("height",`${c.height}px`),i?.style.setProperty("left",`${c.left}px`)):i?.style.setProperty("width","0"),this.bottom?(i?.style.setProperty("top","100%"),i?.style.setProperty("transform","translateY(-100%)")):i?.style.setProperty("top",`${c.top}px`)}),t&&this.doubleRequestAnimationFrames(()=>{const n="ease";i?.style.setProperty("transition",`width ${.3}s ${n}, height ${.3}s ${n}, top ${.3}s ${n}, left ${.3}s ${n}`)})}firstUpdated(){requestAnimationFrame(()=>{this.setAnimatedBackgound(!0)}),new ResizeObserver(()=>{this.setAnimatedBackgound()}).observe(this)}render(){return w`
      <div class="parent">
        <div class="switchers">
          <div class="animated-background"></div>
          ${this._switchers}
        </div>
        <div class="content">
          <slot @slotchange=${this.onSlotChange}></slot>
        </div>
      </div>
    `}};Cp.styles=[ni.scrollbar,ie`
      * {
        box-sizing: border-box;
      }

      :host {
        background-color: var(--bim-ui_bg-base);
        display: block;
        overflow: auto;
      }

      .parent {
        display: grid;
        overflow: hidden;
        position: relative;
        grid-template: "switchers" auto "content" 1fr;
        height: 100%;
      }

      :host([bottom]) .parent {
        grid-template: "content" 1fr "switchers" auto;
      }

      .switchers {
        position: relative;
        display: flex;
        height: 2.25rem;
        font-weight: 600;
        grid-area: switchers;
      }

      .switcher {
        --bim-label--c: var(--bim-ui_bg-contrast-80);
        background-color: transparent;
        position: relative;
        cursor: pointer;
        pointer-events: auto;
        padding: 0rem 0.75rem;
        display: flex;
        justify-content: center;
        z-index: 2;
        transition: all 0.15s;
      }

      .switcher:not([data-active]):hover {
        filter: brightness(150%);
      }

      :host([switchers-full]) .switcher {
        flex: 1;
      }

      .switcher[data-active] {
        --bim-label--c: var(--bim-ui_main-contrast);
      }

      .switchers bim-label {
        pointer-events: none;
      }

      :host([switchers-hidden]) .switchers {
        display: none;
      }

      .content {
        position: relative;
        display: grid;
        grid-template-columns: 1fr;
        grid-area: content;
        max-height: 100vh;
        overflow: auto;
        transition: max-height 0.2s;
      }

      :host([tab="hidden"]) .content {
        max-height: 0;
      }

      .animated-background {
        position: absolute;
        background: var(--bim-ui_main-base);
        width: 0;
        height: 0;
        top: 0;
        left: 0;
      }

      :host(:not([bottom])) .content {
        border-top: 1px solid var(--bim-ui_bg-contrast-20);
      }

      :host([bottom]) .content {
        border-bottom: 1px solid var(--bim-ui_bg-contrast-20);
      }

      :host([floating]) {
        background-color: transparent;
      }

      :host([floating]) .switchers {
        justify-self: center;
        overflow: hidden;
        background-color: var(--bim-ui_bg-base);
      }

      :host([floating]:not([bottom])) .switchers {
        border-radius: var(--bim-ui_size-2xs) var(--bim-ui_size-2xs) 0 0;
        border-top: 1px solid var(--bim-ui_bg-contrast-20);
        border-left: 1px solid var(--bim-ui_bg-contrast-20);
        border-right: 1px solid var(--bim-ui_bg-contrast-20);
      }

      :host([floating][bottom]) .switchers {
        border-radius: 0 0 var(--bim-ui_size-2xs) var(--bim-ui_size-2xs);
        border-bottom: 1px solid var(--bim-ui_bg-contrast-20);
        border-left: 1px solid var(--bim-ui_bg-contrast-20);
        border-right: 1px solid var(--bim-ui_bg-contrast-20);
      }

      :host([floating][tab="hidden"]) .switchers {
        border-radius: var(--bim-ui_size-2xs);
        border-bottom: 1px solid var(--bim-ui_bg-contrast-20);
      }

      :host([floating][bottom][tab="hidden"]) .switchers {
        border-top: 1px solid var(--bim-ui_bg-contrast-20);
      }

      :host([floating]) .content {
        border: 1px solid var(--bim-ui_bg-contrast-20);
        border-radius: var(--bim-ui_size-2xs);
        background-color: var(--bim-ui_bg-base);
      }
    `];let Mt=Cp;Pn([Li()],Mt.prototype,"_switchers",2);Pn([x({type:Boolean,reflect:!0})],Mt.prototype,"bottom",2);Pn([x({type:Boolean,attribute:"switchers-hidden",reflect:!0})],Mt.prototype,"switchersHidden",2);Pn([x({type:Boolean,reflect:!0})],Mt.prototype,"floating",2);Pn([x({type:String,reflect:!0})],Mt.prototype,"tab",1);Pn([x({type:Boolean,attribute:"switchers-full",reflect:!0})],Mt.prototype,"switchersFull",2);var Uw=Object.defineProperty,Hw=Object.getOwnPropertyDescriptor,ur=(t,e,i,o)=>{for(var n=o>1?void 0:o?Hw(e,i):e,s=t.length-1,r;s>=0;s--)(r=t[s])&&(n=(o?r(e,i,n):r(n))||n);return o&&n&&Uw(e,i,n),n};const Ap=class extends K{constructor(){super(...arguments),this._defaultName="__unnamed__",this.name=this._defaultName,this._hidden=!1}set label(t){this._label=t;const e=this.parentElement;e instanceof Mt&&e.updateSwitchers()}get label(){return this._label}set icon(t){this._icon=t;const e=this.parentElement;e instanceof Mt&&e.updateSwitchers()}get icon(){return this._icon}set hidden(t){this._hidden=t,this.dispatchEvent(new Event("hiddenchange"))}get hidden(){return this._hidden}connectedCallback(){super.connectedCallback();const{parentElement:t}=this;if(t&&this.name===this._defaultName){const e=[...t.children].indexOf(this);this.name=`${this._defaultName}${e}`}}render(){return w` <slot></slot> `}};Ap.styles=ie`
    :host {
      display: block;
      height: 100%;
      grid-row-start: 1;
      grid-column-start: 1;
      animation: openAnim 3s forwards;
      transform: translateY(0);
      max-height: 100vh;
      transition:
        opacity 0.3s ease,
        max-height 0.6s ease,
        transform 0.3s ease;
    }

    :host([hidden]) {
      transform: translateY(-20px);
      max-height: 0;
      opacity: 0;
      overflow: hidden;
      visibility: hidden;
    }
  `;let Le=Ap;ur([x({type:String,reflect:!0})],Le.prototype,"name",2);ur([x({type:String,reflect:!0})],Le.prototype,"label",1);ur([x({type:String,reflect:!0})],Le.prototype,"icon",1);ur([x({type:Boolean,reflect:!0})],Le.prototype,"hidden",1);var Vw=Object.defineProperty,qw=Object.getOwnPropertyDescriptor,ct=(t,e,i,o)=>{for(var n=o>1?void 0:o?qw(e,i):e,s=t.length-1,r;s>=0;s--)(r=t[s])&&(n=(o?r(e,i,n):r(n))||n);return o&&n&&Vw(e,i,n),n};const kp=class extends K{constructor(){super(...arguments),this._inputTypes=["date","datetime-local","email","month","password","search","tel","text","time","url","week","area"],this.value="",this.vertical=!1,this.disabled=!1,this.resize="vertical",this._type="text",this.onValueChange=new Event("input")}set type(t){this._inputTypes.includes(t)&&(this._type=t)}get type(){return this._type}get query(){return ma(this.value)}onInputChange(t){t.stopPropagation();const e=t.target;clearTimeout(this._debounceTimeoutID),this._debounceTimeoutID=setTimeout(()=>{this.value=e.value,this.dispatchEvent(this.onValueChange)},this.debounce)}focus(){setTimeout(()=>{var t;const e=(t=this.shadowRoot)==null?void 0:t.querySelector("input");e?.focus()})}render(){return w`
      <bim-input
        .name=${this.name}
        .icon=${this.icon}
        .label=${this.label}
        .vertical=${this.vertical}
      >
        ${this.type==="area"?w` <textarea
              aria-label=${this.label||this.name||"Text Input"}
              .value=${this.value}
              .rows=${this.rows??5}
              ?disabled=${this.disabled}
              placeholder=${ga(this.placeholder)}
              @input=${this.onInputChange}
              style="resize: ${this.resize};"
            ></textarea>`:w` <input
              aria-label=${this.label||this.name||"Text Input"}
              .type=${this.type}
              .value=${this.value}
              ?disabled=${this.disabled}
              placeholder=${ga(this.placeholder)}
              @input=${this.onInputChange}
            />`}
      </bim-input>
    `}};kp.styles=[ni.scrollbar,ie`
      :host {
        --bim-input--bgc: var(--bim-ui_bg-contrast-20);
        flex: 1;
        display: block;
      }

      input,
      textarea {
        font-family: inherit;
        background-color: transparent;
        border: none;
        width: 100%;
        padding: var(--bim-ui_size-3xs);
        color: var(--bim-text-input--c, var(--bim-ui_bg-contrast-100));
      }

      input {
        outline: none;
        height: 100%;
        padding: 0 var(--bim-ui_size-3xs); /* Override padding */
        border-radius: var(--bim-text-input--bdrs, var(--bim-ui_size-4xs));
      }

      :host([disabled]) input,
      :host([disabled]) textarea {
        color: var(--bim-ui_bg-contrast-60);
      }

      textarea {
        line-height: 1.1rem;
        outline: none;
      }

      :host(:focus) {
        --bim-input--olc: var(--bim-ui_accent-base);
      }

      /* :host([disabled]) {
      --bim-input--bgc: var(--bim-ui_bg-contrast-20);
    } */
    `];let Ie=kp;ct([x({type:String,reflect:!0})],Ie.prototype,"icon",2);ct([x({type:String,reflect:!0})],Ie.prototype,"label",2);ct([x({type:String,reflect:!0})],Ie.prototype,"name",2);ct([x({type:String,reflect:!0})],Ie.prototype,"placeholder",2);ct([x({type:String,reflect:!0})],Ie.prototype,"value",2);ct([x({type:Boolean,reflect:!0})],Ie.prototype,"vertical",2);ct([x({type:Number,reflect:!0})],Ie.prototype,"debounce",2);ct([x({type:Number,reflect:!0})],Ie.prototype,"rows",2);ct([x({type:Boolean,reflect:!0})],Ie.prototype,"disabled",2);ct([x({type:String,reflect:!0})],Ie.prototype,"resize",2);ct([x({type:String,reflect:!0})],Ie.prototype,"type",1);var Gw=Object.defineProperty,Ww=Object.getOwnPropertyDescriptor,Tp=(t,e,i,o)=>{for(var n=o>1?void 0:o?Ww(e,i):e,s=t.length-1,r;s>=0;s--)(r=t[s])&&(n=(o?r(e,i,n):r(n))||n);return o&&n&&Gw(e,i,n),n};const Op=class extends K{constructor(){super(...arguments),this.rows=2,this._vertical=!1}set vertical(t){this._vertical=t,this.updateChildren()}get vertical(){return this._vertical}updateChildren(){const t=this.children;for(const e of t)this.vertical?e.setAttribute("label-hidden",""):e.removeAttribute("label-hidden")}render(){return w`
      <style>
        .parent {
          grid-auto-flow: ${this.vertical?"row":"column"};
          grid-template-rows: repeat(${this.rows}, 1fr);
        }
      </style>
      <div class="parent">
        <slot @slotchange=${this.updateChildren}></slot>
      </div>
    `}};Op.styles=ie`
    .parent {
      display: grid;
      gap: 0.25rem;
    }

    ::slotted(bim-button[label]:not([vertical])) {
      --bim-button--jc: flex-start;
    }

    ::slotted(bim-button) {
      --bim-label--c: var(--bim-ui_bg-contrast-80);
    }
  `;let hr=Op;Tp([x({type:Number,reflect:!0})],hr.prototype,"rows",2);Tp([x({type:Boolean,reflect:!0})],hr.prototype,"vertical",1);var Yw=Object.defineProperty,Xw=Object.getOwnPropertyDescriptor,pr=(t,e,i,o)=>{for(var n=o>1?void 0:o?Xw(e,i):e,s=t.length-1,r;s>=0;s--)(r=t[s])&&(n=(o?r(e,i,n):r(n))||n);return o&&n&&Yw(e,i,n),n};const Ip=class extends K{constructor(){super(...arguments),this._vertical=!1,this._labelHidden=!1}set vertical(t){this._vertical=t,this.updateChildren()}get vertical(){return this._vertical}set labelHidden(t){this._labelHidden=t,this.updateChildren()}get labelHidden(){return this._labelHidden}updateChildren(){const t=this.children;for(const e of t)e instanceof hr&&(e.vertical=this.vertical),e.toggleAttribute("label-hidden",this.vertical)}render(){return w`
      <div class="parent">
        <div class="children">
          <slot @slotchange=${this.updateChildren}></slot>
        </div>
        ${!this.labelHidden&&(this.label||this.icon)?w`<bim-label .icon=${this.icon}>${this.label}</bim-label>`:null}
      </div>
    `}};Ip.styles=ie`
    :host {
      --bim-label--fz: var(--bim-ui_size-xs);
      --bim-label--c: var(--bim-ui_bg-contrast-60);
      display: block;
      flex: 1;
    }

    :host(:not([vertical])) ::slotted(bim-button[vertical]) {
      --bim-icon--fz: var(--bim-ui_size-5xl);
      min-height: 3.75rem;
    }

    .parent {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      align-items: center;
      padding: 0.5rem;
      height: 100%;
      box-sizing: border-box;
      justify-content: space-between;
    }

    :host([vertical]) .parent {
      flex-direction: row-reverse;
    }

    :host([vertical]) .parent > bim-label {
      writing-mode: tb;
    }

    .children {
      display: flex;
      gap: 0.25rem;
    }

    :host([vertical]) .children {
      flex-direction: column;
    }
  `;let Ln=Ip;pr([x({type:String,reflect:!0})],Ln.prototype,"label",2);pr([x({type:String,reflect:!0})],Ln.prototype,"icon",2);pr([x({type:Boolean,reflect:!0})],Ln.prototype,"vertical",1);pr([x({type:Boolean,attribute:"label-hidden",reflect:!0})],Ln.prototype,"labelHidden",1);var Zw=Object.defineProperty,Jw=Object.getOwnPropertyDescriptor,vl=(t,e,i,o)=>{for(var n=o>1?void 0:o?Jw(e,i):e,s=t.length-1,r;s>=0;s--)(r=t[s])&&(n=(o?r(e,i,n):r(n))||n);return o&&n&&Zw(e,i,n),n};const Pp=class extends K{constructor(){super(...arguments),this.labelsHidden=!1,this._vertical=!1,this._hidden=!1}set vertical(t){this._vertical=t,this.updateSections()}get vertical(){return this._vertical}set hidden(t){this._hidden=t,this.dispatchEvent(new Event("hiddenchange"))}get hidden(){return this._hidden}updateSections(){const t=this.children;for(const e of t)e instanceof Ln&&(e.labelHidden=this.vertical&&!Ne.config.sectionLabelOnVerticalToolbar,e.vertical=this.vertical)}render(){return w`
      <div class="parent">
        <slot @slotchange=${this.updateSections}></slot>
      </div>
    `}};Pp.styles=ie`
    :host {
      --bim-button--bgc: transparent;
      background-color: var(--bim-ui_bg-base);
      border-radius: var(--bim-ui_size-2xs);
      display: block;
    }

    :host([hidden]) {
      display: none;
    }

    .parent {
      display: flex;
      width: max-content;
      pointer-events: auto;
    }

    :host([vertical]) .parent {
      flex-direction: column;
    }

    :host([vertical]) {
      width: min-content;
      border-radius: var(--bim-ui_size-2xs);
      border: 1px solid var(--bim-ui_bg-contrast-20);
    }

    ::slotted(bim-toolbar-section:not(:last-child)) {
      border-right: 1px solid var(--bim-ui_bg-contrast-20);
      border-bottom: none;
    }

    :host([vertical]) ::slotted(bim-toolbar-section:not(:last-child)) {
      border-bottom: 1px solid var(--bim-ui_bg-contrast-20);
      border-right: none;
    }
  `;let fr=Pp;vl([x({type:String,reflect:!0})],fr.prototype,"icon",2);vl([x({type:Boolean,attribute:"labels-hidden",reflect:!0})],fr.prototype,"labelsHidden",2);vl([x({type:Boolean,reflect:!0})],fr.prototype,"vertical",1);var Kw=Object.defineProperty,Qw=(t,e,i,o)=>{for(var n=void 0,s=t.length-1,r;s>=0;s--)(r=t[s])&&(n=r(e,i,n)||n);return n&&Kw(e,i,n),n};const Lp=class extends K{constructor(){super(),this._onResize=new Event("resize"),new ResizeObserver(()=>{setTimeout(()=>{this.dispatchEvent(this._onResize)})}).observe(this)}render(){return w`
      <div class="parent">
        <slot></slot>
      </div>
    `}};Lp.styles=ie`
    :host {
      display: grid;
      min-width: 0;
      min-height: 0;
      height: 100%;
    }

    .parent {
      overflow: hidden;
      position: relative;
    }
  `;let Mp=Lp;Qw([x({type:String,reflect:!0})],Mp.prototype,"name");var e$=Object.defineProperty,wl=(t,e,i,o)=>{for(var n=void 0,s=t.length-1,r;s>=0;s--)(r=t[s])&&(n=r(e,i,n)||n);return n&&e$(e,i,n),n},Ee;const mr=(Ee=class extends K{constructor(){super(...arguments),this.visible=!1,this._previousContainer=null,this._showToolTip=async()=>{this.timeoutId=setTimeout(async()=>{if(this.visible=!0,!Ee.container.parentElement){const t=document.querySelector("[data-context-dialog]");t?t.append(Ee.container):document.body.append(Ee.container)}this._previousContainer=this.parentElement,Ee.container.style.top=`${window.scrollY||document.documentElement.scrollTop}px`,Ee.container.append(this),await this.computePosition()},this.timeout===void 0?800:this.timeout)},this._hideToolTip=()=>{clearTimeout(this.timeoutId),this.visible=!1,this._previousContainer&&(this._previousContainer.append(this),this._previousContainer=null),Ee.container.children.length===0&&Ee.container.parentElement&&Ee.container.remove()}}static get container(){return Ee._container||(Ee._container=document.createElement("div"),Ee._container.style.cssText=`
        position: absolute;
        top: 0;
        left: 0;
        width: 0;
        height: 0;
        overflow: visible;
        pointer-events: none;
        z-index: 9999;
      `),Ee._container}async computePosition(){const t=this._previousContainer||this.parentElement;if(!t)return;const e=this.style.display;this.style.display="block",this.style.visibility="hidden",await new Promise(requestAnimationFrame);const{x:i,y:o}=await rl(t,this,{placement:this.placement,middleware:[el(10),ol(),nl({padding:8}),sl()]});Object.assign(this.style,{left:`${i}px`,top:`${o}px`,display:e,visibility:""})}connectedCallback(){super.connectedCallback();const t=this.parentElement;t&&(t.addEventListener("mouseenter",this._showToolTip),t.addEventListener("mouseleave",this._hideToolTip))}disconnectedCallback(){super.disconnectedCallback();const t=this.parentElement;t&&(t.removeEventListener("mouseenter",this._showToolTip),t.removeEventListener("mouseleave",this._hideToolTip))}render(){return w`<div><slot></slot></div>`}},Ee.styles=ie`
    :host {
      position: absolute;
      background: var(--bim-ui_bg-contrast-20, #fff);
      color: var(--bim-ui_bg-contrast-100, #000);
      border-radius: var(--bim-ui_size-4xs, 4px);
      box-shadow: 0 0 10px 3px rgba(0, 0, 0, 0.2);
      padding: 0.75rem;
      font-size: var(--bim-ui_size-xs, 0.875rem);
      display: none;
    }
    :host([visible]) {
      display: flex;
    }
  `,Ee._container=null,Ee);wl([x({type:Boolean,reflect:!0})],mr.prototype,"visible");wl([x({type:Number,reflect:!0})],mr.prototype,"timeout");wl([x({type:String,reflect:!0})],mr.prototype,"placement");let t$=mr;const Ji=(t,e)=>{const i=e[t],o=i?.name??t,n=o.trim().split(/\s+/);let s,r;return n[0]&&n[0][0]&&(s=n[0][0].toUpperCase(),n[0][1]&&(r=n[0][1].toUpperCase())),n[1]&&n[1][0]&&(r=n[1][0].toUpperCase()),w`
    <div style="display: flex; gap: 0.25rem; overflow: hidden;">
      ${!(i!=null&&i.picture)&&(s||r)?w`
        <bim-label
          style=${Ot({borderRadius:"999px",padding:"0.375rem",backgroundColor:"var(--bim-ui_bg-contrast-20)",aspectRatio:"1",fontSize:"0.7rem"})}>${s}${r}</bim-label>
        `:null}
      <bim-label .img=${i?.picture}>${o}</bim-label>
    </div>
  `},Me={users:{"jhon.doe@example.com":{name:"Jhon Doe"}},priorities:{"On hold":{icon:"flowbite:circle-pause-outline",style:{backgroundColor:"var(--bim-ui_bg-contrast-20)","--bim-icon--c":"#767676"}},Minor:{icon:"mingcute:arrows-down-fill",style:{backgroundColor:"var(--bim-ui_bg-contrast-20)","--bim-icon--c":"#4CAF50"}},Normal:{icon:"fa6-solid:grip-lines",style:{backgroundColor:"var(--bim-ui_bg-contrast-20)","--bim-icon--c":"#FB8C00"}},Major:{icon:"mingcute:arrows-up-fill",style:{backgroundColor:"var(--bim-ui_bg-contrast-20)","--bim-icon--c":"#FF5252"}},Critical:{icon:"ph:warning",style:{backgroundColor:"var(--bim-ui_bg-contrast-20)","--bim-icon--c":"#FB8C00"}}},statuses:{Active:{icon:"prime:circle-fill",style:{backgroundColor:"var(--bim-ui_bg-contrast-20)"}},"In Progress":{icon:"prime:circle-fill",style:{backgroundColor:"#fa89004d","--bim-label--c":"#FB8C00","--bim-icon--c":"#FB8C00"}},"In Review":{icon:"prime:circle-fill",style:{backgroundColor:"#9c6bff4d","--bim-label--c":"#9D6BFF","--bim-icon--c":"#9D6BFF"}},Done:{icon:"prime:circle-fill",style:{backgroundColor:"#4CAF504D","--bim-label--c":"#4CAF50","--bim-icon--c":"#4CAF50"}},Closed:{icon:"prime:circle-fill",style:{backgroundColor:"#414141","--bim-label--c":"#727272","--bim-icon--c":"#727272"}}},types:{Clash:{icon:"gg:close-r",style:{backgroundColor:"var(--bim-ui_bg-contrast-20)","--bim-icon--c":"#FB8C00"}},Issue:{icon:"mdi:bug-outline",style:{backgroundColor:"var(--bim-ui_bg-contrast-20)","--bim-icon--c":"#FF5252"}},Failure:{icon:"mdi:bug-outline",style:{backgroundColor:"var(--bim-ui_bg-contrast-20)","--bim-icon--c":"#FF5252"}},Inquiry:{icon:"majesticons:comment-line",style:{backgroundColor:"var(--bim-ui_bg-contrast-20)","--bim-icon--c":"#FF5252"}},Fault:{icon:"ph:warning",style:{backgroundColor:"var(--bim-ui_bg-contrast-20)","--bim-icon--c":"#FF5252"}},Remark:{icon:"ph:note-blank-bold",style:{backgroundColor:"var(--bim-ui_bg-contrast-20)","--bim-icon--c":"#FB8C00"}},Request:{icon:"mynaui:edit-one",style:{backgroundColor:"var(--bim-ui_bg-contrast-20)","--bim-icon--c":"#9D6BFF"}}}},Ki={padding:"0.25rem 0.5rem",borderRadius:"999px","--bim-label--c":"var(--bim-ui_bg-contrast-100)"},i$={dueDate:t=>{if(typeof t=="string"&&t.trim()!=="")return new Date(t)},status:t=>{if(Array.isArray(t)&&t.length!==0)return t[0]},type:t=>{if(Array.isArray(t)&&t.length!==0)return t[0]},priority:t=>{if(Array.isArray(t)&&t.length!==0)return t[0]},stage:t=>{if(Array.isArray(t)&&t.length!==0)return t[0]},assignedTo:t=>{if(Array.isArray(t)&&t.length!==0)return t[0]},labels:t=>{if(Array.isArray(t))return new Set(t)}},zp=t=>{const{components:e,topic:i,value:o,onCancel:n,onSubmit:s,styles:r}=t,a=s??(()=>{}),l=e.get(Rs),c=o?.title??i?.title??Dt.default.title,d=o?.status??i?.status??Dt.default.status,u=o?.type??i?.type??Dt.default.type,h=o?.priority??i?.priority??Dt.default.priority,p=o?.assignedTo??i?.assignedTo??Dt.default.assignedTo,m=o?.labels??i?.labels??Dt.default.labels,g=o?.stage??i?.stage??Dt.default.stage,f=o?.description??i?.description??Dt.default.description,v=i!=null&&i.dueDate?i.dueDate.toISOString().split("T")[0]:null,y=new Set([...l.config.statuses]);d&&y.add(d);const b=new Set([...l.config.types]);u&&b.add(u);const $=new Set([...l.config.priorities]);h&&$.add(h);const C=new Set([...l.config.users]);p&&C.add(p);const E=new Set([...l.config.labels]);if(m)for(const I of m)E.add(I);const A=new Set([...l.config.stages]);g&&A.add(g);const P=ia(),M=async()=>{const{value:I}=P;if(!I)return;const H=yo(I,i$);if(i)i.set(H),await a(i);else{const ne=l.create(H);await a(ne)}},O=ia(),U=I=>{const{value:H}=O;if(!H)return;const ne=I.target;H.disabled=ne.value.trim()===""},z=`btn-${Ne.newRandomId()}`,X=`btn-${Ne.newRandomId()}`;return w`
    <div ${me(P)} style="display: flex; flex-direction: column; gap: 0.75rem;">
      <div style="display: flex; gap: 0.375rem">
        <bim-text-input @input=${U} vertical label="Title" name="title" .value=${c}></bim-text-input>
        ${i?w`
            <bim-dropdown vertical label="Status" name="status" required>
              ${[...y].map(I=>w`<bim-option label=${I} .checked=${d===I}></bim-option>`)}
            </bim-dropdown>`:w``}
      </div>
      <div style="display: flex; gap: 0.375rem">
        <bim-dropdown vertical label="Type" name="type" required>
          ${[...b].map(I=>w`<bim-option label=${I} .checked=${u===I}></bim-option>`)}
        </bim-dropdown>
        <bim-dropdown vertical label="Priority" name="priority">
          ${[...$].map(I=>w`<bim-option label=${I} .checked=${h===I}></bim-option>`)}
        </bim-dropdown>
      </div>
      <div style="display: flex; gap: 0.375rem">
        <bim-dropdown vertical label="Labels" name="labels" multiple>
          ${[...E].map(I=>w`<bim-option label=${I} .checked=${m?[...m].includes(I):!1}></bim-option>`)}
        </bim-dropdown>
        <bim-dropdown vertical label="Assignee" name="assignedTo">
          ${[...C].map(I=>{const H=r!=null&&r.users?r.users[I]:null,ne=H?H.name:I,Z=H?.picture;return w`<bim-option label=${ne} value=${I} .img=${Z} .checked=${p===I}></bim-option>`})}
        </bim-dropdown>
      </div>
      <div style="display: flex; gap: 0.375rem">
        <bim-text-input vertical type="date" label="Due Date" name="dueDate" .value=${v}></bim-text-input> 
        <bim-dropdown vertical label="Stage" name="stage">
          ${[...A].map(I=>w`<bim-option label=${I} .checked=${g===I}></bim-option>`)}
        </bim-dropdown>
      </div>
      <bim-text-input vertical label="Description" name="description" type="area" .value=${f??null}></bim-text-input>
      <div style="justify-content: right; display: flex; gap: 0.375rem">
        <style>
          #${X} {
            background-color: transparent;
          }

          #${X}:hover {
            --bim-label--c: #FF5252;
          }

          #${z}:hover {
            background-color: #329936;
          }
        </style>
        <bim-button id=${X} style="flex: 0" @click=${n} label="Cancel"></bim-button>
        <bim-button id=${z} style="flex: 0" @click=${M} ${me(O)} label=${i?"Update Topic":"Add Topic"} icon=${i?"tabler:refresh":"mi:add"}></bim-button>
      </div>
    </div>
  `},n$=t=>{const{components:e,modelUserData:i,worldName:o}=t;return w`
    <bim-button
      data-ui-id="import-ifc"
      label="Load IFC"
      icon="mage:box-3d-fill"
      @click=${()=>{if(!(e&&o))return;const n=[...e.get(Ds).list.values()].find(r=>"name"in r&&r.name===o);if(!n)return;const s=document.createElement("input");s.type="file",s.accept=".ifc",s.onchange=async()=>{if(s.files===null||s.files.length===0)return;const r=s.files[0],a=await r.arrayBuffer(),l=new Uint8Array(a),c=r.name.replace(".ifc",""),d=e.get(nt),u=e.get(Ea);u.settings.autoSetWasm=!1,u.settings.wasm={path:"https://unpkg.com/web-ifc@0.0.72/",absolute:!1};const h=await u.load(l,!0,c,{userData:i});n.scene.three.add(h.object),h.useCamera(n.camera.three),d.core.update(!0)},s.click()}}
    ></bim-button>
  `},o$=t=>be.create(n$,t),s$=Object.freeze(Object.defineProperty({__proto__:null,loadIfc:o$},Symbol.toStringTag,{value:"Module"})),r$=t=>{const{components:e,world:i}=t;return w`
    <bim-button @click=${()=>{const o=document.createElement("input");o.type="file",o.accept=".frag",o.onchange=async()=>{if(o.files===null||o.files.length===0)return;const n=o.files[0],s=await n.arrayBuffer(),r=new Uint8Array(s),a=n.name.replace(".frag",""),l=e.get(nt),c=await l.core.load(r,{modelId:a});i&&(i.scene.three.add(c.object),c.useCamera(i.camera.three),l.core.update(!0))},o.click()}}></bim-button>
  `},a$=t=>{const e=be.create(r$,t),[i]=e;return i.label="Load FRAG",i.icon="mage:box-3d-fill",e},l$=Object.freeze(Object.defineProperty({__proto__:null,loadFrag:a$},Symbol.toStringTag,{value:"Module"}));({...s$,...l$});const ya=async(t,e)=>{const{localId:i,category:o,children:n}=e;if(o&&n){const s={data:{Name:o,modelId:t.modelId,children:JSON.stringify(n.map(r=>r.localId))}};for(const r of n){const a=await ya(t,r);a&&(s.children||(s.children=[]),s.children.push(a))}return s}if(i!==null){const s=await t.getItem(i).getAttributes();if(!s)return null;const r={data:{Name:String(s.getValue("Name")),modelId:t.modelId,localId:i}};for(const a of n??[]){const l=await ya(t,a);l&&(r.children||(r.children=[]),r.children.push(l))}return r}return null},c$=async t=>{const e=[];for(const i of t){const o=await i.getSpatialStructure(),n=await ya(i,o);if(!n)continue;const s={data:{Name:i.modelId,modelId:i.modelId},children:[n]};e.push(s)}return e},Dp=t=>{const{components:e,models:i}=t,o=t.selectHighlighterName??"select";return w`
    <bim-table @rowcreated=${n=>{n.stopImmediatePropagation();const{row:s}=n.detail,r=e.get(Ns),a=e.get(nt);s.onclick=async()=>{if(!o)return;const{data:{modelId:l,localId:c,children:d}}=s;if(!(l&&(c!==void 0||d)))return;const u=a.list.get(l);if(u){if(c!==void 0){const h=await u.getItemsChildren([c]),p={[l]:h.length!==0?new Set(h):new Set([c])};r.highlightByID(o,p,!0,!0)}else if(d){const h=JSON.parse(d),p=await u.getItemsChildren(h),m={[l]:p.length!==0?p:h};r.highlightByID(o,m,!0,!0)}}}}} @cellcreated=${({detail:n})=>{const{cell:s}=n;s.column==="Name"&&!s.rowData.Name&&(s.style.gridColumn="1 / -1")}} ${me(async n=>{if(!n)return;const s=n;s.loadFunction=async()=>new Promise(r=>{setTimeout(()=>{r(c$(i))})}),s.loadData(!0)})} headers-hidden>
      <bim-label slot="missing-data" style="--bim-icon--c: gold" icon="ic:round-warning">
        No models available to display the spatial structure!
      </bim-label>
    </bim-table>
  `},d$=(t,e=!0)=>{const i=be.create(Dp,t),[o,n]=i;if(o.hiddenColumns=["modelId","localId","children"],o.columns=["Name"],o.headersHidden=!0,e){const{components:s}=t,r=s.get(nt);r.list.onItemSet.add(()=>n({models:r.list.values()})),r.list.onItemDeleted.add(()=>n())}return i},u$=Object.freeze(Object.defineProperty({__proto__:null,spatialTree:d$,spatialTreeTemplate:Dp},Symbol.toStringTag,{value:"Module"}));let bi={};const _d={_category:"Category",_localId:"LocalId",_guid:"Guid"},h$=(t,e,i,o,n,s)=>{const r={data:{type:"attribute",modelId:o,localId:n,Name:e in _d?_d[e]:e,Value:i,dataType:s}};t.children||(t.children=[]),t.children.push(r)},Rp=(t,e,i)=>{var o;t in bi||(bi[t]=new Map);const n=bi[t],s=e._localId.value;if(n.has(s))return n.get(s);const r=(o=e[i.defaultItemNameKey])==null?void 0:o.value,a=e._category.value,l={data:{modelId:t,localId:s,type:"item",Name:r?.toString().length>0?r.toString():a??String(s)}};n.set(s,l);for(const c in e){const d=e[c];if(!Array.isArray(d))h$(l,c,d.value,t,s,d.type);else{const u={data:{Name:c,type:"relation"}};l.children||(l.children=[]),l.children.push(u);for(const h of d){const p=Rp(t,h,i);u.children||(u.children=[]),u.children.push(p)}}}return l},p$=async(t,e,i)=>{const o=t.get(nt);Object.keys(e).length===0&&(bi={});const n=[];for(const s in e){const r=o.list.get(s);if(!r)continue;s in bi||(bi[s]=new Map);const a=bi[s],l=e[s];for(const c of l){let d=a.get(c);if(d){n.push(d);continue}const[u]=await r.getItemsData([c],i.itemsDataConfig);d=Rp(s,u,i),n.push(d)}}return n},jp=t=>{const e={defaultItemNameKey:"Name",itemsDataConfig:{attributesDefault:!0,relationsDefault:{attributes:!1,relations:!1},relations:{IsDefinedBy:{attributes:!0,relations:!0},DefinesOcurrence:{attributes:!1,relations:!1},ContainedInStructure:{attributes:!0,relations:!0},ContainsElements:{attributes:!1,relations:!1},Decomposes:{attributes:!1,relations:!1}}},...t},{components:i,modelIdMap:o,emptySelectionWarning:n}=t,s=Object.keys(o).reduce((r,a)=>(a.includes("DELTA")||(r[a]=o[a]),r),{});return w`
    <bim-table @cellcreated=${({detail:r})=>{const{cell:a}=r,{Name:l,Value:c}=a.rowData;l&&c===void 0&&setTimeout(()=>{a.style.gridColumn="1 / -1"})}} ${me(async r=>{if(!r)return;const a=r;a.loadFunction=async()=>p$(i,s,e),await a.loadData(!0)&&a.dispatchEvent(new Event("datacomputed"))})}>
      ${n?w`
            <bim-label slot="missing-data" style="--bim-icon--c: gold" icon="ic:round-warning">
              Select some elements to display its properties
            </bim-label>
            `:null}
      <bim-label slot="error-loading" style="--bim-icon--c: #e72e2e" icon="bxs:error-alt">
        Something went wrong with the properties
      </bim-label>
    </bim-table>
  `},f$=new Map,m$={METRE:"m",SQUARE_METRE:"m²",CUBIC_METRE:"m³"},b$=async(t,e)=>{const i=t.get(nt).list.get(e);if(!i)throw new Error(`ItemsDataUI: model ${e} not found.`);let o=f$.get(i.modelId);if(!o){const[n]=Object.values(await i.getItemsOfCategories([/UNITASSIGNMENT/])).flat(),[s]=await i.getItemsData([n],{relations:{Units:{relations:!1,attributes:!0}}});if(!Array.isArray(s.Units))return[];o=s.Units}return o},g$=(t,e)=>{const{components:i}=t;e.columns=[{name:"Name",width:"12rem"}],e.hiddenColumns=["modelId","localId","Actions","type","dataType"],e.headersHidden=!0,e.dataTransform={Value:(o,n)=>{const{dataType:s,modelId:r}=n;return s?w`<bim-label ${me(async a=>{if(!(a&&r))return;const l=await b$(i,r),c=s.replace("IFC","").replace("MEASURE","UNIT"),d=l.find(h=>h.UnitType&&"value"in h.UnitType?h.UnitType.value===c:!1);if(!d||!(d.Name&&"value"in d.Name))return o;const u=`${o.toFixed(2)} ${m$[d.Name.value]??d.Name.value}`;a.textContent=u})}></bim-label>`:o}}},y$=t=>{const e=be.create(jp,t),[i]=e;return g$(t,i),e},v$=Object.freeze(Object.defineProperty({__proto__:null,itemsData:y$,itemsDataTemplate:jp},Symbol.toStringTag,{value:"Module"})),Np=t=>{const{components:e}=t,i=t.missingDataMessage??"No models has been loaded yet",o=e.get(nt),n=({detail:s})=>{const{cell:r}=s;r.style.padding="0.25rem 0"};return w`
    <bim-table ${me(async s=>{if(!s)return;const r=s,a=[];if(o.initialized)for(const[,l]of o.list){if(!l)continue;const c=await l.getMetadata(),d={data:{Name:l.modelId,modelId:l.modelId,metadata:JSON.stringify(c)}};a.push(d)}r.data=a})} @cellcreated=${n}>
      <bim-label slot="missing-data" style="--bim-icon--c: gold" icon="ic:round-warning">
        ${i}
      </bim-label>
    </bim-table>
  `},w$=(t,e)=>{const{components:i,actions:o,metaDataTags:n}=t,s=i.get(nt),r=o?.dispose??!0,a=o?.download??!0,l=o?.visibility??!0,c=n??[];e.hiddenColumns=["modelId","metadata"],e.headersHidden=!0,e.noIndentation=!0,e.dataTransform={Name:(d,u)=>{if(!s.initialized)return d;const{modelId:h,metadata:p}=u;if(!h)return d;const m=s.list.get(h);if(!m)return h;const g=[];if(p){const b=JSON.parse(p);for(const $ of c){const C=b[$];if(!(typeof C=="string"||typeof C=="boolean"||typeof C=="number"))continue;const E=w`
            <bim-label style="background-color: var(--bim-ui_main-base); padding: 0 0.25rem; color: var(--bim-ui_main-contrast); border-radius: 0.25rem;">${C}</bim-label>
            `;g.push(E)}}let f;r&&(f=w`<bim-button @click=${()=>s.core.disposeModel(m.modelId)} icon="mdi:delete"></bim-button>`);let v;l&&(v=w`<bim-button @click=${async({target:b})=>{b.loading=!0,await m.setVisible(void 0,b.hasAttribute("data-model-hidden")),await s.core.update(!0),b.toggleAttribute("data-model-hidden"),b.icon=b.hasAttribute("data-model-hidden")?"mdi:eye-off":"mdi:eye",b.loading=!1}} icon="mdi:eye"></bim-button>`);let y;return a&&(y=w`<bim-button @click=${async()=>{const b=await m.getBuffer(!1),$=new File([b],`${m.modelId}.frag`),C=document.createElement("a");C.href=URL.createObjectURL($),C.download=$.name,C.click(),URL.revokeObjectURL(C.href)}} icon="flowbite:download-solid"></bim-button>`),w`
       <div style="display: flex; flex: 1; gap: var(--bim-ui_size-4xs); justify-content: space-between; overflow: auto;">
        <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 0 var(--bim-ui_size-4xs); flex-grow: 1; overflow: auto;">
          <div style="min-height: 1.75rem; overflow: auto; display: flex;">
            <bim-label style="white-space: normal;">${d}</bim-label>
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: var(--bim-ui_size-4xs); overflow: auto;">
            ${g}
          </div>
        </div>
        <div style="display: flex; align-self: flex-start; flex-shrink: 0;">
          ${y}
          ${v}
          ${f}
        </div>
       </div>
      `}}},$$=(t,e=!0)=>{const i=be.create(Np,t),[o,n]=i;if(w$(t,o),e){const{components:s}=t,r=s.get(nt),a=()=>setTimeout(()=>n());r.list.onItemSet.add(a),r.list.onItemDeleted.add(a)}return i},_$=Object.freeze(Object.defineProperty({__proto__:null,modelsList:$$,modelsListTemplate:Np},Symbol.toStringTag,{value:"Module"})),Bp=t=>{var e;const{components:i}=t,o=t.missingDataMessage??"No viewpoints to display",n=i.get(js),s=((e=t.topic)==null?void 0:e.viewpoints)??n.list.keys(),r=[];for(const c of s){const d=n.list.get(c);d&&r.push(d)}const a=c=>{if(!c)return;const d=c;d.data=r.map((u,h)=>({data:{Guid:u.guid,Title:u.title??`Viewpoint ${t.topic?h+1:""}`,Actions:""}}))},l=({detail:c})=>{const{cell:d}=c;d.style.padding="0.25rem"};return w`
    <bim-table ${me(a)} @cellcreated=${l}>
      <bim-label slot="missing-data" icon="ph:warning-fill" style="--bim-icon--c: gold;">${o}</bim-label>
    </bim-table>
  `},x$=(t,e)=>{const{components:i,topic:o}=t;e.noIndentation=!0,e.headersHidden=!0,e.hiddenColumns=["Guid"],e.columns=["Title",{name:"Actions",width:"auto"}];const n={selectComponents:!0,colorizeComponent:!0,resetColors:!0,updateCamera:!0,delete:!0,unlink:!!o,...t.actions},s=i.get(js);e.dataTransform={Actions:(r,a)=>{const{Guid:l}=a;if(!(l&&typeof l=="string"))return r;const c=s.list.get(l);if(!c)return r;const d=async({target:y})=>{y.loading=!0,await c.go(),y.loading=!1};let u;n.selectComponents&&(u=w`
          <bim-button label="Select Components" @click=${async({target:y})=>{const b=i.get(nt),$=i.get(Ns);if(!$.isSetup)return;y.loading=!0;const C=await b.guidsToModelIdMap([...c.selectionComponents]);await $.highlightByID("select",C),y.loading=!1}}></bim-button>
        `);let h;n.colorizeComponent&&(h=w`
          <bim-button label="Colorize Components" @click=${async({target:y})=>{y.loading=!0,await c.setColorizationState(!0),y.loading=!1}}></bim-button>
        `);let p;n.resetColors&&(p=w`
          <bim-button label="Reset Colors" @click=${async({target:y})=>{y.loading=!0,await c.setColorizationState(!1),y.loading=!1}}></bim-button>
        `);let m;n.updateCamera&&(m=w`
          <bim-button label="Update Camera" @click=${()=>c.updateCamera()}></bim-button>
        `);let g;n.unlink&&(g=w`
          <bim-button label="Unlink" @click=${()=>o?.viewpoints.delete(c.guid)}></bim-button>
        `);let f;n.delete&&(f=w`
          <bim-button label="Delete" @click=${()=>{s.list.delete(c.guid),Kn.removeMenus()}}></bim-button>
        `);let v;return Object.values(n).includes(!0)&&(v=w`
          <bim-button icon="prime:ellipsis-v">
            <bim-context-menu>
              ${u}
              ${h}
              ${p}
              ${m}
              ${g}
              ${f}
            </bim-context-menu>
          </bim-button>
        `),w`
        <bim-button icon="ph:eye-fill" @click=${d}></bim-button>
        ${v}
      `}}},Fp=(t,e=!0)=>{const i=be.create(Bp,t),[o,n]=i;if(x$(t,o),e){const{components:s,topic:r}=t,a=s.get(js);a.list.onItemUpdated.add(()=>n()),a.list.onItemDeleted.add(()=>n()),a.list.onCleared.add(()=>n()),r?(r.viewpoints.onItemAdded.add(()=>n()),r.viewpoints.onItemDeleted.add(()=>n()),r.viewpoints.onCleared.add(()=>n())):a.list.onItemSet.add(()=>n())}return i},E$=Object.freeze(Object.defineProperty({__proto__:null,viewpointsList:Fp,viewpointsListTemplate:Bp},Symbol.toStringTag,{value:"Module"})),Up=t=>{const{components:e}=t,i=t.missingDataMessage??"No topics to display",o=e.get(Rs),n=t.topics??o.list.values();return w`
    <bim-table no-indentation ${me(s=>{if(!s)return;const r=s;r.data=[...n].map(a=>{var l;return{data:{Guid:a.guid,Title:a.title,Status:a.status,Description:a.description??"",Author:a.creationAuthor,Assignee:a.assignedTo??"",Date:a.creationDate.toDateString(),DueDate:((l=a.dueDate)==null?void 0:l.toDateString())??"",Type:a.type,Priority:a.priority??"",Actions:""}}})})}>
      <bim-label slot="missing-data" icon="ph:warning-fill" style="--bim-icon--c: gold;">${i}</bim-label>
    </bim-table>
  `},S$=(t,e)=>{const{dataStyles:i}=t;e.hiddenColumns.length===0&&(e.hiddenColumns=["Guid","Actions"]),e.columns=["Title"],e.dataTransform={Priority:o=>{if(typeof o!="string")return o;const n=(i?.priorities??Me.priorities)[o];return w`
            <bim-label
              .icon=${n?.icon}
              style=${Ot({...Ki,...n?.style})}
            >${o}
            </bim-label>
          `},Status:o=>{if(typeof o!="string")return o;const n=(i?.statuses??Me.statuses)[o];return w`
            <bim-label
              .icon=${n?.icon}
              style=${Ot({...Ki,...n?.style})}
            >${o}
            </bim-label>
          `},Type:o=>{if(typeof o!="string")return o;const n=(i?.types??Me.types)[o];return w`
            <bim-label
              .icon=${n?.icon}
              style=${Ot({...Ki,...n?.style})}
            >${o}
            </bim-label>
          `},Author:o=>typeof o!="string"?o:Ji(o,i?.users??Me.users),Assignee:o=>typeof o!="string"?o:Ji(o,i?.users??Me.users)}},Hp=(t,e=!0)=>{const i=be.create(Up,t),[o,n]=i;if(S$(t,o),e){const{components:s,topics:r}=t,a=s.get(Rs),l=()=>n();if(a.list.onItemUpdated.add(l),a.list.onItemDeleted.add(l),r)for(const c of r)c.relatedTopics.onItemAdded.add(l),c.relatedTopics.onItemDeleted.add(l),c.relatedTopics.onCleared.add(l);else a.list.onItemSet.add(l)}return i},C$=Object.freeze(Object.defineProperty({__proto__:null,topicsList:Hp,topicsListTemplate:Up},Symbol.toStringTag,{value:"Module"})),Vp=t=>{const{topic:e,styles:i,viewpoint:o}=t,n=t.missingDataMessage??"The topic has no comments";return w`
    <bim-table no-indentation ${me(s=>{if(!s)return;const r=s;let a=e.comments.values();o&&(a=[...e.comments.values()].filter(l=>l.viewpoint===o.guid)),r.data=[...a].map(l=>({data:{guid:l.guid,Comment:l.comment,author:(()=>{const c=i;if(!c)return l.author;const d=c[l.author];return d?.name??l.author})()}}))})}>
      <bim-label slot="missing-data" icon="ph:warning-fill" style="--bim-icon--c: gold;">${n}</bim-label>
    </bim-table>
  `},A$=(t,e)=>{const{topic:i,styles:o}=t,n={delete:!0,...t.actions};e.headersHidden=!0,e.hiddenColumns=["guid","author"],e.dataTransform={Comment:(s,r)=>{const{guid:a}=r;if(typeof a!="string")return s;const l=i.comments.get(a);if(!l)return s;const c=()=>{i.comments.delete(a)};let d;if(n.delete){const u=`btn-${Ne.newRandomId()}`;d=w`
          <div>
            <style>
              #${u} {
                background-color: transparent;
                --bim-label--c: var(--bim-ui_bg-contrast-60)
              }
  
              #${u}:hover {
                --bim-label--c: #FF5252;
              }
            </style>
            <bim-button @click=${c} id=${u} icon="majesticons:delete-bin"></bim-button>
          </div>
        `}return w`
        <div style="display: flex; flex-direction: column; gap: 0.25rem; flex: 1">
          <div style="display: flex; justify-content: space-between;">
            <div style="display: flex; gap: 0.375rem;">
              ${Ji(l.author,o??Me.users)}
              <bim-label style="color: var(--bim-ui_bg-contrast-40)">@ ${l.date.toDateString()}</bim-label>
            </div>
            ${d}
          </div>
          <bim-label style="margin-left: 1.7rem; white-space: normal">${l.comment}</bim-label>
        </div>
      `}}},qp=(t,e=!0)=>{const i=be.create(Vp,t),[o,n]=i;if(A$(t,o),e){const{topic:s}=t,r=()=>n();s.comments.onItemSet.add(r),s.comments.onItemUpdated.add(r),s.comments.onItemDeleted.add(r),s.comments.onCleared.add(r)}return i},k$=Object.freeze(Object.defineProperty({__proto__:null,commentsList:qp,commentsListTemplate:Vp},Symbol.toStringTag,{value:"Module"})),T$={...u$,...v$,..._$,...E$,...C$,...k$},Gp=(t,e)=>{const{showInput:i,topic:o,styles:n}=t,s={add:!0,delete:!0,...t.actions},r=`input-${Ne.newRandomId()}`,a=`btn-${Ne.newRandomId()}`,l=`btn-${Ne.newRandomId()}`,c=()=>document.getElementById(a),d=()=>document.getElementById(r),u=()=>{const b=d();return b?b.value.trim().length>0:!1},h=()=>{e({showInput:!0})},p=()=>{const b=d(),$=u();b&&$&&(o.createComment(b.value),e({showInput:!1}))},m=()=>{e({showInput:!1})},g=()=>{const b=c();if(b){if(!d()){b.disabled=!0;return}b.disabled=!u()}},f=w`
    ${s.add?w`<bim-button @click=${h} label="Add Comment" icon="majesticons:comment-line"></bim-button>`:null}
  `,v=w`
    <bim-text-input id=${r} @input=${g} @keypress=${b=>{b.code==="Enter"&&b.ctrlKey&&p()}} type="area"></bim-text-input>

    <div style="justify-content: right; display: flex; gap: 0.375rem">
      <style>
        #${a} {
          background-color: #329936;
        }  

        #${l} {
          background-color: transparent;
        }

        #${l}:hover {
          --bim-label--c: #FF5252;
        }
      </style>

      <bim-button style="flex: 0" id=${l} @click=${m} label="Cancel"></bim-button>
      <bim-button style="flex: 0" id=${a} @click=${p} label="Accept" icon="material-symbols:check" disabled></bim-button>
    </div>
  `,[y]=qp({topic:o,actions:s,styles:n??Me.users});return w`
    <div style="display: flex; flex-direction: column; gap: 0.5rem">
      ${y}
      ${i?v:f}
    </div>
  `},O$=t=>be.create(Gp,t),I$=Object.freeze(Object.defineProperty({__proto__:null,topicComments:O$,topicCommentsSectionTemplate:Gp},Symbol.toStringTag,{value:"Module"})),Wp=(t,e)=>{const{components:i,editing:o,topic:n,styles:s}=t,r={update:!0,...t.actions},a=s?.priorities??Me.priorities,l=s?.statuses??Me.statuses,c=s?.types??Me.types;let d;n!=null&&n.priority&&(d=a[n.priority]);let u;n!=null&&n.type&&(u=c[n.type]);let h;n!=null&&n.type&&(h=l[n.status]);let p,m;return o?p=zp({components:i,topic:n,styles:s,onSubmit:()=>{e({editing:!1})},onCancel:()=>{e({editing:!1})}}):m=w`
      <div>
        <bim-label>Title</bim-label>
        <bim-label style="--bim-label--c: var(--bim-ui_bg-contrast-100)">${n.title}</bim-label>
      </div>

      ${n.description?w`
            <div>
              <bim-label>Description</bim-label>
              <bim-label style="--bim-label--c: var(--bim-ui_bg-contrast-100); white-space: normal">${n.description}</bim-label>
            </div>
          `:null}

      <div style="display: flex; gap: 0.375rem">
        <bim-label>Status</bim-label>
        <bim-label .icon=${h?.icon} style=${Ot({...Ki,...h?.style})}
        >${n.status}
        </bim-label>
      </div>

      <div style="display: flex; gap: 0.375rem">
        <bim-label>Type</bim-label>
        <bim-label .icon=${u?.icon} style=${Ot({...Ki,...u?.style})}
        >${n.type}
        </bim-label>
      </div>

      ${n.priority?w`
            <div style="display: flex; gap: 0.375rem">
              <bim-label>Priority</bim-label>
              <bim-label .icon=${d?.icon} style=${Ot({...Ki,...d?.style})}
              >${n.priority}
              </bim-label>
            </div>`:null}

      <div style="display: flex; gap: 0.375rem">
        <bim-label>Author</bim-label>
        ${Ji(n.creationAuthor,s?.users??Me.users)}
      </div>

      ${n.assignedTo?w`
          <div style="display: flex; gap: 0.375rem">
            <bim-label>Assignee</bim-label>
            ${Ji(n.assignedTo,s?.users??Me.users)}
          </div>`:null}

      ${n.dueDate?w`
          <div style="display: flex; gap: 0.375rem">
            <bim-label>Due Date</bim-label>
            <bim-label style="--bim-label--c: var(--bim-ui_bg-contrast-100)">${n.dueDate.toDateString()}</bim-label>
          </div>`:null}

      ${n.modifiedAuthor?w`
          <div style="display: flex; gap: 0.375rem">
            <bim-label>Modified By</bim-label>
            ${Ji(n.modifiedAuthor,s?.users??Me.users)}
          </div>`:null}

      ${n.modifiedDate?w`
            <div style="display: flex; gap: 0.375rem">
              <bim-label>Modified Date</bim-label>
              <bim-label style="--bim-label--c: var(--bim-ui_bg-contrast-100)">${n.modifiedDate.toDateString()}</bim-label>
            </div>`:null}

      ${n.labels.size!==0?w`
          <div style="display: flex; gap: 0.375rem">
            <bim-label>Labels</bim-label>
            <bim-label style="white-space: normal; --bim-label--c: var(--bim-ui_bg-contrast-100)">${[...n.labels].join(", ")}</bim-label>
          </div>`:null}

      ${r.update?w`
              <bim-button @click=${()=>e({editing:!0})} label="Update Information" icon="tabler:refresh"></bim-button> 
            `:null}
    `,w`
    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
      ${o?p:m}
    </div>
  `},P$=t=>be.create(Wp,t),L$=Object.freeze(Object.defineProperty({__proto__:null,topicInformation:P$,topicInformationSectionTemplate:Wp},Symbol.toStringTag,{value:"Module"})),Yp=(t,e)=>{const{components:i,topic:o,linking:n}=t,s=i.get(Rs),r={link:!0,...t.actions},[a,l]=Hp({components:i,topics:[...o.relatedTopics].map(h=>s.list.get(h)).map(h=>h)});a.headersHidden=!0,a.hiddenColumns=["Guid","Status","Description","Author","Assignee","Date","DueDate","Type","Priority"];const c=()=>w`
      <bim-text-input placeholder="Search..." debounce="100" @input=${h=>{const p=h.target;p instanceof Ie&&(a.queryString=p.value)}}></bim-text-input> 
    `;let d,u;if(n){a.selectableRows=!0,l({topics:void 0});const h=a.data.filter(v=>{const{Guid:y}=v.data;return typeof y!="string"?!1:o.relatedTopics.has(y)}).map(v=>v.data);a.selection=new Set(h);const p=()=>{const v=[...a.selection].map(({Guid:y})=>typeof y!="string"?null:s.list.has(y)?y:null).map(y=>y);o.relatedTopics.clear(),o.relatedTopics.add(...v),e({linking:!1})},m=()=>{e({linking:!1})},g=`btn-${Ne.newRandomId()}`,f=`btn-${Ne.newRandomId()}`;d=w`
      <div style="display: flex; gap: 0.25rem">
        <style>
          #${g}:hover {
            background-color: #329936;
          }  

          #${f} {
            background-color: transparent;
          }

          #${f}:hover {
            --bim-label--c: #FF5252;
          }
        </style>
        ${c()}
        <div style="display: flex; justify-content: right; gap: 0.25rem">
          <bim-button id=${f} @click=${m} style="flex: 0" label="Cancel" icon="material-symbols:close"></bim-button>
          <bim-button id=${g} @click=${p} style="flex: 0" label="Accept" icon="material-symbols:check"></bim-button>
        </div>
      </div> 
    `}else{a.selectableRows=!1;const h=()=>{e({linking:!0})};u=w`
      <div style="display: flex; justify-content: right; gap: 0.25rem">
        ${c()}
        ${r.link?w`<bim-button style="flex: 0" @click=${h} icon="tabler:link"></bim-button>`:null}
      </div> 
    `}return w`
    <div style="display: flex; flex-direction: column; gap: 0.5rem;">
      ${u}
      ${d}
      ${a}
    </div> 
  `},M$=t=>be.create(Yp,t),z$=Object.freeze(Object.defineProperty({__proto__:null,topicRelations:M$,topicRelationsSectionTemplate:Yp},Symbol.toStringTag,{value:"Module"})),Xp=(t,e)=>{const{components:i,topic:o,world:n,linking:s}=t,r={add:!0,link:!0,selectComponents:!0,colorizeComponent:!0,resetColors:!0,updateCamera:!0,delete:!0,unlink:!0,...t.actions},a=i.get(js),[l,c]=Fp({components:i,topic:o,actions:r}),d=()=>w`
      <bim-text-input placeholder="Search..." debounce="100" @input=${p=>{const m=p.target;m instanceof Ie&&(l.queryString=m.value)}}></bim-text-input> 
    `;let u,h;if(s){l.selectableRows=!0,c({topic:void 0,actions:{delete:!1,updateCamera:!1,colorizeComponent:!1,resetColors:!1}});const p=l.data.filter(y=>{const{Guid:b}=y.data;return typeof b!="string"?!1:o.viewpoints.has(b)}).map(y=>y.data);l.selection=new Set(p);const m=()=>{const y=[...l.selection].map(({Guid:b})=>typeof b!="string"?null:a.list.has(b)?b:null).map(b=>b);o.viewpoints.clear(),o.viewpoints.add(...y),e({linking:!1})},g=()=>{e({linking:!1})},f=`btn-${Ne.newRandomId()}`,v=`btn-${Ne.newRandomId()}`;u=w`
      <div style="display: flex; gap: 0.25rem">
        <style>
          #${f}:hover {
            background-color: #329936;
          }  

          #${v} {
            background-color: transparent;
          }

          #${v}:hover {
            --bim-label--c: #FF5252;
          }
        </style>
        ${d()}
        <div style="display: flex; justify-content: right; gap: 0.25rem">
          <bim-button id=${v} @click=${g} style="flex: 0" label="Cancel" icon="material-symbols:close"></bim-button>
          <bim-button id=${f} @click=${m} style="flex: 0" label="Accept" icon="material-symbols:check"></bim-button>
        </div>
      </div> 
    `}else{l.selectableRows=!1,c({topic:o,actions:r});const p=()=>{if(!(o&&r.add&&!s))return;const v=a.create();n&&(v.world=n),o.viewpoints.add(v.guid)},m=()=>{e({linking:!0})},g=w`<bim-button style="flex: 0" @click=${p} .disabled=${!n} icon="mi:add"></bim-button>`,f=w`<bim-button style="flex: 0" @click=${m} icon="tabler:link"></bim-button>`;h=w`
      <div style="display: flex; justify-content: right; gap: 0.25rem">
        ${d()}
        <div style="display: flex; justify-content: right; gap: 0.25rem">
          ${r.add?g:null}
          ${r.link?f:null}
        </div>
      </div> 
    `}return w`
    <div style="display: flex; flex-direction: column; gap: 0.5rem;">
      ${h}
      ${u}
      ${l}
    </div> 
  `},D$=t=>be.create(Xp,t),R$=Object.freeze(Object.defineProperty({__proto__:null,topicViewpoints:D$,topicViewpointsSectionTemplate:Xp},Symbol.toStringTag,{value:"Module"}));({...I$,...L$,...z$,...R$});const j$=t=>w`
    <bim-panel-section fixed label="New Topic" name="topic">
      ${zp(t)}
    </bim-panel-section>
  `,N$=t=>be.create(j$,t),B$=Object.freeze(Object.defineProperty({__proto__:null,topic:N$},Symbol.toStringTag,{value:"Module"}));({...B$});let $l=[],Pr=null;const F$=wo.prototype.intersectObjects,U$=wo.prototype.intersectObject,Bn=(t,e,i=1e-6)=>{for(const o of t)if(o.distanceToSquared(e)<=i)return;t.push(e)},H$=()=>{const t=[];try{const e=k?.renderer?.three?.clippingPlanes;if(Array.isArray(e))for(const i of e)i?.normal&&t.push(i)}catch{}return t},V$=(t,e)=>{if(!t||t.length<3)return[];const i=H$();if(i.length===0)return[];const o=[[t[0],t[1]],[t[1],t[2]],[t[2],t[0]]],n=[],s=.02;for(const r of i){if(e&&Math.abs(r.distanceToPoint(e))>.2)continue;const a=[];for(const[l,c]of o){const d=r.distanceToPoint(l),u=r.distanceToPoint(c);if(Math.abs(d)<=s&&Bn(a,l.clone()),Math.abs(u)<=s&&Bn(a,c.clone()),d*u<0){const h=d/(d-u),p=l.clone().lerp(c,h);Bn(a,p)}}for(const l of a)Bn(n,l)}return n},q$=t=>{const e=t.attributes.position;if(!e)return null;const i=t.userData.__snapTriangleCache||null;if(i)return i;const o=[],n=new Map,s=l=>new ee().fromBufferAttribute(e,l),r=(l,c,d)=>{const u=s(l),h=s(c),p=s(d),m=new ee().subVectors(h,u).cross(new ee().subVectors(p,u));if(m.lengthSq()<1e-12)return;m.normalize();const g=m.dot(u),f=o.length;o.push({indices:[l,c,d],normal:m,constant:g});for(const v of[l,c,d]){const y=n.get(v)||[];y.push(f),n.set(v,y)}};if(t.index){const l=t.index;for(let c=0;c<l.count;c+=3)r(l.getX(c),l.getX(c+1),l.getX(c+2))}else for(let l=0;l<e.count;l+=3)r(l,l+1,l+2);const a={triangles:o,vertexToTriangles:n};return t.userData.__snapTriangleCache=a,a},Zp=t=>{if(!t.face)return[];const e=t.object?.geometry,i=e?.attributes?.position;if(!e||!i)return[];const o=q$(e);if(!o)return[];const n=[t.face.a,t.face.b,t.face.c],s=o.triangles.find(p=>p.indices[0]===n[0]&&p.indices[1]===n[1]&&p.indices[2]===n[2])||o.triangles.find(p=>{const m=new Set(p.indices);return n.every(g=>m.has(g))});if(!s)return[];const r=[],a=new Set;for(const p of s.indices){const m=o.vertexToTriangles.get(p)||[];r.push(...m)}const l=.999,c=1e-4,d=new Set;for(;r.length>0;){const p=r.pop();if(a.has(p))continue;a.add(p);const m=o.triangles[p];if(m&&!(Math.abs(m.normal.dot(s.normal))<l)&&!(Math.abs(m.constant-s.constant)>c))for(const g of m.indices){d.add(g);const f=o.vertexToTriangles.get(g)||[];for(const v of f)a.has(v)||r.push(v)}}const u=[],h=p=>{const m=new ee().fromBufferAttribute(i,p);if(t.object instanceof Ht&&t.instanceId!==void 0){const g=new ki;t.object.getMatrixAt(t.instanceId,g),m.applyMatrix4(g)}return t.object.updateMatrixWorld(),m.applyMatrix4(t.object.matrixWorld),m};for(const p of d)Bn(u,h(p));return u},_l=t=>{if(!t||t.length===0)return t;const e=t.find(i=>i.object instanceof zt||i.object instanceof Ht);if(!e)return t;try{if(e.face&&e.object.geometry){const s=e.object.geometry.attributes.position;if(s){const r=e.face.a,a=e.face.b,l=e.face.c,c=y=>{const b=new ee;if(b.fromBufferAttribute(s,y),e.object instanceof Ht&&e.instanceId!==void 0){const $=new ki;e.object.getMatrixAt(e.instanceId,$),b.applyMatrix4($)}return e.object.updateMatrixWorld(),b.applyMatrix4(e.object.matrixWorld),b},d=c(r),u=c(a),h=c(l),p=Zp(e);let m=null,g=1/0,f="";if((p.length>0?p:[d,u,h]).forEach(y=>{const b=y.distanceTo(e.point);b<g&&(g=b,m=y,f="VERTEX")}),g>.18){const y=[new Gi(d,u),new Gi(u,h),new Gi(h,d)];let b=1/0,$=null;y.forEach(C=>{const E=new ee;C.closestPointToPoint(e.point,!0,E);const A=E.distanceTo(e.point);A<b&&(b=A,$=E)}),b<.08?(m=$,g=b,f="EDGE"):m=null}m?(e.point.copy(m),window.debugSphere&&(window.debugSphere.position.copy(m),window.debugSphere.visible=!0,f==="VERTEX"?(window.debugSphere.material.color.setHex(65280),window.debugSphere.scale.set(1,1,1)):(window.debugSphere.material.color.setHex(16776960),window.debugSphere.scale.set(.5,.5,.5))),window.debugLog&&Math.random()<.05&&window.debugLog(`Snap: ${f} (${g.toFixed(3)})`)):window.debugSphere&&(window.debugSphere.visible=!1)}}}catch(i){console.error("Snap Error",i)}return t};wo.prototype.intersectObjects=function(t,e,i){const o=F$.call(this,t,e,i);return _l(o)};wo.prototype.intersectObject=function(t,e,i){const o=U$.call(this,t,e,i);return _l(o)};let Se=null,ge=null,St=null,D=[],G=null;const va=[],Is=[];let ye=null;const G$=ee.prototype.fromBufferAttribute;ee.prototype.fromBufferAttribute=function(t,e){try{return!t||t.isBufferAttribute&&!t.array?this.set(0,0,0):G$.call(this,t,e)}catch{return this.set(0,0,0)}};const W$=Ht.prototype.raycast;Ht.prototype.raycast=function(t,e){try{if(!this.geometry)return;W$.call(this,t,e)}catch{}};const Y$=Ut.prototype.getX;Ut.prototype.getX=function(t){if(!this.array||this.array.length===0)return 0;try{return Y$.call(this,t)}catch{return 0}};const X$=Ut.prototype.getY;Ut.prototype.getY=function(t){if(!this.array||this.array.length===0)return 0;try{return X$.call(this,t)}catch{return 0}};const Z$=Ut.prototype.getZ;Ut.prototype.getZ=function(t){if(!this.array||this.array.length===0)return 0;try{return Z$.call(this,t)}catch{return 0}};const J$=vn.prototype.getX;vn.prototype.getX=function(t){try{return!this.data||!this.data.array?0:J$.call(this,t)}catch{return 0}};const K$=vn.prototype.getY;vn.prototype.getY=function(t){try{return!this.data||!this.data.array?0:K$.call(this,t)}catch{return 0}};const Q$=vn.prototype.getZ;vn.prototype.getZ=function(t){try{return!this.data||!this.data.array?0:Q$.call(this,t)}catch{return 0}};const e_=zt.prototype.raycast;zt.prototype.raycast=function(t,e){try{if(!this.geometry)return;e_.call(this,t,e)}catch{}};const t_=hi.prototype.raycast;hi.prototype.raycast=function(t,e){try{if(!this.geometry)return;t_.call(this,t,e)}catch{}};const i_=xa.prototype.raycast;xa.prototype.raycast=function(t,e){try{if(!this.geometry)return;i_.call(this,t,e)}catch{}};const Jp=()=>{const t=zt.prototype;if(t.acceleratedRaycast&&!t._patchedAcceleratedRaycast){const e=t.acceleratedRaycast;t.acceleratedRaycast=function(i,o){try{if(!this.geometry||!this.geometry.attributes.position)return;this.geometry.boundingSphere||this.geometry.computeBoundingSphere(),e.call(this,i,o)}catch{}},t._patchedAcceleratedRaycast=!0,console.log("[Fix] Patched acceleratedRaycast successfully")}};Jp();setTimeout(Jp,1e3);window.addEventListener("error",t=>{const e=document.createElement("div");e.style.position="fixed",e.style.top="10px",e.style.left="10px",e.style.background="rgba(255, 0, 0, 0.9)",e.style.color="white",e.style.padding="15px",e.style.zIndex="10000",e.style.borderRadius="5px",e.style.fontFamily="monospace",e.style.maxWidth="80%",e.style.wordBreak="break-all",e.innerHTML=`<strong>Error Critical:</strong><br>${t.message}<br><small>${t.filename}:${t.lineno}</small>`,document.body.appendChild(e),console.error("Global Error Caught:",t.error)});const ae=new vf;ae.meshes||(ae.meshes=[]);const n_=ae.get(Ds),k=n_.create();k.scene=new $a(ae);k.scene.setup();k.scene.three.background=new as(2105376);const vo=document.getElementById("viewer-container");k.renderer=new Ad(ae,vo);k.camera=new _a(ae);k.camera.threePersp.near=.05;k.camera.threePersp.updateProjectionMatrix();k.camera.threeOrtho.near=.05;k.camera.threeOrtho.updateProjectionMatrix();ae.init();Ws.init();const Kp=ae.get(kd);Kp.create(k);const xl="./",o_=new Sa(.5,32,32),s_=new $i({color:16711680,depthTest:!1,transparent:!0,opacity:.8});Se=new zt(o_,s_);window.debugSphere=Se;Se.renderOrder=999;Se.visible=!1;k.scene.three.add(Se);vo.addEventListener("mousemove",t=>{if(!k||!k.camera||!k.scene)return;const e=vo.getBoundingClientRect(),i=(t.clientX-e.left)/e.width*2-1,o=-((t.clientY-e.top)/e.height)*2+1,n=new wo;n.setFromCamera(new zs(i,o),k.camera.three);const s=[];if(k.scene.three.traverse(a=>{(a instanceof zt||a instanceof Ht)&&s.push(a)}),s.length===0)return;const r=n.intersectObjects(s,!0);r.length>0?_l([r[0]]):Se&&(Se.visible=!1)});const xd=document.getElementById("debug-console");xd?(xd.style.display="none",window.debugLog=()=>{}):window.debugLog=()=>{};const F=ae.get(nt);try{await F.init(`${xl}fragments/fragments.mjs`)}catch(t){throw console.error("Critical Error: Fragments init failed",t),new Error(`Fragments init failed: ${t}`)}const Bt=ae.get(wf),Te=ae.get($f),Qp="2026-02-27-LocalPersistence-Fix";console.warn(`VSR_IFC Version: ${Qp}`);const Ed=document.getElementById("version-display");Ed&&(Ed.innerText=`v${Qp}`);const r_=ae.get(_f),De=r_.get(k),a_=De.castRayToObjects.bind(De),Ps=t=>{if(!t||!t.point)return Se&&(Se.visible=!1),t;try{if(t.face&&(t.object instanceof zt||t.object instanceof Ht)){const n=t.object.geometry;if(!n||!n.attributes.position)return t;const s=n.attributes.position,r=[t.face.a,t.face.b,t.face.c],a=y=>{const b=new ee;if(y>=0&&y<s.count){if(b.fromBufferAttribute(s,y),t.object instanceof Ht&&t.instanceId!==void 0){const $=new ki;t.object.getMatrixAt(t.instanceId,$),b.applyMatrix4($)}t.object.updateMatrixWorld(),b.applyMatrix4(t.object.matrixWorld)}return b},l=a(r[0]),c=a(r[1]),d=a(r[2]),u=Zp(t),h=u.length>0?u:[l,c,d],p=V$(h.slice(0,3),t.point);let m=null,g=.08;for(const y of p){const b=y.distanceTo(t.point);b<g&&(g=b,m=y)}let f=null,v=.12;for(const y of h){const b=y.distanceTo(t.point);b<v&&(v=b,f=y)}if(m&&g<=.08)return t.point.copy(m),t;if(f&&v<=.12)t.point.copy(f),typeof Se<"u"&&(Se.position.copy(f),Se.visible=!0,Se.material.color.setHex(65280),Se.scale.set(.8,.8,.8)),window.debugLog&&window.debugLog(`SNAP! Vertex (Dist: ${v.toFixed(3)})`);else{const y=[new Gi(l,c),new Gi(c,d),new Gi(d,l)];let b=1/0,$=null;for(const C of y){const E=new ee;C.closestPointToPoint(t.point,!0,E);const A=E.distanceTo(t.point);A<b&&(b=A,$=E)}$&&b<=.025&&t.point.copy($),typeof Se<"u"&&(Se.visible=!1)}}}catch(e){console.warn("Snapping failed:",e),window.debugLog&&window.debugLog(`Snap Error: ${e}`)}return t};De.castRayToObjects=(t,e)=>{const i=a_(t,e);return Ps(i)};if(De.castRay){const t=De.castRay.bind(De);De.castRay=e=>{const i=t(e);return i&&typeof i.then=="function"?i.then(o=>Ps(o)):Ps(i)}}if(De.castRayFromVector){const t=De.castRayFromVector.bind(De);De.castRayFromVector=(e,i,o)=>{const n=t(e,i,o);return Ps(n)}}const l_=Te.set.bind(Te);Te.set=async(t,e)=>{if(await l_(t,e),e&&Object.keys(e).length>0)sf(e,t);else if(t)for(const i in Be)delete Be[i]};const c_=Te.isolate.bind(Te);Te.isolate=async t=>{await c_(t);try{console.warn("[DEBUG] Global Isolate Triggered. Syncing hiddenItems..."),console.log("[DEBUG] Selection keys:",Object.keys(t));for(const[e,i]of F.list){const o=await i.getItemsIdsWithGeometry(),n=new Set;for(const[a,l]of Object.entries(t)){let c=a===e;if(c||(i.items&&i.items.length>0?c=i.items.some(d=>d.id===a):i.children&&i.children.length>0&&(c=i.children.some(d=>d.uuid===a))),c){console.log(`[DEBUG] Fragment ${a} belongs to model ${e}`);const d=l instanceof Set||Array.isArray(l)?l:[];for(const u of d)n.add(u)}}Be[e]||(Be[e]=new Set);const s=Be[e];s.clear();let r=0;for(const a of o)n.has(a)||(s.add(a),r++);console.log(`[DEBUG] Model ${e}: Total ${o.size}, Visible ${n.size}, Hidden ${r}`)}}catch(e){console.error("Error updating hidden items during global isolate:",e)}};const Q=ae.get(xf);Q.material=new $i({color:13621468,side:jr,shadowSide:jr,opacity:.2,transparent:!0});const br=ae.get(Ef);br.enabled=!0;br.world=k;const d_=new $i({color:13621468,side:jr}),ef=new If({color:3355443,linewidth:2,resolution:new zs(window.innerWidth,window.innerHeight)});window.addEventListener("resize",()=>{const t=window.innerWidth,e=window.innerHeight;ef.resolution.set(t,e)});br.styles.set("filled",{fillsMaterial:d_,linesMaterial:ef});Q.onAfterCreate.add(t=>{console.log("[DEBUG] Clipper Plane Created:",t);let e="";for(const[i,o]of Q.list)if(o===t){e=i;break}if(console.log("[DEBUG] Found Plane ID:",e),e)try{console.log('[DEBUG] Applying ClipStyle "filled" to all items...'),br.createFromClipping(e,{world:k,items:{all:{style:"filled"}}}),console.log("[DEBUG] ClipStyle applied successfully.")}catch(i){console.error("[DEBUG] Failed to apply ClipStyle:",i)}else console.warn("[DEBUG] Could not find Plane ID in clipper.list")});Q.onAfterDelete.add(t=>{});const ze=ae.get(Ns);ze.setup({world:k,select:{name:"select",material:new $i({color:13829212,depthTest:!1,opacity:.8,transparent:!0})},hover:{name:"hover",material:new $i({color:14737632,depthTest:!1,opacity:.4,transparent:!0})}});ze.enabled=!0;try{O_()}catch(t){console.error("Error setting up visibility toolbar:",t)}try{I_()}catch(t){console.error("Error setting up measurement tools:",t),console.warn("Measurement tools failed to initialize")}const tf=ae.get(Ea),wa=new URL(window.location.href),u_=wa.pathname.substring(0,wa.pathname.lastIndexOf("/")+1),nf=`${wa.origin}${u_}wasm/`;console.log("[DEBUG] Computed WASM Path:",nf);console.log("[DEBUG] Cross-Origin Isolated:",window.crossOriginIsolated?"Yes":"No (SharedArrayBuffer restricted)");tf.setup({wasm:{path:nf,absolute:!0,logLevel:2},autoSetWasm:!1,webIfc:{COORDINATE_TO_ORIGIN:!0,USE_FAST_BOOLS:!1}});window.testIFC=async()=>{try{S("Starting IFC conversion test...");const t=ae.get(Ea);S("Fetching temp.ifc...");const e=await fetch(`${xl}temp.ifc`);if(!e.ok)throw new Error("Failed to fetch temp.ifc");const i=await e.arrayBuffer(),o=new Uint8Array(i);S(`IFC loaded (Size: ${(o.length/1024/1024).toFixed(2)} MB). Processing...`);const n=await t.load(o,!0,"temp_model");S("IFC conversion complete!");let s=0;n.object.traverse(l=>{l.isMesh&&s++}),S(`Converted Model meshes: ${s}`),k.scene.three.add(n.object),S("Added converted model to scene");const r=new en().setFromObject(n.object),a=new _i;r.getBoundingSphere(a),k.camera.controls.fitToSphere(a,!0)}catch(t){S(`IFC Test Failed: ${t}`,!0),console.error(t)}};k.camera.controls.addEventListener("rest",()=>{F.core.update(!0)});function h_(t){const s=((t.split("/").pop()??t).split("?")[0].replace(/\.(ifc|frag)$/i,"").split("_")[3]??"").trim();return s?s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()==="desagues"?"Desagües":s:"General"}const We=new Map;function S(t,e=!1){e?console.error(t):console.log(t)}function p_(t){!t||!t.items||console.log(`[DEBUG] Skipped static edge generation for ${t.uuid} (using dynamic snapping)`)}const f_="VSR_IFC_Storage",yn="models";let Lr=null;function of(){return Lr||(Lr=new Promise((t,e)=>{const i=indexedDB.open(f_,1);i.onupgradeneeded=o=>{const n=o.target.result;n.objectStoreNames.contains(yn)||n.createObjectStore(yn)},i.onsuccess=()=>t(i.result),i.onerror=()=>e(i.error)})),Lr}async function m_(t,e){try{const i=await of();return new Promise((o,n)=>{const a=i.transaction(yn,"readwrite").objectStore(yn).put(e,t);a.onsuccess=()=>o(),a.onerror=()=>n(a.error)})}catch(i){console.warn("IndexedDB save failed:",i)}}async function b_(t){try{const e=await of();return new Promise((i,o)=>{const r=e.transaction(yn,"readonly").objectStore(yn).get(t);r.onsuccess=()=>i(r.result),r.onerror=()=>o(r.error)})}catch(e){console.warn("IndexedDB load failed:",e);return}}async function El(t,e){rf();try{S(`Fetching Fragment: ${t}`);const i=await fetch(t);if(!i.ok)throw new Error(`Failed to fetch ${t}`);let o=await i.arrayBuffer(),n=new Uint8Array(o);S(`Fetched ${(o.byteLength/1024/1024).toFixed(2)} MB`);const s=n[0]===31&&n[1]===139;S(`Compression: ${s?"GZIP":"Uncompressed"}`);let r;try{r=await F.core.load(n,{modelId:e})}catch(f){if(console.warn("Direct load failed, attempting manual decompression/handling...",f),s&&"DecompressionStream"in window)try{S("Attempting manual decompression...");const v=new DecompressionStream("gzip"),y=v.writable.getWriter();y.write(new Uint8Array(o)),y.close();const $=await new Response(v.readable).arrayBuffer(),C=new Uint8Array($);S(`Decompressed size: ${($.byteLength/1024/1024).toFixed(2)} MB`),r=await F.core.load(C,{modelId:e})}catch(v){throw new Error(`Manual decompression failed: ${v}`)}else throw f}if(!r)throw new Error("Model failed to load (undefined result)");F.groups instanceof Map?F.groups.set(r.uuid,r):F.groups&&(F.groups[r.uuid]=r),r.name=e.split("/").pop()||"Model",r.userData||(r.userData={}),r.userData.url=t,console.log(`[Viewpoints] Registered model URL for persistence: ${r.uuid} -> ${t}`),r.uuid!==e&&(r.uuid=e,console.log(`[DEBUG] Forced model UUID to match path: ${r.uuid}`)),r.useCamera(k.camera.three),k.scene.three.add(r.object),r.object.traverse(f=>{f.isMesh&&(k.meshes.add(f),ae.meshes&&Array.isArray(ae.meshes)&&ae.meshes.push(f))}),await F.core.update(!0);let a=!1,l=!1,c=0;r.object.traverse(f=>{f.isMesh&&f.geometry&&(c++,f.geometry.attributes.normal&&(a=!0),f.geometry.attributes.position&&(l=!0))}),console.log(`%c[VERIFICATION] Model Analysis for ${e}`,"color: cyan; font-weight: bold; font-size: 14px;"),console.log(`[VERIFICATION] Meshes checked: ${c}`),console.log(`[VERIFICATION] Position (Geometry): ${l?"YES":"NO"}`),console.log(`[VERIFICATION] Normals: ${a?"YES":"NO"}`),a?(console.log("%c[VERIFICATION] Contours/Edges capability: YES (Normals found)","color: lime;"),S("Model verification: Normals found. Snapping fully enabled.")):(console.warn("[VERIFICATION] Normals MISSING. Snapping may be limited."),S("Model verification: Normals MISSING. Snapping limited.",!0)),We.set(e,r),p_(r);const d=r;let u=d.properties&&Object.keys(d.properties).length>0,h=!1;d.data&&(d.data instanceof Map?h=d.data.size>0:h=Object.keys(d.data).length>0),S(`Model loaded. Properties: ${u}, Data: ${h}`),console.log("[DEBUG] Model Keys:",Object.keys(d));const p=t.replace(/\.frag$/i,".json");try{S(`Checking for external properties at ${p}...`);const f=await fetch(p);if(f.ok){const v=await f.json();v&&Object.keys(v).length>0&&(d.properties=v,u=!0,S(`Loaded external properties from JSON (${Object.keys(v).length} items). Overriding embedded properties.`))}else u||S(`Properties file not found at ${p} (Status: ${f.status}).`)}catch(f){console.error("Error fetching properties JSON:",f),u||S("Error loading external properties.",!0)}if((!d.types||Object.keys(d.types).length===0)&&u){S("Reconstructing model.types from properties..."),d.types={};let f=0;for(const v in d.properties){const y=d.properties[v];if(y&&y.type){const b=y.type;d.types[b]||(d.types[b]=[]),d.types[b].push(Number(v)),f++}}S(`Reconstructed ${Object.keys(d.types).length} types covering ${f} items.`)}if(!u&&(console.warn("[DEBUG] Model has no properties attached! attempting to check data..."),!d.properties||Object.keys(d.properties).length===0))try{S("Generating dummy properties for missing metadata...");const f=await r.getItemsIdsWithGeometry(),v={};for(const y of f)v[y]={expressID:y,type:4065,GlobalId:{type:1,value:`generated-${y}`},Name:{type:1,value:`Element ${y}`}};d.properties=v,u=!0,S(`Generated fallback properties for ${f.length} items.`)}catch(f){S(`Failed to generate fallback properties: ${f}`,!0)}if(!d.data||d.data instanceof Map&&d.data.size===0){S("Reconstructing missing model.data from geometry items..."),d.data||(d.data=new Map);let f=!1;if(d.keyFragments&&d.keyFragments instanceof Map&&d.keyFragments.size>0){S(`Found keyFragments map with ${d.keyFragments.size} entries.`);for(const[y,b]of d.keyFragments.entries())d.data.set(Number(y),[b,Number(y)]);f=!0,S("Reconstructed model.data from keyFragments.")}let v=[];if(!f)if(r.items&&Array.isArray(r.items)&&r.items.length>0?(console.log(`[DEBUG] Found ${r.items.length} fragments in model.items`),v=r.items):(console.log("[DEBUG] model.items empty or missing, traversing model.object for meshes..."),r.object&&r.object.traverse(y=>{y.isMesh&&v.push(y)}),v.length===0&&d._itemsManager&&d._itemsManager.list&&(console.log("[DEBUG] Trying to recover from _itemsManager..."),d._itemsManager.list.forEach(y=>v.push(y)))),v.length>0){S(`Found ${v.length} fragments/meshes. Scanning for items...`);let y=0;for(const b of v){let $=b.items||b.ids;if(!$&&b.fragment&&($=b.fragment.items||b.fragment.ids),!$&&b.userData&&b.userData.ids&&($=b.userData.ids),$){const C=Array.isArray($)?$:Array.from($),E=b.uuid||(b.fragment?b.fragment.uuid:null);if(C.length>0&&E)for(const A of C)d.data.set(Number(A),[E,Number(A)]),y++}else{const C=b.geometry;if(C&&C.attributes&&C.attributes.expressID){const E=C.attributes.expressID,A=E.count,P=new Set;for(let O=0;O<A;O++)P.add(E.getX(O));const M=b.uuid||(b.fragment?b.fragment.uuid:null);if(M)for(const O of P)d.data.set(Number(O),[M,Number(O)]),y++}}}if(S(`Reconstructed model.data with ${y} entries from ${v.length} fragments.`),y===0){S("WARNING: Could not find items on fragments directly. Using fallback mapping to first fragment.",!0);const b=v[0],$=b.uuid;b.ids||(b.ids=new Set),b.items||(b.items=b.ids);try{const C=await r.getItemsIdsWithGeometry();for(const E of C){const A=Number(E);d.data.has(A)||(d.data.set(A,[$,A]),b.ids.add(A),Array.isArray(b.items)&&b.items.push(A),y++)}S(`Fallback applied: Mapped ${y} items to main fragment.`)}catch(C){S(`Fallback failed: ${C}`,!0)}}if(d.data.size>0){const b=d.data.keys().next().value;console.log(`[DEBUG] Sample model.data entry: Key=${b} Val=`,d.data.get(b))}if(d.types&&Object.keys(d.types).length>0){console.log(`[DEBUG] model.types found with ${Object.keys(d.types).length} types.`);const b=new Set;for(const E in d.types){const A=d.types[E];Array.isArray(A)&&A.forEach(P=>b.add(P))}const $=new Set(d.data.keys());let C=0;for(const E of b)$.has(E)&&C++;if(console.log(`[DEBUG] Type IDs: ${b.size}, Geometry IDs: ${$.size}, Match: ${C}`),(C===0||C<b.size*.5)&&b.size>0){S(`Syncing ${b.size-C} missing items for classification...`);const E=v[0],A=E.uuid;E.ids||(E.ids=new Set),E.items||(E.items=E.ids);let P=0;for(const M of b)d.data.has(M)||(d.data.set(M,[A,M]),E.ids.add(M),Array.isArray(E.items)&&E.items.push(M),P++);S(`Sync complete: ${P} items added.`)}}}else S("Cannot reconstruct model.data: No meshes found in model.object!",!0),d._itemsManager&&console.log("[DEBUG] _itemsManager:",d._itemsManager)}console.log("[DEBUG] Fragments List Keys:",Array.from(F.list.keys()));const m=F.list.has(r.uuid);if(console.log(`[DEBUG] Model registered in fragments.list: ${m} (UUID: ${r.uuid})`),!m){console.log("[DEBUG] Manually registering model in fragments manager...");try{F.list.set(r.uuid,r),console.log("[DEBUG] Manual registration successful")}catch(f){console.error("[DEBUG] Manual registration failed:",f),S(`Warning: Failed to register model: ${f}`,!0)}}if(u)try{console.log(`[DEBUG] Running classifyByFamily() for model ${r.uuid}`),await rs(r),await os(),S("Classification updated");const f=document.querySelector('.tab-btn[data-tab="classification"]');f&&(f.click(),S("Switched to Classification tab."))}catch(f){S(`Classification error: ${f}`,!0)}else{S("Skipping classification (no properties)",!0);const f=document.getElementById("classification-list");f&&(f.innerHTML='<div style="padding: 20px; text-align: center; color: #888;">Sin propiedades para clasificar</div>')}S("Model loaded successfully as Fragments");let g=0;if(r.object.traverse(f=>{f.isMesh&&g++}),S(`Model meshes: ${g}`),setTimeout(async()=>{try{const f=await r.getItemsIdsWithGeometry();S(`Deferred check - items with geometry: ${f.length}`);let v=0;r.object.traverse(y=>{y.isMesh&&v++}),S(`Deferred check - meshes in scene: ${v}`)}catch(f){S(`Deferred geometry check failed: ${f}`,!0)}},5e3),We.size===1){const f=new en().setFromObject(r.object),v=new _i;f.getBoundingSphere(v),S(`BBox: min(${f.min.x.toFixed(2)}, ${f.min.y.toFixed(2)}, ${f.min.z.toFixed(2)}) max(${f.max.x.toFixed(2)}, ${f.max.y.toFixed(2)}, ${f.max.z.toFixed(2)}) Radius: ${v.radius.toFixed(2)}`),v.radius>.1?(k.camera.controls.fitToSphere(v,!0),S("Camera centered on model")):S("Model bounds too small or empty - Camera not moved",!0)}return r}catch(i){throw S(`Error loading model: ${i}`,!0),console.error(i),i}}function g_(){const t=document.querySelectorAll(".tab-btn"),e=document.querySelectorAll(".tab-content");t.length===0?console.warn("No sidebar tabs found during initialization"):console.log(`Initialized ${t.length} sidebar tabs`),t.forEach(i=>{i.addEventListener("click",()=>{t.forEach(s=>s.classList.remove("active")),e.forEach(s=>{s.classList.remove("active"),s.style.display="none"}),i.classList.add("active");const o=i.getAttribute("data-tab"),n=document.getElementById(`tab-${o}`);n&&(n.classList.add("active"),n.style.display="flex")})})}const Be={};function sf(t,e){for(const i in t){let o=i;if(!F.list.has(i)){for(const[a,l]of F.list)if(l.items.some(c=>c.id===i)){o=a;break}}Be[o]||(Be[o]=new Set);const n=Be[o],s=t[i],r=s instanceof Set||Array.isArray(s)?s:[];if(e)for(const a of r)n.delete(a);else for(const a of r)n.add(a)}}const Ft=new Set,it=new Set,gi=new Set;let Qi="Todos";const Ui=new Set,ut=new Set;function rf(){Ft.clear(),it.clear(),gi.clear(),Qi="Todos",Ui.clear(),ut.clear()}const xt=(t,...e)=>{if(!t||typeof t!="object")return null;for(const r of e){const a=t[r];if(a!=null){const l=a&&typeof a=="object"&&"value"in a?a.value:a;if(l!=null&&String(l).trim()!=="")return String(l).trim()}}const i=[t],o=new Set;let n=0;const s=1e3;for(;i.length>0&&n<s;){const r=i.shift();if(!(!r||typeof r!="object")&&!o.has(r)){o.add(r),n++;for(const a of e){const l=r[a];if(l!=null){const c=l&&typeof l=="object"&&"value"in l?l.value:l;if(c!=null&&String(c).trim()!=="")return String(c).trim()}}for(const a in r){if(a==="ObjectPlacement"||a==="Representation"||a==="OwnerHistory")continue;const l=r[a];l&&typeof l=="object"&&i.push(l)}}}return null},Mr=t=>{if(t==null)return 0;if(typeof t=="number")return Number.isFinite(t)?t:0;const e=String(t).trim();if(!e||e==="-")return 0;const i=e.replace(/\s/g,"").replace(",",".").replace(/[^\d.\-]/g,""),o=parseFloat(i);return Number.isFinite(o)?o:0};function Sl(){const t=[];for(const[e,i]of We.entries()){const o=i;if(o.properties)for(const n of Object.keys(o.properties)){const s=parseInt(n,10);if(isNaN(s))continue;const r=o.properties[n];if(!r||typeof r!="object")continue;const a=xt(r,"type","ifcType","Category","ObjectType","CLASIFICACIÓN","Clasificación","CLASIFICACION","clasificacion","CATEGORÍA","CATEGORIA","Categoría","categoria","TIPO","Tipo","tipo","DETALLE","Detalle","detalle")||"Elemento",l=xt(r,"NOMBRE INTEGRADO","Nombre Integrado","nombre integrado","Name","name")||`${a} - ${s}`,c=xt(r,"CLASIFICACIÓN","Clasificación","CLASIFICACION","clasificacion")||"SIN CLASIFICAR",d=xt(r,"NIVEL INTEGRADO","Nivel Integrado","nivel integrado","Nivel","nivel")||"SIN NIVEL",u=xt(r,"MATERIAL INTEGRADO","Material Integrado","material integrado")||"SIN MATERIAL",h=Mr(xt(r,"VOLUMEN INTEGRADO","Volumen","Volume","Volume integrado","Volumen integrado")),p=Mr(xt(r,"ÁREA INTEGRADO","Area","Area integrado","Área","Área integrado","AREA INTEGRADO")),m=Mr(xt(r,"LONGITUD INTEGRADO","Longitud","Length","Longitud integrado","Longitud integrado")),g=xt(r,"Tamaño","TAMAÑO","TAMANO","Diametro","diametro","Tamao")||"",f=[a,l,c,d,u,g].join(" ").toLowerCase(),v=f.includes("fitting")||f.includes("conduitfitting")||f.includes("cablecarrierfitting")||f.includes("union")||f.includes("codo")||f.includes("tee")||f.includes("reducc")||f.includes("caja")||f.includes("accesorio")||f.includes("adaptador")||f.includes("copla"),y=(f.includes("pipe")||f.includes("conduit")||f.includes("cablecarrier")||f.includes("tuber")||f.includes("tubo")||f.includes("conduit")||f.includes("canalizacion")||f.includes("canalización")||f.includes("coraza")||f.includes("ducto")||f.includes("bandeja"))&&!v;t.push({modelUUID:e,expressID:s,id:String(s),name:l,category:a,classification:c,level:d,material:u,volume:h,area:p,length:m,diameter:g,isPipe:y,isUnion:v})}}return t}function af(){return Sl().some(e=>{const i=[e.classification,e.category,e.name,e.diameter].join(" ").toLowerCase();return i.includes("tuber")||i.includes("tubo")||i.includes("union de tuberia")||i.includes("uniones de tuberia")||i.includes("ifcpipesegment")||i.includes("ifcflowsegment")||i.includes("ifcpipefitting")||i.includes("ifcflowfitting")||i.includes("pipesegment")||i.includes("pipefitting")||i.includes("conduit")||i.includes("ifcconduit")||i.includes("canalizacion")||i.includes("canalización")||i.includes("coraza")||i.includes("ducto")||i.includes("bandeja")||i.includes("canaleta")||i.includes("ifccablecarrier")||i.includes("cablecarrier")})}function y_(){const t=Sl(),e=new Map,i=new Set,o=new Set;for(const l of t){const c=l.classification||"SIN CLASIFICAR",d=l.name||"Sin Categoría";e.has(c)||e.set(c,new Set),e.get(c).add(d),l.level&&l.level!=="SIN NIVEL"&&i.add(l.level),l.diameter&&l.diameter.trim()!==""&&o.add(l.diameter)}const n=[];for(const[l,c]of e.entries())n.push({name:l,categories:Array.from(c).sort((d,u)=>d.localeCompare(u,"es"))});n.sort((l,c)=>l.name.localeCompare(c.name,"es"));const s=Array.from(i).sort((l,c)=>{const d=p=>{const m=p.match(/\d+/);return m?parseInt(m[0],10):1/0},u=d(l),h=d(c);return u!==h?u-h:l.localeCompare(c,"es")}),r=l=>{const c=Number(String(l).replace(",",".").replace(/[^\d.\-]/g,""));return Number.isFinite(c)?c:null},a=Array.from(o).sort((l,c)=>{const d=r(l),u=r(c);return d!==null&&u!==null?d-u:d!==null?-1:u!==null?1:l.localeCompare(c,"es")});return{tree:n,levels:s,diameters:a}}async function Nn(){const t=Sl();if(t.length===0)return;const e=af(),i=t.filter(l=>{const c=Ft.size===0||Ft.has(l.classification),d=it.size===0||it.has(l.name),u=gi.size===0||gi.has(l.level),h=!e||Qi==="Todos"||l.diameter===Qi;return c&&d&&u&&h}),o=new Set(i.map(l=>l.id)),n={},s={};let r=!1,a=!1;for(const l of t){const c=l.modelUUID,d=l.expressID;o.has(l.id)?(n[c]||(n[c]=new Set),n[c].add(d),r=!0):(s[c]||(s[c]=new Set),s[c].add(d),a=!0)}r&&await Te.set(!0,n),a&&await Te.set(!1,s)}function ht(t){const{tree:e,levels:i,diameters:o}=y_(),n=af();t.innerHTML="";const s=document.createElement("div");s.style.display="flex",s.style.flexDirection="column",s.style.gap="15px",s.style.padding="10px";const r=document.createElement("button");r.className="filter-reset-btn",r.innerHTML='<i class="fa-solid fa-filter-circle-xmark"></i> Limpiar Filtros',r.addEventListener("click",async()=>{rf(),ht(t),await Nn()}),s.appendChild(r);const a=document.createElement("div");a.className="filter-section";const l=document.createElement("div");l.className="filter-section-header";const c=ut.has("classification");c&&l.classList.add("collapsed"),l.innerHTML=`
        <span>Clasificación / Categoría</span>
        <i class="fa-solid fa-chevron-down"></i>
    `,l.addEventListener("click",()=>{c?ut.delete("classification"):ut.add("classification"),ht(t)}),a.appendChild(l);const d=document.createElement("div");d.className="filter-section-content",c&&d.classList.add("collapsed");for(const u of e){const h=document.createElement("div");h.className="filter-tree-node";const p=u.categories.every(E=>it.has(E)),m=u.categories.some(E=>it.has(E)),g=Ft.has(u.name)||p,f=Ui.has(u.name),v=document.createElement("div");v.className="filter-tree-header";const y=document.createElement("i");y.className=f?"fa-solid fa-chevron-right":"fa-solid fa-chevron-down",y.style.cursor="pointer",y.addEventListener("click",E=>{E.stopPropagation(),f?Ui.delete(u.name):Ui.add(u.name),ht(t)}),v.appendChild(y);const b=document.createElement("input");b.type="checkbox",b.checked=g,b.style.margin="0 5px",b.indeterminate=m&&!p,b.addEventListener("change",async E=>{if(E.target.checked){Ft.add(u.name);for(const P of u.categories)it.add(P)}else{Ft.delete(u.name);for(const P of u.categories)it.delete(P)}ht(t),await Nn()}),v.appendChild(b);const $=document.createElement("span");$.textContent=u.name,$.style.flex="1",$.addEventListener("click",()=>{f?Ui.delete(u.name):Ui.add(u.name),ht(t)}),v.appendChild($),h.appendChild(v);const C=document.createElement("div");C.className="filter-tree-children",f&&C.classList.add("collapsed");for(const E of u.categories){const A=document.createElement("label");A.className="filter-checkbox-item";const P=document.createElement("input");P.type="checkbox",P.checked=it.has(E),P.addEventListener("change",async O=>{O.target.checked?(it.add(E),u.categories.every(z=>it.has(z))&&Ft.add(u.name)):(it.delete(E),Ft.delete(u.name)),ht(t),await Nn()}),A.appendChild(P);const M=document.createElement("span");M.textContent=E,A.appendChild(M),C.appendChild(A)}h.appendChild(C),d.appendChild(h)}if(a.appendChild(d),s.appendChild(a),i.length>0){const u=document.createElement("div");u.className="filter-section";const h=document.createElement("div");h.className="filter-section-header";const p=ut.has("levels");p&&h.classList.add("collapsed"),h.innerHTML=`
            <span>Niveles</span>
            <i class="fa-solid fa-chevron-down"></i>
        `,h.addEventListener("click",()=>{p?ut.delete("levels"):ut.add("levels"),ht(t)}),u.appendChild(h);const m=document.createElement("div");m.className="filter-section-content",p&&m.classList.add("collapsed");const g=document.createElement("div");g.className="levels-grid";for(const f of i){const v=document.createElement("button");v.className="level-filter-btn",gi.has(f)&&v.classList.add("active"),v.textContent=f,v.title=f,v.addEventListener("click",async()=>{gi.has(f)?gi.delete(f):gi.add(f),ht(t),await Nn()}),g.appendChild(v)}m.appendChild(g),u.appendChild(m),s.appendChild(u)}if(n&&o.length>0){const u=document.createElement("div");u.className="filter-section";const h=document.createElement("div");h.className="filter-section-header";const p=ut.has("diameter");p&&h.classList.add("collapsed"),h.innerHTML=`
            <span>Diámetros</span>
            <i class="fa-solid fa-chevron-down"></i>
        `,h.addEventListener("click",()=>{p?ut.delete("diameter"):ut.add("diameter"),ht(t)}),u.appendChild(h);const m=document.createElement("div");m.className="filter-section-content",p&&m.classList.add("collapsed");const g=document.createElement("select");g.className="diameter-select";const f=document.createElement("option");f.value="Todos",f.textContent="Todos",f.selected=Qi==="Todos",g.appendChild(f);for(const v of o){const y=document.createElement("option");y.value=v,y.textContent=v,y.selected=Qi===v,g.appendChild(y)}g.addEventListener("change",async v=>{Qi=v.target.value,await Nn()}),m.appendChild(g),u.appendChild(m),s.appendChild(u)}t.appendChild(s)}async function os(){const t=document.getElementById("classification-list");if(!t)return;t.innerHTML="";let e=!1;for(const o of ss)if((Fn.get(o)?.size??0)>0){e=!0;break}if(e){ht(t);return}if(!Bt||!Bt.list){console.warn("Classifier not ready");return}console.log("[DEBUG] Classifier List Keys:",Array.from(Bt.list.keys()));let i=!1;for(const[o,n]of Bt.list)n.size>0&&(i=!0),console.log(`[DEBUG] Rendering system: ${o} with ${n.size} groups`);if(!i){t.innerHTML='<div style="padding: 20px; text-align: center; color: #888;">No hay clasificación disponible</div>';return}for(const[o,n]of Bt.list){const s=document.createElement("div");s.className="classification-header",s.style.padding="10px 10px 5px 10px",s.style.fontWeight="bold",s.style.color="#e91e63",s.style.borderBottom="1px solid #eee",s.style.marginTop="10px",s.innerHTML=`<i class="fa-solid fa-tags"></i> ${o}`,t.appendChild(s);const r=document.createElement("ul");r.className="folder-items",r.style.padding="10px";for(const[a,l]of n){const c=l.map||l;n.size>0&&!c&&console.error(`[DEBUG] Missing map for ${a}`,l);const d=document.createElement("li");d.className="model-item",d.style.display="flex",d.style.justifyContent="space-between";let u=0;if(c)for(const y in c){const b=c[y];b instanceof Set?u+=b.size:Array.isArray(b)&&(u+=b.length)}const h=u>0?"1":"0.5",p="pointer";d.innerHTML=`
                <div class="model-name" style="cursor: ${p}; flex-grow: 1; opacity: ${h};"><i class="fa-solid fa-layer-group"></i> ${a} <span style="font-size: 0.8em; color: #888;">(${u})</span></div>
                <div class="visibility-toggle" style="cursor: ${p}; padding: 0 10px; opacity: ${h};" title="Toggle Visibility">
                    <i class="fa-regular fa-eye"></i>
                </div>
            `;const m=d.querySelector(".model-name"),g=d.querySelector(".visibility-toggle"),f=g?.querySelector("i");let v=!0;m?.addEventListener("click",async y=>{y.stopPropagation(),console.log(`[DEBUG] Selecting category: ${a} (Count: ${u})`),console.log(`[DEBUG] FragmentIdMap for ${a}:`,c);const b=ae.get(Ns);if(c&&Object.keys(c).length>0){const $=Object.keys(c||{});console.log(`[DEBUG] Map keys: ${$.join(", ")}`);try{const C=!y.ctrlKey&&!y.metaKey,E={};let A=!1;console.log(`[DEBUG] Filtering selection for ${a}. Checking hidden items...`);for(const P in c){const M=F.list.get(P);if(M&&!M.object.visible){console.log(`[DEBUG] Skipping hidden model: ${P}`);continue}const O=c[P],U=new Set,z=Be[P];z?console.log(`[DEBUG] Model ${P} has ${z.size} hidden items tracked.`):(console.warn(`[DEBUG] Model ${P} has NO hidden items tracked in hiddenItems map.`),console.log("[DEBUG] hiddenItems keys:",Object.keys(Be)));const X=O instanceof Set||Array.isArray(O)?O:[];for(const I of X)(!z||!z.has(I))&&U.add(I);U.size>0&&(E[P]=U,A=!0)}A?(b.highlightByID("select",E,C,!0),S(`Seleccionado ${a} (${u} total, selección filtrada por visibilidad)`)):S(`No hay elementos visibles para seleccionar en ${a}`)}catch(C){S(`Error seleccionando ${a}: ${C}`,!0),console.error(C)}}else S(`Cannot select ${a}: No items found (Map is empty)`,!0),console.warn(`[DEBUG] Map is empty for ${a}. GroupData:`,l)}),g?.addEventListener("click",y=>{y.stopPropagation(),v=!v,console.log(`[DEBUG] Toggling visibility for ${a}: ${v}`),c&&Object.keys(c).length>0?(Te.set(v,c),sf(c,v)):console.warn(`[DEBUG] Skipping visibility toggle for ${a} - map is empty`),v?(d.classList.add("visible"),f?.classList.replace("fa-eye-slash","fa-eye"),d.style.opacity="1"):(d.classList.remove("visible"),f?.classList.replace("fa-eye","fa-eye-slash"),d.style.opacity="0.5")}),r.appendChild(d)}t.appendChild(r)}}function v_(){const t=document.getElementById("sidebar"),e=document.getElementById("sidebar-toggle"),i=document.getElementById("sidebar-resizer");if(e&&t&&e.addEventListener("click",()=>{const n=t.classList.toggle("closed");document.body.classList.toggle("sidebar-closed",n)}),i&&t){let n=!1;i.addEventListener("mousedown",s=>{n=!0,i.classList.add("resizing"),document.body.style.cursor="ew-resize",s.preventDefault()}),document.addEventListener("mousemove",s=>{if(!n)return;const r=s.clientX;r>200&&r<800&&(t.style.width=`${r}px`)}),document.addEventListener("mouseup",()=>{n&&(n=!1,i.classList.remove("resizing"),document.body.style.cursor="default")})}const o=document.getElementById("file-input");o&&o.addEventListener("change",async n=>{const s=n.target;if(s.files&&s.files.length>0){const r=document.getElementById("loading-overlay");if(r){r.style.display="flex";const l=document.getElementById("loading-progress");l&&(l.textContent="Procesando archivo...")}const a=s.files[0];try{if(a.name.toLowerCase().endsWith(".frag")){S(`Loading fragments: ${a.name}...`);const l=URL.createObjectURL(a);S(`Saving ${a.name} to local storage...`);try{const d=await a.arrayBuffer();await m_(a.name,d),S("Saved to local storage.")}catch(d){console.warn("Failed to save to IDB:",d)}await El(l,a.name);const c=F.groups.get(a.name)||F.groups[a.name]||Array.from(F.groups.values()).find(d=>d.uuid===a.name);if(c){c.uuid!==a.name&&(c.uuid=a.name),c.userData||(c.userData={}),c.userData.isLocal=!1,c.userData.url=`models/${a.name}`,console.log(`[Viewpoints] Manual load: Assigned URL ${c.userData.url} to ${c.uuid}`),S(`Assigned persistence URL: ${c.userData.url}`),c.useCamera(k.camera.three),k.scene.three.add(c.object),await F.core.update(!0);const d=new en().setFromObject(c.object),u=new _i;d.getBoundingSphere(u),k.camera.controls.fitToSphere(u,!0);const h=c,p=h.properties&&Object.keys(h.properties).length>0;if(S(`Fragment loaded. Properties found: ${p?Object.keys(h.properties).length:0}`),p){S(`Classifying fragments: ${a.name}...`);try{await rs(c),await os(),S(`Classification complete for ${a.name}`)}catch(m){S(`Classification failed: ${m}`,!0)}}else{S("WARNING: No properties found in .frag file. Generating dummy properties...",!0);try{const m=await c.getItemsIdsWithGeometry(),g={};for(const f of m)g[f]={expressID:f,type:0,GlobalId:{type:1,value:`generated-${f}`},Name:{type:1,value:`Element ${f}`},Description:{type:1,value:"Generated Property"}};h.properties=g,S(`Generated dummy properties for ${m.length} elements.`),S("Attempting classification on dummy properties..."),await rs(c),await os(),S("Classification complete (fallback).")}catch(m){S(`Error generating dummy properties: ${m}`,!0)}}We.has(a.name)||We.set(a.name,c)}else throw new Error("Model loaded but not found in groups.");S(`Loaded .frag: ${a.name}`),S("Ready for Measurement.")}else{S(`Loading IFC: ${a.name}...`);const l=new Uint8Array(buffer),c=await tf.load(l,!0,a.name);F.list.has(c.uuid)||F.list.set(c.uuid,c),c.object.parent||k.scene.three.add(c.object),S(`IFC Loaded: ${a.name}. Classifying...`);try{await rs(c),await os()}catch(h){S(`Classification warning: ${h}`,!0)}const d=new en().setFromObject(c.object),u=new _i;d.getBoundingSphere(u),k.camera.controls.fitToSphere(u,!0),S("Ready for Measurement.")}}catch(l){S(`Error loading file: ${l}`,!0),alert(`Error loading file: ${l}`)}finally{r&&(r.style.display="none")}s.value=""}})}function w_(){const t=document.getElementById("theme-toggle"),e=t?.querySelector("i"),i=document.getElementById("logo-img"),n=localStorage.getItem("theme")==="dark",s=r=>{r?(document.body.classList.add("dark-mode"),e&&(e.className="fa-solid fa-sun"),i&&(i.src="https://i.postimg.cc/FFfBKzb8/LOGO-TEXTO-NORA-BLANCO.png"),k&&k.scene&&k.scene.three&&(k.scene.three.background=new as(1973790))):(document.body.classList.remove("dark-mode"),e&&(e.className="fa-solid fa-moon"),i&&(i.src="https://i.postimg.cc/L4r0gSvV/LOGO-TEXTO-NORA-NEGRO.png"),k&&k.scene&&k.scene.three&&(k.scene.three.background=new as(16119285)))};s(n),t?.addEventListener("click",()=>{document.body.classList.toggle("dark-mode");const r=document.body.classList.contains("dark-mode");localStorage.setItem("theme",r?"dark":"light"),s(r)})}function $_(){const t=document.getElementById("projection-toggle");if(!t)return;const e=t.querySelector("span"),i=()=>{const n=k.camera.projection?.current==="Orthographic";t.classList.toggle("active",n),e&&(e.textContent=n?"Orto":"Persp")};i(),t.addEventListener("click",()=>{const o=k.camera.projection;if(!o||typeof o.set!="function")return;const s=o.current==="Orthographic"?"Perspective":"Orthographic";o.set(s);const r=k.renderer;r?.postproduction?.updateCamera&&r.postproduction.updateCamera(),i()})}function __(){const t=document.getElementById("clipper-toggle"),e=document.getElementById("clipper-controls"),i=document.getElementById("viewer-container");if(!t||!i)return;const o=()=>{const r=Q.enabled;t.classList.toggle("active",r),e&&(e.style.display=r?"flex":"none")};o(),t.addEventListener("click",()=>{Q.enabled=!Q.enabled,o()}),i.addEventListener("dblclick",()=>{Q.enabled&&Q.create(k)}),window.addEventListener("keydown",r=>{(r.code==="Delete"||r.code==="Backspace")&&Q.delete(k)});const n=document.getElementById("clipper-delete-all");n&&n.addEventListener("click",()=>{Q.deleteAll()}),document.querySelectorAll(".clipper-plane-btn").forEach(r=>{r.addEventListener("click",()=>{if(!Q.enabled)return;const a=r.getAttribute("data-axis"),l=cf(),c=new ee;a==="x"?c.set(-1,0,0):a==="y"?c.set(0,-1,0):a==="z"&&c.set(0,0,-1),Q.createFromNormalAndCoplanarPoint(k,c,l)})})}function x_(){const t=document.getElementById("grid-toggle");t&&t.addEventListener("click",()=>{const e=Kp.list.get(k.uuid);e&&(e.visible=!e.visible,t.classList.toggle("active",e.visible))})}const zr={};async function lf(){const t=document.getElementById("model-list");if(t)try{const e=window.location.hostname==="localhost"||window.location.hostname==="127.0.0.1";let i=[];if(e){S("Scanning local workspace for models...");const n=await fetch("./models.json");if(!n.ok)throw new Error(`Local models.json Error: ${n.status}`);i=await n.json(),S(`Local Scan: ${i.length} .frag models found`)}else{const n="https://api.github.com/repos/camilomartg-svg/bim/contents/docs/VSR_IFC/models";S("Scanning GitHub for models...");const s=await fetch(n);if(!s.ok)throw new Error(`GitHub API Error: ${s.status}`);const r=await s.json();if(!Array.isArray(r))throw new Error("Invalid GitHub response");i=r.filter(a=>a.name.toLowerCase().endsWith(".frag")).map(a=>({name:a.name,path:`models/${a.name}`,url:a.download_url})),S(`GitHub Scan: ${i.length} .frag models found`)}const o={};i.forEach(n=>{const s=h_(n.path);o[s]||(o[s]=[]),o[s].push(n)}),window._autoUpdateStarted||(window._autoUpdateStarted=!0,setInterval(lf,6e4),S("Auto-update enabled (60s).")),t.innerHTML="";for(const[n,s]of Object.entries(o)){const r=document.createElement("div");r.className="folder-group";const a=document.createElement("div");a.className="folder-header",a.innerHTML=`<span><i class="fa-regular fa-folder-open"></i> ${n}</span> <i class="fa-solid fa-chevron-down"></i>`;const l=document.createElement("ul");l.className="folder-items",a.addEventListener("click",()=>{l.classList.contains("collapsed")?(l.classList.remove("collapsed"),a.querySelector(".fa-chevron-right")?.classList.replace("fa-chevron-right","fa-chevron-down"),a.querySelector(".fa-folder")?.classList.replace("fa-folder","fa-folder-open"),zr[n]=!1):(l.classList.add("collapsed"),a.querySelector(".fa-chevron-down")?.classList.replace("fa-chevron-down","fa-chevron-right"),a.querySelector(".fa-folder-open")?.classList.replace("fa-folder-open","fa-folder"),zr[n]=!0)}),zr[n]&&(l.classList.add("collapsed"),a.querySelector(".fa-chevron-down")?.classList.replace("fa-chevron-down","fa-chevron-right"),a.querySelector(".fa-folder-open")?.classList.replace("fa-folder-open","fa-folder")),s.forEach(c=>{const d=document.createElement("li");d.className="model-item",d.dataset.path=c.path,(We.has(c.path)||c.url&&We.has(c.url))&&d.classList.add("visible"),d.innerHTML=`
                    <div class="model-name"><i class="fa-solid fa-cube"></i> ${c.name}</div>
                    <div class="visibility-toggle" title="Toggle Visibility">
                        <i class="fa-regular ${d.classList.contains("visible")?"fa-eye":"fa-eye-slash"}"></i>
                    </div>
                `,d.addEventListener("click",async u=>{u.stopPropagation();const h=u.target,p=c.url||c.path;h.closest(".visibility-toggle")?await S_(p,xl,d):await E_(p)}),l.appendChild(d)}),r.appendChild(a),r.appendChild(l),t.appendChild(r)}}catch(e){S(`Error loading model list: ${e}`,!0)}}async function E_(t){if(!We.has(t)){S(`Model ${t} not loaded. Click the eye icon to load it first.`,!0);return}const e=We.get(t);if(e)try{const i=await e.getItemsIdsWithGeometry(),o={};o[t]=i,S(`Selecting model: ${e.name} (${i.length} items)`),ze.highlightByID("select",o,!0,!0);const n=new en().setFromObject(e.object),s=new _i;n.getBoundingSphere(s),k.camera.controls.fitToSphere(s,!0)}catch(i){S(`Error selecting model: ${i}`,!0)}}async function S_(t,e,i){const o=i.querySelector(".visibility-toggle i");if(We.has(t)){const s=We.get(t),r=!s.object.visible;s.object.visible=r,r?(i.classList.add("visible"),o?.classList.replace("fa-eye-slash","fa-eye")):(i.classList.remove("visible"),o?.classList.replace("fa-eye","fa-eye-slash")),S(`Toggled model visibility: ${t} -> ${r}`);return}const n=document.getElementById("loading-overlay");n&&(n.style.display="flex");try{let s=t;if(!t.startsWith("http")){const r=t.split("/").map(a=>encodeURIComponent(a)).join("/");s=`${e}${r}`}await El(s,t),i.classList.add("visible"),o?.classList.replace("fa-eye-slash","fa-eye")}catch(s){const r=s instanceof Error?s.message:String(s);alert("Error downloading model: "+r),S(`Error downloading model: ${r}`,!0)}finally{n&&(n.style.display="none")}}S("Initializing That Open Engine...");v_();g_();w_();$_();x_();__();A_();lf();T_();const Xo=document.getElementById("console-toggle");Xo&&(Xo.style.display="none",Xo.addEventListener("click",()=>{const t=document.getElementById("debug-console");if(t){const e=t.style.display!=="none";t.style.display=e?"none":"block",Xo.classList.toggle("active",!e)}}));function Cl(){const t=ae.get(Cf);t.list.clear(),t.addFromModels();let e=t.get();return t.list.clear(),e.isEmpty()&&(console.warn("BoundingBoxer empty, falling back to scene traversal"),e=new en,k.scene.three.traverse(i=>{i.isMesh&&i.visible&&e.expandByObject(i)})),e}function cf(){const t=Cl();if(t.isEmpty())return new ee(0,0,0);const e=new ee;return t.getCenter(e),e}function C_(){const t=Cl();if(t.isEmpty())return 10;const e=new _i;return t.getBoundingSphere(e),e.radius||10}function A_(){const t=document.getElementById("fit-model-btn");t&&t.addEventListener("click",()=>{S("Fit Model clicked");const e=Cl(),i=new _i;e.getBoundingSphere(i),S(`Fit Radius: ${i.radius.toFixed(2)} Center: ${i.center.x.toFixed(1)},${i.center.y.toFixed(1)},${i.center.z.toFixed(1)}`),i.radius>.1?k.camera.controls.fitToSphere(i,!0):(S("Model bounds too small/empty",!0),alert("No se pudo encontrar el modelo para ajustar. Intenta recargar."))})}const Ls=document.getElementById("view-dropdown-btn"),Dr=document.getElementById("view-dropdown-menu");Ls&&Dr&&(Ls.addEventListener("click",t=>{t.stopPropagation(),Dr.classList.toggle("show")}),document.addEventListener("click",()=>{Dr.classList.remove("show")}));const k_=document.querySelectorAll(".view-btn");k_.forEach(t=>{t.addEventListener("click",async()=>{const e=t.getAttribute("data-view");if(Ls){const s=t.querySelector("i")?.cloneNode(!0),r=t.textContent?.trim(),a=Ls.querySelector("span");a&&s&&r&&(a.innerHTML="",a.appendChild(s),a.appendChild(document.createTextNode(" "+r)))}const i=cf(),n=C_()*2;switch(k.camera.controls.enabled=!0,e){case"top":await k.camera.controls.setLookAt(i.x,i.y+n,i.z,i.x,i.y,i.z,!0);break;case"bottom":await k.camera.controls.setLookAt(i.x,i.y-n,i.z,i.x,i.y,i.z,!0);break;case"front":await k.camera.controls.setLookAt(i.x,i.y,i.z+n,i.x,i.y,i.z,!0);break;case"back":await k.camera.controls.setLookAt(i.x,i.y,i.z-n,i.x,i.y,i.z,!0);break;case"left":await k.camera.controls.setLookAt(i.x-n,i.y,i.z,i.x,i.y,i.z,!0);break;case"right":await k.camera.controls.setLookAt(i.x+n,i.y,i.z,i.x,i.y,i.z,!0);break;case"iso":await k.camera.controls.setLookAt(i.x+n,i.y+n,i.z+n,i.x,i.y,i.z,!0);break}})});const[df]=T$.itemsData({components:ae,modelIdMap:{}});df.preserveStructureOnFilter=!0;const Rr=document.getElementById("properties-content");Rr&&(Rr.innerHTML="",Rr.appendChild(df));ze.events.select.onHighlight.add(async t=>{console.log("[DEBUG] Highlight event:",t),await gr(t)});ze.events.select.onClear.add(async()=>{await gr({})});vo&&vo.addEventListener("click",()=>{const t=ze.selection?.select;gr(t||{})});function Et(t,e){return!t||!e||!e.properties?t:typeof t=="number"?e.properties[t]:t&&typeof t.value=="number"?e.properties[t.value]:t}async function gr(t){console.log("[DEBUG] renderPropertiesTable called with:",t);const e=document.getElementById("properties-content");if(!e)return;e.innerHTML="";const i=t instanceof Map?Array.from(t.entries()):Object.entries(t);if(i.length===0){e.innerHTML='<div style="padding: 15px; color: #666; text-align: center;">Selecciona un elemento para ver sus propiedades</div>';return}const o={};for(const[h,p]of i){const m=p instanceof Set?Array.from(p):p;!m||m.length===0||(o[h]=m)}const n=Object.keys(o);if(n.length===0){e.innerHTML='<div style="padding: 15px; color: #666; text-align: center;">Selecciona un elemento para ver sus propiedades</div>';return}const s=await F.getData(o,{attributesDefault:!0,relations:{ContainedInStructure:{attributes:!0,relations:!0},IsDefinedBy:{attributes:!0,relations:!0}}}),r={};for(const h of n){const p=s[h]||[],m=new Set;p.forEach(g=>{const f=g,v=f.data||f.attributes||f,y=f.relations||f.Relations||v.relations||v.Relations||{},b=y.ContainedInStructure||y.containedInStructure||y.containedInSpatialStructure||y.ContainedInSpatialStructure;Array.isArray(b)&&b.forEach($=>m.add($))}),m.size>0&&(r[h]=Array.from(m))}let a={};if(Object.keys(r).length>0)try{a=await F.getData(r,{attributesDefault:!0,relationsDefault:{attributes:!0}})}catch(h){console.error("Failed to fetch relations data:",h)}const l={},c={};for(const h of Object.keys(a)){const p=a[h],m=new Set;p.forEach(g=>{const f=g,v=f.data||f.attributes||f,y=v.RelatingStructure||v.relatingStructure,b=y&&typeof y=="object"&&"value"in y?y.value:y;if(typeof b=="number"){m.add(b);const $=f.expressID||v.expressID;$&&(c[`${h}-${$}`]=b)}}),m.size>0&&(l[h]=Array.from(m))}let d={};if(Object.keys(l).length>0)try{d=await F.getData(l,{attributesDefault:!0})}catch(h){console.error("Failed to fetch structure data:",h)}const u=(h,p)=>{const m=d[h];if(!m)return null;const g=m.find(y=>(y.expressID||y.attributes?.expressID||y.data?.expressID)===p);if(!g)return null;const f=g.data||g.attributes||g,v=f.Name||f.name;return v?.value??v};for(const h of n){const p=o[h]||[],m=s[h]||[],g=We.get(h)||F.list.get(h);m.forEach((f,v)=>{const y=p[v],b=f,$=b.data||b.attributes||b;let C=null;const E=$.Name||$.name||$.IFCNAME||$.IfcName,A=typeof E=="object"&&E!==null&&"value"in E?E.value:E||`Elemento ${y??""}`,P=b.category||$.Category||$.category,M=b.guid||$.GlobalId||$.globalId||$.GUID||$.guid,O=typeof M=="object"&&M!==null&&"value"in M?M.value:M||"",U=document.createElement("div");U.className="prop-item";let z=`
                <div class="prop-header-info">
                    <strong>${A}</strong>
                    <div style="font-size: 11px; color: #666;">
                        ID: ${y??"-"} <span style="margin: 0 5px;">|</span> Modelo: ${h}
                        ${P?`<span style="margin: 0 5px;">|</span> Tipo: ${P}</span>`:""}
                        ${O?`<br/>GUID: ${O}`:""}
                    </div>
                </div>
            `;z+='<div class="prop-set-title">Atributos Base</div>',z+='<table class="prop-table"><tbody>';const X=new Set(["localId","category","guid","IsDefinedBy","isDefinedBy","relations","Relations","expressID","type"]);for(const[V,q]of Object.entries($)){if(!V||X.has(V))continue;const fe=q?.value??q;fe!=null&&(Array.isArray(fe)||typeof fe!="object"&&(z+=`<tr><th>${V}</th><td>${fe}</td></tr>`))}C&&(z+=`<tr><th>Nivel</th><td>${C}</td></tr>`),z+="</tbody></table>";const I=new Set(["expressID","type","GlobalId","Name","Description","Tag","ObjectType","ContainedInStructure","containedInStructure","IsDefinedBy","isDefinedBy","relations","Relations","localId","category","guid"]);if(g&&g.properties&&g.properties[y]){let V=function(N){const j=N.Name||N.name,L=(j?.value??j)||"Sin Nombre",B=N.HasProperties||N.hasProperties;if(B&&Array.isArray(B)){z+=`<div class="prop-set-title">${L}</div><table class="prop-table"><tbody>`;for(const re of B){const R=Et(re,g);if(!R)continue;const Ce=R.Name||R.name,we=Ce?.value??Ce,Ae=R.NominalValue||R.nominalValue,Ri=Ae?.value??Ae;if(we&&Ri!==void 0){const ff=ve(Ri,0);z+=`<tr><th>${we}</th><td>${ff}</td></tr>`}}z+="</tbody></table>"}const de=N.Quantities||N.quantities;if(de&&Array.isArray(de)){z+=`<div class="prop-set-title">${L} (Cantidades)</div><table class="prop-table"><tbody>`;for(const re of de){const R=Et(re,g);if(!R)continue;const Ce=R.Name||R.name,we=Ce?.value??Ce,Ae=R.LengthValue?.value??R.LengthValue??R.AreaValue?.value??R.AreaValue??R.VolumeValue?.value??R.VolumeValue??R.CountValue?.value??R.CountValue??R.WeightValue?.value??R.WeightValue??R.TimeValue?.value??R.TimeValue??R.nominalValue?.value??R.nominalValue;if(we&&Ae!==void 0){const Ri=ve(Ae,0);z+=`<tr><th>${we}</th><td>${Ri}</td></tr>`}}z+="</tbody></table>"}};const q=g.properties[y];let fe=!1,dt='<div class="prop-set-title">Propiedades del Elemento (Completo)</div><table class="prop-table"><tbody>';const ve=(N,j)=>{if(j>2)return"...";if(N==null)return"";let L=N;if(typeof N=="object"&&N!==null&&N.value!==void 0&&(L=N.value),Array.isArray(L))return L.length===0?"[]":`[${L.map(B=>ve(B,j+1)).join(", ")}]`;if(typeof L=="number"&&Number.isInteger(L)){if(g.properties[L]){const B=g.properties[L],de=B.Name&&(B.Name.value||B.Name)||B.NominalValue&&(B.NominalValue.value||B.NominalValue)||B.Description&&(B.Description.value||B.Description);let re="";if(j<1){const R=[];for(const[Ce,we]of Object.entries(B))["expressID","type","GlobalId","OwnerHistory","Owner"].includes(Ce)||typeof we=="object"||Array.isArray(we)||R.push(`${Ce}: ${we}`);R.length>0&&(re=` <span style="color:#666; font-size:0.85em;">{${R.join(", ")}}</span>`)}return`<span title="ExpressID: ${L}" style="color: #0056b3; cursor: help;">${de||B.type||"Entity"} <i>#${L}</i>${re}</span>`}return String(L)}if(typeof L=="object")try{return JSON.stringify(L)}catch{return"[Object]"}return String(L)},_t=(N,j,L=0)=>{if(!j||typeof j!="object"||L>2)return"";let B=`<div class="prop-set-title">${N}</div><table class="prop-table"><tbody>`;for(const[de,re]of Object.entries(j)){let R=re?.value??re;if(R==null)continue;if(Array.isArray(R)){if(R.length===0)continue;const we=R[0];if(we&&typeof we=="object"&&!("value"in we)){let Ae=0;for(const Ri of R)B+=_t(`${de}[${Ae}]`,Ri,L+1),Ae++}else{const Ae=ve(R,L);B+=`<tr><th>${de}</th><td>${Ae}</td></tr>`}continue}if(typeof R=="object"){B+=_t(de,R,L+1);continue}const Ce=ve(R,L);B+=`<tr><th>${de}</th><td>${Ce}</td></tr>`}return B+="</tbody></table>",B};let tt="";for(const[N,j]of Object.entries(q)){if(I.has(N)||j==null)continue;let L=null,B=!1;if(typeof j=="string"){const re=j.trim();if(re.startsWith("{")||re.startsWith("[")){console.log(`[DEBUG] Attempting to parse complex string for key '${N}'`,re.substring(0,50)+"...");try{L=JSON.parse(re),B=typeof L=="object"&&L!==null,console.log(`[DEBUG] Parsing success for '${N}'`,B)}catch(R){console.warn(`[DEBUG] JSON.parse failed for '${N}':`,R);try{re.startsWith("{")&&(L=new Function("return "+re)(),B=typeof L=="object"&&L!==null)}catch{}}}}else typeof j=="object"&&(!(j.value!==void 0&&Object.keys(j).length<=2)&&!Array.isArray(j)||Array.isArray(j)&&j.length>0&&typeof j[0]=="object")&&(L=j,B=!0);if(B&&L){if(Array.isArray(L))tt+=_t(N,L,0);else{let re=!0;for(const R of Object.values(L))if(typeof R!="object"||R===null){re=!1;break}if(re)for(const[R,Ce]of Object.entries(L))tt+=_t(R,Ce,0);else tt+=_t(N,L,0)}continue}const de=ve(j,0);dt+=`<tr><th>${N}</th><td>${de}</td></tr>`,fe=!0}if(dt+="</tbody></table>",fe&&(z+=dt),z+=tt,!g._inverseMap){console.log("Building inverse attribute map for property discovery..."),g._inverseMap=new Map;const N=g._inverseMap;for(const j in g.properties){const L=g.properties[j];if(!L)continue;if(String(L.type||"").toUpperCase()==="IFCRELDEFINESBYPROPERTIES"){const de=L.RelatedObjects||L.relatedObjects,re=L.RelatingPropertyDefinition||L.relatingPropertyDefinition;if(de&&re){const R=Array.isArray(de)?de:[de],Ce=re.value||re;for(const we of R){const Ae=we.value||we;N.has(Ae)||N.set(Ae,[]),N.get(Ae).push(Ce)}}}}console.log(`Inverse map built. Found relations for ${N.size} items.`)}q.IsDefinedBy||q.isDefinedBy,g._inverseMap&&g._inverseMap.has(Number(y))&&g._inverseMap.get(Number(y)).forEach(j=>{});const ri=g._inverseMap?g._inverseMap.get(Number(y))||[]:[],le=q.ContainedInStructure||q.containedInStructure;if(le&&Array.isArray(le))for(const N of le){const j=Et(N,g);if(!j)continue;const L=j.RelatingStructure||j.relatingStructure;if(!L)continue;const B=Et(L,g);if(!B)continue;const de=B.Name||B.name,re=(de?.value??de)||"Sin Nombre";{C=String(re);break}}const ce=q.IsDefinedBy||q.isDefinedBy;if(ce&&Array.isArray(ce))for(const N of ce){const j=Et(N,g);if(!j)continue;const L=j.RelatingPropertyDefinition||j.relatingPropertyDefinition;if(!L)continue;const B=Et(L,g);B&&V(B)}if(ri.length>0)for(const N of ri){const j=Et(N,g);j&&V(j)}}if(!C){const V=b.relations||b.Relations||$.relations||$.Relations||{},q=V.ContainedInStructure||V.containedInStructure||V.containedInSpatialStructure||V.ContainedInSpatialStructure;if(Array.isArray(q)&&q.length>0)for(const fe of q){const dt=c[`${h}-${fe}`];if(dt){const ve=u(h,dt);if(ve){C=String(ve);break}}if(!C){const ve=Et(fe,g);if(ve&&typeof ve=="object"){const _t=ve.RelatingStructure||ve.relatingStructure,tt=Et(_t,g);if(tt&&typeof tt=="object"){const ri=tt.Name||tt.name,le=ri?.value??ri;if(le){C=String(le);break}}}}}}C&&!z.includes("<th>Nivel</th>")&&(z=z.replace("</tbody></table>",`<tr><th>Nivel</th><td>${C}</td></tr></tbody></table>`));const H=b.relations||b.Relations||$.relations||$.Relations||{},ne=Object.keys(H),Z=H.ContainedInStructure||H.containedInStructure||H.containedInSpatialStructure||H.ContainedInSpatialStructure;z+=`
                <details style="margin-top: 15px; border-top: 1px solid #ddd; padding-top: 10px;">
                    <summary style="font-size: 11px; color: #999; cursor: pointer; user-select: none;">
                        🛠 Diagnóstico de Datos
                    </summary>
                    <div style="font-size: 10px; color: #444; background: #f5f5f5; padding: 10px; margin-top: 5px; border-radius: 4px; overflow-x: auto;">
                        <strong>ID Elemento:</strong> ${y} (ExpressID)<br/>
                        <strong>Relaciones Disponibles:</strong> ${ne.length>0?ne.join(", "):"NINGUNA"}<br/>
                        <strong>Relación Espacial (Nivel):</strong> ${Z?"✅ EXISTE":"❌ FALTA"}<br/>
                        ${Z?`Valores: ${JSON.stringify(Z)}`:""}
                    </div>
                </details>
            `,U.innerHTML=z,e.appendChild(U)})}}function T_(){const t=document.getElementById("properties-panel"),e=document.getElementById("properties-toggle"),i=document.getElementById("properties-resizer");if(e&&t&&e.addEventListener("click",()=>{t.classList.toggle("closed")}),i&&t){let o=!1;i.addEventListener("mousedown",n=>{o=!0,i.classList.add("resizing"),document.body.style.cursor="ew-resize",n.preventDefault()}),document.addEventListener("mousemove",n=>{if(!o)return;const s=window.innerWidth-n.clientX;s>200&&s<800&&(t.style.width=`${s}px`)}),document.addEventListener("mouseup",()=>{o&&(o=!1,i.classList.remove("resizing"),document.body.style.cursor="default")})}gr({})}const ss=["CLASIFICACIÓN","NIVEL INTEGRADO","NOMBRE INTEGRADO","MATERIAL INTEGRADO","SUBPROYECTOS INTEGRADO"],Fn=new Map;async function rs(t){if(!t.properties)return;S("Clasificando por campos INTEGRADO...");const e=t.uuid,i=await t.getItemsIdsWithGeometry(),o=new Set(i);for(const u of ss)Fn.has(u)||Fn.set(u,new Map);const n=new Map,s=new Map,r=new Map,a=new Map,l=new Map;for(const u of i)r.set(u,"Sin Tipo"),a.set(u,"Sin Nivel"),l.set(u,0);const c=(u,h,p)=>{const m=Fn.get(u);m.has(h)||m.set(h,{});const g=m.get(h);g[e]||(g[e]=new Set),g[e].add(p)};for(const u in t.properties){const h=t.properties[u];if(!h)continue;const p=h.RelatedObjects,m=h.RelatingPropertyDefinition;if(!p||!m)continue;const g=m.value??m,f=t.properties[String(g)];if(!f)continue;const v=f.HasProperties||f.hasProperties;if(!Array.isArray(v))continue;const y=Array.isArray(p)?p:[p];for(const b of v){const $=b.value??b,C=t.properties[String($)];if(!C)continue;const E=C.Name||C.name,A=String(E?.value??E??"").trim(),P=C.NominalValue||C.nominalValue,M=P?.value??P;if(M==null)continue;const O=String(M).trim();if(O){for(const U of ss)if(A===U)for(const z of y){const X=Number(z.value??z);o.has(X)&&c(U,O,X)}if(A==="Familia"||A==="Family")for(const U of y){const z=Number(U.value??U);o.has(z)&&r.set(z,O)}if(A==="Nivel"||A==="Nivel de referencia"||A==="Restricción de base"){const U=A==="Nivel"?3:A==="Nivel de referencia"?2:1;for(const z of y){const X=Number(z.value??z);o.has(X)&&U>(l.get(X)||0)&&(a.set(X,O),l.set(X,U))}}}}}let d=0;for(const u of ss){const h=Fn.get(u);d+=h.size,S(`  ${u}: ${h.size} valores`)}for(const[u,h]of r.entries())n.has(h)||n.set(h,{[e]:new Set}),n.get(h)[e]??=new Set,n.get(h)[e].add(u);for(const[u,h]of a.entries())s.has(h)||s.set(h,{[e]:new Set}),s.get(h)[e]??=new Set,s.get(h)[e].add(u);Bt.list.clear(),d===0?(Bt.list.set("Clasificación por tipo",n),Bt.list.set("Clasificación por nivel",s),S(`Fallback: ${n.size} tipos, ${s.size} niveles.`)):S(`Clasificación INTEGRADA: ${d} categorías encontradas.`)}function O_(){const t=document.getElementById("btn-hide"),e=document.getElementById("btn-isolate"),i=document.getElementById("btn-show-all");t&&t.addEventListener("click",async()=>{const o=ze.selection.select;o&&Object.keys(o).length>0&&(await Te.set(!1,o),ze.clear("select"))}),e&&e.addEventListener("click",async()=>{const o=ze.selection.select;o&&Object.keys(o).length>0&&(await Te.isolate(o),ze.clear("select"))}),i&&i.addEventListener("click",async()=>{await Te.set(!0),ze.clear("select")})}function I_(){console.log("[DEBUG] Setting up measurement tools...");try{St=ae.get(Sf),St.world=k,St.enabled=!1,console.log("[DEBUG] Area Tool initialized")}catch(a){console.warn("Could not initialize Area Tool:",a)}if(!ye){const a=new Sa(.15,16,16),l=new $i({color:16711935,transparent:!0,opacity:.8,depthTest:!1});ye=new zt(a,l),ye.renderOrder=2e3,k.scene.three.add(ye),ye.visible=!1}const t=document.getElementById("btn-measure-length"),e=document.getElementById("btn-measure-point"),i=document.getElementById("btn-measure-area"),o=document.getElementById("btn-measure-angle"),n=document.getElementById("btn-measure-slope"),s=document.getElementById("btn-measure-delete");t&&t.addEventListener("click",()=>{ji("length"),Hi(t)}),e&&e.addEventListener("click",()=>{ji("point"),Hi(e)}),i&&i.addEventListener("click",()=>{ji("area"),Hi(i),S("Area tool activated (Click points, Right-click to finish)")}),o&&o.addEventListener("click",()=>{ji("angle"),Hi(o),S("Angle tool activated (Click 3 points: Start, Vertex, End)")}),n&&n.addEventListener("click",()=>{ji("slope"),Hi(n),S("Slope tool activated (Click 2 points)")}),s&&s.addEventListener("click",()=>{console.log("[DEBUG] Delete button clicked");try{St&&typeof St.deleteAll=="function"&&St.deleteAll()}catch(a){console.warn("Error clearing tools:",a)}uf()});const r=document.getElementById("viewer-container");r&&(r.addEventListener("mousemove",P_),r.addEventListener("click",L_),window.addEventListener("keydown",a=>{if(a.key==="Escape"){let l=!1;if(ge&&(ji(ge),l=!0),Q.enabled){Q.enabled=!1;const d=document.getElementById("clipper-toggle");d&&d.classList.remove("active");const u=document.getElementById("clipper-controls");u&&(u.style.display="none"),l=!0}ye&&ye.visible&&(ye.visible=!1,l=!0);const c=ze.selection.select;c&&Object.keys(c).length>0&&(ze.clear("select"),l=!0),l&&S("Cancelled / Cleared")}}),r.addEventListener("contextmenu",a=>{if(ge==="area"&&D.length>=3){a.preventDefault();const l=D[0],c=D[D.length-1];pt(c,l);let d=0;for(let p=0;p<D.length;p++){const m=(p+1)%D.length;d+=D[p].x*D[m].z,d-=D[m].x*D[p].z}d=Math.abs(d)/2;const u=new ee;D.forEach(p=>u.add(p)),u.divideScalar(D.length),u.y+=.2;const h=`${d.toFixed(2)}m²`;ft(h,u,{type:"area",points:D.map(p=>p.clone()),label:h,labelPosition:u.clone()}),S(`Area: ${h}`),D=[],G&&(k.scene.three.remove(G),G=null)}else ge&&(a.preventDefault(),Ms())}))}function Hi(t){["btn-measure-length","btn-measure-point","btn-measure-area","btn-measure-angle","btn-measure-slope"].forEach(e=>{const i=document.getElementById(e);i&&i.classList.remove("active")}),t&&t.classList.add("active")}function ji(t){if(St&&St.enabled&&(St.enabled=!1),ge===t)ge=null,Ms(),S("Measurement mode disabled"),Hi(null),ye&&(ye.visible=!1);else{ge=t,Ms();let e="";switch(t){case"length":e="Distance";break;case"area":e="Area";break;case"angle":e="Angle (3 Points)";break;case"slope":e="Slope (2 Points)";break;case"point":e="Point Coordinate";break}S(`Measurement mode: ${e}`)}}function Ms(){D=[],G&&(k.scene.three.remove(G),G=null)}function uf(){Is.forEach(t=>k.scene.three.remove(t)),Is.length=0,va.forEach(t=>t.remove()),va.length=0,Ms(),$l=[],S("Measurements cleared")}function ke(t,e=16711680){const i=new Sa(.1,16,16),o=new $i({color:e,depthTest:!1,transparent:!0,opacity:.8}),n=new zt(i,o);return n.position.copy(t),n.renderOrder=1e3,k.scene.three.add(n),Is.push(n),n}function pt(t,e){const i=new qi().setFromPoints([t,e]),o=new Vi({color:16776960,depthTest:!1,linewidth:2}),n=new hi(i,o);return n.renderOrder=999,k.scene.three.add(n),Is.push(n),n}function ft(t,e,i){const o=document.createElement("div");o.className="measurement-label",o.textContent=t,o.style.position="absolute",o.style.background="rgba(0, 0, 0, 0.7)",o.style.color="white",o.style.padding="4px 8px",o.style.borderRadius="4px",o.style.pointerEvents="none",o.style.fontSize="12px",o.style.zIndex="1000",document.body.appendChild(o),va.push(o),i&&$l.push(i);const n=()=>{if(!o.isConnected)return;const s=e.clone().project(k.camera.three),r=(s.x*.5+.5)*window.innerWidth,a=(-(s.y*.5)+.5)*window.innerHeight;o.style.left=`${r}px`,o.style.top=`${a}px`,o.style.display=s.z>1?"none":"block",requestAnimationFrame(n)};return n(),o}async function P_(t){if(!ge){ye&&(ye.visible=!1);return}const e=await De.castRay();if(e&&e.point){if(ye&&(ye.position.copy(e.point),ye.visible=!0),ge==="length"&&D.length===1){const i=D[0],o=e.point;if(G){const n=G.geometry.attributes.position;n.setXYZ(0,i.x,i.y,i.z),n.setXYZ(1,o.x,o.y,o.z),n.needsUpdate=!0}else{const n=new qi().setFromPoints([i,o]),s=new Vi({color:16776960,depthTest:!1,opacity:.5,transparent:!0});G=new hi(n,s),k.scene.three.add(G)}}else if(ge==="area"&&D.length>0){const i=D[D.length-1],o=e.point;if(G){const n=G.geometry.attributes.position;n.setXYZ(0,i.x,i.y,i.z),n.setXYZ(1,o.x,o.y,o.z),n.needsUpdate=!0}else{const n=new qi().setFromPoints([i,o]),s=new Vi({color:65535,depthTest:!1,opacity:.5,transparent:!0});G=new hi(n,s),k.scene.three.add(G)}}else if(ge==="angle"&&D.length>0){const i=D[D.length-1],o=e.point;if(G){const n=G.geometry.attributes.position;n.setXYZ(0,i.x,i.y,i.z),n.setXYZ(1,o.x,o.y,o.z),n.needsUpdate=!0}else{const n=new qi().setFromPoints([i,o]),s=new Vi({color:16753920,depthTest:!1,opacity:.5,transparent:!0});G=new hi(n,s),k.scene.three.add(G)}}else if(ge==="slope"&&D.length===1){const i=D[0],o=e.point;if(G){const n=G.geometry.attributes.position;n.setXYZ(0,i.x,i.y,i.z),n.setXYZ(1,o.x,o.y,o.z),n.needsUpdate=!0}else{const n=new qi().setFromPoints([i,o]),s=new Vi({color:255,depthTest:!1,opacity:.5,transparent:!0});G=new hi(n,s),k.scene.three.add(G)}}}else ye&&(ye.visible=!1)}async function L_(t){if(!ge||t.target.closest("button")||t.target.closest(".sidebar"))return;const e=await De.castRay();if(!e||!e.point)return;const i=e.point;if(ge==="point"){ke(i,65280);const o=`X:${i.x.toFixed(2)} Y:${i.y.toFixed(2)} Z:${i.z.toFixed(2)}`;ft(o,i,{type:"point",points:[i.clone()],label:o,labelPosition:i.clone()}),S(`Point: ${o}`)}else if(ge==="length"){if(D.push(i),ke(i,16776960),D.length===2){const o=D[0],n=D[1];pt(o,n);const s=o.distanceTo(n),r=o.clone().add(n).multiplyScalar(.5),a=`${s.toFixed(3)}m`;ft(a,r,{type:"length",points:[o.clone(),n.clone()],label:a,labelPosition:r.clone()}),S(`Distance: ${a}`),D=[],G&&(k.scene.three.remove(G),G=null)}}else if(ge==="area"){if(D.push(i),ke(i,65535),D.length>1){const o=D[D.length-2];pt(o,i)}G&&(k.scene.three.remove(G),G=null)}else if(ge==="angle"){if(D.push(i),ke(i,16753920),D.length>1){const o=D[D.length-2];pt(o,i)}if(D.length===3){const o=D[0],n=D[1],s=D[2],r=o.clone().sub(n).normalize(),a=s.clone().sub(n).normalize(),l=r.angleTo(a),d=`${kl.radToDeg(l).toFixed(1)}°`;ft(d,n,{type:"angle",points:[o.clone(),n.clone(),s.clone()],label:d,labelPosition:n.clone()}),S(`Angle: ${d}`),D=[],G&&(k.scene.three.remove(G),G=null)}}else if(ge==="slope"&&(D.push(i),ke(i,255),D.length===2)){const o=D[0],n=D[1];pt(o,n),Math.abs(n.y-o.y);const s=Math.sqrt(Math.pow(n.x-o.x,2)+Math.pow(n.z-o.z,2));let r=0;s!==0?r=Math.atan(Math.abs(n.y-o.y)/s):r=Math.PI/2;const a=kl.radToDeg(r),l=o.clone().add(n).multiplyScalar(.5),c=`${a.toFixed(1)}°`;ft(c,l,{type:"slope",points:[o.clone(),n.clone()],label:c,labelPosition:l.clone()}),S(`Slope: ${c}`),D=[],G&&(k.scene.three.remove(G),G=null)}}function M_(){console.log("[DEBUG] Setting up Viewpoints Manager...");const t={getMeasurements:()=>$l,restoreMeasurements:o=>{uf(),!(!o||!Array.isArray(o))&&o.forEach(n=>{if(n.type==="point"&&n.points&&n.points.length>0){const s=new ee(n.points[0].x,n.points[0].y,n.points[0].z);ke(s,65280),ft(n.label,s,n)}else if(n.type==="length"&&n.points&&n.points.length===2){const s=new ee(n.points[0].x,n.points[0].y,n.points[0].z),r=new ee(n.points[1].x,n.points[1].y,n.points[1].z);ke(s,16776960),ke(r,16776960),pt(s,r);const a=new ee(n.labelPosition.x,n.labelPosition.y,n.labelPosition.z);ft(n.label,a,n)}else if(n.type==="angle"&&n.points&&n.points.length===3){const s=new ee(n.points[0].x,n.points[0].y,n.points[0].z),r=new ee(n.points[1].x,n.points[1].y,n.points[1].z),a=new ee(n.points[2].x,n.points[2].y,n.points[2].z);ke(s,16753920),ke(r,16753920),ke(a,16753920),pt(s,r),pt(r,a),ft(n.label,r,n)}else if(n.type==="slope"&&n.points&&n.points.length===2){const s=new ee(n.points[0].x,n.points[0].y,n.points[0].z),r=new ee(n.points[1].x,n.points[1].y,n.points[1].z);ke(s,255),ke(r,255),pt(s,r);const a=new ee(n.labelPosition.x,n.labelPosition.y,n.labelPosition.z);ft(n.label,a,n)}else if(n.type==="area"&&n.points&&n.points.length>2){const s=n.points.map(a=>new ee(a.x,a.y,a.z));s.forEach(a=>ke(a,65535));for(let a=0;a<s.length;a++)pt(s[a],s[(a+1)%s.length]);const r=new ee(n.labelPosition.x,n.labelPosition.y,n.labelPosition.z);ft(n.label,r,n)}})},getHiddenItems:()=>{const o={};for(const n in Be)Be[n].size>0&&(o[n]=Array.from(Be[n]));return o},restoreHiddenItems:async o=>{await Te.set(!0),Object.keys(o).length>0&&await Te.set(!1,o)},getClippingPlanes:()=>{console.log("[Viewpoints] Getting clipping planes...");const o=[];try{const n=k?.renderer?.three?.clippingPlanes;if(Array.isArray(n)&&n.length>0){console.log(`[Viewpoints] Found ${n.length} clipping planes in renderer.`);for(const s of n)s?.normal&&o.push({normal:s.normal.toArray(),constant:s.constant});return o}if(!Q||!Q.list)return console.warn("[Viewpoints] Clipper not initialized or list unavailable"),[];if(console.log(`[Viewpoints] Clipper list size: ${Q.list.size||Q.list.length}`),Q.list.size>0&&Q.list.forEach((s,r)=>{console.log(`[Viewpoints] Map.forEach - Plane ${r}:`,s);let a=null;const l=s;l.plane?a=l.plane:l.normal&&l.constant!==void 0?a=l:l.object&&l.object.plane&&(a=l.object.plane),a&&o.push({normal:a.normal.toArray(),constant:a.constant})}),o.length===0&&Q.planes&&Array.isArray(Q.planes)){const s=Q.planes;for(const r of s)r?.normal&&r?.constant!==void 0&&o.push({normal:r.normal.toArray(),constant:r.constant})}return console.log(`[Viewpoints] Serialized clipping planes count: ${o.length}`),o}catch(n){return console.error("[Viewpoints] Error getting clipping planes:",n),[]}},restoreClippingPlanes:o=>{console.log("[Viewpoints] Restoring clipping planes (count):",o?o.length:0),console.log("[Viewpoints] Raw planes data:",JSON.stringify(o));try{if(Q.list.size>0&&(console.log(`[Viewpoints] Clearing ${Q.list.size} existing planes...`),Q.deleteAll()),k?.renderer?.three&&Array.isArray(k.renderer.three.clippingPlanes)&&(k.renderer.three.clippingPlanes=[],k.renderer.three.localClippingEnabled=!0),!o||o.length===0){console.log("[Viewpoints] No planes to restore. Disabling clipper."),Q.enabled=!1;const r=document.getElementById("clipper-toggle");r&&r.classList.remove("active");const a=document.getElementById("clipper-controls");a&&(a.style.display="none");return}console.log("[Viewpoints] Enabling clipper tool..."),Q.enabled=!0;const n=document.getElementById("clipper-toggle");n&&n.classList.add("active");const s=document.getElementById("clipper-controls");s&&(s.style.display="flex"),o.forEach((r,a)=>{if(console.log(`[Viewpoints] Restoring plane #${a}:`,r),r.normal&&r.constant!==void 0){const l=new ee(r.normal[0],r.normal[1],r.normal[2]).normalize(),c=r.constant,d=l.clone().multiplyScalar(-c);console.log(`[Viewpoints] Creating plane #${a}: normal=${l.toArray()}, constant=${c}`);const u=Q.createFromNormalAndCoplanarPoint(k,l,d);console.log(`[Viewpoints] Plane #${a} created:`,u)}else console.warn("[Viewpoints] Invalid plane data for plane #${index}:",r)})}catch(n){console.error("[Viewpoints] Error restoring clipping planes:",n)}},getLoadedModels:()=>{const o=[],n=F.list&&F.list.size>0?F.list:F.groups,s=n instanceof Map?Array.from(n.entries()):Object.entries(n||{});console.log(`[Viewpoints] Saving models. Found ${s.length} groups/models.`),S(`[Viewpoints] Found ${s.length} models.`);for(const[r,a]of s){const l=a.object&&a.object.visible!==void 0?a.object.visible:a.visible!==void 0?a.visible:!0;if(!l){console.log(`[Viewpoints] Model ${r} is hidden (visible=${l}). Skipping.`),S(`[Viewpoints] Skipping hidden: ${r}`);continue}if(S(`[Viewpoints] Processing visible: ${r}`),a.userData)if(console.log(`[Viewpoints] Inspecting model ${r}:`,a.userData),a.userData.isLocal&&a.userData.dbKey){const c=`indexeddb://${a.userData.dbKey}`;o.push({uuid:r,url:c}),console.log(`[Viewpoints] Saved local model reference: ${c}`),S(`[Viewpoints] Saved local: ${a.userData.dbKey}`)}else a.userData.url?(o.push({uuid:r,url:a.userData.url}),console.log(`[Viewpoints] Saved remote model reference: ${a.userData.url}`),S(`[Viewpoints] Saved remote: ${a.userData.url}`)):(console.warn(`[Viewpoints] Model ${r} has no URL or DB key. Skipping persistence.`),S(`[Viewpoints] SKIP: No URL/DBKey for ${r}`,!0));else console.warn(`[Viewpoints] Model ${r} has no userData. Skipping persistence.`),S(`[Viewpoints] SKIP: No userData for ${r}`,!0)}return o},restoreLoadedModels:async o=>{const n=F.list&&F.list.size>0?F.list:F.groups,s=n instanceof Map,r=new Set(s?n.keys():Object.keys(n||{})),a=new Set(o.map(l=>l.uuid));for(const l of r){const c=s?n.get(l):n[l];if(c){const d=a.has(l);c.object&&(c.object.visible=d),c.visible!==void 0&&(c.visible=d),console.log(`[Viewpoints] Sync visibility for ${l}: ${d}`)}}for(const l of o)if(r.has(l.uuid))console.log(`[Viewpoints] Model ${l.uuid} already loaded. Skipping.`);else try{console.log(`[Viewpoints] Restoring model: ${l.uuid} from ${l.url}`);let c=l.url,d=!1,u="";if(l.url.startsWith("indexeddb://")){u=l.url.replace("indexeddb://",""),S(`Restoring local model from storage: ${u}...`);const h=await b_(u);if(h){console.log(`[Viewpoints] Retrieved ${h.byteLength} bytes from IDB for ${u}`);const p=new Blob([h]);c=URL.createObjectURL(p),d=!0}else{console.warn(`Local model ${u} not found in IndexedDB.`),S(`Error: Local model ${u} expired/missing. Please reload file.`,!0);continue}}if(console.log(`[Viewpoints] Calling loadModel with URL: ${c}`),await El(c,l.uuid),console.log(`[Viewpoints] loadModel completed for ${l.uuid}`),d){const h=s?F.groups.get(l.uuid):F.groups[l.uuid];h?(h.userData||(h.userData={}),h.userData.isLocal=!0,h.userData.dbKey=u,h.userData.url=c,console.log(`[Viewpoints] Restored local metadata for ${l.uuid}`)):console.error(`[Viewpoints] Model ${l.uuid} not found in fragments.groups after load!`)}}catch(c){console.error(`[Viewpoints] Failed to restore model ${l.uuid}:`,c)}}};Pr=new Af(ae,k,t);const e=document.getElementById("viewpoints-list-container");e&&Pr.createUI(e);const i=document.getElementById("btn-add-viewpoint");if(i){const o=i.cloneNode(!0);i.parentNode?.replaceChild(o,i),o.addEventListener("click",()=>{Pr?.openSaveModal()})}}const hf="https://norabim.com/inse.html";function pf(){const t=sessionStorage.getItem("userAccount")||localStorage.getItem("userAccount");if(!t)return null;try{const e=JSON.parse(t);return!e||typeof e!="object"?null:e}catch(e){return console.error("[Auth] Error parsing user account:",e),null}}function z_(){if(window.location.hostname==="localhost"||window.location.hostname==="127.0.0.1"){console.log("[Auth] Bypassing authentication on localhost");return}const e=document.getElementById("app");if(!e)return;const i=pf(),o=document.getElementById("auth-gate-overlay");if(i){o?.remove(),e.style.pointerEvents="",e.style.userSelect="",e.style.filter="",document.body.style.overflow="";return}if(o)return;e.style.pointerEvents="none",e.style.userSelect="none",e.style.filter="blur(4px)",document.body.style.overflow="hidden";const n=document.createElement("div");n.id="auth-gate-overlay",n.style.position="fixed",n.style.inset="0",n.style.zIndex="10000",n.style.display="flex",n.style.alignItems="center",n.style.justifyContent="center",n.style.padding="24px",n.style.background="radial-gradient(circle at top, rgba(23, 23, 23, 0.22), rgba(23, 23, 23, 0) 30%), linear-gradient(135deg, rgba(255,255,255,0.96), rgba(245,245,245,0.96))",n.innerHTML=`
        <div style="width:min(520px, 100%); background:#ffffff; border:1px solid rgba(23, 23, 23, 0.14); border-radius:24px; padding:36px 32px; box-shadow:0 30px 80px rgba(96, 94, 98, 0.18); text-align:center; font-family:Inter, Arial, sans-serif;">
            <img src="https://i.postimg.cc/L4r0gSvV/LOGO-TEXTO-NORA-NEGRO.png" alt="Amarillo" style="height:44px; width:auto; margin:0 auto 22px; display:block;" />
            <div style="width:72px; height:72px; margin:0 auto 18px; border-radius:50%; display:flex; align-items:center; justify-content:center; background:rgba(23, 23, 23, 0.08); color:#171717; font-size:28px;">
                <i class="fa-solid fa-lock"></i>
            </div>
            <h1 style="margin:0 0 10px; font-size:28px; line-height:1.15; color:#1f1f1f;">Inicia sesión para continuar</h1>
            <p style="margin:0 0 22px; font-size:15px; line-height:1.6; color:#605e62;">
                Debes autenticarte para acceder al visor VSR IFC. Si abriste este enlace directamente, primero inicia sesión y luego vuelve a entrar.
            </p>
            <a href="${hf}" style="display:inline-flex; align-items:center; justify-content:center; gap:10px; min-width:220px; padding:14px 18px; border-radius:12px; background:#171717; color:#fff; text-decoration:none; font-weight:700; font-size:15px; box-shadow:0 12px 28px rgba(23, 23, 23, 0.28);">
                <i class="fa-solid fa-right-to-bracket"></i>
                <span>Ir a iniciar sesión</span>
            </a>
            <p style="margin:16px 0 0; font-size:12px; color:#a49fa6;">
                Cuando tu sesión esté activa, recarga esta página para ingresar.
            </p>
        </div>
    `,document.body.appendChild(n)}M_();function D_(){console.log("[Auth] Setting up user authentication...");const t=document.getElementById("user-profile-container");if(!t){console.warn("[Auth] user-profile-container not found");return}const e=pf();if(e)try{console.log("[Auth] User found:",e.name);const i=document.createElement("span"),o=e.name?e.name.split(" ")[0]:"Usuario";i.textContent=`Hola, ${o}`,i.style.fontSize="14px",i.style.fontWeight="500",i.style.color="var(--text-dark-gray)";const n=document.createElement("div");n.style.width="32px",n.style.height="32px",n.style.borderRadius="50%",n.style.backgroundColor="var(--primary-color)",n.style.color="white",n.style.display="flex",n.style.alignItems="center",n.style.justifyContent="center",n.style.fontSize="14px",n.style.fontWeight="bold";let s="U";if(e.name){const a=e.name.split(" ");a.length>=2?s=(a[0][0]+a[1][0]).toUpperCase():s=a[0][0].toUpperCase()}n.textContent=s,n.title=e.name+(e.role?` (${e.role})`:"");const r=document.createElement("button");r.innerHTML='<i class="fa-solid fa-right-from-bracket"></i>',r.title="Cerrar Sesión",r.style.background="none",r.style.border="none",r.style.cursor="pointer",r.style.fontSize="16px",r.style.color="#666",r.style.marginLeft="5px",r.onmouseover=()=>{r.style.color="#e91e63"},r.onmouseout=()=>{r.style.color="#666"},r.onclick=()=>{confirm("¿Cerrar sesión?")&&(sessionStorage.removeItem("userAccount"),localStorage.removeItem("userAccount"),window.location.reload())},t.appendChild(i),t.appendChild(n),t.appendChild(r)}catch(i){console.error("[Auth] Error rendering user account:",i),Sd(t)}else console.log("[Auth] No user found. Rendering guest mode."),Sd(t)}function Sd(t){const e=document.createElement("a");e.href=hf,e.innerHTML='<i class="fa-solid fa-user"></i> <span style="margin-left:5px; font-size:14px;">Iniciar Sesión</span>',e.style.textDecoration="none",e.style.color="var(--primary-color)",e.style.display="flex",e.style.alignItems="center",e.style.fontWeight="500",e.removeAttribute("target"),t.appendChild(e)}z_();D_();window.location.search.includes("test=auth")&&(console.log("Running Auth Tests..."),Of(async()=>{const{runViewpointAuthTests:t}=await import("./auth-viewpoints.test-OmETf-1K.js");return{runViewpointAuthTests:t}},__vite__mapDeps([0,1]),import.meta.url).then(({runViewpointAuthTests:t})=>(window.runAuthTests=t,t())).then(()=>{console.log("Auth Tests Completed.")}).catch(t=>{console.error("Auth Tests Failed:",t)}));
