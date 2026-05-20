import OpenAI from 'openai';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
    responseLimit: '20mb',
  },
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const STYLE_INSTRUCTIONS = `Clean black and white children's coloring book illustration page. 
Thick bold outlines only, pure white background, absolutely no gray fills, no shading, no color, no gradients. 
Comic book line art style. Every region should be clearly bounded and ready to be colored in. 
The child character is the hero of the scene and should be prominently featured in the foreground.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { characterDescriptor, scene, complexityModifier, childName, imageBase64, mimeType } = req.body;

    if (!characterDescriptor || !scene) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const nameClause = childName ? `The child's name is ${childName}. ` : '';

    const prompt = `${STYLE_INSTRUCTIONS}

${nameClause}The main character in this scene is: ${characterDescriptor}

Scene: The child is ${scene}.

The illustration has ${complexityModifier || 'moderate detail with clear outlines and a fun detailed background'}.

Important: Keep the child character's appearance consistent with the description. Show them with an expression of joy, excitement, or wonder. The scene should be dynamic and action-filled.`;

    // Build the request - use image input if provided for better character consistency
    const requestParams = {
      model: 'gpt-image-1',
      prompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
      output_format: 'png',
    };

    // If we have the reference photo, pass it as input for better consistency
    // gpt-image-1 supports image editing/variation with reference
    let response;

    if (imageBase64) {
      // Convert base64 to buffer for the API
      const imageBuffer = Buffer.from(imageBase64, 'base64');
      const imageFile = await OpenAI.toFile(imageBuffer, 'reference.jpg', {
        type: mimeType || 'image/jpeg',
      });

      response = await openai.images.edit({
        model: 'gpt-image-1',
        image: imageFile,
        prompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard',
      });
    } else {
      response = await openai.images.generate(requestParams);
    }

    const imageData = response.data[0];
    // gpt-image-1 returns b64_json by default
    const b64 = imageData.b64_json || null;
    const url = imageData.url || null;

    return res.status(200).json({ b64, url });
  } catch (error) {
    console.error('Generate page error:', error);
    // Return structured error so frontend can handle gracefully
    return res.status(500).json({
      error: error.message || 'Failed to generate page',
      code: error.code || 'UNKNOWN',
    });
  }
}
