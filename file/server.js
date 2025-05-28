require('dotenv').config();
const express = require('express');
const multer = require('multer');
const axios = require('axios');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

const app = express();

// Ensure temp directory exists
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}
const upload = multer({ dest: tempDir });

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

    // Read file content as base64
    const filePath = path.join(__dirname, req.file.path);
    const fileBuffer = fs.readFileSync(filePath);
    const fileContentBase64 = fileBuffer.toString('base64');

    // Prepare path inside repo (you can change this folder)
    const repoFilePath = `uploads/${Date.now()}_${req.file.originalname}`;

    // Call GitHub API using axios PUT
    const githubResponse = await axios.put(
      `https://api.github.com/repos/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}/contents/${repoFilePath}`,
      {
        message: `Upload ${req.file.originalname}`,
        content: fileContentBase64,
        branch: process.env.GITHUB_BRANCH || 'main' // default to main if not set
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          'User-Agent': 'NodeUploader',
          Accept: 'application/vnd.github.v3+json'
        }
      }
    );

    // Cleanup temp file
    fs.unlinkSync(filePath);

    console.log(`✅ Uploaded to GitHub: ${repoFilePath}`);

    // Send response with the file's GitHub URL
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
      timeout: 5000 // 5 second timeout
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
