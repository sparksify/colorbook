import OpenAI from 'openai';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { imageBase64, mimeType } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'No image provided' });
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 600,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType || 'image/jpeg'};base64,${imageBase64}`,
                detail: 'high',
              },
            },
            {
              type: 'text',
              text: `You are creating a character sheet for a children's coloring book illustrator. Describe this child's appearance with extreme precision so an illustrator can draw them consistently across multiple scenes.

Be very specific about:
- HAIR: exact color (e.g. jet black, dark brown, golden blonde), length, style (mohawk, spiky, curly, straight, braided, bun), any unique styling
- FACE SHAPE: round, oval, square, heart-shaped
- EYES: shape (almond, round, wide), size, any distinctive features
- SKIN TONE: very light, light, medium, olive, medium-brown, dark brown, deep
- GLASSES: yes or no - if yes: frame shape (round, rectangular, square, cat-eye), frame color/material, lens size
- DISTINCTIVE FEATURES: dimples, freckles, birthmarks, prominent ears, gap in teeth, chubby cheeks, strong jawline - be specific
- BUILD: slim, average, chubby, tall for age
- AGE APPEARANCE: looks approximately X years old
- CLOTHING visible: describe shirt/top style and any text or graphics on it

Output as a single detailed paragraph starting with "A child who appears approximately [age] years old with". Be specific enough that two different illustrators would draw the same child.`,
            },
          ],
        },
      ],
    });

    const descriptor = response.choices[0].message.content.trim();
    return res.status(200).json({ descriptor });
  } catch (error) {
    console.error('Analyze photo error:', error);
    return res.status(500).json({ error: error.message || 'Failed to analyze photo' });
  }
}
