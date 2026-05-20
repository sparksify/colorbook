import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export const config = {
  api: {
    bodyParser: { sizeLimit: '50mb' },
    responseLimit: '50mb',
  },
};

// Strip everything outside printable ASCII — kills emojis from GPT descriptors
function safe(str) {
  return String(str || '').replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, ' ').trim();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { images, childName, theme, pageCount } = req.body;
    if (!images || images.length === 0) return res.status(400).json({ error: 'No images provided' });

    const pdfDoc = await PDFDocument.create();
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const W = 612, H = 792, M = 36;
    const imgSize = Math.min(W - M * 2, H - M * 2 - 60);
    const imgX = M + (W - M * 2 - imgSize) / 2;
    const imgY = M + 24;

    const title = safe(childName ? childName + "'s " + theme + ' Adventure' : 'My ' + theme + ' Adventure');

    for (let i = 0; i < images.length; i++) {
      const page = pdfDoc.addPage([W, H]);
      page.drawText(title.toUpperCase(), { x: M, y: H - M - 16, size: 11, font: bold, color: rgb(0.2, 0.2, 0.2) });
      page.drawLine({ start: { x: M, y: H - M - 22 }, end: { x: W - M, y: H - M - 22 }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });

      const { b64 } = images[i];
      if (b64) {
        try {
          const pngImage = await pdfDoc.embedPng(Buffer.from(b64, 'base64'));
          page.drawImage(pngImage, { x: imgX, y: imgY, width: imgSize, height: imgSize });
        } catch (e) {
          console.error('Image embed failed page', i + 1, e.message);
        }
      }

      page.drawRectangle({ x: imgX - 2, y: imgY - 2, width: imgSize + 4, height: imgSize + 4, borderColor: rgb(0.85, 0.85, 0.85), borderWidth: 0.5 });

      const pageLabel = 'Page ' + (i + 1) + ' of ' + images.length;
      page.drawText(pageLabel, { x: W / 2 - pageLabel.length * 3.5, y: M, size: 9, font: regular, color: rgb(0.6, 0.6, 0.6) });
      page.drawText('Color this page however you like!', { x: M, y: M, size: 9, font: regular, color: rgb(0.7, 0.7, 0.7) });
    }

    const cover = pdfDoc.insertPage(0, [W, H]);
    cover.drawRectangle({ x: M, y: M, width: W - M*2, height: H - M*2, borderColor: rgb(0.9, 0.6, 0.2), borderWidth: 2 });
    cover.drawRectangle({ x: M+6, y: M+6, width: W - M*2 - 12, height: H - M*2 - 12, borderColor: rgb(0.9, 0.7, 0.3), borderWidth: 0.5 });
    cover.drawText('MY COLORING BOOK', { x: W/2 - 118, y: H/2 + 80, size: 28, font: bold, color: rgb(0.15, 0.15, 0.15) });

    if (childName) {
      const forLine = safe('Created for ' + childName);
      cover.drawText(forLine, { x: W/2 - forLine.length * 5, y: H/2 + 28, size: 18, font: bold, color: rgb(0.97, 0.45, 0.09) });
    }

    const themeLine = safe(theme.toUpperCase() + ' ADVENTURE');
    cover.drawText(themeLine, { x: W/2 - themeLine.length * 5, y: H/2 - 10, size: 16, font: bold, color: rgb(0.4, 0.4, 0.4) });
    cover.drawText(images.length + ' pages to color', { x: W/2 - 55, y: H/2 - 60, size: 12, font: regular, color: rgb(0.6, 0.6, 0.6) });
    cover.drawText('colorbook.app', { x: W/2 - 35, y: M + 20, size: 9, font: regular, color: rgb(0.75, 0.75, 0.75) });

    const pdfBytes = await pdfDoc.save();
    return res.status(200).json({ pdfBase64: Buffer.from(pdfBytes).toString('base64') });

  } catch (error) {
    console.error('PDF error:', error?.message);
    return res.status(500).json({ error: error?.message || 'Failed to create PDF' });
  }
}
