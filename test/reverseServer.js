const http = require('http');
const server = http.createServer((req, res) => {
    res.setHeader('content-type', 'text/html');
    res.write('<h3>reverse server</h3>');
    res.end();
});

server.listen(8901, () => {
    console.log(`reverse server listening on port 8901`);
});
