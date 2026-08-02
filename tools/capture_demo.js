// Demo GIF capture v2: uses Page.startScreencast (continuous compositing) to catch
// every visible change. Drives the guest: boot -> udhcpc -> ping -> wget -> hero shot.
// Usage: node tools/capture_demo.js   (serve.py must be running)
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const OUT = path.join(__dirname, '..', '_frames');
const HERO = path.join(__dirname, '..', 'hero.png');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) fs.unlinkSync(path.join(OUT, f));

const SC = {
  a:0x1E,b:0x30,c:0x2E,d:0x20,e:0x12,f:0x21,g:0x22,h:0x23,i:0x17,j:0x24,k:0x25,l:0x26,
  m:0x32,n:0x31,o:0x18,p:0x19,q:0x10,r:0x13,s:0x1F,t:0x14,u:0x16,v:0x2F,w:0x11,x:0x2D,
  y:0x15,z:0x2C,
  '0':0x0B,'1':0x02,'2':0x03,'3':0x04,'4':0x05,'5':0x06,'6':0x07,'7':0x08,'8':0x09,'9':0x0A,
  ' ':0x39,'.':0x34,'-':0x0C,'/':0x35,'=':0x0D,'\n':0x1C,'|':0x2B,'\\':0x2B,';':0x27,':':0x27,
  '_':0x0C,'+':0x0D,'?':0x35
};
const SHIFTED = { '|':1, '_':1, ':':1, '+':1, '?':1 };
function type(str) {
  const codes = [];
  for (const ch of str) {
    let sc = SC[ch.toLowerCase ? ch.toLowerCase() : ch];
    let needShift = false;
    if (sc === undefined) sc = SC[ch];
    if (sc === undefined) continue;
    if (/[A-Z]/.test(ch)) needShift = true;
    if (SHIFTED[ch]) needShift = true;
    if (needShift) codes.push(0x2A);
    codes.push(sc, sc | 0x80);
    if (needShift) codes.push(0xAA);
  }
  return codes;
}

(async () => {
  const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--force-device-scale-factor=1',
    '--remote-debugging-port=9392',
    '--user-data-dir=C:/Users/PRECIS~1/AppData/Local/Temp/opencode/chrome-cdp9392',
    '--no-first-run', '--window-size=1280,900', 'about:blank'
  ], { stdio: 'ignore' });
  let target = null;
  for (let i = 0; i < 40; i++) {
    try { const list = await (await fetch('http://127.0.0.1:9392/json/list')).json(); const t = list.find((x) => x.type === 'page'); if (t) { target = t; break; } } catch (e) {}
    await sleep(500);
  }
  if (!target) { console.error('NO TARGET'); process.exit(1); }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let id = 0; const pending = new Map();
  const send = (method, params) => new Promise((res, rej) => { const mid = ++id; pending.set(mid, { res, rej }); ws.send(JSON.stringify({ id: mid, method, params: params || {} })); });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      m.error ? p.rej(new Error(m.error.message)) : p.res(m.result);
    } else if (m.method === 'Page.screencastFrame') {
      // save frame + MUST ack to keep the stream going
      frameSeq++;
      const data = m.params.data; // base64 jpeg
      fs.writeFileSync(path.join(OUT, 'frame_' + String(frameSeq).padStart(4, '0') + '.jpg'), Buffer.from(data, 'base64'));
      send('Page.screencastFrameAck', { sessionId: m.params.sessionId }).catch(() => {});
    }
  };
  await new Promise((r) => { ws.onopen = r; });
  await send('Runtime.enable'); await send('Page.enable');
  let frameSeq = 0;
  await send('Page.startScreencast', { format: 'jpeg', quality: 70, everyNthFrame: 1, maxWidth: 1280, maxHeight: 900 });
  await send('Page.navigate', { url: 'http://127.0.0.1:8001/index.html' });

  const screenText = async () => {
    const r = await send('Runtime.evaluate', {
      expression: `(function(){ var c = document.getElementById('screen_container'); var k = c ? c.querySelectorAll('div')[0] : null; if (!k) return ''; var out = []; for (var i = 0; i < k.children.length; i++) out.push(k.children[i].textContent || ''); return out.join('\\n'); })()`,
      returnByValue: true
    });
    return r.result.value || '';
  };
  const inject = async (codes) => {
    await send('Runtime.evaluate', { expression: `(function(){ var e = window.__emu; var codes = ${JSON.stringify(codes)}; for (var i = 0; i < codes.length; i++) e.bus.send('keyboard-code', codes[i]); })()`, returnByValue: true });
  };

  const t0 = Date.now();
  console.log('capturing boot (screencast)...');
  let done = false;
  let stage = 0, stageWait = 0;

  while (!done) {
    await sleep(300);
    const txt = await screenText();
    if (stage === 0 && txt.includes('~%')) {
      stage = 1; stageWait = 0;
      console.log('shell up at T+' + Math.round((Date.now() - t0) / 1000) + 's â€” typing udhcpc');
      await inject([0x1C, 0x9C]); await sleep(600); await inject(type('udhcpc\n'));
    } else if (stage === 1) {
      if (txt.includes('lease of')) { stage = 2; stageWait = 0; console.log('DHCP lease â€” pinging'); await sleep(300); await inject(type('ping -c 3 1.1.1.1\n')); }
      else if (++stageWait > 50) { stage = 2; stageWait = 0; await inject(type('ping -c 3 1.1.1.1\n')); }
    } else if (stage === 2) {
      if (txt.includes('0% packet loss')) { stage = 3; stageWait = 0; console.log('PING OK â€” wget'); await sleep(300); await inject(type('wget -O - http://example.com | head -4\n')); }
      else if (++stageWait > 50) { stage = 3; stageWait = 0; await inject(type('wget -O - http://example.com | head -4\n')); }
    } else if (stage === 3) {
      if (txt.includes('written to stdout') || txt.includes('<!doctype')) {
        stage = 4; stageWait = 0;
        console.log('WGET OK â€” hero shot');
        await sleep(1800);
        const hero = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
        fs.writeFileSync(HERO, Buffer.from(hero.data, 'base64'));
        console.log('hero.png saved');
      } else if (++stageWait > 50) { stage = 4; stageWait = 0; }
    } else if (stage === 4) {
      if (++stageWait > 8) { done = true; }
    }
    if (Date.now() - t0 > 180000) { console.log('TIMEOUT'); done = true; }
  }
  await send('Page.stopScreencast').catch(() => {});
  console.log('done, ' + frameSeq + ' frames captured');
  chrome.kill();
  process.exit(0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
