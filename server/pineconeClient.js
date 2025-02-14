require('dotenv').config();
const { PineconeClient } = require('@pinecone-database/pinecone');  // Usa il nuovo modulo

async function initPinecone() {
  const pinecone = new PineconeClient();
  await pinecone.init({
    apiKey: process.env.PINECONE_API_KEY,
    environment: process.env.PINECONE_ENVIRONMENT,  // E.g. "us-west1-gcp"
  });

  const index = pinecone.Index(process.env.PINECONE_INDEX_NAME);  // Usare l'indice
  return index;
}

module.exports = { initPinecone };