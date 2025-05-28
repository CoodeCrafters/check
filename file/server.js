require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { Octokit } = require('@octokit/rest');
const axios = require('axios');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

const app = express();
const upload = multer({ dest: 'temp/' });

// GitHub Client Setup
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');

// --- File Upload Endpoint ---
app.post('/upload', upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      throw new Error('No file uploaded');
    }

    const filePath = path.join(__dirname, req.file.path);
    const fileContent = fs.readFileSync(filePath, 'base64');
    const fileName = `resumes/${Date.now()}_${req.file.originalname}`;

    // Upload to GitHub
    const { data } = await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: fileName,
      message: `Added: ${req.file.originalname}`,
      content: fileContent
    });

    // Cleanup
    fs.unlinkSync(filePath);

    console.log(`✅ Uploaded to GitHub: ${fileName}`);
    res.json({ 
      success: true,
      url: data.content.html_url 
    });

  } catch (err) {
    console.error('❌ Upload failed:', err.message);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
});

// --- Cron Job (Google Search) ---
cron.schedule('*/3 * * * *', () => {
  axios.get('https://www.google.com/search?q=current+time')
    .then(() => console.log(`🕒 Google searched at ${new Date().toISOString()}`))
    .catch(err => console.error('❌ Google search failed:', err.message));
});

// Start Server
app.listen(process.env.PORT, () => {
  console.log(`Server running on http://localhost:${process.env.PORT}`);
});