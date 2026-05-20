import OpenAI from 'openai';

export const config = {
  api: {
    bodyParser: { sizeLimit: '10mb' },
    responseLimit: '20mb',
  },
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const STYLE = `Black and white children's coloring book illustration. Thick bold outlines, pure white background, no shading, no gray fills, no color whatsoever. Clean comic book line art style. Every area clearly bounded and ready to color. The child in the reference photo is the hero of the scene - preserve their exact facial features, hair style, glasses if any, and other distinguishing characteristics. Show them with joy and excitement.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { characterDescriptor, scene, complexityModifier, childName, imageBase64, mimeType } = req.body;

    if (!characterDescriptor || !scene) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const nameClause = childName ? `The child's name is ${childName}. ` : '';

    const prompt = `${STYLE}

${nameClause}The child's appearance: ${characterDescriptor}

Scene: The child is ${scene}.

Detail level: ${complexityModifier || 'moderate detail with a fun background'}.

IMPORTANT: This must look like a personalized coloring book page featuring the specific child from the reference photo. Maintain their distinctive appearance throughout.`;

    let response;

    if (imageBase64) {
      // Use image edit with reference photo for character consistency
      const imageBuffer = Buffer.from(imageBase64, 'base64');
      const imageFile = await OpenAI.toFile(imageBuffer, 'reference.png', {
        type: mimeType || 'image/jpeg',
      });

      response = await openai.images.edit({
        model: 'gpt-image-1',
        image: imageFile,
        prompt,
        n: 1,
        size: '1024x1024',
      });
    } else {
      // Fallback: generate without reference
      response = await openai.images.generate({
        model: 'gpt-image-1',
        prompt,
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
