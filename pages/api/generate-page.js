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
    const { characterDescriptor, scene, complexityModifier, childName } = req.body;

    if (!characterDescriptor || !scene) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const nameClause = childName ? `The child's name is ${childName}. ` : '';

    const prompt = `Create a black and white children's coloring book illustration page.

STYLE REQUIREMENTS:
- Pure black outlines on white background only
- No gray fills, no shading, no color anywhere
- Thick bold lines suitable for coloring in
- Comic book / cartoon illustration style
- Every region clearly bounded and ready to color

CHARACTER (must appear exactly as described - this is the most important part):
${characterDescriptor}

CRITICAL CHARACTER DETAILS TO PRESERVE:
- If they have a mohawk: draw it as a tall strip of hair down the center of the head, shaved sides
- If they have glasses: draw frames exactly as described on their face
- If they have a birthmark or distinctive feature: include it
- The child's face structure, hair, and distinguishing features must be immediately recognizable

${nameClause}SCENE: The child is ${scene}.

COMPOSITION: Child is the main hero, large and prominent in the foreground, shown with excitement and joy. ${complexityModifier || 'Include a detailed background with the scene setting'}.

Draw this specific child — not a generic child. Their distinctive appearance is the entire point of this illustration.`;

    const response = await openai.images.generate({
      model: 'gpt-image-1',
      prompt,
      n: 1,
      size: '1024x1024',
    });

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
