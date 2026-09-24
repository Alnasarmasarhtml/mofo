# renders the share image (1200x630) from the final page
import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(channel='chrome', args=['--use-angle=metal', '--ignore-gpu-blocklist'])
        pg = await (await b.new_context(viewport={'width': 1200, 'height': 630}, device_scale_factor=2)).new_page()
        await pg.goto('http://127.0.0.1:5188/?debug=1')
        await pg.wait_for_function('window.__mofo', timeout=90000)
        await pg.add_style_tag(content='.top-right,.rail,.hud,.subs,.final-row,.final-fine,#cursor{display:none!important}')
        await pg.evaluate('window.__mofo.go(4)')
        await pg.wait_for_timeout(4500)
        await pg.screenshot(path='shots/og_2x.png')
        await b.close()
asyncio.run(main())
