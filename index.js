const http = require('node:http');

const hostname = '0.0.0.0'; // Change from 127.0.0.1
const port = process.env.PORT || 3000; // Use PORT environment variable if provided

const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('Hello, World!\n');
});

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});
