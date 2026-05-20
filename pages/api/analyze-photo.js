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
      max_tokens: 400,
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
              text: `Describe this child's physical appearance precisely for use as a character descriptor in illustration prompts. Include:
- Approximate age (e.g. "approximately 6-7 years old")
- Hair: color, length, style (spiky, curly, straight, braided, etc.)
- Eyes: shape and any notable features
- Skin tone: use descriptive terms (light, medium, warm brown, dark, olive, etc.)
- Glasses: yes or no, and if yes describe frame style and color
- Any distinctive features: dimples, freckles, birthmarks, etc.
- Build: small/average/sturdy for their age

Output ONLY the descriptor as a single paragraph. No preamble, no explanation. Start directly with "A child approximately..."`,
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
