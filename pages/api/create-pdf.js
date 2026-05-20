import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
    responseLimit: '50mb',
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { images, childName, theme, pageCount } = req.body;

    if (!images || images.length === 0) {
      return res.status(400).json({ error: 'No images provided' });
    }

    const pdfDoc = await PDFDocument.create();
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // US Letter: 8.5" x 11" at 72dpi = 612 x 792 points
    const pageWidth = 612;
    const pageHeight = 792;
    const margin = 36; // 0.5 inch margins
    const headerHeight = 40;
    const footerHeight = 24;
    const imageAreaWidth = pageWidth - margin * 2;
    const imageAreaHeight = pageHeight - margin * 2 - headerHeight - footerHeight;
    // Keep image square, centered
    const imageSize = Math.min(imageAreaWidth, imageAreaHeight);
    const imageX = margin + (imageAreaWidth - imageSize) / 2;
    const imageY = margin + footerHeight;

    const bookTitle = childName
      ? `${childName}'s ${theme} Adventure`
      : `My ${theme} Adventure`;

    for (let i = 0; i < images.length; i++) {
      const { b64, url } = images[i];
      const page = pdfDoc.addPage([pageWidth, pageHeight]);

      // Header
      page.drawText(bookTitle.toUpperCase(), {
        x: margin,
        y: pageHeight - margin - 16,
        size: 11,
        font: helveticaBold,
        color: rgb(0.2, 0.2, 0.2),
      });

      page.drawLine({
        start: { x: margin, y: pageHeight - margin - 22 },
        end: { x: pageWidth - margin, y: pageHeight - margin - 22 },
        thickness: 0.5,
        color: rgb(0.8, 0.8, 0.8),
      });

      // Embed image
      if (b64) {
        try {
          const imageBytes = Buffer.from(b64, 'base64');
          const pngImage = await pdfDoc.embedPng(imageBytes);
          page.drawImage(pngImage, {
            x: imageX,
            y: imageY,
            width: imageSize,
            height: imageSize,
          });
        } catch (imgError) {
          // If image embed fails, draw a placeholder box
          console.error(`Failed to embed image ${i + 1}:`, imgError.message);
          page.drawRectangle({
            x: imageX,
            y: imageY,
            width: imageSize,
            height: imageSize,
            borderColor: rgb(0.8, 0.8, 0.8),
            borderWidth: 1,
          });
          page.drawText('Image unavailable', {
            x: imageX + imageSize / 2 - 50,
            y: imageY + imageSize / 2,
            size: 12,
            font: helvetica,
            color: rgb(0.7, 0.7, 0.7),
          });
        }
      }

      // Decorative border around image
      page.drawRectangle({
        x: imageX - 2,
        y: imageY - 2,
        width: imageSize + 4,
        height: imageSize + 4,
        borderColor: rgb(0.85, 0.85, 0.85),
        borderWidth: 0.5,
      });

      // Footer: page number
      const pageLabel = `Page ${i + 1} of ${images.length}`;
      page.drawText(pageLabel, {
        x: pageWidth / 2 - (pageLabel.length * 3.5),
        y: margin,
        size: 9,
        font: helvetica,
        color: rgb(0.6, 0.6, 0.6),
      });

      // Footer: coloring prompt
      const prompt = 'Color this page however you like! 🖍️';
      page.drawText(prompt, {
        x: margin,
        y: margin,
        size: 9,
        font: helvetica,
        color: rgb(0.7, 0.7, 0.7),
      });
    }

    // Cover page (insert at beginning)
    const coverPage = pdfDoc.insertPage(0, [pageWidth, pageHeight]);

    // Cover border
    coverPage.drawRectangle({
      x: margin,
      y: margin,
      width: pageWidth - margin * 2,
      height: pageHeight - margin * 2,
      borderColor: rgb(0.9, 0.6, 0.2),
      borderWidth: 2,
    });
    coverPage.drawRectangle({
      x: margin + 6,
      y: margin + 6,
      width: pageWidth - margin * 2 - 12,
      height: pageHeight - margin * 2 - 12,
      borderColor: rgb(0.9, 0.7, 0.3),
      borderWidth: 0.5,
    });

    // Cover title
    coverPage.drawText('MY COLORING BOOK', {
      x: pageWidth / 2 - 120,
      y: pageHeight / 2 + 80,
      size: 28,
      font: helveticaBold,
      color: rgb(0.15, 0.15, 0.15),
    });

    if (childName) {
      coverPage.drawText(`Created for ${childName}`, {
        x: pageWidth / 2 - (childName.length * 4 + 60),
        y: pageHeight / 2 + 30,
        size: 18,
        font: helveticaBold,
        color: rgb(0.97, 0.45, 0.09),
      });
    }

    coverPage.drawText(theme.toUpperCase() + ' ADVENTURE', {
      x: pageWidth / 2 - (theme.length * 5 + 50),
      y: pageHeight / 2 - 10,
      size: 16,
      font: helveticaBold,
      color: rgb(0.4, 0.4, 0.4),
    });

    coverPage.drawText(`${images.length} pages to color`, {
      x: pageWidth / 2 - 60,
      y: pageHeight / 2 - 60,
      size: 12,
      font: helvetica,
      color: rgb(0.6, 0.6, 0.6),
    });

    coverPage.drawText('colorbook.app', {
      x: pageWidth / 2 - 35,
      y: margin + 20,
      size: 9,
      font: helvetica,
      color: rgb(0.75, 0.75, 0.75),
    });

    const pdfBytes = await pdfDoc.save();
    const pdfBase64 = Buffer.from(pdfBytes).toString('base64');

    return res.status(200).json({ pdfBase64 });
  } catch (error) {
    console.error('PDF creation error:', error);
    return res.status(500).json({ error: error.message || 'Failed to create PDF' });
  }
}
