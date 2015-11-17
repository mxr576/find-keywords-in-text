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
       * @param {callback} cb - Callback.
       */
      var getTokenizedText = function (cb) {
        var tokenized_text = tokenizer.tokenize(req.params.text);
        cb(null, tokenized_text);
      };

      /**
       * Validate, if the text is a string and returns it in lowercase.
       *
       * @param {string} text - Text to analyze.
       * @param {callback} cb - Callback.
       *
       * @returns {*}
       */
      var isString = function (text, cb) {
        if (util.isString(text)) {
          return cb(null, text.toLowerCase());
        }

        return cb(null, false);
      };

      /**
       * Convert all string in the given array to lowercase.
       *
       * @param {string[]} tokenized_text - Array of words from the text.
       * @param {callback} cb - Callback.
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
       * Return the unique words from the given text array.
       *
       * @param {string[]} tokenized_text - Array of words from the text.
       * @param {callback} cb - Callback.
       */
      var uniqueItems = function (tokenized_text, cb) {
        return cb(null, _.unique(tokenized_text));
      };

      /**
       * Removes the stopwords from the given text array.
       *
       * @param {string[]} tokenized_text -  Array of words from the text.
       * @param {callback} cb - Callback.
       */
      var stopWordCleaning = function (tokenized_text, cb) {
        return cb(null, _.difference(tokenized_text, stopwords));
      };

      /**
       * Calculates the Levenshtein distance of two words.
       *
       * @param {string} word1 - First word to compare.
       * @param {string} word2 - Second word to compare.
       * @param {callback} cb - Callback.
       */
      var calculateLevenshteinDistance = function (word1, word2, cb) {
        return cb(null, natural.LevenshteinDistance(word1, word2));
      };

      /**
       * Calculate a keyword's distance from each words in the text async.
       *
       * @param {string} keyword - Keyword.
       * @param {string[]} tokenized_text -  Array of words from the text.
       * @param {int} distance - Minimum acceptable distance.
       * @param {callback} cb - Callback.
       */
      var calculateKeywordDistance = function (keyword, tokenized_text, distance, cb) {
        var asyncTasks = [];

        // Calculate distance of this keyword from all word in the tokenized
        // text async.
        tokenized_text.forEach(function (item) {
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
            // Return only those ones which distance is lower or equal
            // that the provided limit.
            return cb(null, result.filter(function (val) {
              return val.distance <= distance;
            }));
          }
          return cb(err, null);
        });
      };

      /**
       * Find and return the matching keywords from the text.
       */
      async.waterfall([getTokenizedText, itemsToLowercase, uniqueItems, stopWordCleaning], function (err, tokenized_text) {
        if (!err) {
          var asyncTasks = [];

          // Create an async task for all provided keywords, which calculate
          // their distance from all words in the (filtered) text.
          req.params.keywords.forEach(function (keyword) {
            asyncTasks.push(function (cb) {
              calculateKeywordDistance(keyword, tokenized_text, req.params.distance, function (err, result) {
                if (!err) {
                  return cb(null, {keyword: keyword, results: result});
                }
                return cb(err, null);
              });
            });
          });

          async.parallel(asyncTasks, function (err, result) {
            if (!err) {
              // Return only those keywords which has least one result,
              // which means that this particular keyword's distance is
              // lower or equal than the limit from a word in the text.
              res.send({
                keywords: result.filter(function (keyword) {
                  return keyword.results.length > 0;
                }),
                // For debug reasons, return the tokenized text in
                // the response too.
                clean_text: tokenized_text.join(' ')
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
