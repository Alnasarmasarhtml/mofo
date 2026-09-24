# usage: uv run --with playwright python tools/shot.py [pages] [WxH ...]
# pages like "0,1,2" ; captures each page after settling. Saves shots/p{page}_{w}x{h}.png
import sys, asyncio, time, json
from playwright.async_api import async_playwright

URL = __import__('os').environ.get('URL', 'http://127.0.0.1:5188/?debug=1')
pages = [int(x) for x in (sys.argv[1] if len(sys.argv) > 1 else '0').split(',')]
sizes = [tuple(map(int, s.split('x'))) for s in (sys.argv[2:] or ['1512x913'])]
settle = float(__import__('os').environ.get('SETTLE', '2.2'))

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(channel='chrome', args=['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'])
        for (w, h) in sizes:
            mob = __import__('os').environ.get('MOBILE')
            ctx = await b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=(3 if mob else int(__import__('os').environ.get('DSF','1'))), is_mobile=bool(mob), has_touch=bool(mob))
            pg = await ctx.new_page()
            logs = []
            pg.on('console', lambda m: logs.append(m.type + ': ' + m.text))
            pg.on('pageerror', lambda e: logs.append('PAGEERROR: ' + str(e)))
            await pg.goto(URL)
            try:
                await pg.wait_for_function('window.__mofo', timeout=90000)
            except Exception as e:
                print('timeout waiting __mofo'); print('\n'.join(logs[-30:]))
                await pg.screenshot(path=f'shots/fail_{w}x{h}.png'); continue
            info = await pg.evaluate('(() => { const g = document.getElementById("gl").getContext("webgl2"); const d = g && g.getExtension("WEBGL_debug_renderer_info"); return d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : "?" })()')
            print('renderer:', info)
            for i in pages:
                await pg.evaluate(f'window.__mofo.go({i})')
                pre = __import__('os').environ.get('EVAL')
                if pre:
                    await pg.wait_for_timeout(1500)
                    await pg.evaluate(pre)
                await pg.wait_for_timeout(int(settle * 1000))
                fps = await pg.evaluate('window.__mofo.quality.pr')
                path = f'shots/{__import__("os").environ.get("TAG","p")}{i}_{w}x{h}.png'
                await pg.screenshot(path=path)
                print('saved', path, 'pr', fps)
            errs = [l for l in logs if 'error' in l.lower() or 'PAGEERROR' in l]
            if errs: print('\n'.join(errs[:20]))
            await ctx.close()
        await b.close()

asyncio.run(main())
