var AWS = require('aws-sdk');
var q = require('q');
var path = require('path');
var mime = require('mime');
var transformS3Event = require('lambduh-transform-s3-event');
var validate = require('lambduh-validate');
var execute = require('lambduh-execute');

process.env['PATH'] = process.env['PATH'] + ':/tmp/:' + process.env['LAMBDA_TASK_ROOT']

var pathToBash;
if (!process.env.NODE_ENV || process.env.NODE_ENV != 'testing') {
  //production
  pathToBash = '/tmp/gif2mp4';
} else {
  //local
  pathToBash = './bin/gif2mp4';
}

var s3 = new AWS.S3();

exports.handler = function(event, context) {
  var promises = [];

  promises.push(transformS3Event(event))
  promises.push(validate({
    "srcKey": {
      endsWith: "\\.gif",
      endsWithout: "_\\d+\\.gif",
      startsWith: "events/"
    }
  }));

  if (!process.env.NODE_ENV || process.env.NODE_ENV != 'testing') {
    promises.push(execute({
      shell: 'cp /var/task/ffmpeg /tmp/.; chmod 755 /tmp/ffmpeg;'
    }));
    promises.push(execute({
      shell: 'cp /var/task/gif2mp4 /tmp/.; chmod 755 /tmp/gif2mp4;'
    }));
  }

  promises.push(function(options) {
    return q.Promise(function(resolve, reject) {
      console.log('Pulling .gif from S3.');
      options.gifPath = '/tmp/' + path.basename(options.srcKey);
      console.log('the gifPath is: ' + options.gifPath);
      var params = {Bucket: options.srcBucket, Key: options.srcKey};
      var file = require('fs').createWriteStream(options.gifPath);
      var s3Req = s3.getObject(params)
      s3Req.on('complete', function() {
        resolve(options);
      })
      s3Req.on('error', function(err) {
        reject(err);
      });
      s3Req.createReadStream().pipe(file)
    })
  });

  promises.push(function(options) {
    return q.Promise(function(resolve, reject) {
      console.log('Launching script.');

      //wait 5 seconds for stream, or some bullshit
      setTimeout(function() {
        var child = require('child_process').spawn(pathToBash, [options.gifPath]);

        child.stdout.on('data', function (data) {
          console.log("stdout: " + data);
        });
        child.stderr.on('data', function (data) {
          console.log("stderr: " + data);
        });
        child.on('exit', function (code) {
          if (code != 0) {
            reject(new Error('spawn script err'));
          } else {
            resolve(options);
          }
        });

      }, 5000);
    });
  });

  promises.push(function(options) {
    var def = q.defer();
    console.log('Ready for upload.');
    options.mp4Path = '/tmp/' + path.basename(options.gifPath, '.gif') + '-final.mp4';

    var params = {
      Bucket: options.srcBucket,
      Key: path.dirname(options.srcKey) + "/" + path.basename(options.srcKey, '.gif') + '.mp4',
      ContentType: mime.lookup(options.mp4Path)
    }

    var body = require('fs').createReadStream(options.mp4Path)
    var s3obj = new AWS.S3({params: params});
    s3obj.upload({Body: body})
      .on('httpUploadProgress', function(evt) {
        console.log('Upload progress: ' + (100 * evt.loaded / evt.total));
      })
      .send(function(err, data) {
        if (err) {
          def.reject(err);
        } else {
          console.log('Successful conversion and upload.');
          def.resolve(options);
        }
      });
    return def.promise;
  });

  promises.push(function(options) {
    return execute({
      shell: "rm " + options.mp4Path
    })(options);
  });

  promises.push(function(options) {
    var def = q.defer();
    console.log('Finished.');
    context.done();
    def.resolve();
    return def.promise;
  });

  promises.reduce(q.when, q())
    .fail(function(err){
      console.log('Promise rejected with err:');
      console.log(err);
      //doesn't try again for now, need to isolate errors from invalid keys
      context.done(null, err);
    });
};
