var fs = require('fs');
var path = require('path');

var browserify = require('browserify');
var UglifyJS = require('uglify-js');

var compressAttributes = require('./util/compress_attributes');
var constants = require('./util/constants');

/*
 * This script takes one argument
 *
 * Run `npm run build -- dev` or `npm run build -- --dev`
 * to include source map in the plotly.js bundle
 *
 * N.B. This script is meant for dist builds; the output bundles are placed
 *      in plotly.js/dist/.
 *      Use `npm run watch` for dev builds.
 */

var arg = process.argv[2];
var DEV = (arg === 'dev') || (arg === '--dev');


// Check if style and font build files are there
try {
    fs.statSync(constants.pathToCSSBuild).isFile();
    fs.statSync(constants.pathToFontSVGBuild).isFile();
}
catch(e) {
    throw new Error([
        'build/ is missing a or more files',
        'Please run `npm run preprocess` first'
    ].join('\n'));
}


// Browserify plotly.js
_bundle(constants.pathToPlotlyIndex, constants.pathToPlotlyDist, {
    standalone: 'Plotly',
    debug: DEV,
    pathToMinBundle: constants.pathToPlotlyDistMin
});

// Browserify the geo assets
_bundle(constants.pathToPlotlyGeoAssetsSrc, constants.pathToPlotlyGeoAssetsDist, {
    standalone: 'PlotlyGeoAssets'
});

// Browserify the plotly.js with meta
_bundle(constants.pathToPlotlyIndex, constants.pathToPlotlyDistWithMeta, {
    standalone: 'Plotly',
    debug: DEV
});

// Browserify the plotly.js partial bundles
constants.partialBundleNames.forEach(function(name) {
    var pathToIndex = path.join(constants.pathToLib, 'index-' + name + '.js'),
        pathToBundle = path.join(constants.pathToDist, 'plotly-' + name + '.js'),
        pathToMinBundle = path.join(constants.pathToDist, 'plotly-' + name + '.min.js');

    _bundle(pathToIndex, pathToBundle, {
        standalone: 'Plotly',
        debug: DEV,
        pathToMinBundle: pathToMinBundle
    });
});

function _bundle(pathToIndex, pathToBundle, opts) {
    opts = opts || {};

    // do we output a minified file?
    var pathToMinBundle = opts.pathToMinBundle,
        outputMinified = !!pathToMinBundle && !opts.debug;

    var browserifyOpts = {};
    browserifyOpts.standalone = opts.standalone;
    browserifyOpts.debug = opts.debug;
    browserifyOpts.transform = outputMinified ? [compressAttributes] : [];

    var b = browserify(pathToIndex, browserifyOpts),
        bundleWriteStream = fs.createWriteStream(pathToBundle);

    bundleWriteStream.on('finish', function() {
        logger(pathToBundle);
    });

    b.bundle(function(err, buf) {
        if(err) throw err;

        if(outputMinified) {
            var minifiedCode = UglifyJS.minify(buf.toString(), constants.uglifyOptions).code;

            fs.writeFile(pathToMinBundle, minifiedCode, function(err) {
                if(err) throw err;

                logger(pathToMinBundle);
            });
        }
    })
    .pipe(bundleWriteStream);
}

function logger(pathToOutput) {
    var log = 'ok ' + path.basename(pathToOutput);

    console.log(log);
}
