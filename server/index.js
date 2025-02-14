const express = require('express');
const cors = require('cors');
const fs = require('fs');
const { OpenAI } = require('openai');
const { Pinecone } = require('@pinecone-database/pinecone');
const { ConversationSummaryMemory } = require("langchain/memory");
const { ChatOpenAI } = require("@langchain/openai");
require('dotenv').config();

const authMiddleware = (req, res, next) => {
    const { accessKey } = req.body;

    if (accessKey === process.env.ACCESS_KEY) {
        next(); // Se la chiave è corretta, prosegui
    } else {
        res.status(401).json({ message: "Accesso negato" });
    }
};

// Verifica delle variabili d'ambiente necessarie
const requiredEnvVars = ['OPENAI_API_KEY', 'PINECONE_API_KEY', 'PINECONE_INDEX_NAME'];
for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        console.error(`Errore: Manca la variabile d'ambiente ${envVar}`);
        process.exit(1);
    }
}

// Verifica che esista la cartella data
if (!fs.existsSync('./data')) {
    console.log('Creazione cartella data...');
    fs.mkdirSync('./data');
}

const app = express();
app.use(express.json());
app.use(cors());

let openai;
let pinecone;
let index;

try {
    console.log('Inizializzazione OpenAI...');
    openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });

    console.log('Inizializzazione Pinecone...');
    pinecone = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY,
    });

    index = pinecone.index(process.env.PINECONE_INDEX_NAME);
    
    console.log('Inizializzazione completata con successo');
} catch (error) {
    console.error('Errore durante l\'inizializzazione:', error);
    process.exit(1);
}

const chatMemories = new Map();

async function getOrCreateMemory(sessionId) {
    try {
        if (!chatMemories.has(sessionId)) {
            const memory = new ConversationSummaryMemory({
                memoryKey: "chat_history",
                llm: new ChatOpenAI({ 
                    modelName: "gpt-3.5-turbo",
                    temperature: 0,
                    openAIApiKey: process.env.OPENAI_API_KEY
                }),
                maxTokens: 1000,
                returnMessages: true
            });
            chatMemories.set(sessionId, memory);
        }
        return chatMemories.get(sessionId);
    } catch (error) {
        console.error('Errore nella creazione della memoria:', error);
        throw error;
    }
}

// Funzione per dividere il testo in chunk
function splitIntoChunks(jsonData) {
    return jsonData.map((item, index) => ({
        id: index,
        chunkContent: `Categoria: ${item.category}\nTitolo: ${item.title}\nDomanda: ${item.question}\nContesto: ${item.context}\nRisposta: ${item.answer}`
    }));
}

// Funzione per il login
app.post('/api/login', authMiddleware, (req, res) => {
    res.json({ message: "Login effettuato con successo", success: true });
});

// Endpoint per caricare e processare il documento
app.post('/processDocument', async (req, res) => {
    try {
        console.log('Verifica esistenza file...');
        if (!fs.existsSync('./data/documento.json')) {
            return res.status(404).json({ error: 'File documento.json non trovato nella cartella data' });
        }

        console.log('Lettura file...');
        const fileContent = fs.readFileSync('./data/documento.json', 'utf-8');
        const jsonData = JSON.parse(fileContent);
        const chunks = splitIntoChunks(jsonData);
        
        console.log(`Processamento di ${chunks.length} chunks...`);
        
        for (let i = 0; i < chunks.length; i++) {
          console.log(`Creazione embedding per chunk ${i + 1}...`);
          const embeddingResponse = await openai.embeddings.create({
              model: 'text-embedding-ada-002',
              input: chunks[i].chunkContent,
          });
          console.log('Embedding creato:', embeddingResponse.data);

          console.log('Upsert nel Pinecone...');
          await index.upsert([{
              id: `chunk-${i}`,
              values: embeddingResponse.data[0].embedding,
              metadata: { text: chunks[i].chunkContent },
          }]);
          console.log(`Chunk ${i + 1} inserito correttamente in Pinecone`);
        }

        console.log('Documento processato con successo');
        res.json({ message: 'Documento processato con successo' });
    } catch (error) {
        console.error('Errore durante il processamento:', error);
        res.status(500).json({ error: 'Errore durante il processamento del documento' });
    }
});

// Endpoint per le query
app.post('/api/query', async (req, res) => {
    try {
        const { query, sessionId = 'default' } = req.body;
        console.log('Query ricevuta:', query, 'SessionId:', sessionId);

        // Verifica che la memoria esista
        let memory;
        try {
            memory = await getOrCreateMemory(sessionId);
        } catch (memoryError) {
            console.error('Errore nella gestione della memoria:', memoryError);
            memory = await getOrCreateMemory('default'); // Fallback sulla memoria default
        }

        let memoryVariables = {};
        let chatHistory = '';
        
        try {
            memoryVariables = await memory.loadMemoryVariables({});
            chatHistory = memoryVariables.chat_history || '';
        } catch (historyError) {
            console.error('Errore nel caricamento della chat history:', historyError);
            // Continua senza storia della chat
        }

        // const memory = await getOrCreateMemory(sessionId);
        // const memoryVariables = await memory.loadMemoryVariables({});
        // const chatHistory = memoryVariables.chat_history || '';

        const queryEmbedding = await openai.embeddings.create({
            model: 'text-embedding-ada-002',
            input: query,
        });

        const searchResponse = await index.query({
            vector: queryEmbedding.data[0].embedding,
            topK: 5,
            includeMetadata: true
        });

        console.log(`Trovati ${searchResponse.matches.length} risultati rilevanti`);

        const context = searchResponse.matches.map(match => match.metadata.text).join('\n');

        const chatResponse = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
                { 
                    role: 'system', 
                    content: 'Sei un consulente legale, attenendoti strettamente al documento sottostante supporta il cliente. Non scrivere mai che usi un documento. Se non sei convinto della domanda chiedi di essere più preciso consigliando un tema' 
                },
                { 
                    role: 'user', 
                    content: `Cronologia chat:\n${chatHistory}\n\nContesto:\n${context}\n\nDomanda: ${query}`
                }
            ],
            max_tokens: 500
        });

        res.json({ 
            response: chatResponse.choices[0].message.content,
            sessionId 
        });
        
        // Dopo aver inviato la risposta, aggiorna la memoria ma SENZA tentare di inviare un'altra risposta
        await memory.saveContext(
            { input: query },
            { output: chatResponse.choices[0].message.content }
        );
        
    } catch (error) {
        console.error('Errore durante la query:', error);
        res.status(500).json({ error: 'Errore durante la generazione della risposta' });
    }

    process.on('uncaughtException', (error) => {
        console.error('Uncaught Exception:', error);
    });
    
    process.on('unhandledRejection', (error) => {
        console.error('Unhandled Rejection:', error);
    });
});

const port = process.env.PORT || 5001;

// Avvio del server con gestione errori
try {
    app.listen(port, () => {
        console.log(`Server attivo sulla porta ${port}`);
        console.log('Per caricare un documento: curl -X POST http://localhost:5001/processDocument');
        console.log('Per fare una query: curl -X POST -H "Content-Type: application/json" -d \'{"query":"la tua domanda"}\' http://localhost:5001/api/query');
    });
} catch (error) {
    console.error('Errore durante l\'avvio del server:', error);
    process.exit(1);
}