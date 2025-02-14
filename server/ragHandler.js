const { Configuration, OpenAIApi } = require("openai");
const { initPinecone } = require("./pineconeClient");

require("dotenv").config();

const openai = new OpenAIApi(
  new Configuration({ apiKey: process.env.OPENAI_API_KEY })
);

async function handleQuery(query) {
  const pineconeIndex = await initPinecone();

  // 1. Genera embedding della query con OpenAI
  const embeddingResponse = await openai.createEmbedding({
    model: "text-embedding-ada-002",
    input: query,
  });

  const queryEmbedding = embeddingResponse.data.data[0].embedding;

  // 2. Cerca nel database Pinecone
  const searchResults = await pineconeIndex.query({
    topK: 3, // Numero massimo di risultati
    includeMetadata: true,
    vector: queryEmbedding,
  });

  // 3. Costruisci un contesto dai risultati di Pinecone
  const context = searchResults.matches
    .map((match) => match.metadata.text)
    .join("\n");

  // 4. Genera una risposta usando OpenAI e il contesto
  const completionResponse = await openai.createChatCompletion({
    model: "gpt-4",
    messages: [
      { role: "system", content: "Rispondi come un assistente utile e competente." },
      { role: "user", content: `Contesto:\n${context}\n\nDomanda: ${query}` },
    ],
  });

  return completionResponse.data.choices[0].message.content;
}

module.exports = { handleQuery };