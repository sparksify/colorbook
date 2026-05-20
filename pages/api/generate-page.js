import OpenAI from 'openai';

export const config = {
  api: {
    bodyParser: { sizeLimit: '10mb' },
    responseLimit: '20mb',
  },
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const STYLE = `Black and white children's coloring book page. Thick bold outlines, pure white background, no shading, no gray fills, no color. Comic book line art style. Every area clearly bounded for coloring in. Child character is the hero, shown prominently in the foreground with an expression of joy or excitement.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { characterDescriptor, scene, complexityModifier, childName } = req.body;

    if (!characterDescriptor || !scene) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const nameClause = childName ? `The child's name is ${childName}. ` : '';

    const prompt = `${STYLE}

${nameClause}Character: ${characterDescriptor}

Scene: The child is ${scene}.

Detail level: ${complexityModifier || 'moderate detail with a fun background'}.

Keep the character appearance consistent with the description above.`;

    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1024x1024',
      response_format: 'b64_json',
    });

    const b64 = response.data[0].b64_json;
    return res.status(200).json({ b64 });

  } catch (error) {
    console.error('Generate page error:', error?.message);
    return res.status(500).json({ error: error?.message || 'Failed to generate page' });
  }
}
