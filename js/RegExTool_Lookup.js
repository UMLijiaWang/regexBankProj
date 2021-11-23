//====================================================================================
// >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>    Section 1    <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
//------------------------------------------------------------------------------------
// Holds all the function on the HTML page.
// Functions may have the communication with regexBank server.

//====================================================================================
// >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>    To do List    <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
//------------------------------------------------------------------------------------
const toolURLBaseTEST = "http://localhost:8080";
const toolURLBase = "http://35.222.41.130:8080/";
const methodWordMeaning = "wordMeaning";
const methodWordSynonym = "wordSyn";
const methodWordRegEx = "wordRegex";
const methodSimWordRegEx = "simWordRegEx";

//====================================================================================
// >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>    Env Setting    <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
//------------------------------------------------------------------------------------


//====================================================================================
// >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>    Function Area    <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
//------------------------------------------------------------------------------------

/**
 * Step 1:
 * Obtain the keywords and return the meaning of the words, and make dropdown list.
 */
function searchForMeaning() {
    const urlBase = toolURLBase+methodWordMeaning;
    let inputString = document.getElementById("keywordsListInput").value;
    jsonObj = {
        'word': encodeURIComponent(inputString)
    }
    urlString = urlBase + "?json=" + JSON.stringify(jsonObj)
        // console.log(urlString);

    let meaningList = "";
    $.ajax({
        type: "GET",
        url: urlString,
        contentType: "application/json",
        async: false,
        success: function(response) {
            meaningList = response;
        }
    });

    // Generate dropdown List for meaning.
    console.log(meaningList);

    if (meaningList === "") {
        document.getElementById("finalRegExString").value = "";
        $("#layer_2").hide();
        console.log("Word not Found!");
        document.getElementById("finalRegExString").value = inputString;
        alert("Word not found!");
        return;
    }

    let meaningHTML = '<select id="meaningSelections" name = "meaningSelections">';

    for (let i = 0; i < meaningList.length; i++) {
        meaningHTML = meaningHTML +
            `<option class="meaningOption" id="meaningOption" name = "${meaningList[i].Name}" index = "${meaningList[i].index}" value = "${meaningList[i].Meaning}">${meaningList[i].Name}: ${meaningList[i].Meaning}</option>`
    }
    meaningHTML = meaningHTML + '</select>';
    // console.log(meaningHTML);
    $("#meaningSelectionsPlaceholder").html(meaningHTML);
    $("#layer_2").show();
}

/**
 * Step 2：
 * Find sysnonyms using meaning selected.
 */
function findSyns() {
    let tempHTML = "";
    let meaningIndexSelected = document.getElementById("meaningSelections").selectedOptions[0].index;
    let wordString = document.getElementById("keywordsListInput").value;

    const urlBase = toolURLBase + methodWordSynonym;
    jsonObj = {
        'word': encodeURIComponent(wordString),
        'meaning': meaningIndexSelected
    }
    urlString = urlBase + "?json=" + JSON.stringify(jsonObj)

    let targetArray = "";
    $.ajax({
        type: "GET",
        url: urlString,
        contentType: "application/json",
        async: false,
        success: function(response) {
            targetArray = response;
        }
    });
    // console.log(targetArray);

    tempHTML = '';
    let count = 1;
    // Add original word
    tempHTML = tempHTML +
        `<li class="new-select">` +
        `<input class="synCheckBox" id="synCheckBox" name="word0" type="checkbox" value="${targetArray["word"]}" checked>` +
        `<label id="wordLabel" for="word${count}">${targetArray["word"]}</label>` +
        `</li>`;
    // Add synonyms
    for (let j = 1; j <= 23; j++) {
        let tempName = `synonyms${j}`;
        if (targetArray[tempName] === "") {
            continue;
        } else {
            // console.log(targetArray[tempName]);
            tempHTML = tempHTML +
                `<li class="new-select">` +
                `<input class="synCheckBox" id="synCheckBox" name="word${count}" type="checkbox" value="${targetArray[tempName]}" checked>` +
                `<label id="wordLabel" for="word${count}">${targetArray[tempName]}</label>` +
                `</li>`;
            count++;
        }
    }

    $("#wordsList").html(tempHTML);
    $("#layer_3").show();
}

/**
 * Step 3:
 * Find regex using sysnonyms selected.
 */
function findRegExWords() {
    var checkItems = document.getElementsByClassName("synCheckBox");
    let meaningIndexSelected = document.getElementById("meaningSelections").selectedOptions[0].index;
    var wordsList = "";
    for (let i = 0; i < checkItems.length; i++) {
        if (checkItems[i].checked) {
            wordsList = wordsList + "|" + checkItems[i].value;
        }
    }
    wordsList = wordsList.slice(1);
    var tempObj = {
        "word": encodeURIComponent(wordsList),
        "meaning": meaningIndexSelected
    };

    console.log(tempObj);

    const urlBase = toolURLBase + "simWordRegEx";
    let urlString = urlBase + "?json=" + JSON.stringify(tempObj);
    console.log(urlString);

    let resultString = "";
    $.ajax({
        type: "GET",
        url: urlString,
        contentType: "application/json",
        async: false,
        success: function(response) {
            resultString = response.regex;
        }
    });

    console.log(resultString);
    document.getElementById("finalRegExString").value = resultString;
}

/**
 * Copy the final regex string into the clipboard.
 */
function copyToClipboard() {

    var copyText = document.getElementById("finalRegExString");

    /* Select the text field */
    copyText.select();
    copyText.setSelectionRange(0, 99999); /* For mobile devices */

    /* Copy the text inside the text field */
    navigator.clipboard.writeText(copyText.value);
    console.log(copyText.value);
    /* Alert the copied text */
    alert("Text is copied!");
}

/**
 * Check all the synonyms checkbox.
 */
function resetCheckboxes() {
    var checkItems = document.getElementsByClassName("synCheckBox");
    for (let i = 0; i < checkItems.length; i++) {
        if (!checkItems[i].checked) {
            checkItems[i].checked = true;
        }
    }
}