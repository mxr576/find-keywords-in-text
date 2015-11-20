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
      var stringsToLowercase = function (text, cb) {
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
        async.map(tokenized_text, stringsToLowercase, function (err, result) {
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
       * Find and return the matching keywords from the text.
       */
      async.waterfall([getTokenizedText, itemsToLowercase, uniqueItems, stopWordCleaning], function (err, tokenized_text) {
        if (!err) {
          var isError = false;
          var results = {
            keywords: [],
            clean_text: tokenized_text.join(' ')
          };

          for (var i = 0; i < req.params.keywords.length; i++) {
            for (var j = 0; j < tokenized_text.length; j++) {
              calculateLevenshteinDistance(req.params.keywords[i], tokenized_text[j], function (err, distance) {
                if (err) {
                  distance = false;
                  isError = true;
                }
                // We have found a word in the text which distance is
                // lower or equal with the required distance, so there is no
                // need to continue the search for other matches in the text.
                // Continue the parent iteration with the next keyword.
                if (distance <= req.params.distance) {
                  results.keywords.push(
                    {
                      keyword: req.params.keywords[i],
                      reason: {
                        word: tokenized_text[j],
                        distance: distance
                      }
                    }
                  );
                  j++;
                }
              });
            }
          }
          if (isError) {
            results.error = 'There was en error meanwhile the text processing.';
          }
          res.send(200, results);
        }
        else {
          res.send(404, {error: util.inspect(err)});
        }
      });
      return next();
    }
  })
};
