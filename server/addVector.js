const { OpenAI } = require('openai');
const fs = require('fs');
const { initPinecone } = require('./pineconeClient');
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Funzione per ottenere i vettori dal testo
async function getTextEmbeddings(text) {
  try {
    const embeddings = await openai.embeddings({
      model: 'text-embedding-ada-002',
      input: text,
    });
    return embeddings.data[0].embedding; // Restituisce il vettore
  } catch (error) {
    console.error('Errore nella generazione dei vettori:', error);
  }
}

// Funzione per aggiungere il vettore a Pinecone
async function addVectorToPinecone(text) {
  const index = await initPinecone();

  const vector = await getTextEmbeddings(text);

  const vectors = [
    {
      id: 'document1', // ID univoco del vettore
      values: vector,
      metadata: { source: 'documento.json' },
    },
  ];

  // Aggiungi il vettore all'indice Pinecone
  await index.upsert({ vectors });

  console.log('Vettore aggiunto con successo!');
}

module.exports = { addVectorToPinecone };