# records a full visit: intro, every page down, then back to the top. uv run --with playwright python tools/run.py [WxH]
import sys, asyncio, glob, os, shutil
from playwright.async_api import async_playwright
w, h = map(int, (sys.argv[1] if len(sys.argv) > 1 else '1512x913').split('x'))
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(channel='chrome', args=['--use-angle=metal', '--ignore-gpu-blocklist'])
        ctx = await b.new_context(viewport={'width': w, 'height': h}, record_video_dir='shots/vid', record_video_size={'width': w, 'height': h})
        pg = await ctx.new_page()
        logs = []
        pg.on('console', lambda m: logs.append(m.type + ': ' + m.text))
        pg.on('pageerror', lambda e: logs.append('PAGEERROR ' + str(e)))
        await pg.goto('http://127.0.0.1:5188/')
        await pg.mouse.move(w * 0.6, h * 0.45)
        await pg.wait_for_function('window.__mofo && window.__mofo.scroller.enabled', timeout=120000)
        await pg.wait_for_timeout(2500)
        for i in range(4):
            await pg.mouse.wheel(0, 120)
            await pg.wait_for_timeout(3600)
        for i in range(4):
            await pg.keyboard.press('ArrowUp')
            await pg.wait_for_timeout(2200)
        await ctx.close()
        await b.close()
        vids = sorted(glob.glob('shots/vid/*.webm'), key=os.path.getmtime)
        shutil.move(vids[-1], 'shots/run.webm')
        print('\n'.join([l for l in logs if 'rror' in l][:20]))
asyncio.run(main())
