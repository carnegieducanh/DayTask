import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1120, height: 500 } });
await page.goto('file:///C:/Users/huydu/AppData/Local/Temp/claude/c--Users-huydu-Desktop-atomic-task/220fd1b5-1e70-4ee6-ba33-aa996c99da9f/scratchpad/grid_check2.html');
await page.waitForTimeout(300);

const info = await page.evaluate(() => {
  const covers = Array.from(document.querySelectorAll('.books-card-cover')).map(c => c.getBoundingClientRect());
  return covers.map(r => ({ width: r.width, height: r.height }));
});
console.log(JSON.stringify(info, null, 2));

await page.screenshot({ path: 'C:\\Users\\huydu\\AppData\\Local\\Temp\\claude\\c--Users-huydu-Desktop-atomic-task\\220fd1b5-1e70-4ee6-ba33-aa996c99da9f\\scratchpad\\grid_check2.png' });
await browser.close();
