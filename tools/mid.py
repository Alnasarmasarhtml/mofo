# capture frames at fractional scroll values: uv run --with playwright python tools/mid.py 0.5,1.34,1.6 [WxH]
import sys, asyncio
from playwright.async_api import async_playwright
vals = [float(x) for x in sys.argv[1].split(',')]
w, h = map(int, (sys.argv[2] if len(sys.argv) > 2 else '1512x913').split('x'))
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(channel='chrome', args=['--use-angle=metal', '--ignore-gpu-blocklist'])
        pg = await (await b.new_context(viewport={'width': w, 'height': h})).new_page()
        await pg.goto('http://127.0.0.1:5188/?debug=1')
        await pg.wait_for_function('window.__mofo', timeout=90000)
        for v in vals:
            page = round(v)
            await pg.evaluate(f'window.__mofo.go({page})')
            await pg.wait_for_timeout(900)
            await pg.evaluate(f'(()=>{{const s=window.__mofo.scroller; s.target={v}; s.value={v}; s.vel=0;}})()')
            await pg.wait_for_timeout(700)
            await pg.screenshot(path=f'shots/mid_{v}.png')
            print('saved', v)
        await b.close()
asyncio.run(main())
