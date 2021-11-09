// nodeJS import packages
const express = require("express");
const parseJson = require("parse-json");
const cors = require("cors");
const request = require("request");
// const { timers } = require("jquery");
// const { Endpoint } = require("googleapis-common");
// const { json } = require("express");
// const { Tween } = require("jquery");
const path = require("path");
const fs = require("fs");
// const { Module } = require("module");

const app = express();
app.use(express.static("public"));
app.use(cors());
app.use('/', express.static(__dirname));
app.use('/js', express.static(__dirname + '/js'))

app.get('/', function(req, res) {
    res.sendFile('main.html', { root: __dirname })
})

// ==============   Variables area   =================== //
// Overall Env Setting
var debugMode = false;

// RegEx Bank default setting
const defaultRegExBankID_old = "2PACX-1vRoq86tBqQua-EvtumRaSu7m8Qb32gUZ8SZfcFvYvRZWb31zo9tbO7wiMSiKC0Ms87nqZEf5D1CSMAo"; // the original regex bank
const defaultRegExBankID = "2PACX-1vR_VCPZO38JtcM6gpj8Gnj6vDzsMN1c6gDTCs2TbWfg08KGounBktIxUX3ntQKCl04MZLpFQRzzDF-J"; // the copy of regex bank with meaning included.
const defaultRegExBankPageNum = "1";
const defaultRegExDomain = ""; // "" means all the available domains will be searched.
const defaultMeaningIndex = 0; // Pick the 1st meaning encounter found.

// Google sheet ralted parameters.
const prefixPubSheetURL = "https://docs.google.com/spreadsheets/d/e/";
const suffixPubSheetURL = "/pubhtml";
const iniTime = new Date();

// Reserved characters and flags
const keyCharList = ["\\", "^", "$", ".", "|", "?", "*", "+", "(", ")", "[", "]", "{", "}"];
const nonPrintCharList = ["\r", "\n", "\t"]; // return, newline, table
const mathCharList = ["^", ".", "?", "*", "+", "(", ")", "[", "]", "{", "}"];

const reservedFlag = ["i", "x", "M"]; // Flag name reserved for special purpose.
// Flag usage: surround keyword with "/", and add tag after the last /. Flags' order doesn't matter.
// Flag setup: don't use non-character as the flag (don't use reserved character, whitespace, and etc.)
// Flag available:
// [i]nsensitive: Case insensitive match
// e[x]tended: Ignore whitespace
// [M]athsEquation: Skip all keyCharList including ? + ( ) [ ] { } * ^ .

// Regex flags for reference:
// [g]lobal: Don't return after first match.
// [m]ulti line: ^and$ match start/end of line
// [i]nsensitive: Case insensitive match        ****** We can use it
// e[x]tended: Ignore whitespace                ****** We can use it
// [s]ingle line: Dot matches newline
// [u]nicode: Match with full unicode
// [U]ngreedy: Make quantifiers lazy
// [A]nchored: Anchor to start of pattern, or at the end of the most recent match
// [J]changed: Allow duplicate subpattern names
// [D]ollar end only: $ matches only end of pattern

//====================================================================================
// >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>    TEST Area     <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
//------------------------------------------------------------------------------------
var testMode = false;
if (testMode) {

    jsonStringProcess("\{\"word\":\"/AC\\w+\/i\"\}");

    return;
}

//====================================================================================
// >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>    To do List    <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
//------------------------------------------------------------------------------------
// 1. Pub = 1, fast loading SS in cache? check code                     [Check it]
// 2. Check the Json String before input. skip some special character.  [Check it]
// 3. Lookup RegEx                                                      [Check it]
// 4. Embed a help html page as a return when no keyword.               [Need to do]
// 5. Build UI for the tool                                             [Check it]
// 6. Testing case                                                      [Check it]
// 7. Add "M" to skip maths operations                                  [Check it]
// 8. Flags validation                                                  [Check it]
// 9. Assyn cause issue. Need to solve it.                              [Check it]
// 10. Need CSS for UI.                                                 [Need to do]
// 11. Build new get request and split the meaning and words.           [Check it]


//====================================================================================
// >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>    Test Case   <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
//------------------------------------------------------------------------------------
// 1. \\\\\\[\\{\\(\\]\\}\\)\\.\\+\\?\\*\\$\\^
// 2. /AC/i
// 3. /foRward biAsEd/i
// 4. /1+2+3=?/M        %2B for +
// 5. /current         voltage/x
// 6. /resistor/iMx
// 7. /resistor/iMMMMMMxxxxxxx
// 8. /resistor/asd
// 9. /current         voltage/x,/foRward biAsEd/i
// 10. /current     /,/    voltage/x
// 11. /current         voltage/


//====================================================================================
// >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>    GET    <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
//-------------------------- Lookup Keywords List ------------------------------------
//------------------------------------------------------------------------------------
app.get("/wordRegex", lookUpRegExProcess);

/**
 * RegEx lookup process
 * @param {string} req 
 * @param {string} res 
 * @returns 
 */
function lookUpRegExProcess(req, res) {

    let host = req.get('host');
    if (host.indexOf("localhost") >= 0) debugMode = true;

    var theInputJsonStr = req.query.json;
    const theJSON = parseJson(theInputJsonStr);
    let wordListsString = theJSON.word; // Required
    let regexBankPubID = theJSON.ID; // Optional
    let tabNum = theJSON.page; // Optional
    let domainName = theJSON.domain; // Optional
    let meaningIndex = theJSON.meaning; // Optional

    systemDebuggingMsg("Start RegEx lookup!", debugMode);
    systemDebuggingMsg("The keywords List string is: " + wordListsString, debugMode);

    regexBankPubID = regexBankPubID || defaultRegExBankID;
    tabNum = tabNum || defaultRegExBankPageNum;
    domainName = domainName || defaultRegExDomain;
    meaningIndex = meaningIndex || defaultMeaningIndex;

    if (wordListsString === undefined) {
        systemDebuggingMsg("Unvalide input! No string found!", debugMode);
        htmlDoc = "Unvalid input! No string found! Will reply with help document later!";
        res.setHeader('Content-Type', 'text/html');
        // res.sendFile('help.html', { root: __dirname });
        res.status(200).end(htmlDoc);
        return;
    }

    const fileName = `${regexBankPubID}_${tabNum}.json`;
    const theFilePath = path.join(__dirname, "./public/" + fileName);

    var jsonRegExTable;

    if (!fs.existsSync(theFilePath)) {
        systemDebuggingMsg("Didn't find on local cache. Loading from Server", debugMode)
        systemDebuggingMsg("Connecting to RegEx Bank. Please wait...", debugMode);
        findRegExInGS(req, res);
    } else {
        systemDebuggingMsg("Quick loading Regex Bank...", debugMode);
        jsonRegExTable = JSON.parse(fs.readFileSync(theFilePath, 'utf8'));

        var resultJSON = regexFinder(wordListsString, domainName, meaningIndex, jsonRegExTable);

        const finalTime = new Date();
        systemDebuggingMsg(`It takes ${finalTime - iniTime} ms.`, debugMode);
        systemDebuggingMsg("Quit RegEx lookup function. Thank you for using!", debugMode);
        res.setHeader("Content-Type", "application/json");
        res.status(404).end(JSON.stringify(resultJSON));
    }
}

/**
 * Read Google sheet Using axios.
 * @param {string} regexBankURL 
 * @param {string} tabNum 
 * @param {string} theFilePath 
 */
function findRegExInGS(req, res) {
    const axios = require("axios");
    var theInputJsonStr = req.query.json;
    const theJSON = parseJson(theInputJsonStr);
    let wordListsString = theJSON.word; // Required
    let regexBankPubID = theJSON.ID; // Optional
    let tabNum = theJSON.page; // Optional
    let domainName = theJSON.domain; // Optional
    let meaningIndex = theJSON.meaning; // Optional

    regexBankPubID = regexBankPubID || defaultRegExBankID;
    tabNum = tabNum || defaultRegExBankPageNum;
    domainName = domainName || defaultRegExDomain;
    meaningIndex = meaningIndex || defaultMeaningIndex;

    const fileName = `${regexBankPubID}_${tabNum}.json`;
    const theFilePath = path.join(__dirname, "./public/" + fileName);
    const regexBankURL = prefixPubSheetURL + regexBankPubID + suffixPubSheetURL;

    var jsonRegExTable;
    axios
        .get(regexBankURL)
        .then(function(response) {
            jsonRegExTable = regexTable2JSON(response, parseInt(tabNum));
            writeGS(JSON.stringify(jsonRegExTable), theFilePath);
            systemDebuggingMsg(`Online sheet is saved: ${theFilePath}!`, debugMode);
        })
        .catch(function(error) {
            systemDebuggingMsg("Failed to load the sheet!!!", debugMode);
            console.log(error);
            res.setHeader("Content-Type", "text/html");
            res.status(404).end(`Failed to build the connection to GS!`);
            return;
        })
        .then(function() {
            var resultJSON = regexFinder(wordListsString, domainName, meaningIndex, jsonRegExTable);

            res.setHeader("Content-Type", "application/json");
            res.status(200).end(JSON.stringify(resultJSON));
            const finalTime = new Date();
            systemDebuggingMsg(`It takes ${finalTime - iniTime} ms.`, debugMode);
            systemDebuggingMsg("Quit RegEx lookup function. Thank you for using!", debugMode);
        });
}

/**
 * This function support to decompose the keywordsString according to the syntax
 * @param {string} domainName the domain name of the word 
 * @param {string} keywordsString the keyword string with syntax in default
 * @param {string} meaningIndex the # of the meaning 
 * @param {object} jsonTable JSON table
 * @returns json String
 */
function regexFinder(keywordsString, domainName, meaningIndex, jsonTable) {
    systemDebuggingMsg("Decomposite the keywordString: " + keywordsString, debugMode);

    // split the keywordsList
    var keywordsList = [];
    let keywordsStringArray = keywordsString.split(",");

    // Extract flags from each keyword and process each keyword
    for (let i = 0; i < keywordsStringArray.length; i++) {
        let tempWord = stringFlagsProcess(keywordsStringArray[i]);
        keywordsList.push(tempWord);
    }

    var outputArray = [];

    for (let i = 0; i < keywordsList.length; i++) {
        var keywordStacking = "";
        var outputRegEx = "";
        var tempString = keywordsList[i];
        var owSwitch; // undefined means it just started. True means previous char was a word, False means previous char was a operator.

        if (debugMode) {
            console.log("Before:");
            console.log("KeywordStacking: " + keywordStacking);
            console.log("OutputRegEx: " + outputRegEx);
            console.log("TempString: " + tempString);
            // console.log("owSwitch: " + owSwitch);
        }

        // Separater the keywords and operators
        while (tempString.length > 0) {
            switch (owSwitch) {
                case undefined:
                    if (keyCharList.indexOf(tempString.charAt(0)) > -1) {
                        outputRegEx = outputRegEx + tempString.charAt(0);
                        if (tempString.charAt(0) == "\\") {
                            outputRegEx = outputRegEx + tempString.charAt(1);
                            tempString = tempString.substring(1);
                        }
                        owSwitch = false;
                    } else {
                        keywordStacking = keywordStacking + tempString.charAt(0);
                        owSwitch = true;
                    }
                    tempString = tempString.substring(1);

                    break;
                case true:
                    if (keyCharList.indexOf(tempString.charAt(0)) > -1) {
                        systemDebuggingMsg("Find: " + keywordStacking, debugMode);
                        let tempRegex = regexMatching(keywordStacking, domainName, meaningIndex, jsonTable);
                        outputRegEx = outputRegEx + tempRegex;
                        outputRegEx = outputRegEx + tempString.charAt(0);
                        if (tempString.charAt(0) == "\\") {
                            outputRegEx = outputRegEx + tempString.charAt(1);
                            tempString = tempString.substring(1);
                        }
                        keywordStacking = "";
                        owSwitch = false;
                    } else {
                        keywordStacking = keywordStacking + tempString.charAt(0);
                        owSwitch = true;
                    }
                    tempString = tempString.substring(1);
                    break;
                case false:
                    if (keyCharList.indexOf(tempString.charAt(0)) > -1) {
                        outputRegEx = outputRegEx + tempString.charAt(0);
                        owSwitch = false;
                    } else {
                        keywordStacking = keywordStacking + tempString.charAt(0);
                        owSwitch = true;
                    }
                    tempString = tempString.substring(1);
                    break;
                default:
                    systemDebuggingMsg("Surprise!!!!", debugMode);
                    break;
            }
            // console.log(tempString);
            // console.log(keywordStacking);
        }

        console.log(`Current Keyword Stacking is: ${keywordStacking}`);

        // Search each keyword for its regex.
        if (keywordStacking != "") {
            let tempRegex = regexMatching(keywordStacking, domainName, meaningIndex, jsonTable);
            outputRegEx = outputRegEx + tempRegex;
        }

        if (debugMode) {
            console.log("After:");
            console.log("KeywordStacking: " + keywordStacking);
            console.log("OutputRegEx: " + outputRegEx);
            console.log("TempString: " + tempString);
        }

        if (outputRegEx == "") {
            systemDebuggingMsg("Not found!", debugMode);
        } else {
            outputArray.push(outputRegEx);
        }
    }

    resultJSON = {

        "keyword": keywordsString,
        "domain": domainName,
        "meaning": meaningIndex,
        "regex": outputArray.join(",")
    }
    console.log(resultJSON);
    return (resultJSON);
}

/**
 * Find the regex for the provided word in the given domain using the bank table.
 * @param {string} domainName the domain name of the word 
 * @param {string} tWord the target word 
 * @param {JSON} jsonTable the json table object  
 * @returns the regex of the target word
 */
function regexMatching(keywordString, domainName, meaningIndex, jsonTable) {
    try {
        systemDebuggingMsg("Looking for the word: " + keywordString, debugMode);

        var wordArray = []
        for (i = 0; i < jsonTable.length; i++) {
            if (domainName === "") {
                if (jsonTable[i].word === keywordString) {
                    wordArray.push(jsonTable[i]);
                } else if (jsonTable[i].Meaning === meaningIndex) {
                    wordArray.push(jsonTable[i]);
                }
            } else if (jsonTable[i].word === keywordString &&
                jsonTable[i].domain === domainName) {
                wordArray.push(jsonTable[i]);
            }
        }

        console.log(wordArray);

        if (wordArray.length == 0) {
            return keywordString;
        }

        try {
            var tWord = wordArray[parseInt(meaningIndex)];
        } catch (e) {
            console.log("MeaningIndex is not a number!")
            var tWord = wordArray[0];
        }

        var wordList = [];
        wordList.push(tWord.word);
        for (let j = 1; j <= 23; j++) {
            var tempName = "synonyms" + j;
            if (tWord[tempName] === "") {
                continue;
            } else {
                wordList.push(tWord[tempName]);
            }
        }

        console.log(wordList);

        var uniqueWordList = wordList.filter(onlyUnique);
        var regexList = [];

        for (let i = 0; i < uniqueWordList.length; i++) {
            for (let j = 0; j < jsonTable.length; j++) {
                if (jsonTable[j].word === uniqueWordList[i]) {
                    if (jsonTable[j].RegEx == "") {
                        systemDebuggingMsg("[ROW" + j + "] '" + uniqueWordList[i] + "' has no regex!", debugMode)
                        if (uniqueWordList[i].length < 5) {
                            var tempRegEx = `\b(${uniqueWordList[i]})`;
                        } else {
                            var tempRegEx = `\b(${uniqueWordList[i]})\b`;
                        }
                        regexList.push(tempRegEx)
                    }
                    if (domainName === "" || jsonTable[j].category === domainName) {
                        if (uniqueWordList[i].length < 5) {
                            var tempRegEx = `\b(${jsonTable[j].RegEx})`;
                        } else {
                            var tempRegEx = `\b(${jsonTable[j].RegEx})\b`;
                        }
                        regexList.push(tempRegEx);
                    }
                    console.log(uniqueWordList[i] + ": " + jsonTable[j].RegEx)
                }
            }
        }

        return (regexList.join("|"));
    } catch (error) {
        systemDebuggingMsg("Error happened!", debugMode);
        console.log(error);
        return ("");
    }
}


//------------------------ Lookup Meaning of the word---------------------------------
//------------------------------------------------------------------------------------
app.get("/wordMeaning", lookUpMeaningProcess);

/**
 * Look up word's meaning Process.
 * @param {string} req 
 * @param {string} res 
 * @returns 
 */
function lookUpMeaningProcess(req, res) {
    let host = req.get('host');
    if (host.indexOf("localhost") >= 0) debugMode = true;

    var theInputJsonStr = req.query.json;
    const theJSON = parseJson(theInputJsonStr);
    let wordListsString = theJSON.word; // Required
    let regexBankPubID = theJSON.ID; // Optional
    let domainName = theJSON.domain // Optional
    let tabNum = theJSON.page; // Optional

    regexBankPubID = regexBankPubID || defaultRegExBankID;
    domainName = domainName || defaultRegExDomain;
    tabNum = tabNum || defaultRegExBankPageNum;

    if (wordListsString === undefined) {
        systemDebuggingMsg("Unvalide input! No string found!", debugMode);
        htmlDoc = "Unvalid input! No string found! Will reply with help document later!";
        res.setHeader('Content-Type', 'text/html');
        // res.sendFile('help.html', { root: __dirname });
        res.status(404).end(htmlDoc);
        return;
    }

    if (wordListsString.split(",").length > 1) {
        systemDebuggingMsg("You can't look up the meaning for more than one keyword string!", debugMode);
        res.setHeader('Content-Type', 'text/html');
        res.status(200).end("You can't look up the meaning for more than one keyword string!");
        return;
    }

    wordListsString = stringFlagsProcess(wordListsString);

    const fileName = `${regexBankPubID}_${tabNum}.json`;
    const theFilePath = path.join(__dirname, "./public/" + fileName);

    if (!fs.existsSync(theFilePath)) {
        systemDebuggingMsg("Didn't find on local cache. Loading from Server", debugMode)
        systemDebuggingMsg("Connecting to RegEx Bank. Please wait...", debugMode);
        findMeaningInGS(req, res);
    } else {
        systemDebuggingMsg("Quick loading Regex Bank...", debugMode);
        jsonRegExTable = JSON.parse(fs.readFileSync(theFilePath, 'utf8'));

        var resultObj = meaningLookUp(wordListsString, domainName, jsonRegExTable);

        res.setHeader("Content-Type", "application/json");
        res.status(200).end(JSON.stringify(resultObj));
        const finalTime = new Date();
        systemDebuggingMsg(`It takes ${finalTime - iniTime} ms.`, debugMode);
        systemDebuggingMsg("Quit RegEx lookup function. Thank you for using!", debugMode);
    }
}

/**
 * Find meaning using Google Sheet.
 * @param {string} req 
 * @param {string} res 
 */
function findMeaningInGS(req, res) {
    const axios = require("axios");
    var theInputJsonStr = req.query.json;
    const theJSON = parseJson(theInputJsonStr);
    let wordString = theJSON.word; // Required
    let regexBankPubID = theJSON.ID; // Optional
    let domainName = theJSON.domain // Optional
    let tabNum = theJSON.page; // Optional

    regexBankPubID = regexBankPubID || defaultRegExBankID;
    domainName = domainName || defaultRegExDomain;
    tabNum = tabNum || defaultRegExBankPageNum;

    const fileName = `${regexBankPubID}_${tabNum}.json`;
    const theFilePath = path.join(__dirname, "./public/" + fileName);
    const regexBankURL = prefixPubSheetURL + regexBankPubID + suffixPubSheetURL;

    var jsonRegExTable = "";
    axios
        .get(regexBankURL)
        .then(function(response) {
            jsonRegExTable = regexTable2JSON(response, parseInt(tabNum));
            writeGS(JSON.stringify(jsonRegExTable), theFilePath);
            systemDebuggingMsg(`Online sheet is saved: ${theFilePath}!`, debugMode);
        })
        .catch(function(error) {
            systemDebuggingMsg("Failed to load the sheet!!!", debugMode);
            console.log(error);
            res.setHeader("Content-Type", "text/html");
            res.status(404).end(`Failed to build the connection to GS!`);
            return;
        })
        .then(function() {
            // always executed
            var resultObj = meaningLookUp(wordString, domainName, jsonRegExTable);

            res.setHeader("Content-Type", "application/json");
            res.status(200).end(JSON.stringify(resultObj));
            const finalTime = new Date();
            systemDebuggingMsg(`It takes ${finalTime - iniTime} ms.`, debugMode);
            systemDebuggingMsg("Quit RegEx lookup function. Thank you for using!", debugMode);
        });
}

/**
 * Lookup meaning in the provided table obj.
 * @param {string} wordString 
 * @param {string} domainName 
 * @param {Object} jsonRegExTable 
 * @returns {Object} Meaning-Obj
 */
function meaningLookUp(wordString, domainName, jsonRegExTable) {
    let meaningObj = [];
    try {
        systemDebuggingMsg(`Looking for the meaning of the word: ${wordString}`, debugMode);

        let count = 1;
        for (let i = 0; i < jsonRegExTable.length; i++) {
            let tempObj = {};
            if (jsonRegExTable[i].word === wordString) {
                if (domainName === "") {
                    let nameString = `${wordString}_Meaning_${count}`;
                    let meaningString = `${jsonRegExTable[i].Meaning}`;
                    if (meaningString.indexOf("<") > -1) {
                        meaningString = meaningString.replace(/<.*?>/g, " ").trim();
                    }
                    tempObj = {
                        "index": count,
                        "Name": nameString,
                        "Meaning": meaningString
                    };
                    count++;
                    meaningObj.push(tempObj);
                } else if (jsonRegExTable[i].category === domainName) {
                    tempObj = {
                        "index": count,
                        "Name": `${wordString}_Meaning_${count}`,
                        "Meaning": `${jsonRegExTable[i].Meaning}`
                    };
                    count++;
                    meaningObj.push(tempObj);
                }
            }
        }

        // console.log(meaningArray);
        if (meaningObj.length == 0) {
            systemDebuggingMsg(`Didn't find word "${wordString}" in the RegExBank with given domain ${domainName}!`, debugMode);
            return "";
        }

        systemDebuggingMsg(`Meaning found!`, debugMode);
        return meaningObj;

    } catch (error) {
        systemDebuggingMsg("Error happened when lookup the meaning of the word!", debugMode);
        console.log(error);
        return meaningObj;
    }
}

//---------------- Lookup Synonym of the word with meaning----------------------------
//------------------------------------------------------------------------------------
app.get("/wordSyn", lookUpSynProcess);

/**
 * Look up for the synonyms of the word under certain meaning
 * @param {string} req 
 * @param {string} res 
 */
function lookUpSynProcess(req, res) {
    let host = req.get('host');
    if (host.indexOf("localhost") >= 0) debugMode = true;

    var theInputJsonStr = req.query.json;
    const theJSON = parseJson(theInputJsonStr);
    let wordListsString = theJSON.word; // Required
    let regexBankPubID = theJSON.ID; // Optional
    let tabNum = theJSON.page; // Optional
    let domainName = theJSON.domain // Optional
    let meaningIndex = theJSON.meaning // Required


    regexBankPubID = regexBankPubID || defaultRegExBankID;
    domainName = domainName || defaultRegExDomain;
    tabNum = tabNum || defaultRegExBankPageNum;
    meaningIndex = meaningIndex || 0;

    if (wordListsString === undefined) {
        systemDebuggingMsg("Unvalide input! No string found!", debugMode);
        htmlDoc = "Unvalid input! No string found! Will reply with help document later!";
        res.setHeader('Content-Type', 'text/html');
        // res.sendFile('help.html', { root: __dirname });
        res.status(404).end(htmlDoc);
        return;
    }

    if (wordListsString.split(",").length > 1) {
        systemDebuggingMsg("You can't look up the meaning for more than one keyword string!", debugMode);
        res.setHeader('Content-Type', 'text/html');
        res.status(404).end("You can't look up the meaning for more than one keyword string!");
        return;
    }

    wordListsString = stringFlagsProcess(wordListsString);

    const fileName = `${regexBankPubID}_${tabNum}.json`;
    const theFilePath = path.join(__dirname, "./public/" + fileName);

    if (!fs.existsSync(theFilePath)) {
        systemDebuggingMsg("Didn't find on local cache. Loading from Server", debugMode)
        systemDebuggingMsg("Connecting to RegEx Bank. Please wait...", debugMode);
        findSynInGS(req, res);
    } else {
        systemDebuggingMsg("Quick loading Regex Bank...", debugMode);
        jsonRegExTable = JSON.parse(fs.readFileSync(theFilePath, 'utf8'));

        var resultObj = synLookUp(wordListsString, domainName, meaningIndex, jsonRegExTable);

        res.setHeader("Content-Type", "application/json");
        res.status(200).end(JSON.stringify(resultObj));
        const finalTime = new Date();
        systemDebuggingMsg(`It takes ${finalTime - iniTime} ms.`, debugMode);
        systemDebuggingMsg("Quit RegEx lookup function. Thank you for using!", debugMode);
    }
}

/**
 * Find meaning using Google Sheet.
 * @param {string} req 
 * @param {string} res 
 */
function findSynInGS(req, res) {
    const axios = require("axios");
    var theInputJsonStr = req.query.json;
    const theJSON = parseJson(theInputJsonStr);
    let wordString = theJSON.word; // Required
    let regexBankPubID = theJSON.ID; // Optional
    let domainName = theJSON.domain // Optional
    let tabNum = theJSON.page; // Optional
    let meaningIndex = theJSON.meaning;

    regexBankPubID = regexBankPubID || defaultRegExBankID;
    domainName = domainName || defaultRegExDomain;
    tabNum = tabNum || defaultRegExBankPageNum;
    meaningIndex = meaningIndex || defaultMeaningIndex;

    const fileName = `${regexBankPubID}_${tabNum}.json`;
    const theFilePath = path.join(__dirname, "./public/" + fileName);
    const regexBankURL = prefixPubSheetURL + regexBankPubID + suffixPubSheetURL;

    var jsonRegExTable = "";
    axios
        .get(regexBankURL)
        .then(function(response) {
            jsonRegExTable = regexTable2JSON(response, parseInt(tabNum));
            writeGS(JSON.stringify(jsonRegExTable), theFilePath);
            systemDebuggingMsg(`Online sheet is saved: ${theFilePath}!`, debugMode);
        })
        .catch(function(error) {
            systemDebuggingMsg("Failed to load the sheet!!!", debugMode);
            console.log(error);
            res.setHeader("Content-Type", "text/html");
            res.status(404).end(`Failed to build the connection to GS!`);
            return;
        })
        .then(function() {
            // always executed
            var resultObj = synLookUp(wordString, domainName, meaningIndex, jsonRegExTable);

            res.setHeader("Content-Type", "application/json");
            res.status(200).end(JSON.stringify(resultObj));
            const finalTime = new Date();
            systemDebuggingMsg(`It takes ${finalTime - iniTime} ms.`, debugMode);
            systemDebuggingMsg("Quit RegEx lookup function. Thank you for using!", debugMode);
        });
}

/**
 * Lookup meaning in the provided table obj.
 * @param {string} wordString 
 * @param {string} domainName 
 * @param {Object} jsonRegExTable 
 * @returns {Object} Meaning-Obj
 */
function synLookUp(wordString, domainName, meaningIndex, jsonRegExTable) {
    let wordDataArray = [];
    try {
        systemDebuggingMsg(`Looking for the synonyms of the word: ${wordString} with meaning.`, debugMode);

        for (let i = 0; i < jsonRegExTable.length; i++) {
            if (jsonRegExTable[i].word === wordString) {
                if (domainName === "") {
                    wordDataArray.push(jsonRegExTable[i]);
                } else if (jsonRegExTable[i].category === domainName) {
                    wordDataArray.push(jsonRegExTable[i]);
                }
            }
        }

        // console.log(meaningArray);
        if (wordDataArray.length == 0) {
            systemDebuggingMsg(`Didn't find word "${wordString}" in the RegExBank with given domain ${domainName}!`, debugMode);
            return wordDataArray;
        }

        systemDebuggingMsg(`Meaning found!`, debugMode);
        return wordDataArray[parseInt(meaningIndex)];

    } catch (error) {
        systemDebuggingMsg("Error happened when lookup the meaning of the word!", debugMode);
        console.log(error);
        return wordDataArray;
    }
}

//---------------- Lookup RegEx of List of Synonyms with Meaning ---------------------
//------------------------------------------------------------------------------------
app.get("/simWordRegEx", simpleWordRegExProcess);

/**
 * A simple process to do word-regex for words.
 * @param {string} req 
 * @param {string} res 
 */
function simpleWordRegExProcess(req, res) {
    let host = req.get('host');
    if (host.indexOf("localhost") >= 0) debugMode = true;

    var theInputJsonStr = req.query.json;
    const theJSON = parseJson(theInputJsonStr);
    let wordListsString = theJSON.word; // Required
    let regexBankPubID = theJSON.ID; // Optional
    let tabNum = theJSON.page; // Optional
    let domainName = theJSON.domain; // Optional
    let meaningIndex = theJSON.meaning; // Optional

    systemDebuggingMsg("Start RegEx lookup!", debugMode);
    systemDebuggingMsg("The keywords List string is: " + wordListsString, debugMode);

    regexBankPubID = regexBankPubID || defaultRegExBankID;
    tabNum = tabNum || defaultRegExBankPageNum;
    domainName = domainName || defaultRegExDomain;
    meaningIndex = meaningIndex || defaultMeaningIndex;

    if (wordListsString === undefined) {
        systemDebuggingMsg("Unvalide input! No string found!", debugMode);
        htmlDoc = "Unvalid input! No string found! Will reply with help document later!";
        res.setHeader('Content-Type', 'text/html');
        // res.sendFile('help.html', { root: __dirname });
        res.status(200).end(htmlDoc);
        return;
    }

    const fileName = `${regexBankPubID}_${tabNum}.json`;
    const theFilePath = path.join(__dirname, "./public/" + fileName);

    var jsonRegExTable;

    if (!fs.existsSync(theFilePath)) {
        systemDebuggingMsg("Didn't find on local cache. Loading from Server", debugMode)
        systemDebuggingMsg("Connecting to RegEx Bank. Please wait...", debugMode);
        simFindRegExInGS(req, res);
    } else {
        systemDebuggingMsg("Quick loading Regex Bank...", debugMode);
        jsonRegExTable = JSON.parse(fs.readFileSync(theFilePath, 'utf8'));

        var resultJSON = simRegexFinder(wordListsString, domainName, meaningIndex, jsonRegExTable);

        res.setHeader("Content-Type", "application/json");
        res.status(200).end(JSON.stringify(resultJSON));
        const finalTime = new Date();
        systemDebuggingMsg(`It takes ${finalTime - iniTime} ms.`, debugMode);
        systemDebuggingMsg("Quit RegEx lookup function. Thank you for using!", debugMode);
    }
}

/**
 * simple find the regex using list of word using GS.
 * @param {string} req 
 * @param {string} res 
 */
function simFindRegExInGS(req, res) {
    const axios = require("axios");
    var theInputJsonStr = req.query.json;
    const theJSON = parseJson(theInputJsonStr);
    let wordListsString = theJSON.word; // Required
    let regexBankPubID = theJSON.ID; // Optional
    let tabNum = theJSON.page; // Optional
    let domainName = theJSON.domain; // Optional
    let meaningIndex = theJSON.meaning; // Optional

    regexBankPubID = regexBankPubID || defaultRegExBankID;
    tabNum = tabNum || defaultRegExBankPageNum;
    domainName = domainName || defaultRegExDomain;
    meaningIndex = meaningIndex || defaultMeaningIndex;

    const fileName = `${regexBankPubID}_${tabNum}.json`;
    const theFilePath = path.join(__dirname, "./public/" + fileName);
    const regexBankURL = prefixPubSheetURL + regexBankPubID + suffixPubSheetURL;

    var jsonRegExTable;
    axios
        .get(regexBankURL)
        .then(function(response) {
            jsonRegExTable = regexTable2JSON(response, parseInt(tabNum));
            writeGS(JSON.stringify(jsonRegExTable), theFilePath);
            systemDebuggingMsg(`Online sheet is saved: ${theFilePath}!`, debugMode);
        })
        .catch(function(error) {
            systemDebuggingMsg("Failed to load the sheet!!!", debugMode);
            console.log(error);
            res.setHeader("Content-Type", "text/html");
            res.status(404).end(`Failed to build the connection to GS!`);
            return;
        })
        .then(function() {
            var resultJSON = simRegexFinder(wordListsString, domainName, meaningIndex, jsonRegExTable);

            res.setHeader("Content-Type", "application/json");
            res.status(200).end(JSON.stringify(resultJSON));
            const finalTime = new Date();
            systemDebuggingMsg(`It takes ${finalTime - iniTime} ms.`, debugMode);
            systemDebuggingMsg("Quit RegEx lookup function. Thank you for using!", debugMode);
        });
}

/**
 * This function support to decompose the keywordsString according to the syntax
 * @param {string} domainName the domain name of the word 
 * @param {string} keywordsString the keyword string with syntax in default
 * @param {string} meaningIndex the # of the meaning 
 * @param {object} jsonTable JSON table
 * @returns json String
 */
function simRegexFinder(keywordsString, domainName, meaningIndex, jsonTable) {
    systemDebuggingMsg("Decomposite the keywordString: " + keywordsString, debugMode);

    // split the keywordsList
    var keywordsList = [];
    let keywordsStringArray = keywordsString.split(",");

    // Extract flags from each keyword and process each keyword
    for (let i = 0; i < keywordsStringArray.length; i++) {
        let tempWord = stringFlagsProcess(keywordsStringArray[i]);
        keywordsList.push(tempWord);
    }

    var outputArray = [];

    for (let i = 0; i < keywordsList.length; i++) {
        var keywordStacking = "";
        var outputRegEx = "";
        var tempString = keywordsList[i];
        var owSwitch; // undefined means it just started. True means previous char was a word, False means previous char was a operator.

        if (debugMode) {
            console.log("Before:");
            console.log("KeywordStacking: " + keywordStacking);
            console.log("OutputRegEx: " + outputRegEx);
            console.log("TempString: " + tempString);
            // console.log("owSwitch: " + owSwitch);
        }

        // Separater the keywords and operators
        while (tempString.length > 0) {
            switch (owSwitch) {
                case undefined:
                    if (keyCharList.indexOf(tempString.charAt(0)) > -1) {
                        outputRegEx = outputRegEx + tempString.charAt(0);
                        if (tempString.charAt(0) == "\\") {
                            outputRegEx = outputRegEx + tempString.charAt(1);
                            tempString = tempString.substring(1);
                        }
                        owSwitch = false;
                    } else {
                        keywordStacking = keywordStacking + tempString.charAt(0);
                        owSwitch = true;
                    }
                    tempString = tempString.substring(1);

                    break;
                case true:
                    if (keyCharList.indexOf(tempString.charAt(0)) > -1) {
                        systemDebuggingMsg("Find: " + keywordStacking, debugMode);
                        let tempRegex = simRegexMatching(keywordStacking, domainName, meaningIndex, jsonTable);
                        outputRegEx = outputRegEx + tempRegex;
                        outputRegEx = outputRegEx + tempString.charAt(0);
                        if (tempString.charAt(0) == "\\") {
                            outputRegEx = outputRegEx + tempString.charAt(1);
                            tempString = tempString.substring(1);
                        }
                        keywordStacking = "";
                        owSwitch = false;
                    } else {
                        keywordStacking = keywordStacking + tempString.charAt(0);
                        owSwitch = true;
                    }
                    tempString = tempString.substring(1);
                    break;
                case false:
                    if (keyCharList.indexOf(tempString.charAt(0)) > -1) {
                        outputRegEx = outputRegEx + tempString.charAt(0);
                        owSwitch = false;
                    } else {
                        keywordStacking = keywordStacking + tempString.charAt(0);
                        owSwitch = true;
                    }
                    tempString = tempString.substring(1);
                    break;
                default:
                    systemDebuggingMsg("Surprise!!!!", debugMode);
                    break;
            }
            // console.log(tempString);
            // console.log(keywordStacking);
        }

        console.log(`Current Keyword Stacking is: ${keywordStacking}`);

        // Search each keyword for its regex.
        if (keywordStacking != "") {
            let tempRegex = simRegexMatching(keywordStacking, domainName, meaningIndex, jsonTable);
            outputRegEx = outputRegEx + tempRegex;
        }

        if (debugMode) {
            console.log("After:");
            console.log("KeywordStacking: " + keywordStacking);
            console.log("OutputRegEx: " + outputRegEx);
            console.log("TempString: " + tempString);
        }

        if (outputRegEx == "") {
            systemDebuggingMsg("Not found!", debugMode);
        } else {
            outputArray.push(outputRegEx);
        }
    }

    resultJSON = {

        "keyword": keywordsString,
        "domain": domainName,
        "meaning": meaningIndex,
        "regex": outputArray.join(",")
    }
    console.log(resultJSON);
    return (resultJSON);
}

/**
 * Find the regex for the provided word in the given domain using the bank table.
 * @param {string} domainName the domain name of the word 
 * @param {string} tWord the target word 
 * @param {JSON} jsonTable the json table object  
 * @returns the regex of the target word
 */
function simRegexMatching(keywordString, domainName, meaningIndex, jsonTable) {
    try {
        systemDebuggingMsg("Looking for the word: " + keywordString, debugMode);

        var wordArray = []
        for (i = 0; i < jsonTable.length; i++) {
            if (domainName === "") {
                if (jsonTable[i].word === keywordString) {
                    wordArray.push(jsonTable[i]);
                } else if (jsonTable[i].Meaning === meaningIndex) {
                    wordArray.push(jsonTable[i]);
                }
            } else if (jsonTable[i].word === keywordString &&
                jsonTable[i].domain === domainName) {
                wordArray.push(jsonTable[i]);
            }
        }

        console.log(wordArray);

        if (wordArray.length == 0) {
            return keywordString;
        }

        try {
            var tWord = wordArray[parseInt(meaningIndex)].word;
            var resultString = wordArray[parseInt(meaningIndex)].RegEx;
        } catch (e) {
            console.log("MeaningIndex is not a number!")
            var tWord = wordArray[0].word;
            var resultString = wordArray[0].RegEx;
        }

        if (resultString == "") {
            systemDebuggingMsg(`"${tWord}" has no regex!`, debugMode)
            if (tWord.length < 5) {
                resultString = `\\b(${tWord})`;
            } else {
                resultString = `\\b(${tWord})\\b`;
            }
            regexList.push(tempRegEx)
        } else {
            resultString = `\\b(${resultString})\\b`;
        }
        console.log(`${tWord}: ${resultString}`);
        return (resultString);

    } catch (error) {
        systemDebuggingMsg("Error happened!", debugMode);
        console.log(error);
        return ("");
    }
}

//====================================================================================
// >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>  Utility  <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
//------------------------------------------------------------------------------------

/**
 * Process the word string based on the flags.
 * @param {string} wordString 
 */
function stringFlagsProcess(wordString) {

    let wordFlagComponent = splitFlagWord(wordString);

    let tempWord = wordFlagComponent[0].trim() || "";
    let flagsList = wordFlagComponent[1] || "";

    if (flagsList === "") {
        tempWord = tempWord.replace(/\s+/g, " ");
    } else {
        if (flagsList.indexOf("i") > -1) {
            tempWord = tempWord.toLowerCase();
        }
        if (flagsList.indexOf("x") == -1) {
            tempWord = tempWord.replace(/\s+/g, " ");
        }
        if (flagsList.indexOf("M") > -1) {
            tempWord = myMathCharEscape(tempWord);
        }
    }

    return tempWord;

}

/**
 * Take the wordList string and split it into keyword and flags, strict in usage
 * @param {string} wordListString The string holds wordList (and flags).
 * @returns arrays with keyword and flag(s)
 */
function splitFlagWord(wordListString) {
    let flagsRegEx = "[" + reservedFlag.join("") + "]*";
    let blnFlags = wordListString.match(`^/.*/${flagsRegEx}$`) ? true : false;
    // console.log(blnFlags);
    let word = "";
    let flags = "";

    if (blnFlags) {
        word = wordListString.match("^(?=/).*(?<=/)")[0].slice(1, -1);
        flags = wordListString.match(`${flagsRegEx}$`)[0];
    } else {
        word = wordListString;
        flags = "";
    }

    var result = [word, flags];
    console.log(result);
    return result;
}

/**
 * Escape the math characters by backslash
 * @param {string} textString 
 * @returns string
 */
function myMathCharEscape(textString) {
    return textString.replace(/[\[\]{}()*+?.^]/g, '\\$&');
}

/**
 * A filter using in function regexMatching to find the unique item.
 * @param {string} value 
 * @param {number} index 
 * @param {object} self 
 * @returns 
 */
function onlyUnique(value, index, self) {
    return self.indexOf(value) === index;
}

/**
 * Produce the msg with system and timestamp for debugging, only. Output string will be Green and bold
 * @param {string} msg The message.
 * @param {string} debugMode The debugMode switch. In default, it is false.
 */
function systemDebuggingMsg(msg, debugMode) {
    if (debugMode) {
        let timeMillionSec = new Date();
        let yearS = timeMillionSec.getFullYear();
        let mthS = ("0" + (timeMillionSec.getMonth() + 1)).slice(-2);
        let dayS = ("0" + timeMillionSec.getDate()).slice(-2);
        let hhS = timeMillionSec.getHours();
        let mmS = timeMillionSec.getMinutes();
        let ssS = timeMillionSec.getSeconds();
        let timeStamp = `${yearS}-${mthS}-${dayS}-${hhS}:${mmS}:${ssS}`;
        // console.log(timeStamp);
        console.log(`>>>>> [System][${timeStamp}]: ${msg}`);
    }
}

/**
 * Save Google sheet.
 * @param {string} filelContent 
 * @param {string} FileName 
 */
function writeGS(filelContent, fileName) {
    var fs = require('fs');
    fs.writeFile(fileName, filelContent, function(err) {
        if (err) {
            return console.log(err);
        }
        console.log("The file was saved!");
    });
}

/**
 * Convert the regex bank table into JSON format.
 * @param {response} table the response from a GET request
 * @param {number} page the number of the tab on the provided spreadsheet. 
 * @returns the JSON of the response table.
 */
function regexTable2JSON(table, page) {

    systemDebuggingMsg("Convert regex bank into table. Please be patient!", debugMode);
    // console.log(">>>>> [System]: Obtaining the data...");
    const regexTable = /<table.*<\/table>/;
    var tableHTML = table.data.match(regexTable);
    // console.log(">>>>> [System]: Loading JSDOM...");
    const {
        JSDOM
    } = require("jsdom");
    // console.log(">>>>> [System]: Loading jquery...");
    const {
        window
    } = new JSDOM(tableHTML);
    const $ = require("jquery")(window);
    // console.log(">>>>> [System]: Extracting the table information...");
    var $table = $("table"),
        rows = [],
        header = [];
    var firstRun = 0;
    $table.find("tbody tr").each(function() {
        var row = {};
        if (firstRun == 0) {
            $(this).find("td").each(function() {
                if ($(this).find("div").length > 0) {
                    $(this).find("div").each(function() {
                        header.push($(this).html())
                    })
                } else {
                    header.push($(this).html());
                }
            });
            // console.log(header);
            firstRun = firstRun + 1;
        }
        $(this).find("td").each(function(i) {
            var key = header[i],
                value = $(this).html();
            row[key] = value;
        });
        rows.push(row);
    });
    systemDebuggingMsg("RegEx bank is loaded!", debugMode);
    return rows;
}

/**
 * Set port number for REST api listening.
 */
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`App listening on port ${PORT}`);
    console.log("Press Ctrl+C to quit.");
});