const sharp = require('sharp');
const pngFileStream = require('png-file-stream');
const GIFEncoder = require('gifencoder');
const fs = require('fs');

/**
 * take in the frame which is a Uint8 array and saves each frame as a png.
 * @param {int} frame
 * @param {int} width
 * @param {int} height
 * @param {string} folder
 * @param {string} name
 * @returns image
 */
async function save_image(frame, width, height, folder, name) {
  image = sharp(frame, {
    raw: {
      width: width,
      height: height,
      channels: 3
    }

  });

  if (!fs.existsSync(folder)) fs.mkdirSync(folder);
  await image.toFile(folder + name)
  return image
}

/**
 * Take the pngs created and turns them into a gif.
 * @param {int} width
 * @param {int} height
 * @param {string} folder
 * @param {string} name
 */
async function create_gif(width, height, folder, name) {
  const encoder = new GIFEncoder(width, height);
  const image_names = folder + name + '*.png'
  const stream = pngFileStream(folder + name + '*.png')
    .pipe(encoder.createWriteStream({ repeat: 0, delay: 500, quality: 10 }))
    .pipe(fs.createWriteStream(folder + name + '.gif'));

  await new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

module.exports = { save_image, create_gif }
