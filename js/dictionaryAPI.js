// https://dictionaryapi.dev/
// Free Dictionary API, Calling https://en.wiktionary.org/wiki/


/*
 * ==== nodeJS import packages ================================================================ 
 */
// ==== None ====

var dictionaryAPIURL = "https://api.dictionaryapi.dev/api/v2/entries/en/"

function dictAPICaller(TheLink, sheet, req, res) {
    const axios = require("axios");
    const dictURL = dictionaryAPIURL + word;
    axios
        .get(dictURL)
        .then(function(response) {
            var outputTable = []
            outputTable = JSON.parse(response)
            console.log(outputTable);
        })
        .catch(function(error) {
            console.log(error);
            return ""
        })
        .then(function() {
            return ""
        });
}