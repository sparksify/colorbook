import OpenAI from 'openai';

export const config = {
  api: {
    bodyParser: { sizeLimit: '6mb' },
    responseLimit: '20mb',
  },
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { characterDescriptor, scene, complexityModifier, childName, imageBase64, mimeType } = req.body;

    if (!characterDescriptor || !scene) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const nameClause = childName ? `The child's name is ${childName}. ` : '';

    const prompt = `Transform the child shown in the reference photo into a black and white coloring book illustration character.

CRITICAL: The child in the reference photo must be the character in this illustration. Preserve their exact appearance:
- Their specific hair style (mohawk, spiky, curly, straight etc) exactly as shown
- Their face shape, eye shape, and facial features
- Any glasses, necklace, or accessories
- Their skin tone represented through line art shading patterns if needed

STYLE: Pure black outlines on white background only. No color, no gray fills, no shading. Bold clean lines. Comic book coloring page style. Every area clearly bounded for coloring in.

${nameClause}SCENE: The child is ${scene}.

${complexityModifier || 'Include a fun detailed background setting'}.

Make the child recognizable as the specific child in the reference photo — not a generic cartoon child.`;

    let response;

    if (imageBase64) {
      // Send compressed reference photo for visual anchoring
      const imageBuffer = Buffer.from(imageBase64, 'base64');
      const blob = new Blob([imageBuffer], { type: mimeType || 'image/jpeg' });
      const imageFile = new File([blob], 'reference.jpg', { type: mimeType || 'image/jpeg' });

      response = await openai.images.edit({
        model: 'gpt-image-1',
        image: imageFile,
        prompt,
        n: 1,
        size: '1024x1792',
      });
    } else {
      response = await openai.images.generate({
        model: 'gpt-image-1',
        prompt: `${prompt}\n\nCharacter description: ${characterDescriptor}`,
        n: 1,
        size: '1024x1792',
      });
    }

    const imageData = response.data[0];

    if (imageData.b64_json) {
      return res.status(200).json({ b64: imageData.b64_json });
    }

    if (imageData.url) {
      const imgRes = await fetch(imageData.url);
      const arrayBuffer = await imgRes.arrayBuffer();
      const b64 = Buffer.from(arrayBuffer).toString('base64');
      return res.status(200).json({ b64 });
    }

    throw new Error('No image data returned');

  } catch (error) {
    console.error('Generate page error:', error?.message);
    return res.status(500).json({ error: error?.message || 'Failed to generate page' });
  }
}
