import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import mustache from 'mustache';
import path from 'path';

export async function generatePDFReport(data: any): Promise<Uint8Array> {
  const templatePath = path.join(__dirname, '../templates/reportTemplate.html');
  const templateHtml = await fs.readFile(templatePath, 'utf8');

  const html = mustache.render(templateHtml, data);

  const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});

  const page = await browser.newPage();

  await page.setContent(html, { waitUntil: 'networkidle0' });
  const pdfBuffer = await page.pdf({ format: 'A4' });

  await browser.close();
  return pdfBuffer;
}

