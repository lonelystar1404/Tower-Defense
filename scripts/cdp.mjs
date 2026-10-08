// Tiny Chrome DevTools Protocol driver (Chrome on port 9333): device emulation, touch taps, screenshots. No dependencies.
import { writeFileSync } from 'node:fs';

export async function open() {
  const targets = await (await fetch('http://localhost:9333/json/list')).json();
  let page = targets.find((t) => t.type === 'page');
  if (!page) page = await (await fetch('http://localhost:9333/json/new?about:blank', { method: 'PUT' })).json();
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let id = 0;
  const pending = new Map();
  const logs = [];
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    } else if (msg.method === 'Runtime.exceptionThrown') logs.push('EXCEPTION ' + JSON.stringify(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text));
    else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') logs.push('console.error ' + msg.params.args.map((a) => a.value ?? a.description).join(' '));
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const n = ++id;
      pending.set(n, { resolve, reject });
      ws.send(JSON.stringify({ id: n, method, params }));
    });
  await send('Runtime.enable');
  await send('Page.enable');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const api = {
    send,
    sleep,
    logs,
    async emulate(width, height, { mobile = true, dpr = 3 } = {}) {
      await send('Emulation.setDeviceMetricsOverride', {
        width, height, deviceScaleFactor: dpr, mobile,
        screenOrientation: width > height ? { type: 'landscapePrimary', angle: 90 } : { type: 'portraitPrimary', angle: 0 },
      });
      await send('Emulation.setTouchEmulationEnabled', { enabled: mobile, maxTouchPoints: mobile ? 5 : 0 });
      await send('Emulation.setEmitTouchEventsForMouse', { enabled: mobile, configuration: mobile ? 'mobile' : 'desktop' });
    },
    async goto(url) {
      await send('Page.navigate', { url });
      await sleep(1500);
    },
    async eval(expression) {
      const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
      return r.result.value;
    },
    async tap(x, y, holdMs = 40) {
      await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      await sleep(holdMs);
      await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await sleep(120);
    },
    async click(x, y, button = 'left') {
      for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased'])
        await send('Input.dispatchMouseEvent', { type, x, y, button, clickCount: 1 });
      await sleep(100);
    },
    /** Center of the first element matching the selector, in CSS pixels. */
    async center(selector) {
      return api.eval(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    },
    /** Center of map tile (col, row) in CSS pixels. */
    async tile(col, row) {
      return api.eval(`(() => { const r = document.getElementById('game').getBoundingClientRect(); return { x: r.left + (${col} + 0.5) * r.width / 20, y: r.top + (${row} + 0.5) * r.height / 12 }; })()`);
    },
    async shot(path) {
      const r = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(path, Buffer.from(r.data, 'base64'));
    },
    close: () => ws.close(),
  };
  return api;
}
