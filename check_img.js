const https = require('https');
const sizeOf = require('image-size');
function getImgSize(url) {
  return new Promise(resolve => {
    https.get(url, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        try {
          const buffer = Buffer.concat(chunks);
          const dimensions = sizeOf(buffer);
          resolve(url + ': ' + dimensions.width + 'x' + dimensions.height);
        } catch(e) { resolve(url + ' error'); }
      });
    });
  });
}
Promise.all([
  getImgSize('https://i.postimg.cc/tR3YSryT/LOGO-NORA-NEGRO.png'),
  getImgSize('https://i.postimg.cc/W3trgjZX/FAVICON-NORA-NEGRO.png'),
  getImgSize('https://i.postimg.cc/L4r0gSvV/LOGO-TEXTO-NORA-NEGRO.png')
]).then(console.log);
