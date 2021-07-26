/**
 * Determines how many iterations of the function fc(z) before the point escapes
 * @param {int} z 
 * @param {int} max_iterations 
 * @returns k
 */
 function calculate_escape_time(z, max_iterations) {
    c = z;
    var k = 0;
    while (k < max_iterations) {
        real = z.re * z.re - z.im * z.im + c.re;
        imaginary = 2 * z.re * z.im + c.im;
        z = { re: real, im: imaginary }

        if (z.re * z.re + z.im * z.im >= 4) {
            break;
        }
        k++;
    }
    return k;
}

/**
 * Calculates the deltas needed to convert a point on the canvas to a point on the real and imaginary axes being plotted on.
 * @param {int} complex_coordinates 
 * @param {int} canvas_size
 * @returns x1
 * @returns y1
 * @returns delta_x
 * @returns delta_y
 */
function complex_coordinates_to_features(complex_coordinates, canvas_size) {
    let delta_x = (complex_coordinates.x2 - complex_coordinates.x1) / canvas_size.width
    let delta_y = (complex_coordinates.y2 - complex_coordinates.y1) / canvas_size.height

    let x1 = complex_coordinates.x1
    let y1 = complex_coordinates.y1

    return {
        x1: x1,
        y1: y1,
        delta_x: delta_x,
        delta_y: delta_y
    }
    

}

/**
 * Translates any point on the canvas to a point on the real and imaginary axes. Takes in a point x, y on the canvas and the lower left deltas that were calcualted. It will then return the real and imaginary components of the point.
 * @param {int} x
 * @param {int} y
 * @param {int} lower_left_deltas
 * @returns re
 * @returns im
 */
function coordinates_to_complex(x, y, lower_left_deltas) {
    let re = lower_left_deltas.x1 + x * lower_left_deltas.delta_x
    let im = lower_left_deltas.y1 + y * lower_left_deltas.delta_y


    return {
        re: re,
        im: im
    }
}

/**
 * Creates a matrix for every frame which will contain the escape time of every point in the frame. That current escape time will then be replaced with the colour of the specific point. This is also where progress will be called which is needed to run on DCP.
 * @param {int} canvas_size
 * @param {int} complex_coordinates 
 * @param {int} max_iterations 
 * @returns frame
 */
function make_frame(canvas_size, complex_coordinates, max_iterations) {
    const rows = canvas_size.height
    const cols = canvas_size.width
    const frame_size = rows * cols * 3
    let frame = new Uint8Array(frame_size);

    let lower_left_deltas = complex_coordinates_to_features(complex_coordinates, canvas_size)

    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            let z = coordinates_to_complex(x, y, lower_left_deltas);
            let current_escape_time = calculate_escape_time(z, max_iterations) / max_iterations;
            let colours = escape_time_to_colour(current_escape_time, max_iterations);
            frame.set(colours, 3 * (y * cols + x));
        }
        //if (y % 4 == 0){
          //  progress();
        //}
        // progress();
    }
    
    return frame
}

/**
 * For every frame each worker will calculate the complex coordinates for that frame and then make that frame by calling the make_frame function. Frames will be an array of matrices where each entry of the matrix is the color of the point. 
 * @param {int} canvas_size 
 * @param {int} max_iterations 
 * @param {int} first_complex_coordinates 
 * @param {int} last_complex_coordinates 
 * @param {int} total_frames 
 * @returns frames
 */
function make_frames(canvas_size, max_iterations, first_complex_coordinates, last_complex_coordinates, total_frames) {
    const rows = canvas_size.height
    const cols = canvas_size.width
    const frame_size = rows * cols * 3
    let frames = new Uint8Array(total_frames * frame_size);

    for (let k = 0; k < total_frames; k++) {

        let current_complex_coordinates = kth_complex_coordinate(first_complex_coordinates, last_complex_coordinates, total_frames, k);
        let current_frame = make_frame(canvas_size, current_complex_coordinates, max_iterations);
        frames.set(current_frame, k * frame_size);
        //progress();
    }

    return frames
}

/**
 * Calculates the new complex coordinates for each frame per slice.
 * @param {int} first_complex_coordinates 
 * @param {int} last_complex_coordiantes 
 * @param {int} total_frames 
 * @param {int} k 
 * @returns x1
 * @returns x2
 * @returns y1
 * @returns y2
 */
function kth_complex_coordinate(first_complex_coordinates, last_complex_coordinates, total_frames, k) {
    let alpha = k / total_frames
    let x1 = (1 - alpha) * first_complex_coordinates.x1 + alpha * last_complex_coordinates.x1;
    let x2 = (1 - alpha) * first_complex_coordinates.x2 + alpha * last_complex_coordinates.x2;
    let y1 = (1 - alpha) * first_complex_coordinates.y1 + alpha * last_complex_coordinates.y1;
    let y2 = (1 - alpha) * first_complex_coordinates.y2 + alpha * last_complex_coordinates.y2;
    return {
        x1: x1,
        x2: x2,
        y1: y1,
        y2: y2        
    }
}

/**
 * Translates an escape time to an array of three values that will determine the colour of that point. The colour of the points will be determined by how many iterations it took before the point escaped.
 * @param {*} current_escape_time
 * @returns colour
 */
function escape_time_to_colour(current_escape_time) {

    let R = Math.floor(255 * Math.log10(current_escape_time) );
    let B = (Math.floor(255 * (Math.pow(current_escape_time, 0.2))));
    let G = (Math.floor(255 * 3 * (current_escape_time * (1 - current_escape_time) + 0.25 * current_escape_time)));

    let colours = new Uint8Array([R,G,B])
    return colours
}

/**
 * Creates new axes boundaries based off of the speed and the point it's zooming towards.
 * @param {int} complex_coordinates
 * @param {int} z0
 * @param {int} speed
 * @returns x1
 * @returns x2
 * @returns y1
 * @returns y2
 */

function zoom_in(complex_coordinates, z0, speed) {
    let x1 = complex_coordinates.x1 * (1 - speed) + z0.re * speed;
    let x2 = complex_coordinates.x2 * (1 - speed) + z0.re * speed;
    let y1 = complex_coordinates.y1 * (1 - speed) + z0.im * speed;
    let y2 = complex_coordinates.y2 * (1 - speed) + z0.im * speed;

    return {
        x1: x1,
        x2: x2,
        y1: y1,
        y2: y2
    }

}
module.exports = { make_frames, zoom_in }