# captures the tool page at several scroll depths: uv run --with playwright python tools/doc.py WxH [mobile]
import sys, asyncio
from playwright.async_api import async_playwright
w, h = map(int, sys.argv[1].split('x'))
mob = len(sys.argv) > 2
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(channel='chrome', args=['--use-angle=metal'])
        ctx = await b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=(3 if mob else 1), is_mobile=mob, has_touch=mob)
        pg = await ctx.new_page()
        await pg.goto('http://127.0.0.1:5188/?debug=1')
        await pg.wait_for_function('window.__mofo', timeout=90000)
        await pg.evaluate('window.__mofo.go(5)')
        await pg.wait_for_timeout(3000)
        total = await pg.evaluate('document.getElementById("doc").scrollHeight')
        n = 0
        for y in range(0, total, int(h * 0.9)):
            await pg.evaluate(f'document.getElementById("doc").scrollTop = {y}')
            await pg.wait_for_timeout(1300)
            await pg.screenshot(path=f'shots/doc_{w}_{n}.png')
            n += 1
        # strict fit check: nothing in the document sticks out past the viewport
        bad = await pg.evaluate('''(() => { const out = []; const W = innerWidth; for (const el of document.querySelectorAll('#doc *')) { const r = el.getBoundingClientRect(); if (r.width === 0) continue; if (r.right > W + 1.5 || r.left < -1.5) out.push(el.tagName + '.' + el.className + ' ' + Math.round(r.left) + '..' + Math.round(r.right)); } return out.slice(0, 12); })()''')
        print('frames', n, 'height', total, 'overflow', bad)
        await b.close()
asyncio.run(main())
