// AAA Snake v1.9: the remaster. The game still draws every frame into its 2D canvas, now hidden;
// this file shows that canvas through the one WebGL post-processing pass the budget allows: one
// texture upload, one program, one draw call a frame, no framebuffers, no 3D. The shader adds a
// bloom (a 13-tap glow of the bright parts), chromatic aberration toward the edges, a warm colour
// grade, a vignette and film grain (from a frame counter, not a clock).
// Also here: the "REMASTERED" launch screen (Upgrade to Remastered, PARODY; the minimum
// requirements, measured, from requirements.js; graphics presets, all Ultra).

// The pass draws at the screen's own resolution (Retina: 2 pixels per point) times this.
// Lower it only if the measured frame rate falls below the budget (DEVLOG.md says by how much).
const REMASTER = { scale: 1, listensAfter: 3000 };

const post = { gl: null, canvas: null, texture: null, uniforms: null, frame: 0 };

const VERTEX = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FRAGMENT = `
precision mediump float;
uniform sampler2D u_src;
uniform vec2 u_texel;
uniform vec2 u_res;
uniform float u_frame;
varying vec2 v_uv;
vec3 bright(vec2 uv) {
  return max(texture2D(u_src, uv).rgb - 0.6, 0.0) * 2.5;
}
void main() {
  vec2 d = v_uv - 0.5;
  float r = length(d);
  vec2 shift = d * r * 0.012; // chromatic aberration, none in the middle
  vec3 col = vec3(texture2D(u_src, v_uv + shift).r, texture2D(u_src, v_uv).g, texture2D(u_src, v_uv - shift).b);
  vec3 glow = bright(v_uv) * 0.2;
  for (int i = 1; i <= 3; i++) {
    float s = float(i) * 2.5;
    glow += (bright(v_uv + vec2(s, 0.0) * u_texel) + bright(v_uv - vec2(s, 0.0) * u_texel)
           + bright(v_uv + vec2(0.0, s) * u_texel) + bright(v_uv - vec2(0.0, s) * u_texel)) * (0.2 / float(i));
  }
  col += glow * 0.6;
  col *= vec3(1.05, 1.0, 0.92); // warm
  float grey = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(grey), col, 1.1);
  col *= 1.0 - smoothstep(0.35, 0.85, r) * 0.6; // vignette
  float n = fract(sin(dot(floor(v_uv * u_res) + mod(u_frame, 64.0) * vec2(17.0, 31.0), vec2(12.9898, 78.233))) * 43758.5453);
  col += (n - 0.5) * 0.04; // grain
  gl_FragColor = vec4(col, 1.0);
}`;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
  return shader;
}

// Set the pass up on the page's WebGL canvas. Without WebGL the 2D canvas is shown as it is.
function startRemaster(source) {
  const canvas = document.getElementById('screen');
  const gl = canvas && canvas.getContext('webgl', { antialias: false, alpha: false, depth: false });
  if (!gl) {
    if (canvas) canvas.style.display = 'none';
    source.style.display = 'block';
    return;
  }
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
  gl.linkProgram(program);
  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW); // one triangle covers the screen
  const at = gl.getAttribLocation(program, 'a_pos');
  gl.enableVertexAttribArray(at);
  gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0);
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  const uniform = name => gl.getUniformLocation(program, name);
  Object.assign(post, { gl, canvas, texture, uniforms: { texel: uniform('u_texel'), res: uniform('u_res'), frame: uniform('u_frame') } });
}

// Every frame: the 2D canvas, through the pass, onto the screen.
function presentRemaster(source) {
  const { gl, canvas, uniforms } = post;
  if (!gl) return;
  const ratio = (window.devicePixelRatio || 1) * REMASTER.scale;
  const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
  const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  gl.viewport(0, 0, width, height);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  gl.uniform2f(uniforms.texel, 1 / source.width, 1 / source.height);
  gl.uniform2f(uniforms.res, width, height);
  gl.uniform1f(uniforms.frame, post.frame++);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

// The REMASTERED screen, after the title.
function drawRemastered(ctx, time, width, height) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = GOLD;
  ctx.font = 'bold 30px Georgia, serif';
  ctx.fillText('REMASTERED', width / 2, 52);
  ctx.fillStyle = '#ddd';
  ctx.font = '14px Helvetica, Arial, sans-serif';
  ctx.fillText('Upgrade to Remastered: included. Nothing to pay.', width / 2, 88);
  ctx.fillStyle = '#e0245e';
  ctx.fillRect(width / 2 - 37, 104, 74, 22);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px Helvetica, Arial, sans-serif';
  ctx.fillText('PARODY', width / 2, 115);

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px Helvetica, Arial, sans-serif';
  ctx.fillText('MINIMUM REQUIREMENTS', width / 2, 168);
  ctx.font = '13px Menlo, monospace';
  const rows = [
    ['Download', `${REQUIREMENTS.downloadBytes.toLocaleString('en-US')} bytes`],
    ['Memory (JS heap)', `${REQUIREMENTS.heapAfterGcBytes.toLocaleString('en-US')} bytes`],
    ['Storage (assets)', `${REQUIREMENTS.assetBytes.toLocaleString('en-US')} bytes`],
  ];
  rows.forEach(([label, value], i) => {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#aaa';
    ctx.fillText(label, 70, 200 + i * 26);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff';
    ctx.fillText(value, width - 70, 200 + i * 26);
  });
  ctx.textAlign = 'center';
  ctx.fillStyle = '#777';
  ctx.font = '11px Helvetica, Arial, sans-serif';
  ctx.fillText(`As measured for ${REQUIREMENTS.from} (${REQUIREMENTS.kind}, ${REQUIREMENTS.measuredAt.slice(0, 10)}).`, width / 2, 284);

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px Helvetica, Arial, sans-serif';
  ctx.fillText('GRAPHICS PRESET', width / 2, 330);
  const presets = ['Ultra', 'Ultra', 'Ultra', 'Ultra'];
  presets.forEach((name, i) => {
    const x = 60 + i * 95;
    const chosen = i === 3;
    ctx.fillStyle = chosen ? '#3a3216' : '#1a1e29';
    ctx.strokeStyle = chosen ? GOLD : '#444';
    ctx.lineWidth = 2;
    ctx.fillRect(x, 350, 80, 34);
    ctx.strokeRect(x, 350, 80, 34);
    ctx.fillStyle = chosen ? GOLD : '#ccc';
    ctx.font = 'bold 14px Helvetica, Arial, sans-serif';
    ctx.fillText(name, x + 40, 367);
  });
  if (time >= REMASTER.listensAfter) {
    ctx.fillStyle = '#aaa';
    ctx.font = '16px Helvetica, Arial, sans-serif';
    ctx.fillText('Press Enter to continue', width / 2, height - 70);
  }
}
