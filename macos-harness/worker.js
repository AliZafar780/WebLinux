// QEMU-WASM worker (CLASSIC worker so importScripts exists -> emscripten detects
// ENVIRONMENT_IS_WORKER correctly; out.js is ESM, loaded via dynamic import()).
const log = (t) => { postMessage({ type: 'term', text: t }); };

(async () => {
  log('worker: loading engine (out.js)...');
  const factory = (await import('./out.js')).default;
  log('worker: engine imported');

  const Module = await factory({
    noInitialRun: true,
    arguments: [],
    print: (t) => log(t),
    printErr: (t) => log(t),
    mainScriptUrlOrBlob: new URL('./out.js', self.location.href).href,
    locateFile: (p) => new URL(p, self.location.href).href
  });
  log('worker: engine ready (runtime initialized)');

  // ---- inject files into the emulator FS ----
  const putFile = async (fsPath, url) => {
    const res = await fetch(url);
    const buf = new Uint8Array(await res.arrayBuffer());
    const parts = fsPath.split('/').filter(Boolean);
    let cur = '';
    for (const p of parts.slice(0, -1)) {
      cur += '/' + p;
      try { Module.FS.mkdir(cur); } catch (e) {}
    }
    Module.FS.writeFile(fsPath, buf);
    log('worker: injected ' + url.split('/').pop() + ' -> ' + fsPath + ' (' + (buf.length / 1048576).toFixed(1) + ' MB)');
  };

  self.onmessage = async (ev) => {
    const args = ev.data && ev.data.args ? ev.data.args : [
      '-nographic', '-M', 'q35', '-m', '2048M', '-accel', 'tcg,tb-size=500',
      '-bios', '/bios/edk2-x86_64-code.fd', '-device', 'isa-applesmc'
    ];
    const files = (ev.data && ev.data.files) || [{ fs: '/bios/edk2-x86_64-code.fd', url: new URL('./edk2-x86_64-code.fd', self.location.href).href }];
    try {
      for (const f of files) await putFile(f.fs, f.url);
      log('worker: QEMU args: ' + args.join(' '));
      Module.arguments = args;
      Module.callMain(args);
      log('worker: QEMU exited');
    } catch (e) {
      log('worker: ERROR ' + (e && e.message ? e.message : e));
    }
  };
  log('worker: ready, waiting for boot command');
  postMessage({ type: 'ready' });
})().catch((e) => log('worker FATAL: ' + (e && e.message ? e.message : e)));
