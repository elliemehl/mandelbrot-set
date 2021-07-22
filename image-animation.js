const sharp = require('sharp');
const pngFileStream = require('png-file-stream');
const GIFEncoder = require('gifencoder');
const fs = require('fs');

async function save_image(frame, width, height, folder, name) {
  image = sharp(frame, {
    raw: {
      width: width,
      height: height,
      channels: 3
    }

  });
  await image.toFile(folder + name)
  return image
}

//take the pngs from ^ and string them together to gif

async function create_gif(width, height, folder, name) {
  const encoder = new GIFEncoder(width, height);

  const image_names = folder + name + '*.png'
  const stream = pngFileStream(folder + name + '*.png')
    .pipe(encoder.createWriteStream({ repeat: 0, delay: 500, quality: 10 }))
    .pipe(fs.createWriteStream(folder + name + '.gif'));

  // Alternately, you can wrap the "finish" event in a Promise
  await new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

module.exports = { save_image, create_gif }