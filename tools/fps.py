import sys, asyncio
from playwright.async_api import async_playwright
w, h = map(int, (sys.argv[1] if len(sys.argv) > 1 else '1512x913').split('x'))
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(channel='chrome', args=['--use-angle=metal', '--ignore-gpu-blocklist'])
        pg = await (await b.new_context(viewport={'width': w, 'height': h})).new_page()
        await pg.goto('http://127.0.0.1:5188/?debug=1')
        await pg.wait_for_function('window.__mofo', timeout=90000)
        for i in [0, 1, 2, 3, 4]:
            await pg.evaluate(f'window.__mofo.go({i})')
            await pg.wait_for_timeout(1500)
            fps = await pg.evaluate('new Promise(r=>{let n=0;const t0=performance.now();const f=()=>{n++; if(performance.now()-t0<2000) requestAnimationFrame(f); else r(n/((performance.now()-t0)/1000));};requestAnimationFrame(f);})')
            pr = await pg.evaluate('window.__mofo.quality.pr')
            print(f'page {i}: {fps:.1f} fps  pr {pr}')
        await b.close()
asyncio.run(main())
