import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config({ override: true });

const getGenAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  return new GoogleGenerativeAI(apiKey);
};

// Candidate models in order of priority (with fallback support for 503 spikes or deprecated versions)
const CANDIDATE_MODELS = [
  'gemini-flash-latest',
  'gemini-3.8-flash',
  'gemini-3.5-flash',
  'gemini-flash-lite-latest',
];

/**
 * Call Gemini with a system prompt and user prompt.
 * Automatically fails over across candidate models if one experiences high demand or is unavailable.
 * @param {string} systemPrompt - System instructions for the model
 * @param {string} userPrompt - The user's message or data payload
 * @param {object} [options] - Optional settings
 * @param {number} [options.temperature=0.7] - Temperature (0-2)
 * @returns {Promise<string|null>} Generated text or null on failure
 */
export const callGemini = async (systemPrompt, userPrompt, options = {}) => {
  const genAI = getGenAI();
  let lastErrorMsg = '';

  for (const modelName of CANDIDATE_MODELS) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
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

      return result.response.text();
    } catch (error) {
      lastErrorMsg = error.message || '';
      console.warn(`[Gemini API] Model ${modelName} failed:`, lastErrorMsg.slice(0, 150));
    }
  }

  console.error('[Gemini API Error]: All candidate models failed. Last error:', lastErrorMsg);
  return null;
};

/**
 * Call Gemini with multi-turn conversation history.
 * Automatically fails over across candidate models.
 * @param {string} systemPrompt - System instructions
 * @param {Array<{role: string, text: string}>} history - Conversation history
 * @param {string} userMessage - Current user message
 * @returns {Promise<string|null>} Generated text or null on failure
 */
export const callGeminiChat = async (systemPrompt, history, userMessage) => {
  const genAI = getGenAI();
  let lastErrorMsg = '';

  for (const modelName of CANDIDATE_MODELS) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
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
      lastErrorMsg = error.message || '';
      console.warn(`[Gemini Chat] Model ${modelName} failed:`, lastErrorMsg.slice(0, 150));
    }
  }

  console.error('[Gemini Chat Error]: All candidate models failed. Last error:', lastErrorMsg);
  return null;
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
  const genAI = getGenAI();
  let lastErrorMsg = '';

  for (const modelName of CANDIDATE_MODELS) {
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
    }
  }

  if (lastErrorMsg.includes('429') || lastErrorMsg.includes('Too Many Requests') || lastErrorMsg.includes('quota')) {
    console.warn('[Gemini Vision] All candidate models rate limited — backing off');
    return '__RATE_LIMITED__';
  }

  console.error('[Gemini Vision Error]: All candidate models failed. Last error:', lastErrorMsg);
  return null;
};
