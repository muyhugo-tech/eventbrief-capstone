import { readFile } from 'node:fs/promises';
import { quoteFonts, standaloneGuestQuote } from '../public/quote-document.mjs';
import { standaloneKitchenSheet } from '../public/kitchen-document.mjs';

export const quoteFontPath = file => {
  const font=quoteFonts.find(font=>font.file===file);
  return font?new URL(`../node_modules/@fontsource/${font.package}/files/${font.file}`,import.meta.url):null;
};
let fontCss;
async function embeddedFontCss() {
  fontCss??=Promise.all(quoteFonts.map(async font=>`@font-face{font-family:'${font.family}';font-style:normal;font-weight:${font.weight};src:url(data:font/woff2;base64,${(await readFile(quoteFontPath(font.file))).toString('base64')}) format('woff2')}`)).then(rules=>rules.join('\n'));
  return fontCss;
}
export async function quotePdfHtml(document,prepared,reviewed) {
  return standaloneGuestQuote(document,prepared,reviewed,{fontCss:await embeddedFontCss()});
}
export async function kitchenPdfHtml(document,prepared,reviewed) {
  return standaloneKitchenSheet(document,prepared,reviewed,{fontCss:await embeddedFontCss()});
}

// Reuses the source application's HTML-to-PDF launch pattern. This browser
// renders only our escaped, self-contained template; it never visits a URL.
export async function renderQuotePdf(html) {
  const {chromium}=await import('playwright-core');
  let browser;
  if(process.env.VERCEL) {
    const sparticuz=(await import('@sparticuz/chromium')).default;
    browser=await chromium.launch({executablePath:await sparticuz.executablePath(),args:sparticuz.args,headless:true,timeout:30000});
  } else {
    for(const channel of ['msedge','chrome']) {
      try {browser=await chromium.launch({channel,headless:true,timeout:15000});break;} catch { /* Try the next installed PDF engine. */ }
    }
    if(!browser)throw new Error('PDF rendering needs Microsoft Edge or Google Chrome on this computer.');
  }
  try {
    const context=await browser.newContext({javaScriptEnabled:false,serviceWorkers:'block'});
    await context.route('**/*',route=>route.abort());
    const page=await context.newPage();
    page.setDefaultTimeout(20000);
    await page.setContent(html,{waitUntil:'load',timeout:20000});
    await page.evaluate(()=>document.fonts.ready);
    return await page.pdf({format:'Letter',preferCSSPageSize:true,printBackground:true,timeout:20000});
  } finally {await browser.close();}
}
