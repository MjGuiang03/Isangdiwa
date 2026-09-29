import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config({ override: true });

const apiKey = process.env.GEMINI_API_KEY;
console.log('Using Gemini API Key ending in:', apiKey ? apiKey.slice(-6) : 'undefined');
const genAI = new GoogleGenerativeAI(apiKey);

/**
 * Call Gemini 2.0 Flash with a system prompt and user prompt.
 * Returns the generated text, or null if the call fails.
 * @param {string} systemPrompt - System instructions for the model
 * @param {string} userPrompt - The user's message or data payload
 * @param {object} [options] - Optional settings
 * @param {number} [options.maxTokens=1024] - Max output tokens
 * @param {number} [options.temperature=0.7] - Temperature (0-2)
 * @returns {Promise<string|null>} Generated text or null on failure
 */
export const callGemini = async (systemPrompt, userPrompt, options = {}) => {
  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: systemPrompt,
    });

    const generationConfig = {
      temperature: options.temperature ?? 0.7,
    };
    
    if (options.responseMimeType) {
      generationConfig.responseMimeType = options.responseMimeType;
    }

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig,
    });

    const response = result.response;
    return response.text();
  } catch (error) {
    console.error('[Gemini API Error]:', error.message || error);
    return null;
  }
};

/**
 * Call Gemini with multi-turn conversation history.
 * @param {string} systemPrompt - System instructions
 * @param {Array<{role: string, text: string}>} history - Conversation history
 * @param {string} userMessage - Current user message
 * @returns {Promise<string|null>} Generated text or null on failure
 */
export const callGeminiChat = async (systemPrompt, history, userMessage) => {
  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: systemPrompt,
    });

    const chat = model.startChat({
      history: history.map(msg => ({
        role: msg.role === 'bot' ? 'model' : 'user',
        parts: [{ text: msg.text }],
      })),
      generationConfig: {
        temperature: 0.75,
      },
    });

    const result = await chat.sendMessage(userMessage);
    return result.response.text();
  } catch (error) {
    console.error('[Gemini Chat Error]:', error.message || error);
    return null;
  }
};

/**
 * Call Gemini with vision (image + text) input.
 * @param {string} systemPrompt - System instructions
 * @param {string} textPrompt - Text prompt to send alongside the image
 * @param {string} base64Image - Base64-encoded image data (without data URI prefix)
 * @param {string} [mimeType='image/jpeg'] - MIME type of the image
 * @returns {Promise<string|null>} Generated text or null on failure
 */
export const callGeminiVision = async (systemPrompt, textPrompt, base64Image, mimeType = 'image/jpeg') => {
  const candidateModels = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];
  let lastErrorMsg = '';

  for (const modelName of candidateModels) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: systemPrompt,
      });

      const result = await model.generateContent({
        contents: [{
          role: 'user',
          parts: [
            { text: textPrompt },
            { inlineData: { data: base64Image, mimeType } },
          ],
        }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      });

      return result.response.text();
    } catch (error) {
      lastErrorMsg = error.message || '';
      console.warn(`[Gemini Vision] Model ${modelName} failed:`, lastErrorMsg.slice(0, 150));
      // Continue to next candidate model if rate limited or temporarily unavailable
    }
  }

  if (lastErrorMsg.includes('429') || lastErrorMsg.includes('Too Many Requests') || lastErrorMsg.includes('quota')) {
    console.warn('[Gemini Vision] All candidate models rate limited — backing off');
    return '__RATE_LIMITED__';
  }

  console.error('[Gemini Vision Error]: All candidate models failed. Last error:', lastErrorMsg);
  return null;
};
