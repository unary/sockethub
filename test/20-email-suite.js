require("consoleplusplus/console++");
if(typeof(define) !== 'function') {
  var define = require('amdefine')(module);
}
define(['require'], function (require) {
  var suites = [];

  suites.push({
    name: "email platform tests",
    desc: "collection of tests for the email platform",
    setup: function (env, test) {
      env.nodemailer = {};
      env.nodemailer.createTransport = test.Stub(function createTransportStub(name, obj) {
            if (name === 'SMTP') {
              console.log('NODEMAILER createTransport STUB CALLED');
              var ret =  {};
              ret.sendMail = test.Stub(function sendMail(msg, cb) {
                  console.log('NODEMAILER sendMail STUB CALLED');
                  cb(null, true);
                });

              return ret;
            }
          });
      GLOBAL.nodemailer = env.nodemailer;

      env.respHandler = function (testObj) {
        return function(err, status, obj) {
          if (testObj !== undefined) {
            testObj.write(' responseHandler: ['+err+'] ['+status+'] ['+obj+']');
            testObj.result(status);
          } else {
            test.write(' responseHandler: ['+err+'] ['+status+'] ['+obj+']');
          }
        };
      };

      env.Session = require('../lib/protocols/sockethub/session')('1234567890');
      env.Session.get('testsess1').
        then(function (session) {
          env.session = session;

          return session.getPlatformSession('email');
        }).
        then(function (psession) {
          env.psession = psession;
          env.psession.send = function (job) {
            test.write('psession send called:',job);
          };
          var EmailMod = require('../lib/protocols/sockethub/platforms/email');
          //console.log('email:', env.Email);
          env.Email = EmailMod();
          env.Email.init(psession).then(function() {
            test.result(true);
          }, function(err) {
            test.result(false, err);
          });
        });
    },
    takedown: function (env, test) {
      env.Session.destroy(env.session.getSessionID()).then(function () {
        test.result(true);
      }, function (err) {
        test.result(false, err);
      });
    },
    tests: [
      {
        desc: "set credential details",
        run: function (env, test) {
          var job = {
            target: 'email',
            object: {
              credentials: {
                'whitney@houston.com': {
                  smtp: {
                    host: 'mailservice.example.com',
                    username: 'whit',
                    password: 'ney'
                  }
                }
              }
            }
          };

          env.psession.setConfig('credentials', job.object.credentials).then(function () {
            env.psession.getConfig('credentials').then(function (creds) {
              test.assert(creds, job.object.credentials);
            }, function (err) {
              test.result(false, err);
            });
          }, function (err) {
            test.result(false, err);
          });
        }
      },
      {
        desc: "email.send() eventually calls nodemailer.sendMail()",
        run: function (env, test) {
          var job = {
            rid: '002',
            verb: 'send',
            platform: 'email',
            actor: { name: 'Whitney Houston', address: 'whitney@houston.com' },
            object: { subject: 'Love you', text: 'I will always.' },
            target: [{ field: "to", name: 'Stevie Wonder', address: 'stevie@wonder.com' }]
          };
          env.Email.send(job).then(function (err, status, obj) {
            env.respHandler()(err, status, obj);
            test.assert(env.nodemailer.createTransport.called, true);
            //var transport = env.nodemailer.createTransport('SMTP', {});
            //test.assert(transport.sendMail.called, true);
          });
        }
      }
    ]
  });

  return suites;
});
