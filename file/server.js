require('dotenv').config();
const express = require('express');
const multer = require('multer');
const axios = require('axios');
const cron = require('node-cron');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();

const allowedOrigin = 'https://coodecrafters.github.io';

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (origin === allowedOrigin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

// Use multer.memoryStorage to store file buffer in memory (not on disk)
const upload = multer(); // not multer({ dest: ... })
app.use(express.json()); // To parse JSON bodies


// Validate required environment variables
const requiredEnvVars = ['GITHUB_TOKEN', 'GITHUB_OWNER', 'GITHUB_REPO', 'RENDER_ENDPOINT'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// --- Health Check Endpoint ---
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// --- File Upload Endpoint ---
app.post('/upload', upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      throw new Error('No file uploaded');
    }

    const fileBuffer = req.file.buffer; // ✅ Use in-memory buffer directly
    const fileContentBase64 = fileBuffer.toString('base64');
    const repoFilePath = `uploads/${Date.now()}_${req.file.originalname}`;

    const githubResponse = await axios.put(
      `https://api.github.com/repos/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}/contents/${repoFilePath}`,
      {
        message: `Upload ${req.file.originalname}`,
        content: fileContentBase64,
        branch: process.env.GITHUB_BRANCH || 'main'
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          'User-Agent': 'NodeUploader',
          Accept: 'application/vnd.github.v3+json'
        }
      }
    );

    console.log(`✅ Uploaded to GitHub: ${repoFilePath}`);
    res.json({
      success: true,
      url: githubResponse.data.content.html_url,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('❌ Upload failed:', err.message);
    res.status(500).json({
      success: false,
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});


// --- Scheduled Endpoint Ping Every 2 Minutes ---
cron.schedule('*/2 * * * *', async () => {
  try {
    const response = await axios.get(process.env.RENDER_ENDPOINT + '/welcome', {
      timeout: 5000
    });
    console.log(`🌐 Successfully pinged ${process.env.RENDER_ENDPOINT} at ${new Date().toISOString()}`);
    console.log(`Response status: ${response.status}`);
  } catch (err) {
    console.error(`❌ Failed to ping ${process.env.RENDER_ENDPOINT}:`, err.message);
  }
});

// Start Express Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔧 Configuration:`);
  console.log(`- GitHub Owner: ${process.env.GITHUB_OWNER}`);
  console.log(`- GitHub Repo: ${process.env.GITHUB_REPO}`);
  console.log(`- Render Endpoint: ${process.env.RENDER_ENDPOINT}`);
  console.log(`⏱️ Will ping /welcome every 2 minutes`);
});


app.post('/evaluations', express.json(), async (req, res) => {
  try {
    const newEvaluatorData = req.body;

    if (!newEvaluatorData) {
      return res.status(400).json({ success: false, error: 'Request body missing' });
    }

    // Adjust this key based on your JSON schema for evaluator unique ID
const newRollNumber = newEvaluatorData.rollNo || newEvaluatorData.rollNumber || newEvaluatorData.roll_no || null;

    if (!newRollNumber) {
      return res.status(400).json({ success: false, error: 'Evaluator roll number is required' });
    }

    const filePath = path.join(__dirname, 'evaluationjson.json');

    let existingData = [];

    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      existingData = fileContent ? JSON.parse(fileContent) : [];
    }

    // Check for duplicate roll number
    const duplicate = existingData.find(evaluator => {
      return (evaluator.rollNumber === newRollNumber || evaluator.roll_no === newRollNumber);
    });

    if (duplicate) {
      return res.status(409).json({
        success: false,
        error: `Evaluator with roll number '${newRollNumber}' already exists`
      });
    }

    // Append new evaluator data
    existingData.push(newEvaluatorData);

    // Write back updated JSON
    fs.writeFileSync(filePath, JSON.stringify(existingData, null, 2));

    res.json({
      success: true,
      message: 'Evaluator data saved successfully',
      data: newEvaluatorData
    });

  } catch (err) {
    console.error('Error in /evaluations:', err);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});
