import OpenAI from 'openai';

export const config = {
  api: {
    bodyParser: { sizeLimit: '4mb' },
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

    const prompt = `Transform the child shown in the reference photo into a black and white coloring book illustration.

CRITICAL: Preserve the child's exact appearance from the photo:
- Hair style exactly as shown (mohawk, spiky, curly, straight, etc.)
- Face shape and facial features
- Any glasses, necklace, or accessories
- Skin tone represented through line art

STYLE: Pure black outlines on white background only. No color, no gray fills, no shading. Bold clean lines. Comic book coloring page style. Every area clearly bounded for coloring in.

${nameClause}SCENE: The child is ${scene}.

${complexityModifier || 'Include a fun detailed background setting'}.

Make the child recognizable as the specific child in the reference photo.`;

    let response;

    if (imageBase64) {
      const imageBuffer = Buffer.from(imageBase64, 'base64');
      const blob = new Blob([imageBuffer], { type: mimeType || 'image/jpeg' });
      const imageFile = new File([blob], 'reference.jpg', { type: mimeType || 'image/jpeg' });

      response = await openai.images.edit({
        model: 'gpt-image-1',
        image: imageFile,
        prompt,
        n: 1,
        size: '1024x1024', // square — safest supported size for edit endpoint
      });
    } else {
      response = await openai.images.generate({
        model: 'gpt-image-1',
        prompt: `${prompt}\n\nCharacter: ${characterDescriptor}`,
        n: 1,
        size: '1024x1024',
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
