#!/usr/bin/env node

/**
 * @file        main.js
 *              Application which will allow the user to zoom into the Mandelbrot set. The user will 
 *              input a starting point and end point to zoom too. The application will save a video of the zoom.
 * 
 * @author      Ellie Mehltretter, ellie@kingsds.network
 * @date        July 2021
 */

const mandelbrot = require("./mandelbrot-set.js");
const create_image = require("./image-animation.js");

const SCHEDULER_URL = new URL('https://scheduler.distributed.computer');
const DCP_FLAG = false;

function _atob(string) {

    var b64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    string = String(string).replace(/[\t\n\f\r ]+/g, '');
    string += '=='.slice(2 - (string.length & 3));
    var bitmap, result = "", r1, r2, i = 0;
    for (; i < string.length;) {
        bitmap = b64.indexOf(string.charAt(i++)) << 18 | b64.indexOf(string.charAt(i++)) << 12
          | (r1 = b64.indexOf(string.charAt(i++))) << 6 | (r2 = b64.indexOf(string.charAt(i++)));
        result += r1 === 64 ? String.fromCharCode(bitmap >> 16 & 255)
          : r2 === 64 ? String.fromCharCode(bitmap >> 16 & 255, bitmap >> 8 & 255)
            : String.fromCharCode(bitmap >> 16 & 255, bitmap >> 8 & 255, bitmap & 255);
    }
    return result;
}

function get_pre_frames(
    frames_num = 10,
    canvas_size = {
        height: 400,
        width: 600
    },
    z0 = {
        re: 0.42884,
        im: -0.231345
    },
    speed = 0.4,
    complex_coordinates = {
        x1: -2.5,
        y1: -1,
        x2: 1,
        y2: 1
    }
) {

    let complex_coordinates_new;
    let pre_frames = new Array(frames_num);
    for (let i = 0; i < frames_num; i++) {
        complex_coordinates_new = mandelbrot.zoom_in(complex_coordinates, z0, speed);
        pre_frames[i] = [complex_coordinates, complex_coordinates_new];
        complex_coordinates = complex_coordinates_new;
    }

    return pre_frames;
}

function image_function(
    array_results,
    frames_per_worker = 3,
    canvas_size = {
        height: 400,
        width: 600
    }
) {

    let frame_size = canvas_size.height * canvas_size.width * 3;

    for (let i = 0; i < array_results.length; i++) {
        for (let j=0; j < frames_per_worker; j++) { 
            let idx = i * frames_per_worker + j;
            let image = array_results[i].slice(j * frame_size, (j + 1) * frame_size);
            create_image.save_image(image, canvas_size.width, canvas_size.height, "./mandelbrot_images", "/mandelbrot" + String(idx).padStart(3, "0") + '.png')
        }
    }

    create_image.create_gif(canvas_size.width, canvas_size.height, './mandelbrot_images', '/mandelbrot');
}

function local_function(
    pre_frames,
    frames_per_worker = 3,
    canvas_size = {
        height: 400,
        width: 600
    },
    max_iterations = 1000
) {

        let array_results = new Array();

        for (let idx = 0; idx < pre_frames.length - 1; idx++) {
            const frames = mandelbrot.make_frames(pre_frames[idx], canvas_size, max_iterations, frames_per_worker);
            array_results.push(frames);
        }

        return array_results;
}

function work_function(pre_frame, canvas_size, max_iterations, frames_per_worker) {

    let mandelbrot = require('./mandelbrot-set');

    let frames = mandelbrot.make_frames(pre_frame, canvas_size, max_iterations, frames_per_worker);
/*
    function _arrayBufferToBase64( buffer ) {
        var binary = '';
        var bytes = new Uint8Array( buffer );
        var len = bytes.byteLength;
        for (var i = 0; i < len; i++) {
            binary += String.fromCharCode( bytes[ i ] );
        }
        return btoa( binary );
    }

    frames = _arrayBufferToBase64(frames);
*/
    return frames;
}

async function dcp_function(
    pre_frames,
    frames_per_worker = 3,
    canvas_size = {
        height: 400,
        width: 600
    },
    max_iterations = 1000
) {

    const compute = require('dcp/compute');
    const wallet = require('dcp/wallet');

    const ks = await wallet.get(); /* usually loads ~/.dcp/default.keystore */

    return new Promise(function(resolve, reject) {

        let array_results = new Array();

        let startTime;

        const job = compute.for(
            pre_frames,
            work_function,
            [canvas_size, max_iterations, frames_per_worker]
        );

        job.requires("./mandelbrot-set");
        job.requirements.discrete = true;

        job.on('accepted', () => {
            console.log(` - Job accepted by scheduler, waiting for results`);
            console.log(` - Job has id ${job.id}`);
            startTime = Date.now();
        });

        job.on('readystatechange', (arg) => {
            console.log(`new ready state: ${arg}`);
        });

        job.on('result', (ev) => {
            console.log(
                ` - Received result for slice ${ev.sliceNumber} at ${Math.round((Date.now() - startTime) / 100) / 10
                }s`,
            );

            let frames = ev.result;
            frames = new Uint8Array(_atob(frames).split("").map((char)=>char.charCodeAt(0)));
            array_results.push(frames);

            if (array_results.length >= pre_frames.length) resolve(array_results);
        });
        job.on('status', (ev) => {
            console.log('Got status update: ', ev)
        });

        job.public.name = 'mandelbrot set, nodejs';

        job.computeGroups = [{ joinKey: 'aitf', joinSecret: '' }];

        job.setPaymentAccountKeystore(ks);
        job.exec(); //compute.marketValue
    });
}

/** Main program entry point */
async function main( do_it_on_dcp = false ) {

    let complex_coordinates = {
        x1: -2.5,
        y1: -1,
        x2: 1,
        y2: 1
    }

    const canvas_size = {
        height: 400,
        width: 600
    }

    const z0 = { re: 0.42884, im: -0.231345 };
    const speed = 0.4;
    const max_iterations = 1000;
    const frames_num = 10;
    const frames_per_worker = 2;

    let pre_frames = get_pre_frames(
        frames_num, frames_per_worker, canvas_size, complex_coordinates, z0, speed
    );

    let array_results = Array();

    if (do_it_on_dcp) {

        array_results = await dcp_function(
            pre_frames, frames_per_worker, canvas_size, max_iterations
        );

    } else {

        array_results = await local_function(
            pre_frames, frames_per_worker, canvas_size, max_iterations
        );
    }

    image_function = (array_results, frames_per_worker, canvas_size);
}

/* Initialize DCP Client and run main() */
if (DCP_FLAG) require('dcp-client').initSync(SCHEDULER_URL);
//main()
    // .catch(console.error)
    // .finally(() => {console.log("came here")})

exports.get_pre_frames = get_pre_frames;
exports.image_function = image_function;
exports.local_function = local_function;
exports.dcp_function = dcp_function;
exports.work_function = work_function;
exports.main = main;
