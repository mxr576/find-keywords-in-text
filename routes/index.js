'use strict';

var async = require('async');
var natural = require('natural');
var _ = require('underscore');
var util = require('util');
var stopwords = require('stopwords').english;
var tokenizer = new natural.WordTokenizer();

module.exports = function (server) {
  server.post('/', function (req, res, next) {
    if (req.params.text === undefined) {
      res.send(404, {
        error: 'No text submitted to analyze!'
      });
    }
    else if (req.params.keywords === undefined || !util.isArray(req.params.keywords)) {
      res.send(404, {
        error: 'Keyword(s) are missing! Keywords should be passed as an array.'
      });
    }
    else if (req.params.distance === undefined || parseInt(req.params.distance) != req.params.distance || req.params.distance <= 0) {
      res.send(404, {
        error: "Distance is missing or it isn't an unsigned integer value."
      });
    }
    else {
      /**
       * Tokenize text.
       *
       * @param cb
       *   Callback function.
       */
      var getTokenizedText = function (cb) {
        var tokenized_text = tokenizer.tokenize(req.params.text);
        cb(null, tokenized_text);
      };

      /**
       * Validate, if the text is a string and return it lowercase.
       *
       * @param text
       *   Text to analyze.
       * @param cb
       *   Callback function.
       * @returns {*}
       */
      var isString = function (text, cb) {
        if (util.isString(text)) {
          return cb(null, text.toLowerCase());
        }

        return cb(null, false);
      };

      /**
       * Convert the strings in the array to lowercase.
       *
       * @param tokenized_text
       *   Tokenized text array.
       * @param cb
       *   Callback function.
       */
      var itemsToLowercase = function (tokenized_text, cb) {
        async.map(tokenized_text, isString, function (err, result) {
          if (!err) {
            return cb(null, result);
          }

          return cb(err, null);
        });
      };

      /**
       * Return the unique items in the tokenized text.
       *
       * @param clean_tokenized
       *   Tokenized text array.
       * @param cb
       *   Callback function.
       * @returns {*}
       */
      var uniqueItems = function (clean_tokenized, cb) {
        return cb(null, _.unique(clean_tokenized));
      };

      /**
       * Removes the stopwords from the tokenized text array.
       *
       * @param clean_tokenized
       *   Tokenited text array.
       * @param cb
       * @returns {*}
       */
      var stopWordCleaning = function (clean_tokenized, cb) {
        return cb(null, _.difference(clean_tokenized, stopwords));
      };

      /**
       * Calculates the Levenshtein distance of two text.
       *
       * @param text1
       *   First text item.
       * @param text2
       *   Second text item.
       * @param cb
       *   Callback function.
       * @returns {*}
       */
      var calculateLevenshteinDistance = function (text1, text2, cb) {
        return cb(null, natural.LevenshteinDistance(text1, text2));
      };

      /**
       * Calculate a keyword's distance for each word in the text async.
       *
       * @param keyword
       *   Keyword to check.
       * @param clean_tokenized_text
       *   Tokenized text array.
       * @param distance
       *   Minimum acceptable distance.
       * @param cb
       */
      var calculateKeywordDistance = function (keyword, clean_tokenized_text, distance, cb) {
        var asyncTasks = [];

        clean_tokenized_text.forEach(function (item) {
          asyncTasks.push(function (callback) {
            calculateLevenshteinDistance(keyword, item, function (err, distance) {
              if (!err) {
                return callback(null, {
                  text: item,
                  distance: distance
                });
              }
              return callback(err, null);
            });
          });
        });

        async.parallel(asyncTasks, function (err, result) {
          if (!err) {
            return cb(null, result.filter(function (val) {
              return val.distance <= distance;
            }));
          }
          return cb(err, null);
        });
      };

      /**
       * Analyze the text for the given keywords and return the matching ones.
       */
      async.waterfall([getTokenizedText, itemsToLowercase, uniqueItems, stopWordCleaning], function (err, clean_tokenized_text) {
        if (!err) {
          var asyncTasks = [];

          req.params.keywords.forEach(function (keyword) {
            asyncTasks.push(function (cb) {
              calculateKeywordDistance(keyword, clean_tokenized_text, req.params.distance, function (err, result) {
                if (!err) {
                  return cb(null, {keyword: keyword, results: result});
                }
                return cb(err, null);
              });
            });
          });

          async.parallel(asyncTasks, function (err, result) {
            if (!err) {
              // Return all keyword which has least one match in the text
              // in the given distance level.
              res.send({
                keywords: result.filter(function (keyword) {
                  return keyword.results.length > 0;
                }),
                clean_text: clean_tokenized_text.join(' ')
              });
            }
            else {
              res.send(404, {error: util.inspect(err)});
            }
          });
        }
        else {
          res.send(404, {error: util.inspect(err)});
        }
      });
      return next();
    }
  })
};
